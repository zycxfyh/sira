//! # Sira Tools
//!
//! Plugin-based tool system and orchestration engine for the Sira AI Gateway ecosystem.

pub mod error;
pub mod types;
pub mod tool_plugin;
pub mod tool_registry;
pub mod tool_executor;
pub mod orchestration_engine;
pub mod builtin_tools;

/// Result type alias for tools operations
pub type ToolsResult<T> = Result<T, ToolsError>;

/// Re-export commonly used items
pub use error::*;
pub use types::*;
pub use tool_plugin::*;
pub use tool_registry::*;
pub use tool_executor::*;
pub use orchestration_engine::*;
pub use builtin_tools::*;
