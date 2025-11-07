const CacheService = require('../src/services/cache');

describe('Cache Service', () => {
  let cache;

  beforeAll(async () => {
    cache = new CacheService();
    // Note: These tests assume Redis is running
    // In CI/CD, you might want to use a mock or test Redis instance
  });

  afterAll(async () => {
    await cache.disconnect();
  });

  test('should generate consistent cache keys', () => {
    const request1 = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7
    };

    const request2 = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7
    };

    const key1 = cache.generateKey(request1);
    const key2 = cache.generateKey(request2);

    expect(key1).toBe(key2);
  });

  test('should generate different keys for different requests', () => {
    const request1 = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const request2 = {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Goodbye' }]
    };

    const key1 = cache.generateKey(request1);
    const key2 = cache.generateKey(request2);

    expect(key1).not.toBe(key2);
  });

  test('cache set and get operations', async () => {
    const key = 'test-key';
    const value = { test: 'data', timestamp: Date.now() };
    const ttl = 60;

    // Set value
    await cache.set(key, value, ttl);

    // Get value
    const retrieved = await cache.get(key);

    expect(retrieved).toEqual(value);
  });

  test('cache should respect TTL', async () => {
    const key = 'ttl-test';
    const value = { test: 'ttl-data' };
    const ttl = 1; // 1 second

    // Set value with short TTL
    await cache.set(key, value, ttl);

    // Should exist immediately
    let retrieved = await cache.get(key);
    expect(retrieved).toEqual(value);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should not exist after TTL
    retrieved = await cache.get(key);
    expect(retrieved).toBeNull();
  });

  test('cache delete operation', async () => {
    const key = 'delete-test';
    const value = { test: 'delete-data' };

    // Set value
    await cache.set(key, value);

    // Verify it exists
    let retrieved = await cache.get(key);
    expect(retrieved).toEqual(value);

    // Delete value
    await cache.delete(key);

    // Verify it's gone
    retrieved = await cache.get(key);
    expect(retrieved).toBeNull();
  });

  test('cache statistics', async () => {
    const stats = await cache.getStats();

    expect(stats).toHaveProperty('connected');
    if (stats.connected) {
      expect(stats).toHaveProperty('totalKeys');
      expect(typeof stats.totalKeys).toBe('number');
    }
  });
});
