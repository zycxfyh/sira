//! Middleware implementations for Sira Gateway

use crate::{GatewayResult, GatewayError, HttpRequest, HttpResponse, Middleware};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// CORS middleware
pub struct CorsMiddleware {
    allowed_origins: Vec<String>,
    allowed_methods: Vec<String>,
    allowed_headers: Vec<String>,
    allow_credentials: bool,
    max_age: u32,
}

impl CorsMiddleware {
    pub fn new() -> Self {
        Self {
            allowed_origins: vec!["*".to_string()],
            allowed_methods: vec!["GET".to_string(), "POST".to_string(), "PUT".to_string(), "DELETE".to_string()],
            allowed_headers: vec!["*".to_string()],
            allow_credentials: false,
            max_age: 86400,
        }
    }
}

#[async_trait]
impl Middleware for CorsMiddleware {
    fn name(&self) -> &str {
        "cors"
    }

    async fn process_request(&self, request: &mut HttpRequest) -> GatewayResult<()> {
        // CORS preflight handling
        if request.method.as_str() == "OPTIONS" {
            // This would be handled by the response processor
        }
        Ok(())
    }

    async fn process_response(&self, response: &mut HttpResponse) -> GatewayResult<()> {
        response.headers.insert("Access-Control-Allow-Origin".to_string(), self.allowed_origins.join(","));
        response.headers.insert("Access-Control-Allow-Methods".to_string(), self.allowed_methods.join(","));
        response.headers.insert("Access-Control-Allow-Headers".to_string(), self.allowed_headers.join(","));

        if self.allow_credentials {
            response.headers.insert("Access-Control-Allow-Credentials".to_string(), "true".to_string());
        }

        response.headers.insert("Access-Control-Max-Age".to_string(), self.max_age.to_string());
        Ok(())
    }
}

/// Logging middleware
pub struct LoggingMiddleware;

impl LoggingMiddleware {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Middleware for LoggingMiddleware {
    fn name(&self) -> &str {
        "logging"
    }

    async fn process_request(&self, request: &mut HttpRequest) -> GatewayResult<()> {
        tracing::info!(
            "Request: {} {} from {} (ID: {})",
            request.method.as_str(),
            request.path,
            request.remote_addr.as_deref().unwrap_or("unknown"),
            request.request_id
        );
        Ok(())
    }

    async fn process_response(&self, response: &mut HttpResponse) -> GatewayResult<()> {
        tracing::info!(
            "Response: {} for request {}",
            response.status_code,
            response.request_id
        );
        Ok(())
    }
}

/// Rate limiting middleware
pub struct RateLimitMiddleware {
    requests: Arc<RwLock<HashMap<String, Vec<u64>>>>,
    max_requests: u32,
    window_seconds: u64,
}

impl RateLimitMiddleware {
    pub fn new(max_requests: u32, window_seconds: u64) -> Self {
        Self {
            requests: Arc::new(RwLock::new(HashMap::new())),
            max_requests,
            window_seconds,
        }
    }
}

#[async_trait]
impl Middleware for RateLimitMiddleware {
    fn name(&self) -> &str {
        "rate_limit"
    }

    async fn process_request(&self, request: &mut HttpRequest) -> GatewayResult<()> {
        let client_key = request.remote_addr.as_deref().unwrap_or("unknown");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut requests = self.requests.write().await;

        let client_requests = requests.entry(client_key.to_string()).or_insert_with(Vec::new);

        // Remove old requests outside the window
        client_requests.retain(|&timestamp| now - timestamp < self.window_seconds);

        if client_requests.len() >= self.max_requests as usize {
            return Err(GatewayError::RateLimit(format!(
                "Rate limit exceeded: {} requests per {} seconds",
                self.max_requests, self.window_seconds
            )));
        }

        client_requests.push(now);
        Ok(())
    }

    async fn process_response(&self, _response: &mut HttpResponse) -> GatewayResult<()> {
        Ok(())
    }
}

/// Request ID middleware
pub struct RequestIdMiddleware;

impl RequestIdMiddleware {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl Middleware for RequestIdMiddleware {
    fn name(&self) -> &str {
        "request_id"
    }

    async fn process_request(&self, request: &mut HttpRequest) -> GatewayResult<()> {
        if request.request_id.is_empty() {
            request.request_id = uuid::Uuid::new_v4().to_string();
        }

        request.headers.insert("X-Request-ID".to_string(), request.request_id.clone());
        Ok(())
    }

    async fn process_response(&self, response: &mut HttpResponse) -> GatewayResult<()> {
        response.headers.insert("X-Request-ID".to_string(), response.request_id.clone());
        Ok(())
    }
}

/// Middleware chain
pub struct MiddlewareChain {
    middlewares: Vec<Box<dyn Middleware>>,
}

impl MiddlewareChain {
    pub fn new() -> Self {
        Self {
            middlewares: Vec::new(),
        }
    }

    pub fn add_middleware<M: Middleware + 'static>(mut self, middleware: M) -> Self {
        self.middlewares.push(Box::new(middleware));
        self
    }

    pub async fn process_request(&self, request: &mut HttpRequest) -> GatewayResult<()> {
        for middleware in &self.middlewares {
            middleware.process_request(request).await?;
        }
        Ok(())
    }

    pub async fn process_response(&self, response: &mut HttpResponse) -> GatewayResult<()> {
        // Process in reverse order for response
        for middleware in self.middlewares.iter().rev() {
            middleware.process_response(response).await?;
        }
        Ok(())
    }
}

impl Default for MiddlewareChain {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cors_middleware() {
        let middleware = CorsMiddleware::new();
        let mut response = HttpResponse {
            status_code: 200,
            headers: HashMap::new(),
            body: None,
            request_id: "test".to_string(),
        };

        middleware.process_response(&mut response).await.unwrap();

        assert!(response.headers.contains_key("Access-Control-Allow-Origin"));
        assert!(response.headers.contains_key("Access-Control-Allow-Methods"));
    }

    #[tokio::test]
    async fn test_request_id_middleware() {
        let middleware = RequestIdMiddleware::new();
        let mut request = HttpRequest {
            method: crate::HttpMethod::GET,
            path: "/test".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: None,
            request_id: String::new(),
            timestamp: 0,
        };

        middleware.process_request(&mut request).await.unwrap();

        assert!(!request.request_id.is_empty());
        assert_eq!(request.headers.get("X-Request-ID"), Some(&request.request_id));
    }

    #[tokio::test]
    async fn test_rate_limit_middleware() {
        let middleware = RateLimitMiddleware::new(2, 60); // 2 requests per 60 seconds

        let mut request = HttpRequest {
            method: crate::HttpMethod::GET,
            path: "/test".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: Some("127.0.0.1".to_string()),
            request_id: "test1".to_string(),
            timestamp: 0,
        };

        // First request should succeed
        middleware.process_request(&mut request).await.unwrap();

        // Second request should succeed
        request.request_id = "test2".to_string();
        middleware.process_request(&mut request).await.unwrap();

        // Third request should fail
        request.request_id = "test3".to_string();
        let result = middleware.process_request(&mut request).await;
        assert!(result.is_err());
    }
}
