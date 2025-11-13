//! Cryptographic utilities for Sira Utils

/// Cryptographic utilities
pub struct CryptoUtils;

impl CryptoUtils {
    /// Calculate MD5 hash
    pub fn md5(data: &[u8]) -> String {
        use md5::{Md5, Digest};
        let mut hasher = Md5::new();
        hasher.update(data);
        let result = hasher.finalize();
        format!("{:x}", result)
    }

    /// Calculate SHA256 hash
    pub fn sha256(data: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        format!("{:x}", result)
    }

    /// Calculate SHA512 hash
    pub fn sha512(data: &[u8]) -> String {
        use sha2::{Sha512, Digest};
        let mut hasher = Sha512::new();
        hasher.update(data);
        let result = hasher.finalize();
        format!("{:x}", result)
    }

    /// HMAC-SHA256 signature
    pub fn hmac_sha256(data: &[u8], key: &[u8]) -> Vec<u8> {
        use hmac::{Hmac, Mac};
        use sha2::Sha256;

        let mut mac = Hmac::<Sha256>::new_from_slice(key)
            .expect("HMAC can take key of any size");
        mac.update(data);
        mac.finalize().into_bytes().to_vec()
    }

    /// HMAC-SHA512 signature
    pub fn hmac_sha512(data: &[u8], key: &[u8]) -> Vec<u8> {
        use hmac::{Hmac, Mac};
        use sha2::Sha512;

        let mut mac = Hmac::<Sha512>::new_from_slice(key)
            .expect("HMAC can take key of any size");
        mac.update(data);
        mac.finalize().into_bytes().to_vec()
    }

    /// Generate random bytes
    pub fn generate_random_bytes(len: usize) -> Vec<u8> {
        use rand::{RngCore, thread_rng};
        let mut bytes = vec![0u8; len];
        thread_rng().fill_bytes(&mut bytes);
        bytes
    }

    /// Generate random string (hex)
    pub fn generate_random_string(len: usize) -> String {
        hex::encode(Self::generate_random_bytes(len))
    }

    /// Generate UUID v4
    pub fn generate_uuid() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    /// Constant time comparison (prevents timing attacks)
    pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
        if a.len() != b.len() {
            return false;
        }

        let mut result = 0u8;
        for (x, y) in a.iter().zip(b.iter()) {
            result |= x ^ y;
        }

        result == 0
    }

    /// Verify HMAC signature
    pub fn verify_hmac_sha256(data: &[u8], key: &[u8], signature: &[u8]) -> bool {
        let computed = Self::hmac_sha256(data, key);
        Self::constant_time_eq(&computed, signature)
    }

    /// PBKDF2 key derivation
    pub fn pbkdf2(password: &str, salt: &[u8], iterations: u32, key_len: usize) -> Vec<u8> {
        use pbkdf2::pbkdf2_hmac;
        use sha2::Sha256;

        let mut key = vec![0u8; key_len];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, iterations, &mut key);
        key
    }

    /// Simple XOR encryption (not for production use)
    pub fn simple_xor(data: &[u8], key: &[u8]) -> Vec<u8> {
        data.iter()
            .enumerate()
            .map(|(i, &byte)| byte ^ key[i % key.len()])
            .collect()
    }

    /// Simple XOR decryption (not for production use)
    pub fn simple_xor_decrypt(data: &[u8], key: &[u8]) -> Vec<u8> {
        Self::simple_xor(data, key) // XOR is symmetric
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_md5() {
        let data = b"hello world";
        let hash = CryptoUtils::md5(data);
        assert_eq!(hash.len(), 32);
        assert_eq!(hash, "5eb63bbbe01eeed093cb22bb8f5acdc3");
    }

    #[test]
    fn test_sha256() {
        let data = b"hello world";
        let hash = CryptoUtils::sha256(data);
        assert_eq!(hash.len(), 64);
        assert_eq!(hash, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    }

    #[test]
    fn test_hmac_sha256() {
        let data = b"hello world";
        let key = b"secret";
        let signature = CryptoUtils::hmac_sha256(data, key);
        assert_eq!(signature.len(), 32);

        // Verify signature
        assert!(CryptoUtils::verify_hmac_sha256(data, key, &signature));
    }

    #[test]
    fn test_random_generation() {
        let bytes = CryptoUtils::generate_random_bytes(16);
        assert_eq!(bytes.len(), 16);

        let string = CryptoUtils::generate_random_string(8);
        assert_eq!(string.len(), 16); // hex encoding doubles length

        let uuid = CryptoUtils::generate_uuid();
        assert_eq!(uuid.len(), 36); // UUID v4 format
    }

    #[test]
    fn test_constant_time_eq() {
        let a = b"hello";
        let b = b"hello";
        let c = b"world";

        assert!(CryptoUtils::constant_time_eq(a, b));
        assert!(!CryptoUtils::constant_time_eq(a, c));
    }

    #[test]
    fn test_simple_xor() {
        let data = b"hello world";
        let key = b"secret";

        let encrypted = CryptoUtils::simple_xor(data, key);
        let decrypted = CryptoUtils::simple_xor_decrypt(&encrypted, key);

        assert_eq!(data, decrypted.as_slice());
    }
}
