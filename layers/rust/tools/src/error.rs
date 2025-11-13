//! Error types for Sira Tools

use thiserror::Error;

/// Tools error types
#[derive(Debug, Error)]
pub enum ToolsError {
    #[error("Tool execution error: {0}")]
    Execution(String),

    #[error("Tool not found: {0}")]
    ToolNotFound(String),

    #[error("Tool configuration error: {0}")]
    Configuration(String),

    #[error("Tool validation error: {0}")]
    Validation(String),

    #[error("Tool orchestration error: {0}")]
    Orchestration(String),

    #[error("Tool security error: {0}")]
    Security(String),

    #[error("Tool resource error: {0}")]
    Resource(String),

    #[error("Tool timeout error: {0}")]
    Timeout(String),

    #[error("Unknown tool error: {0}")]
    Unknown(String),
}
