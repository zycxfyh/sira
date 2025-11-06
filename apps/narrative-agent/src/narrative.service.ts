// 文件路径: apps/narrative-agent/src/narrative.service.ts (已优化 AI 调用链)

import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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
  private readonly GATEWAY_URL =
    process.env.GATEWAY_URL || 'http://nexus-engine:3000/gateway/send-to-user';

  constructor(
    private readonly scheduler: DynamicAiSchedulerService,
    private readonly prisma: PrismaService,
    private readonly promptManager: PromptManagerService,
    private readonly httpService: HttpService,
  ) {}

  public async processNarrative(payload: LogicCompletePayload): Promise<void> {
    this.logger.log(`Processing narrative for game ${payload.gameId}`);
    const pseudoUser = { id: payload.userId } as User;

    try {
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
      await firstValueFrom(
        this.httpService.post(this.GATEWAY_URL, {
          userId: payload.userId,
          event: 'processing_completed',
          data: {
            message: 'AI response received.',
            progression: finalProgression,
          },
        }),
      );
      this.logger.log(
        `Successfully sent final narrative to user ${payload.userId} via gateway.`,
      );
    } catch (error: unknown) {
      let errorMessage = 'An unknown error occurred in narrative processing';
      if (error instanceof Error) { errorMessage = error.message; }
      this.logger.error(
        `Failed to process narrative for game ${payload.gameId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        error instanceof AiGenerationException ? error.details : undefined,
      );
      try {
        await firstValueFrom(
          this.httpService.post(this.GATEWAY_URL, {
            userId: payload.userId,
            event: 'processing_failed',
            data: { message: 'An error occurred during narrative generation.', error: errorMessage },
          }),
        );
      } catch (gatewayError) {
        this.logger.error('CRITICAL: Failed to even send the error message via gateway.', gatewayError);
      }
    }
  }

  // --- AI Agent Methods ---

  /**
   * 叙事合成器 (Synthesizer)
   * [!] 核心改造：此方法现在负责直接生成最终结果。
   */
  private async synthesizeNarrative(
    currentState: object,
    playerAction: any,
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

    return callAiWithGuard(chain, {
      currentState: JSON.stringify(currentState),
      playerAction: JSON.stringify(playerAction),
      system_prompt: systemPrompt,
    }, progressionResponseSchema as any);
  }

  /**
   * 审查家 (Critic) - [!] 核心改造：此方法被保留，但当前工作流中未被调用
   * 接收一份初稿，并返回优化后的版本。
   */
  private async reviewWithCritic(
    worldState: object,
    playerAction: any,
    draft: ProgressionResponse,
    user: User,
  ): Promise<ProgressionResponse> {
    const provider = await this.scheduler.getProviderForRole(user, 'critic');
    const parser = StructuredOutputParser.fromZodSchema(progressionResponseSchema);
    const systemPrompt = this.promptManager.getPrompt('03_critic_agent.md'); 

    const prompt = new PromptTemplate({
      template: `{system_prompt}\n# 审查任务\n{format_instructions}\n---\n世界状态:\n\`\`\`json\n{world_state}\n\`\`\`\n---\n玩家行动:\n\`\`\`json\n{player_action}\n\`\`\`\n---\n待审查的初稿:\n\`\`\`json\n{draft}\n\`\`\``,
      inputVariables: ['world_state', 'player_action', 'draft', 'system_prompt'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const chain = prompt.pipe(provider.model).pipe(parser);

    return callAiWithGuard(chain, {
      world_state: JSON.stringify(worldState),
      player_action: JSON.stringify(playerAction),
      draft: JSON.stringify(draft),
      system_prompt: systemPrompt,
    }, progressionResponseSchema as any);
  }
}