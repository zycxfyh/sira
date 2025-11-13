//! Simple test server for Sira Gateway

use axum::{
    extract::Query,
    response::Json,
    routing::get,
    Router,
};
use serde_json::json;
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Build our application with a route
    let app = Router::new()
        .route("/", get(root))
        .route("/health", get(health_check))
        .route("/api/test", get(api_test));

    // Run it
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("íº€ Gateway server listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

async fn root() -> &'static str {
    "Sira Gateway - Hello World!"
}

async fn health_check() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "service": "sira-gateway",
        "version": "0.1.0",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

async fn api_test(Query(params): Query<std::collections::HashMap<String, String>>) -> Json<serde_json::Value> {
    Json(json!({
        "message": "API test endpoint",
        "params": params,
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
