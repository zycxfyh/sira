//! Common types for Sira Gateway

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// HTTP methods
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HttpMethod {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
    CONNECT,
    TRACE,
}

impl HttpMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            HttpMethod::GET => "GET",
            HttpMethod::POST => "POST",
            HttpMethod::PUT => "PUT",
            HttpMethod::DELETE => "DELETE",
            HttpMethod::PATCH => "PATCH",
            HttpMethod::HEAD => "HEAD",
            HttpMethod::OPTIONS => "OPTIONS",
            HttpMethod::CONNECT => "CONNECT",
            HttpMethod::TRACE => "TRACE",
        }
    }
}

/// HTTP request representation
#[derive(Debug, Clone)]
pub struct HttpRequest {
    pub method: HttpMethod,
    pub path: String,
    pub query: HashMap<String, String>,
    pub headers: HashMap<String, String>,
    pub body: Option<Vec<u8>>,
    pub remote_addr: Option<String>,
    pub request_id: String,
    pub timestamp: u64,
}

/// HTTP response representation
#[derive(Debug, Clone)]
pub struct HttpResponse {
    pub status_code: u16,
    pub headers: HashMap<String, String>,
    pub body: Option<Vec<u8>>,
    pub request_id: String,
}

/// Route configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteConfig {
    pub id: String,
    pub path: String,
    pub methods: Vec<String>,
    pub backend: BackendConfig,
    pub middlewares: Vec<String>,
    pub priority: i32,
    pub enabled: bool,
}

/// Backend service configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendConfig {
    pub name: String,
    pub url: String,
    pub timeout: u64, // seconds
    pub retry_count: u32,
    pub health_check: Option<String>,
    pub weight: u32, // for load balancing
}

/// Gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
    pub max_connections: usize,
    pub timeout: u64,
    pub routes: Vec<RouteConfig>,
    pub middlewares: HashMap<String, serde_json::Value>,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            workers: 4,
            max_connections: 1000,
            timeout: 30,
            routes: Vec::new(),
            middlewares: HashMap::new(),
        }
    }
}

/// Load balancing strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoadBalancingStrategy {
    RoundRobin,
    WeightedRoundRobin,
    LeastConnections,
    Random,
    IpHash,
}

/// Route matching result
#[derive(Debug, Clone)]
pub struct RouteMatch {
    pub route_id: String,
    pub backend: BackendConfig,
    pub path_params: HashMap<String, String>,
    pub matched_path: String,
}

/// Middleware trait
#[async_trait::async_trait]
pub trait Middleware: Send + Sync {
    /// Middleware name
    fn name(&self) -> &str;

    /// Process request
    async fn process_request(&self, request: &mut HttpRequest) -> crate::GatewayResult<()>;

    /// Process response
    async fn process_response(&self, response: &mut HttpResponse) -> crate::GatewayResult<()>;
}

/// Request handler trait
#[async_trait::async_trait]
pub trait RequestHandler: Send + Sync {
    /// Handle request
    async fn handle(&self, request: HttpRequest) -> crate::GatewayResult<HttpResponse>;
}
