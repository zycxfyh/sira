//! Recursive Engine for VCP

use crate::{VcpResult, VcpError, ThinkingChain, ChainExecutionState, NodeExecutor, NodeExecutionResult, ChainExecutionResult, ThinkingContext, MetacognitiveAssessment, RecommendedAction};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};
use tracing::{debug, info, warn, error};

/// Recursive reasoning engine
pub struct RecursiveEngine {
    node_executor: Arc<dyn NodeExecutor>,
    execution_history: Arc<Mutex<HashMap<String, Vec<ChainExecutionResult>>>>,
    metacognition_enabled: bool,
    max_recursion_depth: u32,
    adaptation_enabled: bool,
}

impl RecursiveEngine {
    /// Create a new recursive engine
    pub fn new(node_executor: Arc<dyn NodeExecutor>) -> Self {
        Self {
            node_executor,
            execution_history: Arc::new(Mutex::new(HashMap::new())),
            metacognition_enabled: true,
            max_recursion_depth: 10,
            adaptation_enabled: true,
        }
    }

    /// Execute a thinking chain with recursive reasoning
    pub async fn execute_chain(
        &self,
        chain: ThinkingChain,
        context: &ThinkingContext,
        recursion_depth: u32,
    ) -> VcpResult<ChainExecutionResult> {
        if recursion_depth > self.max_recursion_depth {
            return Err(VcpError::RecursiveReasoning(
                format!("Maximum recursion depth {} exceeded", self.max_recursion_depth)
            ));
        }

        info!("Executing chain {} at depth {}", chain.id, recursion_depth);

        let mut execution_state = ChainExecutionState::new(chain);
        let mut metacognitive_history = Vec::new();
        let start_time = std::time::Instant::now();

        // Execute nodes iteratively
        while !execution_state.is_complete() {
            // Metacognitive assessment
            if self.metacognition_enabled {
                let assessment = self.assess_progress(&execution_state, context).await?;
                metacognitive_history.push(assessment.clone());

                // Apply metacognitive interventions
                self.apply_metacognitive_actions(&assessment, &mut execution_state, context).await?;
            }

            // Get next node to execute
            let next_node_id = match execution_state.get_next_node() {
                Some(node_id) => node_id,
                None => break, // No more nodes to execute
            };

            // Execute node with timeout
            let execution_result = self.execute_node_with_timeout(
                &next_node_id,
                &execution_state.chain,
                context,
            ).await;

            match execution_result {
                Ok(result) => {
                    if result.success {
                        execution_state.mark_completed(&next_node_id, result.confidence);
                        debug!("Node {} completed successfully", next_node_id);
                    } else {
                        execution_state.mark_failed(&next_node_id);
                        warn!("Node {} failed: {:?}", next_node_id, result.error_message);

                        // Attempt recovery
                        if !self.attempt_recovery(&next_node_id, &mut execution_state, context).await? {
                            break; // Cannot recover, stop execution
                        }
                    }
                }
                Err(e) => {
                    execution_state.mark_failed(&next_node_id);
                    error!("Node {} execution error: {:?}", next_node_id, e);
                    break;
                }
            }

            // Check resource limits
            if self.check_resource_limits(context, start_time).await? {
                warn!("Resource limits exceeded, stopping execution");
                break;
            }
        }

        // Calculate final result
        let execution_time = start_time.elapsed();
        let final_quality = execution_state.get_average_quality();
        let progress = execution_state.get_progress();

        let result = ChainExecutionResult {
            chain_id: execution_state.chain.id.clone(),
            success: progress >= 0.8 && final_quality >= execution_state.chain.quality_threshold,
            final_answer: self.extract_final_answer(&execution_state),
            confidence: final_quality,
            quality_metrics: self.calculate_overall_quality(&execution_state),
            execution_stats: crate::ExecutionStats {
                total_nodes: execution_state.chain.nodes.len() as u64,
                executed_nodes: execution_state.completed_nodes.len() as u64,
                skipped_nodes: (execution_state.chain.nodes.len() - execution_state.completed_nodes.len()) as u64,
                failed_nodes: execution_state.failed_nodes.len() as u64,
                max_depth_reached: execution_state.current_depth,
                total_execution_time_ms: execution_time.as_millis() as u64,
                memory_peak_mb: 50, // Placeholder
                api_calls_made: 0,  // Placeholder
            },
            metacognitive_history,
            adaptation_log: execution_state.adaptation_events,
        };

        // Store in history
        self.store_execution_result(&result).await?;

        info!("Chain execution completed: success={}, quality={:.2}, progress={:.2}",
              result.success, result.confidence, progress);

        Ok(result)
    }

    /// Execute a single node with timeout
    async fn execute_node_with_timeout(
        &self,
        node_id: &str,
        chain: &ThinkingChain,
        context: &ThinkingContext,
    ) -> VcpResult<NodeExecutionResult> {
        let node = chain.get_node(node_id)
            .ok_or_else(|| VcpError::RecursiveReasoning(format!("Node {} not found", node_id)))?;

        let timeout_duration = context.resource_limits.time_budget_ms / 10; // Per-node timeout
        let timeout_duration = Duration::from_millis(timeout_duration.max(1000)); // Minimum 1 second

        match timeout(timeout_duration, self.node_executor.execute_node(node, context)).await {
            Ok(result) => result,
            Err(_) => Err(VcpError::RecursiveReasoning(format!("Node {} timed out", node_id))),
        }
    }

    /// Assess reasoning progress metacognitively
    async fn assess_progress(
        &self,
        state: &ChainExecutionState,
        context: &ThinkingContext,
    ) -> VcpResult<MetacognitiveAssessment> {
        let progress = state.get_progress();
        let quality = state.get_average_quality();
        let time_elapsed = std::time::Instant::now().elapsed().as_secs();

        // Calculate stuck probability (simplified)
        let stuck_probability = if progress < 0.1 && time_elapsed > 30 {
            0.8
        } else if progress < 0.3 && time_elapsed > 60 {
            0.6
        } else {
            0.1
        };

        // Determine quality trend (simplified)
        let quality_trend = if quality > 0.7 {
            crate::QualityTrend::Improving
        } else if quality < 0.5 {
            crate::QualityTrend::Declining
        } else {
            crate::QualityTrend::Stable
        };

        let mut recommended_actions = Vec::new();

        if stuck_probability > 0.7 {
            recommended_actions.push(RecommendedAction::ChangeStrategy);
        } else if quality < context.emotional_state.confidence * 0.8 {
            recommended_actions.push(RecommendedAction::AddHeuristic("confidence_boosting".to_string()));
        } else if state.current_depth > context.resource_limits.max_depth / 2 {
            recommended_actions.push(RecommendedAction::ReduceBranching);
        }

        Ok(MetacognitiveAssessment {
            current_confidence: quality,
            progress_rate: progress / time_elapsed.max(1) as f64,
            stuck_probability,
            quality_trend,
            resource_efficiency: 0.8, // Placeholder
            recommended_actions,
        })
    }

    /// Apply metacognitive interventions
    async fn apply_metacognitive_actions(
        &self,
        assessment: &MetacognitiveAssessment,
        state: &mut ChainExecutionState,
        context: &ThinkingContext,
    ) -> VcpResult<()> {
        for action in &assessment.recommended_actions {
            match action {
                RecommendedAction::ChangeStrategy => {
                    state.adaptation_events.push("Changed strategy due to being stuck".to_string());
                    // In a real implementation, this would switch to a different execution strategy
                }
                RecommendedAction::AddHeuristic(heuristic) => {
                    state.adaptation_events.push(format!("Added heuristic: {}", heuristic));
                    // Add new nodes or modify existing ones
                }
                RecommendedAction::ReduceBranching => {
                    state.adaptation_events.push("Reduced branching factor".to_string());
                    // Limit future node expansion
                }
                _ => {
                    // Handle other actions
                }
            }
        }

        Ok(())
    }

    /// Attempt recovery from failed node
    async fn attempt_recovery(
        &self,
        failed_node_id: &str,
        state: &mut ChainExecutionState,
        context: &ThinkingContext,
    ) -> VcpResult<bool> {
        // Simple recovery: try to create alternative path
        // In a real implementation, this would be more sophisticated

        state.adaptation_events.push(format!("Attempting recovery for failed node: {}", failed_node_id));

        // For now, just mark as non-blocking failure
        Ok(true)
    }

    /// Check resource limits
    async fn check_resource_limits(
        &self,
        context: &ThinkingContext,
        start_time: std::time::Instant,
    ) -> VcpResult<bool> {
        let elapsed_ms = start_time.elapsed().as_millis() as u64;

        if elapsed_ms > context.resource_limits.time_budget_ms {
            return Ok(true); // Exceeded time limit
        }

        // Check other limits (memory, etc.)
        // For now, just return false (within limits)

        Ok(false)
    }

    /// Extract final answer from completed chain
    fn extract_final_answer(&self, state: &ChainExecutionState) -> Option<String> {
        // Find decision nodes and extract their choices
        for node in state.chain.nodes.values() {
            if let crate::NodeContent::Decision { chosen_option, .. } = &node.content {
                if let Some(choice) = chosen_option {
                    return Some(choice.clone());
                }
            }
        }

        // Fallback: return content from last executed node
        state.chain.nodes.values()
            .filter(|node| state.completed_nodes.contains_key(&node.id))
            .max_by_key(|node| node.executed_at)
            .and_then(|node| {
                match &node.content {
                    crate::NodeContent::Text(text) => Some(text.clone()),
                    _ => None,
                }
            })
    }

    /// Calculate overall quality metrics
    fn calculate_overall_quality(&self, state: &ChainExecutionState) -> crate::ReasoningQuality {
        let node_qualities: Vec<&crate::ReasoningQuality> = state.completed_nodes.keys()
            .filter_map(|node_id| state.chain.get_node(node_id))
            .map(|node| &node.quality)
            .collect();

        if node_qualities.is_empty() {
            return crate::ReasoningQuality {
                logical_consistency: 0.0,
                completeness: 0.0,
                relevance: 0.0,
                novelty: 0.0,
                efficiency: 0.0,
                adaptability: 0.0,
            };
        }

        let count = node_qualities.len() as f64;

        crate::ReasoningQuality {
            logical_consistency: node_qualities.iter().map(|q| q.logical_consistency).sum::<f64>() / count,
            completeness: node_qualities.iter().map(|q| q.completeness).sum::<f64>() / count,
            relevance: node_qualities.iter().map(|q| q.relevance).sum::<f64>() / count,
            novelty: node_qualities.iter().map(|q| q.novelty).sum::<f64>() / count,
            efficiency: node_qualities.iter().map(|q| q.efficiency).sum::<f64>() / count,
            adaptability: node_qualities.iter().map(|q| q.adaptability).sum::<f64>() / count,
        }
    }

    /// Store execution result in history
    async fn store_execution_result(&self, result: &ChainExecutionResult) -> VcpResult<()> {
        let mut history = self.execution_history.lock().await;
        let chain_history = history.entry(result.chain_id.clone()).or_insert_with(Vec::new);

        chain_history.push(result.clone());

        // Limit history size
        if chain_history.len() > 10 {
            chain_history.remove(0);
        }

        Ok(())
    }

    /// Get execution history for a chain
    pub async fn get_execution_history(&self, chain_id: &str) -> Vec<ChainExecutionResult> {
        let history = self.execution_history.lock().await;
        history.get(chain_id).cloned().unwrap_or_default()
    }

    /// Enable/disable metacognition
    pub fn set_metacognition(&mut self, enabled: bool) {
        self.metacognition_enabled = enabled;
    }

    /// Set maximum recursion depth
    pub fn set_max_recursion_depth(&mut self, depth: u32) {
        self.max_recursion_depth = depth;
    }
}

/// Recursive strategy executor
pub struct RecursiveStrategyExecutor {
    engine: RecursiveEngine,
}

impl RecursiveStrategyExecutor {
    /// Create a new recursive strategy executor
    pub fn new(node_executor: Arc<dyn NodeExecutor>) -> Self {
        Self {
            engine: RecursiveEngine::new(node_executor),
        }
    }

    /// Execute with recursive refinement
    pub async fn execute_with_refinement(
        &self,
        initial_chain: ThinkingChain,
        context: &ThinkingContext,
        max_iterations: u32,
    ) -> VcpResult<ChainExecutionResult> {
        let mut best_result: Option<ChainExecutionResult> = None;
        let mut current_chain = initial_chain;

        for iteration in 0..max_iterations {
            info!("Refinement iteration {}", iteration + 1);

            let result = self.engine.execute_chain(current_chain.clone(), context, 0).await?;

            // Check if this is better than previous results
            if best_result.is_none() ||
               result.confidence > best_result.as_ref().unwrap().confidence {
                best_result = Some(result.clone());
            }

            // Check if we should continue refining
            if result.success && result.confidence >= context.emotional_state.confidence {
                break; // Good enough result
            }

            // Generate refined chain based on results
            current_chain = self.refine_chain(&current_chain, &result, context).await?;
        }

        best_result.ok_or_else(|| VcpError::RecursiveReasoning("No valid results after refinement".to_string()))
    }

    /// Refine chain based on execution results
    async fn refine_chain(
        &self,
        original_chain: &ThinkingChain,
        result: &ChainExecutionResult,
        context: &ThinkingContext,
    ) -> VcpResult<ThinkingChain> {
        // Create a new chain with improvements based on results
        // This is a simplified implementation

        let mut refined_chain = original_chain.clone();
        refined_chain.id = format!("refined_{}", uuid::Uuid::new_v4().simple());
        refined_chain.quality_threshold = (original_chain.quality_threshold + result.confidence) / 2.0;

        // Add reflection node if quality was low
        if result.confidence < 0.7 {
            let reflection_node = crate::NodeFactory::create_reflection_node(
                "Analyze reasoning process".to_string(),
                vec![
                    "What went wrong?".to_string(),
                    "How can we improve?".to_string(),
                ],
            );
            refined_chain.add_node(reflection_node)?;
        }

        Ok(refined_chain)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::thinking_node::BasicNodeExecutor;

    fn create_test_context() -> ThinkingContext {
        ThinkingContext {
            session_id: "test".to_string(),
            user_id: "user".to_string(),
            task_type: "reasoning".to_string(),
            complexity_level: crate::ComplexityLevel::Simple,
            time_constraint: Some(30),
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
        }
    }

    #[tokio::test]
    async fn test_recursive_engine_creation() {
        let node_executor = Arc::new(BasicNodeExecutor);
        let engine = RecursiveEngine::new(node_executor);

        assert_eq!(engine.max_recursion_depth, 10);
        assert!(engine.metacognition_enabled);
    }

    #[tokio::test]
    async fn test_chain_execution() {
        let node_executor = Arc::new(BasicNodeExecutor);
        let engine = RecursiveEngine::new(node_executor);

        let chain = ThinkingChain::new(
            "Test Chain".to_string(),
            "Test".to_string(),
            "Test input".to_string(),
        );

        let context = create_test_context();

        let result = engine.execute_chain(chain, &context, 0).await.unwrap();

        assert!(result.execution_stats.total_nodes >= 1);
        assert!(result.execution_stats.execution_time_ms > 0);
    }

    #[tokio::test]
    async fn test_execution_history() {
        let node_executor = Arc::new(BasicNodeExecutor);
        let engine = RecursiveEngine::new(node_executor);

        let chain = ThinkingChain::new(
            "Test".to_string(),
            "Test".to_string(),
            "Test".to_string(),
        );

        let context = create_test_context();
        let result = engine.execute_chain(chain.clone(), &context, 0).await.unwrap();

        let history = engine.get_execution_history(&chain.id).await;
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].chain_id, result.chain_id);
    }
}
