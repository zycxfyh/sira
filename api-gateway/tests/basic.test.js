const request = require('supertest');
const app = require('../src/index');

describe('API Gateway Basic Tests', () => {
  test('Health check endpoint', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('healthy');
    expect(response.body.version).toBe('1.0.0');
  });

  test('Unauthorized access to API', async () => {
    const response = await request(app)
      .post('/api/chat/completions')
      .send({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      .expect(401);

    expect(response.body.error).toBe('Unauthorized');
  });

  test('Invalid API key', async () => {
    const response = await request(app)
      .post('/api/chat/completions')
      .set('x-api-key', 'invalid-key')
      .send({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      .expect(401);

    expect(response.body.error).toBe('Unauthorized');
  });

  test('404 for unknown endpoints', async () => {
    const response = await request(app)
      .get('/unknown-endpoint')
      .expect(404);

    expect(response.body.error).toBe('Endpoint not found');
  });
});
