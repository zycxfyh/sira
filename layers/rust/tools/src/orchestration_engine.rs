//! Orchestration Engine for Sira Tools

use crate::{ToolsResult, ToolsError, WorkflowDefinition, WorkflowExecution, WorkflowStatus, StepResult, StepStatus, ToolPlugin, ToolContext, ToolInput, ToolOutput, ToolRegistry};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug, warn, error};
use chrono::{DateTime, Utc};

/// Workflow orchestrator for executing complex tool workflows
pub struct OrchestrationEngine {
    registry: Arc<ToolRegistry>,
    workflows: RwLock<HashMap<String, WorkflowDefinition>>,
    active_executions: RwLock<HashMap<String, WorkflowExecution>>,
}

impl OrchestrationEngine {
    /// Create a new orchestration engine
    pub fn new(registry: Arc<ToolRegistry>) -> Self {
        Self {
            registry,
            workflows: RwLock::new(HashMap::new()),
            active_executions: RwLock::new(HashMap::new()),
        }
    }

    /// Register a workflow definition
    pub async fn register_workflow(&self, workflow: WorkflowDefinition) -> ToolsResult<()> {
        let mut workflows = self.workflows.write().await;
        let workflow_id = workflow.id.clone();

        workflows.insert(workflow_id.clone(), workflow);
        info!("Registered workflow: {}", workflow_id);

        Ok(())
    }

    /// Execute a workflow
    pub async fn execute_workflow(&self, workflow_id: &str, initial_variables: HashMap<String, serde_json::Value>) -> ToolsResult<String> {
        let workflows = self.workflows.read().await;
        let workflow = workflows.get(workflow_id)
            .ok_or_else(|| ToolsError::Orchestration(format!("Workflow '{}' not found", workflow_id)))?;

        let execution_id = format!("exec_{}_{}", workflow_id, chrono::Utc::now().timestamp());

        let execution = WorkflowExecution {
            id: execution_id.clone(),
            workflow_id: workflow_id.to_string(),
            status: WorkflowStatus::Pending,
            start_time: Utc::now(),
            end_time: None,
            current_step: None,
            variables: initial_variables,
            step_results: vec![],
            error_message: None,
        };

        {
            let mut active_executions = self.active_executions.write().await;
            active_executions.insert(execution_id.clone(), execution);
        }

        // Start execution in background
        let engine = self.clone();
        let execution_id_clone = execution_id.clone();
        tokio::spawn(async move {
            if let Err(e) = engine.execute_workflow_inner(&execution_id_clone).await {
                error!("Workflow execution failed: {} - {:?}", execution_id_clone, e);
            }
        });

        Ok(execution_id)
    }

    /// Execute workflow steps
    async fn execute_workflow_inner(&self, execution_id: &str) -> ToolsResult<()> {
        let mut execution = {
            let mut active_executions = self.active_executions.write().await;
            let exec = active_executions.get_mut(execution_id)
                .ok_or_else(|| ToolsError::Orchestration(format!("Execution '{}' not found", execution_id)))?;

            exec.status = WorkflowStatus::Running;
            exec.clone()
        };

        let workflows = self.workflows.read().await;
        let workflow = workflows.get(&execution.workflow_id)
            .ok_or_else(|| ToolsError::Orchestration(format!("Workflow '{}' not found", execution.workflow_id)))?;

        debug!("Starting workflow execution: {}", execution_id);

        for step in &workflow.steps {
            // Check if execution should continue
            {
                let active_executions = self.active_executions.read().await;
                if let Some(current_exec) = active_executions.get(execution_id) {
                    if matches!(current_exec.status, WorkflowStatus::Cancelled) {
                        break;
                    }
                }
            }

            execution.current_step = Some(step.id.clone());

            match self.execute_step(&mut execution, step).await {
                Ok(_) => {
                    debug!("Step '{}' completed successfully", step.id);
                }
                Err(e) => {
                    warn!("Step '{}' failed: {:?}", step.id, e);

                    // Handle error based on workflow error strategy
                    match &workflow.error_handling {
                        crate::ErrorHandlingStrategy::StopOnError => {
                            execution.status = WorkflowStatus::Failed;
                            execution.error_message = Some(e.to_string());
                            break;
                        }
                        crate::ErrorHandlingStrategy::ContinueOnError => {
                            // Continue to next step
                            continue;
                        }
                        crate::ErrorHandlingStrategy::RetryOnError { .. } => {
                            // For now, just continue - retry logic would be more complex
                            continue;
                        }
                        crate::ErrorHandlingStrategy::Fallback { .. } => {
                            // For now, just continue - fallback logic would be more complex
                            continue;
                        }
                    }
                }
            }
        }

        // Mark execution as completed
        execution.status = WorkflowStatus::Completed;
        execution.end_time = Some(Utc::now());
        execution.current_step = None;

        let mut active_executions = self.active_executions.write().await;
        active_executions.insert(execution_id.to_string(), execution);

        info!("Workflow execution completed: {}", execution_id);
        Ok(())
    }

    /// Execute a single workflow step
    async fn execute_step(&self, execution: &mut WorkflowExecution, step: &crate::WorkflowStep) -> ToolsResult<()> {
        debug!("Executing step: {}", step.id);

        // Get tool plugin
        let tool = self.registry.get_tool(&step.tool_id)
            .ok_or_else(|| ToolsError::ToolNotFound(format!("Tool '{}' not found for step '{}'", step.tool_id, step.id)))?;

        // Map workflow variables to tool inputs
        let tool_input = self.map_variables_to_input(&execution.variables, &step.input_mapping)?;

        // Create tool context
        let context = ToolContext {
            tool_id: step.tool_id.clone(),
            session_id: execution.id.clone(),
            user_id: "workflow_user".to_string(), // In real implementation, this would be the actual user
            execution_id: format!("{}_{}", execution.id, step.id),
            parent_execution_id: Some(execution.id.clone()),
            start_time: Utc::now(),
            timeout_seconds: Some(300), // 5 minutes default
            resource_limits: Default::default(),
            environment: HashMap::new(),
        };

        // Execute tool (in a real implementation, this would use the ToolExecutor)
        // For now, we'll simulate execution
        let tool_output = ToolOutput {
            success: true,
            exit_code: Some(0),
            stdout: Some(format!("Step '{}' executed successfully", step.id)),
            stderr: None,
            files: vec![],
            metadata: HashMap::new(),
            execution_time_ms: 100,
            resource_usage: crate::ResourceUsage {
                memory_mb_peak: 10,
                cpu_percent_avg: 5.0,
                execution_time_ms: 100,
                io_operations: 0,
            },
        };

        // Map tool outputs to workflow variables
        self.map_output_to_variables(&tool_output, &mut execution.variables, &step.output_mapping)?;

        // Record step result
        let step_result = StepResult {
            step_id: step.id.clone(),
            status: StepStatus::Completed,
            start_time: context.start_time,
            end_time: Some(Utc::now()),
            tool_output: Some(tool_output),
            error_message: None,
            attempt_count: 1,
        };

        execution.step_results.push(step_result);

        Ok(())
    }

    /// Map workflow variables to tool input parameters
    fn map_variables_to_input(&self, variables: &HashMap<String, serde_json::Value>, mapping: &HashMap<String, String>) -> ToolsResult<ToolInput> {
        let mut parameters = HashMap::new();

        for (input_param, var_name) in mapping {
            if let Some(value) = variables.get(var_name) {
                parameters.insert(input_param.clone(), value.clone());
            } else {
                return Err(ToolsError::Orchestration(format!("Variable '{}' not found for input parameter '{}'", var_name, input_param)));
            }
        }

        Ok(ToolInput {
            parameters,
            files: vec![],
            stdin: None,
        })
    }

    /// Map tool outputs to workflow variables
    fn map_output_to_variables(&self, output: &ToolOutput, variables: &mut HashMap<String, serde_json::Value>, mapping: &HashMap<String, String>) -> ToolsResult<()> {
        for (var_name, output_field) in mapping {
            let value = match output_field.as_str() {
                "stdout" => output.stdout.clone().map(serde_json::Value::String).unwrap_or(serde_json::Value::Null),
                "stderr" => output.stderr.clone().map(serde_json::Value::String).unwrap_or(serde_json::Value::Null),
                "exit_code" => output.exit_code.map(|code| serde_json::json!(code)).unwrap_or(serde_json::Value::Null),
                _ => serde_json::Value::Null,
            };

            variables.insert(var_name.clone(), value);
        }

        Ok(())
    }

    /// Get workflow execution status
    pub async fn get_execution_status(&self, execution_id: &str) -> Option<WorkflowExecution> {
        let active_executions = self.active_executions.read().await;
        active_executions.get(execution_id).cloned()
    }

    /// Cancel workflow execution
    pub async fn cancel_execution(&self, execution_id: &str) -> ToolsResult<()> {
        let mut active_executions = self.active_executions.write().await;

        if let Some(execution) = active_executions.get_mut(execution_id) {
            execution.status = WorkflowStatus::Cancelled;
            execution.end_time = Some(Utc::now());
            info!("Cancelled workflow execution: {}", execution_id);
            Ok(())
        } else {
            Err(ToolsError::Orchestration(format!("Execution '{}' not found", execution_id)))
        }
    }

    /// List registered workflows
    pub async fn list_workflows(&self) -> Vec<String> {
        let workflows = self.workflows.read().await;
        workflows.keys().cloned().collect()
    }

    /// Get workflow definition
    pub async fn get_workflow(&self, workflow_id: &str) -> Option<WorkflowDefinition> {
        let workflows = self.workflows.read().await;
        workflows.get(workflow_id).cloned()
    }

    /// Get active executions
    pub async fn get_active_executions(&self) -> Vec<String> {
        let active_executions = self.active_executions.read().await;
        active_executions.keys().cloned().collect()
    }
}

impl Clone for OrchestrationEngine {
    fn clone(&self) -> Self {
        Self {
            registry: Arc::clone(&self.registry),
            workflows: RwLock::new(HashMap::new()), // Don't clone workflows for simplicity
            active_executions: RwLock::new(HashMap::new()), // Don't clone executions
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ToolMetadata;
    use std::sync::Arc;

    fn create_test_workflow() -> WorkflowDefinition {
        WorkflowDefinition {
            id: "test_workflow".to_string(),
            name: "Test Workflow".to_string(),
            description: "A test workflow".to_string(),
            version: "1.0.0".to_string(),
            steps: vec![crate::WorkflowStep {
                id: "step1".to_string(),
                name: "Step 1".to_string(),
                tool_id: "echo".to_string(),
                input_mapping: HashMap::from([
                    ("message".to_string(), "input_message".to_string()),
                ]),
                output_mapping: HashMap::from([
                    ("result".to_string(), "stdout".to_string()),
                ]),
                conditions: vec![],
                retry_policy: Default::default(),
            }],
            variables: HashMap::new(),
            error_handling: crate::ErrorHandlingStrategy::StopOnError,
        }
    }

    #[tokio::test]
    async fn test_orchestration_engine() {
        let registry = Arc::new(ToolRegistry::new());
        let engine = OrchestrationEngine::new(Arc::clone(&registry));

        // Register workflow
        let workflow = create_test_workflow();
        engine.register_workflow(workflow).await.unwrap();

        // List workflows
        let workflows = engine.list_workflows().await;
        assert_eq!(workflows.len(), 1);
        assert!(workflows.contains(&"test_workflow".to_string()));

        // Get workflow
        let retrieved = engine.get_workflow("test_workflow").await.unwrap();
        assert_eq!(retrieved.id, "test_workflow");
    }
}
