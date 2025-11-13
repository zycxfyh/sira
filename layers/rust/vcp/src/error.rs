//! Error types for Sira VCP

use thiserror::Error;

/// VCP error types
#[derive(Debug, Error)]
pub enum VcpError {
    #[error("Thinking chain error: {0}")]
    ThinkingChain(String),

    #[error("Recursive reasoning error: {0}")]
    RecursiveReasoning(String),

    #[error("Meta-cognition error: {0}")]
    Metacognition(String),

    #[error("Adaptive control error: {0}")]
    AdaptiveControl(String),

    #[error("Chain generation error: {0}")]
    ChainGeneration(String),

    #[error("Node execution error: {0}")]
    NodeExecution(String),

    #[error("Context error: {0}")]
    Context(String),

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Unknown VCP error: {0}")]
    Unknown(String),
}
