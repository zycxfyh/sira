//! # Sira AI Backends
//!
//! Multi-provider AI service integration for the Sira AI Gateway ecosystem.

pub mod error;
pub mod types;
pub mod providers;
pub mod router;
pub mod load_balancer;
pub mod client;

/// Result type alias for AI backend operations
pub type AiResult<T> = Result<T, AiError>;

/// Re-export commonly used items
pub use router::*;
pub use load_balancer::*;
pub use error::*;
pub use types::*;
pub use providers::*;
pub use client::*;
