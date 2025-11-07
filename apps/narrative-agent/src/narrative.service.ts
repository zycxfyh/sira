// 文件路径: apps/narrative-agent/src/narrative.service.ts (已优化 AI 调用链)

import { Injectable, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { User } from '@prisma/client';
import { z } from 'zod';

import {
  DynamicAiSchedulerService,
  PrismaService,
  LogicCompletePayload,
  PromptManagerService,
  callAiWithGuard,
  AiGenerationException,
  PromptInjectionGuard,
  PromptInjectionDetectedException,
  EventBusService,
} from '@tuheg/common-backend';

// --- Zod Schemas for AI I/O ---

// [!] 核心改造：合并 Synthesizer 和 Critic 的 Schema，因为它们的最终输出结构是一样的。
const progressionResponseSchema = z.object({
  narrative: z.string().describe('对玩家行动结果的生动叙事描述'),
  options: z
    .array(
      z.object({
        dimension: z.string(),
        check: z.string(),
        success_rate: z.string(),
        text: z.string(),
      }),
    )
    .nullable(),
});
type ProgressionResponse = z.infer<typeof progressionResponseSchema>;

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);

  constructor(
    private readonly scheduler: DynamicAiSchedulerService,
    private readonly prisma: PrismaService,
    private readonly promptManager: PromptManagerService,
    private readonly eventBus: EventBusService,
    private readonly promptInjectionGuard: PromptInjectionGuard,
  ) {}

  public async processNarrative(payload: LogicCompletePayload): Promise<void> {
    this.logger.log(`Processing narrative for game ${payload.gameId}`);
    const pseudoUser = { id: payload.userId } as User;

    try {
      // Security check: Validate input against prompt injection
      const securityCheck = await this.promptInjectionGuard.checkInput(
        JSON.stringify(payload.playerAction),
        {
          userId: payload.userId,
        },
      );

      if (!securityCheck.allowed) {
        throw new PromptInjectionDetectedException('Input failed security validation', {
          score: securityCheck.score,
          threshold: securityCheck.threshold,
          preview: securityCheck.inputPreview,
        });
      }

      const gameState = await this.prisma.game.findUniqueOrThrow({
        where: { id: payload.gameId },
        include: { character: true, worldBook: true },
      });

      // [!] 核心改造：默认流程简化为单次 AI 调用
      // 我们直接调用“叙事合成器”，并相信它在大多数情况下能产出足够好的结果。
      const finalProgression = await this.synthesizeNarrative(
        gameState,
        payload.playerAction,
        pseudoUser,
      );
      this.logger.log(`[Synthesizer] Generated final progression for game ${payload.gameId}.`);

      // [!] 核心改造：注释掉并保留审查家（Critic）的调用逻辑，以备将来使用。
      // 未来的优化可以在这里加入一个判断逻辑，例如：
      // if (this.needsCriticReview(finalProgression, gameState)) {
      //   this.logger.log(`[Critic] Draft requires review. Engaging Critic Agent...`);
      //   finalProgression = await this.reviewWithCritic(...);
      // }

      // const draft = await this.synthesizeNarrative(
      //   gameState,
      //   payload.playerAction,
      //   pseudoUser,
      // );
      // this.logger.log(`[Synthesizer] Generated draft for game ${payload.gameId}.`);
      // const finalProgression = await this.reviewWithCritic(
      //   gameState,
      //   payload.playerAction,
      //   draft,
      //   pseudoUser,
      // );
      // this.logger.log(`[Critic] Reviewed and finalized progression for game ${payload.gameId}.`);

      // 发送最终结果的逻辑保持不变
      await this.eventBus.publish('NOTIFY_USER', {
        userId: payload.userId,
        event: 'processing_completed',
        data: {
          message: 'AI response received.',
          progression: finalProgression,
        },
      });
      this.logger.log(`Successfully sent final narrative to user ${payload.userId} via event bus.`);
    } catch (error: unknown) {
      let errorMessage = 'An unknown error occurred in narrative processing';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(
        `Failed to process narrative for game ${payload.gameId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        error instanceof AiGenerationException ? error.details : undefined,
      );
      try {
        await this.eventBus.publish('NOTIFY_USER', {
          userId: payload.userId,
          event: 'processing_failed',
          data: {
            message: 'An error occurred during narrative generation.',
            error: errorMessage,
          },
        });
      } catch (eventBusError) {
        this.logger.error(
          'CRITICAL: Failed to even send the error message via event bus.',
          eventBusError,
        );
      }
    }
  }

  /**
   * 专门用于在所有重试都失败后的最终失败通知
   * 这个方法确保即使消息被发送到DLQ，用户也能收到失败通知
   */
  public async notifyNarrativeFailure(
    userId: string,
    gameId: string,
    error: unknown,
  ): Promise<void> {
    let errorMessage = 'An unknown error occurred during narrative processing';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    try {
      await this.eventBus.publish('NOTIFY_USER', {
        userId: userId,
        event: 'processing_failed',
        data: {
          message: 'Failed to process narrative after all retry attempts.',
          error: errorMessage,
          gameId: gameId,
          finalFailure: true, // 标记这是最终失败，不再重试
        },
      });
      this.logger.log(
        `Sent final narrative failure notification to user ${userId} for game ${gameId}`,
      );
    } catch (eventBusError) {
      this.logger.error(
        `CRITICAL: Failed to send final narrative failure notification to user ${userId} for game ${gameId}`,
        eventBusError,
      );
    }
  }

  // --- AI Agent Methods ---

  /**
   * 叙事合成器 (Synthesizer)
   * [!] 核心改造：此方法现在负责直接生成最终结果。
   */
  private async synthesizeNarrative(
    currentState: object,
    playerAction: unknown,
    user: User,
  ): Promise<ProgressionResponse> {
    const provider = await this.scheduler.getProviderForRole(user, 'narrative_synthesis');
    const parser = StructuredOutputParser.fromZodSchema(progressionResponseSchema);
    // [!] 核心改造：我们现在使用一个更全面的 Prompt，期望它能一步到位产出高质量内容。
    // 在旧代码中，这里使用的是 '00_persona_and_framework.md'，现在改为 '02_narrative_engine.md'
    const systemPrompt = this.promptManager.getPrompt('02_narrative_engine.md');

    const prompt = new PromptTemplate({
      template: `{system_prompt}\n# 渲染任务\n你的任务是根据世界状态和玩家行动，生成一段叙事和后续选项。\n{format_instructions}\n---\n当前世界状态:\n\`\`\`json\n{currentState}\n\`\`\`\n---\n玩家行动:\n\`\`\`json\n{playerAction}\n\`\`\``,
      inputVariables: ['currentState', 'playerAction', 'system_prompt'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const chain = prompt.pipe(provider.model).pipe(parser);

    return callAiWithGuard(
      chain,
      {
        currentState: JSON.stringify(currentState),
        playerAction: JSON.stringify(playerAction),
        system_prompt: systemPrompt,
      },
      progressionResponseSchema,
    );
  }
}
