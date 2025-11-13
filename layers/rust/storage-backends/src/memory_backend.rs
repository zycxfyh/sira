//! Memory Storage Backend - In-memory key-value storage

use crate::{StorageResult, StorageConfig, StorageBackend, StorageBackendType, StorageOperation};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use tracing::{debug, info};

/// In-memory storage backend
pub struct MemoryBackend {
    config: StorageConfig,
    data: Arc<RwLock<HashMap<String, crate::StorageEntry>>>,
}

impl MemoryBackend {
    /// Create a new memory backend
    pub fn new(config: StorageConfig) -> Self {
        Self {
            config,
            data: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

#[async_trait]
impl StorageBackend for MemoryBackend {
    async fn init(&self) -> StorageResult<()> {
        info!("Initializing memory storage backend");
        Ok(())
    }

    async fn shutdown(&self) -> StorageResult<()> {
        info!("Shutting down memory storage backend");
        Ok(())
    }

    fn backend_type(&self) -> StorageBackendType {
        StorageBackendType::Memory
    }

    fn config(&self) -> &StorageConfig {
        &self.config
    }

    async fn execute_operation(&self, operation: StorageOperation, params: &HashMap<String, serde_json::Value>) -> StorageResult<serde_json::Value> {
        let now = Utc::now();

        match operation {
            StorageOperation::Get => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let data = self.data.read().await;
                if let Some(entry) = data.get(key) {
                    // Check TTL
                    if let Some(ttl) = entry.ttl_seconds {
                        if entry.created_at + Duration::seconds(ttl as i64) <= now {
                            return Err(crate::StorageError::KeyNotFound(key.to_string()));
                        }
                    }
                    serde_json::to_value(entry).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                } else {
                    Err(crate::StorageError::KeyNotFound(key.to_string()))
                }
            }

            StorageOperation::Set => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;
                let value = params.get("value")
                    .ok_or_else(|| crate::StorageError::OperationError("Missing value parameter".to_string()))?;
                let ttl_seconds = params.get("ttl_seconds").and_then(|v| v.as_u64());

                let mut data = self.data.write().await;

                let entry = crate::StorageEntry {
                    key: key.to_string(),
                    value: value.clone(),
                    ttl_seconds,
                    created_at: now,
                    updated_at: now,
                    version: 1,
                    metadata: HashMap::new(),
                };

                data.insert(key.to_string(), entry);
                debug!("Set key: {} in memory backend", key);

                serde_json::to_value(true).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::Delete => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let mut data = self.data.write().await;
                let removed = data.remove(key).is_some();

                if removed {
                    debug!("Deleted key: {} from memory backend", key);
                }

                serde_json::to_value(removed).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::Exists => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let data = self.data.read().await;
                let exists = data.contains_key(key);

                serde_json::to_value(exists).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::List => {
                let pattern = params.get("pattern").and_then(|v| v.as_str());
                let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(u64::MAX) as usize;

                let data = self.data.read().await;
                let mut keys: Vec<String> = data.keys()
                    .filter(|key| {
                        if let Some(pat) = pattern {
                            key.contains(pat)
                        } else {
                            true
                        }
                    })
                    .take(limit)
                    .cloned()
                    .collect();

                keys.sort();

                serde_json::to_value(keys).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::Count => {
                let pattern = params.get("pattern").and_then(|v| v.as_str());

                let data = self.data.read().await;
                let count = if let Some(pat) = pattern {
                    data.keys().filter(|key| key.contains(pat)).count()
                } else {
                    data.len()
                };

                serde_json::to_value(count).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::TTL => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let data = self.data.read().await;
                if let Some(entry) = data.get(key) {
                    if let Some(ttl) = entry.ttl_seconds {
                        let expires_at = entry.created_at + Duration::seconds(ttl as i64);
                        let remaining = (expires_at - now).num_seconds().max(0) as u64;
                        serde_json::to_value(Some(remaining)).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                    } else {
                        serde_json::to_value(None::<u64>).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                    }
                } else {
                    Err(crate::StorageError::KeyNotFound(key.to_string()))
                }
            }

            StorageOperation::Expire => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;
                let ttl_seconds = params.get("ttl_seconds")
                    .and_then(|v| v.as_u64())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing ttl_seconds parameter".to_string()))?;

                let mut data = self.data.write().await;
                if let Some(entry) = data.get_mut(key) {
                    entry.ttl_seconds = Some(ttl_seconds);
                    entry.updated_at = now;
                    debug!("Set TTL for key: {} to {} seconds", key, ttl_seconds);
                    serde_json::to_value(true).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                } else {
                    serde_json::to_value(false).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                }
            }

            StorageOperation::Persist => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let mut data = self.data.write().await;
                if let Some(entry) = data.get_mut(key) {
                    entry.ttl_seconds = None;
                    entry.updated_at = now;
                    debug!("Removed TTL for key: {}", key);
                    serde_json::to_value(true).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                } else {
                    serde_json::to_value(false).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
                }
            }

            _ => {
                Err(crate::StorageError::OperationError(format!("Unsupported operation: {:?}", operation)))
            }
        }
    }
}

/// Memory backend factory
pub struct MemoryBackendFactory;

#[async_trait]
impl crate::StorageBackendFactory for MemoryBackendFactory {
    fn backend_type(&self) -> StorageBackendType {
        StorageBackendType::Memory
    }

    async fn create_backend(&self, config: StorageConfig) -> StorageResult<Box<dyn StorageBackend>> {
        let backend = MemoryBackend::new(config);
        Ok(Box::new(backend))
    }

    fn config_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "max_memory_mb": {
                    "type": "integer",
                    "description": "Maximum memory usage in MB",
                    "default": 100
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_config() -> StorageConfig {
        StorageConfig {
            backend_type: StorageBackendType::Memory,
            connection_string: "memory://".to_string(),
            pool_size: None,
            timeout_seconds: None,
            retry_attempts: None,
            enable_compression: false,
            enable_encryption: false,
            max_connections: None,
            max_key_size_bytes: None,
            max_value_size_bytes: None,
            default_ttl_seconds: None,
            namespace: None,
        }
    }

    #[tokio::test]
    async fn test_memory_backend_basic_operations() {
        let config = create_test_config();
        let backend = MemoryBackend::new(config);

        // Test set and get
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!("test_key"));
        params.insert("value".to_string(), serde_json::json!("test_value"));

        let result = backend.execute_operation(StorageOperation::Set, &params).await.unwrap();
        assert_eq!(result, serde_json::json!(true));

        let mut get_params = HashMap::new();
        get_params.insert("key".to_string(), serde_json::json!("test_key"));

        let get_result = backend.execute_operation(StorageOperation::Get, &get_params).await.unwrap();
        let entry: crate::StorageEntry = serde_json::from_value(get_result).unwrap();
        assert_eq!(entry.key, "test_key");
        assert_eq!(entry.value, serde_json::json!("test_value"));

        // Test exists
        let exists_result = backend.execute_operation(StorageOperation::Exists, &get_params).await.unwrap();
        assert_eq!(exists_result, serde_json::json!(true));

        // Test delete
        let delete_result = backend.execute_operation(StorageOperation::Delete, &get_params).await.unwrap();
        assert_eq!(delete_result, serde_json::json!(true));

        // Test exists after delete
        let exists_after_delete = backend.execute_operation(StorageOperation::Exists, &get_params).await.unwrap();
        assert_eq!(exists_after_delete, serde_json::json!(false));
    }
}
