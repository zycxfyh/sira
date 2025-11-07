// 文件路径: apps/creation-agent/src/main.ts (已集成Sentry)

import { NestFactory } from '@nestjs/core';
import { CreationAgentModule } from './creation-agent.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Channel } from 'amqplib'; // [核心修正] 导入 Channel 类型
import * as Sentry from '@sentry/node'; // [Sentry] 导入 Sentry

async function bootstrap() {
  const app = await NestFactory.create(CreationAgentModule);
  const configService = app.get(ConfigService);

  // [Sentry] 初始化 Sentry
  Sentry.init({
    dsn: configService.get<string>('SENTRY_DSN'),
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    // [Sentry] 为此Agent设置一个独特的环境标签
    environment: `agent-creation-${process.env.NODE_ENV || 'development'}`,
  });

  const rmqUrl = configService.get<string>(
    'RABBITMQ_URL', // [修正] 确保环境变量名称与您的.env文件一致，通常是RABBITMQ_URL
    'amqp://localhost:5672',
  );

  const RETRY_EXCHANGE = 'creation_retry_exchange';
  const RETRY_QUEUE = 'creation_retry_queue';
  const DEAD_LETTER_EXCHANGE = 'dlx';
  const DEAD_LETTER_QUEUE = 'creation_queue_dead';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: 'creation_queue',
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
            deadLetterRoutingKey: 'creation_queue',
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
