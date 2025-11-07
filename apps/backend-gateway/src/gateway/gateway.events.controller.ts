// 文件路径: apps/backend-gateway/src/gateway/gateway.events.controller.ts
// 描述: 事件驱动的网关控制器，用于监听来自 Agent 服务的通知事件

import { Controller, Logger } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { UpdatesGateway } from './updates.gateway';

interface NotifyUserEvent {
  userId: string;
  event: string;
  data: unknown;
}

@Controller()
export class GatewayEventsController {
  private readonly logger = new Logger(GatewayEventsController.name);

  constructor(private readonly updatesGateway: UpdatesGateway) {}

  @MessagePattern('NOTIFY_USER')
  async handleNotifyUser(data: NotifyUserEvent): Promise<void> {
    this.logger.log(`Received NOTIFY_USER event for user ${data.userId}: ${data.event}`);

    try {
      await this.updatesGateway.sendToUser(data.userId, data.event, data.data);
      this.logger.log(`Successfully sent ${data.event} to user ${data.userId} via WebSocket`);
    } catch (error) {
      this.logger.error(`Failed to send ${data.event} to user ${data.userId}`, error);
      throw error;
    }
  }
}
