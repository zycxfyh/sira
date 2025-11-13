//! Decision Engine for Sira Intelligence

use crate::{IntelligenceResult, IntelligenceError, DecisionContext, DecisionResult, ContextFeatures, DecisionConfig, LearningEngine};
use async_trait::async_trait;
use std::collections::HashMap;
use rand::{thread_rng, Rng};
use tracing::{info, debug, warn};

/// Decision strategy trait
#[async_trait]
pub trait DecisionStrategy: Send + Sync {
    /// Make a decision based on context
    async fn decide(&self, context: &DecisionContext, options: &[String]) -> IntelligenceResult<DecisionResult>;

    /// Get strategy name
    fn name(&self) -> &str;
}

/// Intelligent Decision Engine
pub struct DecisionEngine {
    config: DecisionConfig,
    learning_engine: LearningEngine,
    strategies: HashMap<String, Box<dyn DecisionStrategy>>,
}

impl DecisionEngine {
    /// Create a new decision engine
    pub fn new(config: DecisionConfig, learning_engine: LearningEngine) -> Self {
        let mut strategies = HashMap::new();

        // Add default strategies
        strategies.insert(
            "weighted_random".to_string(),
            Box::new(WeightedRandomStrategy::new(config.exploration_rate)) as Box<dyn DecisionStrategy>,
        );
        strategies.insert(
            "context_aware".to_string(),
            Box::new(ContextAwareStrategy) as Box<dyn DecisionStrategy>,
        );
        strategies.insert(
            "learning_based".to_string(),
            Box::new(LearningBasedStrategy) as Box<dyn DecisionStrategy>,
        );

        Self {
            config,
            learning_engine,
            strategies,
        }
    }

    /// Make an intelligent decision
    pub async fn make_decision(&self, context: DecisionContext, options: Vec<String>) -> IntelligenceResult<DecisionResult> {
        if options.is_empty() {
            return Err(IntelligenceError::Decision("No options provided".to_string()));
        }

        // Choose strategy based on context
        let strategy_name = self.select_strategy(&context).await;
        let strategy = self.strategies.get(&strategy_name)
            .ok_or_else(|| IntelligenceError::Decision(format!("Strategy '{}' not found", strategy_name)))?;

        debug!("Using strategy '{}' for decision", strategy_name);
        strategy.decide(&context, &options).await
    }

    /// Get decision recommendations
    pub async fn get_recommendations(&self, context: DecisionContext, max_options: usize) -> IntelligenceResult<Vec<String>> {
        let predictions = self.learning_engine.get_predictions(&context.user_id, &self.extract_context_features(&context)).await?;

        // Sort by prediction score
        let mut sorted_predictions: Vec<_> = predictions.into_iter().collect();
        sorted_predictions.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Return top recommendations
        let recommendations = sorted_predictions
            .into_iter()
            .take(max_options)
            .map(|(option, _)| option)
            .collect();

        Ok(recommendations)
    }

    /// Learn from decision outcome
    pub async fn learn_from_outcome(&self, context: DecisionContext, decision: &str, outcome_quality: f64) -> IntelligenceResult<()> {
        use crate::UserInteraction;

        let context_features = self.extract_context_features(&context);

        let interaction = UserInteraction {
            user_id: context.user_id,
            session_id: context.session_id,
            timestamp: context.current_time,
            request_type: context.request_type,
            model_used: decision.to_string(),
            response_quality: outcome_quality,
            response_time: 1000, // Placeholder
            user_feedback: Some(outcome_quality),
            context_features: context_features.custom_features,
        };

        self.learning_engine.process_interaction(interaction).await
    }

    /// Select appropriate strategy based on context
    async fn select_strategy(&self, context: &DecisionContext) -> String {
        // Simple strategy selection logic
        if context.user_history.len() > 10 && self.config.enable_user_personalization {
            "learning_based".to_string()
        } else if self.config.enable_context_awareness {
            "context_aware".to_string()
        } else {
            "weighted_random".to_string()
        }
    }

    /// Extract context features from decision context
    fn extract_context_features(&self, context: &DecisionContext) -> ContextFeatures {
        let time_of_day = (context.current_time / 3600) % 24;
        let day_of_week = ((context.current_time / 86400) + 3) % 7; // 0 = Monday

        let session_length = if !context.user_history.is_empty() {
            let first_interaction = context.user_history.first().unwrap().timestamp;
            (context.current_time - first_interaction) as f64 / 3600.0 // Hours
        } else {
            0.0
        };

        let interaction_count = context.user_history.len() as f64;

        let response_quality_avg = if !context.user_history.is_empty() {
            context.user_history.iter().map(|i| i.response_quality).sum::<f64>() / context.user_history.len() as f64
        } else {
            0.5
        };

        ContextFeatures {
            time_of_day: time_of_day as f64 / 24.0,
            day_of_week: day_of_week as f64 / 7.0,
            session_length: (session_length / 24.0).min(1.0), // Normalize to 0-1
            interaction_count: (interaction_count / 100.0).min(1.0), // Normalize
            response_quality_avg,
            custom_features: context.context_features.clone(),
        }
    }

    /// Get engine statistics
    pub async fn get_stats(&self) -> HashMap<String, usize> {
        let mut stats = HashMap::new();
        stats.insert("strategies".to_string(), self.strategies.len());
        stats.extend(self.learning_engine.get_stats().await);
        stats
    }
}

/// Weighted Random Strategy - balances exploration and exploitation
pub struct WeightedRandomStrategy {
    exploration_rate: f64,
}

impl WeightedRandomStrategy {
    pub fn new(exploration_rate: f64) -> Self {
        Self { exploration_rate }
    }
}

#[async_trait]
impl DecisionStrategy for WeightedRandomStrategy {
    async fn decide(&self, context: &DecisionContext, options: &[String]) -> IntelligenceResult<DecisionResult> {
        let mut rng = thread_rng();

        // Exploration: random choice
        if rng.gen::<f64>() < self.exploration_rate {
            let random_idx = rng.gen_range(0..options.len());
            let decision = options[random_idx].clone();

            return Ok(DecisionResult {
                decision,
                confidence: 0.5,
                reasoning: vec!["Exploration: Random selection".to_string()],
                alternatives: options.iter().enumerate()
                    .filter(|(i, _)| *i != random_idx)
                    .take(3)
                    .map(|(_, opt)| (opt.clone(), 0.5))
                    .collect(),
                learning_insights: vec!["Exploring new options".to_string()],
            });
        }

        // Exploitation: weighted choice based on historical performance
        let mut weights = Vec::new();
        let mut total_weight = 0.0;

        for option in options {
            let weight = context.user_history
                .iter()
                .filter(|h| h.model_used == *option)
                .map(|h| h.response_quality)
                .sum::<f64>()
                .max(0.1); // Minimum weight

            weights.push(weight);
            total_weight += weight;
        }

        // Normalize weights
        for weight in &mut weights {
            *weight /= total_weight;
        }

        // Select based on weights
        let random_value = rng.gen::<f64>();
        let mut cumulative_weight = 0.0;

        for (i, &weight) in weights.iter().enumerate() {
            cumulative_weight += weight;
            if random_value <= cumulative_weight {
                let decision = options[i].clone();

                return Ok(DecisionResult {
                    decision,
                    confidence: weights[i],
                    reasoning: vec![format!("Exploitation: Historical performance ({:.2})", weights[i])],
                    alternatives: options.iter().enumerate()
                        .filter(|(idx, _)| *idx != i)
                        .take(3)
                        .map(|(_, opt)| (opt.clone(), weights[options.iter().position(|o| o == opt).unwrap()]))
                        .collect(),
                    learning_insights: vec!["Using historical performance data".to_string()],
                });
            }
        }

        // Fallback to first option
        Ok(DecisionResult {
            decision: options[0].clone(),
            confidence: 0.5,
            reasoning: vec!["Fallback selection".to_string()],
            alternatives: vec![],
            learning_insights: vec!["No clear preference".to_string()],
        })
    }

    fn name(&self) -> &str {
        "weighted_random"
    }
}

/// Context-Aware Strategy - considers time, session, and system factors
pub struct ContextAwareStrategy;

#[async_trait]
impl DecisionStrategy for ContextAwareStrategy {
    async fn decide(&self, context: &DecisionContext, options: &[String]) -> IntelligenceResult<DecisionResult> {
        let current_hour = (context.current_time / 3600) % 24;

        // Time-based preferences
        let time_preference = if current_hour >= 9 && current_hour <= 17 {
            "work_hours".to_string()
        } else {
            "off_hours".to_string()
        };

        // Session-based preferences
        let session_preference = if context.user_history.len() > 5 {
            "experienced_user".to_string()
        } else {
            "new_user".to_string()
        };

        // System load consideration
        let system_load = context.system_metrics.get("cpu_usage").copied().unwrap_or(0.5);
        let load_preference = if system_load > 0.8 {
            "lightweight".to_string()
        } else {
            "any".to_string()
        };

        // Score options based on preferences
        let mut scored_options: Vec<(String, f64)> = options
            .iter()
            .map(|option| {
                let mut score = 0.5; // Base score

                // Time preference scoring
                if option.contains("turbo") && time_preference == "work_hours" {
                    score += 0.2;
                }

                // Session preference scoring
                if session_preference == "experienced_user" && option.contains("4") {
                    score += 0.1;
                }

                // Load preference scoring
                if load_preference == "lightweight" && option.contains("3.5") {
                    score += 0.2;
                }

                (option.clone(), score)
            })
            .collect();

        scored_options.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let best_option = scored_options[0].clone();
        let alternatives = scored_options.into_iter().skip(1).take(3).collect();

        Ok(DecisionResult {
            decision: best_option.0,
            confidence: best_option.1,
            reasoning: vec![
                format!("Time preference: {}", time_preference),
                format!("Session context: {}", session_preference),
                format!("System load: {:.1}%", system_load * 100.0),
            ],
            alternatives,
            learning_insights: vec![
                "Context-aware decision making".to_string(),
                format!("Current hour: {}", current_hour),
            ],
        })
    }

    fn name(&self) -> &str {
        "context_aware"
    }
}

/// Learning-Based Strategy - uses machine learning predictions
pub struct LearningBasedStrategy;

#[async_trait]
impl DecisionStrategy for LearningBasedStrategy {
    async fn decide(&self, _context: &DecisionContext, options: &[String]) -> IntelligenceResult<DecisionResult> {
        // For now, use simple scoring. In a real implementation, this would use
        // the learning engine to make predictions.

        let mut scored_options: Vec<(String, f64)> = options
            .iter()
            .enumerate()
            .map(|(i, option)| {
                let score = 0.5 + (i as f64 * 0.1); // Simple scoring for demo
                (option.clone(), score.min(1.0))
            })
            .collect();

        scored_options.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        let best_option = scored_options[0].clone();
        let alternatives = scored_options.into_iter().skip(1).take(3).collect();

        Ok(DecisionResult {
            decision: best_option.0,
            confidence: best_option.1,
            reasoning: vec!["Learning-based prediction".to_string()],
            alternatives,
            learning_insights: vec!["Using learned user preferences".to_string()],
        })
    }

    fn name(&self) -> &str {
        "learning_based"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_context() -> DecisionContext {
        DecisionContext {
            user_id: "test_user".to_string(),
            session_id: "test_session".to_string(),
            request_type: "chat".to_string(),
            current_time: 1640995200, // 2022-01-01 00:00:00
            user_history: vec![],
            system_metrics: HashMap::new(),
            context_features: HashMap::new(),
        }
    }

    #[tokio::test]
    async fn test_decision_engine_creation() {
        let config = DecisionConfig::default();
        let learning_engine = LearningEngine::default();
        let engine = DecisionEngine::new(config, learning_engine);

        let stats = engine.get_stats().await;
        assert!(stats.contains_key("strategies"));
        assert!(stats["strategies"] >= 3); // At least 3 default strategies
    }

    #[tokio::test]
    async fn test_weighted_random_strategy() {
        let strategy = WeightedRandomStrategy::new(0.5);
        let context = create_test_context();
        let options = vec!["option1".to_string(), "option2".to_string(), "option3".to_string()];

        let result = strategy.decide(&context, &options).await.unwrap();
        assert!(options.contains(&result.decision));
        assert!(result.confidence >= 0.0 && result.confidence <= 1.0);
    }

    #[tokio::test]
    async fn test_context_aware_strategy() {
        let strategy = ContextAwareStrategy;
        let mut context = create_test_context();
        context.current_time = 1640995200 + (12 * 3600); // Noon
        let options = vec!["gpt-3.5-turbo".to_string(), "gpt-4".to_string()];

        let result = strategy.decide(&context, &options).await.unwrap();
        assert!(options.contains(&result.decision));
        assert!(result.reasoning.len() > 0);
    }
}
