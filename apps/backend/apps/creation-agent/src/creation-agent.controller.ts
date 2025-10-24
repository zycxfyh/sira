// 文件路径: apps/creation-agent/src/creation-agent.controller.ts

import { Controller, Logger } from '@nestjs/common';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { CreationService } from './creation.service';

// [核心] 定义创世任务的数据结构
interface GameCreationPayload {
  userId: string;
  // [注释] 'concept' 是从前端 CreateNarrativeGameDto 传递过来的
  concept: string;
}

@Controller()
export class CreationAgentController {
  private readonly logger = new Logger(CreationAgentController.name);

  constructor(private readonly creationService: CreationService) {}

  // [核心] 监听由主网关 (nexus-engine) 发出的“请求创建游戏”信号
  @MessagePattern('GAME_CREATION_REQUESTED')
  async handleGameCreation(
    @Payload() data: GameCreationPayload,
    @Ctx() context: RmqContext,
  ) {
    this.logger.log(`Received game creation request for user: ${data.userId}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      // 将任务交给“大脑”（CreationService）处理
      await this.creationService.createNewWorld(data);
      // 任务处理成功，确认消息
      channel.ack(originalMsg);
      this.logger.log(`Successfully processed creation task for user: ${data.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process creation task for user ${data.userId}`,
        error,
      );
      // [注释] 同样，暂时只确认消息以避免重试循环
      channel.ack(originalMsg);
    }
  }
}