// Test environment setup - runs before jest globals are available
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.QDRANT_URL = 'http://localhost:6333';
