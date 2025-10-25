// 文件路径: apps/backend/apps/logic-agent/src/logic-agent.controller.ts (已更新错误处理)

import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { LogicService } from './logic.service';
import { GameActionJobData } from '@tuheg/common-backend';
import * as Sentry from '@sentry/node';

@Controller()
export class LogicAgentController {
  private readonly logger = new Logger(LogicAgentController.name);

  constructor(private readonly logicService: LogicService) {}

  @MessagePattern('PLAYER_ACTION_SUBMITTED')
  async handlePlayerAction(
    @Payload() data: GameActionJobData,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(`Received task for game: ${data.gameId}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const MAX_RETRIES = 2;

    try {
      await this.logicService.processLogic(data);
      // 任务处理成功，确认消息
      channel.ack(originalMsg);
      this.logger.log(
        `Successfully processed and ACKed task for game: ${data.gameId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process logic task for game ${data.gameId}`,
        error,
      );
      Sentry.captureException(error, { extra: { jobData: data } });

      // [核心改造] 实现带重试次数的 NACK 逻辑
      const retryCount = (originalMsg.properties.headers['x-death'] || []).length;
      if (retryCount < MAX_RETRIES) {
        // requeue: true 将消息放回队列头部，等待下次处理
        this.logger.warn(`Task for game ${data.gameId} failed. Retrying (${retryCount + 1}/${MAX_RETRIES + 1})...`);
        channel.nack(originalMsg, false, true);
      } else {
        // 达到最大重试次数，将消息发送到死信队列
        this.logger.error(`Task for game ${data.gameId} failed after ${MAX_RETRIES + 1} attempts. Sending to DLQ.`);
        // requeue: false 将导致消息被 RabbitMQ 路由到配置的 DLX
        channel.nack(originalMsg, false, false);
      }
    }
  }
}