//! Thinking Chain for VCP

use crate::{VcpResult, VcpError, ThinkingNode, NodeType, ChainExecutionResult, ExecutionStats};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use chrono::{DateTime, Utc};
use tracing::{debug, info, warn};

/// Thinking chain - sequence of interconnected thinking nodes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingChain {
    pub id: String,
    pub name: String,
    pub description: String,
    pub nodes: HashMap<String, ThinkingNode>,
    pub root_node_id: String,
    pub current_node_id: Option<String>,
    pub status: ChainStatus,
    pub quality_threshold: f64,
    pub max_depth: u32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub execution_stats: ExecutionStats,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Status of a thinking chain
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ChainStatus {
    Created,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

/// Chain execution state
#[derive(Debug, Clone)]
pub struct ChainExecutionState {
    pub chain: ThinkingChain,
    pub execution_queue: VecDeque<String>, // Node IDs to execute
    pub completed_nodes: HashMap<String, bool>,
    pub failed_nodes: Vec<String>,
    pub current_depth: u32,
    pub total_quality_score: f64,
    pub adaptation_events: Vec<String>,
}

impl ThinkingChain {
    /// Create a new thinking chain
    pub fn new(name: String, description: String, root_content: String) -> Self {
        let root_node = ThinkingNode {
            id: format!("root_{}", uuid::Uuid::new_v4().simple()),
            node_type: NodeType::Input,
            content: crate::NodeContent::Text(root_content),
            confidence: 1.0,
            quality: crate::ReasoningQuality {
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
        };

        let mut nodes = HashMap::new();
        nodes.insert(root_node.id.clone(), root_node.clone());

        Self {
            id: format!("chain_{}", uuid::Uuid::new_v4().simple()),
            name,
            description,
            nodes,
            root_node_id: root_node.id,
            current_node_id: None,
            status: ChainStatus::Created,
            quality_threshold: 0.7,
            max_depth: 10,
            created_at: Utc::now(),
            started_at: None,
            completed_at: None,
            execution_stats: ExecutionStats {
                total_nodes: 1,
                executed_nodes: 0,
                skipped_nodes: 0,
                failed_nodes: 0,
                max_depth_reached: 0,
                total_execution_time_ms: 0,
                memory_peak_mb: 0,
                api_calls_made: 0,
            },
            metadata: HashMap::new(),
        }
    }

    /// Add a node to the chain
    pub fn add_node(&mut self, node: ThinkingNode) -> VcpResult<()> {
        if self.nodes.contains_key(&node.id) {
            return Err(VcpError::ThinkingChain(format!("Node {} already exists", node.id)));
        }

        // Validate parent exists if specified
        if let Some(parent_id) = &node.parent_id {
            if !self.nodes.contains_key(parent_id) {
                return Err(VcpError::ThinkingChain(format!("Parent node {} does not exist", parent_id)));
            }
            // Add this node as child to parent
            if let Some(parent) = self.nodes.get_mut(parent_id) {
                parent.children_ids.push(node.id.clone());
            }
        }

        self.nodes.insert(node.id.clone(), node);
        self.execution_stats.total_nodes += 1;

        Ok(())
    }

    /// Get a node by ID
    pub fn get_node(&self, node_id: &str) -> Option<&ThinkingNode> {
        self.nodes.get(node_id)
    }

    /// Get a mutable reference to a node
    pub fn get_node_mut(&mut self, node_id: &str) -> Option<&mut ThinkingNode> {
        self.nodes.get_mut(node_id)
    }

    /// Get all leaf nodes (nodes with no children)
    pub fn get_leaf_nodes(&self) -> Vec<&ThinkingNode> {
        self.nodes.values()
            .filter(|node| node.children_ids.is_empty())
            .collect()
    }

    /// Get nodes ready for execution (all prerequisites met)
    pub fn get_executable_nodes(&self, executed_nodes: &HashMap<String, bool>) -> Vec<String> {
        self.nodes.keys()
            .filter(|node_id| {
                let node = &self.nodes[*node_id];
                // Node not yet executed
                !executed_nodes.contains_key(*node_id) &&
                // All prerequisites are executed
                node.prerequisites.iter().all(|prereq| executed_nodes.contains_key(prereq))
            })
            .cloned()
            .collect()
    }

    /// Calculate overall chain quality
    pub fn calculate_quality(&self) -> f64 {
        if self.nodes.is_empty() {
            return 0.0;
        }

        let total_quality: f64 = self.nodes.values()
            .map(|node| node.quality.logical_consistency * node.confidence)
            .sum();

        total_quality / self.nodes.len() as f64
    }

    /// Get chain depth
    pub fn get_depth(&self) -> u32 {
        self.get_node_depth(&self.root_node_id, &mut HashMap::new())
    }

    /// Get depth of a specific node
    fn get_node_depth(&self, node_id: &str, visited: &mut HashMap<String, u32>) -> u32 {
        if let Some(&depth) = visited.get(node_id) {
            return depth;
        }

        let node = match self.nodes.get(node_id) {
            Some(n) => n,
            None => return 0,
        };

        if node.children_ids.is_empty() {
            return 1;
        }

        let max_child_depth = node.children_ids.iter()
            .map(|child_id| self.get_node_depth(child_id, visited))
            .max()
            .unwrap_or(0);

        let depth = max_child_depth + 1;
        visited.insert(node_id.to_string(), depth);
        depth
    }

    /// Validate chain structure
    pub fn validate(&self) -> VcpResult<()> {
        // Check that root node exists
        if !self.nodes.contains_key(&self.root_node_id) {
            return Err(VcpError::ThinkingChain("Root node does not exist".to_string()));
        }

        // Check that all referenced parents exist
        for node in self.nodes.values() {
            if let Some(parent_id) = &node.parent_id {
                if !self.nodes.contains_key(parent_id) {
                    return Err(VcpError::ThinkingChain(format!("Parent node {} does not exist", parent_id)));
                }
            }

            // Check prerequisites exist
            for prereq in &node.prerequisites {
                if !self.nodes.contains_key(prereq) {
                    return Err(VcpError::ThinkingChain(format!("Prerequisite node {} does not exist", prereq)));
                }
            }
        }

        // Check for cycles (simplified check)
        if self.get_depth() > self.max_depth {
            return Err(VcpError::ThinkingChain(format!("Chain depth {} exceeds maximum {}", self.get_depth(), self.max_depth)));
        }

        Ok(())
    }

    /// Export chain as JSON
    pub fn to_json(&self) -> VcpResult<String> {
        serde_json::to_string_pretty(self)
            .map_err(|e| VcpError::ThinkingChain(format!("Failed to serialize chain: {}", e)))
    }

    /// Import chain from JSON
    pub fn from_json(json: &str) -> VcpResult<Self> {
        serde_json::from_str(json)
            .map_err(|e| VcpError::ThinkingChain(format!("Failed to deserialize chain: {}", e)))
    }
}

impl ChainExecutionState {
    /// Create execution state for a chain
    pub fn new(chain: ThinkingChain) -> Self {
        let mut execution_queue = VecDeque::new();
        execution_queue.push_back(chain.root_node_id.clone());

        Self {
            chain,
            execution_queue,
            completed_nodes: HashMap::new(),
            failed_nodes: Vec::new(),
            current_depth: 0,
            total_quality_score: 0.0,
            adaptation_events: Vec::new(),
        }
    }

    /// Get next node to execute
    pub fn get_next_node(&mut self) -> Option<String> {
        // Find executable nodes
        let executable_nodes = self.chain.get_executable_nodes(&self.completed_nodes);

        // Prioritize by some heuristic (for now, just take first)
        if let Some(node_id) = executable_nodes.first() {
            self.execution_queue.retain(|id| id != node_id);
            Some(node_id.clone())
        } else {
            self.execution_queue.pop_front()
        }
    }

    /// Mark node as completed
    pub fn mark_completed(&mut self, node_id: &str, quality_score: f64) {
        self.completed_nodes.insert(node_id.to_string(), true);
        self.total_quality_score += quality_score;

        // Add newly executable nodes to queue
        let executable_nodes = self.chain.get_executable_nodes(&self.completed_nodes);
        for node_id in executable_nodes {
            if !self.execution_queue.contains(&node_id) {
                self.execution_queue.push_back(node_id);
            }
        }
    }

    /// Mark node as failed
    pub fn mark_failed(&mut self, node_id: &str) {
        self.failed_nodes.push(node_id.to_string());
        self.completed_nodes.insert(node_id.to_string(), false);
    }

    /// Check if execution is complete
    pub fn is_complete(&self) -> bool {
        let total_nodes = self.chain.nodes.len();
        let processed_nodes = self.completed_nodes.len();

        processed_nodes >= total_nodes
    }

    /// Get execution progress
    pub fn get_progress(&self) -> f64 {
        let total_nodes = self.chain.nodes.len() as f64;
        let processed_nodes = self.completed_nodes.len() as f64;

        if total_nodes == 0.0 {
            1.0
        } else {
            processed_nodes / total_nodes
        }
    }

    /// Get average quality score
    pub fn get_average_quality(&self) -> f64 {
        let completed_count = self.completed_nodes.len() as f64;
        if completed_count == 0.0 {
            0.0
        } else {
            self.total_quality_score / completed_count
        }
    }
}

/// Chain builder for fluent construction
pub struct ChainBuilder {
    chain: ThinkingChain,
}

impl ChainBuilder {
    /// Create a new chain builder
    pub fn new(name: String, description: String, root_content: String) -> Self {
        Self {
            chain: ThinkingChain::new(name, description, root_content),
        }
    }

    /// Add an analysis node
    pub fn add_analysis(mut self, question: String, context: String, parent_id: String) -> VcpResult<Self> {
        let node = crate::NodeFactory::create_analysis_node(question, context, parent_id);
        self.chain.add_node(node)?;
        Ok(self)
    }

    /// Add a synthesis node
    pub fn add_synthesis(mut self, sources: Vec<String>, goal: String) -> VcpResult<Self> {
        let node = crate::NodeFactory::create_synthesis_node(sources, goal);
        self.chain.add_node(node)?;
        Ok(self)
    }

    /// Add a decision node
    pub fn add_decision(mut self, options: Vec<String>, criteria: Vec<String>) -> VcpResult<Self> {
        let node = crate::NodeFactory::create_decision_node(options, criteria);
        self.chain.add_node(node)?;
        Ok(self)
    }

    /// Set quality threshold
    pub fn with_quality_threshold(mut self, threshold: f64) -> Self {
        self.chain.quality_threshold = threshold;
        self
    }

    /// Set maximum depth
    pub fn with_max_depth(mut self, depth: u32) -> Self {
        self.chain.max_depth = depth;
        self
    }

    /// Build the chain
    pub fn build(self) -> VcpResult<ThinkingChain> {
        self.chain.validate()?;
        Ok(self.chain)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chain_creation() {
        let chain = ThinkingChain::new(
            "Test Chain".to_string(),
            "A test thinking chain".to_string(),
            "Initial input".to_string(),
        );

        assert_eq!(chain.name, "Test Chain");
        assert_eq!(chain.nodes.len(), 1);
        assert!(chain.nodes.contains_key(&chain.root_node_id));
    }

    #[test]
    fn test_chain_builder() {
        let chain = ChainBuilder::new(
            "Built Chain".to_string(),
            "A built chain".to_string(),
            "Start here".to_string(),
        )
        .add_analysis(
            "What is this about?".to_string(),
            "Test context".to_string(),
            "root_00000000000000000000000000000000".to_string(),
        )
        .unwrap()
        .build()
        .unwrap();

        assert_eq!(chain.name, "Built Chain");
        assert!(chain.nodes.len() >= 2); // Root + analysis node
    }

    #[test]
    fn test_execution_state() {
        let chain = ThinkingChain::new(
            "Test".to_string(),
            "Test".to_string(),
            "Test".to_string(),
        );

        let mut state = ChainExecutionState::new(chain);

        assert!(!state.is_complete());
        assert_eq!(state.get_progress(), 0.0);

        // Simulate completion
        state.mark_completed("some_node", 0.8);

        assert_eq!(state.get_average_quality(), 0.8);
    }

    #[test]
    fn test_chain_validation() {
        let mut chain = ThinkingChain::new(
            "Test".to_string(),
            "Test".to_string(),
            "Test".to_string(),
        );

        // Valid chain should pass
        assert!(chain.validate().is_ok());

        // Add invalid node with non-existent parent
        let invalid_node = ThinkingNode {
            id: "invalid".to_string(),
            node_type: NodeType::Analysis,
            content: crate::NodeContent::Text("test".to_string()),
            confidence: 0.5,
            quality: crate::ReasoningQuality {
                logical_consistency: 0.5,
                completeness: 0.5,
                relevance: 0.5,
                novelty: 0.5,
                efficiency: 0.5,
                adaptability: 0.5,
            },
            metadata: HashMap::new(),
            created_at: Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: Some("nonexistent".to_string()),
            children_ids: Vec::new(),
            prerequisites: Vec::new(),
            dependencies: Vec::new(),
        };

        chain.add_node(invalid_node).unwrap();
        assert!(chain.validate().is_err());
    }
}
