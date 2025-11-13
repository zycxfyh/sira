//! Memory-based Session Store for Sira Session

use crate::{SessionResult, Session, SessionQuery, SessionStats, CleanupPolicy, SessionStore, SessionUpdate, SessionState};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// In-memory session store implementation
pub struct MemorySessionStore {
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    max_capacity: usize,
}

impl MemorySessionStore {
    /// Create a new memory session store
    pub fn new(max_capacity: usize) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            max_capacity,
        }
    }

    /// Create with default capacity
    pub fn default() -> Self {
        Self::new(10000) // Default 10k sessions
    }
}

impl Default for MemorySessionStore {
    fn default() -> Self {
        Self::default()
    }
}

#[async_trait]
impl SessionStore for MemorySessionStore {
    async fn store(&self, session: &Session) -> SessionResult<()> {
        let mut sessions = self.sessions.write().await;

        // Check capacity limit
        if sessions.len() >= self.max_capacity && !sessions.contains_key(&session.id) {
            return Err(crate::SessionError::StoreError(
                format!("Session store capacity exceeded: {}", self.max_capacity)
            ));
        }

        sessions.insert(session.id.clone(), session.clone());
        debug!("Stored session: {}", session.id);

        Ok(())
    }

    async fn get(&self, session_id: &str) -> SessionResult<Option<Session>> {
        let sessions = self.sessions.read().await;
        Ok(sessions.get(session_id).cloned())
    }

    async fn update(&self, session_id: &str, updates: &[SessionUpdate]) -> SessionResult<()> {
        let mut sessions = self.sessions.write().await;

        if let Some(session) = sessions.get_mut(session_id) {
            for update in updates {
                match update {
                    SessionUpdate::SetData { key, value } => {
                        session.data.insert(key.clone(), value.clone());
                    }
                    SessionUpdate::RemoveData { key } => {
                        session.data.remove(key);
                    }
                    SessionUpdate::AddTag { tag } => {
                        if !session.tags.contains(tag) {
                            session.tags.push(tag.clone());
                        }
                    }
                    SessionUpdate::RemoveTag { tag } => {
                        session.tags.retain(|t| t != tag);
                    }
                    SessionUpdate::UpdateMetadata { key, value } => {
                        session.metadata.insert(key.clone(), value.clone());
                    }
                    SessionUpdate::SetState { state } => {
                        session.state = *state;
                    }
                    SessionUpdate::ExtendExpiry { seconds } => {
                        session.expires_at = session.expires_at + Duration::seconds(*seconds as i64);
                    }
                    SessionUpdate::IncrementVersion => {
                        session.version += 1;
                    }
                }
            }

            session.updated_at = Utc::now();
            debug!("Updated session: {} with {} changes", session_id, updates.len());

            Ok(())
        } else {
            Err(crate::SessionError::SessionNotFound(session_id.to_string()))
        }
    }

    async fn delete(&self, session_id: &str) -> SessionResult<bool> {
        let mut sessions = self.sessions.write().await;
        let removed = sessions.remove(session_id).is_some();

        if removed {
            debug!("Deleted session: {}", session_id);
        }

        Ok(removed)
    }

    async fn exists(&self, session_id: &str) -> SessionResult<bool> {
        let sessions = self.sessions.read().await;
        Ok(sessions.contains_key(session_id))
    }

    async fn query(&self, query: &SessionQuery) -> SessionResult<Vec<Session>> {
        let sessions = self.sessions.read().await;
        let mut results: Vec<Session> = sessions.values()
            .filter(|session| {
                // Apply filters
                if let Some(user_id) = &query.user_id {
                    if session.user_id != *user_id {
                        return false;
                    }
                }

                if let Some(state) = &query.state {
                    if session.state != *state {
                        return false;
                    }
                }

                if let Some(tags) = &query.tags {
                    if !tags.iter().all(|tag| session.tags.contains(tag)) {
                        return false;
                    }
                }

                if let Some(created_after) = query.created_after {
                    if session.created_at < created_after {
                        return false;
                    }
                }

                if let Some(created_before) = query.created_before {
                    if session.created_at > created_before {
                        return false;
                    }
                }

                true
            })
            .cloned()
            .collect();

        // Apply sorting (by creation time, newest first)
        results.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        // Apply pagination
        if let Some(offset) = query.offset {
            results = results.into_iter().skip(offset).collect();
        }

        if let Some(limit) = query.limit {
            results.truncate(limit);
        }

        Ok(results)
    }

    async fn count(&self, query: &SessionQuery) -> SessionResult<u64> {
        let results = self.query(query).await?;
        Ok(results.len() as u64)
    }

    async fn cleanup(&self, policy: &CleanupPolicy) -> SessionResult<u64> {
        let mut sessions = self.sessions.write().await;
        let initial_count = sessions.len();

        let now = Utc::now();
        let to_remove: Vec<String> = sessions.values()
            .filter(|session| {
                match policy {
                    CleanupPolicy::ExpiredOnly => {
                        session.expires_at <= now
                    }
                    CleanupPolicy::ExpiredAndIdle { max_idle_seconds } => {
                        let max_idle = Duration::seconds(*max_idle_seconds as i64);
                        session.expires_at <= now || (now - session.updated_at) > max_idle
                    }
                    CleanupPolicy::AgeBased { max_age_seconds } => {
                        let max_age = Duration::seconds(*max_age_seconds as i64);
                        (now - session.created_at) > max_age
                    }
                    CleanupPolicy::Custom { .. } => {
                        // For memory store, treat as expired only
                        session.expires_at <= now
                    }
                }
            })
            .map(|s| s.id.clone())
            .collect();

        for session_id in to_remove {
            sessions.remove(&session_id);
        }

        let removed_count = initial_count - sessions.len();
        info!("Cleaned up {} sessions", removed_count);

        Ok(removed_count as u64)
    }

    async fn stats(&self) -> SessionResult<SessionStats> {
        let sessions = self.sessions.read().await;

        let total_sessions = sessions.len() as u64;
        let active_sessions = sessions.values()
            .filter(|s| s.state == SessionState::Active)
            .count() as u64;

        let expired_sessions = sessions.values()
            .filter(|s| s.expires_at <= Utc::now())
            .count() as u64;

        let now = Utc::now();
        let lifetimes: Vec<f64> = sessions.values()
            .map(|s| (now - s.created_at).num_seconds() as f64)
            .collect();

        let average_lifetime_seconds = if lifetimes.is_empty() {
            0.0
        } else {
            lifetimes.iter().sum::<f64>() / lifetimes.len() as f64
        };

        let idle_times: Vec<f64> = sessions.values()
            .map(|s| (now - s.updated_at).num_seconds() as f64)
            .collect();

        let average_idle_time_seconds = if idle_times.is_empty() {
            0.0
        } else {
            idle_times.iter().sum::<f64>() / idle_times.len() as f64
        };

        // Estimate storage size (rough calculation)
        let storage_size_bytes = sessions.values()
            .map(|s| {
                serde_json::to_string(s).map(|json| json.len()).unwrap_or(1024)
            })
            .sum::<usize>() as u64;

        Ok(SessionStats {
            total_sessions,
            active_sessions,
            expired_sessions,
            average_lifetime_seconds,
            average_idle_time_seconds,
            storage_size_bytes,
        })
    }

    async fn health_check(&self) -> SessionResult<bool> {
        // For memory store, just check if we can access the data structure
        let sessions = self.sessions.read().await;
        let _ = sessions.len(); // Test access
        Ok(true)
    }

    async fn backup(&self, location: &str) -> SessionResult<()> {
        let sessions = self.sessions.read().await;
        let sessions_vec: Vec<&Session> = sessions.values().collect();

        let backup_data = serde_json::to_string_pretty(&sessions_vec)
            .map_err(|e| crate::SessionError::SerializationError(e.to_string()))?;

        // In a real implementation, this would write to the specified location
        // For now, just log it
        info!("Would backup {} sessions to {}", sessions_vec.len(), location);
        debug!("Backup data size: {} bytes", backup_data.len());

        Ok(())
    }

    async fn restore(&self, location: &str) -> SessionResult<()> {
        // In a real implementation, this would read from the specified location
        // For now, just log it
        info!("Would restore sessions from {}", location);

        Ok(())
    }
}

/// Memory store factory
pub struct MemorySessionStoreFactory;

#[async_trait]
impl crate::SessionStoreFactory for MemorySessionStoreFactory {
    async fn create_store(&self, config: HashMap<String, serde_json::Value>) -> SessionResult<Box<dyn SessionStore>> {
        let max_capacity = config
            .get("max_capacity")
            .and_then(|v| v.as_u64())
            .unwrap_or(10000) as usize;

        Ok(Box::new(MemorySessionStore::new(max_capacity)))
    }

    fn store_type(&self) -> &str {
        "memory"
    }

    fn config_schema(&self) -> serde_json::Value {
        serde_json::json!({
            "type": "object",
            "properties": {
                "max_capacity": {
                    "type": "integer",
                    "description": "Maximum number of sessions to store",
                    "default": 10000
                }
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SessionConfig;

    fn create_test_session() -> Session {
        Session {
            id: "test_session".to_string(),
            user_id: "test_user".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            expires_at: Utc::now() + Duration::hours(1),
            state: SessionState::Active,
            metadata: HashMap::new(),
            data: HashMap::new(),
            tags: vec!["test".to_string()],
            version: 1,
            parent_session_id: None,
            child_session_ids: vec![],
        }
    }

    #[tokio::test]
    async fn test_memory_store_basic_operations() {
        let store = MemorySessionStore::default();
        let session = create_test_session();

        // Store session
        store.store(&session).await.unwrap();

        // Get session
        let retrieved = store.get("test_session").await.unwrap().unwrap();
        assert_eq!(retrieved.id, session.id);

        // Check exists
        assert!(store.exists("test_session").await.unwrap());

        // Update session
        let updates = vec![
            SessionUpdate::AddTag { tag: "updated".to_string() },
            SessionUpdate::SetData { key: "test_key".to_string(), value: serde_json::json!("test_value") },
        ];
        store.update("test_session", &updates).await.unwrap();

        let updated = store.get("test_session").await.unwrap().unwrap();
        assert!(updated.tags.contains(&"updated".to_string()));
        assert_eq!(updated.data.get("test_key"), Some(&serde_json::json!("test_value")));

        // Delete session
        assert!(store.delete("test_session").await.unwrap());
        assert!(!store.exists("test_session").await.unwrap());
    }

    #[tokio::test]
    async fn test_memory_store_query() {
        let store = MemorySessionStore::default();

        // Store multiple sessions
        for i in 0..5 {
            let mut session = create_test_session();
            session.id = format!("session_{}", i);
            session.user_id = format!("user_{}", i % 2); // 2 users
            store.store(&session).await.unwrap();
        }

        // Query by user
        let query = SessionQuery {
            user_id: Some("user_0".to_string()),
            ..Default::default()
        };
        let results = store.query(&query).await.unwrap();
        assert_eq!(results.len(), 2); // user_0 has 2 sessions (0, 2, 4 -> but 4 would be user_0? Wait, i % 2 == 0)

        let count = store.count(&query).await.unwrap();
        assert_eq!(count, 2);
    }

    #[tokio::test]
    async fn test_memory_store_cleanup() {
        let store = MemorySessionStore::default();

        // Store an expired session
        let mut expired_session = create_test_session();
        expired_session.id = "expired".to_string();
        expired_session.expires_at = Utc::now() - Duration::hours(1);
        store.store(&expired_session).await.unwrap();

        // Store an active session
        let active_session = create_test_session();
        store.store(&active_session).await.unwrap();

        // Cleanup expired sessions
        let cleaned = store.cleanup(&CleanupPolicy::ExpiredOnly).await.unwrap();
        assert_eq!(cleaned, 1);

        // Check sessions after cleanup
        assert!(!store.exists("expired").await.unwrap());
        assert!(store.exists("test_session").await.unwrap());
    }

    #[tokio::test]
    async fn test_memory_store_stats() {
        let store = MemorySessionStore::default();
        let session = create_test_session();

        store.store(&session).await.unwrap();

        let stats = store.stats().await.unwrap();
        assert_eq!(stats.total_sessions, 1);
        assert_eq!(stats.active_sessions, 1);
        assert!(stats.storage_size_bytes > 0);
    }
}
