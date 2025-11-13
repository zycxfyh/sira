//! Common types for Sira Session

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use async_trait::async_trait;

/// Result type alias for session operations
pub type SessionResult<T> = Result<T, crate::SessionError>;

/// Session state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SessionState {
    Active,
    Paused,
    Completed,
    Expired,
    Terminated,
}

/// Session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub max_idle_time_seconds: u64,
    pub max_lifetime_seconds: u64,
    pub cleanup_interval_seconds: u64,
    pub enable_auto_cleanup: bool,
    pub max_sessions_per_user: usize,
    pub enable_compression: bool,
    pub enable_encryption: bool,
}

/// Session data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub user_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub state: SessionState,
    pub metadata: HashMap<String, serde_json::Value>,
    pub data: HashMap<String, serde_json::Value>,
    pub tags: Vec<String>,
    pub version: u64,
    pub parent_session_id: Option<String>,
    pub child_session_ids: Vec<String>,
}

/// Session statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStats {
    pub total_sessions: u64,
    pub active_sessions: u64,
    pub expired_sessions: u64,
    pub average_lifetime_seconds: f64,
    pub average_idle_time_seconds: f64,
    pub storage_size_bytes: u64,
}

/// Session event types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionEvent {
    Created {
        session_id: String,
        user_id: String,
    },
    Updated {
        session_id: String,
        changes: Vec<String>,
    },
    Expired {
        session_id: String,
    },
    Terminated {
        session_id: String,
        reason: String,
    },
    Restored {
        session_id: String,
    },
    Cleaned {
        session_ids: Vec<String>,
        reason: String,
    },
}

/// Session event handler trait
#[async_trait::async_trait]
pub trait SessionEventHandler: Send + Sync {
    async fn handle_event(&self, event: &SessionEvent) -> SessionResult<()>;
}

/// Session cleanup policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CleanupPolicy {
    /// Clean expired sessions only
    ExpiredOnly,
    /// Clean expired and idle sessions
    ExpiredAndIdle { max_idle_seconds: u64 },
    /// Clean sessions older than specified age
    AgeBased { max_age_seconds: u64 },
    /// Clean sessions based on custom criteria
    Custom { criteria: HashMap<String, serde_json::Value> },
}

/// Session query parameters
#[derive(Debug, Clone, Default)]
pub struct SessionQuery {
    pub user_id: Option<String>,
    pub state: Option<SessionState>,
    pub tags: Option<Vec<String>>,
    pub created_after: Option<DateTime<Utc>>,
    pub created_before: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// Session update operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionUpdate {
    SetData { key: String, value: serde_json::Value },
    RemoveData { key: String },
    AddTag { tag: String },
    RemoveTag { tag: String },
    UpdateMetadata { key: String, value: serde_json::Value },
    SetState { state: SessionState },
    ExtendExpiry { seconds: u64 },
    IncrementVersion,
}

/// Session validation rules
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRules {
    pub max_data_size_bytes: usize,
    pub max_metadata_size_bytes: usize,
    pub max_tags: usize,
    pub allowed_tag_patterns: Vec<String>,
    pub required_fields: Vec<String>,
    pub forbidden_fields: Vec<String>,
}

impl Default for ValidationRules {
    fn default() -> Self {
        Self {
            max_data_size_bytes: 1024 * 1024, // 1MB
            max_metadata_size_bytes: 64 * 1024, // 64KB
            max_tags: 10,
            allowed_tag_patterns: vec![],
            required_fields: vec![],
            forbidden_fields: vec![],
        }
    }
}

/// Session lifecycle hooks
#[async_trait::async_trait]
pub trait SessionLifecycleHook: Send + Sync {
    async fn on_create(&self, session: &Session) -> SessionResult<()> {
        Ok(())
    }

    async fn on_update(&self, session: &Session, updates: &[SessionUpdate]) -> SessionResult<()> {
        Ok(())
    }

    async fn on_expire(&self, session: &Session) -> SessionResult<()> {
        Ok(())
    }

    async fn on_terminate(&self, session: &Session) -> SessionResult<()> {
        Ok(())
    }
}

/// Session backup configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub enabled: bool,
    pub interval_seconds: u64,
    pub retention_days: u32,
    pub compression: bool,
    pub encryption: bool,
    pub location: String,
}
