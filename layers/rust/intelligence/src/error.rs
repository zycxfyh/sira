//! Error types for Sira Intelligence

use thiserror::Error;

/// Intelligence error types
#[derive(Debug, Error)]
pub enum IntelligenceError {
    #[error("Learning error: {0}")]
    Learning(String),

    #[error("Decision error: {0}")]
    Decision(String),

    #[error("Context error: {0}")]
    Context(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}
