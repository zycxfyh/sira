//! Tool Executor for Sira Tools

use crate::{ToolsResult, ToolsError, ToolContext, ToolInput, ToolOutput, ResourceLimits, ResourceUsage, ToolPlugin};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

/// Tool execution statistics
#[derive(Debug, Clone)]
pub struct ExecutionStats {
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub average_execution_time_ms: f64,
    pub total_resource_usage: ResourceUsage,
}

/// Tool executor for running tool plugins
pub struct ToolExecutor {
    stats: Arc<Mutex<ExecutionStats>>,
    active_executions: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<ToolsResult<ToolOutput>>>>>,
}

impl ToolExecutor {
    /// Create a new tool executor
    pub fn new() -> Self {
        Self {
            stats: Arc::new(Mutex::new(ExecutionStats {
                total_executions: 0,
                successful_executions: 0,
                failed_executions: 0,
                average_execution_time_ms: 0.0,
                total_resource_usage: ResourceUsage {
                    memory_mb_peak: 0,
                    cpu_percent_avg: 0.0,
                    execution_time_ms: 0,
                    io_operations: 0,
                },
            })),
            active_executions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Execute a tool with the given context and input
    pub async fn execute_tool(
        &self,
        plugin: &dyn ToolPlugin,
        context: ToolContext,
        input: ToolInput,
    ) -> ToolsResult<ToolOutput> {
        let execution_id = context.execution_id.clone();

        // Check resource limits
        self.check_resource_limits(&context).await?;

        // Validate input
        plugin.validate_input(&input).await?;

        // Create execution task
        let plugin_clone = plugin; // Clone plugin reference
        let context_clone = context.clone();

        let execution_task = tokio::spawn(async move {
            let start_time = Instant::now();
            debug!("Starting tool execution: {}", context_clone.execution_id);

            let initial_memory = Self::get_current_memory_usage();
            let result = plugin_clone.execute(&context_clone, input).await;
            let execution_time = start_time.elapsed();
            let final_memory = Self::get_current_memory_usage();

            let output = match result {
                Ok(mut output) => {
                    output.execution_time_ms = execution_time.as_millis() as u64;
                    output.resource_usage = ResourceUsage {
                        memory_mb_peak: final_memory.saturating_sub(initial_memory),
                        cpu_percent_avg: 10.0,
                        execution_time_ms: execution_time.as_millis() as u64,
                        io_operations: 0,
                    };
                    Ok(output)
                }
                Err(e) => {
                    error!("Tool execution failed: {} - {:?}", context_clone.execution_id, e);
                    let error_output = ToolOutput {
                        success: false,
                        exit_code: Some(1),
                        stdout: None,
                        stderr: Some(e.to_string()),
                        files: vec![],
                        metadata: HashMap::new(),
                        execution_time_ms: execution_time.as_millis() as u64,
                        resource_usage: ResourceUsage {
                            memory_mb_peak: final_memory.saturating_sub(initial_memory),
                            cpu_percent_avg: 5.0,
                            execution_time_ms: execution_time.as_millis() as u64,
                            io_operations: 0,
                        },
                    };
                    Ok(error_output)
                }
            };

            if let Err(e) = plugin_clone.cleanup(&context_clone).await {
                warn!("Tool cleanup failed: {} - {:?}", context_clone.execution_id, e);
            }

            debug!("Completed tool execution: {} in {:?}", context_clone.execution_id, execution_time);
            output
        });

        // Execute with timeout
        let timeout_duration = context.timeout_seconds
            .map(Duration::from_secs)
            .unwrap_or(Duration::from_secs(300)); // Default 5 minutes

        let result = match timeout(timeout_duration, execution_task).await {
            Ok(result) => result.map_err(|e| ToolsError::Execution(format!("Task join error: {:?}", e)))?,
            Err(_) => {
                warn!("Tool execution timed out: {}", execution_id);
                return Err(ToolsError::Timeout(format!("Tool execution timed out after {} seconds", timeout_duration.as_secs())));
            }
        };

        // Remove from active executions
        {
            let mut active_executions = self.active_executions.lock().await;
            active_executions.remove(&execution_id);
        }

        // Update statistics
        self.update_stats(&result).await?;

        result
    }


    /// Cancel an active execution
    pub async fn cancel_execution(&self, execution_id: &str) -> ToolsResult<()> {
        let mut active_executions = self.active_executions.lock().await;

        if let Some(handle) = active_executions.remove(execution_id) {
            handle.abort();
            info!("Cancelled tool execution: {}", execution_id);
            Ok(())
        } else {
            Err(ToolsError::Execution(format!("No active execution found: {}", execution_id)))
        }
    }

    /// Get active executions
    pub async fn get_active_executions(&self) -> Vec<String> {
        let active_executions = self.active_executions.lock().await;
        active_executions.keys().cloned().collect()
    }

    /// Get execution statistics
    pub async fn get_stats(&self) -> ExecutionStats {
        let stats = self.stats.lock().await;
        stats.clone()
    }

    /// Check resource limits before execution
    async fn check_resource_limits(&self, context: &ToolContext) -> ToolsResult<()> {
        let active_count = self.active_executions.lock().await.len() as u32;

        if let Some(max_concurrent) = context.resource_limits.max_concurrent_executions {
            if active_count >= max_concurrent {
                return Err(ToolsError::Resource(format!(
                    "Maximum concurrent executions reached: {} >= {}",
                    active_count, max_concurrent
                )));
            }
        }

        // Additional resource checks can be added here
        // (memory, CPU, etc. - would require system monitoring)

        Ok(())
    }

    /// Update execution statistics
    async fn update_stats(&self, result: &ToolsResult<ToolOutput>) -> ToolsResult<()> {
        let mut stats = self.stats.lock().await;

        stats.total_executions += 1;

        if let Ok(output) = result {
            stats.successful_executions += 1;

            // Update average execution time
            let new_avg = ((stats.average_execution_time_ms * (stats.total_executions - 1) as f64) +
                          output.execution_time_ms as f64) / stats.total_executions as f64;
            stats.average_execution_time_ms = new_avg;

            // Update total resource usage
            stats.total_resource_usage.memory_mb_peak += output.resource_usage.memory_mb_peak;
            stats.total_resource_usage.execution_time_ms += output.resource_usage.execution_time_ms;
            stats.total_resource_usage.io_operations += output.resource_usage.io_operations;
        } else {
            stats.failed_executions += 1;
        }

        Ok(())
    }

    /// Get current memory usage (simplified implementation)
    fn get_current_memory_usage() -> u64 {
        // In a real implementation, this would use system APIs to get actual memory usage
        // For now, return a dummy value
        100 // MB
    }

    /// Execute tool with fallback
    pub async fn execute_with_fallback(
        &self,
        primary_plugin: &dyn ToolPlugin,
        fallback_plugin: Option<&dyn ToolPlugin>,
        context: ToolContext,
        input: ToolInput,
    ) -> ToolsResult<ToolOutput> {
        match self.execute_tool(primary_plugin, context.clone(), input.clone()).await {
            Ok(output) if output.success => Ok(output),
            Ok(output) => {
                // Primary tool failed, try fallback
                if let Some(fallback) = fallback_plugin {
                    warn!("Primary tool failed, trying fallback for execution: {}", context.execution_id);
                    self.execute_tool(fallback, context, input).await
                } else {
                    Ok(output)
                }
            }
            Err(e) => {
                // Primary tool errored, try fallback
                if let Some(fallback) = fallback_plugin {
                    warn!("Primary tool errored, trying fallback for execution: {} - {:?}", context.execution_id, e);
                    self.execute_tool(fallback, context, input).await
                } else {
                    Err(e)
                }
            }
        }
    }
}

impl Default for ToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Tool execution manager for coordinating multiple executions
pub struct ExecutionManager {
    executor: ToolExecutor,
    execution_history: Arc<Mutex<HashMap<String, Vec<ToolOutput>>>>,
}

impl ExecutionManager {
    /// Create a new execution manager
    pub fn new() -> Self {
        Self {
            executor: ToolExecutor::new(),
            execution_history: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Execute a tool and store the result in history
    pub async fn execute_and_record(
        &self,
        plugin: &dyn ToolPlugin,
        context: ToolContext,
        input: ToolInput,
    ) -> ToolsResult<ToolOutput> {
        let result = self.executor.execute_tool(plugin, context.clone(), input).await?;

        // Store in history
        let mut history = self.execution_history.lock().await;
        let user_history = history.entry(context.user_id.clone()).or_insert_with(Vec::new);
        user_history.push(result.clone());

        // Limit history size
        if user_history.len() > 100 {
            user_history.remove(0);
        }

        Ok(result)
    }

    /// Get execution history for a user
    pub async fn get_execution_history(&self, user_id: &str) -> Vec<ToolOutput> {
        let history = self.execution_history.lock().await;
        history.get(user_id).cloned().unwrap_or_default()
    }

    /// Get execution statistics
    pub async fn get_stats(&self) -> ExecutionStats {
        self.executor.get_stats().await
    }

    /// Cancel execution
    pub async fn cancel_execution(&self, execution_id: &str) -> ToolsResult<()> {
        self.executor.cancel_execution(execution_id).await
    }
}

impl Default for ExecutionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tool_plugin::EchoTool;
    use std::time::Duration;

    fn create_test_context() -> ToolContext {
        ToolContext {
            tool_id: "echo".to_string(),
            session_id: "test_session".to_string(),
            user_id: "test_user".to_string(),
            execution_id: "test_execution".to_string(),
            parent_execution_id: None,
            start_time: chrono::Utc::now(),
            timeout_seconds: Some(30),
            resource_limits: Default::default(),
            environment: HashMap::new(),
        }
    }

    fn create_test_input() -> ToolInput {
        ToolInput {
            parameters: HashMap::from([
                ("message".to_string(), serde_json::json!("test message")),
            ]),
            files: vec![],
            stdin: None,
        }
    }

    #[tokio::test]
    async fn test_tool_executor() {
        let executor = ToolExecutor::new();
        let tool = EchoTool::new();
        let context = create_test_context();
        let input = create_test_input();

        let result = executor.execute_tool(&tool, context, input).await.unwrap();

        assert!(result.success);
        assert_eq!(result.stdout, Some("test message".to_string()));
        assert!(result.execution_time_ms > 0);
    }

    #[tokio::test]
    async fn test_execution_timeout() {
        let executor = ToolExecutor::new();

        // Create a slow tool for testing timeout
        struct SlowTool;
        #[async_trait]
        impl ToolPlugin for SlowTool {
            fn metadata(&self) -> &ToolMetadata {
                unimplemented!()
            }

            async fn execute(&self, _context: &ToolContext, _input: ToolInput) -> ToolsResult<ToolOutput> {
                tokio::time::sleep(Duration::from_secs(2)).await;
                Ok(ToolOutput {
                    success: true,
                    exit_code: Some(0),
                    stdout: Some("done".to_string()),
                    stderr: None,
                    files: vec![],
                    metadata: HashMap::new(),
                    execution_time_ms: 2000,
                    resource_usage: ResourceUsage {
                        memory_mb_peak: 10,
                        cpu_percent_avg: 5.0,
                        execution_time_ms: 2000,
                        io_operations: 0,
                    },
                })
            }
        }

        let tool = SlowTool;
        let mut context = create_test_context();
        context.timeout_seconds = Some(1); // 1 second timeout
        let input = create_test_input();

        let result = executor.execute_tool(&tool, context, input).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), ToolsError::Timeout(_)));
    }

    #[tokio::test]
    async fn test_execution_manager() {
        let manager = ExecutionManager::new();
        let tool = EchoTool::new();
        let context = create_test_context();
        let input = create_test_input();

        let result = manager.execute_and_record(&tool, context, input).await.unwrap();

        assert!(result.success);

        // Check history
        let history = manager.get_execution_history("test_user").await;
        assert_eq!(history.len(), 1);
        assert!(history[0].success);
    }

    #[tokio::test]
    async fn test_execution_stats() {
        let executor = ToolExecutor::new();
        let stats = executor.get_stats().await;

        assert_eq!(stats.total_executions, 0);
        assert_eq!(stats.successful_executions, 0);
        assert_eq!(stats.failed_executions, 0);
    }
}
