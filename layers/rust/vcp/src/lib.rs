//! # Sira VCP - Variable Cognitive Process
//!
//! Ultra-dynamic recursive thinking mechanism for advanced AI reasoning.

pub mod error;
pub mod types;
pub mod thinking_node;
pub mod thinking_chain;
pub mod chain_generator;
pub mod recursive_engine;
pub mod metacognition;
pub mod adaptive_controller;

/// Result type alias for VCP operations
pub type VcpResult<T> = Result<T, VcpError>;

/// Re-export commonly used items
pub use error::*;
pub use types::*;
pub use thinking_node::*;
pub use thinking_chain::*;
pub use chain_generator::*;
pub use recursive_engine::*;
pub use metacognition::*;
pub use adaptive_controller::*;
