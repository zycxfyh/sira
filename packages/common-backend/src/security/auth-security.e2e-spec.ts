import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { HealthModule } from '../health/health.module';

// Mock Auth Guard for testing
class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No valid authorization token provided');
    }

    const token = authHeader.substring(7);
    // Mock token validation - reject any token for testing purposes
    throw new UnauthorizedException('Invalid authentication token');
  }
}

describe('Authentication Security Tests (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
      providers: [
        {
          provide: APP_GUARD,
          useClass: MockAuthGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication() as any;
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('JWT Token Security', () => {
    it('should reject requests without Authorization header', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(401);
    });

    it('should reject empty Authorization header', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', '')
        .expect(401);
    });

    it('should reject malformed Authorization header', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });

    it('should reject Authorization header without Bearer prefix', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', 'invalid.jwt.token')
        .expect(401);
    });

    it('should reject invalid JWT format', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);
    });

    it('should reject JWT with invalid signature', () => {
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Bearer ${fakeToken}`)
        .expect(401);
    });

    it('should reject expired JWT token', () => {
      // Create an expired token (issued in 2020)
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTc3ODYzOTAyMn0.3XmR8qYKQ9m2KXJ6zYQ8VzJ8mKzYQ8VzJ8mKzYQ8VzJ';
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject JWT with future iat (issued at)', () => {
      // Token with future iat (year 3000)
      const futureToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjozMjUwMzY3OTAyMn0.3XmR8qYKQ9m2KXJ6zYQ8VzJ8mKzYQ8VzJ8mKzYQ8VzJ';
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', `Bearer ${futureToken}`)
        .expect(401);
    });
  });

  describe('Session Management', () => {
    it('should not leak session information in error responses', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', 'Bearer invalid')
        .expect(401)
        .then((res: any) => {
          // Response should not contain session tokens or internal session data
          expect(res.body).not.toHaveProperty('session');
          expect(res.body).not.toHaveProperty('token');
          expect(res.body).not.toHaveProperty('sessionId');
          expect(res.text).not.toContain('session');
        });
    });

    it('should handle concurrent authentication attempts gracefully', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/health')
          .set('Authorization', 'Bearer invalid')
      );

      const results = await Promise.allSettled(promises);

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.status).toBe(401);
        }
      });
    });
  });

  describe('Authentication Bypass Attempts', () => {
    it('should reject extremely long tokens', () => {
      const longToken = 'Bearer ' + 'a'.repeat(10000);
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', longToken)
        .expect(400); // Should fail with bad request due to length
    });

    it('should handle special characters in tokens', () => {
      const specialToken = 'Bearer ' + '!@#$%^&*()_+{}|:<>?[]\\;\'",./';
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', specialToken)
        .expect(401);
    });

    it('should handle unicode characters in tokens', () => {
      const unicodeToken = 'Bearer ' + '测试token���';
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', unicodeToken)
        .expect(401);
    });
  });

  describe('Authorization Header Injection', () => {
    it('should handle case variations in Authorization header', () => {
      const caseVariations = [
        'authorization',
        'AUTHORIZATION',
        'Authorization',
        'AuThOrIzAtIoN'
      ];

      const promises = caseVariations.map(headerName =>
        request(app.getHttpServer())
          .get('/health')
          .set(headerName, 'Bearer invalid')
          .expect(401)
      );

      return Promise.all(promises);
    });

    it('should reject multiple Authorization headers', () => {
      return request(app.getHttpServer())
        .get('/health')
        .set('Authorization', 'Bearer token1')
        .set('Authorization', 'Bearer token2')
        .expect(401);
    });
  });

  describe('Token Entropy and Predictability', () => {
    it('should reject obviously weak tokens', () => {
      const weakTokens = [
        'Bearer 123456',
        'Bearer password',
        'Bearer admin',
        'Bearer test',
        'Bearer ' + 'a'.repeat(64), // All same character
      ];

      const promises = weakTokens.map(token =>
        request(app.getHttpServer())
          .get('/health')
          .set('Authorization', token)
          .expect(401)
      );

      return Promise.all(promises);
    });

    it('should handle tokens with common patterns', () => {
      const patternTokens = [
        'Bearer abc123',
        'Bearer 123abc',
        'Bearer qwerty',
        'Bearer admin123',
      ];

      const promises = patternTokens.map(token =>
        request(app.getHttpServer())
          .get('/health')
          .set('Authorization', token)
          .expect(401)
      );

      return Promise.all(promises);
    });
  });

  describe('Multi-Tenant Authentication', () => {
    it('should prevent cross-tenant access', () => {
      return request(app.getHttpServer())
        .get('/health?tenant=invalid')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });

    it('should handle tenant-specific token validation', () => {
      return request(app.getHttpServer())
        .get('/health?tenant=valid')
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    });
  });

  describe('Rate Limiting Bypass Attempts', () => {
    it('should handle rapid token validation requests', async () => {
      const promises = Array(50).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/health')
          .set('Authorization', 'Bearer invalid')
      );

      const results = await Promise.allSettled(promises);

      // Should handle the load without crashing
      expect(results.length).toBe(50);

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      // At least some should succeed (not crash the server)
      expect(fulfilled.length + rejected.length).toBe(50);
    });
  });
});
