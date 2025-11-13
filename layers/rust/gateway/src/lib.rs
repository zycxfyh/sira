//! # Sira Gateway
//!
//! High-performance HTTP request processing and intelligent routing
//! for the Sira AI Gateway ecosystem.

pub mod error;
pub mod types;
pub mod router;
pub mod middleware;
pub mod handlers;
pub mod server;
pub mod websocket;

/// Result type alias for gateway operations
pub type GatewayResult<T> = Result<T, GatewayError>;

/// Re-export commonly used items
pub use error::*;
pub use types::*;
pub use router::*;
pub use middleware::*;
pub use handlers::*;
pub use server::*;
pub use websocket::*;
