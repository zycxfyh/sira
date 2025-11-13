//! Chain Generator for VCP

use crate::{VcpResult, VcpError, ThinkingChain, ChainBuilder, ChainGenerationParams, ThinkingStrategy, ComplexityLevel, ReasoningGoal};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{debug, info};

/// Chain generation strategy
#[async_trait]
pub trait ChainGenerationStrategy: Send + Sync {
    /// Generate a thinking chain for given parameters
    async fn generate_chain(&self, params: &ChainGenerationParams) -> VcpResult<ThinkingChain>;

    /// Get strategy name
    fn name(&self) -> &str;
}

/// Dynamic chain generator
pub struct DynamicChainGenerator {
    strategies: HashMap<String, Box<dyn ChainGenerationStrategy>>,
}

impl DynamicChainGenerator {
    /// Create a new chain generator
    pub fn new() -> Self {
        let mut strategies = HashMap::new();

        // Register built-in strategies
        strategies.insert(
            "linear".to_string(),
            Box::new(LinearStrategy) as Box<dyn ChainGenerationStrategy>,
        );
        strategies.insert(
            "tree".to_string(),
            Box::new(TreeStrategy) as Box<dyn ChainGenerationStrategy>,
        );
        strategies.insert(
            "iterative".to_string(),
            Box::new(IterativeStrategy) as Box<dyn ChainGenerationStrategy>,
        );
        strategies.insert(
            "adaptive".to_string(),
            Box::new(AdaptiveStrategy) as Box<dyn ChainGenerationStrategy>,
        );

        Self { strategies }
    }

    /// Add a custom strategy
    pub fn add_strategy(&mut self, strategy: Box<dyn ChainGenerationStrategy>) {
        let name = strategy.name().to_string();
        self.strategies.insert(name.clone(), strategy);
        info!("Added chain generation strategy: {}", name);
    }

    /// Generate chain using specified strategy
    pub async fn generate_chain(&self, params: &ChainGenerationParams, strategy_name: &str) -> VcpResult<ThinkingChain> {
        let strategy = self.strategies.get(strategy_name)
            .ok_or_else(|| VcpError::ChainGeneration(format!("Strategy '{}' not found", strategy_name)))?;

        debug!("Generating chain using strategy: {}", strategy_name);
        strategy.generate_chain(params).await
    }

    /// Auto-select and generate chain based on context
    pub async fn auto_generate_chain(&self, params: &ChainGenerationParams) -> VcpResult<ThinkingChain> {
        let strategy_name = self.select_strategy(params);
        self.generate_chain(params, &strategy_name).await
    }

    /// Select appropriate strategy based on context
    fn select_strategy(&self, params: &ChainGenerationParams) -> String {
        match params.context.complexity_level {
            ComplexityLevel::Simple => "linear".to_string(),
            ComplexityLevel::Moderate => "tree".to_string(),
            ComplexityLevel::Complex => "iterative".to_string(),
            ComplexityLevel::UltraComplex => "adaptive".to_string(),
        }
    }

    /// Get available strategies
    pub fn get_available_strategies(&self) -> Vec<String> {
        self.strategies.keys().cloned().collect()
    }
}

impl Default for DynamicChainGenerator {
    fn default() -> Self {
        Self::new()
    }
}

/// Linear strategy - simple sequential reasoning
pub struct LinearStrategy;

#[async_trait]
impl ChainGenerationStrategy for LinearStrategy {
    async fn generate_chain(&self, params: &ChainGenerationParams) -> VcpResult<ThinkingChain> {
        let mut builder = ChainBuilder::new(
            format!("Linear Chain for {}", params.goal.description),
            "Linear sequential reasoning".to_string(),
            params.goal.description.clone(),
        )
        .with_quality_threshold(params.strategy.quality_threshold)
        .with_max_depth(params.strategy.recursion_depth);

        // Root analysis node
        let root_id = format!("root_{}", uuid::Uuid::new_v4().simple());
        builder = builder.add_analysis(
            "Analyze the problem".to_string(),
            params.goal.description.clone(),
            root_id.clone(),
        )?;

        // Add evaluation node
        builder = builder.add_analysis(
            "Evaluate possible solutions".to_string(),
            "Based on analysis, evaluate different approaches".to_string(),
            root_id.clone(),
        )?;

        // Add decision node
        builder = builder.add_decision(
            vec![
                "Solution A".to_string(),
                "Solution B".to_string(),
                "Solution C".to_string(),
            ],
            vec![
                "Effectiveness".to_string(),
                "Feasibility".to_string(),
                "Risk".to_string(),
            ],
        )?;

        let chain = builder.build()?;
        info!("Generated linear chain with {} nodes", chain.nodes.len());

        Ok(chain)
    }

    fn name(&self) -> &str {
        "linear"
    }
}

/// Tree strategy - branching analysis
pub struct TreeStrategy;

#[async_trait]
impl ChainGenerationStrategy for TreeStrategy {
    async fn generate_chain(&self, params: &ChainGenerationParams) -> VcpResult<ThinkingChain> {
        let mut builder = ChainBuilder::new(
            format!("Tree Chain for {}", params.goal.description),
            "Branching tree reasoning".to_string(),
            params.goal.description.clone(),
        )
        .with_quality_threshold(params.strategy.quality_threshold)
        .with_max_depth(params.strategy.recursion_depth);

        let root_id = format!("root_{}", uuid::Uuid::new_v4().simple());

        // Initial analysis
        builder = builder.add_analysis(
            "Break down the problem".to_string(),
            params.goal.description.clone(),
            root_id.clone(),
        )?;

        // Multiple analysis branches
        let branch1_id = format!("branch1_{}", uuid::Uuid::new_v4().simple());
        builder = builder.add_analysis(
            "Analyze technical aspects".to_string(),
            "Technical feasibility and requirements".to_string(),
            root_id.clone(),
        )?;

        let branch2_id = format!("branch2_{}", uuid::Uuid::new_v4().simple());
        builder = builder.add_analysis(
            "Analyze business aspects".to_string(),
            "Business impact and benefits".to_string(),
            root_id.clone(),
        )?;

        let branch3_id = format!("branch3_{}", uuid::Uuid::new_v4().simple());
        builder = builder.add_analysis(
            "Analyze risks".to_string(),
            "Potential risks and mitigation".to_string(),
            root_id.clone(),
        )?;

        // Synthesis node combining all branches
        builder = builder.add_synthesis(
            vec![branch1_id, branch2_id, branch3_id],
            "Combine all analyses into comprehensive understanding".to_string(),
        )?;

        // Final decision
        builder = builder.add_decision(
            vec![
                "Proceed with plan".to_string(),
                "Revise approach".to_string(),
                "Abandon project".to_string(),
            ],
            vec![
                "Technical feasibility".to_string(),
                "Business value".to_string(),
                "Risk level".to_string(),
            ],
        )?;

        let chain = builder.build()?;
        info!("Generated tree chain with {} nodes", chain.nodes.len());

        Ok(chain)
    }

    fn name(&self) -> &str {
        "tree"
    }
}

/// Iterative strategy - cyclical refinement
pub struct IterativeStrategy;

#[async_trait]
impl ChainGenerationStrategy for IterativeStrategy {
    async fn generate_chain(&self, params: &ChainGenerationParams) -> VcpResult<ThinkingChain> {
        let mut builder = ChainBuilder::new(
            format!("Iterative Chain for {}", params.goal.description),
            "Iterative refinement reasoning".to_string(),
            params.goal.description.clone(),
        )
        .with_quality_threshold(params.strategy.quality_threshold)
        .with_max_depth(params.strategy.recursion_depth);

        let root_id = format!("root_{}", uuid::Uuid::new_v4().simple());

        // Initial hypothesis
        builder = builder.add_analysis(
            "Form initial hypothesis".to_string(),
            params.goal.description.clone(),
            root_id.clone(),
        )?;

        // First iteration
        let iter1_id = format!("iter1_{}", uuid::Uuid::new_v4().simple());
        builder = builder.add_analysis(
            "Gather evidence and test hypothesis".to_string(),
            "First iteration of hypothesis testing".to_string(),
            root_id.clone(),
        )?;

        // Evaluation and refinement
        builder = builder.add_analysis(
            "Evaluate results and refine hypothesis".to_string(),
            "Based on first test, refine the approach".to_string(),
            iter1_id,
        )?;

        // Second iteration
        builder = builder.add_analysis(
            "Test refined hypothesis".to_string(),
            "Second iteration with refined approach".to_string(),
            root_id.clone(),
        )?;

        // Final evaluation
        builder = builder.add_analysis(
            "Final evaluation and conclusion".to_string(),
            "Draw final conclusions from iterative process".to_string(),
            root_id.clone(),
        )?;

        let chain = builder.build()?;
        info!("Generated iterative chain with {} nodes", chain.nodes.len());

        Ok(chain)
    }

    fn name(&self) -> &str {
        "iterative"
    }
}

/// Adaptive strategy - dynamically adjusts based on context
pub struct AdaptiveStrategy;

#[async_trait]
impl ChainGenerationStrategy for AdaptiveStrategy {
    async fn generate_chain(&self, params: &ChainGenerationParams) -> VcpResult<ThinkingChain> {
        // Analyze context to determine optimal structure
        let emotional_complexity = params.context.emotional_state.confidence *
                                  params.context.emotional_state.curiosity;

        let cognitive_load = params.context.cognitive_load;
        let time_pressure = params.context.time_constraint.is_some();

        let strategy_name = if emotional_complexity > 0.8 && !time_pressure {
            // High emotional engagement, no time pressure -> tree strategy
            "tree"
        } else if cognitive_load > 0.7 {
            // High cognitive load -> linear strategy
            "linear"
        } else if time_pressure {
            // Time pressure -> iterative with fewer steps
            "iterative"
        } else {
            // Default to tree for balanced approach
            "tree"
        };

        info!("Adaptive strategy selected: {} (emotional: {:.2}, cognitive: {:.2}, time_pressure: {})",
              strategy_name, emotional_complexity, cognitive_load, time_pressure);

        // Create a simpler generator and delegate
        let simple_generator = DynamicChainGenerator::new();
        simple_generator.generate_chain(params, strategy_name).await
    }

    fn name(&self) -> &str {
        "adaptive"
    }
}

/// Heuristic-based chain optimizer
pub struct ChainOptimizer;

impl ChainOptimizer {
    /// Optimize an existing chain
    pub async fn optimize_chain(&self, chain: &mut ThinkingChain, params: &ChainGenerationParams) -> VcpResult<()> {
        debug!("Optimizing chain: {}", chain.id);

        // Remove redundant nodes
        self.remove_redundant_nodes(chain)?;

        // Reorder for better flow
        self.optimize_execution_order(chain)?;

        // Adjust quality thresholds based on context
        self.adjust_quality_thresholds(chain, params)?;

        info!("Optimized chain: {} nodes, depth: {}", chain.nodes.len(), chain.get_depth());
        Ok(())
    }

    /// Remove redundant or low-value nodes
    fn remove_redundant_nodes(&self, chain: &mut ThinkingChain) -> VcpResult<()> {
        let nodes_to_remove: Vec<String> = chain.nodes.values()
            .filter(|node| {
                // Remove nodes with very low confidence and no children
                node.confidence < 0.3 && node.children_ids.is_empty() &&
                !matches!(node.node_type, crate::NodeType::Input)
            })
            .map(|node| node.id.clone())
            .collect();

        for node_id in nodes_to_remove {
            if let Some(node) = chain.nodes.remove(&node_id) {
                // Remove from parent's children list
                if let Some(parent_id) = node.parent_id {
                    if let Some(parent) = chain.nodes.get_mut(&parent_id) {
                        parent.children_ids.retain(|id| id != &node_id);
                    }
                }
            }
        }

        Ok(())
    }

    /// Optimize execution order for better parallelism
    fn optimize_execution_order(&self, chain: &mut ThinkingChain) -> VcpResult<()> {
        // For now, this is a placeholder
        // In a real implementation, this would reorder nodes to maximize parallelism
        // while respecting dependencies
        Ok(())
    }

    /// Adjust quality thresholds based on context
    fn adjust_quality_thresholds(&self, chain: &mut ThinkingChain, params: &ChainGenerationParams) -> VcpResult<()> {
        // Adjust based on time constraints
        if params.context.time_constraint.is_some() {
            chain.quality_threshold = (chain.quality_threshold * 0.8).max(0.5);
        }

        // Adjust based on complexity
        match params.context.complexity_level {
            ComplexityLevel::Simple => {
                chain.quality_threshold = (chain.quality_threshold * 1.1).min(0.9);
            }
            ComplexityLevel::UltraComplex => {
                chain.quality_threshold = (chain.quality_threshold * 0.9).max(0.6);
            }
            _ => {}
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_params() -> ChainGenerationParams {
        ChainGenerationParams {
            context: crate::ThinkingContext {
                session_id: "test".to_string(),
                user_id: "user".to_string(),
                task_type: "reasoning".to_string(),
                complexity_level: ComplexityLevel::Simple,
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
            },
            goal: ReasoningGoal {
                id: "test_goal".to_string(),
                description: "Test reasoning goal".to_string(),
                target_confidence: 0.8,
                success_criteria: vec![],
                constraints: vec![],
            },
            strategy: ThinkingStrategy {
                exploration_rate: 0.2,
                recursion_depth: 5,
                branching_factor: 3,
                quality_threshold: 0.7,
                adaptation_rate: 0.1,
                metacognition_enabled: true,
            },
            available_heuristics: vec![],
            domain_experts: vec![],
        }
    }

    #[tokio::test]
    async fn test_linear_strategy() {
        let strategy = LinearStrategy;
        let params = create_test_params();

        let chain = strategy.generate_chain(&params).await.unwrap();

        assert!(chain.nodes.len() >= 3); // Root + analysis + decision
        assert_eq!(chain.name, "Linear Chain for Test reasoning goal");
    }

    #[tokio::test]
    async fn test_tree_strategy() {
        let strategy = TreeStrategy;
        let params = create_test_params();

        let chain = strategy.generate_chain(&params).await.unwrap();

        assert!(chain.nodes.len() >= 5); // Multiple branches + synthesis
    }

    #[tokio::test]
    async fn test_dynamic_generator() {
        let generator = DynamicChainGenerator::new();
        let params = create_test_params();

        let strategies = generator.get_available_strategies();
        assert!(strategies.contains(&"linear".to_string()));
        assert!(strategies.contains(&"tree".to_string()));

        let chain = generator.auto_generate_chain(&params).await.unwrap();
        assert!(chain.nodes.len() > 1);
    }

    #[tokio::test]
    async fn test_chain_optimizer() {
        let optimizer = ChainOptimizer;
        let mut chain = ThinkingChain::new(
            "Test".to_string(),
            "Test".to_string(),
            "Test".to_string(),
        );
        let params = create_test_params();

        // Add a low-confidence node
        let low_conf_node = crate::ThinkingNode {
            id: "low_conf".to_string(),
            node_type: crate::NodeType::Analysis,
            content: crate::NodeContent::Text("test".to_string()),
            confidence: 0.2, // Low confidence
            quality: crate::ReasoningQuality {
                logical_consistency: 0.5,
                completeness: 0.5,
                relevance: 0.5,
                novelty: 0.5,
                efficiency: 0.5,
                adaptability: 0.5,
            },
            metadata: HashMap::new(),
            created_at: chrono::Utc::now(),
            executed_at: None,
            execution_time_ms: None,
            parent_id: Some(chain.root_node_id.clone()),
            children_ids: vec![], // No children
            prerequisites: vec![],
            dependencies: vec![],
        };

        chain.add_node(low_conf_node).unwrap();
        let original_count = chain.nodes.len();

        optimizer.optimize_chain(&mut chain, &params).await.unwrap();

        // Low confidence node should be removed
        assert!(chain.nodes.len() < original_count);
    }
}
