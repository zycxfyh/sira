//! Adaptive Controller for VCP

use crate::{VcpResult, VcpError, AdaptiveParameters, ReasoningPattern, ThinkingStrategy, ChainExecutionResult, ThinkingContext, VcpExecutionStats};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{debug, info, warn};

/// Adaptive controller for dynamic strategy adjustment
pub struct AdaptiveController {
    parameters: AdaptiveParameters,
    pattern_library: Vec<ReasoningPattern>,
    learning_rate: f64,
    adaptation_history: Vec<String>,
    enabled: bool,
}

impl AdaptiveController {
    /// Create a new adaptive controller
    pub fn new() -> Self {
        Self {
            parameters: AdaptiveParameters {
                strategy_weights: {
                    let mut weights = HashMap::new();
                    weights.insert("linear".to_string(), 0.3);
                    weights.insert("tree".to_string(), 0.4);
                    weights.insert("iterative".to_string(), 0.2);
                    weights.insert("adaptive".to_string(), 0.1);
                    weights
                },
                heuristic_effectiveness: HashMap::new(),
                domain_confidence: HashMap::new(),
                pattern_recognition: Vec::new(),
            },
            pattern_library: Vec::new(),
            learning_rate: 0.1,
            adaptation_history: Vec::new(),
            enabled: true,
        }
    }

    /// Adapt strategy based on execution results and context
    pub async fn adapt_strategy(
        &mut self,
        result: &ChainExecutionResult,
        context: &ThinkingContext,
        stats: &VcpExecutionStats,
    ) -> VcpResult<ThinkingStrategy> {
        if !self.enabled {
            return Ok(self.create_default_strategy());
        }

        info!("Adapting strategy based on execution result: success={}, confidence={:.2}",
              result.success, result.confidence);

        // Learn from this execution
        self.learn_from_execution(result, context, stats).await?;

        // Generate adapted strategy
        let adapted_strategy = self.generate_adapted_strategy(result, context).await?;

        // Record adaptation
        self.adaptation_history.push(format!(
            "Adapted strategy: exploration_rate={:.2}, depth={}, branching={}",
            adapted_strategy.exploration_rate,
            adapted_strategy.recursion_depth,
            adapted_strategy.branching_factor
        ));

        // Limit history size
        if self.adaptation_history.len() > 50 {
            self.adaptation_history.remove(0);
        }

        Ok(adapted_strategy)
    }

    /// Learn from execution results
    async fn learn_from_execution(
        &mut self,
        result: &ChainExecutionResult,
        context: &ThinkingContext,
        stats: &VcpExecutionStats,
    ) -> VcpResult<()> {
        // Update strategy weights based on success
        if result.success {
            // Reward successful strategies (simplified - would need to track which strategy was used)
            for weight in self.parameters.strategy_weights.values_mut() {
                *weight *= (1.0 + self.learning_rate * result.confidence);
                *weight = weight.min(1.0); // Cap at 1.0
            }
        } else {
            // Penalize unsuccessful strategies
            for weight in self.parameters.strategy_weights.values_mut() {
                *weight *= (1.0 - self.learning_rate * (1.0 - result.confidence));
                *weight = weight.max(0.1); // Floor at 0.1
            }
        }

        // Update domain confidence
        let domain_conf_value = *self.parameters.domain_confidence
            .entry(context.task_type.clone())
            .or_insert(0.5);

        // Adjust based on result quality
        let adjustment = if result.success {
            self.learning_rate * result.confidence
        } else {
            -self.learning_rate * (1.0 - result.confidence)
        };

        let new_domain_conf = (domain_conf_value + adjustment).clamp(0.0, 1.0);

        // Update the value
        self.parameters.domain_confidence.insert(context.task_type.clone(), new_domain_conf);

        // Learn new patterns
        self.learn_reasoning_pattern(result, context).await?;

        debug!("Updated adaptive parameters: domain_confidence[{}]={:.2}",
               context.task_type, new_domain_conf);

        Ok(())
    }

    /// Learn reasoning patterns from successful executions
    async fn learn_reasoning_pattern(
        &mut self,
        result: &ChainExecutionResult,
        context: &ThinkingContext,
    ) -> VcpResult<()> {
        if !result.success || result.confidence < 0.7 {
            return Ok(()); // Only learn from good results
        }

        // Create pattern signature from context
        let mut signature = Vec::new();
        signature.push(format!("complexity_{:?}", context.complexity_level));
        signature.push(format!("task_{}", context.task_type));
        signature.push(format!("cognitive_load_{:.1}", context.cognitive_load));

        if context.time_constraint.is_some() {
            signature.push("time_constrained".to_string());
        }

        // Check if we already have a similar pattern
        let existing_pattern = self.pattern_library.iter_mut()
            .find(|p| p.context_signature == signature);

        if let Some(pattern) = existing_pattern {
            // Update existing pattern
            pattern.success_rate = (pattern.success_rate * pattern.usage_count as f64 + result.confidence)
                                 / (pattern.usage_count as f64 + 1.0);
            pattern.average_quality = (pattern.average_quality * pattern.usage_count as f64 + result.confidence)
                                    / (pattern.usage_count as f64 + 1.0);
            pattern.usage_count += 1;
            pattern.last_used = chrono::Utc::now();
        } else {
            // Create new pattern
            let pattern = ReasoningPattern {
                pattern_id: format!("pattern_{}", uuid::Uuid::new_v4().simple()),
                context_signature: signature,
                successful_strategy: "adaptive".to_string(), // Would need to track actual strategy
                success_rate: result.confidence,
                average_quality: result.confidence,
                usage_count: 1,
                last_used: chrono::Utc::now(),
            };

            self.pattern_library.push(pattern);
        }

        // Limit pattern library size
        if self.pattern_library.len() > 100 {
            // Remove least recently used
            self.pattern_library.sort_by(|a, b| b.last_used.cmp(&a.last_used));
            self.pattern_library.truncate(50);
        }

        Ok(())
    }

    /// Generate adapted strategy based on current knowledge
    async fn generate_adapted_strategy(
        &self,
        result: &ChainExecutionResult,
        context: &ThinkingContext,
    ) -> VcpResult<ThinkingStrategy> {
        // Start with base strategy
        let mut strategy = self.create_default_strategy();

        // Adjust exploration rate based on context confidence
        let context_confidence = context.emotional_state.confidence;
        strategy.exploration_rate = if context_confidence > 0.8 {
            0.1 // Low exploration when confident
        } else if context_confidence < 0.4 {
            0.5 // High exploration when uncertain
        } else {
            0.3 // Moderate exploration
        };

        // Adjust depth based on complexity and cognitive load
        let base_depth = match context.complexity_level {
            crate::ComplexityLevel::Simple => 3,
            crate::ComplexityLevel::Moderate => 5,
            crate::ComplexityLevel::Complex => 7,
            crate::ComplexityLevel::UltraComplex => 10,
        };

        // Reduce depth under high cognitive load or time pressure
        let depth_modifier = if context.cognitive_load > 0.7 {
            0.7
        } else if context.time_constraint.is_some() {
            0.8
        } else {
            1.0
        };

        strategy.recursion_depth = ((base_depth as f64 * depth_modifier) as u32).max(2);

        // Adjust branching based on previous performance
        if result.success && result.confidence > 0.8 {
            // Successful with high confidence - can branch more
            strategy.branching_factor = (strategy.branching_factor + 1).min(5);
        } else if !result.success {
            // Unsuccessful - reduce branching
            strategy.branching_factor = strategy.branching_factor.saturating_sub(1).max(1);
        }

        // Adjust quality threshold based on domain confidence
        let domain_conf = self.parameters.domain_confidence
            .get(&context.task_type)
            .copied()
            .unwrap_or(0.5);

        strategy.quality_threshold = (strategy.quality_threshold * domain_conf).max(0.5);

        // Enable/disable metacognition based on context
        strategy.metacognition_enabled = context.complexity_level != crate::ComplexityLevel::Simple;

        debug!("Generated adapted strategy: depth={}, branching={}, exploration={:.2}, quality_threshold={:.2}",
               strategy.recursion_depth, strategy.branching_factor, strategy.exploration_rate, strategy.quality_threshold);

        Ok(strategy)
    }

    /// Create default thinking strategy
    fn create_default_strategy(&self) -> ThinkingStrategy {
        ThinkingStrategy {
            exploration_rate: 0.3,
            recursion_depth: 5,
            branching_factor: 3,
            quality_threshold: 0.7,
            adaptation_rate: 0.1,
            metacognition_enabled: true,
        }
    }

    /// Get adaptation recommendations
    pub async fn get_recommendations(&self, context: &ThinkingContext) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Domain-specific recommendations
        if let Some(&domain_conf) = self.parameters.domain_confidence.get(&context.task_type) {
            if domain_conf < 0.5 {
                recommendations.push(format!("Low confidence in {} domain - consider gathering more information", context.task_type));
            }
        }

        // Pattern-based recommendations
        let context_signature = vec![
            format!("complexity_{:?}", context.complexity_level),
            format!("task_{}", context.task_type),
            format!("cognitive_load_{:.1}", context.cognitive_load),
        ];

        for pattern in &self.pattern_library {
            if pattern.success_rate > 0.8 &&
               pattern.context_signature.iter().any(|s| context_signature.contains(s)) {
                recommendations.push(format!("Consider using strategy from successful pattern: {}", pattern.pattern_id));
                break; // Just recommend one
            }
        }

        // Cognitive load recommendations
        if context.cognitive_load > 0.8 {
            recommendations.push("High cognitive load detected - recommend simpler reasoning approach".to_string());
        }

        // Time pressure recommendations
        if context.time_constraint.is_some() {
            recommendations.push("Time constraint detected - recommend faster execution strategy".to_string());
        }

        recommendations
    }

    /// Get adaptation statistics
    pub fn get_adaptation_stats(&self) -> HashMap<String, f64> {
        let mut stats = HashMap::new();

        stats.insert("total_adaptations".to_string(), self.adaptation_history.len() as f64);
        stats.insert("pattern_library_size".to_string(), self.pattern_library.len() as f64);

        let avg_strategy_weight: f64 = self.parameters.strategy_weights.values().sum::<f64>() /
                                      self.parameters.strategy_weights.len() as f64;
        stats.insert("average_strategy_weight".to_string(), avg_strategy_weight);

        let avg_domain_confidence: f64 = if self.parameters.domain_confidence.is_empty() {
            0.5
        } else {
            self.parameters.domain_confidence.values().sum::<f64>() /
            self.parameters.domain_confidence.len() as f64
        };
        stats.insert("average_domain_confidence".to_string(), avg_domain_confidence);

        stats
    }

    /// Reset adaptation state
    pub fn reset(&mut self) {
        self.parameters = AdaptiveParameters {
            strategy_weights: {
                let mut weights = HashMap::new();
                weights.insert("linear".to_string(), 0.3);
                weights.insert("tree".to_string(), 0.4);
                weights.insert("iterative".to_string(), 0.2);
                weights.insert("adaptive".to_string(), 0.1);
                weights
            },
            heuristic_effectiveness: HashMap::new(),
            domain_confidence: HashMap::new(),
            pattern_recognition: Vec::new(),
        };
        self.pattern_library.clear();
        self.adaptation_history.clear();
    }

    /// Enable/disable adaptation
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Get adaptation history
    pub fn get_adaptation_history(&self) -> &[String] {
        &self.adaptation_history
    }
}

/// Strategy optimizer using reinforcement learning concepts
pub struct StrategyOptimizer;

impl StrategyOptimizer {
    /// Optimize strategy parameters using simple reinforcement learning
    pub async fn optimize_strategy(
        &self,
        current_strategy: &ThinkingStrategy,
        reward: f64, // Based on execution quality and efficiency
        learning_rate: f64,
    ) -> ThinkingStrategy {
        let mut optimized = current_strategy.clone();

        // Adjust exploration rate based on reward
        if reward > 0.8 {
            // Good reward - slightly reduce exploration
            optimized.exploration_rate = (optimized.exploration_rate * (1.0 - learning_rate * 0.1)).max(0.05);
        } else if reward < 0.5 {
            // Poor reward - increase exploration
            optimized.exploration_rate = (optimized.exploration_rate * (1.0 + learning_rate * 0.2)).min(0.8);
        }

        // Adjust depth based on reward
        if reward > 0.7 && optimized.recursion_depth < 10 {
            // Good performance - can try deeper reasoning
            optimized.recursion_depth = ((optimized.recursion_depth as f64 * (1.0 + learning_rate * 0.1)) as u32).min(15);
        } else if reward < 0.6 {
            // Poor performance - reduce depth
            optimized.recursion_depth = ((optimized.recursion_depth as f64 * (1.0 - learning_rate * 0.2)) as u32).max(2);
        }

        // Adjust quality threshold based on consistency
        if reward > 0.85 {
            // Very good results - can be more demanding
            optimized.quality_threshold = (optimized.quality_threshold * (1.0 + learning_rate * 0.05)).min(0.95);
        } else if reward < 0.65 {
            // Poor results - be less demanding
            optimized.quality_threshold = (optimized.quality_threshold * (1.0 - learning_rate * 0.1)).max(0.4);
        }

        debug!("Optimized strategy: exploration={:.3}, depth={}, quality_threshold={:.2}",
               optimized.exploration_rate, optimized.recursion_depth, optimized.quality_threshold);

        optimized
    }

    /// Evaluate strategy performance
    pub fn evaluate_strategy(&self, strategy: &ThinkingStrategy, execution_result: &ChainExecutionResult) -> f64 {
        let mut score = 0.0;

        // Quality contribution (40%)
        score += execution_result.confidence * 0.4;

        // Efficiency contribution (30%)
        let efficiency = if execution_result.execution_stats.total_execution_time_ms > 0 {
            (execution_result.quality_metrics.efficiency *
             (10000.0 / execution_result.execution_stats.total_execution_time_ms as f64)).min(1.0)
        } else {
            0.0
        };
        score += efficiency * 0.3;

        // Adaptability contribution (20%)
        score += execution_result.quality_metrics.adaptability * 0.2;

        // Success bonus (10%)
        if execution_result.success {
            score += 0.1;
        }

        score.clamp(0.0, 1.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_context() -> ThinkingContext {
        ThinkingContext {
            session_id: "test".to_string(),
            user_id: "user".to_string(),
            task_type: "reasoning".to_string(),
            complexity_level: crate::ComplexityLevel::Moderate,
            time_constraint: Some(60),
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
                curiosity: 0.6,
                frustration: 0.2,
                satisfaction: 0.8,
            },
            cognitive_load: 0.4,
        }
    }

    fn create_test_result(success: bool, confidence: f64) -> ChainExecutionResult {
        ChainExecutionResult {
            chain_id: "test".to_string(),
            success,
            final_answer: Some("test answer".to_string()),
            confidence,
            quality_metrics: crate::ReasoningQuality {
                logical_consistency: confidence,
                completeness: confidence,
                relevance: confidence,
                novelty: confidence * 0.8,
                efficiency: confidence * 0.9,
                adaptability: confidence * 0.7,
            },
            execution_stats: crate::ExecutionStats {
                total_nodes: 5,
                executed_nodes: 5,
                skipped_nodes: 0,
                failed_nodes: if success { 0 } else { 1 },
                max_depth_reached: 3,
                total_execution_time_ms: 2000,
                memory_peak_mb: 50,
                api_calls_made: 2,
            },
            metacognitive_history: vec![],
            adaptation_log: vec![],
        }
    }

    #[tokio::test]
    async fn test_adaptive_controller() {
        let mut controller = AdaptiveController::new();
        let context = create_test_context();
        let result = create_test_result(true, 0.85);
        let stats = VcpExecutionStats {
            total_chains_generated: 5,
            successful_chains: 4,
            average_chain_length: 4.0,
            average_execution_time_ms: 1800.0,
            average_quality_score: 0.8,
            adaptation_events: 1,
            metacognitive_interventions: 1,
        };

        let strategy = controller.adapt_strategy(&result, &context, &stats).await.unwrap();

        assert!(strategy.exploration_rate >= 0.0 && strategy.exploration_rate <= 1.0);
        assert!(strategy.recursion_depth >= 2);
        assert!(strategy.quality_threshold >= 0.4 && strategy.quality_threshold <= 0.95);
    }

    #[test]
    fn test_strategy_optimizer() {
        let optimizer = StrategyOptimizer;
        let strategy = ThinkingStrategy {
            exploration_rate: 0.3,
            recursion_depth: 5,
            branching_factor: 3,
            quality_threshold: 0.7,
            adaptation_rate: 0.1,
            metacognition_enabled: true,
        };

        let result = create_test_result(true, 0.9);
        let reward = optimizer.evaluate_strategy(&strategy, &result);

        assert!(reward > 0.8); // Should get high reward for good result

        let optimized = optimizer.optimize_strategy(&strategy, reward, 0.1).await;

        // Should adjust parameters based on good performance
        assert!(optimized.exploration_rate <= strategy.exploration_rate); // Reduce exploration
        assert!(optimized.quality_threshold >= strategy.quality_threshold); // Increase quality threshold
    }

    #[tokio::test]
    async fn test_adaptation_learning() {
        let mut controller = AdaptiveController::new();
        let context = create_test_context();

        // Learn from good execution
        let good_result = create_test_result(true, 0.9);
        let stats = VcpExecutionStats {
            total_chains_generated: 1,
            successful_chains: 1,
            average_chain_length: 5.0,
            average_execution_time_ms: 2000.0,
            average_quality_score: 0.9,
            adaptation_events: 0,
            metacognitive_interventions: 0,
        };

        controller.adapt_strategy(&good_result, &context, &stats).await.unwrap();

        // Domain confidence should increase
        let domain_conf = controller.parameters.domain_confidence.get("reasoning").unwrap();
        assert!(*domain_conf > 0.5); // Should be higher than default 0.5

        // Pattern should be learned
        assert!(!controller.pattern_library.is_empty());
    }
}
