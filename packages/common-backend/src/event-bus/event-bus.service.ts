// 文件路径: libs/common/src/event-bus/event-bus.service.ts

import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NEXUS_EVENT_BUS } from './event-bus.module';

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  // [核心] 注入我们刚刚在module里定义的“信号发射器”
  constructor(@Inject(NEXUS_EVENT_BUS) private readonly client: ClientProxy) {}

  // [核心] 在模块初始化时，确保与 RabbitMQ 的连接已建立
  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Successfully connected to the RabbitMQ event bus.');
    } catch (error) {
      this.logger.error('Failed to connect to the RabbitMQ event bus.', error);
    }
  }

  /**
   * @method publish
   * @description 向宇宙广播一个事件
   * @param eventName - 事件的“暗号”，例如 'PLAYER_ACTION_SUBMITTED'
   * @param data - 要广播的具体信息
   */
  publish(eventName: string, data: any) {
    this.logger.log(`Publishing event "${eventName}" to the event bus.`);
    // [核心] client.emit() 用于“发射后不管”的事件广播。
    // 它会将事件名作为路由键，将数据作为消息体，发送到 RabbitMQ。
    this.client.emit(eventName, data);
  }
}
