//! Common types for Sira Tools

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Tool metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMetadata {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub capabilities: Vec<String>,
    pub dependencies: Vec<String>,
    pub config_schema: serde_json::Value,
}

/// Tool execution context
#[derive(Debug, Clone)]
pub struct ToolContext {
    pub tool_id: String,
    pub session_id: String,
    pub user_id: String,
    pub execution_id: String,
    pub parent_execution_id: Option<String>,
    pub start_time: DateTime<Utc>,
    pub timeout_seconds: Option<u64>,
    pub resource_limits: ResourceLimits,
    pub environment: HashMap<String, String>,
}

/// Resource limits for tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_mb: Option<u64>,
    pub max_cpu_percent: Option<u32>,
    pub max_execution_time_seconds: Option<u64>,
    pub max_concurrent_executions: Option<u32>,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            max_memory_mb: Some(512),
            max_cpu_percent: Some(50),
            max_execution_time_seconds: Some(300), // 5 minutes
            max_concurrent_executions: Some(10),
        }
    }
}

/// Tool input parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInput {
    pub parameters: HashMap<String, serde_json::Value>,
    pub files: Vec<ToolFile>,
    pub stdin: Option<String>,
}

/// Tool output result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolOutput {
    pub success: bool,
    pub exit_code: Option<i32>,
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub files: Vec<ToolFile>,
    pub metadata: HashMap<String, serde_json::Value>,
    pub execution_time_ms: u64,
    pub resource_usage: ResourceUsage,
}

/// File used in tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFile {
    pub name: String,
    pub content: Vec<u8>,
    pub content_type: String,
    pub size: u64,
}

/// Resource usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub memory_mb_peak: u64,
    pub cpu_percent_avg: f32,
    pub execution_time_ms: u64,
    pub io_operations: u64,
}

/// Workflow definition for tool orchestration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub steps: Vec<WorkflowStep>,
    pub variables: HashMap<String, serde_json::Value>,
    pub error_handling: ErrorHandlingStrategy,
}

/// Workflow step definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub name: String,
    pub tool_id: String,
    pub input_mapping: HashMap<String, String>, // Maps workflow variables to tool inputs
    pub output_mapping: HashMap<String, String>, // Maps tool outputs to workflow variables
    pub conditions: Vec<ExecutionCondition>,
    pub retry_policy: RetryPolicy,
}

/// Execution condition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionCondition {
    pub variable: String,
    pub operator: ConditionOperator,
    pub value: serde_json::Value,
}

/// Condition operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConditionOperator {
    Equals,
    NotEquals,
    GreaterThan,
    LessThan,
    Contains,
    NotContains,
    Exists,
    NotExists,
}

/// Error handling strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorHandlingStrategy {
    StopOnError,
    ContinueOnError,
    RetryOnError { max_retries: u32, backoff_seconds: u64 },
    Fallback { fallback_step_id: String },
}

/// Retry policy for individual steps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub backoff_multiplier: f64,
    pub max_backoff_seconds: u64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            backoff_multiplier: 2.0,
            max_backoff_seconds: 300,
        }
    }
}

/// Workflow execution state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub id: String,
    pub workflow_id: String,
    pub status: WorkflowStatus,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub current_step: Option<String>,
    pub variables: HashMap<String, serde_json::Value>,
    pub step_results: Vec<StepResult>,
    pub error_message: Option<String>,
}

/// Workflow execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum WorkflowStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Individual step execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepResult {
    pub step_id: String,
    pub status: StepStatus,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub tool_output: Option<ToolOutput>,
    pub error_message: Option<String>,
    pub attempt_count: u32,
}

/// Step execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StepStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
    Retrying,
}

/// Tool marketplace entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolMarketplaceEntry {
    pub tool_id: String,
    pub metadata: ToolMetadata,
    pub rating: f64,
    pub download_count: u64,
    pub tags: Vec<String>,
    pub publisher: String,
    pub verified: bool,
    pub price_per_execution: Option<f64>,
}

/// Tool execution sandbox configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxConfig {
    pub enabled: bool,
    pub isolation_level: IsolationLevel,
    pub allowed_syscalls: Vec<String>,
    pub network_access: bool,
    pub file_access: FileAccessPolicy,
    pub resource_limits: ResourceLimits,
}

/// Isolation levels for sandboxing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum IsolationLevel {
    None,
    Process,
    Container,
    Vm,
}

/// File access policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileAccessPolicy {
    None,
    ReadOnly { allowed_paths: Vec<String> },
    ReadWrite { allowed_paths: Vec<String> },
    Full,
}
