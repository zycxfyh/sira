// Jest global test setup
const { MongoMemoryServer } = require('mongodb-memory-server');
const { RedisMemoryServer } = require('redis-memory-server');

let mongoServer;
let redisServer;

// Increase timeout for setup
jest.setTimeout(60000);

// Setup before all tests
beforeAll(async () => {
  try {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Start in-memory Redis
    redisServer = await RedisMemoryServer.create();
    const redisPort = redisServer.getPort();
    const redisHost = redisServer.getHost();

    // Set environment variables for tests
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongoUri;
    process.env.REDIS_HOST = redisHost;
    process.env.REDIS_PORT = redisPort.toString();
    process.env.REDIS_PASSWORD = '';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.PORT = '3001'; // Different port for tests

    console.log('🧪 Test environment setup completed');
    console.log(`📊 MongoDB: ${mongoUri}`);
    console.log(`🔴 Redis: ${redisHost}:${redisPort}`);

  } catch (error) {
    console.error('❌ Failed to setup test environment:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    if (mongoServer) {
      await mongoServer.stop();
      console.log('🗑️ MongoDB memory server stopped');
    }

    if (redisServer) {
      await redisServer.stop();
      console.log('🗑️ Redis memory server stopped');
    }

    console.log('🧹 Test environment cleanup completed');
  } catch (error) {
    console.error('❌ Failed to cleanup test environment:', error);
  }
});

// Global test utilities
global.testUtils = {
  // Generate test data
  generateTestUser: (overrides = {}) => ({
    username: `testuser_${Date.now()}`,
    email: `test${Date.now()}@example.com`,
    password: 'testpass123',
    ...overrides
  }),

  generateTestApiKey: (overrides = {}) => ({
    name: `Test Key ${Date.now()}`,
    permissions: ['read', 'write'],
    ...overrides
  }),

  // Clean up database between tests
  cleanupDatabase: async () => {
    const mongoose = require('mongoose');

    if (mongoose.connection.readyState === 1) {
      const collections = mongoose.connection.collections;

      for (const key in collections) {
        await collections[key].deleteMany({});
      }
    }
  },

  // Wait for database operations
  waitForDatabase: async (timeout = 5000) => {
    const mongoose = require('mongoose');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Database connection timeout'));
      }, timeout);

      if (mongoose.connection.readyState === 1) {
        clearTimeout(timer);
        resolve();
      } else {
        mongoose.connection.once('connected', () => {
          clearTimeout(timer);
          resolve();
        });
      }
    });
  }
};

// Mock external services
jest.mock('../src/services/cache', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  generateKey: jest.fn((req) => `cache:${JSON.stringify(req)}`)
}));

// Mock external API calls
jest.mock('axios');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    on: jest.fn()
  }))
}));

// Console spy for cleaner test output
const originalConsole = { ...console };
beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console for debugging if needed
  if (process.env.DEBUG_TESTS === 'true') {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  }
});

// Custom matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = /^[0-9a-fA-F]{24}$/.test(received);
    return {
      message: () => `expected ${received} to be a valid ObjectId`,
      pass
    };
  },

  toBeValidJWT(received) {
    try {
      const parts = received.split('.');
      const pass = parts.length === 3 &&
                   Buffer.from(parts[0], 'base64').length > 0 &&
                   Buffer.from(parts[1], 'base64').length > 0;
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass
      };
    } catch (error) {
      return {
        message: () => `expected ${received} to be a valid JWT`,
        pass: false
      };
    }
  }
});
