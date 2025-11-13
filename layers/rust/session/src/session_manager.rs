//! Session Manager for Sira Session

use crate::{SessionResult, Session, SessionConfig, SessionState, SessionUpdate, SessionQuery, SessionEvent, SessionEventHandler, SessionLifecycleHook, ValidationRules, CleanupPolicy};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time;
use tracing::{info, debug, warn, error};
use uuid::Uuid;

/// Session manager - central component for session lifecycle management
pub struct SessionManager {
    config: SessionConfig,
    store: Box<dyn crate::SessionStore>,
    event_handlers: Vec<Box<dyn SessionEventHandler>>,
    lifecycle_hooks: Vec<Box<dyn SessionLifecycleHook>>,
    validation_rules: ValidationRules,
    active_cleanup_task: Option<tokio::task::JoinHandle<()>>,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new(
        config: SessionConfig,
        store: Box<dyn crate::SessionStore>,
    ) -> Self {
        Self {
            config,
            store,
            event_handlers: Vec::new(),
            lifecycle_hooks: Vec::new(),
            validation_rules: ValidationRules::default(),
            active_cleanup_task: None,
        }
    }

    /// Start the session manager
    pub async fn start(&mut self) -> SessionResult<()> {
        info!("Starting session manager");

        // Start cleanup task if enabled
        if self.config.enable_auto_cleanup {
            self.start_cleanup_task();
        }

        Ok(())
    }

    /// Stop the session manager
    pub async fn stop(&mut self) -> SessionResult<()> {
        info!("Stopping session manager");

        // Stop cleanup task
        if let Some(task) = self.active_cleanup_task.take() {
            task.abort();
        }

        Ok(())
    }

    /// Create a new session
    pub async fn create_session(&self, user_id: String, metadata: HashMap<String, serde_json::Value>) -> SessionResult<String> {
        // Check user session limit
        let existing_sessions = self.query_sessions(SessionQuery {
            user_id: Some(user_id.clone()),
            state: Some(SessionState::Active),
            ..Default::default()
        }).await?;

        if existing_sessions.len() >= self.config.max_sessions_per_user {
            return Err(crate::SessionError::ValidationError(
                format!("Maximum sessions per user exceeded: {}", self.config.max_sessions_per_user)
            ));
        }

        let session_id = format!("sess_{}", Uuid::new_v4().simple());
        let now = Utc::now();

        let session = Session {
            id: session_id.clone(),
            user_id,
            created_at: now,
            updated_at: now,
            expires_at: now + Duration::seconds(self.config.max_lifetime_seconds as i64),
            state: SessionState::Active,
            metadata,
            data: HashMap::new(),
            tags: vec![],
            version: 1,
            parent_session_id: None,
            child_session_ids: vec![],
        };

        // Validate session
        self.validate_session(&session).await?;

        // Run lifecycle hooks
        for hook in &self.lifecycle_hooks {
            hook.on_create(&session).await?;
        }

        // Store session
        self.store.store(&session).await?;

        // Emit event
        self.emit_event(SessionEvent::Created {
            session_id: session_id.clone(),
            user_id: session.user_id.clone(),
        }).await;

        info!("Created session: {} for user: {}", session_id, session.user_id);

        Ok(session_id)
    }

    /// Get a session by ID
    pub async fn get_session(&self, session_id: &str) -> SessionResult<Option<Session>> {
        match self.store.get(session_id).await? {
            Some(session) => {
                // Check if session is expired
                if session.expires_at <= Utc::now() {
                    // Mark as expired (avoid recursion by directly updating store)
                    let _ = self.store.update(session_id, &[SessionUpdate::SetState {
                        state: SessionState::Expired
                    }]).await;

                    self.emit_event(SessionEvent::Expired {
                        session_id: session_id.to_string(),
                    }).await;

                    return Ok(None);
                }

                Ok(Some(session))
            }
            None => Ok(None),
        }
    }

    /// Update a session
    pub async fn update_session(&self, session_id: &str, updates: &[SessionUpdate]) -> SessionResult<()> {
        // Get current session
        let current_session = self.get_session(session_id).await?
            .ok_or_else(|| crate::SessionError::SessionNotFound(session_id.to_string()))?;

        // Validate updates
        self.validate_updates(&current_session, updates).await?;

        // Apply updates
        self.store.update(session_id, updates).await?;

        // Run lifecycle hooks
        let updated_session = self.get_session(session_id).await?.unwrap();
        for hook in &self.lifecycle_hooks {
            hook.on_update(&updated_session, updates).await?;
        }

        // Emit event
        let changes = updates.iter().map(|u| format!("{:?}", u)).collect();
        self.emit_event(SessionEvent::Updated {
            session_id: session_id.to_string(),
            changes,
        }).await;

        debug!("Updated session: {} with {} changes", session_id, updates.len());

        Ok(())
    }

    /// Delete a session
    pub async fn delete_session(&self, session_id: &str) -> SessionResult<bool> {
        let session = self.get_session(session_id).await?;

        let deleted = self.store.delete(session_id).await?;

        if deleted {
            // Run lifecycle hooks
            if let Some(session) = session {
                for hook in &self.lifecycle_hooks {
                    hook.on_terminate(&session).await?;
                }
            }

            self.emit_event(SessionEvent::Terminated {
                session_id: session_id.to_string(),
                reason: "Deleted by user".to_string(),
            }).await;

            info!("Deleted session: {}", session_id);
        }

        Ok(deleted)
    }

    /// Query sessions
    pub async fn query_sessions(&self, query: SessionQuery) -> SessionResult<Vec<Session>> {
        self.store.query(&query).await
    }

    /// Extend session expiry
    pub async fn extend_session(&self, session_id: &str, seconds: u64) -> SessionResult<()> {
        self.update_session(session_id, &[SessionUpdate::ExtendExpiry { seconds }]).await?;
        debug!("Extended session {} by {} seconds", session_id, seconds);
        Ok(())
    }

    /// Touch session (update last activity)
    pub async fn touch_session(&self, session_id: &str) -> SessionResult<()> {
        // This is a no-op for now since we don't track last activity separately
        // In a real implementation, this would update a last_activity field
        debug!("Touched session: {}", session_id);
        Ok(())
    }

    /// Terminate session with reason
    pub async fn terminate_session(&self, session_id: &str, reason: String) -> SessionResult<()> {
        let session = self.get_session(session_id).await?
            .ok_or_else(|| crate::SessionError::SessionNotFound(session_id.to_string()))?;

        // Update state
        self.update_session(session_id, &[SessionUpdate::SetState {
            state: SessionState::Terminated
        }]).await?;

        // Run lifecycle hooks
        for hook in &self.lifecycle_hooks {
            hook.on_terminate(&session).await?;
        }

        self.emit_event(SessionEvent::Terminated {
            session_id: session_id.to_string(),
            reason,
        }).await;

        info!("Terminated session: {}", session_id);

        Ok(())
    }

    /// Get session statistics
    pub async fn get_stats(&self) -> SessionResult<crate::SessionStats> {
        self.store.stats().await
    }

    /// Add event handler
    pub fn add_event_handler(&mut self, handler: Box<dyn SessionEventHandler>) {
        self.event_handlers.push(handler);
    }

    /// Add lifecycle hook
    pub fn add_lifecycle_hook(&mut self, hook: Box<dyn SessionLifecycleHook>) {
        self.lifecycle_hooks.push(hook);
    }

    /// Set validation rules
    pub fn set_validation_rules(&mut self, rules: ValidationRules) {
        self.validation_rules = rules;
    }

    /// Health check
    pub async fn health_check(&self) -> SessionResult<bool> {
        self.store.health_check().await
    }

    /// Validate session data
    async fn validate_session(&self, session: &Session) -> SessionResult<()> {
        // Check required fields
        for field in &self.validation_rules.required_fields {
            if !session.metadata.contains_key(field) && !session.data.contains_key(field) {
                return Err(crate::SessionError::ValidationError(
                    format!("Required field missing: {}", field)
                ));
            }
        }

        // Check forbidden fields
        for field in &self.validation_rules.forbidden_fields {
            if session.metadata.contains_key(field) || session.data.contains_key(field) {
                return Err(crate::SessionError::ValidationError(
                    format!("Forbidden field present: {}", field)
                ));
            }
        }

        // Check data size
        let metadata_size = serde_json::to_string(&session.metadata)
            .map_err(|e| crate::SessionError::SerializationError(e.to_string()))?
            .len();

        if metadata_size > self.validation_rules.max_metadata_size_bytes {
            return Err(crate::SessionError::ValidationError(
                format!("Metadata size exceeds limit: {} > {}", metadata_size, self.validation_rules.max_metadata_size_bytes)
            ));
        }

        let data_size = serde_json::to_string(&session.data)
            .map_err(|e| crate::SessionError::SerializationError(e.to_string()))?
            .len();

        if data_size > self.validation_rules.max_data_size_bytes {
            return Err(crate::SessionError::ValidationError(
                format!("Data size exceeds limit: {} > {}", data_size, self.validation_rules.max_data_size_bytes)
            ));
        }

        // Check tags
        if session.tags.len() > self.validation_rules.max_tags {
            return Err(crate::SessionError::ValidationError(
                format!("Too many tags: {} > {}", session.tags.len(), self.validation_rules.max_tags)
            ));
        }

        Ok(())
    }

    /// Validate updates
    async fn validate_updates(&self, session: &Session, updates: &[SessionUpdate]) -> SessionResult<()> {
        let mut updated_session = session.clone();

        // Apply updates to a copy for validation
        for update in updates {
            match update {
                SessionUpdate::AddTag { tag } => {
                    if updated_session.tags.len() >= self.validation_rules.max_tags {
                        return Err(crate::SessionError::ValidationError(
                            format!("Maximum tags exceeded: {}", self.validation_rules.max_tags)
                        ));
                    }
                    if !updated_session.tags.contains(tag) {
                        updated_session.tags.push(tag.clone());
                    }
                }
                SessionUpdate::SetData { key, value } => {
                    updated_session.data.insert(key.clone(), value.clone());
                }
                _ => {} // Other updates are generally safe
            }
        }

        // Validate the updated session
        self.validate_session(&updated_session).await
    }

    /// Emit event to all handlers
    async fn emit_event(&self, event: SessionEvent) {
        for handler in &self.event_handlers {
            if let Err(e) = handler.handle_event(&event).await {
                error!("Event handler error: {:?}", e);
            }
        }
    }

    /// Start automatic cleanup task
    fn start_cleanup_task(&mut self) {
        let store = unsafe { std::ptr::read(&self.store) }; // This is safe because we don't move self
        let cleanup_interval = self.config.cleanup_interval_seconds;

        let task = tokio::spawn(async move {
            let mut interval = time::interval(time::Duration::from_secs(cleanup_interval));

            loop {
                interval.tick().await;

                match store.cleanup(&CleanupPolicy::ExpiredOnly).await {
                    Ok(cleaned) => {
                        if cleaned > 0 {
                            info!("Auto-cleanup removed {} expired sessions", cleaned);
                        }
                    }
                    Err(e) => {
                        error!("Auto-cleanup error: {:?}", e);
                    }
                }
            }
        });

        self.active_cleanup_task = Some(task);
        info!("Started automatic cleanup task (interval: {}s)", cleanup_interval);
    }
}

impl Drop for SessionManager {
    fn drop(&mut self) {
        // Stop cleanup task when dropped
        if let Some(task) = self.active_cleanup_task.take() {
            task.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory_store::MemorySessionStore;

    fn create_test_config() -> SessionConfig {
        SessionConfig {
            max_idle_time_seconds: 3600,
            max_lifetime_seconds: 7200,
            cleanup_interval_seconds: 300,
            enable_auto_cleanup: false,
            max_sessions_per_user: 5,
            enable_compression: false,
            enable_encryption: false,
        }
    }

    #[tokio::test]
    async fn test_session_manager_create_and_get() {
        let config = create_test_config();
        let store = Box::new(MemorySessionStore::default());
        let manager = SessionManager::new(config, store);

        // Create session
        let session_id = manager.create_session(
            "test_user".to_string(),
            HashMap::from([("test".to_string(), serde_json::json!("value"))])
        ).await.unwrap();

        // Get session
        let session = manager.get_session(&session_id).await.unwrap().unwrap();
        assert_eq!(session.user_id, "test_user");
        assert_eq!(session.state, SessionState::Active);

        // Update session
        manager.update_session(&session_id, &[SessionUpdate::AddTag {
            tag: "updated".to_string()
        }]).await.unwrap();

        let updated = manager.get_session(&session_id).await.unwrap().unwrap();
        assert!(updated.tags.contains(&"updated".to_string()));

        // Delete session
        assert!(manager.delete_session(&session_id).await.unwrap());
        assert!(manager.get_session(&session_id).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn test_session_validation() {
        let config = create_test_config();
        let store = Box::new(MemorySessionStore::default());
        let mut manager = SessionManager::new(config, store);

        // Set validation rules
        let mut rules = ValidationRules::default();
        rules.required_fields = vec!["required_field".to_string()];
        manager.set_validation_rules(rules);

        // Try to create session without required field
        let result = manager.create_session(
            "test_user".to_string(),
            HashMap::new() // Missing required field
        ).await;

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), crate::SessionError::ValidationError(_)));
    }

    #[tokio::test]
    async fn test_session_limits() {
        let mut config = create_test_config();
        config.max_sessions_per_user = 2;
        let store = Box::new(MemorySessionStore::default());
        let manager = SessionManager::new(config, store);

        // Create maximum allowed sessions
        manager.create_session("test_user".to_string(), HashMap::new()).await.unwrap();
        manager.create_session("test_user".to_string(), HashMap::new()).await.unwrap();

        // Try to create one more (should fail)
        let result = manager.create_session("test_user".to_string(), HashMap::new()).await;
        assert!(result.is_err());
    }
}
