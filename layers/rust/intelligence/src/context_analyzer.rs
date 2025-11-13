//! Context Analyzer for Sira Intelligence

use crate::{IntelligenceResult, IntelligenceError, ContextFeatures, UserInteraction};
use async_trait::async_trait;
use std::collections::HashMap;
use tracing::{debug, info};

/// Context analysis trait
#[async_trait]
pub trait ContextAnalyzer: Send + Sync {
    /// Analyze user context from interactions
    async fn analyze_context(&self, interactions: &[UserInteraction]) -> IntelligenceResult<ContextFeatures>;

    /// Extract features from current session
    async fn extract_session_features(&self, session_interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>>;

    /// Get analyzer name
    fn name(&self) -> &str;
}

/// Intelligent Context Analyzer
pub struct IntelligentContextAnalyzer {
    feature_extractors: Vec<Box<dyn ContextFeatureExtractor>>,
}

impl IntelligentContextAnalyzer {
    /// Create a new context analyzer
    pub fn new() -> Self {
        let mut feature_extractors = Vec::new();

        // Add default feature extractors
        feature_extractors.push(Box::new(TimeBasedExtractor) as Box<dyn ContextFeatureExtractor>);
        feature_extractors.push(Box::new(SessionBasedExtractor) as Box<dyn ContextFeatureExtractor>);
        feature_extractors.push(Box::new(PerformanceBasedExtractor) as Box<dyn ContextFeatureExtractor>);
        feature_extractors.push(Box::new(PatternBasedExtractor) as Box<dyn ContextFeatureExtractor>);

        Self { feature_extractors }
    }

    /// Add a custom feature extractor
    pub fn add_extractor(&mut self, extractor: Box<dyn ContextFeatureExtractor>) {
        let name = extractor.name().to_string();
        self.feature_extractors.push(extractor);
        info!("Added feature extractor: {}", name);
    }
}

#[async_trait]
impl ContextAnalyzer for IntelligentContextAnalyzer {
    async fn analyze_context(&self, interactions: &[UserInteraction]) -> IntelligenceResult<ContextFeatures> {
        if interactions.is_empty() {
            return Ok(ContextFeatures {
                time_of_day: 0.0,
                day_of_week: 0.0,
                session_length: 0.0,
                interaction_count: 0.0,
                response_quality_avg: 0.5,
                custom_features: HashMap::new(),
            });
        }

        debug!("Analyzing context from {} interactions", interactions.len());

        // Extract basic features
        let latest_interaction = interactions.last().unwrap();
        let current_time = latest_interaction.timestamp;

        let time_of_day = ((current_time / 3600) % 24) as f64 / 24.0;
        let day_of_week = (((current_time / 86400) + 3) % 7) as f64 / 7.0; // 0 = Monday

        // Calculate session length (time from first to last interaction)
        let session_length = if interactions.len() > 1 {
            let first_time = interactions.first().unwrap().timestamp;
            let last_time = latest_interaction.timestamp;
            (last_time - first_time) as f64 / 3600.0 // Hours
        } else {
            0.0
        };

        let interaction_count = interactions.len() as f64;

        // Calculate average response quality
        let response_quality_avg = interactions
            .iter()
            .map(|i| i.response_quality)
            .sum::<f64>() / interactions.len() as f64;

        // Extract custom features using all extractors
        let mut custom_features = HashMap::new();
        for extractor in &self.feature_extractors {
            match extractor.extract_features(interactions).await {
                Ok(features) => {
                    custom_features.extend(features);
                }
                Err(e) => {
                    debug!("Feature extractor {} failed: {:?}", extractor.name(), e);
                }
            }
        }

        Ok(ContextFeatures {
            time_of_day,
            day_of_week,
            session_length: (session_length / 24.0).min(1.0), // Normalize to 0-1
            interaction_count: (interaction_count / 100.0).min(1.0), // Normalize
            response_quality_avg,
            custom_features,
        })
    }

    async fn extract_session_features(&self, session_interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>> {
        let mut features = HashMap::new();

        for extractor in &self.feature_extractors {
            if let Ok(extractor_features) = extractor.extract_features(session_interactions).await {
                features.extend(extractor_features);
            }
        }

        // Add session-specific features
        if !session_interactions.is_empty() {
            let avg_response_time = session_interactions
                .iter()
                .map(|i| i.response_time as f64)
                .sum::<f64>() / session_interactions.len() as f64;

            let quality_variance = {
                let avg_quality = session_interactions
                    .iter()
                    .map(|i| i.response_quality)
                    .sum::<f64>() / session_interactions.len() as f64;

                session_interactions
                    .iter()
                    .map(|i| (i.response_quality - avg_quality).powi(2))
                    .sum::<f64>() / session_interactions.len() as f64
            };

            features.insert("session_avg_response_time".to_string(), avg_response_time / 10000.0); // Normalize
            features.insert("session_quality_variance".to_string(), quality_variance);
            features.insert("session_length_minutes".to_string(),
                (session_interactions.last().unwrap().timestamp - session_interactions.first().unwrap().timestamp) as f64 / 60.0);
        }

        Ok(features)
    }

    fn name(&self) -> &str {
        "intelligent_context_analyzer"
    }
}

/// Context feature extractor trait
#[async_trait]
pub trait ContextFeatureExtractor: Send + Sync {
    /// Extract features from interactions
    async fn extract_features(&self, interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>>;

    /// Get extractor name
    fn name(&self) -> &str;
}

/// Time-based feature extractor
pub struct TimeBasedExtractor;

#[async_trait]
impl ContextFeatureExtractor for TimeBasedExtractor {
    async fn extract_features(&self, interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>> {
        let mut features = HashMap::new();

        if interactions.is_empty() {
            return Ok(features);
        }

        let latest = interactions.last().unwrap();
        let current_hour = (latest.timestamp / 3600) % 24;
        let current_day = (latest.timestamp / 86400) % 7;

        // Time preferences
        features.insert("is_work_hours".to_string(), if current_hour >= 9 && current_hour <= 17 { 1.0 } else { 0.0 });
        features.insert("is_weekend".to_string(), if current_day >= 5 { 1.0 } else { 0.0 });
        features.insert("is_evening".to_string(), if current_hour >= 18 && current_hour <= 23 { 1.0 } else { 0.0 });
        features.insert("is_morning".to_string(), if current_hour >= 6 && current_hour <= 11 { 1.0 } else { 0.0 });

        // Time patterns from history
        let morning_count = interactions.iter().filter(|i| {
            let hour = (i.timestamp / 3600) % 24;
            hour >= 6 && hour <= 11
        }).count();

        let evening_count = interactions.iter().filter(|i| {
            let hour = (i.timestamp / 3600) % 24;
            hour >= 18 && hour <= 23
        }).count();

        let total = interactions.len() as f64;
        features.insert("morning_usage_ratio".to_string(), morning_count as f64 / total);
        features.insert("evening_usage_ratio".to_string(), evening_count as f64 / total);

        Ok(features)
    }

    fn name(&self) -> &str {
        "time_based_extractor"
    }
}

/// Session-based feature extractor
pub struct SessionBasedExtractor;

#[async_trait]
impl ContextFeatureExtractor for SessionBasedExtractor {
    async fn extract_features(&self, interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>> {
        let mut features = HashMap::new();

        if interactions.is_empty() {
            return Ok(features);
        }

        let interaction_count = interactions.len() as f64;
        features.insert("interaction_count".to_string(), interaction_count);

        // Session duration
        if interactions.len() > 1 {
            let duration = interactions.last().unwrap().timestamp - interactions.first().unwrap().timestamp;
            features.insert("session_duration_seconds".to_string(), duration as f64);
            features.insert("session_duration_minutes".to_string(), duration as f64 / 60.0);
        }

        // Interaction frequency
        if interactions.len() > 1 {
            let avg_interval = if interactions.len() > 1 {
                let intervals: Vec<_> = interactions.windows(2)
                    .map(|w| w[1].timestamp - w[0].timestamp)
                    .collect();
                intervals.iter().sum::<u64>() as f64 / intervals.len() as f64
            } else {
                0.0
            };
            features.insert("avg_interaction_interval".to_string(), avg_interval);
        }

        // Session type classification
        let session_type = if interaction_count < 3.0 {
            0.0 // Short session
        } else if interaction_count < 10.0 {
            0.5 // Medium session
        } else {
            1.0 // Long session
        };
        features.insert("session_type".to_string(), session_type);

        Ok(features)
    }

    fn name(&self) -> &str {
        "session_based_extractor"
    }
}

/// Performance-based feature extractor
pub struct PerformanceBasedExtractor;

#[async_trait]
impl ContextFeatureExtractor for PerformanceBasedExtractor {
    async fn extract_features(&self, interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>> {
        let mut features = HashMap::new();

        if interactions.is_empty() {
            return Ok(features);
        }

        // Response quality metrics
        let qualities: Vec<f64> = interactions.iter().map(|i| i.response_quality).collect();
        let avg_quality = qualities.iter().sum::<f64>() / qualities.len() as f64;
        features.insert("avg_response_quality".to_string(), avg_quality);

        // Quality trend (recent vs overall)
        let recent_count = (interactions.len() / 3).max(1);
        let recent_qualities = &qualities[qualities.len().saturating_sub(recent_count)..];
        let recent_avg = recent_qualities.iter().sum::<f64>() / recent_qualities.len() as f64;

        features.insert("recent_avg_quality".to_string(), recent_avg);
        features.insert("quality_trend".to_string(), recent_avg - avg_quality);

        // Response time metrics
        let response_times: Vec<f64> = interactions.iter().map(|i| i.response_time as f64).collect();
        let avg_response_time = response_times.iter().sum::<f64>() / response_times.len() as f64;
        features.insert("avg_response_time".to_string(), avg_response_time);

        // Fast vs slow responses
        let fast_responses = response_times.iter().filter(|&&t| t < 2000.0).count() as f64;
        features.insert("fast_response_ratio".to_string(), fast_responses / response_times.len() as f64);

        // Performance consistency
        let quality_std = {
            let variance = qualities.iter()
                .map(|q| (q - avg_quality).powi(2))
                .sum::<f64>() / qualities.len() as f64;
            variance.sqrt()
        };
        features.insert("quality_consistency".to_string(), 1.0 - quality_std.min(1.0)); // Higher is more consistent

        Ok(features)
    }

    fn name(&self) -> &str {
        "performance_based_extractor"
    }
}

/// Pattern-based feature extractor
pub struct PatternBasedExtractor;

#[async_trait]
impl ContextFeatureExtractor for PatternBasedExtractor {
    async fn extract_features(&self, interactions: &[UserInteraction]) -> IntelligenceResult<HashMap<String, f64>> {
        let mut features = HashMap::new();

        if interactions.len() < 3 {
            return Ok(features);
        }

        // Model usage patterns
        let mut model_counts = HashMap::new();
        for interaction in interactions {
            *model_counts.entry(interaction.model_used.clone()).or_insert(0) += 1;
        }

        let total = interactions.len() as f64;
        let mut preferred_model: Option<String> = None;
        let mut max_count = 0;

        for (model, count) in &model_counts {
            features.insert(format!("model_{}_usage_ratio", model.replace("-", "_")),
                *count as f64 / total);

            if *count > max_count {
                max_count = *count;
                preferred_model = Some(model.clone());
            }
        }

        // Preferred model (highest usage)
        if let Some(preferred_model) = preferred_model {
            features.insert("has_preferred_model".to_string(), 1.0);
            features.insert(format!("preferred_model_{}", preferred_model.replace("-", "_")), 1.0);
        }

        // Request type patterns
        let mut request_counts = HashMap::new();
        for interaction in interactions {
            *request_counts.entry(interaction.request_type.clone()).or_insert(0) += 1;
        }

        for (request_type, count) in request_counts {
            features.insert(format!("request_{}_ratio", request_type),
                count as f64 / total);
        }

        // Usage streaks (consecutive good/bad responses)
        let mut good_streak = 0;
        let mut max_good_streak = 0;
        let mut bad_streak = 0;
        let mut max_bad_streak = 0;

        for interaction in interactions {
            if interaction.response_quality > 0.7 {
                good_streak += 1;
                bad_streak = 0;
                max_good_streak = max_good_streak.max(good_streak);
            } else {
                bad_streak += 1;
                good_streak = 0;
                max_bad_streak = max_bad_streak.max(bad_streak);
            }
        }

        features.insert("max_good_streak".to_string(), max_good_streak as f64);
        features.insert("max_bad_streak".to_string(), max_bad_streak as f64);

        Ok(features)
    }

    fn name(&self) -> &str {
        "pattern_based_extractor"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_interactions() -> Vec<UserInteraction> {
        vec![
            UserInteraction {
                user_id: "test_user".to_string(),
                session_id: "session_1".to_string(),
                timestamp: 1640995200, // 2022-01-01 00:00:00
                request_type: "chat".to_string(),
                model_used: "gpt-3.5-turbo".to_string(),
                response_quality: 0.8,
                response_time: 1500,
                user_feedback: Some(0.7),
                context_features: HashMap::new(),
            },
            UserInteraction {
                user_id: "test_user".to_string(),
                session_id: "session_1".to_string(),
                timestamp: 1640995260, // 1 minute later
                request_type: "chat".to_string(),
                model_used: "gpt-4".to_string(),
                response_quality: 0.9,
                response_time: 3000,
                user_feedback: Some(0.9),
                context_features: HashMap::new(),
            },
        ]
    }

    #[tokio::test]
    async fn test_context_analyzer_creation() {
        let analyzer = IntelligentContextAnalyzer::new();
        assert_eq!(analyzer.name(), "intelligent_context_analyzer");
    }

    #[tokio::test]
    async fn test_analyze_context() {
        let analyzer = IntelligentContextAnalyzer::new();
        let interactions = create_test_interactions();

        let context = analyzer.analyze_context(&interactions).await.unwrap();

        assert!(context.time_of_day >= 0.0 && context.time_of_day <= 1.0);
        assert!(context.day_of_week >= 0.0 && context.day_of_week <= 1.0);
        assert!(context.session_length >= 0.0 && context.session_length <= 1.0);
        assert_eq!(context.interaction_count, 0.02); // 2/100
        assert!((context.response_quality_avg - 0.85).abs() < 0.001);
        assert!(!context.custom_features.is_empty());
    }

    #[tokio::test]
    async fn test_extract_session_features() {
        let analyzer = IntelligentContextAnalyzer::new();
        let interactions = create_test_interactions();

        let features = analyzer.extract_session_features(&interactions).await.unwrap();

        assert!(features.contains_key("session_avg_response_time"));
        assert!(features.contains_key("session_quality_variance"));
        assert!(features.contains_key("session_length_minutes"));
    }

    #[tokio::test]
    async fn test_time_based_extractor() {
        let extractor = TimeBasedExtractor;
        let interactions = create_test_interactions();

        let features = extractor.extract_features(&interactions).await.unwrap();

        assert!(features.contains_key("is_work_hours"));
        assert!(features.contains_key("morning_usage_ratio"));
        assert!(features.contains_key("evening_usage_ratio"));
    }

    #[tokio::test]
    async fn test_performance_based_extractor() {
        let extractor = PerformanceBasedExtractor;
        let interactions = create_test_interactions();

        let features = extractor.extract_features(&interactions).await.unwrap();

        assert!(features.contains_key("avg_response_quality"));
        assert!(features.contains_key("recent_avg_quality"));
        assert!(features.contains_key("quality_trend"));
        assert!(features.contains_key("avg_response_time"));
        assert!(features.contains_key("quality_consistency"));
    }
}
