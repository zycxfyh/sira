//! String utilities for Sira Utils
//!
//! Result type for utils operations
pub type UtilsResult<T> = Result<T, UtilsError>;
use crate::UtilsError;

/// String utilities
pub struct StringUtils;

impl StringUtils {
    /// Trim whitespace from string
    pub fn trim(input: &str) -> String {
        input.trim().to_string()
    }

    /// Convert string to lowercase
    pub fn to_lowercase(input: &str) -> String {
        input.to_lowercase()
    }

    /// Convert string to uppercase
    pub fn to_uppercase(input: &str) -> String {
        input.to_uppercase()
    }

    /// Capitalize first letter
    pub fn capitalize(input: &str) -> String {
        let mut chars = input.chars();
        match chars.next() {
            None => String::new(),
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        }
    }

    /// Truncate string with ellipsis
    pub fn truncate(input: &str, max_length: usize) -> String {
        if input.len() <= max_length {
            input.to_string()
        } else if max_length <= 3 {
            "...".chars().take(max_length).collect()
        } else {
            format!("{}...", &input[..max_length - 3])
        }
    }

    /// Check if string is empty or whitespace only
    pub fn is_blank(input: &str) -> bool {
        input.trim().is_empty()
    }

    /// Check if string is not empty
    pub fn is_not_blank(input: &str) -> bool {
        !Self::is_blank(input)
    }

    /// Reverse string
    pub fn reverse(input: &str) -> String {
        input.chars().rev().collect()
    }

    /// Count words in string
    pub fn count_words(input: &str) -> usize {
        input.split_whitespace().count()
    }

    /// Remove duplicate spaces
    pub fn normalize_spaces(input: &str) -> String {
        input.split_whitespace()
            .filter(|s| !s.is_empty())
            .collect::<Vec<&str>>()
            .join(" ")
    }

    /// Extract substring between delimiters
    pub fn substring_between(input: &str, start: &str, end: &str) -> Option<String> {
        let start_pos = input.find(start)?;
        let start_pos = start_pos + start.len();
        let remaining = &input[start_pos..];
        let end_pos = remaining.find(end)?;
        Some(remaining[..end_pos].to_string())
    }

    /// Check if string starts with prefix (case insensitive)
    pub fn starts_with_ignore_case(input: &str, prefix: &str) -> bool {
        input.to_lowercase().starts_with(&prefix.to_lowercase())
    }

    /// Check if string ends with suffix (case insensitive)
    pub fn ends_with_ignore_case(input: &str, suffix: &str) -> bool {
        input.to_lowercase().ends_with(&suffix.to_lowercase())
    }

    /// Remove all whitespace
    pub fn remove_whitespace(input: &str) -> String {
        input.chars().filter(|c| !c.is_whitespace()).collect()
    }

    /// Check if string contains only alphanumeric characters
    pub fn is_alphanumeric(input: &str) -> bool {
        input.chars().all(|c| c.is_alphanumeric())
    }

    /// Check if string contains only digits
    pub fn is_numeric(input: &str) -> bool {
        input.chars().all(|c| c.is_ascii_digit())
    }

    /// Check if string is valid email format (basic)
    pub fn is_email(input: &str) -> bool {
        let parts: Vec<&str> = input.split('@').collect();
        if parts.len() != 2 {
            return false;
        }

        let local = parts[0];
        let domain = parts[1];

        if local.is_empty() || domain.is_empty() {
            return false;
        }

        // Basic checks
        local.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '_' || c == '-') &&
        domain.contains('.') &&
        domain.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-')
    }

    /// Generate slug from string
    pub fn to_slug(input: &str) -> String {
        input
            .to_lowercase()
            .chars()
            .map(|c| if c.is_alphanumeric() { c } else { '-' })
            .collect::<String>()
            .split('-')
            .filter(|s| !s.is_empty())
            .collect::<Vec<&str>>()
            .join("-")
    }

    /// Base64 encode string
    pub fn base64_encode(input: &str) -> String {
        base64::encode(input)
    }

    /// Base64 decode string
    pub fn base64_decode(input: &str) -> UtilsResult<String> {
        let bytes = base64::decode(input)
            .map_err(|_| crate::UtilsError::Parse("Invalid base64 string".to_string()))?;
        String::from_utf8(bytes)
            .map_err(|_| crate::UtilsError::Parse("Invalid UTF-8 in decoded base64".to_string()))
    }

    /// URL encode string
    pub fn url_encode(input: &str) -> String {
        urlencoding::encode(input).to_string()
    }

    /// URL decode string
    pub fn url_decode(input: &str) -> UtilsResult<String> {
        urlencoding::decode(input)
            .map(|s| s.to_string())
            .map_err(|_| crate::UtilsError::Parse("Invalid URL encoding".to_string()))
    }

    /// Format string with placeholders
    pub fn format_with_placeholders(template: &str, values: &[&str]) -> String {
        let mut result = template.to_string();
        for (i, value) in values.iter().enumerate() {
            let placeholder = format!("{{{}}}", i);
            result = result.replace(&placeholder, value);
        }
        result
    }

    /// Split string by multiple delimiters
    pub fn split_by_delimiters(input: &str, delimiters: &[char]) -> Vec<String> {
        input
            .split(|c| delimiters.contains(&c))
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect()
    }

    /// Join strings with separator
    pub fn join_with_separator(items: &[String], separator: &str) -> String {
        items.join(separator)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trim() {
        assert_eq!(StringUtils::trim("  hello  "), "hello");
        assert_eq!(StringUtils::trim("hello"), "hello");
    }

    #[test]
    fn test_case_conversion() {
        assert_eq!(StringUtils::to_lowercase("HELLO"), "hello");
        assert_eq!(StringUtils::to_uppercase("hello"), "HELLO");
        assert_eq!(StringUtils::capitalize("hello"), "Hello");
    }

    #[test]
    fn test_truncate() {
        assert_eq!(StringUtils::truncate("hello world", 8), "hello...");
        assert_eq!(StringUtils::truncate("hi", 8), "hi");
    }

    #[test]
    fn test_is_blank() {
        assert!(StringUtils::is_blank("   "));
        assert!(StringUtils::is_blank(""));
        assert!(!StringUtils::is_blank("hello"));
    }

    #[test]
    fn test_reverse() {
        assert_eq!(StringUtils::reverse("hello"), "olleh");
    }

    #[test]
    fn test_count_words() {
        assert_eq!(StringUtils::count_words("hello world"), 2);
        assert_eq!(StringUtils::count_words(""), 0);
    }

    #[test]
    fn test_normalize_spaces() {
        assert_eq!(StringUtils::normalize_spaces("  hello   world  "), "hello world");
    }

    #[test]
    fn test_substring_between() {
        assert_eq!(StringUtils::substring_between("hello [world] test", "[", "]"), Some("world".to_string()));
        assert_eq!(StringUtils::substring_between("hello world", "[", "]"), None);
    }

    #[test]
    fn test_case_insensitive_comparison() {
        assert!(StringUtils::starts_with_ignore_case("HELLO", "he"));
        assert!(StringUtils::ends_with_ignore_case("WORLD", "LD"));
    }

    #[test]
    fn test_validation() {
        assert!(StringUtils::is_alphanumeric("hello123"));
        assert!(!StringUtils::is_alphanumeric("hello 123"));
        assert!(StringUtils::is_numeric("123"));
        assert!(!StringUtils::is_numeric("123a"));
    }

    #[test]
    fn test_slug_generation() {
        assert_eq!(StringUtils::to_slug("Hello World!"), "hello-world");
        assert_eq!(StringUtils::to_slug("Test & Example"), "test-example");
    }

    #[test]
    fn test_base64_operations() {
        let original = "hello world";
        let encoded = StringUtils::base64_encode(original);
        let decoded = StringUtils::base64_decode(&encoded).unwrap();
        assert_eq!(original, decoded);
    }

    #[test]
    fn test_format_with_placeholders() {
        let template = "Hello {0}, welcome to {1}!";
        let result = StringUtils::format_with_placeholders(template, &["Alice", "Wonderland"]);
        assert_eq!(result, "Hello Alice, welcome to Wonderland!");
    }
}
