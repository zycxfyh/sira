//! Error types for the Sira microkernel

use thiserror::Error;
use std::fmt;

/// Result type alias for kernel operations
pub type KernelResult<T> = Result<T, KernelError>;

/// Kernel error types
#[derive(Error, Debug)]
pub enum KernelError {
    /// Plugin-related errors
    #[error("Plugin error: {message}")]
    PluginError {
        plugin_id: String,
        message: String,
    },

    /// Plugin loading errors
    #[error("Plugin load error: {path} - {message}")]
    PluginLoadError {
        path: String,
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Service-related errors
    #[error("Service error: {service_id} - {message}")]
    ServiceError {
        service_id: String,
        message: String,
    },

    /// Message bus errors
    #[error("Message bus error: {message}")]
    MessageBusError {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Resource management errors
    #[error("Resource error: {resource_id} - {message}")]
    ResourceError {
        resource_id: String,
        message: String,
    },

    /// Configuration errors
    #[error("Configuration error: {message}")]
    ConfigError {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Communication errors
    #[error("Communication error: {message}")]
    CommunicationError {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Security errors
    #[error("Security error: {message}")]
    SecurityError {
        message: String,
    },

    /// Generic kernel errors
    #[error("Kernel error: {message}")]
    GenericError {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },
}

impl KernelError {
    /// Create a new plugin error
    pub fn plugin_error<S: Into<String>>(plugin_id: S, message: S) -> Self {
        KernelError::PluginError {
            plugin_id: plugin_id.into(),
            message: message.into(),
        }
    }

    /// Create a new plugin load error
    pub fn plugin_load_error<P: Into<String>, M: Into<String>>(
        path: P,
        message: M,
    ) -> Self {
        KernelError::PluginLoadError {
            path: path.into(),
            message: message.into(),
            source: None,
        }
    }

    /// Create a new plugin load error with source
    pub fn plugin_load_error_with_source<P: Into<String>, M: Into<String>>(
        path: P,
        message: M,
        source: Box<dyn std::error::Error + Send + Sync>,
    ) -> Self {
        KernelError::PluginLoadError {
            path: path.into(),
            message: message.into(),
            source: Some(source),
        }
    }

    /// Create a new service error
    pub fn service_error<S: Into<String>>(service_id: S, message: S) -> Self {
        KernelError::ServiceError {
            service_id: service_id.into(),
            message: message.into(),
        }
    }

    /// Create a new message bus error
    pub fn message_bus_error<M: Into<String>>(message: M) -> Self {
        KernelError::MessageBusError {
            message: message.into(),
            source: None,
        }
    }

    /// Create a new resource error
    pub fn resource_error<R: Into<String>, S: Into<String>>(resource_id: R, message: S) -> Self {
        KernelError::ResourceError {
            resource_id: resource_id.into(),
            message: message.into(),
        }
    }

    /// Create a new configuration error
    pub fn config_error<M: Into<String>>(message: M) -> Self {
        KernelError::ConfigError {
            message: message.into(),
            source: None,
        }
    }

    /// Create a new communication error
    pub fn communication_error<M: Into<String>>(message: M) -> Self {
        KernelError::CommunicationError {
            message: message.into(),
            source: None,
        }
    }

    /// Create a new security error
    pub fn security_error<M: Into<String>>(message: M) -> Self {
        KernelError::SecurityError {
            message: message.into(),
        }
    }

    /// Create a new generic error
    pub fn generic_error<M: Into<String>>(message: M) -> Self {
        KernelError::GenericError {
            message: message.into(),
            source: None,
        }
    }
}

/// Plugin-specific error trait
pub trait PluginError: std::error::Error + Send + Sync {
    /// Get the plugin ID that caused this error
    fn plugin_id(&self) -> &str;

    /// Get whether this error is recoverable
    fn is_recoverable(&self) -> bool {
        false
    }
}

/// Service-specific error trait
pub trait ServiceError: std::error::Error + Send + Sync {
    /// Get the service ID that caused this error
    fn service_id(&self) -> &str;

    /// Get the error severity
    fn severity(&self) -> ErrorSeverity {
        ErrorSeverity::Error
    }
}

/// Error severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorSeverity {
    /// Debug level - not an actual error
    Debug,
    /// Info level - informational
    Info,
    /// Warning level - potential issue
    Warning,
    /// Error level - actual error
    Error,
    /// Critical level - system-impacting error
    Critical,
    /// Fatal level - system must shut down
    Fatal,
}

impl fmt::Display for ErrorSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorSeverity::Debug => write!(f, "DEBUG"),
            ErrorSeverity::Info => write!(f, "INFO"),
            ErrorSeverity::Warning => write!(f, "WARNING"),
            ErrorSeverity::Error => write!(f, "ERROR"),
            ErrorSeverity::Critical => write!(f, "CRITICAL"),
            ErrorSeverity::Fatal => write!(f, "FATAL"),
        }
    }
}
