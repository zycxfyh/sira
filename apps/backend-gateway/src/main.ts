// 文件路径: apps/nexus-engine/src/main.ts (已集成 Redis Adapter)

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';
import { ConfigService } from '@nestjs/config'; // [!] 核心改造：导入 ConfigService
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter'; // [!] 核心改造：导入 Redis 适配器
import { createClient } from 'redis'; // [!] 核心改造：导入 Redis 客户端

// [!] 核心改造：创建一个自定义的 Socket.IO 适配器类
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  constructor(app, private readonly configService: ConfigService) {
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

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}


async function bootstrap() {
  Sentry.init({
    dsn: 'https://2818c3b945a33a13749b3ce539fdb388@o4510229377384448.ingest.us.sentry.io/4510229419851776',
    tracesSampleRate: 1.0, 
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
  });
  const app = await NestFactory.create(AppModule);

  // [!] 核心改造：设置并连接 Redis 适配器
  const configService = app.get(ConfigService);
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);


  app.enableCors({
    origin: 'http://localhost:5173',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  await app.listen(3000);
}

bootstrap().catch((err) => {
  Sentry.captureException(err);
  console.error('Failed to bootstrap the application:', err);
  process.exit(1);
});