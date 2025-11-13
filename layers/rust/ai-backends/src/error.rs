//! Error types for Sira AI Backends

use thiserror::Error;

/// AI backend error types
#[derive(Debug, Error)]
pub enum AiError {
    #[error("HTTP error: {0}")]
    Http(String),

    #[error("API error: {0}")]
    Api(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Provider error ({provider}): {message}")]
    Provider { provider: String, message: String },

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Invalid request: {0}")]
    InvalidRequest(String),

    #[error("Model not available: {0}")]
    ModelNotAvailable(String),

    #[error("Quota exceeded: {0}")]
    QuotaExceeded(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// API response status
#[derive(Debug, Clone)]
pub enum ApiStatus {
    Success,
    RateLimited,
    QuotaExceeded,
    AuthenticationFailed,
    ModelNotFound,
    InvalidRequest,
    ServerError,
    Unknown,
}

impl ApiStatus {
    pub fn from_code(code: u16) -> Self {
        match code {
            200..=299 => ApiStatus::Success,
            401 => ApiStatus::AuthenticationFailed,
            403 => ApiStatus::QuotaExceeded,
            404 => ApiStatus::ModelNotFound,
            400 => ApiStatus::InvalidRequest,
            429 => ApiStatus::RateLimited,
            500..=599 => ApiStatus::ServerError,
            _ => ApiStatus::Unknown,
        }
    }

    pub fn is_retryable(&self) -> bool {
        matches!(self, ApiStatus::RateLimited | ApiStatus::ServerError)
    }
}
