//! Common types for Sira Intelligence

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// User interaction data for learning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInteraction {
    pub user_id: String,
    pub session_id: String,
    pub timestamp: u64,
    pub request_type: String,
    pub model_used: String,
    pub response_quality: f64, // 0.0 to 1.0
    pub response_time: u64,    // milliseconds
    pub user_feedback: Option<f64>, // Optional user rating
    pub context_features: HashMap<String, f64>,
}

/// Learning pattern extracted from user interactions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningPattern {
    pub pattern_id: String,
    pub user_id: String,
    pub pattern_type: PatternType,
    pub confidence: f64,
    pub features: HashMap<String, f64>,
    pub predictions: Vec<String>,
    pub last_updated: u64,
}

/// Pattern types for learning
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PatternType {
    ModelPreference,
    TimeOfDay,
    TaskType,
    ResponseStyle,
    ContextAwareness,
}

impl std::fmt::Display for PatternType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PatternType::ModelPreference => write!(f, "model_preference"),
            PatternType::TimeOfDay => write!(f, "time_of_day"),
            PatternType::TaskType => write!(f, "task_type"),
            PatternType::ResponseStyle => write!(f, "response_style"),
            PatternType::ContextAwareness => write!(f, "context_awareness"),
        }
    }
}

/// Decision context for making intelligent choices
#[derive(Debug, Clone)]
pub struct DecisionContext {
    pub user_id: String,
    pub session_id: String,
    pub request_type: String,
    pub current_time: u64,
    pub user_history: Vec<UserInteraction>,
    pub system_metrics: HashMap<String, f64>,
    pub context_features: HashMap<String, f64>,
}

/// Decision result with reasoning
#[derive(Debug, Clone)]
pub struct DecisionResult {
    pub decision: String,
    pub confidence: f64,
    pub reasoning: Vec<String>,
    pub alternatives: Vec<(String, f64)>, // Alternative options with scores
    pub learning_insights: Vec<String>,
}

/// Context features for analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextFeatures {
    pub time_of_day: f64,        // 0.0 (midnight) to 1.0 (11:59 PM)
    pub day_of_week: f64,        // 0.0 (Monday) to 1.0 (Sunday)
    pub session_length: f64,     // Normalized session duration
    pub interaction_count: f64,  // Number of interactions in session
    pub response_quality_avg: f64, // Average response quality
    pub custom_features: HashMap<String, f64>,
}

/// Learning configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LearningConfig {
    pub learning_rate: f64,
    pub pattern_decay_factor: f64,
    pub min_confidence_threshold: f64,
    pub max_patterns_per_user: usize,
    pub pattern_update_interval: u64, // seconds
    pub enable_real_time_learning: bool,
}

impl Default for LearningConfig {
    fn default() -> Self {
        Self {
            learning_rate: 0.1,
            pattern_decay_factor: 0.95,
            min_confidence_threshold: 0.6,
            max_patterns_per_user: 50,
            pattern_update_interval: 3600, // 1 hour
            enable_real_time_learning: true,
        }
    }
}

/// Decision engine configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionConfig {
    pub exploration_rate: f64,         // Probability of trying new options
    pub confidence_threshold: f64,     // Minimum confidence to make decisions
    pub max_alternatives: usize,       // Maximum alternatives to consider
    pub enable_context_awareness: bool,
    pub enable_user_personalization: bool,
}

impl Default for DecisionConfig {
    fn default() -> Self {
        Self {
            exploration_rate: 0.1,
            confidence_threshold: 0.7,
            max_alternatives: 5,
            enable_context_awareness: true,
            enable_user_personalization: true,
        }
    }
}

/// Intelligence engine configuration
#[derive(Debug, Clone)]
pub struct IntelligenceConfig {
    pub learning: LearningConfig,
    pub decision: DecisionConfig,
    pub enabled: bool,
}

impl Default for IntelligenceConfig {
    fn default() -> Self {
        Self {
            learning: LearningConfig::default(),
            decision: DecisionConfig::default(),
            enabled: true,
        }
    }
}
