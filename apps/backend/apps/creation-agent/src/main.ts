// 文件路径: apps/creation-agent/src/main.ts (已集成Sentry)

import { NestFactory } from '@nestjs/core';
import { CreationAgentModule } from './creation-agent.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node'; // [Sentry] 导入 Sentry

async function bootstrap() {
  // [Sentry] 初始化 Sentry
  Sentry.init({
    dsn: 'https://2818c3b945a33a13749b3ce539fdb388@o4510229377384448.ingest.us.sentry.io/4510229419851776',
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    // [Sentry] 为此Agent设置一个独特的环境标签
    environment: `agent-creation-${process.env.NODE_ENV || 'development'}`,
  });

  const app = await NestFactory.create(CreationAgentModule);

  const configService = app.get(ConfigService);
  const rmqUrl = configService.get<string>(
    'RABBITMQ_URL', // [修正] 确保环境变量名称与您的.env文件一致，通常是RABBITMQ_URL
    'amqp://localhost:5672',
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: 'creation_queue',
      queueOptions: {
        durable: false,
      },
      noAck: false,
    },
  });

  // [Sentry] 使用 try...catch 块包裹启动过程
  try {
    await app.startAllMicroservices();
    console.log('🚀 Creation Agent is listening for tasks on the event bus...');
  } catch (err) {
    // [Sentry] 如果启动失败，捕获异常并上报
    Sentry.captureException(err);
    console.error('Failed to start Creation Agent:', err);
    // 确保在启动失败时进程退出
    await Sentry.close(2000).then(() => {
      process.exit(1);
    });
  }
}

// [Sentry] 使用 try...catch 包裹顶层bootstrap调用
bootstrap().catch((err) => {
  Sentry.captureException(err);
  console.error('Unhandled error during bootstrap of Creation Agent:', err);
  Sentry.close(2000).then(() => {
    process.exit(1);
  });
});