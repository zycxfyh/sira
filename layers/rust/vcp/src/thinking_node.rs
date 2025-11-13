//! Thinking Node for VCP

use crate::{VcpResult, VcpError, ThinkingContext, ReasoningQuality};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use tracing::{debug, info};

/// Thinking node - fundamental unit of reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingNode {
    pub id: String,
    pub node_type: NodeType,
    pub content: NodeContent,
    pub confidence: f64,
    pub quality: ReasoningQuality,
    pub metadata: HashMap<String, serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub executed_at: Option<DateTime<Utc>>,
    pub execution_time_ms: Option<u64>,
    pub parent_id: Option<String>,
    pub children_ids: Vec<String>,
    pub prerequisites: Vec<String>, // Other node IDs that must complete first
    pub dependencies: Vec<String>,  // Data dependencies
}

/// Types of thinking nodes
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum NodeType {
    Input,           // Initial input processing
    Analysis,        // Data analysis and pattern recognition
    Synthesis,       // Combining multiple inputs
    Evaluation,      // Assessing quality and validity
    Generation,      // Creating new ideas or solutions
    Critique,        // Critical evaluation and feedback
    MetaAnalysis,    // Analyzing the reasoning process itself
    Decision,        // Making choices between alternatives
    Execution,       // Executing actions or plans
    Reflection,      // Reflecting on the process and outcomes
}

/// Content of a thinking node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeContent {
    Text(String),
    Structured {
        title: String,
        content: String,
        structure_type: String,
    },
    Data {
        data_type: String,
        value: serde_json::Value,
    },
    Question {
        question: String,
        context: String,
        expected_answer_type: String,
    },
    Hypothesis {
        statement: String,
        evidence: Vec<String>,
        confidence: f64,
    },
    Decision {
        options: Vec<String>,
        criteria: Vec<String>,
        chosen_option: Option<String>,
    },
    Action {
        action_type: String,
        parameters: HashMap<String, serde_json::Value>,
        expected_outcome: String,
    },
}

/// Node execution trait
#[async_trait]
pub trait NodeExecutor: Send + Sync {
    /// Execute a thinking node
    async fn execute_node(&self, node: &ThinkingNode, context: &ThinkingContext) -> VcpResult<NodeExecutionResult>;

    /// Get supported node types
    fn supported_types(&self) -> Vec<NodeType>;

    /// Estimate execution cost
    fn estimate_cost(&self, node: &ThinkingNode) -> ExecutionCost;
}

/// Execution result of a node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeExecutionResult {
    pub node_id: String,
    pub success: bool,
    pub output: Option<NodeContent>,
    pub confidence: f64,
    pub quality_improvement: f64,
    pub new_evidence: Vec<String>,
    pub suggested_next_steps: Vec<String>,
    pub execution_cost: ExecutionCost,
    pub error_message: Option<String>,
}

/// Execution cost estimation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionCost {
    pub time_estimate_ms: u64,
    pub cognitive_load: f64,      // 0.0 to 1.0
    pub resource_intensity: f64,  // 0.0 to 1.0
    pub api_calls_estimate: u32,
}

/// Node factory for creating different types of nodes
pub struct NodeFactory;

impl NodeFactory {
    /// Create an input processing node
    pub fn create_input_node(content: String, context: &ThinkingContext) -> ThinkingNode {
        ThinkingNode {
            id: format!("input_{}", uuid::Uuid::new_v4().simple()),
            node_type: NodeType::Input,
            content: NodeContent::Text(content),
            confidence: 1.0, // Input is assumed to be accurate
            quality: ReasoningQuality {
                logical_consistency: 1.0,
                completeness: 0.8,
                relevance: 1.0,
                novelty: 0.1,
                efficiency: 1.0,
                adaptability: 0.5,
            },
            metadata: HashMap::new(),
            created_at: Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: None,
            children_ids: Vec::new(),
            prerequisites: Vec::new(),
            dependencies: Vec::new(),
        }
    }

    /// Create an analysis node
    pub fn create_analysis_node(question: String, context: String, parent_id: String) -> ThinkingNode {
        ThinkingNode {
            id: format!("analysis_{}", uuid::Uuid::new_v4().simple()),
            node_type: NodeType::Analysis,
            content: NodeContent::Question {
                question,
                context,
                expected_answer_type: "analysis".to_string(),
            },
            confidence: 0.5,
            quality: ReasoningQuality {
                logical_consistency: 0.7,
                completeness: 0.3,
                relevance: 0.8,
                novelty: 0.6,
                efficiency: 0.7,
                adaptability: 0.8,
            },
            metadata: HashMap::new(),
            created_at: Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: Some(parent_id),
            children_ids: Vec::new(),
            prerequisites: Vec::new(),
            dependencies: Vec::new(),
        }
    }

    /// Create a synthesis node
    pub fn create_synthesis_node(sources: Vec<String>, goal: String) -> ThinkingNode {
        let content = format!("Synthesize information from {} sources to achieve: {}", sources.len(), goal);

        ThinkingNode {
            id: format!("synthesis_{}", uuid::Uuid::new_v4().simple()),
            node_type: NodeType::Synthesis,
            content: NodeContent::Structured {
                title: "Synthesis".to_string(),
                content,
                structure_type: "synthesis".to_string(),
            },
            confidence: 0.4,
            quality: ReasoningQuality {
                logical_consistency: 0.6,
                completeness: 0.2,
                relevance: 0.9,
                novelty: 0.8,
                efficiency: 0.5,
                adaptability: 0.9,
            },
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("sources".to_string(), serde_json::json!(sources));
                meta.insert("goal".to_string(), serde_json::json!(goal));
                meta
            },
            created_at: Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: None,
            children_ids: Vec::new(),
            prerequisites: sources,
            dependencies: Vec::new(),
        }
    }

    /// Create a decision node
    pub fn create_decision_node(options: Vec<String>, criteria: Vec<String>) -> ThinkingNode {
        ThinkingNode {
            id: format!("decision_{}", uuid::Uuid::new_v4().simple()),
            node_type: NodeType::Decision,
            content: NodeContent::Decision {
                options: options.clone(),
                criteria: criteria.clone(),
                chosen_option: None,
            },
            confidence: 0.3,
            quality: ReasoningQuality {
                logical_consistency: 0.8,
                completeness: 0.9,
                relevance: 0.9,
                novelty: 0.3,
                efficiency: 0.8,
                adaptability: 0.7,
            },
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("option_count".to_string(), serde_json::json!(options.len()));
                meta.insert("criteria_count".to_string(), serde_json::json!(criteria.len()));
                meta
            },
            created_at: Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: None,
            children_ids: Vec::new(),
            prerequisites: Vec::new(),
            dependencies: Vec::new(),
        }
    }

    /// Create a reflection node
    pub fn create_reflection_node(topic: String, insights: Vec<String>) -> ThinkingNode {
        let content = format!("Reflect on: {} with {} insights", topic, insights.len());

        ThinkingNode {
            id: format!("reflection_{}", uuid::Uuid::new_v4().simple()),
            node_type: NodeType::Reflection,
            content: NodeContent::Structured {
                title: "Reflection".to_string(),
                content,
                structure_type: "reflection".to_string(),
            },
            confidence: 0.6,
            quality: ReasoningQuality {
                logical_consistency: 0.9,
                completeness: 0.7,
                relevance: 1.0,
                novelty: 0.4,
                efficiency: 0.9,
                adaptability: 0.8,
            },
            metadata: {
                let mut meta = HashMap::new();
                meta.insert("topic".to_string(), serde_json::json!(topic));
                meta.insert("insights".to_string(), serde_json::json!(insights));
                meta
            },
            created_at: Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: None,
            children_ids: Vec::new(),
            prerequisites: Vec::new(),
            dependencies: Vec::new(),
        }
    }
}

/// Basic node executor implementation
pub struct BasicNodeExecutor;

#[async_trait]
impl NodeExecutor for BasicNodeExecutor {
    async fn execute_node(&self, node: &ThinkingNode, context: &ThinkingContext) -> VcpResult<NodeExecutionResult> {
        debug!("Executing node: {} of type {:?}", node.id, node.node_type);

        // Simulate execution time based on node type and complexity
        let execution_time = match node.node_type {
            NodeType::Input => 10,
            NodeType::Analysis => 500,
            NodeType::Synthesis => 800,
            NodeType::Evaluation => 300,
            NodeType::Generation => 600,
            NodeType::Critique => 400,
            NodeType::MetaAnalysis => 200,
            NodeType::Decision => 350,
            NodeType::Execution => 700,
            NodeType::Reflection => 250,
        };

        // Simulate processing
        tokio::time::sleep(std::time::Duration::from_millis(execution_time / 10)).await;

        let result = match &node.content {
            NodeContent::Text(content) => {
                NodeExecutionResult {
                    node_id: node.id.clone(),
                    success: true,
                    output: Some(NodeContent::Text(format!("Processed: {}", content))),
                    confidence: 0.8,
                    quality_improvement: 0.1,
                    new_evidence: vec!["text_processed".to_string()],
                    suggested_next_steps: vec!["analyze".to_string()],
                    execution_cost: ExecutionCost {
                        time_estimate_ms: execution_time,
                        cognitive_load: 0.3,
                        resource_intensity: 0.2,
                        api_calls_estimate: 0,
                    },
                    error_message: None,
                }
            }
            NodeContent::Question { question, .. } => {
                NodeExecutionResult {
                    node_id: node.id.clone(),
                    success: true,
                    output: Some(NodeContent::Text(format!("Answer to: {}", question))),
                    confidence: 0.7,
                    quality_improvement: 0.2,
                    new_evidence: vec!["question_answered".to_string()],
                    suggested_next_steps: vec!["verify".to_string()],
                    execution_cost: ExecutionCost {
                        time_estimate_ms: execution_time,
                        cognitive_load: 0.5,
                        resource_intensity: 0.4,
                        api_calls_estimate: 1,
                    },
                    error_message: None,
                }
            }
            _ => {
                NodeExecutionResult {
                    node_id: node.id.clone(),
                    success: true,
                    output: Some(NodeContent::Text("Generic processing completed".to_string())),
                    confidence: 0.6,
                    quality_improvement: 0.0,
                    new_evidence: vec![],
                    suggested_next_steps: vec!["continue".to_string()],
                    execution_cost: ExecutionCost {
                        time_estimate_ms: execution_time,
                        cognitive_load: 0.4,
                        resource_intensity: 0.3,
                        api_calls_estimate: 0,
                    },
                    error_message: None,
                }
            }
        };

        Ok(result)
    }

    fn supported_types(&self) -> Vec<NodeType> {
        vec![
            NodeType::Input,
            NodeType::Analysis,
            NodeType::Synthesis,
            NodeType::Evaluation,
            NodeType::Generation,
            NodeType::Critique,
            NodeType::MetaAnalysis,
            NodeType::Decision,
            NodeType::Execution,
            NodeType::Reflection,
        ]
    }

    fn estimate_cost(&self, node: &ThinkingNode) -> ExecutionCost {
        let base_time = match node.node_type {
            NodeType::Input => 50,
            NodeType::Analysis => 1000,
            NodeType::Synthesis => 1500,
            NodeType::Evaluation => 600,
            NodeType::Generation => 1200,
            NodeType::Critique => 800,
            NodeType::MetaAnalysis => 400,
            NodeType::Decision => 700,
            NodeType::Execution => 1400,
            NodeType::Reflection => 500,
        };

        ExecutionCost {
            time_estimate_ms: base_time,
            cognitive_load: 0.5,
            resource_intensity: 0.4,
            api_calls_estimate: if matches!(node.node_type, NodeType::Analysis | NodeType::Generation) { 1 } else { 0 },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_node_creation() {
        let context = ThinkingContext {
            session_id: "test".to_string(),
            user_id: "user".to_string(),
            task_type: "reasoning".to_string(),
            complexity_level: crate::ComplexityLevel::Simple,
            time_constraint: None,
            resource_limits: crate::ResourceLimits {
                max_depth: 5,
                max_branches: 3,
                max_iterations: 10,
                time_budget_ms: 5000,
                memory_budget_mb: 100,
            },
            domain_knowledge: HashMap::new(),
            emotional_state: crate::EmotionalState {
                confidence: 0.8,
                curiosity: 0.7,
                frustration: 0.1,
                satisfaction: 0.9,
            },
            cognitive_load: 0.3,
        };

        let input_node = NodeFactory::create_input_node("Test input".to_string(), &context);
        assert_eq!(input_node.node_type, NodeType::Input);
        assert!(matches!(input_node.content, NodeContent::Text(_)));

        let analysis_node = NodeFactory::create_analysis_node(
            "What is the meaning?".to_string(),
            "Test context".to_string(),
            input_node.id.clone(),
        );
        assert_eq!(analysis_node.node_type, NodeType::Analysis);
        assert_eq!(analysis_node.parent_id, Some(input_node.id));
    }

    #[tokio::test]
    async fn test_basic_executor() {
        let executor = BasicNodeExecutor;
        let context = ThinkingContext {
            session_id: "test".to_string(),
            user_id: "user".to_string(),
            task_type: "reasoning".to_string(),
            complexity_level: crate::ComplexityLevel::Simple,
            time_constraint: None,
            resource_limits: crate::ResourceLimits {
                max_depth: 5,
                max_branches: 3,
                max_iterations: 10,
                time_budget_ms: 5000,
                memory_budget_mb: 100,
            },
            domain_knowledge: HashMap::new(),
            emotional_state: crate::EmotionalState {
                confidence: 0.8,
                curiosity: 0.7,
                frustration: 0.1,
                satisfaction: 0.9,
            },
            cognitive_load: 0.3,
        };

        let node = NodeFactory::create_input_node("Test content".to_string(), &context);

        let result = executor.execute_node(&node, &context).await.unwrap();
        assert!(result.success);
        assert!(result.confidence > 0.0);
        assert!(result.execution_cost.time_estimate_ms > 0);
    }
}
