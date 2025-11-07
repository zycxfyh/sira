import { Controller, Logger } from '@nestjs/common';
import { Ctx, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { NarrativeService } from './narrative.service';
import * as Sentry from '@sentry/node';

// [核心] 定义“战报”的数据结构
interface LogicCompletePayload {
  gameId: string;
  userId: string;
  playerAction: any;
}

@Controller()
export class NarrativeAgentController {
  private readonly logger = new Logger(NarrativeAgentController.name);

  constructor(private readonly narrativeService: NarrativeService) {}

  // [核心] 监听由 logic-agent 发出的“逻辑已完成”信号
  @MessagePattern('LOGIC_PROCESSING_COMPLETE')
  async handleLogicComplete(@Payload() data: LogicCompletePayload, @Ctx() context: RmqContext) {
    this.logger.log(`Received narrative task for game: ${data.gameId}`);
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    const MAX_RETRIES = 2;

    try {
      // [核心] 将任务交给“大脑”（NarrativeService）处理
      await this.narrativeService.processNarrative(data);
      channel.ack(originalMsg);
      this.logger.log(`Successfully processed narrative task for game: ${data.gameId}`);
    } catch (error) {
      this.logger.error(`Failed to process narrative task for game ${data.gameId}`, error);
      Sentry.captureException(error, { extra: { jobData: data } });

      // [核心改造] 实现延迟重试机制
      const retryCount = (originalMsg.properties.headers['x-death'] || []).length;
      if (retryCount < MAX_RETRIES) {
        // 发送到重试队列，实现延迟重试（5秒后重新处理）
        this.logger.warn(
          `Narrative task for game ${data.gameId} failed. Sending to retry queue (${retryCount + 1}/${MAX_RETRIES + 1})...`,
        );
        channel.nack(originalMsg, false, false); // 触发死信路由到重试队列
      } else {
        // [核心修复] 达到最大重试次数前，确保用户收到失败通知
        try {
          await this.narrativeService.notifyNarrativeFailure(data.userId, data.gameId, error);
        } catch (notifyError) {
          this.logger.error(`Failed to notify user ${data.userId} of narrative failure for game ${data.gameId}`, notifyError);
        }

        // 达到最大重试次数，将消息发送到最终死信队列
        this.logger.error(
          `Narrative task for game ${data.gameId} failed after ${MAX_RETRIES + 1} attempts. Sending to DLQ.`,
        );
        // 手动发送到死信队列
        channel.publish('dlx', 'narrative_queue_dead', originalMsg.content, {
          headers: { ...originalMsg.properties.headers, finalFailure: true }
        });
        channel.ack(originalMsg);
      }
    }
  }
}
