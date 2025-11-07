// 文件路径: apps/nexus-engine/src/main.ts (已集成 Redis Adapter)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config'; // [!] 核心改造：导入 ConfigService
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter'; // [!] 核心改造：导入 Redis 适配器
import { createClient } from 'redis'; // [!] 核心改造：导入 Redis 客户端

// [!] 核心改造：创建一个自定义的 Socket.IO 适配器类
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor!: ReturnType<typeof createAdapter>;

  constructor(
    app: NestApplication,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    // 根据官方建议，为 pub/sub 创建两个独立的 Redis 连接
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: Record<string, unknown>): Record<string, unknown> {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  Sentry.init({
    dsn: configService.get<string>('SENTRY_DSN'),
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });

  // [!] 核心改造：设置并连接 Redis 适配器
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // 配置增强的安全中间件 - 依赖框架内置安全措施
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // 允许内联样式用于前端框架
          scriptSrc: ["'self'"], // 只允许同源脚本
          imgSrc: ["'self'", 'data:', 'https:'], // 允许数据URI和HTTPS图片
          connectSrc: ["'self'", 'https:'], // 允许WebSocket和HTTPS连接
          fontSrc: ["'self'", 'https:', 'data:'],
          objectSrc: ["'none'"], // 禁止object/embed/applet
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"], // 禁止iframe，除非明确需要
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      // 其他安全头部
      noSniff: true, // 防止MIME类型嗅探
      xssFilter: true, // 启用XSS过滤
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // 配置 CORS
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  app.enableCors({
    origin: corsOrigin.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000);
}

bootstrap().catch((err) => {
  Sentry.captureException(err);
  console.error('Failed to bootstrap the application:', err);
  process.exit(1);
});
