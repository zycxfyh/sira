//! Error types for Sira Session

use thiserror::Error;

/// Session error types
#[derive(Debug, Error)]
pub enum SessionError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Session expired: {0}")]
    SessionExpired(String),

    #[error("Session store error: {0}")]
    StoreError(String),

    #[error("Session serialization error: {0}")]
    SerializationError(String),

    #[error("Session validation error: {0}")]
    ValidationError(String),

    #[error("Session concurrency error: {0}")]
    ConcurrencyError(String),

    #[error("Session configuration error: {0}")]
    ConfigurationError(String),

    #[error("Session event error: {0}")]
    EventError(String),

    #[error("Unknown session error: {0}")]
    Unknown(String),
}
