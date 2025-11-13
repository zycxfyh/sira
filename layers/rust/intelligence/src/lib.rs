//! # Sira Intelligence
//!
//! Adaptive learning and decision making engine for the Sira AI Gateway ecosystem.

pub mod error;
pub mod types;
pub mod learning_engine;
pub mod decision_engine;
pub mod context_analyzer;

/// Result type alias for intelligence operations
pub type IntelligenceResult<T> = Result<T, IntelligenceError>;

/// Re-export commonly used items
pub use error::*;
pub use types::*;
pub use learning_engine::*;
pub use decision_engine::*;
pub use context_analyzer::*;
