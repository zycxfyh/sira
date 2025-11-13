//! Load balancing and failover mechanisms for AI backends

use crate::{AiResult, AiError, AiProviderTrait, BackendMetrics, RoutingDecision};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// Backend health status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendHealth {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Backend instance
// Removed Debug derive due to trait bounds
pub struct BackendInstance {
    pub name: String,
    pub provider: Box<dyn AiProviderTrait>,
    pub health: BackendHealth,
    pub weight: u32,
    pub current_connections: u32,
    pub max_connections: u32,
    pub last_health_check: u64,
    pub consecutive_failures: u32,
}

impl BackendInstance {
    pub fn new(name: &str, provider: Box<dyn AiProviderTrait>, max_connections: u32) -> Self {
        Self {
            name: name.to_string(),
            provider,
            health: BackendHealth::Healthy,
            weight: 1,
            current_connections: 0,
            max_connections,
            last_health_check: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
            consecutive_failures: 0,
        }
    }

    pub fn can_accept_connection(&self) -> bool {
        self.health == BackendHealth::Healthy && self.current_connections < self.max_connections
    }

    pub fn increment_connections(&mut self) {
        if self.current_connections < self.max_connections {
            self.current_connections += 1;
        }
    }

    pub fn decrement_connections(&mut self) {
        if self.current_connections > 0 {
            self.current_connections -= 1;
        }
    }

    pub fn update_health(&mut self, health: BackendHealth) {
        self.health = health;
        self.last_health_check = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        if health == BackendHealth::Healthy {
            self.consecutive_failures = 0;
        } else {
            self.consecutive_failures += 1;
        }
    }
}

/// Load balancing strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadBalancingStrategy {
    RoundRobin,
    WeightedRoundRobin,
    LeastConnections,
    Random,
    IpHash,
}

/// Load balancer configuration
#[derive(Debug, Clone)]
pub struct LoadBalancerConfig {
    pub health_check_interval_seconds: u64,
    pub max_consecutive_failures: u32,
    pub connection_timeout_seconds: u64,
    pub failover_enabled: bool,
    pub circuit_breaker_enabled: bool,
    pub circuit_breaker_threshold: f64,
}

impl Default for LoadBalancerConfig {
    fn default() -> Self {
        Self {
            health_check_interval_seconds: 30,
            max_consecutive_failures: 3,
            connection_timeout_seconds: 30,
            failover_enabled: true,
            circuit_breaker_enabled: true,
            circuit_breaker_threshold: 0.5, // 50% failure rate
        }
    }
}

/// Circuit breaker state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitBreakerState {
    Closed,   // Normal operation
    Open,     // Circuit is open, failing fast
    HalfOpen, // Testing if service recovered
}

/// Load balancer with failover capabilities
pub struct LoadBalancer {
    backends: Arc<RwLock<HashMap<String, BackendInstance>>>,
    config: LoadBalancerConfig,
    strategy: LoadBalancingStrategy,
    round_robin_index: Arc<RwLock<usize>>,
    circuit_breakers: Arc<RwLock<HashMap<String, CircuitBreakerState>>>,
    running: Arc<RwLock<bool>>,
}

impl LoadBalancer {
    /// Create a new load balancer
    pub fn new(strategy: LoadBalancingStrategy, config: LoadBalancerConfig) -> Self {
        Self {
            backends: Arc::new(RwLock::new(HashMap::new())),
            config,
            strategy,
            round_robin_index: Arc::new(RwLock::new(0)),
            circuit_breakers: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start the load balancer
    pub async fn start(&self) -> AiResult<()> {
        let mut running = self.running.write().await;
        *running = true;

        // Start health check loop
        let backends = self.backends.clone();
        let circuit_breakers = self.circuit_breakers.clone();
        let config = self.config.clone();
        let running_clone = self.running.clone();

        tokio::spawn(async move {
            Self::health_check_loop(backends, circuit_breakers, config, running_clone).await;
        });

        info!("Load balancer started with {:?} strategy", self.strategy);
        Ok(())
    }

    /// Stop the load balancer
    pub async fn stop(&self) -> AiResult<()> {
        let mut running = self.running.write().await;
        *running = false;
        info!("Load balancer stopped");
        Ok(())
    }

    /// Add a backend instance
    pub async fn add_backend(&self, name: &str, provider: Box<dyn AiProviderTrait>, max_connections: u32) -> AiResult<()> {
        let backend = BackendInstance::new(name, provider, max_connections);

        let mut backends = self.backends.write().await;
        backends.insert(name.to_string(), backend);

        let mut circuit_breakers = self.circuit_breakers.write().await;
        circuit_breakers.insert(name.to_string(), CircuitBreakerState::Closed);

        info!("Added backend '{}' to load balancer", name);
        Ok(())
    }

    /// Remove a backend instance
    pub async fn remove_backend(&self, name: &str) -> AiResult<()> {
        let mut backends = self.backends.write().await;
        backends.remove(name);

        let mut circuit_breakers = self.circuit_breakers.write().await;
        circuit_breakers.remove(name);

        info!("Removed backend '{}' from load balancer", name);
        Ok(())
    }

    /// Select a backend for request processing
    pub async fn select_backend(&self, model: &str, client_ip: Option<&str>) -> AiResult<String> {
        let backends = self.backends.read().await;
        let circuit_breakers = self.circuit_breakers.read().await;

        if backends.is_empty() {
            return Err(AiError::Config("No backends available".to_string()));
        }

        // Filter healthy backends that support the model
        let mut available_backends: Vec<&BackendInstance> = backends
            .values()
            .filter(|backend| {
                backend.health == BackendHealth::Healthy &&
                backend.can_accept_connection() &&
                backend.provider.supports_model(model) &&
                *circuit_breakers.get(&backend.name).unwrap_or(&CircuitBreakerState::Closed) != CircuitBreakerState::Open
            })
            .collect();

        if available_backends.is_empty() {
            return Err(AiError::Config(format!("No healthy backends available for model '{}'", model)));
        }

        // Apply load balancing strategy
        let selected_backend = match self.strategy {
            LoadBalancingStrategy::RoundRobin => self.select_round_robin(&available_backends).await,
            LoadBalancingStrategy::WeightedRoundRobin => self.select_weighted_round_robin(&available_backends).await,
            LoadBalancingStrategy::LeastConnections => self.select_least_connections(&available_backends).await,
            LoadBalancingStrategy::Random => self.select_random(&available_backends).await,
            LoadBalancingStrategy::IpHash => self.select_ip_hash(&available_backends, client_ip).await,
        };

        Ok(selected_backend.name.clone())
    }

    /// Execute request with connection tracking and failover
    pub async fn execute_with_failover<F, Fut, T>(
        &self,
        backend_name: &str,
        operation: F,
    ) -> AiResult<T>
    where
        F: FnOnce(&dyn AiProviderTrait) -> Fut,
        Fut: std::future::Future<Output = AiResult<T>>,
    {
        let mut backends = self.backends.write().await;

        if let Some(backend) = backends.get_mut(backend_name) {
            // Check circuit breaker
            let circuit_breakers = self.circuit_breakers.read().await;
            if *circuit_breakers.get(backend_name).unwrap_or(&CircuitBreakerState::Closed) == CircuitBreakerState::Open {
                return Err(AiError::Provider { provider: "CircuitBreaker".to_string(), message: format!("Circuit breaker open for backend '{}'", backend_name) });
            }

            backend.increment_connections();

            // Execute operation
            let result = operation(&*backend.provider).await;

            backend.decrement_connections();

            match result {
                Ok(value) => {
                    // Success - update health
                    backend.update_health(BackendHealth::Healthy);
                    Ok(value)
                }
                Err(e) => {
                    // Failure - update health and potentially trigger failover
                    backend.update_health(BackendHealth::Degraded);

                    if backend.consecutive_failures >= self.config.max_consecutive_failures {
                        backend.update_health(BackendHealth::Unhealthy);
                        warn!("Backend '{}' marked as unhealthy after {} consecutive failures",
                              backend_name, backend.consecutive_failures);
                    }

                    // Check circuit breaker threshold
                    if self.config.circuit_breaker_enabled {
                        let failure_rate = backend.consecutive_failures as f64 /
                                         (backend.consecutive_failures as f64 + 1.0).max(1.0);
                        if failure_rate >= self.config.circuit_breaker_threshold {
                            let mut circuit_breakers = self.circuit_breakers.write().await;
                            circuit_breakers.insert(backend_name.to_string(), CircuitBreakerState::Open);
                            warn!("Circuit breaker opened for backend '{}' (failure rate: {:.2})",
                                  backend_name, failure_rate);
                        }
                    }

                    Err(e)
                }
            }
        } else {
            Err(AiError::Config(format!("Backend '{}' not found", backend_name)))
        }
    }

    /// Get backend metrics
    pub async fn get_backend_metrics(&self, backend_name: &str) -> Option<BackendMetrics> {
        let backends = self.backends.read().await;
        backends.get(backend_name).map(|backend| BackendMetrics {
            requests_total: 0, // Would be tracked separately
            requests_failed: backend.consecutive_failures as u64,
            tokens_used: 0, // Would be tracked separately
            response_time_avg: 0.0, // Would be tracked separately
            last_request_at: Some(backend.last_health_check),
        })
    }

    /// Get all backend statuses
    pub async fn get_backend_statuses(&self) -> HashMap<String, (BackendHealth, u32)> {
        let backends = self.backends.read().await;
        backends
            .iter()
            .map(|(name, backend)| {
                (name.clone(), (backend.health, backend.current_connections))
            })
            .collect()
    }

    /// Round-robin selection
    async fn select_round_robin<'a>(&self, backends: &[&'a BackendInstance]) -> &'a BackendInstance {
        let mut index = self.round_robin_index.write().await;
        let selected = &backends[*index % backends.len()];
        *index = (*index + 1) % backends.len();
        selected
    }

    /// Weighted round-robin selection
    async fn select_weighted_round_robin<'a>(&self, backends: &[&'a BackendInstance]) -> &'a BackendInstance {
        let total_weight: u32 = backends.iter().map(|b| b.weight).sum();
        if total_weight == 0 {
            return backends[0];
        }

        let mut index = self.round_robin_index.write().await;
        let mut current_weight = 0u32;

        for backend in backends {
            current_weight += backend.weight;
            if *index < current_weight as usize {
                *index = (*index + 1) % total_weight as usize;
                return backend;
            }
        }

        backends[0]
    }

    /// Least connections selection
    async fn select_least_connections<'a>(&self, backends: &[&'a BackendInstance]) -> &'a BackendInstance {
        backends
            .iter()
            .min_by_key(|b| b.current_connections)
            .unwrap_or(&backends[0])
    }

    /// Random selection
    async fn select_random<'a>(&self, backends: &[&'a BackendInstance]) -> &'a BackendInstance {
        use rand::{thread_rng, Rng};
        let mut rng = thread_rng();
        let index = rng.gen_range(0..backends.len());
        backends[index]
    }

    /// IP hash selection
    async fn select_ip_hash<'a>(&self, backends: &[&'a BackendInstance], client_ip: Option<&str>) -> &'a BackendInstance {
        if let Some(ip) = client_ip {
            let hash = Self::simple_hash(ip);
            backends[hash % backends.len()]
        } else {
            self.select_random(backends).await
        }
    }

    /// Simple hash function for IP hashing
    fn simple_hash(s: &str) -> usize {
        let mut hash = 0usize;
        for byte in s.bytes() {
            hash = hash.wrapping_mul(31).wrapping_add(byte as usize);
        }
        hash
    }

    /// Health check loop
    async fn health_check_loop(
        backends: Arc<RwLock<HashMap<String, BackendInstance>>>,
        circuit_breakers: Arc<RwLock<HashMap<String, CircuitBreakerState>>>,
        config: LoadBalancerConfig,
        running: Arc<RwLock<bool>>,
    ) {
        info!("Load balancer health check loop started");

        while *running.read().await {
            tokio::time::sleep(tokio::time::Duration::from_secs(config.health_check_interval_seconds)).await;

            let mut backends_guard = backends.write().await;
            let mut circuit_breakers_guard = circuit_breakers.write().await;

            for (name, backend) in backends_guard.iter_mut() {
                // Simple health check - in real implementation, this would make actual API calls
                let is_healthy = backend.consecutive_failures < config.max_consecutive_failures;

                let new_health = if is_healthy {
                    BackendHealth::Healthy
                } else {
                    BackendHealth::Unhealthy
                };

                if backend.health != new_health {
                    backend.update_health(new_health);
                    info!("Backend '{}' health changed to {:?}", name, new_health);
                }

                // Handle circuit breaker recovery
                if let Some(state) = circuit_breakers_guard.get_mut(name) {
                    match state {
                        CircuitBreakerState::Open => {
                            // Try to close circuit breaker (half-open test)
                            *state = CircuitBreakerState::HalfOpen;
                        }
                        CircuitBreakerState::HalfOpen => {
                            // If backend is healthy, close circuit breaker
                            if backend.health == BackendHealth::Healthy {
                                *state = CircuitBreakerState::Closed;
                                info!("Circuit breaker closed for backend '{}'", name);
                            } else {
                                *state = CircuitBreakerState::Open;
                            }
                        }
                        CircuitBreakerState::Closed => {
                            // Keep closed
                        }
                    }
                }
            }
        }

        info!("Load balancer health check loop stopped");
    }
}

impl Default for LoadBalancer {
    fn default() -> Self {
        Self::new(LoadBalancingStrategy::LeastConnections, LoadBalancerConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_load_balancer_creation() {
        let lb = LoadBalancer::new(LoadBalancingStrategy::RoundRobin, LoadBalancerConfig::default());
        assert_eq!(lb.strategy, LoadBalancingStrategy::RoundRobin);
    }

    #[tokio::test]
    async fn test_backend_selection_empty() {
        let lb = LoadBalancer::default();
        let result = lb.select_backend("gpt-3.5-turbo", None).await;
        assert!(result.is_err());
    }
}
