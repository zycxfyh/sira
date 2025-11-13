//! # Sira Storage Backends
//!
//! Multi-backend storage abstraction layer for the Sira AI Gateway ecosystem.
//! Provides unified interfaces for various storage systems including Redis, PostgreSQL,
//! MySQL, SQLite, file system, and in-memory storage.

pub mod error;
pub mod types;
pub mod storage_client;
pub mod memory_backend;
pub mod file_backend;

/// Result type alias for storage operations
pub type StorageResult<T> = Result<T, StorageError>;

/// Re-export commonly used items
pub use error::*;
pub use types::*;
pub use storage_client::*;
pub use memory_backend::*;
pub use file_backend::*;
