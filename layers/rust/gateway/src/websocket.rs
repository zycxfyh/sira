//! WebSocket Communication Service for Sira Gateway
//!
//! Provides real-time bidirectional communication for AI streaming responses
//! and interactive conversations.

use crate::{GatewayResult, GatewayError};
use axum::{
    extract::{ws::WebSocketUpgrade, State, Path},
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// WebSocket message types for AI communication
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WebSocketMessage {
    /// Client requests to start a conversation
    StartConversation {
        session_id: Option<String>,
        model: String,
        system_prompt: Option<String>,
        temperature: Option<f32>,
    },

    /// Client sends a message
    SendMessage {
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
    },

    /// Client requests to end conversation
    EndConversation,

    /// Server acknowledges connection
    ConnectionAck {
        connection_id: String,
        session_id: String,
    },

    /// Server sends streaming response
    StreamingResponse {
        chunk: String,
        is_done: bool,
        usage: Option<StreamingUsage>,
    },

    /// Server sends complete response
    CompleteResponse {
        content: String,
        usage: StreamingUsage,
        finish_reason: String,
    },

    /// Server sends error
    Error {
        code: String,
        message: String,
        details: Option<serde_json::Value>,
    },

    /// Ping/Pong for connection health
    Ping,
    Pong,
}

/// Streaming usage information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// WebSocket connection state
#[derive(Debug, Clone)]
pub enum ConnectionState {
    Connected,
    Authenticating,
    Active { session_id: String },
    Error,
    Closed,
}

/// WebSocket connection information
#[derive(Debug)]
pub struct WebSocketConnection {
    pub id: String,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub state: ConnectionState,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

/// WebSocket connection manager
pub struct WebSocketManager {
    connections: Arc<RwLock<HashMap<String, WebSocketConnection>>>,
    ai_client: Arc<sira_ai_backends::AiBackendClient>,
    session_manager: Option<Arc<sira_session::SessionManager>>,
}

impl WebSocketManager {
    /// Create a new WebSocket manager
    pub fn new(
        ai_client: Arc<sira_ai_backends::AiBackendClient>,
        session_manager: Option<Arc<sira_session::SessionManager>>,
    ) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            ai_client,
            session_manager,
        }
    }

    /// Handle WebSocket upgrade and connection
    pub async fn handle_connection(
        self: Arc<Self>,
        ws: WebSocketUpgrade,
        user_id: Option<String>,
    ) -> Response {
        let connection_id = Uuid::new_v4().to_string();

        ws.on_upgrade(move |socket| async move {
            if let Err(e) = self.clone().handle_socket(socket, connection_id.clone(), user_id).await {
                error!("WebSocket connection error for {}: {:?}", connection_id, e);
            }
        })
    }

    /// Handle individual WebSocket connection
    async fn handle_socket(
        self: Arc<Self>,
        socket: axum::extract::ws::WebSocket,
        connection_id: String,
        user_id: Option<String>,
    ) -> GatewayResult<()> {
        let (sender, mut receiver) = socket.split();
        let (tx, mut rx) = mpsc::channel::<WebSocketMessage>(100);

        // Register connection
        let connection = WebSocketConnection {
            id: connection_id.clone(),
            user_id: user_id.clone(),
            session_id: None,
            state: ConnectionState::Connected,
            created_at: chrono::Utc::now(),
            last_activity: chrono::Utc::now(),
        };

        {
            let mut connections = self.connections.write().await;
            connections.insert(connection_id.clone(), connection);
        }

        info!("WebSocket connection established: {}", connection_id);

        // Send connection acknowledgment
        let ack_msg = WebSocketMessage::ConnectionAck {
            connection_id: connection_id.clone(),
            session_id: "".to_string(), // Will be set later
        };

        if tx.send(ack_msg).await.is_err() {
            return Ok(()); // Connection closed
        }

        // Spawn sender task
        let sender_task = tokio::spawn(async move {
            let mut sender = sender;
            while let Some(message) = rx.recv().await {
                let json = match serde_json::to_string(&message) {
                    Ok(json) => json,
                    Err(e) => {
                        error!("Failed to serialize WebSocket message: {:?}", e);
                        continue;
                    }
                };

                if sender.send(axum::extract::ws::Message::Text(json)).await.is_err() {
                    break;
                }
            }
        });

        // Main message handling loop
        let mut conversation_context: Vec<HashMap<String, serde_json::Value>> = Vec::new();

        while let Some(msg) = receiver.next().await {
            let msg = match msg {
                Ok(msg) => msg,
                Err(e) => {
                    error!("WebSocket message error: {:?}", e);
                    break;
                }
            };

            let text = match msg {
                axum::extract::ws::Message::Text(text) => text,
                axum::extract::ws::Message::Ping(data) => {
                    if tx.send(WebSocketMessage::Pong).await.is_err() {
                        break;
                    }
                    continue;
                }
                axum::extract::ws::Message::Pong(_) => continue,
                axum::extract::ws::Message::Close(_) => break,
                _ => continue,
            };

            // Parse incoming message
            let incoming_msg: WebSocketMessage = match serde_json::from_str(&text) {
                Ok(msg) => msg,
                Err(e) => {
                    let error_msg = WebSocketMessage::Error {
                        code: "INVALID_MESSAGE".to_string(),
                        message: format!("Invalid message format: {}", e),
                        details: None,
                    };
                    let _ = tx.send(error_msg).await;
                    continue;
                }
            };

            // Handle message
            if let Err(e) = self.clone().handle_message(
                incoming_msg,
                &tx,
                &connection_id,
                &mut conversation_context,
            ).await {
                error!("Error handling WebSocket message: {:?}", e);
                let error_msg = WebSocketMessage::Error {
                    code: "INTERNAL_ERROR".to_string(),
                    message: "Internal server error".to_string(),
                    details: None,
                };
                let _ = tx.send(error_msg).await;
            }
        }

        // Clean up connection
        {
            let mut connections = self.connections.write().await;
            connections.remove(&connection_id);
        }

        info!("WebSocket connection closed: {}", connection_id);
        sender_task.abort();

        Ok(())
    }

    /// Handle incoming WebSocket message
    async fn handle_message(
        self: Arc<Self>,
        message: WebSocketMessage,
        tx: &mpsc::Sender<WebSocketMessage>,
        connection_id: &str,
        conversation_context: &mut Vec<HashMap<String, serde_json::Value>>,
    ) -> GatewayResult<()> {
        match message {
            WebSocketMessage::StartConversation { session_id, model, system_prompt, temperature } => {
                self.handle_start_conversation(tx, connection_id, session_id, model, system_prompt, temperature).await?;
            }

            WebSocketMessage::SendMessage { content, metadata } => {
                self.handle_send_message(tx, connection_id, content, metadata, conversation_context).await?;
            }

            WebSocketMessage::EndConversation => {
                self.handle_end_conversation(tx, connection_id).await?;
            }

            WebSocketMessage::Ping => {
                let _ = tx.send(WebSocketMessage::Pong).await;
            }

            _ => {
                warn!("Unhandled WebSocket message type");
            }
        }

        Ok(())
    }

    /// Handle conversation start
    async fn handle_start_conversation(
        self: Arc<Self>,
        tx: &mpsc::Sender<WebSocketMessage>,
        connection_id: &str,
        session_id: Option<String>,
        model: String,
        system_prompt: Option<String>,
        temperature: Option<f32>,
    ) -> GatewayResult<()> {
        // Create or get session
        let actual_session_id = if let Some(sid) = session_id {
            sid
        } else {
            // Create new session
            if let Some(session_mgr) = &self.session_manager {
                let user_id = {
                    let connections = self.connections.read().await;
                    connections.get(connection_id).and_then(|c| c.user_id.clone()).unwrap_or_else(|| "anonymous".to_string())
                };

                session_mgr.create_session(user_id, HashMap::new()).await?
            } else {
                Uuid::new_v4().to_string()
            }
        };

        // Update connection state
        {
            let mut connections = self.connections.write().await;
            if let Some(conn) = connections.get_mut(connection_id) {
                conn.session_id = Some(actual_session_id.clone());
                conn.state = ConnectionState::Active { session_id: actual_session_id.clone() };
            }
        }

        // Send updated connection ack
        let ack_msg = WebSocketMessage::ConnectionAck {
            connection_id: connection_id.to_string(),
            session_id: actual_session_id,
        };

        tx.send(ack_msg).await.map_err(|_| GatewayError::InternalServerError("Failed to send message".to_string()))?;

        Ok(())
    }

    /// Handle message sending and AI response
    async fn handle_send_message(
        self: Arc<Self>,
        tx: &mpsc::Sender<WebSocketMessage>,
        connection_id: &str,
        content: String,
        metadata: Option<HashMap<String, serde_json::Value>>,
        conversation_context: &mut Vec<HashMap<String, serde_json::Value>>,
    ) -> GatewayResult<()> {
        // Add user message to context
        let mut user_message = HashMap::new();
        user_message.insert("role".to_string(), serde_json::json!("user"));
        user_message.insert("content".to_string(), serde_json::json!(content));
        if let Some(meta) = metadata {
            user_message.insert("metadata".to_string(), serde_json::json!(meta));
        }
        conversation_context.push(user_message);

        // Prepare chat request
        let session_id = {
            let connections = self.connections.read().await;
            connections.get(connection_id)
                .and_then(|c| c.session_id.clone())
                .unwrap_or_else(|| "default".to_string())
        };

        // Convert conversation context to ChatMessage format
        let chat_messages: Vec<sira_ai_backends::ChatMessage> = conversation_context.iter()
            .map(|msg| {
                let role = match msg.get("role").and_then(|r| r.as_str()) {
                    Some("system") => sira_ai_backends::MessageRole::System,
                    Some("user") => sira_ai_backends::MessageRole::User,
                    Some("assistant") => sira_ai_backends::MessageRole::Assistant,
                    _ => sira_ai_backends::MessageRole::User,
                };

                let content = msg.get("content")
                    .and_then(|c| c.as_str())
                    .unwrap_or("")
                    .to_string();

                sira_ai_backends::ChatMessage {
                    role,
                    content: sira_ai_backends::MessageContent::Text(content),
                    name: None,
                    function_call: None,
                }
            })
            .collect();

        let chat_request = sira_ai_backends::ChatRequest {
            messages: chat_messages,
            model: "gpt-3.5-turbo".to_string(), // TODO: Get from session
            max_tokens: Some(1000),
            temperature: Some(0.7),
            stream: Some(true), // Enable streaming for WebSocket
            ..Default::default()
        };

        // Send streaming response
        match self.ai_client.chat_completion_stream(chat_request).await {
            Ok(mut stream) => {
                let mut full_content = String::new();
                let mut usage: Option<StreamingUsage> = None;

                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(response) => {
                            if let Some(choice) = response.choices.first() {
                                if let Some(content) = &choice.delta.content {
                                    full_content.push_str(content);

                                    let streaming_msg = WebSocketMessage::StreamingResponse {
                                        chunk: content.to_string(),
                                        is_done: false,
                                        usage: None,
                                    };

                                    if tx.send(streaming_msg).await.is_err() {
                                        break;
                                    }
                                }
                            }

                            if let Some(usage_info) = response.usage {
                                usage = Some(StreamingUsage {
                                    prompt_tokens: usage_info.prompt_tokens,
                                    completion_tokens: usage_info.completion_tokens,
                                    total_tokens: usage_info.total_tokens,
                                });
                            }
                        }
                        Err(e) => {
                            error!("Streaming error: {:?}", e);
                            let error_msg = WebSocketMessage::Error {
                                code: "STREAMING_ERROR".to_string(),
                                message: format!("Streaming failed: {}", e),
                                details: None,
                            };
                            let _ = tx.send(error_msg).await;
                            return Ok(());
                        }
                    }
                }

                // Send completion message
                if let Some(usage) = usage {
                    let complete_msg = WebSocketMessage::CompleteResponse {
                        content: full_content,
                        usage,
                        finish_reason: "stop".to_string(),
                    };

                    let _ = tx.send(complete_msg).await;
                } else {
                    // Send final streaming chunk
                    let final_msg = WebSocketMessage::StreamingResponse {
                        chunk: "".to_string(),
                        is_done: true,
                        usage,
                    };

                    let _ = tx.send(final_msg).await;
                }

                // Add assistant message to context
                let mut assistant_message = HashMap::new();
                assistant_message.insert("role".to_string(), serde_json::json!("assistant"));
                assistant_message.insert("content".to_string(), serde_json::json!(full_content));
                conversation_context.push(assistant_message);
            }
            Err(e) => {
                error!("AI request error: {:?}", e);
                let error_msg = WebSocketMessage::Error {
                    code: "AI_REQUEST_ERROR".to_string(),
                    message: format!("AI request failed: {}", e),
                    details: None,
                };
                let _ = tx.send(error_msg).await;
            }
        }

        Ok(())
    }

    /// Handle conversation end
    async fn handle_end_conversation(
        self: Arc<Self>,
        tx: &mpsc::Sender<WebSocketMessage>,
        connection_id: &str,
    ) -> GatewayResult<()> {
        // Update connection state
        {
            let mut connections = self.connections.write().await;
            if let Some(conn) = connections.get_mut(connection_id) {
                conn.state = ConnectionState::Closed;
            }
        }

        Ok(())
    }

    /// Get connection statistics
    pub async fn get_stats(&self) -> HashMap<String, usize> {
        let connections = self.connections.read().await;
        let mut stats = HashMap::new();

        stats.insert("total_connections".to_string(), connections.len());
        stats.insert("active_connections".to_string(),
            connections.values().filter(|c| matches!(c.state, ConnectionState::Active { .. })).count());

        stats
    }
}

/// Create WebSocket routes
pub fn websocket_routes(manager: Arc<WebSocketManager>) -> axum::Router {
    use axum::{routing::get, extract::Path, Router};

    let manager_clone1 = manager.clone();
    let manager_clone2 = manager.clone();

    Router::new()
        .route("/ws", get(move |ws: axum::extract::ws::WebSocketUpgrade| async move {
            manager_clone1.handle_connection(ws, None).await
        }))
        .route("/ws/:user_id", get(move |ws: axum::extract::ws::WebSocketUpgrade, Path(user_id): Path<String>| async move {
            manager_clone2.handle_connection(ws, Some(user_id)).await
        }))
        .with_state(manager)
}
