//! Common types for Sira Storage Backends

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Result type alias for storage operations
pub type StorageResult<T> = Result<T, crate::StorageError>;

/// Storage backend trait - implemented by each backend
#[async_trait::async_trait]
pub trait StorageBackend: Send + Sync {
    /// Initialize the backend
    async fn init(&self) -> StorageResult<()>;

    /// Shutdown the backend
    async fn shutdown(&self) -> StorageResult<()>;

    /// Get backend type
    fn backend_type(&self) -> StorageBackendType;

    /// Get backend configuration
    fn config(&self) -> &StorageConfig;

    /// Execute raw storage operations
    async fn execute_operation(&self, operation: StorageOperation, params: &HashMap<String, serde_json::Value>) -> StorageResult<serde_json::Value>;
}

/// Storage backend types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StorageBackendType {
    Memory,
    File,
    Redis,
    PostgreSQL,
    MySQL,
    SQLite,
    Sled,
    RocksDB,
}

/// Storage operation types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StorageOperation {
    Get,
    Set,
    Delete,
    Exists,
    List,
    Count,
    TTL,
    Expire,
    Persist,
    Increment,
    Decrement,
    Append,
    Prepend,
    Search,
    Batch,
}

/// Storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    pub backend_type: StorageBackendType,
    pub connection_string: String,
    pub pool_size: Option<usize>,
    pub timeout_seconds: Option<u64>,
    pub retry_attempts: Option<u32>,
    pub enable_compression: bool,
    pub enable_encryption: bool,
    pub max_connections: Option<usize>,
    pub max_key_size_bytes: Option<usize>,
    pub max_value_size_bytes: Option<usize>,
    pub default_ttl_seconds: Option<u64>,
    pub namespace: Option<String>,
}

/// Storage key-value pair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageEntry {
    pub key: String,
    pub value: serde_json::Value,
    pub ttl_seconds: Option<u64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: u64,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Storage query parameters
#[derive(Debug, Clone, Default)]
pub struct StorageQuery {
    pub prefix: Option<String>,
    pub pattern: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub order_by: Option<String>,
    pub order_descending: bool,
    pub filters: HashMap<String, serde_json::Value>,
}

/// Storage batch operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageBatch {
    pub operations: Vec<StorageBatchOperation>,
    pub atomic: bool,
}

/// Storage batch operation item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageBatchOperation {
    pub operation: StorageOperation,
    pub key: String,
    pub value: Option<serde_json::Value>,
    pub ttl_seconds: Option<u64>,
}

/// Storage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub backend_type: StorageBackendType,
    pub total_keys: u64,
    pub total_size_bytes: u64,
    pub connections_active: u32,
    pub connections_idle: u32,
    pub operations_per_second: f64,
    pub average_response_time_ms: f64,
    pub uptime_seconds: u64,
    pub last_backup: Option<DateTime<Utc>>,
    pub health_status: StorageHealthStatus,
}

/// Storage health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StorageHealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
    Unknown,
}

/// Storage event types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StorageEvent {
    KeySet { key: String, size_bytes: usize },
    KeyDeleted { key: String },
    KeyExpired { key: String },
    ConnectionEstablished { backend: String },
    ConnectionLost { backend: String },
    BackupStarted { location: String },
    BackupCompleted { location: String, duration_ms: u64 },
    MigrationStarted { from: StorageBackendType, to: StorageBackendType },
    MigrationCompleted { from: StorageBackendType, to: StorageBackendType },
    Error { operation: StorageOperation, error: String },
}

/// Storage event handler trait
#[async_trait::async_trait]
pub trait StorageEventHandler: Send + Sync {
    async fn handle_event(&self, event: &StorageEvent) -> StorageResult<()>;
}

/// Storage migration configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationConfig {
    pub source_backend: StorageConfig,
    pub target_backend: StorageConfig,
    pub batch_size: usize,
    pub parallel_workers: usize,
    pub skip_existing: bool,
    pub verify_integrity: bool,
    pub timeout_seconds: u64,
}

/// Storage backup configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub enabled: bool,
    pub interval_seconds: u64,
    pub retention_count: u32,
    pub compression: bool,
    pub encryption: bool,
    pub location: String,
    pub include_metadata: bool,
}

/// Storage cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub max_size_mb: usize,
    pub ttl_seconds: u64,
    pub strategy: CacheStrategy,
}

/// Cache eviction strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CacheStrategy {
    LRU,
    LFU,
    FIFO,
    Random,
}

/// Storage security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub encryption_key: Option<String>,
    pub tls_enabled: bool,
    pub tls_cert_path: Option<String>,
    pub tls_key_path: Option<String>,
    pub allowed_ips: Vec<String>,
    pub rate_limit_per_minute: Option<u32>,
}

/// Storage monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfig {
    pub metrics_enabled: bool,
    pub tracing_enabled: bool,
    pub slow_query_threshold_ms: u64,
    pub alert_on_errors: bool,
    pub alert_on_high_latency: bool,
    pub alert_threshold_ms: u64,
}

/// Storage factory trait for creating backend instances
#[async_trait::async_trait]
pub trait StorageBackendFactory: Send + Sync {
    fn backend_type(&self) -> StorageBackendType;
    async fn create_backend(&self, config: StorageConfig) -> StorageResult<Box<dyn StorageBackend>>;
    fn config_schema(&self) -> serde_json::Value;
}

/// Combined storage configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombinedStorageConfig {
    pub primary: StorageConfig,
    pub replicas: Vec<StorageConfig>,
    pub cache: Option<CacheConfig>,
    pub backup: Option<BackupConfig>,
    pub security: Option<SecurityConfig>,
    pub monitoring: Option<MonitoringConfig>,
    pub failover_enabled: bool,
    pub read_from_replicas: bool,
}
