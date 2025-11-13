//! Common types for Sira VCP

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};

/// Thinking context - the environment and state for reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingContext {
    pub session_id: String,
    pub user_id: String,
    pub task_type: String,
    pub complexity_level: ComplexityLevel,
    pub time_constraint: Option<u64>, // seconds
    pub resource_limits: ResourceLimits,
    pub domain_knowledge: HashMap<String, f64>, // domain -> confidence
    pub emotional_state: EmotionalState,
    pub cognitive_load: f64, // 0.0 to 1.0
}

/// Complexity levels for reasoning tasks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ComplexityLevel {
    Simple,
    Moderate,
    Complex,
    UltraComplex,
}

/// Emotional states affecting reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionalState {
    pub confidence: f64,      // 0.0 to 1.0
    pub curiosity: f64,       // 0.0 to 1.0
    pub frustration: f64,     // 0.0 to 1.0
    pub satisfaction: f64,    // 0.0 to 1.0
}

/// Resource limits for thinking processes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_depth: u32,
    pub max_branches: u32,
    pub max_iterations: u32,
    pub time_budget_ms: u64,
    pub memory_budget_mb: u64,
}

/// Reasoning goal - what we want to achieve
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningGoal {
    pub id: String,
    pub description: String,
    pub target_confidence: f64,
    pub success_criteria: Vec<SuccessCriterion>,
    pub constraints: Vec<Constraint>,
}

/// Success criteria for evaluating reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuccessCriterion {
    pub metric: String,
    pub operator: ComparisonOperator,
    pub threshold: f64,
    pub weight: f64,
}

/// Comparison operators
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComparisonOperator {
    GreaterThan,
    LessThan,
    Equal,
    GreaterEqual,
    LessEqual,
    NotEqual,
}

/// Constraints on reasoning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    pub constraint_type: ConstraintType,
    pub description: String,
    pub penalty: f64,
}

/// Types of constraints
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConstraintType {
    TimeLimit,
    ResourceLimit,
    Ethical,
    DomainSpecific,
    Quality,
}

/// Thinking strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThinkingStrategy {
    pub exploration_rate: f64,         // How much to explore vs exploit
    pub recursion_depth: u32,          // Maximum recursion depth
    pub branching_factor: u32,         // Maximum branches per node
    pub quality_threshold: f64,        // Minimum quality threshold
    pub adaptation_rate: f64,          // How quickly to adapt
    pub metacognition_enabled: bool,   // Enable meta-cognitive monitoring
}

/// Chain generation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainGenerationParams {
    pub context: ThinkingContext,
    pub goal: ReasoningGoal,
    pub strategy: ThinkingStrategy,
    pub available_heuristics: Vec<String>,
    pub domain_experts: Vec<String>,
}

/// Reasoning quality metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningQuality {
    pub logical_consistency: f64,      // 0.0 to 1.0
    pub completeness: f64,             // 0.0 to 1.0
    pub relevance: f64,                // 0.0 to 1.0
    pub novelty: f64,                  // 0.0 to 1.0
    pub efficiency: f64,               // 0.0 to 1.0
    pub adaptability: f64,             // 0.0 to 1.0
}

/// Meta-cognitive assessment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetacognitiveAssessment {
    pub current_confidence: f64,
    pub progress_rate: f64,
    pub stuck_probability: f64,
    pub quality_trend: QualityTrend,
    pub resource_efficiency: f64,
    pub recommended_actions: Vec<RecommendedAction>,
}

/// Quality trend over time
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QualityTrend {
    Improving,
    Stable,
    Declining,
    Oscillating,
}

/// Recommended actions for meta-cognition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendedAction {
    IncreaseDepth,
    ReduceBranching,
    ChangeStrategy,
    AddHeuristic(String),
    RemoveConstraint(String),
    SeekHelp(String),
    TakeBreak,
    AdjustExploration(f64),
}

/// Adaptive parameters for dynamic adjustment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveParameters {
    pub strategy_weights: HashMap<String, f64>,
    pub heuristic_effectiveness: HashMap<String, f64>,
    pub domain_confidence: HashMap<String, f64>,
    pub pattern_recognition: Vec<ReasoningPattern>,
}

/// Reasoning patterns learned from experience
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningPattern {
    pub pattern_id: String,
    pub context_signature: Vec<String>,
    pub successful_strategy: String,
    pub success_rate: f64,
    pub average_quality: f64,
    pub usage_count: u64,
    pub last_used: DateTime<Utc>,
}

/// VCP execution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VcpExecutionStats {
    pub total_chains_generated: u64,
    pub successful_chains: u64,
    pub average_chain_length: f64,
    pub average_execution_time_ms: f64,
    pub average_quality_score: f64,
    pub adaptation_events: u64,
    pub metacognitive_interventions: u64,
}

/// Chain execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainExecutionResult {
    pub chain_id: String,
    pub success: bool,
    pub final_answer: Option<String>,
    pub confidence: f64,
    pub quality_metrics: ReasoningQuality,
    pub execution_stats: ExecutionStats,
    pub metacognitive_history: Vec<MetacognitiveAssessment>,
    pub adaptation_log: Vec<String>,
}

/// Execution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionStats {
    pub total_nodes: u64,
    pub executed_nodes: u64,
    pub skipped_nodes: u64,
    pub failed_nodes: u64,
    pub max_depth_reached: u32,
    pub total_execution_time_ms: u64,
    pub memory_peak_mb: u64,
    pub api_calls_made: u64,
}
