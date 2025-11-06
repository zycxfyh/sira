import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { HealthModule } from '../health/health.module';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

describe('API Security Tests (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('HTTP Method Security', () => {
    it('should reject unsupported HTTP methods', () => {
      return request(app.getHttpServer()).put('/health').expect(404); // Method Not Allowed
    });

    it('should reject TRACE method', () => {
      return request(app.getHttpServer()).trace('/health').expect(404);
    });
  });

  describe('Input Validation Security', () => {
    it('should reject extremely large payloads', () => {
      const largePayload = 'x'.repeat(1000000); // 1MB payload
      return request(app.getHttpServer()).post('/health').send({ data: largePayload }).expect(400); // Bad Request
    });

    it('should reject prototype pollution attempts', () => {
      return request(app.getHttpServer())
        .post('/health')
        .send({ 'constructor.prototype.isAdmin': true })
        .expect(400);
    });

    it('should reject null byte injection', () => {
      return request(app.getHttpServer())
        .post('/health')
        .send({ input: 'test\u0000malicious' })
        .expect(400);
    });
  });

  describe('Parameter Tampering', () => {
    it('should reject SQL-like injection in query params', () => {
      return request(app.getHttpServer()).get('/health?id=1%27%20OR%20%271%27%3D%271').expect(400);
    });

    it('should reject path traversal attempts', () => {
      return request(app.getHttpServer()).get('/health/../../../etc/passwd').expect(404);
    });
  });

  describe('Header Injection', () => {
    it('should reject CRLF injection in headers', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('X-Custom', 'value\r\nX-Injected: malicious')
        .expect(400);
    });

    it('should handle malformed JSON in body', () => {
      return request(app.getHttpServer())
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{invalid json')
        .expect(400);
    });
  });

  describe('Error Information Disclosure', () => {
    it('should not leak internal error details', () => {
      return request(app.getHttpServer())
        .get('/health?error=test')
        .expect(200)
        .then((res) => {
          // Response should not contain stack traces or internal paths
          expect(res.text).not.toContain('Error:');
          expect(res.text).not.toContain('at ');
          expect(res.text).not.toContain('node_modules');
          expect(res.text).not.toContain('internal');
        });
    });
  });
});
