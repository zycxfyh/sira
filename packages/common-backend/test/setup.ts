import 'reflect-metadata';

// 全局测试设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';
});

afterAll(async () => {
  // 清理测试资源
  jest.clearAllMocks();
});