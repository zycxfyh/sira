import 'reflect-metadata';

// Mock external dependencies
jest.mock('jsonrepair', () => ({
  jsonrepair: jest.fn().mockImplementation((jsonString: string): string => {
    console.log('jsonrepair called with:', JSON.stringify(jsonString));
    // Simple but effective JSON repair for testing
    try {
      // First try to parse as-is
      JSON.parse(jsonString);
      console.log('jsonrepair returning original (already valid):', JSON.stringify(jsonString));
      return jsonString;
    } catch {
      // Apply common repairs
      let repaired = jsonString;

      // Remove trailing commas in arrays first
      repaired = repaired.replace(/,(\s*)\]/g, ']');
      // Then remove trailing commas in objects
      repaired = repaired.replace(/,(\s*)\}/g, '}');

      // Remove JavaScript-style comments
      repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, ''); // Multi-line comments
      repaired = repaired.replace(/\/\/.*$/gm, ''); // Single-line comments

      // Try to parse the repaired version
      try {
        JSON.parse(repaired.trim());
        console.log('jsonrepair returning repaired:', JSON.stringify(repaired.trim()));
        return repaired.trim();
      } catch (repairError) {
        console.log(
          `jsonrepair failed to repair: ${JSON.stringify(jsonString)} -> ${JSON.stringify(repaired)}, error:`,
          repairError,
        );
        // If repair fails, return the original (will be handled by next strategy)
        return jsonString;
      }
    }
  }),
}));

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
