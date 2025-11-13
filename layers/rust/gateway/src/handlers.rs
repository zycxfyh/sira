//! Request handlers for Sira Gateway

use crate::{GatewayResult, GatewayError, HttpRequest, HttpResponse, RequestHandler, RouteMatch, BackendConfig};
use async_trait::async_trait;
use hyper::{Client, Request, Body, Uri};
use hyper::client::HttpConnector;
use std::time::Duration;
use tokio::time::timeout;

/// Backend request handler
pub struct BackendHandler {
    client: Client<HttpConnector>,
}

impl BackendHandler {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_idle_timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .build_http();

        Self { client }
    }

    async fn call_backend(&self, request: &HttpRequest, backend: &BackendConfig) -> GatewayResult<HttpResponse> {
        // Build the backend URL
        let backend_url = format!("{}{}", backend.url.trim_end_matches('/'), request.path);

        // Add query parameters if any
        let url = if request.query.is_empty() {
            backend_url
        } else {
            let query_string = request.query.iter()
                .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&");
            format!("{}?{}", backend_url, query_string)
        };

        let uri: Uri = url.parse().map_err(|e| GatewayError::Backend(format!("Invalid URL: {}", e)))?;

        // Build the request
        let mut req_builder = Request::builder()
            .method(request.method.as_str())
            .uri(uri);

        // Copy headers
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key, value);
        }

        // Add request ID
        req_builder = req_builder.header("X-Request-ID", &request.request_id);

        // Build body
        let body = if let Some(ref body_data) = request.body {
            Body::from(body_data.clone())
        } else {
            Body::empty()
        };

        let req = req_builder.body(body)
            .map_err(|e| GatewayError::Backend(format!("Failed to build request: {}", e)))?;

        // Make the request with timeout
        let response = timeout(
            Duration::from_secs(backend.timeout),
            self.client.request(req)
        ).await
            .map_err(|_| GatewayError::Timeout(format!("Request timeout after {}s", backend.timeout)))?
            .map_err(|e| GatewayError::Backend(format!("Request failed: {}", e)))?;

        // Convert response
        let status_code = response.status().as_u16();

        let headers = response.headers()
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();

        let body_bytes = hyper::body::to_bytes(response.into_body()).await
            .map_err(|e| GatewayError::Backend(format!("Failed to read response body: {}", e)))?;

        Ok(HttpResponse {
            status_code,
            headers,
            body: Some(body_bytes.to_vec()),
            request_id: request.request_id.clone(),
        })
    }
}

#[async_trait]
impl RequestHandler for BackendHandler {
    async fn handle(&self, request: HttpRequest) -> GatewayResult<HttpResponse> {
        // This handler needs route match information, so it should be called from the router
        Err(GatewayError::Routing("Backend handler needs route match".to_string()))
    }
}

/// Health check handler
pub struct HealthCheckHandler;

impl HealthCheckHandler {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl RequestHandler for HealthCheckHandler {
    async fn handle(&self, request: HttpRequest) -> GatewayResult<HttpResponse> {
        if request.path == "/health" {
            Ok(HttpResponse {
                status_code: 200,
                headers: vec![("Content-Type".to_string(), "application/json".to_string())]
                    .into_iter().collect(),
                body: Some(r#"{"status":"ok","timestamp":"now"}"#.as_bytes().to_vec()),
                request_id: request.request_id,
            })
        } else {
            Err(GatewayError::Routing("Not found".to_string()))
        }
    }
}

/// Static response handler
pub struct StaticResponseHandler {
    status_code: u16,
    content_type: String,
    body: Vec<u8>,
}

impl StaticResponseHandler {
    pub fn new(status_code: u16, content_type: &str, body: Vec<u8>) -> Self {
        Self {
            status_code,
            content_type: content_type.to_string(),
            body,
        }
    }
}

#[async_trait]
impl RequestHandler for StaticResponseHandler {
    async fn handle(&self, request: HttpRequest) -> GatewayResult<HttpResponse> {
        Ok(HttpResponse {
            status_code: self.status_code,
            headers: vec![("Content-Type".to_string(), self.content_type.clone())]
                .into_iter().collect(),
            body: Some(self.body.clone()),
            request_id: request.request_id,
        })
    }
}

/// Request dispatcher - routes requests to appropriate handlers
pub struct RequestDispatcher {
    backend_handler: BackendHandler,
    health_handler: HealthCheckHandler,
}

impl RequestDispatcher {
    pub fn new() -> Self {
        Self {
            backend_handler: BackendHandler::new(),
            health_handler: HealthCheckHandler::new(),
        }
    }

    pub async fn dispatch(&self, request: HttpRequest, route_match: Option<RouteMatch>) -> GatewayResult<HttpResponse> {
        match route_match {
            Some(route) => {
                // Route to backend
                self.backend_handler.call_backend(&request, &route.backend).await
            }
            None => {
                // Handle special routes
                if request.path == "/health" {
                    self.health_handler.handle(request).await
                } else {
                    // Return 404
                    Ok(HttpResponse {
                        status_code: 404,
                        headers: vec![("Content-Type".to_string(), "application/json".to_string())]
                            .into_iter().collect(),
                        body: Some(r#"{"error":"Not Found"}"#.as_bytes().to_vec()),
                        request_id: request.request_id,
                    })
                }
            }
        }
    }
}

impl Default for RequestDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_health_check_handler() {
        let handler = HealthCheckHandler::new();

        let request = HttpRequest {
            method: crate::HttpMethod::GET,
            path: "/health".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: None,
            request_id: "test".to_string(),
            timestamp: 0,
        };

        let response = handler.handle(request).await.unwrap();
        assert_eq!(response.status_code, 200);
        assert!(response.body.is_some());
    }

    #[tokio::test]
    async fn test_static_response_handler() {
        let handler = StaticResponseHandler::new(200, "text/plain", b"Hello World".to_vec());

        let request = HttpRequest {
            method: crate::HttpMethod::GET,
            path: "/test".to_string(),
            query: HashMap::new(),
            headers: HashMap::new(),
            body: None,
            remote_addr: None,
            request_id: "test".to_string(),
            timestamp: 0,
        };

        let response = handler.handle(request).await.unwrap();
        assert_eq!(response.status_code, 200);
        assert_eq!(response.headers.get("Content-Type"), Some(&"text/plain".to_string()));
        assert_eq!(response.body, Some(b"Hello World".to_vec()));
    }
}
