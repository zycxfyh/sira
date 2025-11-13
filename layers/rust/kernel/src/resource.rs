//! Resource management for the Sira microkernel
//!
//! This module provides resource allocation, monitoring, and scheduling
//! capabilities for the microkernel ecosystem.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::{DateTime, Utc};

use crate::error::{KernelError, KernelResult};

/// Resource types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ResourceType {
    /// CPU cores
    Cpu,
    /// Memory (in MB)
    Memory,
    /// Disk space (in GB)
    Disk,
    /// Network bandwidth (in Mbps)
    Network,
    /// GPU cores
    Gpu,
    /// Database connections
    DatabaseConnections,
    /// Custom resource type
    Custom,
}

impl std::fmt::Display for ResourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ResourceType::Cpu => write!(f, "CPU"),
            ResourceType::Memory => write!(f, "Memory"),
            ResourceType::Disk => write!(f, "Disk"),
            ResourceType::Network => write!(f, "Network"),
            ResourceType::Gpu => write!(f, "GPU"),
            ResourceType::DatabaseConnections => write!(f, "DatabaseConnections"),
            ResourceType::Custom => write!(f, "Custom"),
        }
    }
}

/// Resource allocation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAllocation {
    /// Allocation ID
    pub id: String,
    /// Resource owner (plugin/service ID)
    pub owner: String,
    /// Resource type
    pub resource_type: ResourceType,
    /// Amount allocated
    pub amount: u64,
    /// Allocation timestamp
    pub allocated_at: DateTime<Utc>,
    /// Allocation expiration (optional)
    pub expires_at: Option<DateTime<Utc>>,
    /// Allocation metadata
    pub metadata: HashMap<String, String>,
}

/// Resource request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceRequest {
    /// Requesting entity ID
    pub requester: String,
    /// Resource type
    pub resource_type: ResourceType,
    /// Amount requested
    pub amount: u64,
    /// Priority (higher = more important)
    pub priority: ResourcePriority,
    /// Timeout for allocation (in seconds)
    pub timeout: Option<u32>,
    /// Request metadata
    pub metadata: HashMap<String, String>,
}

/// Resource priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ResourcePriority {
    /// Low priority
    Low = 0,
    /// Normal priority
    Normal = 1,
    /// High priority
    High = 2,
    /// Critical priority
    Critical = 3,
}

impl Default for ResourcePriority {
    fn default() -> Self {
        ResourcePriority::Normal
    }
}

/// Resource limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    /// Maximum CPU cores
    pub max_cpu: u32,
    /// Maximum memory (in MB)
    pub max_memory: u64,
    /// Maximum disk space (in GB)
    pub max_disk: u64,
    /// Maximum network bandwidth (in Mbps)
    pub max_network: u32,
    /// Maximum GPU cores
    pub max_gpu: u32,
    /// Maximum database connections
    pub max_db_connections: u32,
}

/// Resource usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    /// Resource type
    pub resource_type: ResourceType,
    /// Total available
    pub total: u64,
    /// Currently used
    pub used: u64,
    /// Reserved (allocated but not used)
    pub reserved: u64,
    /// Usage percentage (0-100)
    pub usage_percentage: f64,
    /// Last updated
    pub last_updated: DateTime<Utc>,
}

/// Resource manager for allocation and monitoring
pub struct ResourceManager {
    /// Resource limits
    limits: ResourceLimits,
    /// Current allocations
    allocations: RwLock<HashMap<String, ResourceAllocation>>,
    /// Resource usage statistics
    usage: RwLock<HashMap<ResourceType, ResourceUsage>>,
    /// Allocation queue for pending requests
    allocation_queue: RwLock<Vec<ResourceRequest>>,
    /// Resource allocation strategies
    strategies: HashMap<ResourceType, Arc<dyn ResourceStrategy>>,
}

impl ResourceManager {
    /// Create a new resource manager
    pub fn new(limits: ResourceLimits) -> Self {
        let mut strategies = HashMap::new();

        // Register default strategies
        strategies.insert(ResourceType::Cpu, Arc::new(FairShareStrategy) as Arc<dyn ResourceStrategy>);
        strategies.insert(ResourceType::Memory, Arc::new(FairShareStrategy) as Arc<dyn ResourceStrategy>);
        strategies.insert(ResourceType::Disk, Arc::new(PriorityBasedStrategy) as Arc<dyn ResourceStrategy>);
        strategies.insert(ResourceType::Network, Arc::new(FairShareStrategy) as Arc<dyn ResourceStrategy>);
        strategies.insert(ResourceType::Gpu, Arc::new(PriorityBasedStrategy) as Arc<dyn ResourceStrategy>);
        strategies.insert(ResourceType::DatabaseConnections, Arc::new(PoolStrategy) as Arc<dyn ResourceStrategy>);

        ResourceManager {
            limits,
            allocations: RwLock::new(HashMap::new()),
            usage: RwLock::new(HashMap::new()),
            allocation_queue: RwLock::new(Vec::new()),
            strategies,
        }
    }

    /// Request resource allocation
    pub async fn request_resources(&self, request: ResourceRequest) -> KernelResult<String> {
        // Check if request exceeds limits
        self.validate_request(&request).await?;

        // Get allocation strategy
        let strategy = self.strategies.get(&request.resource_type)
            .ok_or_else(|| KernelError::resource_error(
                request.resource_type.to_string(),
                "No strategy available for resource type"
            ))?;

        // Try to allocate immediately
        match strategy.allocate(&request, self).await {
            Ok(allocation_id) => {
                tracing::info!(
                    "Resource allocated: {} {} for {}",
                    request.amount, self.resource_type_name(request.resource_type), request.requester
                );
                Ok(allocation_id)
            }
            Err(_) => {
                // Queue the request
                self.allocation_queue.write().await.push(request.clone());
                tracing::info!(
                    "Resource request queued: {} {} for {}",
                    request.amount, self.resource_type_name(request.resource_type), request.requester
                );
                Err(KernelError::resource_error(
                    request.resource_type.to_string(),
                    "Resources not available, request queued"
                ))
            }
        }
    }

    /// Release resource allocation
    pub async fn release_resources(&self, allocation_id: &str) -> KernelResult<()> {
        let mut allocations = self.allocations.write().await;

        if let Some(allocation) = allocations.remove(allocation_id) {
            // Update usage statistics
            self.update_usage(allocation.resource_type, -(allocation.amount as i64)).await;

            let resource_name = self.resource_type_name(allocation.resource_type);
            tracing::info!(
                "Resources released: {} {} from {}",
                allocation.amount, resource_name, allocation.owner
            );

            // Try to fulfill queued requests
            self.process_allocation_queue().await;

            Ok(())
        } else {
            Err(KernelError::resource_error(
                allocation_id.to_string(),
                "Allocation not found"
            ))
        }
    }

    /// Get resource usage statistics
    pub async fn get_resource_usage(&self, resource_type: ResourceType) -> KernelResult<ResourceUsage> {
        let usage = self.usage.read().await;

        if let Some(usage_stats) = usage.get(&resource_type) {
            Ok(usage_stats.clone())
        } else {
            Err(KernelError::resource_error(
                resource_type.to_string(),
                "Resource type not found"
            ))
        }
    }

    /// Get all resource usage statistics
    pub async fn get_all_resource_usage(&self) -> Vec<ResourceUsage> {
        let usage = self.usage.read().await;
        usage.values().cloned().collect()
    }

    /// Get allocations for a specific owner
    pub async fn get_allocations_for_owner(&self, owner: &str) -> Vec<ResourceAllocation> {
        let allocations = self.allocations.read().await;
        allocations.values()
            .filter(|alloc| alloc.owner == owner)
            .cloned()
            .collect()
    }

    /// Check if resources are available
    pub async fn check_availability(&self, resource_type: ResourceType, amount: u64) -> bool {
        let usage = self.usage.read().await;

        if let Some(usage_stats) = usage.get(&resource_type) {
            usage_stats.used + amount <= usage_stats.total
        } else {
            false
        }
    }

    /// Update resource usage statistics
    async fn update_usage(&self, resource_type: ResourceType, delta: i64) {
        let mut usage = self.usage.write().await;

        let usage_stats = usage.entry(resource_type).or_insert_with(|| {
            let total = self.get_total_capacity(resource_type);
            ResourceUsage {
                resource_type,
                total,
                used: 0,
                reserved: 0,
                usage_percentage: 0.0,
                last_updated: Utc::now(),
            }
        });

        usage_stats.used = (usage_stats.used as i64 + delta).max(0) as u64;
        usage_stats.usage_percentage = if usage_stats.total > 0 {
            (usage_stats.used as f64 / usage_stats.total as f64) * 100.0
        } else {
            0.0
        };
        usage_stats.last_updated = Utc::now();
    }

    /// Validate resource request
    async fn validate_request(&self, request: &ResourceRequest) -> KernelResult<()> {
        // Check amount is positive
        if request.amount == 0 {
            return Err(KernelError::resource_error(
                request.resource_type.to_string(),
                "Amount must be positive"
            ));
        }

        // Check against global limits
        let max_amount = self.get_max_capacity(request.resource_type);
        if request.amount > max_amount {
            return Err(KernelError::resource_error(
                request.resource_type.to_string(),
                format!("Amount {} exceeds maximum {}", request.amount, max_amount)
            ));
        }

        Ok(())
    }

    /// Process queued allocation requests
    async fn process_allocation_queue(&self) {
        let mut queue = self.allocation_queue.write().await;
        let mut fulfilled = Vec::new();

        for (index, request) in queue.iter().enumerate() {
            if let Some(strategy) = self.strategies.get(&request.resource_type) {
                if strategy.allocate(request, self).await.is_ok() {
                    fulfilled.push(index);
                    tracing::info!(
                        "Queued request fulfilled: {} {} for {}",
                        request.amount, self.resource_type_name(request.resource_type), request.requester
                    );
                }
            }
        }

        // Remove fulfilled requests (in reverse order to maintain indices)
        for index in fulfilled.into_iter().rev() {
            queue.remove(index);
        }
    }

    /// Allocate resources using a strategy
    async fn allocate_resource(&self, request: &ResourceRequest) -> KernelResult<String> {
        let allocation_id = Uuid::new_v4().to_string();

        let allocation = ResourceAllocation {
            id: allocation_id.clone(),
            owner: request.requester.clone(),
            resource_type: request.resource_type,
            amount: request.amount,
            allocated_at: Utc::now(),
            expires_at: request.timeout.map(|t| Utc::now() + chrono::Duration::seconds(t as i64)),
            metadata: request.metadata.clone(),
        };

        self.allocations.write().await.insert(allocation_id.clone(), allocation);
        self.update_usage(request.resource_type, request.amount as i64).await;

        Ok(allocation_id)
    }

    /// Get total capacity for a resource type
    fn get_total_capacity(&self, resource_type: ResourceType) -> u64 {
        match resource_type {
            ResourceType::Cpu => self.limits.max_cpu as u64,
            ResourceType::Memory => self.limits.max_memory,
            ResourceType::Disk => self.limits.max_disk,
            ResourceType::Network => self.limits.max_network as u64,
            ResourceType::Gpu => self.limits.max_gpu as u64,
            ResourceType::DatabaseConnections => self.limits.max_db_connections as u64,
            ResourceType::Custom => 0, // Custom resources need to be configured
        }
    }

    /// Get maximum capacity for a resource type
    fn get_max_capacity(&self, resource_type: ResourceType) -> u64 {
        self.get_total_capacity(resource_type)
    }

    /// Get resource type name for logging
    fn resource_type_name(&self, resource_type: ResourceType) -> &'static str {
        match resource_type {
            ResourceType::Cpu => "CPU cores",
            ResourceType::Memory => "MB memory",
            ResourceType::Disk => "GB disk",
            ResourceType::Network => "Mbps network",
            ResourceType::Gpu => "GPU cores",
            ResourceType::DatabaseConnections => "DB connections",
            ResourceType::Custom => "custom units",
        }
    }
}

/// Resource allocation strategy trait
#[async_trait]
pub trait ResourceStrategy: Send + Sync {
    /// Allocate resources using this strategy
    async fn allocate(&self, request: &ResourceRequest, manager: &ResourceManager) -> KernelResult<String>;
}

/// Fair share allocation strategy
pub struct FairShareStrategy;

#[async_trait]
impl ResourceStrategy for FairShareStrategy {
    async fn allocate(&self, request: &ResourceRequest, manager: &ResourceManager) -> KernelResult<String> {
        if manager.check_availability(request.resource_type, request.amount).await {
            manager.allocate_resource(request).await
        } else {
            Err(KernelError::resource_error(
                request.resource_type.to_string(),
                "Insufficient resources"
            ))
        }
    }
}

/// Priority-based allocation strategy
pub struct PriorityBasedStrategy;

#[async_trait]
impl ResourceStrategy for PriorityBasedStrategy {
    async fn allocate(&self, request: &ResourceRequest, manager: &ResourceManager) -> KernelResult<String> {
        // For high-priority requests, try to preempt lower-priority allocations
        if request.priority >= ResourcePriority::High {
            // TODO: Implement preemption logic
        }

        if manager.check_availability(request.resource_type, request.amount).await {
            manager.allocate_resource(request).await
        } else {
            Err(KernelError::resource_error(
                request.resource_type.to_string(),
                "Insufficient resources"
            ))
        }
    }
}

/// Pool-based allocation strategy (for connections, etc.)
pub struct PoolStrategy;

#[async_trait]
impl ResourceStrategy for PoolStrategy {
    async fn allocate(&self, request: &ResourceRequest, manager: &ResourceManager) -> KernelResult<String> {
        // Pool strategy maintains a minimum pool size and allows bursting
        const POOL_RESERVE_RATIO: f64 = 0.1; // Reserve 10% for pool

        let usage = manager.usage.read().await;
        if let Some(usage_stats) = usage.get(&request.resource_type) {
            let available_for_burst = usage_stats.total - (usage_stats.total as f64 * POOL_RESERVE_RATIO) as u64;
            if usage_stats.used + request.amount <= available_for_burst {
                return manager.allocate_resource(request).await;
            }
        }

        Err(KernelError::resource_error(
            request.resource_type.to_string(),
            "Pool limit exceeded"
        ))
    }
}

/// Helper macro for requesting resources
#[macro_export]
macro_rules! request_resource {
    ($manager:expr, $requester:expr, $resource_type:expr, $amount:expr) => {
        $manager.request_resources($crate::resource::ResourceRequest {
            requester: $requester.to_string(),
            resource_type: $resource_type,
            amount: $amount,
            priority: $crate::resource::ResourcePriority::Normal,
            timeout: None,
            metadata: std::collections::HashMap::new(),
        }).await
    };
}

/// Helper macro for releasing resources
#[macro_export]
macro_rules! release_resource {
    ($manager:expr, $allocation_id:expr) => {
        $manager.release_resources($allocation_id).await
    };
}
