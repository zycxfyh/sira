//! AI Backend Client

use crate::{AiResult, AiError, AiProviderTrait, ProviderFactory, ProviderConfig, ChatRequest, ChatResponse, CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, BackendMetrics};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn, error};

/// AI Backend Client
pub struct AiBackendClient {
    providers: Arc<RwLock<HashMap<String, Box<dyn AiProviderTrait>>>>,
    metrics: Arc<RwLock<HashMap<String, BackendMetrics>>>,
    default_provider: Option<String>,
}

impl AiBackendClient {
    /// Create a new AI backend client
    pub fn new() -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(HashMap::new())),
            default_provider: None,
        }
    }

    /// Add a provider
    pub async fn add_provider(&self, name: &str, config: ProviderConfig) -> AiResult<()> {
        let provider = ProviderFactory::create_provider(config)?;

        let mut providers = self.providers.write().await;
        providers.insert(name.to_string(), provider);

        let mut metrics = self.metrics.write().await;
        metrics.insert(name.to_string(), BackendMetrics::default());

        info!("Added AI provider: {}", name);
        Ok(())
    }

    /// Remove a provider
    pub async fn remove_provider(&self, name: &str) -> AiResult<()> {
        let mut providers = self.providers.write().await;
        let removed = providers.remove(name);

        if removed.is_some() {
            let mut metrics = self.metrics.write().await;
            metrics.remove(name);
            info!("Removed AI provider: {}", name);
            Ok(())
        } else {
            Err(AiError::Config(format!("Provider '{}' not found", name)))
        }
    }

    /// Set default provider
    pub fn set_default_provider(&mut self, name: &str) {
        self.default_provider = Some(name.to_string());
    }

    /// Get available providers
    pub async fn get_providers(&self) -> Vec<String> {
        let providers = self.providers.read().await;
        providers.keys().cloned().collect()
    }

    /// Get provider models
    pub async fn get_provider_models(&self, provider_name: &str) -> AiResult<Vec<String>> {
        let providers = self.providers.read().await;
        if let Some(provider) = providers.get(provider_name) {
            Ok(provider.available_models())
        } else {
            Err(AiError::Config(format!("Provider '{}' not found", provider_name)))
        }
    }

    /// Chat completion with automatic provider selection
    pub async fn chat_completion(&self, request: ChatRequest) -> AiResult<ChatResponse> {
        let provider_name = self.select_provider_for_model(&request.model).await?;
        self.chat_completion_with_provider(&provider_name, request).await
    }

    /// Chat completion with specific provider
    pub async fn chat_completion_with_provider(&self, provider_name: &str, request: ChatRequest) -> AiResult<ChatResponse> {
        let start_time = std::time::Instant::now();

        let providers = self.providers.read().await;
        let provider = providers.get(provider_name)
            .ok_or_else(|| AiError::Config(format!("Provider '{}' not found", provider_name)))?;

        let mut metrics = self.metrics.write().await;
        let provider_metrics = metrics.get_mut(provider_name).unwrap();

        provider_metrics.requests_total += 1;
        provider_metrics.last_request_at = Some(std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64);

        match provider.chat_completion(&request).await {
            Ok(response) => {
                let elapsed = start_time.elapsed().as_millis() as f64;
                provider_metrics.response_time_avg = (provider_metrics.response_time_avg + elapsed) / 2.0;

                if let Some(usage) = &response.usage {
                    provider_metrics.tokens_used += usage.total_tokens as u64;
                }

                info!("Chat completion successful: {} tokens, {:.2}ms", 
                      response.usage.as_ref().map(|u| u.total_tokens).unwrap_or(0), 
                      elapsed);
                Ok(response)
            }
            Err(e) => {
                provider_metrics.requests_failed += 1;
                error!("Chat completion failed: {:?}", e);
                Err(e)
            }
        }
    }

    /// Text completion
    pub async fn text_completion(&self, request: CompletionRequest) -> AiResult<CompletionResponse> {
        let provider_name = self.select_provider_for_model(&request.model).await?;
        self.text_completion_with_provider(&provider_name, request).await
    }

    /// Text completion with specific provider
    pub async fn text_completion_with_provider(&self, provider_name: &str, request: CompletionRequest) -> AiResult<CompletionResponse> {
        let providers = self.providers.read().await;
        let provider = providers.get(provider_name)
            .ok_or_else(|| AiError::Config(format!("Provider '{}' not found", provider_name)))?;

        provider.text_completion(&request).await
    }

    /// Create embeddings
    pub async fn create_embeddings(&self, request: EmbeddingRequest) -> AiResult<EmbeddingResponse> {
        let provider_name = self.select_provider_for_model(&request.model).await?;
        self.create_embeddings_with_provider(&provider_name, request).await
    }

    /// Create embeddings with specific provider
    pub async fn create_embeddings_with_provider(&self, provider_name: &str, request: EmbeddingRequest) -> AiResult<EmbeddingResponse> {
        let providers = self.providers.read().await;
        let provider = providers.get(provider_name)
            .ok_or_else(|| AiError::Config(format!("Provider '{}' not found", provider_name)))?;

        provider.create_embeddings(&request).await
    }

    /// Get backend metrics
    pub async fn get_metrics(&self, provider_name: &str) -> Option<BackendMetrics> {
        let metrics = self.metrics.read().await;
        metrics.get(provider_name).cloned()
    }

    /// Get all metrics
    pub async fn get_all_metrics(&self) -> HashMap<String, BackendMetrics> {
        let metrics = self.metrics.read().await;
        metrics.clone()
    }

    /// Select appropriate provider for a model
    async fn select_provider_for_model(&self, model: &str) -> AiResult<String> {
        let providers = self.providers.read().await;

        // First try default provider
        if let Some(default) = &self.default_provider {
            if let Some(provider) = providers.get(default) {
                if provider.supports_model(model) {
                    return Ok(default.clone());
                }
            }
        }

        // Find any provider that supports the model
        for (name, provider) in providers.iter() {
            if provider.supports_model(model) {
                return Ok(name.clone());
            }
        }

        Err(AiError::ModelNotAvailable(format!("No provider supports model: {}", model)))
    }

    /// Health check for all providers
    pub async fn health_check(&self) -> HashMap<String, bool> {
        let providers = self.providers.read().await;
        let mut results = HashMap::new();

        for (name, provider) in providers.iter() {
            // Simple health check - try to get available models
            let is_healthy = !provider.available_models().is_empty();
            results.insert(name.clone(), is_healthy);
        }

        results
    }
}

impl Default for AiBackendClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AiProvider, MessageRole, MessageContent};

    #[tokio::test]
    async fn test_client_creation() {
        let client = AiBackendClient::new();
        let providers = client.get_providers().await;
        assert_eq!(providers.len(), 0);
    }

    #[tokio::test]
    async fn test_provider_management() {
        let client = AiBackendClient::new();

        // Test adding OpenAI provider (without real API key)
        let config = ProviderConfig {
            provider: AiProvider::OpenAI,
            api_key: "test-key".to_string(),
            base_url: None,
            organization_id: None,
            timeout_seconds: 30,
            max_retries: 3,
            models: vec![],
        };

        client.add_provider("openai", config).await.unwrap();

        let providers = client.get_providers().await;
        assert_eq!(providers.len(), 1);
        assert!(providers.contains(&"openai".to_string()));

        // Test removing provider
        client.remove_provider("openai").await.unwrap();
        let providers_after = client.get_providers().await;
        assert_eq!(providers_after.len(), 0);
    }

    #[tokio::test]
    async fn test_metrics() {
        let client = AiBackendClient::new();

        let metrics = client.get_all_metrics().await;
        assert_eq!(metrics.len(), 0);

        // Add a provider
        let config = ProviderConfig {
            provider: AiProvider::OpenAI,
            api_key: "test-key".to_string(),
            base_url: None,
            organization_id: None,
            timeout_seconds: 30,
            max_retries: 3,
            models: vec![],
        };

        client.add_provider("openai", config).await.unwrap();

        let metrics = client.get_metrics("openai").await;
        assert!(metrics.is_some());

        let metrics = metrics.unwrap();
        assert_eq!(metrics.requests_total, 0);
        assert_eq!(metrics.requests_failed, 0);
    }

    #[tokio::test]
    async fn test_chat_request_creation() {
        let messages = vec![
            crate::ChatMessage {
                role: MessageRole::User,
                content: MessageContent::Text("Hello!".to_string()),
                name: None,
                function_call: None,
            }
        ];

        let request = ChatRequest {
            messages,
            model: "gpt-3.5-turbo".to_string(),
            temperature: Some(0.7),
            top_p: None,
            max_tokens: Some(100),
            stream: Some(false),
            functions: None,
            function_call: None,
            stop: None,
            presence_penalty: None,
            frequency_penalty: None,
            logit_bias: None,
            user: None,
        };

        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.model, "gpt-3.5-turbo");
        assert_eq!(request.temperature, Some(0.7));
    }
}
