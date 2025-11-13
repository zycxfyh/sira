//! Error types for Sira Gateway

use thiserror::Error;

/// Gateway error types
#[derive(Debug, Error)]
pub enum GatewayError {
    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Routing error: {0}")]
    Routing(String),

    #[error("Authentication error: {0}")]
    Auth(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Backend error: {0}")]
    Backend(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Internal Server Error: {0}")]
    InternalServerError(String),

    #[error("Session error: {0}")]
    SessionError(#[from] sira_session::SessionError),

    #[error("AI Backend error: {0}")]
    AiBackendError(#[from] sira_ai_backends::AiError),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// HTTP status codes
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpStatus {
    Ok = 200,
    BadRequest = 400,
    Unauthorized = 401,
    Forbidden = 403,
    NotFound = 404,
    MethodNotAllowed = 405,
    TooManyRequests = 429,
    InternalServerError = 500,
    BadGateway = 502,
    ServiceUnavailable = 503,
    GatewayTimeout = 504,
}

impl HttpStatus {
    pub fn as_u16(&self) -> u16 {
        *self as u16
    }

    pub fn reason_phrase(&self) -> &'static str {
        match self {
            HttpStatus::Ok => "OK",
            HttpStatus::BadRequest => "Bad Request",
            HttpStatus::Unauthorized => "Unauthorized",
            HttpStatus::Forbidden => "Forbidden",
            HttpStatus::NotFound => "Not Found",
            HttpStatus::MethodNotAllowed => "Method Not Allowed",
            HttpStatus::TooManyRequests => "Too Many Requests",
            HttpStatus::InternalServerError => "Internal Server Error",
            HttpStatus::BadGateway => "Bad Gateway",
            HttpStatus::ServiceUnavailable => "Service Unavailable",
            HttpStatus::GatewayTimeout => "Gateway Timeout",
        }
    }
}
