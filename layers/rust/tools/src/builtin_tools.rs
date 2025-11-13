//! Built-in Tools for Sira Tools

use crate::{ToolPlugin, ToolContext, ToolInput, ToolOutput, ToolMetadata, ToolsResult, ResourceUsage};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::debug;
use chrono::Utc;

/// Calculator tool for mathematical operations
pub struct CalculatorTool {
    metadata: ToolMetadata,
}

impl CalculatorTool {
    pub fn new() -> Self {
        Self {
            metadata: ToolMetadata {
                id: "calculator".to_string(),
                name: "Calculator".to_string(),
                version: "1.0.0".to_string(),
                description: "Performs mathematical calculations".to_string(),
                author: "Sira Team".to_string(),
                tags: vec!["math".to_string(), "calculation".to_string()],
                created_at: Utc::now(),
                updated_at: Utc::now(),
                capabilities: vec!["add".to_string(), "subtract".to_string(), "multiply".to_string(), "divide".to_string()],
                dependencies: vec![],
                config_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "precision": {
                            "type": "integer",
                            "description": "Decimal precision for results"
                        }
                    }
                }),
            },
        }
    }
}

#[async_trait]
impl ToolPlugin for CalculatorTool {
    fn metadata(&self) -> &ToolMetadata {
        &self.metadata
    }

    async fn execute(&self, context: &ToolContext, input: ToolInput) -> ToolsResult<ToolOutput> {
        debug!("Executing calculator tool");

        let operation = input.parameters
            .get("operation")
            .and_then(|v| v.as_str())
            .unwrap_or("add");

        let a: f64 = input.parameters
            .get("a")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let b: f64 = input.parameters
            .get("b")
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        let result = match operation {
            "add" => a + b,
            "subtract" => a - b,
            "multiply" => a * b,
            "divide" => {
                if b == 0.0 {
                    return Err(crate::ToolsError::Validation("Division by zero".to_string()));
                }
                a / b
            }
            _ => return Err(crate::ToolsError::Validation(format!("Unknown operation: {}", operation))),
        };

        let precision = input.parameters
            .get("precision")
            .and_then(|v| v.as_u64())
            .unwrap_or(2) as usize;

        let formatted_result = format!("{:.precision$}", result, precision = precision);

        Ok(ToolOutput {
            success: true,
            exit_code: Some(0),
            stdout: Some(formatted_result),
            stderr: None,
            files: vec![],
            metadata: HashMap::new(),
            execution_time_ms: 1,
            resource_usage: ResourceUsage {
                memory_mb_peak: 1,
                cpu_percent_avg: 0.1,
                execution_time_ms: 1,
                io_operations: 0,
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_calculator_tool() {
        let tool = CalculatorTool::new();
        let context = ToolContext {
            tool_id: "calculator".to_string(),
            session_id: "test".to_string(),
            user_id: "test_user".to_string(),
            execution_id: "test_exec".to_string(),
            parent_execution_id: None,
            start_time: Utc::now(),
            timeout_seconds: Some(30),
            resource_limits: Default::default(),
            environment: HashMap::new(),
        };

        let input = ToolInput {
            parameters: HashMap::from([
                ("operation".to_string(), serde_json::json!("add")),
                ("a".to_string(), serde_json::json!(10.5)),
                ("b".to_string(), serde_json::json!(5.2)),
            ]),
            files: vec![],
            stdin: None,
        };

        let result = tool.execute(&context, input).await.unwrap();
        assert!(result.success);
        assert_eq!(result.stdout, Some("15.70".to_string()));
    }
}
