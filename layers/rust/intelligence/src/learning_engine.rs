//! Adaptive Learning Engine for Sira Intelligence

use crate::{IntelligenceResult, IntelligenceError, UserInteraction, LearningPattern, PatternType, ContextFeatures, LearningConfig};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug, warn};

/// Learning algorithm trait
#[async_trait]
pub trait LearningAlgorithm: Send + Sync {
    /// Learn from user interaction
    async fn learn(&self, interaction: &UserInteraction) -> IntelligenceResult<Vec<LearningPattern>>;

    /// Predict based on context
    async fn predict(&self, context: &ContextFeatures) -> IntelligenceResult<HashMap<String, f64>>;

    /// Get algorithm name
    fn name(&self) -> &str;
}

/// Adaptive Learning Engine
pub struct LearningEngine {
    config: LearningConfig,
    algorithms: Arc<RwLock<HashMap<String, Box<dyn LearningAlgorithm>>>>,
    user_patterns: Arc<RwLock<HashMap<String, Vec<LearningPattern>>>>,
    global_patterns: Arc<RwLock<Vec<LearningPattern>>>,
}

impl LearningEngine {
    /// Create a new learning engine
    pub fn new(config: LearningConfig) -> Self {
        Self {
            config,
            algorithms: Arc::new(RwLock::new(HashMap::new())),
            user_patterns: Arc::new(RwLock::new(HashMap::new())),
            global_patterns: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Add a learning algorithm
    pub async fn add_algorithm(&self, algorithm: Box<dyn LearningAlgorithm>) -> IntelligenceResult<()> {
        let mut algorithms = self.algorithms.write().await;
        let name = algorithm.name().to_string();
        algorithms.insert(name.clone(), algorithm);
        info!("Added learning algorithm: {}", name);
        Ok(())
    }

    /// Process user interaction and learn from it
    pub async fn process_interaction(&self, interaction: UserInteraction) -> IntelligenceResult<()> {
        debug!("Processing interaction for user: {}", interaction.user_id);

        // Apply all learning algorithms
        let algorithms = self.algorithms.read().await;
        let mut all_patterns = Vec::new();

        for algorithm in algorithms.values() {
            match algorithm.learn(&interaction).await {
                Ok(patterns) => {
                    all_patterns.extend(patterns);
                }
                Err(e) => {
                    warn!("Algorithm {} failed to learn: {:?}", algorithm.name(), e);
                }
            }
        }

        // Store patterns
        self.store_patterns(&interaction.user_id, all_patterns).await?;

        // Decay old patterns
        self.decay_patterns(&interaction.user_id).await?;

        Ok(())
    }

    /// Get predictions for user context
    pub async fn get_predictions(&self, user_id: &str, context: &ContextFeatures) -> IntelligenceResult<HashMap<String, f64>> {
        let mut predictions = HashMap::new();

        // Get user-specific patterns
        let user_patterns = self.get_user_patterns(user_id).await;

        // Get global patterns
        let global_patterns = self.global_patterns.read().await.clone();

        // Combine predictions from all algorithms
        let algorithms = self.algorithms.read().await;

        for algorithm in algorithms.values() {
            if let Ok(algo_predictions) = algorithm.predict(context).await {
                for (key, value) in algo_predictions {
                    let existing = predictions.entry(key).or_insert(0.0);
                    *existing += value;
                }
            }
        }

        // Weight predictions based on user patterns
        for pattern in user_patterns {
            if pattern.confidence >= self.config.min_confidence_threshold {
                for prediction in &pattern.predictions {
                    let weight = predictions.entry(prediction.clone()).or_insert(0.0);
                    *weight *= (1.0 + pattern.confidence) / 2.0; // Boost confident predictions
                }
            }
        }

        Ok(predictions)
    }

    /// Get learning insights for user
    pub async fn get_insights(&self, user_id: &str) -> IntelligenceResult<HashMap<String, Vec<String>>> {
        let patterns = self.get_user_patterns(user_id).await;
        let mut insights = HashMap::new();

        for pattern in patterns {
            if pattern.confidence >= self.config.min_confidence_threshold {
                insights.entry(pattern.pattern_type.to_string())
                    .or_insert_with(Vec::new)
                    .extend(pattern.predictions.clone());
            }
        }

        Ok(insights)
    }

    /// Store learned patterns
    async fn store_patterns(&self, user_id: &str, patterns: Vec<LearningPattern>) -> IntelligenceResult<()> {
        let mut user_patterns = self.user_patterns.write().await;

        let user_pattern_list = user_patterns.entry(user_id.to_string()).or_insert_with(Vec::new);

        // Limit patterns per user
        for pattern in patterns {
            // Remove existing pattern of same type if it exists
            user_pattern_list.retain(|p| p.pattern_type != pattern.pattern_type || p.confidence >= pattern.confidence);

            if user_pattern_list.len() < self.config.max_patterns_per_user {
                user_pattern_list.push(pattern);
            }
        }

        // Sort by confidence (highest first)
        user_pattern_list.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());

        Ok(())
    }

    /// Decay old patterns over time
    async fn decay_patterns(&self, user_id: &str) -> IntelligenceResult<()> {
        let mut user_patterns = self.user_patterns.write().await;
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if let Some(patterns) = user_patterns.get_mut(user_id) {
            patterns.retain_mut(|pattern| {
                let age_seconds = current_time.saturating_sub(pattern.last_updated);
                let decay_factor = self.config.pattern_decay_factor.powf(age_seconds as f64 / 86400.0); // Daily decay

                pattern.confidence *= decay_factor;
                pattern.confidence >= self.config.min_confidence_threshold
            });
        }

        Ok(())
    }

    /// Get user patterns
    async fn get_user_patterns(&self, user_id: &str) -> Vec<LearningPattern> {
        let user_patterns = self.user_patterns.read().await;
        user_patterns.get(user_id).cloned().unwrap_or_default()
    }

    /// Get engine statistics
    pub async fn get_stats(&self) -> HashMap<String, usize> {
        let user_patterns = self.user_patterns.read().await;
        let global_patterns = self.global_patterns.read().await;
        let algorithms = self.algorithms.read().await;

        let mut stats = HashMap::new();
        stats.insert("users".to_string(), user_patterns.len());
        stats.insert("algorithms".to_string(), algorithms.len());
        stats.insert("global_patterns".to_string(), global_patterns.len());

        let total_user_patterns: usize = user_patterns.values().map(|v| v.len()).sum();
        stats.insert("user_patterns".to_string(), total_user_patterns);

        stats
    }
}

impl Default for LearningEngine {
    fn default() -> Self {
        Self::new(LearningConfig::default())
    }
}

/// Simple Collaborative Filtering Algorithm
pub struct CollaborativeFiltering;

#[async_trait]
impl LearningAlgorithm for CollaborativeFiltering {
    async fn learn(&self, interaction: &UserInteraction) -> IntelligenceResult<Vec<LearningPattern>> {
        let mut patterns = Vec::new();

        // Learn model preferences
        if interaction.response_quality > 0.7 {
            patterns.push(LearningPattern {
                pattern_id: format!("cf_{}_{}", interaction.user_id, interaction.model_used),
                user_id: interaction.user_id.clone(),
                pattern_type: PatternType::ModelPreference,
                confidence: interaction.response_quality,
                features: HashMap::from([
                    ("response_time".to_string(), interaction.response_time as f64),
                    ("quality".to_string(), interaction.response_quality),
                ]),
                predictions: vec![interaction.model_used.clone()],
                last_updated: interaction.timestamp,
            });
        }

        // Learn time-based patterns
        let hour_of_day = (interaction.timestamp / 3600) % 24;
        patterns.push(LearningPattern {
            pattern_id: format!("time_{}_{}", interaction.user_id, hour_of_day),
            user_id: interaction.user_id.clone(),
            pattern_type: PatternType::TimeOfDay,
            confidence: 0.5,
            features: HashMap::from([
                ("hour".to_string(), hour_of_day as f64),
                ("quality".to_string(), interaction.response_quality),
            ]),
            predictions: vec![format!("time_preference_{}", hour_of_day)],
            last_updated: interaction.timestamp,
        });

        Ok(patterns)
    }

    async fn predict(&self, context: &ContextFeatures) -> IntelligenceResult<HashMap<String, f64>> {
        let mut predictions = HashMap::new();

        // Predict based on time of day
        let hour = (context.time_of_day * 24.0) as u32;
        predictions.insert(format!("time_preference_{}", hour), 0.8);

        // Predict based on session context
        if context.interaction_count > 5.0 {
            predictions.insert("long_session".to_string(), 0.7);
        }

        Ok(predictions)
    }

    fn name(&self) -> &str {
        "collaborative_filtering"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_learning_engine_creation() {
        let engine = LearningEngine::default();
        let stats = engine.get_stats().await;
        assert_eq!(stats.get("users"), Some(&0));
        assert_eq!(stats.get("algorithms"), Some(&0));
    }

    #[tokio::test]
    async fn test_add_algorithm() {
        let engine = LearningEngine::default();
        let algorithm = Box::new(CollaborativeFiltering);
        engine.add_algorithm(algorithm).await.unwrap();

        let stats = engine.get_stats().await;
        assert_eq!(stats.get("algorithms"), Some(&1));
    }

    #[tokio::test]
    async fn test_process_interaction() {
        let engine = LearningEngine::default();
        let algorithm = Box::new(CollaborativeFiltering);
        engine.add_algorithm(algorithm).await.unwrap();

        let interaction = UserInteraction {
            user_id: "test_user".to_string(),
            session_id: "test_session".to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(), // Use current time
            request_type: "chat".to_string(),
            model_used: "gpt-3.5-turbo".to_string(),
            response_quality: 0.9,
            response_time: 1500,
            user_feedback: Some(0.8),
            context_features: HashMap::new(),
        };

        engine.process_interaction(interaction).await.unwrap();

        let stats = engine.get_stats().await;
        assert_eq!(stats.get("users"), Some(&1));
        assert!(stats.get("user_patterns").unwrap_or(&0) > &0);
    }

    #[tokio::test]
    async fn test_get_predictions() {
        let engine = LearningEngine::default();
        let algorithm = Box::new(CollaborativeFiltering);
        engine.add_algorithm(algorithm).await.unwrap();

        let context = ContextFeatures {
            time_of_day: 0.5, // Noon
            day_of_week: 0.0, // Monday
            session_length: 0.3,
            interaction_count: 10.0,
            response_quality_avg: 0.8,
            custom_features: HashMap::new(),
        };

        let predictions = engine.get_predictions("test_user", &context).await.unwrap();
        assert!(!predictions.is_empty());
    }
}
