// 文件路径: apps/narrative-agent/src/main.ts (已集成Sentry)

import { NestFactory } from '@nestjs/core';
import { NarrativeAgentModule } from './narrative-agent.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Channel } from 'amqplib'; // [核心修正] 导入 Channel 类型
import * as Sentry from '@sentry/node'; // [Sentry] 导入 Sentry

async function bootstrap() {
  // [Sentry] 初始化 Sentry - 先创建临时应用获取配置
  const tempApp = await NestFactory.create(NarrativeAgentModule);
  const configService = tempApp.get(ConfigService);

  Sentry.init({
    dsn: configService.get<string>('SENTRY_DSN'),
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: `agent-narrative-${process.env.NODE_ENV || 'development'}`,
  });

  // 关闭临时应用
  await tempApp.close();

  const rmqUrl = configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
  const RETRY_EXCHANGE = 'narrative_retry_exchange';
  const RETRY_QUEUE = 'narrative_retry_queue';
  const DEAD_LETTER_EXCHANGE = 'dlx';
  const DEAD_LETTER_QUEUE = 'narrative_queue_dead';

  // [Sentry] 使用 try...catch 块包裹整个应用创建和监听过程
  try {
    const app = await NestFactory.create(NarrativeAgentModule);

    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [rmqUrl],
        queue: 'narrative_queue',
        noAck: false,
        queueOptions: {
          durable: false,
          deadLetterExchange: RETRY_EXCHANGE, // 失败时发送到重试交换
          deadLetterRoutingKey: RETRY_QUEUE,
        },
        // [核心修正] 为 channel 参数添加 Channel 类型
        setup: (channel: Channel) => {
          return Promise.all([
            // 创建重试交换和队列 (TTL: 5秒)
            channel.assertExchange(RETRY_EXCHANGE, 'direct', { durable: true }),
            channel.assertQueue(RETRY_QUEUE, {
              durable: true,
              deadLetterExchange: '', // 过期后路由回原始队列
              deadLetterRoutingKey: 'narrative_queue',
              messageTtl: 5000, // 5秒TTL
            }),
            channel.bindQueue(RETRY_QUEUE, RETRY_EXCHANGE, RETRY_QUEUE),

            // 创建死信队列用于最终失败的消息
            channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true }),
            channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true }),
            channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, DEAD_LETTER_QUEUE),
          ]);
        },
      },
    });

    await app.startAllMicroservices();
    console.log('🚀 Narrative Agent is listening for tasks on the event bus...');
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
