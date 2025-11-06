import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request, { Response } from 'supertest';
import { HealthModule } from './health.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication() as any;
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/health (GET) - should return health status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res: Response) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('timestamp');
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();

        // 验证时间戳格式
        const timestamp = new Date(res.body.timestamp);
        expect(timestamp).toBeInstanceOf(Date);
        expect(isNaN(timestamp.getTime())).toBe(false);
      });
  });

  it('/health (GET) - should handle multiple requests', async () => {
    // 发送多个并发请求
    const promises = Array(5)
      .fill(null)
      .map(() => request(app.getHttpServer()).get('/health').expect(200));

    const responses = await Promise.all(promises);

    // 验证所有响应都正确
    responses.forEach((res: Response) => {
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  it('/health (GET) - should return proper content type', () => {
    return request(app.getHttpServer()).get('/health').expect('Content-Type', /json/).expect(200);
  });
});
