//! Tool Registry for Sira Tools

use crate::{ToolsResult, ToolsError, ToolMetadata, ToolMarketplaceEntry};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{info, debug};

/// Tool registry for managing available tools
pub struct ToolRegistry {
    tools: HashMap<String, ToolMetadata>,
    categories: HashMap<String, Vec<String>>, // category -> tool_ids
}

impl ToolRegistry {
    /// Create a new tool registry
    pub fn new() -> Self {
        Self {
            tools: HashMap::new(),
            categories: HashMap::new(),
        }
    }

    /// Register a tool in the registry
    pub fn register_tool(&mut self, metadata: ToolMetadata) -> ToolsResult<()> {
        let tool_id = metadata.id.clone();

        if self.tools.contains_key(&tool_id) {
            return Err(ToolsError::Configuration(format!("Tool '{}' already registered", tool_id)));
        }

        // Add to categories
        for tag in &metadata.tags {
            self.categories.entry(tag.clone()).or_insert_with(Vec::new).push(tool_id.clone());
        }

        self.tools.insert(tool_id.clone(), metadata);
        info!("Registered tool: {}", tool_id);

        Ok(())
    }

    /// Unregister a tool
    pub fn unregister_tool(&mut self, tool_id: &str) -> ToolsResult<ToolMetadata> {
        let metadata = self.tools.remove(tool_id)
            .ok_or_else(|| ToolsError::ToolNotFound(format!("Tool '{}' not found", tool_id)))?;

        // Remove from categories
        for tag in &metadata.tags {
            if let Some(tools) = self.categories.get_mut(tag) {
                tools.retain(|id| id != tool_id);
                if tools.is_empty() {
                    self.categories.remove(tag);
                }
            }
        }

        info!("Unregistered tool: {}", tool_id);
        Ok(metadata)
    }

    /// Get tool metadata
    pub fn get_tool(&self, tool_id: &str) -> Option<&ToolMetadata> {
        self.tools.get(tool_id)
    }

    /// List all registered tools
    pub fn list_tools(&self) -> Vec<&ToolMetadata> {
        self.tools.values().collect()
    }

    /// Search tools by query
    pub fn search_tools(&self, query: &str) -> Vec<&ToolMetadata> {
        let query_lower = query.to_lowercase();

        self.tools.values()
            .filter(|metadata| {
                metadata.name.to_lowercase().contains(&query_lower) ||
                metadata.description.to_lowercase().contains(&query_lower) ||
                metadata.tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
            })
            .collect()
    }

    /// Get tools by category/tag
    pub fn get_tools_by_category(&self, category: &str) -> Vec<&ToolMetadata> {
        self.categories.get(category)
            .map(|tool_ids| {
                tool_ids.iter()
                    .filter_map(|id| self.tools.get(id))
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Get all categories
    pub fn get_categories(&self) -> Vec<String> {
        self.categories.keys().cloned().collect()
    }

    /// Get tool statistics
    pub fn get_stats(&self) -> HashMap<String, usize> {
        let mut stats = HashMap::new();
        stats.insert("total_tools".to_string(), self.tools.len());
        stats.insert("total_categories".to_string(), self.categories.len());

        let total_tags: usize = self.categories.values().map(|v| v.len()).sum();
        stats.insert("total_tags".to_string(), total_tags);

        stats
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Tool marketplace client
#[async_trait]
pub trait MarketplaceClient: Send + Sync {
    /// Search tools in marketplace
    async fn search_tools(&self, query: &str) -> ToolsResult<Vec<ToolMarketplaceEntry>>;

    /// Get tool details
    async fn get_tool_details(&self, tool_id: &str) -> ToolsResult<ToolMarketplaceEntry>;

    /// Download tool
    async fn download_tool(&self, tool_id: &str, version: &str) -> ToolsResult<Vec<u8>>;

    /// Get featured tools
    async fn get_featured_tools(&self) -> ToolsResult<Vec<ToolMarketplaceEntry>>;
}

/// Local marketplace client implementation
pub struct LocalMarketplaceClient {
    registry: ToolRegistry,
}

impl LocalMarketplaceClient {
    pub fn new(registry: ToolRegistry) -> Self {
        Self { registry }
    }
}

#[async_trait]
impl MarketplaceClient for LocalMarketplaceClient {
    async fn search_tools(&self, query: &str) -> ToolsResult<Vec<ToolMarketplaceEntry>> {
        let tools = self.registry.search_tools(query);

        let entries = tools.into_iter().map(|metadata| ToolMarketplaceEntry {
            tool_id: metadata.id.clone(),
            metadata: metadata.clone(),
            rating: 4.5, // Default rating
            download_count: 100, // Default count
            tags: metadata.tags.clone(),
            publisher: metadata.author.clone(),
            verified: true,
            price_per_execution: None,
        }).collect();

        Ok(entries)
    }

    async fn get_tool_details(&self, tool_id: &str) -> ToolsResult<ToolMarketplaceEntry> {
        let metadata = self.registry.get_tool(tool_id)
            .ok_or_else(|| ToolsError::ToolNotFound(format!("Tool '{}' not found", tool_id)))?;

        Ok(ToolMarketplaceEntry {
            tool_id: metadata.id.clone(),
            metadata: metadata.clone(),
            rating: 4.5,
            download_count: 100,
            tags: metadata.tags.clone(),
            publisher: metadata.author.clone(),
            verified: true,
            price_per_execution: None,
        })
    }

    async fn download_tool(&self, tool_id: &str, _version: &str) -> ToolsResult<Vec<u8>> {
        // In a real implementation, this would download the tool binary/code
        // For now, return dummy data
        debug!("Downloading tool: {}", tool_id);
        Ok(vec![1, 2, 3, 4, 5]) // Dummy data
    }

    async fn get_featured_tools(&self) -> ToolsResult<Vec<ToolMarketplaceEntry>> {
        let all_tools = self.registry.list_tools();
        let featured = all_tools.into_iter().take(5).map(|metadata| ToolMarketplaceEntry {
            tool_id: metadata.id.clone(),
            metadata: metadata.clone(),
            rating: 4.8,
            download_count: 1000,
            tags: metadata.tags.clone(),
            publisher: metadata.author.clone(),
            verified: true,
            price_per_execution: None,
        }).collect();

        Ok(featured)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_metadata() -> ToolMetadata {
        ToolMetadata {
            id: "test_tool".to_string(),
            name: "Test Tool".to_string(),
            version: "1.0.0".to_string(),
            description: "A test tool".to_string(),
            author: "Test Author".to_string(),
            tags: vec!["test".to_string(), "utility".to_string()],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            capabilities: vec!["test".to_string()],
            dependencies: vec![],
            config_schema: serde_json::json!({}),
        }
    }

    #[test]
    fn test_tool_registry() {
        let mut registry = ToolRegistry::new();
        let metadata = create_test_metadata();

        // Register tool
        registry.register_tool(metadata.clone()).unwrap();
        assert_eq!(registry.list_tools().len(), 1);

        // Get tool
        let retrieved = registry.get_tool("test_tool").unwrap();
        assert_eq!(retrieved.id, "test_tool");

        // Search tools
        let search_results = registry.search_tools("test");
        assert_eq!(search_results.len(), 1);

        // Get by category
        let category_tools = registry.get_tools_by_category("test");
        assert_eq!(category_tools.len(), 1);

        // Unregister tool
        registry.unregister_tool("test_tool").unwrap();
        assert_eq!(registry.list_tools().len(), 0);
    }

    #[tokio::test]
    async fn test_marketplace_client() {
        let mut registry = ToolRegistry::new();
        registry.register_tool(create_test_metadata()).unwrap();

        let client = LocalMarketplaceClient::new(registry);

        // Search tools
        let results = client.search_tools("test").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].tool_id, "test_tool");

        // Get tool details
        let details = client.get_tool_details("test_tool").await.unwrap();
        assert_eq!(details.tool_id, "test_tool");

        // Download tool
        let data = client.download_tool("test_tool", "1.0.0").await.unwrap();
        assert!(!data.is_empty());
    }
}
