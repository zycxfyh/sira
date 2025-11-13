//! Meta-cognition for VCP

use crate::{VcpResult, VcpError, MetacognitiveAssessment, ThinkingContext, ChainExecutionResult, QualityTrend, RecommendedAction, VcpExecutionStats};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{debug, info, warn};

/// Meta-cognitive monitor
pub struct MetacognitiveMonitor {
    confidence_history: Vec<f64>,
    quality_history: Vec<f64>,
    time_history: Vec<u64>,
    adaptation_history: Vec<String>,
    monitoring_enabled: bool,
}

impl MetacognitiveMonitor {
    /// Create a new meta-cognitive monitor
    pub fn new() -> Self {
        Self {
            confidence_history: Vec::new(),
            quality_history: Vec::new(),
            time_history: Vec::new(),
            adaptation_history: Vec::new(),
            monitoring_enabled: true,
        }
    }

    /// Monitor reasoning progress
    pub async fn monitor_progress(
        &mut self,
        current_assessment: &MetacognitiveAssessment,
        context: &ThinkingContext,
        elapsed_time: u64,
    ) -> VcpResult<()> {
        if !self.monitoring_enabled {
            return Ok(());
        }

        // Record metrics
        self.confidence_history.push(current_assessment.current_confidence);
        self.quality_history.push(current_assessment.current_confidence); // Simplified
        self.time_history.push(elapsed_time);

        debug!("Meta-cognition monitoring: confidence={:.2}, progress_rate={:.3}, stuck_prob={:.2}",
               current_assessment.current_confidence,
               current_assessment.progress_rate,
               current_assessment.stuck_probability);

        // Detect critical issues
        if current_assessment.stuck_probability > 0.8 {
            warn!("High probability of being stuck detected");
        }

        if matches!(current_assessment.quality_trend, QualityTrend::Declining) {
            warn!("Quality declining, intervention may be needed");
        }

        Ok(())
    }

    /// Analyze reasoning patterns
    pub async fn analyze_patterns(&self) -> VcpResult<HashMap<String, f64>> {
        let mut patterns = HashMap::new();

        if self.confidence_history.len() < 3 {
            return Ok(patterns);
        }

        // Calculate trends
        let confidence_trend = self.calculate_trend(&self.confidence_history);
        let quality_trend = self.calculate_trend(&self.quality_history);

        patterns.insert("confidence_trend".to_string(), confidence_trend);
        patterns.insert("quality_trend".to_string(), quality_trend);

        // Calculate volatility (how much confidence varies)
        let confidence_volatility = self.calculate_volatility(&self.confidence_history);
        patterns.insert("confidence_volatility".to_string(), confidence_volatility);

        // Calculate efficiency (quality per unit time)
        if let (Some(&first_time), Some(&last_time)) = (self.time_history.first(), self.time_history.last()) {
            if last_time > first_time {
                let avg_quality = self.quality_history.iter().sum::<f64>() / self.quality_history.len() as f64;
                let efficiency = avg_quality / (last_time - first_time) as f64;
                patterns.insert("reasoning_efficiency".to_string(), efficiency);
            }
        }

        Ok(patterns)
    }

    /// Generate meta-cognitive insights
    pub async fn generate_insights(&self) -> Vec<String> {
        let mut insights = Vec::new();

        if let Ok(patterns) = self.analyze_patterns().await {
            if let Some(trend) = patterns.get("confidence_trend") {
                if *trend > 0.1 {
                    insights.push("Confidence is increasing steadily".to_string());
                } else if *trend < -0.1 {
                    insights.push("Confidence is declining, consider intervention".to_string());
                }
            }

            if let Some(volatility) = patterns.get("confidence_volatility") {
                if *volatility > 0.3 {
                    insights.push("High confidence volatility suggests uncertainty".to_string());
                }
            }

            if let Some(efficiency) = patterns.get("reasoning_efficiency") {
                if *efficiency < 0.01 {
                    insights.push("Low reasoning efficiency, consider simplifying approach".to_string());
                }
            }
        }

        insights
    }

    /// Calculate trend from time series data
    fn calculate_trend(&self, data: &[f64]) -> f64 {
        if data.len() < 2 {
            return 0.0;
        }

        let n = data.len() as f64;
        let sum_x: f64 = (0..data.len()).map(|i| i as f64).sum();
        let sum_y: f64 = data.iter().sum();
        let sum_xy: f64 = data.iter().enumerate().map(|(i, &y)| i as f64 * y).sum();
        let sum_x2: f64 = (0..data.len()).map(|i| (i as f64).powi(2)).sum();

        let slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x.powi(2));
        slope
    }

    /// Calculate volatility (standard deviation)
    fn calculate_volatility(&self, data: &[f64]) -> f64 {
        if data.is_empty() {
            return 0.0;
        }

        let mean = data.iter().sum::<f64>() / data.len() as f64;
        let variance = data.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / data.len() as f64;

        variance.sqrt()
    }

    /// Reset monitoring state
    pub fn reset(&mut self) {
        self.confidence_history.clear();
        self.quality_history.clear();
        self.time_history.clear();
        self.adaptation_history.clear();
    }

    /// Enable/disable monitoring
    pub fn set_enabled(&mut self, enabled: bool) {
        self.monitoring_enabled = enabled;
    }
}

/// Meta-cognitive controller
pub struct MetacognitiveController {
    monitor: MetacognitiveMonitor,
    intervention_thresholds: HashMap<String, f64>,
    intervention_cooldown: u64, // milliseconds
    last_intervention: u64,
}

impl MetacognitiveController {
    /// Create a new meta-cognitive controller
    pub fn new() -> Self {
        let mut thresholds = HashMap::new();
        thresholds.insert("stuck_probability".to_string(), 0.7);
        thresholds.insert("quality_drop".to_string(), 0.2);
        thresholds.insert("time_pressure".to_string(), 0.8);

        Self {
            monitor: MetacognitiveMonitor::new(),
            intervention_thresholds: thresholds,
            intervention_cooldown: 5000, // 5 seconds
            last_intervention: 0,
        }
    }

    /// Assess and potentially intervene in reasoning process
    pub async fn assess_and_intervene(
        &mut self,
        assessment: &MetacognitiveAssessment,
        context: &ThinkingContext,
        stats: &VcpExecutionStats,
    ) -> VcpResult<Vec<RecommendedAction>> {
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        // Check cooldown
        if current_time - self.last_intervention < self.intervention_cooldown {
            return Ok(Vec::new());
        }

        let mut interventions = Vec::new();

        // Assess stuck situation
        if let Some(&threshold) = self.intervention_thresholds.get("stuck_probability") {
            if assessment.stuck_probability > threshold {
                interventions.push(RecommendedAction::ChangeStrategy);
                interventions.push(RecommendedAction::TakeBreak);
            }
        }

        // Assess quality decline
        if matches!(assessment.quality_trend, QualityTrend::Declining) {
            if let Some(&threshold) = self.intervention_thresholds.get("quality_drop") {
                interventions.push(RecommendedAction::AddHeuristic("quality_focus".to_string()));
            }
        }

        // Assess time pressure
        if let Some(time_limit) = context.time_constraint {
            let elapsed_ratio = stats.average_execution_time_ms as f64 / time_limit as f64;
            if elapsed_ratio > 0.8 {
                interventions.push(RecommendedAction::AdjustExploration(0.1)); // Reduce exploration
            }
        }

        // Assess cognitive load
        if context.cognitive_load > 0.8 {
            interventions.push(RecommendedAction::ReduceBranching);
        }

        // Apply interventions
        if !interventions.is_empty() {
            self.last_intervention = current_time;
            info!("Meta-cognitive interventions triggered: {:?}", interventions);
        }

        Ok(interventions)
    }

    /// Update intervention thresholds based on experience
    pub async fn update_thresholds(&mut self, success: bool, interventions_used: &[RecommendedAction]) {
        if success && interventions_used.is_empty() {
            // Successful without intervention - can be more conservative
            for threshold in self.intervention_thresholds.values_mut() {
                *threshold *= 1.05; // Increase thresholds slightly
            }
        } else if !success && !interventions_used.is_empty() {
            // Failed despite interventions - be more aggressive
            for threshold in self.intervention_thresholds.values_mut() {
                *threshold *= 0.95; // Decrease thresholds slightly
            }
        }
    }

    /// Get monitoring insights
    pub async fn get_monitoring_insights(&self) -> Vec<String> {
        self.monitor.generate_insights().await
    }

    /// Reset controller state
    pub fn reset(&mut self) {
        self.monitor.reset();
        self.last_intervention = 0;
    }
}

/// Self-reflection analyzer
pub struct SelfReflectionAnalyzer;

impl SelfReflectionAnalyzer {
    /// Analyze reasoning process and generate reflections
    pub async fn analyze_and_reflect(
        &self,
        execution_result: &ChainExecutionResult,
        context: &ThinkingContext,
    ) -> VcpResult<Vec<String>> {
        let mut reflections = Vec::new();

        // Analyze success/failure
        if execution_result.success {
            reflections.push(format!("Successfully achieved goal with {:.1}% confidence",
                                   execution_result.confidence * 100.0));
        } else {
            reflections.push(format!("Failed to achieve goal, final confidence: {:.1}%",
                                   execution_result.confidence * 100.0));
        }

        // Analyze quality metrics
        let quality = &execution_result.quality_metrics;
        if quality.logical_consistency < 0.7 {
            reflections.push("Logical consistency was low - consider checking reasoning steps".to_string());
        }

        if quality.efficiency < 0.6 {
            reflections.push("Reasoning was inefficient - look for optimization opportunities".to_string());
        }

        // Analyze metacognitive history
        let stuck_assessments = execution_result.metacognitive_history
            .iter()
            .filter(|a| a.stuck_probability > 0.5)
            .count();

        if stuck_assessments > 0 {
            reflections.push(format!("Detected {} instances of potential stuck states", stuck_assessments));
        }

        // Analyze adaptations
        if !execution_result.adaptation_log.is_empty() {
            reflections.push(format!("Made {} adaptations during reasoning", execution_result.adaptation_log.len()));
        }

        // Context-aware reflections
        if context.emotional_state.frustration > 0.7 {
            reflections.push("High frustration detected - consider breaking down complex problems".to_string());
        }

        if context.cognitive_load > 0.8 {
            reflections.push("High cognitive load - reasoning may benefit from simplification".to_string());
        }

        Ok(reflections)
    }

    /// Generate improvement suggestions
    pub async fn generate_improvements(&self, reflections: &[String]) -> Vec<String> {
        let mut improvements = Vec::new();

        for reflection in reflections {
            if reflection.contains("consistency") {
                improvements.push("Add explicit validation steps in reasoning chains".to_string());
            } else if reflection.contains("efficiency") {
                improvements.push("Implement parallel execution where possible".to_string());
            } else if reflection.contains("stuck") {
                improvements.push("Add more diverse reasoning strategies".to_string());
            } else if reflection.contains("frustration") {
                improvements.push("Break complex problems into smaller, manageable parts".to_string());
            }
        }

        // General improvements
        improvements.push("Monitor and analyze reasoning patterns regularly".to_string());
        improvements.push("Adapt strategies based on success/failure history".to_string());

        improvements
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_assessment() -> MetacognitiveAssessment {
        MetacognitiveAssessment {
            current_confidence: 0.8,
            progress_rate: 0.05,
            stuck_probability: 0.2,
            quality_trend: QualityTrend::Stable,
            resource_efficiency: 0.85,
            recommended_actions: vec![RecommendedAction::TakeBreak],
        }
    }

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
                frustration: 0.3,
                satisfaction: 0.7,
            },
            cognitive_load: 0.4,
        }
    }

    #[tokio::test]
    async fn test_metacognitive_monitor() {
        let mut monitor = MetacognitiveMonitor::new();
        let assessment = create_test_assessment();
        let context = create_test_context();

        monitor.monitor_progress(&assessment, &context, 1000).await.unwrap();

        let patterns = monitor.analyze_patterns().await.unwrap();
        assert!(patterns.contains_key("confidence_trend"));

        let insights = monitor.generate_insights().await;
        assert!(!insights.is_empty());
    }

    #[tokio::test]
    async fn test_metacognitive_controller() {
        let mut controller = MetacognitiveController::new();
        let assessment = create_test_assessment();
        let context = create_test_context();
        let stats = VcpExecutionStats {
            total_chains_generated: 10,
            successful_chains: 7,
            average_chain_length: 5.0,
            average_execution_time_ms: 2000.0,
            average_quality_score: 0.75,
            adaptation_events: 2,
            metacognitive_interventions: 1,
        };

        let interventions = controller.assess_and_intervene(&assessment, &context, &stats).await.unwrap();
        // Should not trigger interventions for this assessment
        assert!(interventions.is_empty());
    }

    #[tokio::test]
    async fn test_self_reflection_analyzer() {
        let analyzer = SelfReflectionAnalyzer;
        let context = create_test_context();

        let execution_result = ChainExecutionResult {
            chain_id: "test_chain".to_string(),
            success: true,
            final_answer: Some("Test answer".to_string()),
            confidence: 0.85,
            quality_metrics: crate::ReasoningQuality {
                logical_consistency: 0.8,
                completeness: 0.9,
                relevance: 0.85,
                novelty: 0.6,
                efficiency: 0.7,
                adaptability: 0.75,
            },
            execution_stats: crate::ExecutionStats {
                total_nodes: 5,
                executed_nodes: 5,
                skipped_nodes: 0,
                failed_nodes: 0,
                max_depth_reached: 3,
                total_execution_time_ms: 1500,
                memory_peak_mb: 45,
                api_calls_made: 2,
            },
            metacognitive_history: vec![],
            adaptation_log: vec!["Adapted strategy".to_string()],
        };

        let reflections = analyzer.analyze_and_reflect(&execution_result, &context).await.unwrap();
        assert!(!reflections.is_empty());

        let improvements = analyzer.generate_improvements(&reflections).await;
        assert!(!improvements.is_empty());
    }
}
