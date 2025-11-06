import { Controller } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { NarrativeService } from './narrative.service';

// [核心] 定义“战报”的数据结构
interface LogicCompletePayload {
  gameId: string;
  userId: string;
  playerAction: any;
}

@Controller()
export class NarrativeAgentController {
  constructor(private readonly narrativeService: NarrativeService) {}

  // [核心] 监听由 logic-agent 发出的“逻辑已完成”信号
  @MessagePattern('LOGIC_PROCESSING_COMPLETE')
  async handleLogicComplete(@Payload() data: LogicCompletePayload, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      // [核心] 将任务交给“大脑”（NarrativeService）处理
      await this.narrativeService.processNarrative(data);
      channel.ack(originalMsg);
    } catch (error) {
      console.error('Failed to process narrative task:', error);
      channel.nack(originalMsg);
    }
  }
}
