//! Service registry and discovery for the Sira microkernel
//!
//! This module provides service registration, discovery, and management
//! capabilities for the microkernel ecosystem.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::error::{KernelError, KernelResult};
use crate::message::{MessageBus, Message};

/// Service metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMetadata {
    /// Unique service identifier
    pub id: String,
    /// Human-readable service name
    pub name: String,
    /// Service version
    pub version: String,
    /// Service description
    pub description: String,
    /// Service endpoint (URL, address, etc.)
    pub endpoint: String,
    /// Service type (HTTP, gRPC, WebSocket, etc.)
    pub service_type: ServiceType,
    /// Service capabilities
    pub capabilities: Vec<String>,
    /// Service dependencies
    pub dependencies: Vec<String>,
    /// Health check endpoint
    pub health_check: Option<String>,
    /// Service status
    pub status: ServiceStatus,
    /// Registration timestamp
    pub registered_at: DateTime<Utc>,
    /// Last heartbeat timestamp
    pub last_heartbeat: DateTime<Utc>,
    /// Service tags for filtering
    pub tags: Vec<String>,
    /// Service priority (higher = more preferred)
    pub priority: i32,
    /// Load balancing weight
    pub weight: u32,
    /// Service region/location
    pub region: Option<String>,
}

/// Service types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ServiceType {
    /// HTTP REST API service
    Http,
    /// gRPC service
    Grpc,
    /// WebSocket service
    WebSocket,
    /// Message queue service
    MessageQueue,
    /// Database service
    Database,
    /// Cache service
    Cache,
    /// Storage service
    Storage,
    /// AI/ML service
    Ai,
    /// Monitoring service
    Monitoring,
    /// Plugin service
    Plugin,
    /// Custom service type
    Custom,
}

/// Service status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServiceStatus {
    /// Service is starting up
    Starting,
    /// Service is healthy and running
    Healthy,
    /// Service is degraded but functional
    Degraded,
    /// Service is unhealthy
    Unhealthy,
    /// Service is shutting down
    Stopping,
    /// Service is down
    Down,
    /// Service status unknown
    Unknown,
}

/// Service instance
#[derive(Clone)]
pub struct ServiceInstance {
    /// Service metadata
    pub metadata: ServiceMetadata,
    /// Service implementation
    pub instance: Option<Arc<dyn Service>>,
    /// Instance-specific configuration
    pub config: serde_json::Value,
}

/// Core service trait
#[async_trait]
pub trait Service: Send + Sync {
    /// Get service metadata
    fn metadata(&self) -> ServiceMetadata;

    /// Start the service
    async fn start(&self) -> KernelResult<()>;

    /// Stop the service
    async fn stop(&self) -> KernelResult<()>;

    /// Get service health status
    async fn health(&self) -> KernelResult<ServiceStatus>;

    /// Handle a service request
    async fn handle_request(
        &self,
        request: ServiceRequest,
    ) -> KernelResult<ServiceResponse>;

    /// Get service metrics
    async fn metrics(&self) -> KernelResult<HashMap<String, serde_json::Value>> {
        Ok(HashMap::new())
    }
}

/// Service request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceRequest {
    /// Request ID
    pub id: String,
    /// Service method/operation
    pub method: String,
    /// Request parameters
    pub params: serde_json::Value,
    /// Request headers/metadata
    pub headers: HashMap<String, String>,
    /// Request timestamp
    pub timestamp: DateTime<Utc>,
    /// Request timeout (in seconds)
    pub timeout: Option<u32>,
}

/// Service response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceResponse {
    /// Response ID (matches request ID)
    pub id: String,
    /// Response status
    pub status: ResponseStatus,
    /// Response data
    pub data: serde_json::Value,
    /// Response headers/metadata
    pub headers: HashMap<String, String>,
    /// Response timestamp
    pub timestamp: DateTime<Utc>,
    /// Processing time (in milliseconds)
    pub processing_time_ms: u64,
}

/// Response status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResponseStatus {
    /// Request successful
    Success,
    /// Request failed with error
    Error,
    /// Request partially successful
    Partial,
    /// Request timed out
    Timeout,
    /// Service unavailable
    Unavailable,
}

/// Service discovery query
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceQuery {
    /// Service name filter (optional)
    pub name: Option<String>,
    /// Service type filter (optional)
    pub service_type: Option<ServiceType>,
    /// Capability filter (optional)
    pub capability: Option<String>,
    /// Tag filter (optional)
    pub tags: Option<Vec<String>>,
    /// Region filter (optional)
    pub region: Option<String>,
    /// Status filter (optional)
    pub status: Option<ServiceStatus>,
    /// Minimum priority (optional)
    pub min_priority: Option<i32>,
    /// Maximum results to return
    pub limit: Option<usize>,
}

/// Service registry for managing service registration and discovery
pub struct ServiceRegistry {
    /// Registered services
    services: RwLock<HashMap<String, ServiceInstance>>,
    /// Services by type
    services_by_type: RwLock<HashMap<ServiceType, Vec<String>>>,
    /// Services by capability
    services_by_capability: RwLock<HashMap<String, Vec<String>>>,
    /// Services by tag
    services_by_tag: RwLock<HashMap<String, Vec<String>>>,
    /// Message bus for service events
    message_bus: Arc<MessageBus>,
    /// Heartbeat interval (in seconds)
    heartbeat_interval: u64,
    /// Service timeout (in seconds)
    service_timeout: u64,
}

impl ServiceRegistry {
    /// Create a new service registry
    pub fn new(message_bus: Arc<MessageBus>) -> Self {
        ServiceRegistry {
            services: RwLock::new(HashMap::new()),
            services_by_type: RwLock::new(HashMap::new()),
            services_by_capability: RwLock::new(HashMap::new()),
            services_by_tag: RwLock::new(HashMap::new()),
            message_bus,
            heartbeat_interval: 30, // 30 seconds
            service_timeout: 90,     // 90 seconds
        }
    }

    /// Register a service
    pub async fn register_service(
        &self,
        service: Arc<dyn Service>,
        config: serde_json::Value,
    ) -> KernelResult<String> {
        let metadata = service.metadata();
        let service_id = metadata.id.clone();

        // Check if service is already registered
        if self.services.read().await.contains_key(&service_id) {
            return Err(KernelError::service_error(
                service_id,
                "Service already registered".to_string()
            ));
        }

        let instance = ServiceInstance {
            metadata: metadata.clone(),
            instance: Some(service),
            config,
        };

        // Store the service
        self.services.write().await.insert(service_id.clone(), instance);

        // Update indexes
        self.update_indexes(&metadata, true).await;

        // Publish service registration event
        let event = ServiceEvent::ServiceRegistered {
            service_id: service_id.clone(),
            metadata: metadata.clone(),
        };
        self.publish_event(event).await;

        tracing::info!("Service '{}' registered successfully", service_id);
        Ok(service_id)
    }

    /// Unregister a service
    pub async fn unregister_service(&self, service_id: &str) -> KernelResult<()> {
        let mut services = self.services.write().await;

        if let Some(instance) = services.remove(service_id) {
            // Update indexes
            self.update_indexes(&instance.metadata, false).await;

            // Publish service unregistration event
            let event = ServiceEvent::ServiceUnregistered {
                service_id: service_id.to_string(),
                metadata: instance.metadata,
            };
            self.publish_event(event).await;

            tracing::info!("Service '{}' unregistered successfully", service_id);
            Ok(())
        } else {
            Err(KernelError::service_error(
                service_id.to_string(),
                "Service not found".to_string()
            ))
        }
    }

    /// Discover services matching the query
    pub async fn discover_services(&self, query: &ServiceQuery) -> KernelResult<Vec<ServiceMetadata>> {
        let services = self.services.read().await;
        let mut results = Vec::new();

        for instance in services.values() {
            if self.matches_query(&instance.metadata, query) {
                results.push(instance.metadata.clone());
            }
        }

        // Sort by priority (higher first)
        results.sort_by(|a, b| b.priority.cmp(&a.priority));

        // Apply limit
        if let Some(limit) = query.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    /// Get service by ID
    pub async fn get_service(&self, service_id: &str) -> KernelResult<ServiceMetadata> {
        let services = self.services.read().await;

        if let Some(instance) = services.get(service_id) {
            Ok(instance.metadata.clone())
        } else {
            Err(KernelError::service_error(
                service_id.to_string(),
                "Service not found".to_string()
            ))
        }
    }

    /// Update service heartbeat
    pub async fn heartbeat(&self, service_id: &str) -> KernelResult<()> {
        let mut services = self.services.write().await;

        if let Some(instance) = services.get_mut(service_id) {
            instance.metadata.last_heartbeat = Utc::now();
            instance.metadata.status = ServiceStatus::Healthy;

            // Publish heartbeat event
            let event = ServiceEvent::ServiceHeartbeat {
                service_id: service_id.to_string(),
                timestamp: instance.metadata.last_heartbeat,
            };
            self.publish_event(event).await;

            Ok(())
        } else {
            Err(KernelError::service_error(
                service_id.to_string(),
                "Service not found".to_string()
            ))
        }
    }

    /// Update service status
    pub async fn update_service_status(
        &self,
        service_id: &str,
        status: ServiceStatus,
    ) -> KernelResult<()> {
        let mut services = self.services.write().await;

        if let Some(instance) = services.get_mut(service_id) {
            let old_status = instance.metadata.status;
            instance.metadata.status = status;

            // Publish status change event
            let event = ServiceEvent::ServiceStatusChanged {
                service_id: service_id.to_string(),
                old_status,
                new_status: status,
            };
            self.publish_event(event).await;

            tracing::info!("Service '{}' status changed: {:?} -> {:?}", service_id, old_status, status);
            Ok(())
        } else {
            Err(KernelError::service_error(
                service_id.to_string(),
                "Service not found".to_string()
            ))
        }
    }

    /// Call a service method
    pub async fn call_service(
        &self,
        service_id: &str,
        request: ServiceRequest,
    ) -> KernelResult<ServiceResponse> {
        let services = self.services.read().await;

        if let Some(instance) = services.get(service_id) {
            if let Some(service) = &instance.instance {
                let start_time = std::time::Instant::now();
                let response = service.handle_request(request).await?;
                let processing_time = start_time.elapsed().as_millis() as u64;

                Ok(ServiceResponse {
                    processing_time_ms: processing_time,
                    ..response
                })
            } else {
                Err(KernelError::service_error(
                    service_id.to_string(),
                    "Service instance not available".to_string()
                ))
            }
        } else {
            Err(KernelError::service_error(
                service_id.to_string(),
                "Service not found".to_string()
            ))
        }
    }

    /// Check for expired services and mark them as unhealthy
    pub async fn check_expired_services(&self) -> KernelResult<Vec<String>> {
        let mut expired_services = Vec::new();
        let now = Utc::now();
        let timeout_duration = chrono::Duration::seconds(self.service_timeout as i64);

        let mut services = self.services.write().await;

        for (service_id, instance) in services.iter_mut() {
            if now.signed_duration_since(instance.metadata.last_heartbeat) > timeout_duration {
                if instance.metadata.status != ServiceStatus::Down {
                    instance.metadata.status = ServiceStatus::Unhealthy;
                    expired_services.push(service_id.clone());

                    // Publish status change event
                    let event = ServiceEvent::ServiceStatusChanged {
                        service_id: service_id.clone(),
                        old_status: ServiceStatus::Healthy,
                        new_status: ServiceStatus::Unhealthy,
                    };
                    self.publish_event(event).await;
                }
            }
        }

        Ok(expired_services)
    }

    /// Get all registered services
    pub async fn list_services(&self) -> Vec<ServiceMetadata> {
        let services = self.services.read().await;
        services.values().map(|i| i.metadata.clone()).collect()
    }

    /// Update service indexes
    async fn update_indexes(&self, metadata: &ServiceMetadata, add: bool) {
        let mut services_by_type = self.services_by_type.write().await;
        let mut services_by_capability = self.services_by_capability.write().await;
        let mut services_by_tag = self.services_by_tag.write().await;

        if add {
            // Add to type index
            services_by_type
                .entry(metadata.service_type)
                .or_insert_with(Vec::new)
                .push(metadata.id.clone());

            // Add to capability indexes
            for capability in &metadata.capabilities {
                services_by_capability
                    .entry(capability.clone())
                    .or_insert_with(Vec::new)
                    .push(metadata.id.clone());
            }

            // Add to tag indexes
            for tag in &metadata.tags {
                services_by_tag
                    .entry(tag.clone())
                    .or_insert_with(Vec::new)
                    .push(metadata.id.clone());
            }
        } else {
            // Remove from type index
            if let Some(services) = services_by_type.get_mut(&metadata.service_type) {
                services.retain(|id| id != &metadata.id);
            }

            // Remove from capability indexes
            for capability in &metadata.capabilities {
                if let Some(services) = services_by_capability.get_mut(capability) {
                    services.retain(|id| id != &metadata.id);
                }
            }

            // Remove from tag indexes
            for tag in &metadata.tags {
                if let Some(services) = services_by_tag.get_mut(tag) {
                    services.retain(|id| id != &metadata.id);
                }
            }
        }
    }

    /// Check if a service matches the query
    fn matches_query(&self, metadata: &ServiceMetadata, query: &ServiceQuery) -> bool {
        // Check name filter
        if let Some(ref name) = query.name {
            if !metadata.name.contains(name) {
                return false;
            }
        }

        // Check service type filter
        if let Some(service_type) = query.service_type {
            if metadata.service_type != service_type {
                return false;
            }
        }

        // Check capability filter
        if let Some(ref capability) = query.capability {
            if !metadata.capabilities.contains(capability) {
                return false;
            }
        }

        // Check tags filter
        if let Some(ref tags) = query.tags {
            if !tags.iter().all(|tag| metadata.tags.contains(tag)) {
                return false;
            }
        }

        // Check region filter
        if let Some(ref region) = query.region {
            if metadata.region.as_ref() != Some(region) {
                return false;
            }
        }

        // Check status filter
        if let Some(status) = query.status {
            if metadata.status != status {
                return false;
            }
        }

        // Check priority filter
        if let Some(min_priority) = query.min_priority {
            if metadata.priority < min_priority {
                return false;
            }
        }

        true
    }

    /// Publish a service event
    async fn publish_event(&self, event: ServiceEvent) {
        let message = Message {
            id: Uuid::new_v4().to_string(),
            topic: "service.events".to_string(),
            payload: serde_json::to_value(event).unwrap_or(serde_json::Value::Null),
            timestamp: Utc::now(),
            headers: HashMap::new(),
            priority: crate::message::MessagePriority::Normal,
            ttl: 0,
            sender: None,
            recipients: vec![],
        };

        if let Err(e) = self.message_bus.publish(message).await {
            tracing::warn!("Failed to publish service event: {}", e);
        }
    }
}

/// Service events for the message bus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceEvent {
    /// Service registered
    ServiceRegistered {
        service_id: String,
        metadata: ServiceMetadata,
    },
    /// Service unregistered
    ServiceUnregistered {
        service_id: String,
        metadata: ServiceMetadata,
    },
    /// Service heartbeat
    ServiceHeartbeat {
        service_id: String,
        timestamp: DateTime<Utc>,
    },
    /// Service status changed
    ServiceStatusChanged {
        service_id: String,
        old_status: ServiceStatus,
        new_status: ServiceStatus,
    },
}
