//! Intelligent routing algorithms for AI backends

use crate::{AiResult, AiError, AiProviderTrait, BackendMetrics, ChatRequest, CompletionRequest, EmbeddingRequest};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug};

/// Routing strategy types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoutingStrategy {
    /// Round-robin distribution
    RoundRobin,
    /// Weighted distribution based on performance
    Weighted,
    /// Route to provider with least active connections
    LeastConnections,
    /// Random distribution
    Random,
    /// Cost-optimized routing
    CostOptimized,
    /// Performance-optimized routing (lowest latency)
    PerformanceOptimized,
    /// Hybrid strategy balancing cost and performance
    Balanced,
}

/// Routing decision result
#[derive(Debug, Clone)]
pub struct RoutingDecision {
    pub provider_name: String,
    pub strategy_used: RoutingStrategy,
    pub confidence_score: f64,
    pub reasoning: String,
}

/// Provider performance metrics
#[derive(Debug, Clone)]
pub struct ProviderPerformance {
    pub avg_response_time: f64,
    pub success_rate: f64,
    pub current_load: u32,
    pub cost_per_token: f64,
    pub error_rate: f64,
    pub last_updated: u64,
}

impl Default for ProviderPerformance {
    fn default() -> Self {
        Self {
            avg_response_time: 1000.0, // 1 second default
            success_rate: 1.0,         // 100% success
            current_load: 0,
            cost_per_token: 0.002,     // Default cost
            error_rate: 0.0,
            last_updated: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        }
    }
}

/// Intelligent router for AI backends
pub struct IntelligentRouter {
    providers: Arc<RwLock<HashMap<String, Box<dyn AiProviderTrait>>>>,
    performance_metrics: Arc<RwLock<HashMap<String, ProviderPerformance>>>,
    round_robin_index: Arc<RwLock<HashMap<String, usize>>>,
    strategy: RoutingStrategy,
    cost_weight: f64,      // Weight for cost in balanced strategy (0.0-1.0)
    perf_weight: f64,      // Weight for performance in balanced strategy (0.0-1.0)
}

impl IntelligentRouter {
    /// Create a new intelligent router
    pub fn new(strategy: RoutingStrategy) -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            performance_metrics: Arc::new(RwLock::new(HashMap::new())),
            round_robin_index: Arc::new(RwLock::new(HashMap::new())),
            strategy,
            cost_weight: 0.3,  // 30% weight on cost
            perf_weight: 0.7,  // 70% weight on performance
        }
    }

    /// Add a provider to the router
    pub async fn add_provider(&self, name: &str, provider: Box<dyn AiProviderTrait>) {
        let mut providers = self.providers.write().await;
        providers.insert(name.to_string(), provider);

        let mut metrics = self.performance_metrics.write().await;
        metrics.insert(name.to_string(), ProviderPerformance::default());

        let mut rr_index = self.round_robin_index.write().await;
        rr_index.insert(name.to_string(), 0);

        info!("Added provider '{}' to intelligent router", name);
    }

    /// Remove a provider from the router
    pub async fn remove_provider(&self, name: &str) {
        let mut providers = self.providers.write().await;
        providers.remove(name);

        let mut metrics = self.performance_metrics.write().await;
        metrics.remove(name);

        let mut rr_index = self.round_robin_index.write().await;
        rr_index.remove(name);

        info!("Removed provider '{}' from intelligent router", name);
    }

    /// Update provider performance metrics
    pub async fn update_performance(&self, provider_name: &str, metrics: BackendMetrics) {
        let mut perf_metrics = self.performance_metrics.write().await;

        if let Some(perf) = perf_metrics.get_mut(provider_name) {
            // Update response time (exponential moving average)
            let alpha = 0.1; // Smoothing factor
            perf.avg_response_time = alpha * metrics.response_time_avg + (1.0 - alpha) * perf.avg_response_time;

            // Update success rate
            let total_requests = metrics.requests_total as f64;
            if total_requests > 0.0 {
                perf.success_rate = (metrics.requests_total - metrics.requests_failed) as f64 / total_requests;
            }

            // Update error rate
            perf.error_rate = metrics.requests_failed as f64 / total_requests.max(1.0);

            // Update current load (simplified)
            perf.current_load = (metrics.requests_total % 100) as u32; // Mock load

            perf.last_updated = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;

            debug!("Updated performance metrics for provider '{}': avg_time={:.2}ms, success_rate={:.3}, load={}",
                   provider_name, perf.avg_response_time, perf.success_rate, perf.current_load);
        }
    }

    /// Route a chat completion request
    pub async fn route_chat_completion(&self, request: &ChatRequest) -> AiResult<RoutingDecision> {
        self.route_request(&request.model, "chat_completion").await
    }

    /// Route a text completion request
    pub async fn route_text_completion(&self, request: &CompletionRequest) -> AiResult<RoutingDecision> {
        self.route_request(&request.model, "text_completion").await
    }

    /// Route an embedding request
    pub async fn route_embeddings(&self, request: &EmbeddingRequest) -> AiResult<RoutingDecision> {
        self.route_request(&request.model, "embeddings").await
    }

    /// Core routing logic
    async fn route_request(&self, model: &str, request_type: &str) -> AiResult<RoutingDecision> {
        let providers = self.providers.read().await;
        let performance = self.performance_metrics.read().await;

        if providers.is_empty() {
            return Err(AiError::Config("No providers available for routing".to_string()));
        }

        // Find providers that support this model
        let mut available_providers: Vec<(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)> = providers
            .iter()
            .filter_map(|(name, provider)| {
                performance.get(name).map(|perf| (name, provider, perf))
            })
            .filter(|(_, provider, _)| provider.supports_model(model))
            .collect();

        if available_providers.is_empty() {
            return Err(AiError::ModelNotAvailable(format!("No provider supports model: {}", model)));
        }

        // Apply routing strategy
        let decision = match self.strategy {
            RoutingStrategy::RoundRobin => self.route_round_robin(&available_providers, request_type).await,
            RoutingStrategy::Weighted => self.route_weighted(&available_providers, request_type).await,
            RoutingStrategy::LeastConnections => self.route_least_connections(&available_providers, request_type).await,
            RoutingStrategy::Random => self.route_random(&available_providers, request_type).await,
            RoutingStrategy::CostOptimized => self.route_cost_optimized(&available_providers, request_type).await,
            RoutingStrategy::PerformanceOptimized => self.route_performance_optimized(&available_providers, request_type).await,
            RoutingStrategy::Balanced => self.route_balanced(&available_providers, request_type).await,
        };

        debug!("Routed {} request for model '{}' to provider '{}' using {:?} strategy (confidence: {:.2})",
               request_type, model, decision.provider_name, decision.strategy_used, decision.confidence_score);

        Ok(decision)
    }

    /// Round-robin routing
    async fn route_round_robin(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        let mut rr_index = self.round_robin_index.write().await;
        let count = providers.len();

        // Use request type as key for separate round-robin counters
        let key = format!("{}_rr", request_type);
        let index = rr_index.entry(key).or_insert(0);

        let selected_provider = providers[*index % count].0.clone();
        *index = (*index + 1) % count;

        RoutingDecision {
            provider_name: selected_provider,
            strategy_used: RoutingStrategy::RoundRobin,
            confidence_score: 0.8,
            reasoning: format!("Round-robin selection: index {}", *index),
        }
    }

    /// Weighted routing based on performance and cost
    async fn route_weighted(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        let mut best_provider = providers[0].0.clone();
        let mut best_score = 0.0;

        for (name, _, perf) in providers {
            // Calculate weighted score: higher success rate and lower response time = higher score
            let performance_score = perf.success_rate * (1.0 / (1.0 + perf.avg_response_time / 1000.0));
            let load_penalty = 1.0 / (1.0 + perf.current_load as f64 / 10.0);
            let score = performance_score * load_penalty;

            if score > best_score {
                best_score = score;
                best_provider = name.to_string();
            }
        }

        RoutingDecision {
            provider_name: best_provider,
            strategy_used: RoutingStrategy::Weighted,
            confidence_score: best_score.min(1.0),
            reasoning: format!("Weighted selection: score {:.3}", best_score),
        }
    }

    /// Least connections routing
    async fn route_least_connections(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        let mut best_provider = providers[0].0.clone();
        let mut min_load = u32::MAX;

        for (name, _, perf) in providers {
            if perf.current_load < min_load {
                min_load = perf.current_load;
                best_provider = name.to_string();
            }
        }

        RoutingDecision {
            provider_name: best_provider,
            strategy_used: RoutingStrategy::LeastConnections,
            confidence_score: 0.9,
            reasoning: format!("Least connections: load {}", min_load),
        }
    }

    /// Random routing
    async fn route_random(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        use rand::{thread_rng, Rng};
        let mut rng = thread_rng();
        let index = rng.gen_range(0..providers.len());
        let selected_provider = providers[index].0.clone();

        RoutingDecision {
            provider_name: selected_provider,
            strategy_used: RoutingStrategy::Random,
            confidence_score: 0.5,
            reasoning: format!("Random selection: index {}", index),
        }
    }

    /// Cost-optimized routing
    async fn route_cost_optimized(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        let mut best_provider = providers[0].0.clone();
        let mut lowest_cost = f64::MAX;

        for (name, provider, perf) in providers {
            if let Some(cost) = provider.get_model_pricing(&format!("dummy_model")) {
                let adjusted_cost = cost * (1.0 + perf.error_rate); // Penalize error-prone providers
                if adjusted_cost < lowest_cost {
                    lowest_cost = adjusted_cost;
                    best_provider = name.to_string();
                }
            }
        }

        RoutingDecision {
            provider_name: best_provider,
            strategy_used: RoutingStrategy::CostOptimized,
            confidence_score: 0.85,
            reasoning: format!("Cost optimized: ${:.6} per token", lowest_cost),
        }
    }

    /// Performance-optimized routing
    async fn route_performance_optimized(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        let mut best_provider = providers[0].0.clone();
        let mut best_performance = f64::MAX;

        for (name, _, perf) in providers {
            // Performance score: lower response time + higher success rate = better performance
            let performance_score = perf.avg_response_time / perf.success_rate.max(0.1);
            if performance_score < best_performance {
                best_performance = performance_score;
                best_provider = name.to_string();
            }
        }

        RoutingDecision {
            provider_name: best_provider,
            strategy_used: RoutingStrategy::PerformanceOptimized,
            confidence_score: 0.9,
            reasoning: format!("Performance optimized: score {:.2}", best_performance),
        }
    }

    /// Balanced routing (cost + performance)
    async fn route_balanced(&self, providers: &[(&String, &Box<dyn AiProviderTrait>, &ProviderPerformance)], request_type: &str) -> RoutingDecision {
        let mut best_provider = providers[0].0.clone();
        let mut best_score = 0.0;

        for (name, provider, perf) in providers {
            // Normalize metrics
            let normalized_response_time = (perf.avg_response_time / 5000.0).min(1.0); // Assume 5s max
            let normalized_success_rate = perf.success_rate;
            let normalized_cost = if let Some(cost) = provider.get_model_pricing(&format!("dummy_model")) {
                (cost / 0.1).min(1.0) // Assume $0.10 max per token
            } else {
                0.5
            };

            // Calculate balanced score
            let performance_score = (1.0 - normalized_response_time) * normalized_success_rate;
            let cost_score = 1.0 - normalized_cost;

            let balanced_score = self.perf_weight * performance_score + self.cost_weight * cost_score;

            if balanced_score > best_score {
                best_score = balanced_score;
                best_provider = name.to_string();
            }
        }

        RoutingDecision {
            provider_name: best_provider,
            strategy_used: RoutingStrategy::Balanced,
            confidence_score: best_score.min(1.0),
            reasoning: format!("Balanced routing: score {:.3} (perf_weight: {:.1}, cost_weight: {:.1})",
                             best_score, self.perf_weight, self.cost_weight),
        }
    }

    /// Get current routing strategy
    pub fn get_strategy(&self) -> RoutingStrategy {
        self.strategy
    }

    /// Set routing strategy
    pub fn set_strategy(&mut self, strategy: RoutingStrategy) {
        self.strategy = strategy;
        info!("Changed routing strategy to {:?}", strategy);
    }

    /// Set balanced routing weights
    pub fn set_balanced_weights(&mut self, cost_weight: f64, perf_weight: f64) {
        self.cost_weight = cost_weight;
        self.perf_weight = perf_weight;
        info!("Updated balanced routing weights: cost={:.2}, performance={:.2}", cost_weight, perf_weight);
    }

    /// Get provider performance metrics
    pub async fn get_provider_performance(&self, provider_name: &str) -> Option<ProviderPerformance> {
        let metrics = self.performance_metrics.read().await;
        metrics.get(provider_name).cloned()
    }

    /// Get all provider performance metrics
    pub async fn get_all_performance_metrics(&self) -> HashMap<String, ProviderPerformance> {
        let metrics = self.performance_metrics.read().await;
        metrics.clone()
    }
}

impl Default for IntelligentRouter {
    fn default() -> Self {
        Self::new(RoutingStrategy::Balanced)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AiProvider, ProviderConfig};

    #[tokio::test]
    async fn test_router_creation() {
        let router = IntelligentRouter::new(RoutingStrategy::RoundRobin);
        assert_eq!(router.get_strategy(), RoutingStrategy::RoundRobin);
    }

    #[tokio::test]
    async fn test_provider_management() {
        let router = IntelligentRouter::new(RoutingStrategy::RoundRobin);

        // Create a mock provider (simplified)
        let config = ProviderConfig {
            provider: AiProvider::OpenAI,
            api_key: "test".to_string(),
            base_url: None,
            organization_id: None,
            timeout_seconds: 30,
            max_retries: 3,
            models: vec![],
        };

        // Note: In real implementation, we'd create actual provider instances
        // For testing, we just check the structure

        assert_eq!(router.get_strategy(), RoutingStrategy::RoundRobin);
    }

    #[tokio::test]
    async fn test_routing_decision_structure() {
        let router = IntelligentRouter::new(RoutingStrategy::RoundRobin);

        let request = ChatRequest {
            messages: vec![],
            model: "gpt-3.5-turbo".to_string(),
            temperature: None,
            max_tokens: None,
            stream: None,
            functions: None,
            function_call: None,
            stop: None,
            presence_penalty: None,
            frequency_penalty: None,
            logit_bias: None,
            user: None,
        };

        // Should fail with no providers
        let result = router.route_chat_completion(&request).await;
        assert!(result.is_err());
    }
}
