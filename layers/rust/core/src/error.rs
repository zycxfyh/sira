//! Error types for Sira Core

use thiserror::Error;

/// Core error types
#[derive(Debug, Error)]
pub enum SiraError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Service error: {0}")]
    Service(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}
