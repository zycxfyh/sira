// 文件路径: apps/narrative-agent/src/main.ts (已集成Sentry)

import { NestFactory } from '@nestjs/core';
import { NarrativeAgentModule } from './narrative-agent.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as Sentry from '@sentry/node'; // [Sentry] 导入 Sentry

async function bootstrap() {
  // [Sentry] 初始化 Sentry
  Sentry.init({
    dsn: 'https://2818c3b945a33a13749b3ce539fdb388@o4510229377384448.ingest.us.sentry.io/4510229419851776',
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    // [Sentry] 为此Agent设置一个独特的环境标签
    environment: `agent-narrative-${process.env.NODE_ENV || 'development'}`,
  });

  // [Sentry] 使用 try...catch 块包裹整个应用创建和监听过程
  try {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(NarrativeAgentModule, {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://localhost:5672'], // [注意] 为简化，此处硬编码。可像其他agent一样从ConfigService获取
        queue: 'narrative_queue',
        queueOptions: {
          durable: false,
        },
      },
    });
    await app.listen();
    console.log('🚀 Narrative Agent is listening for tasks...');
  } catch (err) {
    // [Sentry] 如果启动失败，捕获异常并上报
    Sentry.captureException(err);
    console.error('Failed to start Narrative Agent:', err);
    // 确保在启动失败时进程退出
    await Sentry.close(2000).then(() => {
      process.exit(1);
    });
  }
}

// [Sentry] 使用 try...catch 包裹顶层bootstrap调用
bootstrap().catch((err) => {
  Sentry.captureException(err);
  console.error('Unhandled error during bootstrap of Narrative Agent:', err);
  Sentry.close(2000).then(() => {
    process.exit(1);
  });
});
