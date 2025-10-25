// 文件路径: apps/backend/apps/logic-agent/src/main.ts (已修复类型)

import { NestFactory } from '@nestjs/core';
import { LogicAgentModule } from './logic-agent.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';
import { Channel } from 'amqplib'; // <-- [核心修正] 导入 Channel 类型

async function bootstrap() {
  Sentry.init({
    dsn: 'https://2818c3b945a33a13749b3ce539fdb388@o4510229377384448.ingest.us.sentry.io/4510229419851776',
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: `agent-logic-${process.env.NODE_ENV || 'development'}`,
  });

  const app = await NestFactory.create(LogicAgentModule);

  const configService = app.get(ConfigService);
  const rmqUrl = configService.get<string>(
    'RABBITMQ_URL',
    'amqp://localhost:5672',
  );

  const DEAD_LETTER_EXCHANGE = 'dlx';
  const DEAD_LETTER_QUEUE = 'logic_queue_dead';

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rmqUrl],
      queue: 'logic_queue',
      noAck: false,
      queueOptions: {
        durable: false,
        deadLetterExchange: DEAD_LETTER_EXCHANGE,
        deadLetterRoutingKey: DEAD_LETTER_QUEUE,
      },
      // [核心修正] 为 channel 参数添加 Channel 类型
      setup: (channel: Channel) => {
        return Promise.all([
          channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', { durable: true }),
          channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true }),
          channel.bindQueue(DEAD_LETTER_QUEUE, DEAD_LETTER_EXCHANGE, DEAD_LETTER_QUEUE),
        ]);
      },
    },
  });

  try {
    await app.startAllMicroservices();
    console.log('🚀 Logic Agent is listening for tasks on the event bus...');
  } catch (err) {
    Sentry.captureException(err);
    console.error('Failed to start Logic Agent:', err);
    await Sentry.close(2000).then(() => {
      process.exit(1);
    });
  }
}

bootstrap().catch((err) => {
  Sentry.captureException(err);
  console.error('Unhandled error during bootstrap of Logic Agent:', err);
  Sentry.close(2000).then(() => {
    process.exit(1);
  });
});