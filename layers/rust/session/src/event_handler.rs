//! Event Handler for Sira Session

use crate::{SessionResult, SessionEvent, SessionEventHandler};
use async_trait::async_trait;
use tracing::{info, warn, error};

/// Logging event handler
pub struct LoggingEventHandler;

#[async_trait]
impl SessionEventHandler for LoggingEventHandler {
    async fn handle_event(&self, event: &SessionEvent) -> SessionResult<()> {
        match event {
            SessionEvent::Created { session_id, user_id } => {
                info!("Session created: {} for user: {}", session_id, user_id);
            }
            SessionEvent::Updated { session_id, changes } => {
                info!("Session updated: {} - {} changes", session_id, changes.len());
            }
            SessionEvent::Expired { session_id } => {
                warn!("Session expired: {}", session_id);
            }
            SessionEvent::Terminated { session_id, reason } => {
                info!("Session terminated: {} - {}", session_id, reason);
            }
            SessionEvent::Restored { session_id } => {
                info!("Session restored: {}", session_id);
            }
            SessionEvent::Cleaned { session_ids, reason } => {
                info!("Sessions cleaned: {} sessions - {}", session_ids.len(), reason);
            }
        }
        Ok(())
    }
}

/// Metrics event handler
pub struct MetricsEventHandler {
    sessions_created: std::sync::Arc<std::sync::Mutex<u64>>,
    sessions_expired: std::sync::Arc<std::sync::Mutex<u64>>,
    sessions_terminated: std::sync::Arc<std::sync::Mutex<u64>>,
    sessions_cleaned: std::sync::Arc<std::sync::Mutex<u64>>,
}

impl MetricsEventHandler {
    pub fn new() -> Self {
        Self {
            sessions_created: std::sync::Arc::new(std::sync::Mutex::new(0)),
            sessions_expired: std::sync::Arc::new(std::sync::Mutex::new(0)),
            sessions_terminated: std::sync::Arc::new(std::sync::Mutex::new(0)),
            sessions_cleaned: std::sync::Arc::new(std::sync::Mutex::new(0)),
        }
    }

    pub fn get_metrics(&self) -> (u64, u64, u64, u64) {
        (
            *self.sessions_created.lock().unwrap(),
            *self.sessions_expired.lock().unwrap(),
            *self.sessions_terminated.lock().unwrap(),
            *self.sessions_cleaned.lock().unwrap(),
        )
    }
}

#[async_trait]
impl SessionEventHandler for MetricsEventHandler {
    async fn handle_event(&self, event: &SessionEvent) -> SessionResult<()> {
        match event {
            SessionEvent::Created { .. } => {
                *self.sessions_created.lock().unwrap() += 1;
            }
            SessionEvent::Expired { .. } => {
                *self.sessions_expired.lock().unwrap() += 1;
            }
            SessionEvent::Terminated { .. } => {
                *self.sessions_terminated.lock().unwrap() += 1;
            }
            SessionEvent::Cleaned { session_ids, .. } => {
                *self.sessions_cleaned.lock().unwrap() += session_ids.len() as u64;
            }
            _ => {} // Other events don't affect these metrics
        }

        Ok(())
    }
}

/// Notification event handler
pub struct NotificationEventHandler {
    notifications: std::sync::Arc<std::sync::Mutex<Vec<String>>>,
}

impl NotificationEventHandler {
    pub fn new() -> Self {
        Self {
            notifications: std::sync::Arc::new(std::sync::Mutex::new(Vec::new())),
        }
    }

    pub fn get_notifications(&self) -> Vec<String> {
        self.notifications.lock().unwrap().clone()
    }

    pub fn clear_notifications(&self) {
        self.notifications.lock().unwrap().clear();
    }
}

#[async_trait]
impl SessionEventHandler for NotificationEventHandler {
    async fn handle_event(&self, event: &SessionEvent) -> SessionResult<()> {
        let notification = match event {
            SessionEvent::Expired { session_id } => {
                format!("ALERT: Session {} has expired", session_id)
            }
            SessionEvent::Terminated { session_id, reason } => {
                format!("WARNING: Session {} was terminated: {}", session_id, reason)
            }
            SessionEvent::Cleaned { session_ids, reason } => {
                format!("CLEANUP: Cleaned up {} sessions: {}", session_ids.len(), reason)
            }
            _ => return Ok(()), // Don't notify for other events
        };

        self.notifications.lock().unwrap().push(notification);

        // In a real implementation, this might send emails, SMS, etc.

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_logging_event_handler() {
        let handler = LoggingEventHandler;
        let event = SessionEvent::Created {
            session_id: "test_session".to_string(),
            user_id: "test_user".to_string(),
        };

        // Should not panic
        handler.handle_event(&event).await.unwrap();
    }

    #[tokio::test]
    async fn test_metrics_event_handler() {
        let handler = MetricsEventHandler::new();

        // Test session creation
        let create_event = SessionEvent::Created {
            session_id: "test_session".to_string(),
            user_id: "test_user".to_string(),
        };
        handler.handle_event(&create_event).await.unwrap();

        // Test session expiration
        let expire_event = SessionEvent::Expired {
            session_id: "test_session".to_string(),
        };
        handler.handle_event(&expire_event).await.unwrap();

        let (created, expired, terminated, cleaned) = handler.get_metrics();
        assert_eq!(created, 1);
        assert_eq!(expired, 1);
        assert_eq!(terminated, 0);
        assert_eq!(cleaned, 0);
    }

    #[tokio::test]
    async fn test_notification_event_handler() {
        let handler = NotificationEventHandler::new();

        let event = SessionEvent::Expired {
            session_id: "test_session".to_string(),
        };

        handler.handle_event(&event).await.unwrap();

        let notifications = handler.get_notifications();
        assert_eq!(notifications.len(), 1);
        assert!(notifications[0].contains("ALERT"));
        assert!(notifications[0].contains("expired"));
    }
}
