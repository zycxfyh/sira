import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  HttpStatus,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import request from 'supertest';
import helmet from 'helmet';
import { HealthModule } from '../health/health.module';

// Simple exception filter for testing
@Catch()
class TestExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    if (exception.status && typeof exception.status === 'number') {
      response.status(exception.status).json({
        statusCode: exception.status,
        message: exception.message || 'Bad Request',
        error: exception.name || 'BadRequestException',
      });
    } else {
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      });
    }
  }
}

describe('API Security Tests (e2e) - Framework Built-in Security', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
      providers: [
        {
          provide: APP_FILTER,
          useClass: TestExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication() as any;

    // Apply framework built-in security middleware (helmet)
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      }),
    );

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('X-XSS-Protection', '1; mode=block')
        .expect('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    it('should include CSP headers', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.headers['content-security-policy']).toBeDefined();
          expect(res.headers['content-security-policy']).toContain("default-src 'self'");
          expect(res.headers['content-security-policy']).toContain("object-src 'none'");
        });
    });

    it('should include HSTS headers', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect('Strict-Transport-Security', /max-age=31536000/);
    });
  });

  describe('HTTP Method Handling', () => {
    it('should handle GET requests to health endpoint', () => {
      return request(app.getHttpServer()).get('/health').expect(200);
    });

    it('should reject unsupported methods to health endpoint', () => {
      return request(app.getHttpServer()).put('/health').expect(404);
    });
  });

  describe('Input Size Limits', () => {
    it('should handle reasonable payload sizes', () => {
      const normalPayload = { data: 'x'.repeat(1000) };
      return request(app.getHttpServer()).post('/health').send(normalPayload).expect(400); // Health endpoint doesn't accept POST, but size should be fine
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', () => {
      return request(app.getHttpServer())
        .post('/health')
        .set('Content-Type', 'application/json')
        .send('{invalid json')
        .expect(400);
    });

    it('should handle non-existent endpoints', () => {
      return request(app.getHttpServer()).get('/nonexistent-endpoint').expect(404);
    });
  });

  describe('Basic Input Validation', () => {
    it('should handle query parameters', () => {
      return request(app.getHttpServer()).get('/health?test=value').expect(200);
    });

    it('should handle unicode characters in query params', () => {
      return request(app.getHttpServer())
        .get('/health?name=caf%C3%A9') // URL encoded é
        .expect(200);
    });
  });
});
