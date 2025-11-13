//! Sira Kernel - Main entry point
//!
//! This is the main entry point for the Sira microkernel.
//! It initializes the kernel, loads plugins, and starts all services.

use std::sync::Arc;
use tracing::{info, error, Level};
use tracing_subscriber::{FmtSubscriber, EnvFilter};

use sira_kernel::{kernel::KernelConfig, Microkernel};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_env_filter(EnvFilter::from_default_env()
            .add_directive(Level::INFO.into()))
        .with_target(false)
        .compact()
        .init();

    info!("🚀 Starting Sira Microkernel v{}", env!("CARGO_PKG_VERSION"));

    // Load configuration (from file or environment)
    let config = load_config()?;

    // Create and start kernel
    let kernel = Microkernel::new(config).await?;
    let kernel = Arc::new(kernel);

    // Setup signal handlers for graceful shutdown
    let kernel_clone = kernel.clone();
    tokio::spawn(async move {
        if let Err(e) = setup_signal_handlers(kernel_clone).await {
            error!("Signal handler error: {}", e);
        }
    });

    // Start the kernel
    if let Err(e) = kernel.start().await {
        error!("Failed to start kernel: {}", e);
        std::process::exit(1);
    }

    info!("🎉 Sira Microkernel started successfully!");
    info!("📊 Health check available at: http://localhost:8080/health");
    info!("📈 Metrics available at: http://localhost:8080/metrics");

    // Keep the kernel running
    wait_for_shutdown().await;

    info!("👋 Sira Microkernel shutdown complete");
    Ok(())
}

/// Load kernel configuration
fn load_config() -> Result<KernelConfig, Box<dyn std::error::Error>> {
    // Try to load from config file first
    if let Ok(config_content) = std::fs::read_to_string("kernel.toml") {
        let config: KernelConfig = toml::from_str(&config_content)?;
        info!("Loaded configuration from kernel.toml");
        return Ok(config);
    }

    // Fall back to default configuration
    info!("Using default kernel configuration");
    Ok(KernelConfig::default())
}

/// Setup signal handlers for graceful shutdown
async fn setup_signal_handlers(kernel: Arc<Microkernel>) -> Result<(), Box<dyn std::error::Error>> {
    use tokio::signal;

    tokio::select! {
        _ = signal::ctrl_c() => {
            info!("Received Ctrl+C, initiating graceful shutdown...");
        }
    }

    // Graceful shutdown
    if let Err(e) = kernel.stop().await {
        error!("Error during kernel shutdown: {}", e);
    }

    Ok(())
}

/// Wait for shutdown signal
async fn wait_for_shutdown() {
    // In a real implementation, this would wait for a shutdown signal
    // For now, just wait for Ctrl+C
    tokio::signal::ctrl_c().await.unwrap();
}
