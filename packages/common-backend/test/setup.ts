import 'reflect-metadata';

// 全局测试设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.PORT = '3000';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.QDRANT_URL = 'http://localhost:6333';
});

afterAll(async () => {
  // 清理测试资源
  jest.clearAllMocks();
});
