//! Session Store Interface for Sira Session

use crate::{SessionResult, Session, SessionQuery, SessionStats, CleanupPolicy};
use async_trait::async_trait;
use std::collections::HashMap;

/// Session store trait - defines the interface for session storage backends
#[async_trait]
pub trait SessionStore: Send + Sync {
    /// Store a session
    async fn store(&self, session: &Session) -> SessionResult<()>;

    /// Retrieve a session by ID
    async fn get(&self, session_id: &str) -> SessionResult<Option<Session>>;

    /// Update a session
    async fn update(&self, session_id: &str, updates: &[crate::SessionUpdate]) -> SessionResult<()>;

    /// Delete a session
    async fn delete(&self, session_id: &str) -> SessionResult<bool>;

    /// Check if a session exists
    async fn exists(&self, session_id: &str) -> SessionResult<bool>;

    /// Query sessions with filters
    async fn query(&self, query: &SessionQuery) -> SessionResult<Vec<Session>>;

    /// Count sessions matching query
    async fn count(&self, query: &SessionQuery) -> SessionResult<u64>;

    /// Clean up expired or old sessions
    async fn cleanup(&self, policy: &CleanupPolicy) -> SessionResult<u64>;

    /// Get store statistics
    async fn stats(&self) -> SessionResult<SessionStats>;

    /// Health check for the store
    async fn health_check(&self) -> SessionResult<bool>;

    /// Backup sessions
    async fn backup(&self, location: &str) -> SessionResult<()>;

    /// Restore sessions from backup
    async fn restore(&self, location: &str) -> SessionResult<()>;
}

/// Session store factory trait
#[async_trait]
pub trait SessionStoreFactory: Send + Sync {
    /// Create a new session store instance
    async fn create_store(&self, config: HashMap<String, serde_json::Value>) -> SessionResult<Box<dyn SessionStore>>;

    /// Get the store type name
    fn store_type(&self) -> &str;

    /// Get the supported configuration schema
    fn config_schema(&self) -> serde_json::Value;
}

/// Composite session store that combines multiple backends
pub struct CompositeSessionStore {
    primary: Box<dyn SessionStore>,
    replicas: Vec<Box<dyn SessionStore>>,
    write_to_replicas: bool,
}

impl CompositeSessionStore {
    /// Create a new composite store
    pub fn new(primary: Box<dyn SessionStore>) -> Self {
        Self {
            primary,
            replicas: Vec::new(),
            write_to_replicas: false,
        }
    }

    /// Add a replica store
    pub fn add_replica(&mut self, replica: Box<dyn SessionStore>) {
        self.replicas.push(replica);
    }

    /// Enable/disable writing to replicas
    pub fn set_write_to_replicas(&mut self, enabled: bool) {
        self.write_to_replicas = enabled;
    }
}

#[async_trait]
impl SessionStore for CompositeSessionStore {
    async fn store(&self, session: &Session) -> SessionResult<()> {
        // Store in primary
        self.primary.store(session).await?;

        // Store in replicas if enabled
        if self.write_to_replicas {
            for replica in &self.replicas {
                if let Err(e) = replica.store(session).await {
                    tracing::warn!("Failed to store session in replica: {:?}", e);
                }
            }
        }

        Ok(())
    }

    async fn get(&self, session_id: &str) -> SessionResult<Option<Session>> {
        // Try primary first
        match self.primary.get(session_id).await {
            Ok(Some(session)) => Ok(Some(session)),
            Ok(None) => {
                // Try replicas
                for replica in &self.replicas {
                    if let Ok(Some(session)) = replica.get(session_id).await {
                        return Ok(Some(session));
                    }
                }
                Ok(None)
            }
            Err(e) => Err(e),
        }
    }

    async fn update(&self, session_id: &str, updates: &[crate::SessionUpdate]) -> SessionResult<()> {
        // Update primary
        self.primary.update(session_id, updates).await?;

        // Update replicas if enabled
        if self.write_to_replicas {
            for replica in &self.replicas {
                if let Err(e) = replica.update(session_id, updates).await {
                    tracing::warn!("Failed to update session in replica: {:?}", e);
                }
            }
        }

        Ok(())
    }

    async fn delete(&self, session_id: &str) -> SessionResult<bool> {
        // Delete from primary
        let result = self.primary.delete(session_id).await?;

        // Delete from replicas
        for replica in &self.replicas {
            if let Err(e) = replica.delete(session_id).await {
                tracing::warn!("Failed to delete session from replica: {:?}", e);
            }
        }

        Ok(result)
    }

    async fn exists(&self, session_id: &str) -> SessionResult<bool> {
        // Check primary first
        match self.primary.exists(session_id).await {
            Ok(true) => Ok(true),
            Ok(false) => {
                // Check replicas
                for replica in &self.replicas {
                    if let Ok(true) = replica.exists(session_id).await {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            Err(e) => Err(e),
        }
    }

    async fn query(&self, query: &SessionQuery) -> SessionResult<Vec<Session>> {
        // Query primary (could be enhanced to query replicas too)
        self.primary.query(query).await
    }

    async fn count(&self, query: &SessionQuery) -> SessionResult<u64> {
        self.primary.count(query).await
    }

    async fn cleanup(&self, policy: &CleanupPolicy) -> SessionResult<u64> {
        // Cleanup primary
        let primary_cleaned = self.primary.cleanup(policy).await?;

        // Cleanup replicas
        let mut total_cleaned = primary_cleaned;
        for replica in &self.replicas {
            match replica.cleanup(policy).await {
                Ok(cleaned) => total_cleaned += cleaned,
                Err(e) => tracing::warn!("Failed to cleanup replica: {:?}", e),
            }
        }

        Ok(total_cleaned)
    }

    async fn stats(&self) -> SessionResult<SessionStats> {
        self.primary.stats().await
    }

    async fn health_check(&self) -> SessionResult<bool> {
        // Check primary health
        let primary_healthy = self.primary.health_check().await.unwrap_or(false);

        // Check replica health (but don't fail if replicas are down)
        let mut all_replicas_healthy = true;
        for replica in &self.replicas {
            if !replica.health_check().await.unwrap_or(false) {
                all_replicas_healthy = false;
            }
        }

        Ok(primary_healthy && all_replicas_healthy)
    }

    async fn backup(&self, location: &str) -> SessionResult<()> {
        self.primary.backup(location).await
    }

    async fn restore(&self, location: &str) -> SessionResult<()> {
        self.primary.restore(location).await
    }
}
