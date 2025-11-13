//! Plugin system for the Sira microkernel
//!
//! This module defines the plugin interface and plugin management system.
//! Plugins are dynamically loaded libraries that extend the kernel's functionality.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::error::{KernelError, KernelResult};
use crate::service::{Service, ServiceMetadata};
use crate::message::{MessageBus, Message};
use crate::resource::{ResourceManager, ResourceRequest};

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    /// Unique plugin identifier
    pub id: String,
    /// Human-readable plugin name
    pub name: String,
    /// Plugin version
    pub version: String,
    /// Plugin description
    pub description: String,
    /// Plugin author
    pub author: String,
    /// Plugin license
    pub license: Option<String>,
    /// Dependencies on other plugins
    pub dependencies: Vec<String>,
    /// Services provided by this plugin
    pub services: Vec<String>,
    /// Resources required by this plugin
    pub required_resources: Vec<String>,
    /// Plugin capabilities
    pub capabilities: Vec<String>,
    /// Configuration schema
    pub config_schema: Option<serde_json::Value>,
}

/// Plugin lifecycle states
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PluginState {
    /// Plugin is unloaded
    Unloaded,
    /// Plugin is being loaded
    Loading,
    /// Plugin is loaded but not initialized
    Loaded,
    /// Plugin is initializing
    Initializing,
    /// Plugin is running
    Running,
    /// Plugin is stopping
    Stopping,
    /// Plugin has stopped
    Stopped,
    /// Plugin encountered an error
    Error,
}

/// Context provided to plugins during execution
#[derive(Clone)]
pub struct PluginContext {
    /// Plugin metadata
    pub metadata: PluginMetadata,
    /// Message bus for communication
    pub message_bus: Arc<MessageBus>,
    /// Resource manager
    pub resource_manager: Arc<ResourceManager>,
    /// Plugin-specific configuration
    pub config: serde_json::Value,
    /// Shared kernel state
    pub kernel_state: Arc<RwLock<KernelState>>,
}

/// Shared kernel state accessible to plugins
#[derive(Debug, Default)]
pub struct KernelState {
    /// Global configuration
    pub config: HashMap<String, serde_json::Value>,
    /// Runtime metrics
    pub metrics: HashMap<String, serde_json::Value>,
    /// Active services
    pub services: HashMap<String, ServiceMetadata>,
}

/// Core plugin trait that all plugins must implement
#[async_trait]
pub trait Plugin: Send + Sync {
    /// Get plugin metadata
    fn metadata(&self) -> PluginMetadata;

    /// Initialize the plugin
    async fn initialize(&mut self, context: &PluginContext) -> KernelResult<()>;

    /// Start the plugin
    async fn start(&mut self, context: &PluginContext) -> KernelResult<()>;

    /// Stop the plugin
    async fn stop(&mut self, context: &PluginContext) -> KernelResult<()>;

    /// Handle a message from the message bus
    async fn handle_message(
        &mut self,
        message: &Message,
        context: &PluginContext,
    ) -> KernelResult<Option<Message>> {
        // Default implementation: ignore messages
        Ok(None)
    }

    /// Get plugin health status
    async fn health_check(&self) -> KernelResult<PluginHealth> {
        Ok(PluginHealth::Healthy)
    }

    /// Get plugin metrics
    async fn metrics(&self) -> KernelResult<HashMap<String, serde_json::Value>> {
        Ok(HashMap::new())
    }

    /// Cleanup plugin resources
    async fn cleanup(&mut self) -> KernelResult<()> {
        Ok(())
    }
}

/// Plugin health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PluginHealth {
    /// Plugin is healthy
    Healthy,
    /// Plugin is degraded but functional
    Degraded,
    /// Plugin is unhealthy
    Unhealthy,
    /// Plugin is dead
    Dead,
}

/// Loaded plugin instance
pub struct LoadedPlugin {
    /// Plugin metadata
    pub metadata: PluginMetadata,
    /// Plugin instance
    pub instance: Box<dyn Plugin>,
    /// Plugin state
    pub state: PluginState,
    /// Plugin context
    pub context: PluginContext,
    /// Loaded library (if dynamically loaded)
    pub library: Option<libloading::Library>,
    /// Allocated resources
    pub allocated_resources: Vec<String>,
    /// Registered services
    pub registered_services: Vec<String>,
}

/// Plugin manager for loading and managing plugins
pub struct PluginManager {
    /// Loaded plugins
    plugins: RwLock<HashMap<String, LoadedPlugin>>,
    /// Plugin directories to search
    plugin_dirs: Vec<std::path::PathBuf>,
    /// Message bus
    message_bus: Arc<MessageBus>,
    /// Resource manager
    resource_manager: Arc<ResourceManager>,
    /// Kernel state
    kernel_state: Arc<RwLock<KernelState>>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new(
        message_bus: Arc<MessageBus>,
        resource_manager: Arc<ResourceManager>,
        kernel_state: Arc<RwLock<KernelState>>,
    ) -> Self {
        PluginManager {
            plugins: RwLock::new(HashMap::new()),
            plugin_dirs: vec![
                "./plugins".into(),
                "./layers/rust/plugins".into(),
                "./layers/python/plugins".into(),
                "./layers/go/plugins".into(),
            ],
            message_bus,
            resource_manager,
            kernel_state,
        }
    }

    /// Add a plugin search directory
    pub fn add_plugin_dir<P: Into<std::path::PathBuf>>(&mut self, dir: P) {
        self.plugin_dirs.push(dir.into());
    }

    /// Load a plugin from a file path
    pub async fn load_plugin<P: AsRef<std::path::Path>>(
        &self,
        path: P,
    ) -> KernelResult<String> {
        let path = path.as_ref();

        // Check if plugin is already loaded
        let plugin_id = path.file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| KernelError::plugin_load_error(
                path.display().to_string(),
                "Invalid plugin filename"
            ))?
            .to_string();

        if self.plugins.read().await.contains_key(&plugin_id) {
            return Err(KernelError::plugin_error(
                plugin_id,
                "Plugin already loaded".to_string()
            ));
        }

        // Load the dynamic library
        let library = unsafe {
            libloading::Library::new(path)
        }.map_err(|e| KernelError::plugin_load_error_with_source(
            path.display().to_string(),
            "Failed to load library",
            Box::new(e),
        ))?;

        // Get the plugin constructor function
        let constructor: libloading::Symbol<fn() -> Box<dyn Plugin>> = unsafe {
            library.get(b"_plugin_create")
        }.map_err(|e| KernelError::plugin_load_error_with_source(
            path.display().to_string(),
            "Plugin constructor not found",
            Box::new(e),
        ))?;

        // Create plugin instance
        let instance = constructor();

        // Get plugin metadata
        let metadata = instance.metadata();

        // Validate plugin ID matches filename
        if metadata.id != plugin_id {
            return Err(KernelError::plugin_load_error(
                path.display().to_string(),
                format!("Plugin ID '{}' does not match filename", metadata.id)
            ));
        }

        // Create plugin context
        let context = PluginContext {
            metadata: metadata.clone(),
            message_bus: self.message_bus.clone(),
            resource_manager: self.resource_manager.clone(),
            config: serde_json::Value::Object(serde_json::Map::new()),
            kernel_state: self.kernel_state.clone(),
        };

        // Create loaded plugin
        let loaded_plugin = LoadedPlugin {
            metadata,
            instance,
            state: PluginState::Loaded,
            context,
            library: Some(library),
            allocated_resources: Vec::new(),
            registered_services: Vec::new(),
        };

        // Store the plugin
        self.plugins.write().await.insert(plugin_id.clone(), loaded_plugin);

        tracing::info!("Plugin '{}' loaded successfully", plugin_id);
        Ok(plugin_id)
    }

    /// Unload a plugin
    pub async fn unload_plugin(&self, plugin_id: &str) -> KernelResult<()> {
        let mut plugins = self.plugins.write().await;

        if let Some(mut plugin) = plugins.remove(plugin_id) {
            // Stop the plugin if it's running
            if plugin.state == PluginState::Running {
                plugin.instance.stop(&plugin.context).await?;
            }

            // Cleanup plugin resources
            plugin.instance.cleanup().await?;

            // Release allocated resources
            for resource_id in &plugin.allocated_resources {
                if let Err(e) = self.resource_manager.release_resources(resource_id).await {
                    tracing::warn!("Failed to release resource '{}' for plugin '{}': {}", resource_id, plugin_id, e);
                }
            }

            tracing::info!("Plugin '{}' unloaded successfully", plugin_id);
            Ok(())
        } else {
            Err(KernelError::plugin_error(plugin_id.to_string(), "Plugin not found".to_string()))
        }
    }

    /// Initialize a loaded plugin
    pub async fn initialize_plugin(&self, plugin_id: &str) -> KernelResult<()> {
        let mut plugins = self.plugins.write().await;

        if let Some(plugin) = plugins.get_mut(plugin_id) {
            if plugin.state != PluginState::Loaded {
                return Err(KernelError::plugin_error(
                    plugin_id.to_string(),
                    format!("Plugin is not in Loaded state: {:?}", plugin.state)
                ));
            }

            plugin.state = PluginState::Initializing;
            plugin.instance.initialize(&plugin.context).await?;
            plugin.state = PluginState::Stopped; // Ready to start

            tracing::info!("Plugin '{}' initialized successfully", plugin_id);
            Ok(())
        } else {
            Err(KernelError::plugin_error(plugin_id.to_string(), "Plugin not found".to_string()))
        }
    }

    /// Start a plugin
    pub async fn start_plugin(&self, plugin_id: &str) -> KernelResult<()> {
        let mut plugins = self.plugins.write().await;

        if let Some(plugin) = plugins.get_mut(plugin_id) {
            if plugin.state != PluginState::Stopped {
                return Err(KernelError::plugin_error(
                    plugin_id.to_string(),
                    format!("Plugin is not in Stopped state: {:?}", plugin.state)
                ));
            }

            plugin.state = PluginState::Running;
            plugin.instance.start(&plugin.context).await?;

            tracing::info!("Plugin '{}' started successfully", plugin_id);
            Ok(())
        } else {
            Err(KernelError::plugin_error(plugin_id.to_string(), "Plugin not found".to_string()))
        }
    }

    /// Stop a plugin
    pub async fn stop_plugin(&self, plugin_id: &str) -> KernelResult<()> {
        let mut plugins = self.plugins.write().await;

        if let Some(plugin) = plugins.get_mut(plugin_id) {
            if plugin.state != PluginState::Running {
                return Err(KernelError::plugin_error(
                    plugin_id.to_string(),
                    format!("Plugin is not in Running state: {:?}", plugin.state)
                ));
            }

            plugin.state = PluginState::Stopping;
            plugin.instance.stop(&plugin.context).await?;
            plugin.state = PluginState::Stopped;

            tracing::info!("Plugin '{}' stopped successfully", plugin_id);
            Ok(())
        } else {
            Err(KernelError::plugin_error(plugin_id.to_string(), "Plugin not found".to_string()))
        }
    }

    /// Get plugin metadata
    pub async fn get_plugin_metadata(&self, plugin_id: &str) -> KernelResult<PluginMetadata> {
        let plugins = self.plugins.read().await;

        if let Some(plugin) = plugins.get(plugin_id) {
            Ok(plugin.metadata.clone())
        } else {
            Err(KernelError::plugin_error(plugin_id.to_string(), "Plugin not found".to_string()))
        }
    }

    /// List all loaded plugins
    pub async fn list_plugins(&self) -> Vec<PluginMetadata> {
        let plugins = self.plugins.read().await;
        plugins.values().map(|p| p.metadata.clone()).collect()
    }

    /// Get plugin health status
    pub async fn get_plugin_health(&self, plugin_id: &str) -> KernelResult<PluginHealth> {
        let plugins = self.plugins.read().await;

        if let Some(plugin) = plugins.get(plugin_id) {
            plugin.instance.health_check().await
        } else {
            Err(KernelError::plugin_error(plugin_id.to_string(), "Plugin not found".to_string()))
        }
    }

    /// Discover and load plugins from plugin directories
    pub async fn discover_plugins(&self) -> KernelResult<Vec<String>> {
        let mut loaded_plugins = Vec::new();

        for dir in &self.plugin_dirs {
            if !dir.exists() {
                continue;
            }

            let entries = std::fs::read_dir(dir)
                .map_err(|e| KernelError::generic_error(
                    format!("Failed to read plugin directory '{}': {}", dir.display(), e)
                ))?;

            for entry in entries {
                let entry = entry.map_err(|e| KernelError::generic_error(
                    format!("Failed to read directory entry: {}", e)
                ))?;

                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("so") ||
                   path.extension().and_then(|s| s.to_str()) == Some("dll") ||
                   path.extension().and_then(|s| s.to_str()) == Some("dylib") {

                    match self.load_plugin(&path).await {
                        Ok(plugin_id) => {
                            loaded_plugins.push(plugin_id);
                        }
                        Err(e) => {
                            tracing::warn!("Failed to load plugin '{}': {}", path.display(), e);
                        }
                    }
                }
            }
        }

        Ok(loaded_plugins)
    }
}

/// Helper macro for creating plugin constructors
#[macro_export]
macro_rules! declare_plugin {
    ($plugin_type:ty, $constructor:expr) => {
        #[no_mangle]
        pub extern "C" fn _plugin_create() -> Box<dyn $crate::plugin::Plugin> {
            Box::new($constructor)
        }
    };
}

/// Helper macro for implementing the Plugin trait
#[macro_export]
macro_rules! plugin_metadata {
    ($id:expr, $name:expr, $version:expr, $description:expr, $author:expr) => {
        fn metadata(&self) -> $crate::plugin::PluginMetadata {
            $crate::plugin::PluginMetadata {
                id: $id.to_string(),
                name: $name.to_string(),
                version: $version.to_string(),
                description: $description.to_string(),
                author: $author.to_string(),
                license: Some("Apache-2.0".to_string()),
                dependencies: vec![],
                services: vec![],
                required_resources: vec![],
                capabilities: vec![],
                config_schema: None,
            }
        }
    };
}
