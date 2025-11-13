//! AI provider implementations

use crate::{AiResult, AiError, ProviderConfig, ChatRequest, ChatResponse, CompletionRequest, CompletionResponse, EmbeddingRequest, EmbeddingResponse, ApiStatus};
use async_trait::async_trait;
use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use tracing::{info, warn, error};

/// AI provider trait
#[async_trait]
pub trait AiProviderTrait: Send + Sync {
    /// Get provider name
    fn name(&self) -> &str;

    /// Get available models
    fn available_models(&self) -> Vec<String>;

    /// Chat completion
    async fn chat_completion(&self, request: &ChatRequest) -> AiResult<ChatResponse>;

    /// Text completion
    async fn text_completion(&self, request: &CompletionRequest) -> AiResult<CompletionResponse>;

    /// Create embeddings
    async fn create_embeddings(&self, request: &EmbeddingRequest) -> AiResult<EmbeddingResponse>;

    /// Check if model is supported
    fn supports_model(&self, model: &str) -> bool;

    /// Get model pricing
    fn get_model_pricing(&self, model: &str) -> Option<f64>;
}

/// OpenAI provider implementation
pub struct OpenAiProvider {
    client: Client,
    config: ProviderConfig,
}

impl OpenAiProvider {
    pub fn new(config: ProviderConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    fn get_base_url(&self) -> &str {
        self.config.base_url.as_deref().unwrap_or("https://api.openai.com/v1")
    }

    fn get_auth_header(&self) -> String {
        format!("Bearer {}", self.config.api_key)
    }

    async fn make_request<T: serde::de::DeserializeOwned>(
        &self,
        endpoint: &str,
        body: serde_json::Value,
    ) -> AiResult<T> {
        let url = format!("{}/{}", self.get_base_url(), endpoint.trim_start_matches('/'));

        let response = self.client
            .post(&url)
            .header("Authorization", self.get_auth_header())
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AiError::Http(format!("Request failed: {}", e)))?;

        let status_code = response.status().as_u16();
        let status = ApiStatus::from_code(status_code);

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AiError::Provider {
                provider: "OpenAI".to_string(),
                message: format!("API error {}: {}", status_code, error_text),
            });
        }

        let result = response.json::<T>().await
            .map_err(|e| AiError::Parse(format!("Failed to parse response: {}", e)))?;

        Ok(result)
    }
}

#[async_trait]
impl AiProviderTrait for OpenAiProvider {
    fn name(&self) -> &str {
        "OpenAI"
    }

    fn available_models(&self) -> Vec<String> {
        vec![
            "gpt-3.5-turbo".to_string(),
            "gpt-3.5-turbo-16k".to_string(),
            "gpt-4".to_string(),
            "gpt-4-32k".to_string(),
            "gpt-4-turbo-preview".to_string(),
            "text-davinci-003".to_string(),
            "text-curie-001".to_string(),
            "text-babbage-001".to_string(),
            "text-ada-001".to_string(),
            "text-embedding-ada-002".to_string(),
        ]
    }

    async fn chat_completion(&self, request: &ChatRequest) -> AiResult<ChatResponse> {
        if !self.supports_model(&request.model) {
            return Err(AiError::ModelNotAvailable(request.model.clone()));
        }

        let body = json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": request.stream,
            "functions": request.functions,
            "function_call": request.function_call,
            "stop": request.stop,
            "presence_penalty": request.presence_penalty,
            "frequency_penalty": request.frequency_penalty,
            "logit_bias": request.logit_bias,
            "user": request.user,
        });

        self.make_request("chat/completions", body).await
    }

    async fn text_completion(&self, request: &CompletionRequest) -> AiResult<CompletionResponse> {
        if !self.supports_model(&request.model) {
            return Err(AiError::ModelNotAvailable(request.model.clone()));
        }

        let body = json!({
            "model": request.model,
            "prompt": request.prompt,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": request.stream,
            "stop": request.stop,
            "echo": request.echo,
            "presence_penalty": request.presence_penalty,
            "frequency_penalty": request.frequency_penalty,
        });

        self.make_request("completions", body).await
    }

    async fn create_embeddings(&self, request: &EmbeddingRequest) -> AiResult<EmbeddingResponse> {
        if !self.supports_model(&request.model) {
            return Err(AiError::ModelNotAvailable(request.model.clone()));
        }

        let body = json!({
            "input": request.input,
            "model": request.model,
            "user": request.user,
        });

        self.make_request("embeddings", body).await
    }

    fn supports_model(&self, model: &str) -> bool {
        self.available_models().contains(&model.to_string())
    }

    fn get_model_pricing(&self, model: &str) -> Option<f64> {
        match model {
            "gpt-3.5-turbo" => Some(0.002),
            "gpt-4" => Some(0.03),
            "gpt-4-turbo-preview" => Some(0.01),
            "text-embedding-ada-002" => Some(0.0001),
            _ => None,
        }
    }
}

/// Anthropic provider implementation
pub struct AnthropicProvider {
    client: Client,
    config: ProviderConfig,
}

impl AnthropicProvider {
    pub fn new(config: ProviderConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, config }
    }

    fn get_base_url(&self) -> &str {
        self.config.base_url.as_deref().unwrap_or("https://api.anthropic.com/v1")
    }

    fn get_auth_header(&self) -> String {
        format!("Bearer {}", self.config.api_key)
    }

    async fn make_request<T: serde::de::DeserializeOwned>(
        &self,
        endpoint: &str,
        body: serde_json::Value,
    ) -> AiResult<T> {
        let url = format!("{}/{}", self.get_base_url(), endpoint.trim_start_matches('/'));

        let response = self.client
            .post(&url)
            .header("x-api-key", &self.config.api_key)
            .header("Content-Type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| AiError::Http(format!("Request failed: {}", e)))?;

        let status_code = response.status().as_u16();

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(AiError::Provider {
                provider: "Anthropic".to_string(),
                message: format!("API error {}: {}", status_code, error_text),
            });
        }

        let result = response.json::<T>().await
            .map_err(|e| AiError::Parse(format!("Failed to parse response: {}", e)))?;

        Ok(result)
    }
}

#[async_trait]
impl AiProviderTrait for AnthropicProvider {
    fn name(&self) -> &str {
        "Anthropic"
    }

    fn available_models(&self) -> Vec<String> {
        vec![
            "claude-3-opus-20240229".to_string(),
            "claude-3-sonnet-20240229".to_string(),
            "claude-3-haiku-20240307".to_string(),
            "claude-3-5-sonnet-20240620".to_string(),
            "claude-2.1".to_string(),
            "claude-2".to_string(),
            "claude-instant-1".to_string(),
        ]
    }

    async fn chat_completion(&self, request: &ChatRequest) -> AiResult<ChatResponse> {
        if !self.supports_model(&request.model) {
            return Err(AiError::ModelNotAvailable(request.model.clone()));
        }

        // Convert OpenAI format to Anthropic format
        let system_message = request.messages.iter()
            .find(|m| m.role == crate::MessageRole::System)
            .map(|m| match &m.content {
                crate::MessageContent::Text(text) => text.clone(),
                _ => String::new(),
            })
            .unwrap_or_default();

        let messages: Vec<serde_json::Value> = request.messages.iter()
            .filter(|m| m.role != crate::MessageRole::System)
            .map(|m| {
                let role = match m.role {
                    crate::MessageRole::User => "user",
                    crate::MessageRole::Assistant => "assistant",
                    _ => "user",
                };

                let content = match &m.content {
                    crate::MessageContent::Text(text) => text.clone(),
                    _ => String::new(),
                };

                json!({
                    "role": role,
                    "content": content
                })
            })
            .collect();

        let max_tokens = request.max_tokens.unwrap_or(4096);

        let body = json!({
            "model": request.model,
            "max_tokens": max_tokens,
            "messages": messages,
            "system": if system_message.is_empty() { serde_json::Value::Null } else { json!(system_message) },
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stop_sequences": request.stop,
        });

        // Anthropic response format is different, we need to convert it
        let anthropic_response: serde_json::Value = self.make_request("messages", body).await?;

        // Convert Anthropic format to OpenAI-compatible format
        let openai_response = self.convert_anthropic_to_openai(anthropic_response)?;

        serde_json::from_value(openai_response)
            .map_err(|e| AiError::Parse(format!("Failed to convert response: {}", e)))
    }

    async fn text_completion(&self, _request: &CompletionRequest) -> AiResult<CompletionResponse> {
        Err(AiError::Provider {
            provider: "Anthropic".to_string(),
            message: "Text completion not supported, use chat completion instead".to_string(),
        })
    }

    async fn create_embeddings(&self, _request: &EmbeddingRequest) -> AiResult<EmbeddingResponse> {
        Err(AiError::Provider {
            provider: "Anthropic".to_string(),
            message: "Embeddings not supported".to_string(),
        })
    }

    fn supports_model(&self, model: &str) -> bool {
        self.available_models().contains(&model.to_string())
    }

    fn get_model_pricing(&self, model: &str) -> Option<f64> {
        match model {
            "claude-3-opus-20240229" => Some(0.015),
            "claude-3-sonnet-20240229" => Some(0.003),
            "claude-3-haiku-20240307" => Some(0.00025),
            "claude-3-5-sonnet-20240620" => Some(0.003),
            _ => Some(0.008), // Default Claude pricing
        }
    }
}

impl AnthropicProvider {
    fn convert_anthropic_to_openai(&self, anthropic: serde_json::Value) -> AiResult<serde_json::Value> {
        // This is a simplified conversion - in practice you'd need more comprehensive mapping
        let content = anthropic["content"][0]["text"].as_str().unwrap_or("");

        let openai_response = json!({
            "id": format!("anthropic-{}", uuid::Uuid::new_v4()),
            "object": "chat.completion",
            "created": chrono::Utc::now().timestamp(),
            "model": anthropic["model"].as_str().unwrap_or("claude-3"),
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": anthropic["usage"]["input_tokens"].as_u64().unwrap_or(0),
                "completion_tokens": anthropic["usage"]["output_tokens"].as_u64().unwrap_or(0),
                "total_tokens": 0
            }
        });

        Ok(openai_response)
    }
}

/// Provider factory
pub struct ProviderFactory;

impl ProviderFactory {
    pub fn create_provider(config: ProviderConfig) -> AiResult<Box<dyn AiProviderTrait>> {
        match config.provider {
            crate::AiProvider::OpenAI => {
                Ok(Box::new(OpenAiProvider::new(config)))
            }
            crate::AiProvider::Anthropic => {
                Ok(Box::new(AnthropicProvider::new(config)))
            }
            _ => Err(AiError::Provider {
                provider: format!("{:?}", config.provider),
                message: "Provider not implemented yet".to_string(),
            }),
        }
    }
}
