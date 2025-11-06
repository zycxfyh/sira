import 'reflect-metadata';

// 全局集成测试设置
beforeAll(async () => {
  // 设置集成测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5433/test_db';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
  process.env.JWT_SECRET = 'test-jwt-secret-integration';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
}, 30000);

afterAll(async () => {
  jest.clearAllMocks();
}, 30000);
