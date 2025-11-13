//! Error types for Sira Utils

use thiserror::Error;

/// Utils error types
#[derive(Debug, Error)]
pub enum UtilsError {
    #[error("Time error: {0}")]
    Time(String),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Unknown error: {0}")]
    Unknown(String),
}
