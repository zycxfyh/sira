//! Adaptive learning engine for Sira Intelligence

use crate::{IntelligenceResult, IntelligenceError, DataPoint, LearningConfig, ModelType, AdaptationStrategy};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, debug, warn};

/// Learning model trait
#[async_trait]
pub trait LearningModel: Send + Sync {
    /// Train the model with data
    async fn train(&mut self, data: &[DataPoint]) -> IntelligenceResult<()>;

    /// Make prediction
    async fn predict(&self, features: &HashMap<String, f64>) -> IntelligenceResult<f64>;

    /// Get model accuracy score
    fn accuracy_score(&self) -> f64;

    /// Get model type
    fn model_type(&self) -> ModelType;
}

/// Simple linear regression model
pub struct LinearRegressionModel {
    weights: HashMap<String, f64>,
    bias: f64,
    accuracy_score: f64,
    trained_samples: usize,
}

impl LinearRegressionModel {
    pub fn new() -> Self {
        Self {
            weights: HashMap::new(),
            bias: 0.0,
            accuracy_score: 0.0,
            trained_samples: 0,
        }
    }
}

#[async_trait]
impl LearningModel for LinearRegressionModel {
    async fn train(&mut self, data: &[DataPoint]) -> IntelligenceResult<()> {
        if data.is_empty() {
            return Err(IntelligenceError::Data("No training data provided".to_string()));
        }

        // Simple gradient descent implementation
        let learning_rate = 0.01;
        let epochs = 100;

        // Initialize weights
        if let Some(first_point) = data.first() {
            for feature in first_point.features.keys() {
                self.weights.insert(feature.clone(), 0.0);
            }
        }

        for _ in 0..epochs {
            let mut total_error = 0.0;

            for point in data {
                let prediction = self.predict(&point.features).await?;
                let error = point.target - prediction;

                // Update bias
                self.bias += learning_rate * error;

                // Update weights
                for (feature, &value) in &point.features {
                    if let Some(weight) = self.weights.get_mut(feature) {
                        *weight += learning_rate * error * value;
                    }
                }

                total_error += error * error;
            }

            // Calculate mean squared error
            let mse = total_error / data.len() as f64;
            self.accuracy_score = 1.0 / (1.0 + mse); // Convert to accuracy-like score
        }

        self.trained_samples = data.len();
        info!("Trained linear regression model with {} samples, accuracy: {:.3}", data.len(), self.accuracy_score);

        Ok(())
    }

    async fn predict(&self, features: &HashMap<String, f64>) -> IntelligenceResult<f64> {
        let mut prediction = self.bias;

        for (feature, &value) in features {
            if let Some(&weight) = self.weights.get(feature) {
                prediction += weight * value;
            }
        }

        Ok(prediction)
    }

    fn accuracy_score(&self) -> f64 {
        self.accuracy_score
    }

    fn model_type(&self) -> ModelType {
        ModelType::LinearRegression
    }
}

/// Adaptive learning engine
pub struct AdaptiveLearningEngine {
    models: Arc<RwLock<HashMap<String, Box<dyn LearningModel>>>>,
    config: LearningConfig,
    adaptation_strategy: AdaptationStrategy,
    training_data: Arc<RwLock<Vec<DataPoint>>>,
    is_learning: Arc<RwLock<bool>>,
}

impl AdaptiveLearningEngine {
    /// Create a new adaptive learning engine
    pub fn new(config: LearningConfig, adaptation_strategy: AdaptationStrategy) -> Self {
        Self {
            models: Arc::new(RwLock::new(HashMap::new())),
            config,
            adaptation_strategy,
            training_data: Arc::new(RwLock::new(Vec::new())),
            is_learning: Arc::new(RwLock::new(false)),
        }
    }

    /// Add training data
    pub async fn add_training_data(&self, data: Vec<DataPoint>) -> IntelligenceResult<()> {
        let mut training_data = self.training_data.write().await;

        for point in data {
            training_data.push(point);
        }

        // Limit training data size
        let max_size = 10000; // Keep last 10k samples
        if training_data.len() > max_size {
            let excess = training_data.len() - max_size;
            training_data.drain(0..excess);
        }

        debug!("Added training data, total samples: {}", training_data.len());
        Ok(())
    }

    /// Train or update a model
    pub async fn train_model(&self, model_name: &str) -> IntelligenceResult<()> {
        let mut is_learning = self.is_learning.write().await;
        *is_learning = true;

        let training_data = self.training_data.read().await.clone();

        if training_data.len() < self.config.cross_validation_folds {
            *is_learning = false;
            return Err(IntelligenceError::Data(format!(
                "Insufficient training data: {} samples, need at least {}",
                training_data.len(),
                self.config.cross_validation_folds
            )));
        }

        // Create and train model
        let mut model: Box<dyn LearningModel> = match self.config.model_type.as_str() {
            "linear_regression" => Box::new(LinearRegressionModel::new()),
            _ => {
                *is_learning = false;
                return Err(IntelligenceError::Config(format!(
                    "Unsupported model type: {}",
                    self.config.model_type
                )));
            }
        };

        model.train(&training_data).await?;

        let mut models = self.models.write().await;
        models.insert(model_name.to_string(), model);

        *is_learning = false;

        info!("Trained model '{}' with {} samples", model_name, training_data.len());
        Ok(())
    }

    /// Make prediction with a trained model
    pub async fn predict(&self, model_name: &str, features: &HashMap<String, f64>) -> IntelligenceResult<f64> {
        let models = self.models.read().await;

        if let Some(model) = models.get(model_name) {
            model.predict(features).await
        } else {
            Err(IntelligenceError::Model(format!("Model '{}' not found", model_name)))
        }
    }

    /// Get model accuracy
    pub async fn get_model_accuracy(&self, model_name: &str) -> IntelligenceResult<f64> {
        let models = self.models.read().await;

        if let Some(model) = models.get(model_name) {
            Ok(model.accuracy_score())
        } else {
            Err(IntelligenceError::Model(format!("Model '{}' not found", model_name)))
        }
    }

    /// Adapt model based on new data and feedback
    pub async fn adapt_model(&self, model_name: &str, feedback: f64) -> IntelligenceResult<()> {
        let adaptation_rate = self.adaptation_strategy.rate();

        // Simple adaptation: retrain with recent data if feedback is poor
        if feedback < 0.7 { // Threshold for retraining
            info!("Model '{}' performance poor (feedback: {:.3}), triggering adaptation", model_name, feedback);

            // Add recent feedback as training data
            let data_point = DataPoint {
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as u64,
                features: HashMap::new(), // Would be populated with relevant features
                target: feedback,
                metadata: HashMap::new(),
            };

            self.add_training_data(vec![data_point]).await?;

            // Retrain model
            self.train_model(model_name).await?;
        }

        Ok(())
    }

    /// Get training data statistics
    pub async fn get_training_stats(&self) -> HashMap<String, usize> {
        let training_data = self.training_data.read().await;
        let models = self.models.read().await;

        let mut stats = HashMap::new();
        stats.insert("training_samples".to_string(), training_data.len());
        stats.insert("trained_models".to_string(), models.len());

        stats
    }

    /// Check if engine is currently learning
    pub async fn is_learning(&self) -> bool {
        *self.is_learning.read().await
    }

    /// Get available models
    pub async fn get_available_models(&self) -> Vec<String> {
        let models = self.models.read().await;
        models.keys().cloned().collect()
    }
}

impl Default for AdaptiveLearningEngine {
    fn default() -> Self {
        Self::new(
            LearningConfig {
                model_type: "linear_regression".to_string(),
                learning_rate: 0.01,
                max_iterations: 100,
                convergence_threshold: 1e-6,
                feature_selection: vec![],
                cross_validation_folds: 5,
            },
            AdaptationStrategy::Balanced,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_linear_regression_model() {
        let mut model = LinearRegressionModel::new();

        // Create simple training data: y = 2x + 1
        let training_data = vec![
            DataPoint {
                timestamp: 0,
                features: HashMap::from([("x".to_string(), 1.0)]),
                target: 3.0,
                metadata: HashMap::new(),
            },
            DataPoint {
                timestamp: 0,
                features: HashMap::from([("x".to_string(), 2.0)]),
                target: 5.0,
                metadata: HashMap::new(),
            },
            DataPoint {
                timestamp: 0,
                features: HashMap::from([("x".to_string(), 3.0)]),
                target: 7.0,
                metadata: HashMap::new(),
            },
        ];

        model.train(&training_data).await.unwrap();

        // Test prediction
        let prediction = model.predict(&HashMap::from([("x".to_string(), 4.0)])).await.unwrap();
        assert!(prediction > 8.0 && prediction < 10.0); // Should be close to 9.0

        assert!(model.accuracy_score() > 0.0);
    }

    #[tokio::test]
    async fn test_adaptive_learning_engine() {
        let engine = AdaptiveLearningEngine::default();

        // Add some training data
        let data = vec![
            DataPoint {
                timestamp: 0,
                features: HashMap::from([("feature1".to_string(), 1.0)]),
                target: 2.0,
                metadata: HashMap::new(),
            },
        ];

        engine.add_training_data(data).await.unwrap();

        // Train a model
        engine.train_model("test_model").await.unwrap();

        // Check available models
        let models = engine.get_available_models().await;
        assert_eq!(models.len(), 1);
        assert!(models.contains(&"test_model".to_string()));
    }
}
