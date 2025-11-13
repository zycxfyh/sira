//! HTTP Server implementation for Sira Gateway

use crate::{
    GatewayResult, GatewayError, GatewayConfig, Router, MiddlewareChain, RequestDispatcher,
    HttpRequest, HttpResponse, HttpMethod, CorsMiddleware, LoggingMiddleware,
    RateLimitMiddleware, RequestIdMiddleware, WebSocketManager, websocket_routes
};
use sira_ai_backends::AiBackendClient;
use sira_session::SessionManager;
use axum::{
    extract::{State, Path, Query},
    http::{Method, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Router as AxumRouter,
    body::Body,
};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

/// Gateway server state
#[derive(Clone)]
pub struct ServerState {
    router: Arc<RwLock<Router>>,
    middleware_chain: Arc<RwLock<MiddlewareChain>>,
    dispatcher: Arc<RwLock<RequestDispatcher>>,
    websocket_manager: Option<Arc<WebSocketManager>>,
}

/// HTTP Gateway Server
pub struct GatewayServer {
    config: GatewayConfig,
    state: ServerState,
}

impl GatewayServer {
    /// Create a new gateway server with AI client and session manager
    pub fn new(
        config: GatewayConfig,
        ai_client: Option<Arc<AiBackendClient>>,
        session_manager: Option<Arc<SessionManager>>,
    ) -> Self {
        let router = Arc::new(RwLock::new(Router::new()));
        let middleware_chain = Arc::new(RwLock::new(Self::create_default_middlewares()));
        let dispatcher = Arc::new(RwLock::new(RequestDispatcher::new()));

        // Initialize WebSocket manager if AI client is available
        let websocket_manager = ai_client.as_ref().map(|client| {
            Arc::new(WebSocketManager::new(client.clone(), session_manager.clone()))
        });

        let state = ServerState {
            router,
            middleware_chain,
            dispatcher,
            websocket_manager,
        };

        Self { config, state }
    }

    /// Create a new gateway server (legacy method for backward compatibility)
    pub fn new_simple(config: GatewayConfig) -> Self {
        Self::new(config, None, None)
    }

    /// Get WebSocket connection statistics
    pub async fn get_websocket_stats(&self) -> Option<HashMap<String, usize>> {
        if let Some(ws_manager) = &self.state.websocket_manager {
            Some(ws_manager.get_stats().await)
        } else {
            None
        }
    }

    /// Get server health status
    pub async fn health_check(&self) -> GatewayResult<HashMap<String, serde_json::Value>> {
        let mut status = HashMap::new();

        status.insert("status".to_string(), serde_json::json!("healthy"));
        status.insert("timestamp".to_string(), serde_json::json!(chrono::Utc::now().to_rfc3339()));

        // Check WebSocket connections
        if let Some(stats) = self.get_websocket_stats().await {
            status.insert("websocket_connections".to_string(), serde_json::json!(stats));
        }

        Ok(status)
    }

    /// Start the server
    pub async fn start(self) -> GatewayResult<()> {
        let addr = format!("{}:{}", self.config.host, self.config.port)
            .parse::<SocketAddr>()
            .map_err(|e| GatewayError::Config(format!("Invalid address: {}", e)))?;

        // Setup routes from config
        self.setup_routes().await?;

        // Merge with WebSocket routes if WebSocket manager is available
        let app = if let Some(ws_manager) = &self.state.websocket_manager {
            AxumRouter::new()
                .route("/*path", any(Self::handle_request))
                .merge(websocket_routes(ws_manager.clone()))
                .layer(CorsLayer::permissive()) // Enable CORS
                .with_state(self.state)
        } else {
            AxumRouter::new()
                .route("/*path", any(Self::handle_request))
                .layer(CorsLayer::permissive()) // Enable CORS
                .with_state(self.state)
        };

        tracing::info!("Starting gateway server on {}", addr);

        let server = axum::Server::bind(&addr)
            .serve(app.into_make_service())
            .with_graceful_shutdown(Self::shutdown_signal());

        server.await
            .map_err(|e| GatewayError::Http(format!("Server error: {}", e)))?;

        Ok(())
    }

    /// Setup routes from configuration
    async fn setup_routes(&self) -> GatewayResult<()> {
        let mut router = self.state.router.write().await;

        for route_config in &self.config.routes {
            if route_config.enabled {
                router.add_route(route_config.clone())?;
            }
        }

        tracing::info!("Loaded {} routes", self.config.routes.len());
        Ok(())
    }

    /// Create default middleware chain
    fn create_default_middlewares() -> MiddlewareChain {
        MiddlewareChain::new()
            .add_middleware(RequestIdMiddleware::new())
            .add_middleware(LoggingMiddleware::new())
            .add_middleware(CorsMiddleware::new())
            .add_middleware(RateLimitMiddleware::new(100, 60)) // 100 requests per minute
    }

    /// Handle incoming requests
    async fn handle_request(
        State(state): State<ServerState>,
        method: Method,
        Path(path): Path<String>,
        Query(query): Query<HashMap<String, String>>,
        headers: HeaderMap,
        body: String,
    ) -> Response {
        // Convert Axum request to our HttpRequest
        let request = match Self::convert_request(method, path, query, headers, body).await {
            Ok(req) => req,
            Err(e) => return Self::error_response(StatusCode::BAD_REQUEST, e.to_string()),
        };

        // Process through middleware
        let mut request = request;
        let middleware_chain = state.middleware_chain.read().await;
        if let Err(e) = middleware_chain.process_request(&mut request).await {
            return Self::error_response(StatusCode::BAD_REQUEST, e.to_string());
        }

        // Route the request
        let router = state.router.read().await;
        let route_match = match router.match_route(&request) {
            Ok(route) => Some(route),
            Err(_) => None, // Will be handled as 404 by dispatcher
        };

        // Dispatch to handler
        let dispatcher = state.dispatcher.read().await;
        let response = match dispatcher.dispatch(request.clone(), route_match).await {
            Ok(resp) => resp,
            Err(e) => {
                tracing::error!("Request handling error: {:?}", e);
                return Self::error_response(StatusCode::INTERNAL_SERVER_ERROR, "Internal Server Error".to_string());
            }
        };

        // Process response through middleware
        let mut response = response;
        if let Err(e) = middleware_chain.process_response(&mut response).await {
            tracing::error!("Response middleware error: {:?}", e);
        }

        // Convert to Axum response
        Self::convert_response(response).await
    }

    /// Convert Axum request to HttpRequest
    async fn convert_request(
        method: Method,
        path: String,
        query: HashMap<String, String>,
        headers: HeaderMap,
        body: String,
    ) -> GatewayResult<HttpRequest> {
        let http_method = match method {
            Method::GET => HttpMethod::GET,
            Method::POST => HttpMethod::POST,
            Method::PUT => HttpMethod::PUT,
            Method::DELETE => HttpMethod::DELETE,
            Method::PATCH => HttpMethod::PATCH,
            Method::HEAD => HttpMethod::HEAD,
            Method::OPTIONS => HttpMethod::OPTIONS,
            _ => return Err(GatewayError::Http("Unsupported method".to_string())),
        };

        let headers_map = headers
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();

        Ok(HttpRequest {
            method: http_method,
            path: format!("/{}", path.trim_start_matches('/')),
            query,
            headers: headers_map,
            body: if body.is_empty() { None } else { Some(body.into_bytes()) },
            remote_addr: None, // Would be set by middleware
            request_id: String::new(), // Will be set by middleware
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        })
    }

    /// Convert HttpResponse to Axum response
    async fn convert_response(response: HttpResponse) -> Response {
        use axum::response::Json;
        use serde_json::json;

        // For now, return a JSON response
        let response_json = json!({
            "status_code": response.status_code,
            "headers": response.headers,
            "body": response.body.map(|b| String::from_utf8_lossy(&b).to_string())
        });

        (axum::http::StatusCode::from_u16(response.status_code).unwrap_or(axum::http::StatusCode::OK), Json(response_json)).into_response()
    }

    /// Create error response
    fn error_response(status: StatusCode, message: String) -> Response {
        use axum::response::Json;
        use serde_json::json;

        let error_json = json!({
            "error": message,
            "status_code": status.as_u16()
        });

        (status, Json(error_json)).into_response()
    }

    /// Shutdown signal handler
    async fn shutdown_signal() {
        let ctrl_c = async {
            tokio::signal::ctrl_c()
                .await
                .expect("failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("failed to install signal handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }

        tracing::info!("Shutdown signal received");
    }
}

impl Default for GatewayServer {
    fn default() -> Self {
        Self::new(GatewayConfig::default(), None, None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_server_creation() {
        let config = GatewayConfig::default();
        let server = GatewayServer::new(config);
        // Basic test that server can be created
        assert_eq!(server.config.host, "127.0.0.1");
        assert_eq!(server.config.port, 8080);
    }
}
