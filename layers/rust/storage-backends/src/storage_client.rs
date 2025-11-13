//! Storage Client - Unified interface for all storage backends

use crate::{StorageResult, StorageConfig, StorageEntry, StorageQuery, StorageBatch, StorageStats, StorageEvent, StorageEventHandler};
use async_trait::async_trait;
use std::collections::HashMap;

/// Unified storage client interface
#[async_trait]
pub trait StorageClient: Send + Sync {
    /// Get a value by key
    async fn get(&self, key: &str) -> StorageResult<Option<StorageEntry>>;

    /// Set a key-value pair
    async fn set(&self, key: &str, value: serde_json::Value, ttl_seconds: Option<u64>) -> StorageResult<()>;

    /// Delete a key
    async fn delete(&self, key: &str) -> StorageResult<bool>;

    /// Check if a key exists
    async fn exists(&self, key: &str) -> StorageResult<bool>;

    /// List keys with optional pattern
    async fn list(&self, pattern: Option<&str>, limit: Option<usize>) -> StorageResult<Vec<String>>;

    /// Count keys matching pattern
    async fn count(&self, pattern: Option<&str>) -> StorageResult<u64>;

    /// Get TTL for a key
    async fn ttl(&self, key: &str) -> StorageResult<Option<u64>>;

    /// Set expiration for a key
    async fn expire(&self, key: &str, ttl_seconds: u64) -> StorageResult<bool>;

    /// Remove expiration from a key
    async fn persist(&self, key: &str) -> StorageResult<bool>;

    /// Increment a numeric value
    async fn increment(&self, key: &str, delta: i64) -> StorageResult<i64>;

    /// Decrement a numeric value
    async fn decrement(&self, key: &str, delta: i64) -> StorageResult<i64>;

    /// Append to a string value
    async fn append(&self, key: &str, value: &str) -> StorageResult<usize>;

    /// Prepend to a string value
    async fn prepend(&self, key: &str, value: &str) -> StorageResult<usize>;

    /// Execute batch operations
    async fn batch_execute(&self, batch: StorageBatch) -> StorageResult<Vec<StorageResult<()>>>;

    /// Query storage with advanced filters
    async fn query(&self, query: StorageQuery) -> StorageResult<Vec<StorageEntry>>;

    /// Get storage statistics
    async fn stats(&self) -> StorageResult<StorageStats>;

    /// Health check
    async fn health_check(&self) -> StorageResult<bool>;

    /// Backup storage
    async fn backup(&self, location: &str) -> StorageResult<()>;

    /// Restore from backup
    async fn restore(&self, location: &str) -> StorageResult<()>;

    /// Flush all data (dangerous!)
    async fn flush_all(&self) -> StorageResult<()>;
}


/// Generic storage client implementation
pub struct GenericStorageClient {
    backend: Box<dyn crate::StorageBackend>,
    event_handlers: Vec<Box<dyn StorageEventHandler>>,
}

impl GenericStorageClient {
    /// Create a new storage client with a backend
    pub fn new(backend: Box<dyn crate::StorageBackend>) -> Self {
        Self {
            backend,
            event_handlers: Vec::new(),
        }
    }

    /// Add an event handler
    pub fn add_event_handler(&mut self, handler: Box<dyn StorageEventHandler>) {
        self.event_handlers.push(handler);
    }

    /// Emit an event to all handlers
    async fn emit_event(&self, event: StorageEvent) {
        for handler in &self.event_handlers {
            if let Err(e) = handler.handle_event(&event).await {
                tracing::error!("Storage event handler error: {:?}", e);
            }
        }
    }
}

#[async_trait]
impl StorageClient for GenericStorageClient {
    async fn get(&self, key: &str) -> StorageResult<Option<StorageEntry>> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));

        match self.backend.execute_operation(crate::StorageOperation::Get, &params).await {
            Ok(value) => {
                let entry: StorageEntry = serde_json::from_value(value)?;
                Ok(Some(entry))
            }
            Err(crate::StorageError::KeyNotFound(_)) => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn set(&self, key: &str, value: serde_json::Value, ttl_seconds: Option<u64>) -> StorageResult<()> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));
        params.insert("value".to_string(), serde_json::json!(value));
        if let Some(ttl) = ttl_seconds {
            params.insert("ttl_seconds".to_string(), serde_json::json!(ttl));
        }

        self.backend.execute_operation(crate::StorageOperation::Set, &params).await?;

        // Emit event
        let size_bytes = serde_json::to_string(&value).map(|s| s.len()).unwrap_or(0);
        self.emit_event(StorageEvent::KeySet {
            key: key.to_string(),
            size_bytes,
        }).await;

        Ok(())
    }

    async fn delete(&self, key: &str) -> StorageResult<bool> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));

        match self.backend.execute_operation(crate::StorageOperation::Delete, &params).await {
            Ok(_) => {
                self.emit_event(StorageEvent::KeyDeleted {
                    key: key.to_string(),
                }).await;
                Ok(true)
            }
            Err(crate::StorageError::KeyNotFound(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn exists(&self, key: &str) -> StorageResult<bool> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));

        match self.backend.execute_operation(crate::StorageOperation::Exists, &params).await {
            Ok(value) => Ok(value.as_bool().unwrap_or(false)),
            Err(_) => Ok(false),
        }
    }

    async fn list(&self, pattern: Option<&str>, limit: Option<usize>) -> StorageResult<Vec<String>> {
        let mut params = HashMap::new();
        if let Some(p) = pattern {
            params.insert("pattern".to_string(), serde_json::json!(p));
        }
        if let Some(l) = limit {
            params.insert("limit".to_string(), serde_json::json!(l));
        }

        let result = self.backend.execute_operation(crate::StorageOperation::List, &params).await?;
        let keys: Vec<String> = serde_json::from_value(result)?;
        Ok(keys)
    }

    async fn count(&self, pattern: Option<&str>) -> StorageResult<u64> {
        let mut params = HashMap::new();
        if let Some(p) = pattern {
            params.insert("pattern".to_string(), serde_json::json!(p));
        }

        let result = self.backend.execute_operation(crate::StorageOperation::Count, params).await?;
        Ok(result.as_u64().unwrap_or(0))
    }

    async fn ttl(&self, key: &str) -> StorageResult<Option<u64>> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));

        match self.backend.execute_operation(crate::StorageOperation::TTL, params).await {
            Ok(value) => {
                if let Some(ttl) = value.as_u64() {
                    Ok(Some(ttl))
                } else {
                    Ok(None)
                }
            }
            Err(crate::StorageError::KeyNotFound(_)) => Ok(None),
            Err(e) => Err(e),
        }
    }

    async fn expire(&self, key: &str, ttl_seconds: u64) -> StorageResult<bool> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));
        params.insert("ttl_seconds".to_string(), serde_json::json!(ttl_seconds));

        match self.backend.execute_operation(crate::StorageOperation::Expire, params).await {
            Ok(value) => Ok(value.as_bool().unwrap_or(false)),
            Err(crate::StorageError::KeyNotFound(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn persist(&self, key: &str) -> StorageResult<bool> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));

        match self.backend.execute_operation(crate::StorageOperation::Persist, params).await {
            Ok(value) => Ok(value.as_bool().unwrap_or(false)),
            Err(crate::StorageError::KeyNotFound(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    async fn increment(&self, key: &str, delta: i64) -> StorageResult<i64> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));
        params.insert("delta".to_string(), serde_json::json!(delta));

        let result = self.backend.execute_operation(crate::StorageOperation::Increment, params).await?;
        Ok(result.as_i64().unwrap_or(0))
    }

    async fn decrement(&self, key: &str, delta: i64) -> StorageResult<i64> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));
        params.insert("delta".to_string(), serde_json::json!(delta));

        let result = self.backend.execute_operation(crate::StorageOperation::Decrement, params).await?;
        Ok(result.as_i64().unwrap_or(0))
    }

    async fn append(&self, key: &str, value: &str) -> StorageResult<usize> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));
        params.insert("value".to_string(), serde_json::json!(value));

        let result = self.backend.execute_operation(crate::StorageOperation::Append, params).await?;
        Ok(result.as_u64().unwrap_or(0) as usize)
    }

    async fn prepend(&self, key: &str, value: &str) -> StorageResult<usize> {
        let mut params = HashMap::new();
        params.insert("key".to_string(), serde_json::json!(key));
        params.insert("value".to_string(), serde_json::json!(value));

        let result = self.backend.execute_operation(crate::StorageOperation::Prepend, params).await?;
        Ok(result.as_u64().unwrap_or(0) as usize)
    }

    async fn batch_execute(&self, batch: StorageBatch) -> StorageResult<Vec<StorageResult<()>>> {
        let params = HashMap::new(); // Batch operations would need special handling
        let _ = self.backend.execute_operation(crate::StorageOperation::Batch, params).await?;
        // For now, return empty vec - full implementation would handle batch operations
        Ok(vec![])
    }

    async fn query(&self, query: StorageQuery) -> StorageResult<Vec<StorageEntry>> {
        let params = HashMap::new(); // Query operations would need special handling
        let _ = self.backend.execute_operation(crate::StorageOperation::Search, params).await?;
        // For now, return empty vec - full implementation would handle query operations
        Ok(vec![])
    }

    async fn stats(&self) -> StorageResult<StorageStats> {
        // This would need to be implemented by each backend
        // For now, return a basic stats structure
        Ok(StorageStats {
            backend_type: self.backend.backend_type(),
            total_keys: 0,
            total_size_bytes: 0,
            connections_active: 0,
            connections_idle: 0,
            operations_per_second: 0.0,
            average_response_time_ms: 0.0,
            uptime_seconds: 0,
            last_backup: None,
            health_status: crate::StorageHealthStatus::Unknown,
        })
    }

    async fn health_check(&self) -> StorageResult<bool> {
        // Basic health check - backends should override this
        Ok(true)
    }

    async fn backup(&self, location: &str) -> StorageResult<()> {
        self.emit_event(StorageEvent::BackupStarted {
            location: location.to_string(),
        }).await;

        // Backup implementation would be backend-specific
        // For now, just emit completion event
        self.emit_event(StorageEvent::BackupCompleted {
            location: location.to_string(),
            duration_ms: 0,
        }).await;

        Ok(())
    }

    async fn restore(&self, location: &str) -> StorageResult<()> {
        // Restore implementation would be backend-specific
        Ok(())
    }

    async fn flush_all(&self) -> StorageResult<()> {
        // This is dangerous and should be used carefully
        // Implementation would be backend-specific
        Ok(())
    }
}
