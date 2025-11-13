//! Error types for Sira Storage Backends

use thiserror::Error;

/// Storage error types
#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Storage backend not found: {0}")]
    BackendNotFound(String),

    #[error("Storage connection error: {0}")]
    ConnectionError(String),

    #[error("Storage operation error: {0}")]
    OperationError(String),

    #[error("Storage serialization error: {0}")]
    SerializationError(String),

    #[error("Storage deserialization error: {0}")]
    DeserializationError(String),

    #[error("Storage key not found: {0}")]
    KeyNotFound(String),

    #[error("Storage key already exists: {0}")]
    KeyAlreadyExists(String),

    #[error("Storage TTL error: {0}")]
    TTLError(String),

    #[error("Storage transaction error: {0}")]
    TransactionError(String),

    #[error("Storage configuration error: {0}")]
    ConfigurationError(String),

    #[error("Storage backend error: {0}")]
    BackendError(String),

    #[error("Storage migration error: {0}")]
    MigrationError(String),

    #[error("Storage quota exceeded: {0}")]
    QuotaExceeded(String),

    #[error("Storage timeout error: {0}")]
    TimeoutError(String),

    #[error("Storage authentication error: {0}")]
    AuthenticationError(String),

    #[error("Storage permission denied: {0}")]
    PermissionDenied(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("Unknown storage error: {0}")]
    Unknown(String),
}
