//! Message bus for inter-component communication
//!
//! This module provides an event-driven communication system that allows
//! different components (plugins, services, layers) to communicate asynchronously.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock, broadcast};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use futures::StreamExt;

use crate::error::{KernelError, KernelResult};

/// Message structure for the message bus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    /// Unique message identifier
    pub id: String,
    /// Message topic/channel
    pub topic: String,
    /// Message payload
    pub payload: serde_json::Value,
    /// Message timestamp
    pub timestamp: DateTime<Utc>,
    /// Message headers/metadata
    pub headers: HashMap<String, String>,
    /// Message priority (higher = more urgent)
    #[serde(default)]
    pub priority: MessagePriority,
    /// Message TTL in seconds (0 = no expiration)
    #[serde(default)]
    pub ttl: u32,
    /// Sender identifier
    pub sender: Option<String>,
    /// Target recipients (empty = broadcast)
    #[serde(default)]
    pub recipients: Vec<String>,
}

/// Message priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum MessagePriority {
    /// Low priority
    Low = 0,
    /// Normal priority (default)
    Normal = 1,
    /// High priority
    High = 2,
    /// Critical priority
    Critical = 3,
}

impl Default for MessagePriority {
    fn default() -> Self {
        MessagePriority::Normal
    }
}

/// Message handler trait
#[async_trait]
pub trait MessageHandler: Send + Sync {
    /// Handle a message
    async fn handle_message(&self, message: &Message) -> KernelResult<Option<Message>>;
}

/// Subscription information
#[derive(Clone)]
struct Subscription {
    /// Subscriber ID
    id: String,
    /// Subscribed topics (with wildcards support)
    topics: Vec<String>,
    /// Message handler
    handler: Arc<dyn MessageHandler>,
    /// Subscription options
    options: SubscriptionOptions,
}

/// Subscription options
#[derive(Clone)]
pub struct SubscriptionOptions {
    /// Maximum number of concurrent messages to process
    pub max_concurrent: usize,
    /// Message processing timeout (in seconds)
    pub timeout: u32,
    /// Whether to acknowledge messages automatically
    pub auto_ack: bool,
    /// Message filter function
    pub filter: Option<Arc<dyn Fn(&Message) -> bool + Send + Sync>>,
}

impl Default for SubscriptionOptions {
    fn default() -> Self {
        SubscriptionOptions {
            max_concurrent: 10,
            timeout: 30,
            auto_ack: true,
            filter: None,
        }
    }
}

/// Message bus for publish-subscribe communication
pub struct MessageBus {
    /// Broadcast channels for topics
    topics: Arc<RwLock<HashMap<String, broadcast::Sender<Message>>>>,
    /// Subscriptions
    subscriptions: Arc<RwLock<HashMap<String, Subscription>>>,
    /// Message queue for persistent messages
    message_queue: Arc<RwLock<VecDeque<Message>>>,
    /// Message history (for debugging and replay)
    message_history: Arc<RwLock<VecDeque<Message>>>,
    /// Maximum history size
    max_history_size: usize,
    /// Running flag
    running: Arc<RwLock<bool>>,
}

impl MessageBus {
    /// Create a new message bus
    pub fn new() -> Self {
        MessageBus {
            topics: Arc::new(RwLock::new(HashMap::new())),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            message_queue: Arc::new(RwLock::new(VecDeque::new())),
            message_history: Arc::new(RwLock::new(VecDeque::new())),
            max_history_size: 1000,
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start the message bus
    pub async fn start(&self) -> KernelResult<()> {
        let mut running = self.running.write().await;
        if *running {
            return Err(KernelError::message_bus_error("Message bus is already running"));
        }
        *running = true;

        // Start message processing task
        self.start_message_processor();

        tracing::info!("Message bus started");
        Ok(())
    }

    /// Stop the message bus
    pub async fn stop(&self) -> KernelResult<()> {
        let mut running = self.running.write().await;
        if !*running {
            return Err(KernelError::message_bus_error("Message bus is not running"));
        }
        *running = false;

        tracing::info!("Message bus stopped");
        Ok(())
    }

    /// Publish a message to a topic
    pub async fn publish(&self, mut message: Message) -> KernelResult<()> {
        // Set message ID if not provided
        if message.id.is_empty() {
            message.id = Uuid::new_v4().to_string();
        }

        // Set timestamp if not provided
        if message.timestamp == DateTime::<Utc>::MIN_UTC {
            message.timestamp = Utc::now();
        }

        // Check TTL
        if message.ttl > 0 {
            let now = Utc::now();
            if now.signed_duration_since(message.timestamp).num_seconds() > message.ttl as i64 {
                tracing::warn!("Message {} expired, dropping", message.id);
                return Ok(());
            }
        }

        // Add to history
        self.add_to_history(message.clone()).await;

        // Get or create topic channel
        let sender = self.get_or_create_topic(&message.topic).await;

        // Send to subscribers
        let subscriber_count = sender.send(message.clone())
            .map_err(|e| KernelError::message_bus_error(format!("Failed to send message: {}", e)))?;

        if subscriber_count == 0 {
            tracing::debug!("No subscribers for topic '{}'", message.topic);
        } else {
            tracing::debug!("Message sent to {} subscribers on topic '{}'", subscriber_count, message.topic);
        }

        Ok(())
    }

    /// Subscribe to topics with a handler
    pub async fn subscribe(
        &self,
        subscriber_id: String,
        topics: Vec<String>,
        handler: Arc<dyn MessageHandler>,
        options: SubscriptionOptions,
    ) -> KernelResult<()> {
        let subscription = Subscription {
            id: subscriber_id.clone(),
            topics: topics.clone(),
            handler,
            options,
        };

        // Store subscription
        self.subscriptions.write().await.insert(subscriber_id.clone(), subscription);

        // Subscribe to topics
        for topic in &topics {
            let sender = self.get_or_create_topic(topic).await;
            // The subscription is handled by the message processor
        }

        tracing::info!("Subscriber '{}' subscribed to topics: {:?}", subscriber_id, topics);
        Ok(())
    }

    /// Unsubscribe from topics
    pub async fn unsubscribe(&self, subscriber_id: &str) -> KernelResult<()> {
        let mut subscriptions = self.subscriptions.write().await;

        if subscriptions.remove(subscriber_id).is_some() {
            tracing::info!("Subscriber '{}' unsubscribed", subscriber_id);
            Ok(())
        } else {
            Err(KernelError::message_bus_error(format!("Subscriber '{}' not found", subscriber_id)))
        }
    }

    /// Get subscribers for a topic
    pub async fn get_subscribers(&self, topic: &str) -> Vec<String> {
        let subscriptions = self.subscriptions.read().await;
        subscriptions
            .values()
            .filter(|sub| sub.topics.iter().any(|t| self.topic_matches(t, topic)))
            .map(|sub| sub.id.clone())
            .collect()
    }

    /// Send a message directly to specific recipients
    pub async fn send_to(
        &self,
        message: Message,
        recipients: Vec<String>,
    ) -> KernelResult<()> {
        let mut message = message;
        message.recipients = recipients;

        self.publish(message).await
    }

    /// Request-Response pattern
    pub async fn request(
        &self,
        request: Message,
        timeout: std::time::Duration,
    ) -> KernelResult<Message> {
        let response_topic = format!("response.{}", request.id);

        // Subscribe to response topic
        let (tx, mut rx) = mpsc::channel(1);
        let handler = Arc::new(RequestResponseHandler { sender: tx });
        self.subscribe(
            format!("request_{}", request.id),
            vec![response_topic.clone()],
            handler,
            SubscriptionOptions::default(),
        ).await?;

        // Publish request
        self.publish(request.clone()).await?;

        // Wait for response
        match tokio::time::timeout(timeout, rx.recv()).await {
            Ok(Some(response)) => {
                // Cleanup subscription
                self.unsubscribe(&format!("request_{}", response.id)).await?;
                Ok(response)
            }
            Ok(None) => {
                // Cleanup subscription
                self.unsubscribe(&format!("request_{}", request.id)).await?;
                Err(KernelError::message_bus_error("Response channel closed"))
            }
            Err(_) => {
                // Cleanup subscription
                self.unsubscribe(&format!("request_{}", request.id)).await?;
                Err(KernelError::message_bus_error("Request timeout"))
            }
        }
    }

    /// Get message history
    pub async fn get_history(&self, limit: usize) -> Vec<Message> {
        let history = self.message_history.read().await;
        history.iter().rev().take(limit).cloned().collect()
    }

    /// Get message statistics
    pub async fn get_stats(&self) -> HashMap<String, serde_json::Value> {
        let topics = self.topics.read().await;
        let subscriptions = self.subscriptions.read().await;
        let message_queue = self.message_queue.read().await;
        let history = self.message_history.read().await;

        let mut stats = HashMap::new();
        stats.insert("total_topics".to_string(), serde_json::json!(topics.len()));
        stats.insert("total_subscriptions".to_string(), serde_json::json!(subscriptions.len()));
        stats.insert("queued_messages".to_string(), serde_json::json!(message_queue.len()));
        stats.insert("history_size".to_string(), serde_json::json!(history.len()));

        stats
    }

    /// Get or create topic channel
    async fn get_or_create_topic(&self, topic: &str) -> broadcast::Sender<Message> {
        let mut topics = self.topics.write().await;

        if let Some(sender) = topics.get(topic) {
            sender.clone()
        } else {
            let (sender, _) = broadcast::channel(100); // Buffer size
            topics.insert(topic.to_string(), sender.clone());
            sender
        }
    }

    /// Check if topic matches pattern (with wildcard support)
    fn topic_matches(&self, pattern: &str, topic: &str) -> bool {
        if pattern == topic {
            return true;
        }

        // Simple wildcard matching (*)
        if pattern.contains('*') {
            let pattern_parts: Vec<&str> = pattern.split('*').collect();
            let mut topic_pos = 0;

            for (i, part) in pattern_parts.iter().enumerate() {
                if let Some(pos) = topic[topic_pos..].find(part) {
                    topic_pos += pos + part.len();
                } else if i == 0 && !pattern.starts_with('*') {
                    return false;
                } else if i == pattern_parts.len() - 1 && !pattern.ends_with('*') {
                    return false;
                }
            }
            return true;
        }

        false
    }

    /// Add message to history
    async fn add_to_history(&self, message: Message) {
        let mut history = self.message_history.write().await;

        history.push_back(message);
        if history.len() > self.max_history_size {
            history.pop_front();
        }
    }

    /// Start message processing task
    fn start_message_processor(&self) {
        let topics = Arc::clone(&self.topics);
        let subscriptions = Arc::clone(&self.subscriptions);
        let running = Arc::clone(&self.running);

        tokio::spawn(async move {
            loop {
                // Check if still running
                {
                    let running_read = running.read().await;
                    if !*running_read {
                        break;
                    }
                }

                // Process messages from all topics
                let topic_names: Vec<String> = {
                    let topics_read = topics.read().await;
                    topics_read.keys().cloned().collect()
                };

                for topic_name in topic_names {
                    let sender = {
                        let topics_read = topics.read().await;
                        topics_read.get(&topic_name).cloned()
                    };

                    if let Some(sender) = sender {
                        let mut receiver = sender.subscribe();
                        let subscriptions_clone = Arc::clone(&subscriptions);

                        tokio::spawn(async move {
                            while let Ok(message) = receiver.recv().await {
                                // Find matching subscriptions
                                let subscriptions_read = subscriptions_clone.read().await;
                                let matching_subs: Vec<_> = subscriptions_read
                                    .values()
                                    .filter(|sub| {
                                        sub.topics.iter().any(|t| Self::topic_matches_static(t, &message.topic)) &&
                                        sub.options.filter.as_ref().map_or(true, |f| f(&message))
                                    })
                                    .collect();

                                // Send to matching subscribers
                                for sub in matching_subs {
                                    let handler = sub.handler.clone();
                                    let message = message.clone();

                                    tokio::spawn(async move {
                                        match handler.handle_message(&message).await {
                                            Ok(Some(_response)) => {
                                                // Handle response if needed
                                                tracing::debug!("Handler processed message {}", message.id);
                                            }
                                            Ok(None) => {
                                                tracing::debug!("Handler ignored message {}", message.id);
                                            }
                                            Err(e) => {
                                                tracing::error!("Handler error for message {}: {}", message.id, e);
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }

                // Sleep before next iteration
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
            }
        });
    }

    /// Static version of topic_matches for use in async contexts
    fn topic_matches_static(pattern: &str, topic: &str) -> bool {
        if pattern == topic {
            return true;
        }

        // Simple wildcard matching (*)
        if pattern.contains('*') {
            let pattern_parts: Vec<&str> = pattern.split('*').collect();
            let mut topic_pos = 0;

            for (i, part) in pattern_parts.iter().enumerate() {
                if let Some(pos) = topic[topic_pos..].find(part) {
                    topic_pos += pos + part.len();
                } else if i == 0 && !pattern.starts_with('*') {
                    return false;
                } else if i == pattern_parts.len() - 1 && !pattern.ends_with('*') {
                    return false;
                }
            }
            return true;
        }

        false
    }
}

/// Request-response handler for the request() method
struct RequestResponseHandler {
    sender: mpsc::Sender<Message>,
}

#[async_trait]
impl MessageHandler for RequestResponseHandler {
    async fn handle_message(&self, message: &Message) -> KernelResult<Option<Message>> {
        self.sender.send(message.clone()).await
            .map_err(|_| KernelError::message_bus_error("Failed to send response"))?;
        Ok(None)
    }
}

/// Helper macro for publishing messages
#[macro_export]
macro_rules! publish_message {
    ($bus:expr, $topic:expr, $payload:expr) => {
        $bus.publish($crate::message::Message {
            id: String::new(),
            topic: $topic.to_string(),
            payload: serde_json::to_value($payload).unwrap_or(serde_json::Value::Null),
            timestamp: chrono::Utc::now(),
            headers: std::collections::HashMap::new(),
            priority: $crate::message::MessagePriority::Normal,
            ttl: 0,
            sender: None,
            recipients: vec![],
        }).await
    };
}

/// Helper macro for subscribing to messages
#[macro_export]
macro_rules! subscribe_messages {
    ($bus:expr, $id:expr, $topics:expr, $handler:expr) => {
        $bus.subscribe(
            $id.to_string(),
            $topics.iter().map(|s: &&str| s.to_string()).collect(),
            std::sync::Arc::new($handler),
            $crate::message::SubscriptionOptions::default(),
        ).await
    };
}
