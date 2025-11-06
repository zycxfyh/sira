// 文件路径: libs/common/src/event-bus/event-bus.module.ts (自包含最终版)

import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventBusService } from './event-bus.service';

export const NEXUS_EVENT_BUS = 'NEXUS_EVENT_BUS';

@Module({
  imports: [
    // [核心] 在模块内部导入 ClientsModule，为本模块提供 ClientProxy 的创建能力
    ClientsModule.registerAsync([
      {
        name: NEXUS_EVENT_BUS,
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672')],
            queue: 'nexus_gateway_queue',
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [EventBusService],
  // [核心] 将 EventBusService 导出，以便其他模块可以使用它
  exports: [EventBusService],
})
export class EventBusModule {}
