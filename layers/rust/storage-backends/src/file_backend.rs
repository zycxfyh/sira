//! File Storage Backend - File system based key-value storage

use crate::{StorageResult, StorageConfig, StorageBackend, StorageBackendType, StorageOperation};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Read, Write};
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::{Utc, Duration};
use serde_json;
use tracing::{debug, info};

/// File system storage backend
pub struct FileBackend {
    config: StorageConfig,
    base_path: PathBuf,
    index: Arc<RwLock<HashMap<String, crate::StorageEntry>>>,
}

impl FileBackend {
    /// Create a new file backend
    pub fn new(config: StorageConfig) -> StorageResult<Self> {
        let base_path = PathBuf::from(&config.connection_string);

        // Create directory if it doesn't exist
        if !base_path.exists() {
            fs::create_dir_all(&base_path)?;
        }

        Ok(Self {
            config,
            base_path,
            index: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Get file path for a key
    fn get_file_path(&self, key: &str) -> PathBuf {
        // Create a safe filename from the key
        let safe_key = key.replace("/", "_").replace("\\", "_").replace(":", "_");
        self.base_path.join(format!("{}.json", safe_key))
    }

    /// Load entry from file
    fn load_entry_from_file(&self, key: &str) -> StorageResult<crate::StorageEntry> {
        let file_path = self.get_file_path(key);
        let mut file = fs::File::open(file_path)?;
        let mut contents = String::new();
        file.read_to_string(&mut contents)?;

        let entry: crate::StorageEntry = serde_json::from_str(&contents)?;
        Ok(entry)
    }

    /// Save entry to file
    fn save_entry_to_file(&self, entry: &crate::StorageEntry) -> StorageResult<()> {
        let file_path = self.get_file_path(&entry.key);
        let json = serde_json::to_string_pretty(entry)?;
        let mut file = fs::File::create(file_path)?;
        file.write_all(json.as_bytes())?;
        Ok(())
    }

    /// Delete entry file
    fn delete_entry_file(&self, key: &str) -> StorageResult<()> {
        let file_path = self.get_file_path(key);
        if file_path.exists() {
            fs::remove_file(file_path)?;
        }
        Ok(())
    }
}

#[async_trait]
impl StorageBackend for FileBackend {
    async fn init(&self) -> StorageResult<()> {
        info!("Initializing file storage backend at: {}", self.base_path.display());

        // Load existing index if it exists
        let index_path = self.base_path.join("index.json");
        if index_path.exists() {
            let mut file = fs::File::open(index_path)?;
            let mut contents = String::new();
            file.read_to_string(&mut contents)?;
            let index_data: HashMap<String, crate::StorageEntry> = serde_json::from_str(&contents)?;
            let mut index = self.index.write().await;
            *index = index_data;
        }

        Ok(())
    }

    async fn shutdown(&self) -> StorageResult<()> {
        info!("Shutting down file storage backend");
        Ok(())
    }

    fn backend_type(&self) -> StorageBackendType {
        StorageBackendType::File
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

                let index = self.index.read().await;
                if let Some(metadata) = index.get(key) {
                    // Check TTL
                    if let Some(ttl) = metadata.ttl_seconds {
                        if metadata.created_at + Duration::seconds(ttl as i64) <= now {
                            // Entry expired, remove it
                            drop(index);
                            let mut index_write = self.index.write().await;
                            index_write.remove(key);
                            self.delete_entry_file(key)?;
                            return Err(crate::StorageError::KeyNotFound(key.to_string()));
                        }
                    }

                    // Load from file
                    let entry = self.load_entry_from_file(key)?;
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

                let entry = crate::StorageEntry {
                    key: key.to_string(),
                    value: value.clone(),
                    ttl_seconds,
                    created_at: now,
                    updated_at: now,
                    version: 1,
                    metadata: HashMap::new(),
                };

                // Save to file
                self.save_entry_to_file(&entry)?;

                // Update index
                let mut index = self.index.write().await;
                index.insert(key.to_string(), entry);

                debug!("Set key: {} in file backend", key);

                serde_json::to_value(true).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::Delete => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let mut index = self.index.write().await;
                let removed = index.remove(key).is_some();

                if removed {
                    // Delete file
                    self.delete_entry_file(key)?;
                    debug!("Deleted key: {} from file backend", key);
                }

                serde_json::to_value(removed).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::Exists => {
                let key = params.get("key")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| crate::StorageError::OperationError("Missing key parameter".to_string()))?;

                let index = self.index.read().await;
                let exists = index.contains_key(key) && self.get_file_path(key).exists();

                serde_json::to_value(exists).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            StorageOperation::List => {
                let pattern = params.get("pattern").and_then(|v| v.as_str());
                let limit = params.get("limit").and_then(|v| v.as_u64()).unwrap_or(u64::MAX) as usize;

                let index = self.index.read().await;
                let mut keys: Vec<String> = index.keys()
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

                let index = self.index.read().await;
                let count = if let Some(pat) = pattern {
                    index.keys().filter(|key| key.contains(pat)).count()
                } else {
                    index.len()
                };

                serde_json::to_value(count).map_err(|e| crate::StorageError::SerializationError(e.to_string()))
            }

            _ => {
                Err(crate::StorageError::OperationError(format!("Unsupported operation: {:?}", operation)))
            }
        }
    }
}

/// File backend factory
pub struct FileBackendFactory;

#[async_trait]
impl crate::StorageBackendFactory for FileBackendFactory {
    fn backend_type(&self) -> StorageBackendType {
        StorageBackendType::File
    }

    async fn create_backend(&self, config: StorageConfig) -> StorageResult<Box<dyn StorageBackend>> {
        let mut backend = FileBackend::new(config)?;
        backend.init().await?;
        Ok(Box::new(backend))
    }

    fn config_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "connection_string": {
                    "type": "string",
                    "description": "File system path for storage",
                    "examples": ["/tmp/sira-storage", "./data"]
                }
            },
            "required": ["connection_string"]
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_config(temp_dir: &tempfile::TempDir) -> StorageConfig {
        StorageConfig {
            backend_type: StorageBackendType::File,
            connection_string: temp_dir.path().to_string_lossy().to_string(),
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
    async fn test_file_backend_basic_operations() {
        let temp_dir = tempdir().unwrap();
        let config = create_test_config(&temp_dir);
        let backend = FileBackend::new(config).unwrap();
        backend.init().await.unwrap();

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
