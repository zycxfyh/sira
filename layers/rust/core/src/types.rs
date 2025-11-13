//! Common types for Sira Core

/// Configuration trait
pub trait Config: Send + Sync {
    /// Validate configuration
    fn validate(&self) -> Result<(), String> {
        Ok(())
    }
}

/// Plugin trait for extensible functionality
#[async_trait::async_trait]
pub trait Plugin: Send + Sync {
    /// Plugin name
    fn name(&self) -> &str;

    /// Plugin version
    fn version(&self) -> &str;

    /// Initialize plugin
    async fn init(&mut self) -> crate::SiraResult<()> {
        Ok(())
    }

    /// Shutdown plugin
    async fn shutdown(&mut self) -> crate::SiraResult<()> {
        Ok(())
    }
}
