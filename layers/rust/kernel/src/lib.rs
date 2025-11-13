//! # Sira Microkernel
//!
//! The Sira Microkernel provides a unified platform for plugin management,
//! service orchestration, and inter-component communication across the entire
//! Sira ecosystem.
//!
//! ## Architecture
//!
//! The microkernel consists of four core components:
//!
//! 1. **Plugin Manager**: Handles plugin loading, unloading, and lifecycle management
//! 2. **Service Registry**: Maintains service discovery and registration
//! 3. **Message Bus**: Provides event-driven communication between components
//! 4. **Resource Scheduler**: Manages resource allocation and scheduling
//!
//! ## Plugin System
//!
//! Plugins in Sira are dynamically loaded libraries that implement the `Plugin` trait.
//! Each plugin can:
//!
//! - Register services with the kernel
//! - Subscribe to and publish messages on the bus
//! - Request and release resources
//! - Communicate with other plugins through well-defined interfaces

pub mod error;
pub mod plugin;
pub mod service;
pub mod message;
pub mod resource;
pub mod kernel;

pub use error::{KernelError, KernelResult};
pub use plugin::{Plugin, PluginMetadata, PluginContext, PluginManager};
pub use service::{Service, ServiceMetadata, ServiceRegistry};
pub use message::{Message, MessageBus, MessageHandler};
pub use resource::{ResourceManager, ResourceRequest};
pub use kernel::Microkernel;

/// Re-export commonly used types
pub use abi_stable;

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = "Sira Microkernel";

/// Initialize the Sira microkernel with default configuration
pub async fn init() -> KernelResult<Microkernel> {
    Microkernel::new(Default::default()).await
}

/// Initialize the Sira microkernel with custom configuration
pub async fn init_with_config(config: kernel::KernelConfig) -> KernelResult<Microkernel> {
    Microkernel::new(config).await
}
