//! Time utilities for Sira Utils
//! Time utilities for Sira Utils
//! 
//! Result type for utils operations
pub type UtilsResult<T> = Result<T, UtilsError>;
use crate::UtilsError;



/// Time utilities
pub struct TimeUtils;

impl TimeUtils {
    /// Get current timestamp in milliseconds
    pub fn current_timestamp_ms() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64
    }

    /// Get current timestamp in microseconds
    pub fn current_timestamp_us() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_micros()
    }

    /// Get current timestamp in nanoseconds
    pub fn current_timestamp_ns() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    }

    /// Format timestamp to string
    pub fn format_timestamp(timestamp: u64, format: &str) -> UtilsResult<String> {
        use chrono::{DateTime, Utc};
        let datetime = DateTime::<Utc>::from_timestamp_millis(timestamp as i64)
            .ok_or_else(|| crate::UtilsError::Time("Invalid timestamp".to_string()))?;

        Ok(datetime.format(format).to_string())
    }

    /// Parse time string to timestamp
    pub fn parse_time(time_str: &str, format: &str) -> UtilsResult<u64> {
        use chrono::DateTime;
        let datetime = DateTime::parse_from_str(time_str, format)
            .map_err(|_| crate::UtilsError::Time("Failed to parse time string".to_string()))?;

        Ok(datetime.timestamp_millis() as u64)
    }

    /// Calculate time difference in milliseconds
    pub fn time_diff_ms(start: u64, end: u64) -> i64 {
        end as i64 - start as i64
    }

    /// Check if timestamp is expired
    pub fn is_expired(timestamp: u64, ttl_ms: u64) -> bool {
        let now = Self::current_timestamp_ms();
        now > timestamp + ttl_ms
    }

    /// Get remaining time in milliseconds
    pub fn remaining_time_ms(timestamp: u64, ttl_ms: u64) -> i64 {
        let now = Self::current_timestamp_ms();
        let expiry = timestamp + ttl_ms;
        expiry as i64 - now as i64
    }

    /// Format duration in human readable format
    pub fn format_duration_ms(duration_ms: u64) -> String {
        let seconds = duration_ms / 1000;
        let minutes = seconds / 60;
        let hours = minutes / 60;
        let days = hours / 24;

        if days > 0 {
            format!("{}d {}h {}m {}s", days, hours % 24, minutes % 60, seconds % 60)
        } else if hours > 0 {
            format!("{}h {}m {}s", hours, minutes % 60, seconds % 60)
        } else if minutes > 0 {
            format!("{}m {}s", minutes, seconds % 60)
        } else {
            format!("{}s", seconds)
        }
    }

    /// Get ISO 8601 formatted current time
    pub fn iso8601_now() -> String {
        use chrono::Utc;
        Utc::now().to_rfc3339()
    }

    /// Convert timestamp to ISO 8601 format
    pub fn timestamp_to_iso8601(timestamp: u64) -> UtilsResult<String> {
        Self::format_timestamp(timestamp, "%Y-%m-%dT%H:%M:%S%.3fZ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_current_timestamp() {
        let ts1 = TimeUtils::current_timestamp_ms();
        std::thread::sleep(std::time::Duration::from_millis(10));
        let ts2 = TimeUtils::current_timestamp_ms();

        assert!(ts2 > ts1);
        assert!(ts2 - ts1 >= 10);
    }

    #[test]
    fn test_format_timestamp() {
        let timestamp = 1640995200000; // 2022-01-01 00:00:00 UTC
        let formatted = TimeUtils::format_timestamp(timestamp, "%Y-%m-%d").unwrap();
        assert_eq!(formatted, "2022-01-01");
    }

    #[test]
    fn test_time_diff() {
        let start = 1000;
        let end = 2000;
        let diff = TimeUtils::time_diff_ms(start, end);
        assert_eq!(diff, 1000);
    }

    #[test]
    fn test_expiry_check() {
        let past = TimeUtils::current_timestamp_ms() - 1000;
        let future = TimeUtils::current_timestamp_ms() + 10000;

        assert!(TimeUtils::is_expired(past, 500)); // Past + 500ms < now
        assert!(!TimeUtils::is_expired(future, 5000)); // Future + 5000ms > now
    }

    #[test]
    fn test_format_duration() {
        assert_eq!(TimeUtils::format_duration_ms(1000), "1s");
        assert_eq!(TimeUtils::format_duration_ms(65000), "1m 5s");
        assert_eq!(TimeUtils::format_duration_ms(3661000), "1h 1m 1s");
    }
}
