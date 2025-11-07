const request = require('supertest');
const app = require('../src/index');
const config = require('../config/default');

describe('API Gateway Integration Tests', () => {
  const validApiKey = config.gateway.apiKey;
  const invalidApiKey = 'invalid-key';

  describe('Authentication', () => {
    test('should accept valid API key', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', validApiKey)
        .send({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      // Should not return 401, even if the actual API call fails
      expect(response.status).not.toBe(401);
    });

    test('should reject invalid API key', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', invalidApiKey)
        .send({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });

    test('should reject missing API key', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .send({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('Health Check', () => {
    test('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('Metrics Endpoint', () => {
    test('should return metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
    });
  });

  describe('API Validation', () => {
    test('should reject invalid model', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', validApiKey)
        .send({
          model: 'invalid-model',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(response.status).toBe(500); // Internal server error due to unknown vendor
    });

    test('should reject missing messages', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', validApiKey)
        .send({
          model: 'gpt-3.5-turbo'
          // Missing messages
        });

      expect(response.status).toBe(500);
    });

    test('should reject empty messages', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', validApiKey)
        .send({
          model: 'gpt-3.5-turbo',
          messages: []
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Rate Limiting', () => {
    test('should handle rate limiting', async () => {
      const requests = [];

      // Make multiple requests quickly
      for (let i = 0; i < 5; i++) {
        requests.push(
          request(app)
            .post('/api/chat/completions')
            .set('x-api-key', validApiKey)
            .send({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: `Request ${i}` }]
            })
        );
      }

      const responses = await Promise.all(requests);

      // At least one request should succeed (depending on rate limit settings)
      const successCount = responses.filter(r => r.status !== 429).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      // This test assumes the API keys are not configured
      // In a real environment, you might mock the external API calls
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', validApiKey)
        .send({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        });

      // Should return an error response, not crash the server
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/chat/completions')
        .set('x-api-key', validApiKey)
        .set('Content-Type', 'application/json')
        .send('invalid json {');

      expect(response.status).toBe(400);
    });
  });

  describe('CORS', () => {
    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/chat/completions')
        .set('Origin', 'http://localhost:3001')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-api-key,content-type')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });
});
