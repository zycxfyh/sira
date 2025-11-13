//! Core microkernel implementation
//!
//! This module provides the main Microkernel struct that orchestrates
//! all the core components: plugin manager, service registry, message bus, and resource manager.

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

use crate::error::{KernelError, KernelResult};
use crate::plugin::{PluginManager, PluginContext, KernelState};
use crate::service::ServiceRegistry;
use crate::message::MessageBus;
use crate::resource::{ResourceManager, ResourceLimits};

/// Kernel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelConfig {
    /// Resource limits
    pub resource_limits: ResourceLimits,
    /// Plugin directories
    pub plugin_dirs: Vec<String>,
    /// Message bus buffer size
    pub message_buffer_size: usize,
    /// Heartbeat interval in seconds
    pub heartbeat_interval: u64,
    /// Service timeout in seconds
    pub service_timeout: u64,
    /// Enable plugin auto-discovery
    pub auto_discover_plugins: bool,
    /// Enable resource monitoring
    pub enable_resource_monitoring: bool,
}

impl Default for KernelConfig {
    fn default() -> Self {
        KernelConfig {
            resource_limits: ResourceLimits {
                max_cpu: num_cpus::get() as u32,
                max_memory: 8192, // 8GB default
                max_disk: 100,    // 100GB default
                max_network: 1000, // 1000Mbps default
                max_gpu: 0,       // No GPU by default
                max_db_connections: 100,
            },
            plugin_dirs: vec![
                "./plugins".to_string(),
                "./layers/rust/plugins".to_string(),
                "./layers/python/plugins".to_string(),
                "./layers/go/plugins".to_string(),
            ],
            message_buffer_size: 1000,
            heartbeat_interval: 30,
            service_timeout: 90,
            auto_discover_plugins: true,
            enable_resource_monitoring: true,
        }
    }
}

/// The Sira Microkernel - the core of the entire system
pub struct Microkernel {
    /// Kernel configuration
    config: KernelConfig,
    /// Plugin manager
    plugin_manager: Arc<PluginManager>,
    /// Service registry
    service_registry: Arc<ServiceRegistry>,
    /// Message bus
    message_bus: Arc<MessageBus>,
    /// Resource manager
    resource_manager: Arc<ResourceManager>,
    /// Kernel state
    kernel_state: Arc<RwLock<KernelState>>,
    /// Running flag
    running: RwLock<bool>,
}

impl Microkernel {
    /// Create a new microkernel with configuration
    pub async fn new(config: KernelConfig) -> KernelResult<Self> {
        // Initialize components
        let message_bus = Arc::new(MessageBus::new());
        let resource_manager = Arc::new(ResourceManager::new(config.resource_limits.clone()));
        let kernel_state = Arc::new(RwLock::new(KernelState::default()));

        let service_registry = Arc::new(ServiceRegistry::new(message_bus.clone()));
        let plugin_manager = Arc::new(PluginManager::new(
            message_bus.clone(),
            resource_manager.clone(),
            kernel_state.clone(),
        ));

        // Add plugin directories (clone the manager to modify it)
        let mut pm_clone = PluginManager::new(
            message_bus.clone(),
            resource_manager.clone(),
            kernel_state.clone(),
        );
        for dir in &config.plugin_dirs {
            pm_clone.add_plugin_dir(dir);
        }
        let plugin_manager = Arc::new(pm_clone);

        let kernel = Microkernel {
            config,
            plugin_manager,
            service_registry,
            message_bus,
            resource_manager,
            kernel_state,
            running: RwLock::new(false),
        };

        Ok(kernel)
    }

    /// Start the microkernel
    pub async fn start(&self) -> KernelResult<()> {
        let mut running = self.running.write().await;
        if *running {
            return Err(KernelError::generic_error("Kernel is already running"));
        }

        info!("Starting Sira Microkernel...");

        // Start message bus
        self.message_bus.start().await?;

        // Start service registry background tasks
        self.start_service_monitoring().await;

        // Start resource monitoring if enabled
        if self.config.enable_resource_monitoring {
            self.start_resource_monitoring().await;
        }

        // Auto-discover and load plugins if enabled
        if self.config.auto_discover_plugins {
            self.discover_and_load_plugins().await?;
        }

        *running = true;
        info!("Sira Microkernel started successfully");
        Ok(())
    }

    /// Stop the microkernel
    pub async fn stop(&self) -> KernelResult<()> {
        let mut running = self.running.write().await;
        if !*running {
            warn!("Kernel is not running");
            return Ok(());
        }

        info!("Stopping Sira Microkernel...");

        // Stop plugins
        self.stop_all_plugins().await;

        // Stop services
        self.stop_all_services().await;

        // Stop message bus
        self.message_bus.stop().await?;

        *running = false;
        info!("Sira Microkernel stopped successfully");
        Ok(())
    }

    /// Get plugin manager
    pub fn plugin_manager(&self) -> Arc<PluginManager> {
        self.plugin_manager.clone()
    }

    /// Get service registry
    pub fn service_registry(&self) -> Arc<ServiceRegistry> {
        self.service_registry.clone()
    }

    /// Get message bus
    pub fn message_bus(&self) -> Arc<MessageBus> {
        self.message_bus.clone()
    }

    /// Get resource manager
    pub fn resource_manager(&self) -> Arc<ResourceManager> {
        self.resource_manager.clone()
    }

    /// Get kernel state
    pub fn kernel_state(&self) -> Arc<RwLock<KernelState>> {
        self.kernel_state.clone()
    }

    /// Get kernel configuration
    pub fn config(&self) -> &KernelConfig {
        &self.config
    }

    /// Check if kernel is running
    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    /// Get kernel health status
    pub async fn health(&self) -> KernelResult<KernelHealth> {
        let running = self.is_running().await;

        if !running {
            return Ok(KernelHealth {
                status: HealthStatus::Down,
                components: HashMap::new(),
                message: Some("Kernel is not running".to_string()),
            });
        }

        let mut components = HashMap::new();

        // Check message bus
        components.insert(
            "message_bus".to_string(),
            ComponentHealth {
                status: HealthStatus::Healthy,
                message: None,
            },
        );

        // Check resource manager
        let resource_usage = self.resource_manager.get_all_resource_usage().await;
        let resource_status = if resource_usage.iter().any(|u| u.usage_percentage > 95.0) {
            HealthStatus::Warning
        } else {
            HealthStatus::Healthy
        };
        components.insert(
            "resource_manager".to_string(),
            ComponentHealth {
                status: resource_status,
                message: None,
            },
        );

        // Check service registry
        let services = self.service_registry.list_services().await;
        let service_status = if services.is_empty() {
            HealthStatus::Warning
        } else {
            HealthStatus::Healthy
        };
        components.insert(
            "service_registry".to_string(),
            ComponentHealth {
                status: service_status,
                message: Some(format!("{} services registered", services.len())),
            },
        );

        // Check plugin manager
        let plugins = self.plugin_manager.list_plugins().await;
        let plugin_status = if plugins.is_empty() {
            HealthStatus::Warning
        } else {
            HealthStatus::Healthy
        };
        components.insert(
            "plugin_manager".to_string(),
            ComponentHealth {
                status: plugin_status,
                message: Some(format!("{} plugins loaded", plugins.len())),
            },
        );

        // Overall status
        let overall_status = if components.values().all(|c| c.status == HealthStatus::Healthy) {
            HealthStatus::Healthy
        } else if components.values().any(|c| c.status == HealthStatus::Critical) {
            HealthStatus::Critical
        } else {
            HealthStatus::Warning
        };

        Ok(KernelHealth {
            status: overall_status,
            components,
            message: None,
        })
    }

    /// Get kernel metrics
    pub async fn metrics(&self) -> KernelResult<HashMap<String, serde_json::Value>> {
        let mut metrics = HashMap::new();

        // Message bus stats
        let message_stats = self.message_bus.get_stats().await;
        metrics.extend(message_stats.into_iter().map(|(k, v)| (format!("message_bus.{}", k), v)));

        // Resource usage
        let resource_usage = self.resource_manager.get_all_resource_usage().await;
        for usage in resource_usage {
            let resource_name = format!("resource.{:?}", usage.resource_type).to_lowercase();
            metrics.insert(format!("{}.total", resource_name), serde_json::json!(usage.total));
            metrics.insert(format!("{}.used", resource_name), serde_json::json!(usage.used));
            metrics.insert(format!("{}.usage_percentage", resource_name), serde_json::json!(usage.usage_percentage));
        }

        // Service counts
        let services = self.service_registry.list_services().await;
        metrics.insert("services.total".to_string(), serde_json::json!(services.len()));
        let healthy_services = services.iter().filter(|s| s.status == crate::service::ServiceStatus::Healthy).count();
        metrics.insert("services.healthy".to_string(), serde_json::json!(healthy_services));

        // Plugin counts
        let plugins = self.plugin_manager.list_plugins().await;
        metrics.insert("plugins.total".to_string(), serde_json::json!(plugins.len()));

        // Kernel state
        let kernel_state = self.kernel_state.read().await;
        metrics.insert("kernel.uptime_seconds".to_string(), serde_json::json!(kernel_state.metrics.get("uptime_seconds").unwrap_or(&serde_json::json!(0))));

        Ok(metrics)
    }

    /// Discover and load plugins
    async fn discover_and_load_plugins(&self) -> KernelResult<()> {
        info!("Discovering and loading plugins...");

        let loaded_plugins = self.plugin_manager.discover_plugins().await?;
        info!("Loaded {} plugins", loaded_plugins.len());

        // Initialize and start plugins
        for plugin_id in loaded_plugins {
            if let Err(e) = self.plugin_manager.initialize_plugin(&plugin_id).await {
                error!("Failed to initialize plugin '{}': {}", plugin_id, e);
                continue;
            }

            if let Err(e) = self.plugin_manager.start_plugin(&plugin_id).await {
                error!("Failed to start plugin '{}': {}", plugin_id, e);
                continue;
            }

            info!("Plugin '{}' started successfully", plugin_id);
        }

        Ok(())
    }

    /// Stop all plugins
    async fn stop_all_plugins(&self) {
        let plugins = self.plugin_manager.list_plugins().await;

        for plugin in plugins {
            if let Err(e) = self.plugin_manager.stop_plugin(&plugin.id).await {
                error!("Failed to stop plugin '{}': {}", plugin.id, e);
            }
        }
    }

    /// Stop all services
    async fn stop_all_services(&self) {
        // Implementation depends on how services are tracked
        // For now, this is a placeholder
    }

    /// Start service monitoring background task
    async fn start_service_monitoring(&self) {
        let service_registry = self.service_registry.clone();
        let heartbeat_interval = self.config.heartbeat_interval;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(heartbeat_interval));

            loop {
                interval.tick().await;

                // Check for expired services
                match service_registry.check_expired_services().await {
                    Ok(expired) => {
                        if !expired.is_empty() {
                            warn!("Found {} expired services: {:?}", expired.len(), expired);
                        }
                    }
                    Err(e) => {
                        error!("Error checking expired services: {}", e);
                    }
                }
            }
        });
    }

    /// Start resource monitoring background task
    async fn start_resource_monitoring(&self) {
        let resource_manager = self.resource_manager.clone();

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(60)); // Every minute

            loop {
                interval.tick().await;

        // Log resource usage
        let usage = resource_manager.get_all_resource_usage().await;
        for u in usage {
            if u.usage_percentage > 80.0 {
                warn!(
                    "High resource usage: {:?} at {:.1}% ({}/{})",
                    u.resource_type, u.usage_percentage, u.used, u.total
                );
            }
        }
            }
        });
    }
}

use std::collections::HashMap;

/// Kernel health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KernelHealth {
    /// Overall health status
    pub status: HealthStatus,
    /// Component health statuses
    pub components: HashMap<String, ComponentHealth>,
    /// Optional status message
    pub message: Option<String>,
}

/// Component health status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentHealth {
    /// Component status
    pub status: HealthStatus,
    /// Optional status message
    pub message: Option<String>,
}

/// Health status levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum HealthStatus {
    /// Component is healthy
    Healthy,
    /// Component has warnings
    Warning,
    /// Component is unhealthy but functional
    Unhealthy,
    /// Component is critical
    Critical,
    /// Component is down
    Down,
}

/// Helper macro for creating a kernel instance
#[macro_export]
macro_rules! create_kernel {
    () => {
        $crate::init().await
    };
    ($config:expr) => {
        $crate::init_with_config($config).await
    };
}

/// Helper macro for starting kernel services
#[macro_export]
macro_rules! start_kernel_services {
    ($kernel:expr) => {
        $kernel.start().await?;
    };
}
