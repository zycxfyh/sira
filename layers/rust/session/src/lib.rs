//! # Sira Session Management
//!
//! Session lifecycle management and state persistence for the Sira AI Gateway ecosystem.

pub mod error;
pub mod types;
pub mod session_manager;
pub mod session_store;
pub mod memory_store;
pub mod event_handler;

/// Result type alias for session operations
pub type SessionResult<T> = Result<T, SessionError>;

/// Re-export commonly used items
pub use error::*;
pub use types::*;
pub use session_manager::*;
pub use session_store::*;
pub use memory_store::*;
pub use event_handler::*;
