//! Tool Plugin System for Sira Tools

use crate::{ToolsResult, ToolsError, ToolContext, ToolInput, ToolOutput, ToolMetadata};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{debug, info};

/// Tool plugin trait
#[async_trait]
pub trait ToolPlugin: Send + Sync {
    /// Get tool metadata
    fn metadata(&self) -> &ToolMetadata;

    /// Validate input parameters
    async fn validate_input(&self, input: &ToolInput) -> ToolsResult<()> {
        // Default implementation - no validation
        Ok(())
    }

    /// Execute the tool
    async fn execute(&self, context: &ToolContext, input: ToolInput) -> ToolsResult<ToolOutput>;

    /// Clean up resources after execution
    async fn cleanup(&self, context: &ToolContext) -> ToolsResult<()> {
        // Default implementation - no cleanup needed
        Ok(())
    }

    /// Check if tool is healthy and available
    async fn health_check(&self) -> ToolsResult<bool> {
        Ok(true)
    }
}

/// Tool plugin factory trait
#[async_trait]
pub trait ToolPluginFactory: Send + Sync {
    /// Create a new instance of the tool plugin
    async fn create_plugin(&self, config: HashMap<String, serde_json::Value>) -> ToolsResult<Box<dyn ToolPlugin>>;

    /// Get the tool ID this factory creates
    fn tool_id(&self) -> &str;

    /// Get the supported tool metadata
    fn supported_tools(&self) -> Vec<ToolMetadata>;
}

/// Plugin manager for loading and managing tool plugins
pub struct PluginManager {
    plugins: HashMap<String, Box<dyn ToolPlugin>>,
    factories: HashMap<String, Box<dyn ToolPluginFactory>>,
}

impl PluginManager {
    /// Create a new plugin manager
    pub fn new() -> Self {
        Self {
            plugins: HashMap::new(),
            factories: HashMap::new(),
        }
    }

    /// Register a tool plugin factory
    pub async fn register_factory(&mut self, factory: Box<dyn ToolPluginFactory>) -> ToolsResult<()> {
        let tool_id = factory.tool_id().to_string();
        if self.factories.contains_key(&tool_id) {
            return Err(ToolsError::Configuration(format!("Factory for tool '{}' already registered", tool_id)));
        }

        self.factories.insert(tool_id.clone(), factory);
        info!("Registered tool factory: {}", tool_id);
        Ok(())
    }

    /// Create and register a plugin instance
    pub async fn create_plugin(&mut self, tool_id: &str, config: HashMap<String, serde_json::Value>) -> ToolsResult<()> {
        let factory = self.factories.get(tool_id)
            .ok_or_else(|| ToolsError::ToolNotFound(format!("Factory for tool '{}' not found", tool_id)))?;

        let plugin = factory.create_plugin(config).await?;
        let plugin_tool_id = plugin.metadata().id.clone();

        if self.plugins.contains_key(&plugin_tool_id) {
            return Err(ToolsError::Configuration(format!("Plugin '{}' already exists", plugin_tool_id)));
        }

        self.plugins.insert(plugin_tool_id.clone(), plugin);
        info!("Created and registered plugin: {}", plugin_tool_id);
        Ok(())
    }

    /// Get a plugin by ID
    pub fn get_plugin(&self, tool_id: &str) -> Option<&dyn ToolPlugin> {
        self.plugins.get(tool_id).map(|p| p.as_ref())
    }

    /// Get a mutable reference to a plugin by ID
    pub fn get_plugin_mut(&mut self, tool_id: &str) -> Option<&mut dyn ToolPlugin + '_> {
        self.plugins.get_mut(tool_id).map(|p| p.as_mut())
    }

    /// Remove a plugin
    pub fn remove_plugin(&mut self, tool_id: &str) -> ToolsResult<Box<dyn ToolPlugin>> {
        self.plugins.remove(tool_id)
            .ok_or_else(|| ToolsError::ToolNotFound(format!("Plugin '{}' not found", tool_id)))
    }

    /// List all registered plugins
    pub fn list_plugins(&self) -> Vec<&ToolMetadata> {
        self.plugins.values()
            .map(|p| p.metadata())
            .collect()
    }

    /// List available factories
    pub fn list_factories(&self) -> Vec<String> {
        self.factories.keys().cloned().collect()
    }

    /// Get supported tools from all factories
    pub fn get_supported_tools(&self) -> Vec<ToolMetadata> {
        self.factories.values()
            .flat_map(|f| f.supported_tools())
            .collect()
    }

    /// Check health of all plugins
    pub async fn health_check_all(&self) -> ToolsResult<HashMap<String, bool>> {
        let mut results = HashMap::new();

        for (tool_id, plugin) in &self.plugins {
            let healthy = plugin.health_check().await.unwrap_or(false);
            results.insert(tool_id.clone(), healthy);
        }

        Ok(results)
    }
}

impl Default for PluginManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Plugin loader for dynamic loading of plugins
pub struct PluginLoader {
    manager: PluginManager,
}

impl PluginLoader {
    /// Create a new plugin loader
    pub fn new() -> Self {
        Self {
            manager: PluginManager::new(),
        }
    }

    /// Load plugins from configuration
    pub async fn load_from_config(&mut self, config: &serde_json::Value) -> ToolsResult<()> {
        if let Some(plugins_config) = config.get("plugins").and_then(|v| v.as_array()) {
            for plugin_config in plugins_config {
                if let Some(tool_id) = plugin_config.get("tool_id").and_then(|v| v.as_str()) {
                    let config_map = plugin_config.get("config")
                        .and_then(|v| v.as_object())
                        .map(|obj| {
                            obj.iter()
                                .map(|(k, v)| (k.clone(), v.clone()))
                                .collect()
                        })
                        .unwrap_or_default();

                    self.manager.create_plugin(tool_id, config_map).await?;
                }
            }
        }

        Ok(())
    }

    /// Get access to the plugin manager
    pub fn manager(&self) -> &PluginManager {
        &self.manager
    }

    /// Get mutable access to the plugin manager
    pub fn manager_mut(&mut self) -> &mut PluginManager {
        &mut self.manager
    }
}

impl Default for PluginLoader {
    fn default() -> Self {
        Self::new()
    }
}

/// Example built-in tool plugin
pub struct EchoTool {
    metadata: ToolMetadata,
}

impl EchoTool {
    pub fn new() -> Self {
        Self {
            metadata: ToolMetadata {
                id: "echo".to_string(),
                name: "Echo Tool".to_string(),
                version: "1.0.0".to_string(),
                description: "A simple echo tool that returns input as output".to_string(),
                author: "Sira Team".to_string(),
                tags: vec!["utility".to_string(), "test".to_string()],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
                capabilities: vec!["echo".to_string()],
                dependencies: vec![],
                config_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "prefix": {
                            "type": "string",
                            "description": "Prefix to add to output"
                        }
                    }
                }),
            },
        }
    }
}

#[async_trait]
impl ToolPlugin for EchoTool {
    fn metadata(&self) -> &ToolMetadata {
        &self.metadata
    }

    async fn execute(&self, context: &ToolContext, input: ToolInput) -> ToolsResult<ToolOutput> {
        debug!("Executing echo tool for context: {}", context.tool_id);

        let message = input.parameters
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("Hello, World!")
            .to_string();

        let prefix = input.parameters
            .get("prefix")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let output_message = format!("{}{}", prefix, message);

        Ok(ToolOutput {
            success: true,
            exit_code: Some(0),
            stdout: Some(output_message),
            stderr: None,
            files: vec![],
            metadata: HashMap::new(),
            execution_time_ms: 1,
            resource_usage: crate::ResourceUsage {
                memory_mb_peak: 1,
                cpu_percent_avg: 0.1,
                execution_time_ms: 1,
                io_operations: 0,
            },
        })
    }
}

/// Factory for echo tool
pub struct EchoToolFactory;

#[async_trait]
impl ToolPluginFactory for EchoToolFactory {
    async fn create_plugin(&self, _config: HashMap<String, serde_json::Value>) -> ToolsResult<Box<dyn ToolPlugin>> {
        Ok(Box::new(EchoTool::new()))
    }

    fn tool_id(&self) -> &str {
        "echo"
    }

    fn supported_tools(&self) -> Vec<ToolMetadata> {
        vec![EchoTool::new().metadata().clone()]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_plugin_manager() {
        let mut manager = PluginManager::new();
        let factory = Box::new(EchoToolFactory);

        // Register factory
        manager.register_factory(factory).await.unwrap();
        assert!(manager.list_factories().contains(&"echo".to_string()));

        // Create plugin
        manager.create_plugin("echo", HashMap::new()).await.unwrap();
        assert!(manager.get_plugin("echo").is_some());

        // List plugins
        let plugins = manager.list_plugins();
        assert_eq!(plugins.len(), 1);
        assert_eq!(plugins[0].id, "echo");
    }

    #[tokio::test]
    async fn test_echo_tool_execution() {
        let tool = EchoTool::new();
        let context = ToolContext {
            tool_id: "echo".to_string(),
            session_id: "test_session".to_string(),
            user_id: "test_user".to_string(),
            execution_id: "test_execution".to_string(),
            parent_execution_id: None,
            start_time: chrono::Utc::now(),
            timeout_seconds: Some(30),
            resource_limits: Default::default(),
            environment: HashMap::new(),
        };

        let input = ToolInput {
            parameters: HashMap::from([
                ("message".to_string(), serde_json::json!("Hello, Test!")),
                ("prefix".to_string(), serde_json::json!("Prefix: ")),
            ]),
            files: vec![],
            stdin: None,
        };

        let output = tool.execute(&context, input).await.unwrap();

        assert!(output.success);
        assert_eq!(output.stdout, Some("Prefix: Hello, Test!".to_string()));
        assert_eq!(output.exit_code, Some(0));
    }
}
