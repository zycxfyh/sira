//! # Sira Core
//!
//! Core services container providing dependency injection and service management
//! for the Sira AI Gateway ecosystem.

pub mod error;
pub mod types;

/// Result type alias for Sira operations
pub type SiraResult<T> = Result<T, crate::error::SiraError>;

/// Core service trait for dependency injection
#[async_trait::async_trait]
pub trait Service: Send + Sync {
    /// Initialize the service
    async fn init(&mut self) -> SiraResult<()> {
        Ok(())
    }

    /// Shutdown the service
    async fn shutdown(&mut self) -> SiraResult<()> {
        Ok(())
    }
}

/// Service container for dependency injection
pub struct ServiceContainer {
    services: std::collections::HashMap<String, Box<dyn Service>>,
}

impl ServiceContainer {
    /// Create a new service container
    pub fn new() -> Self {
        Self {
            services: std::collections::HashMap::new(),
        }
    }

    /// Register a service
    pub fn register<S: Service + 'static>(&mut self, name: &str, service: S) {
        self.services.insert(name.to_string(), Box::new(service));
    }

    /// Get a service by name
    pub fn get(&self, name: &str) -> Option<&dyn Service> {
        self.services.get(name).map(|s| s.as_ref())
    }
}

impl Default for ServiceContainer {
    fn default() -> Self {
        Self::new()
    }
}
