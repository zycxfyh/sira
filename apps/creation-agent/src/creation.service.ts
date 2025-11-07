// 文件路径: apps/backend/apps/creation-agent/src/creation.service.ts (已修复 unknown 类型)

import { Prisma } from '@prisma/client';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { User } from '@prisma/client';
import { z } from 'zod';
import {
  DynamicAiSchedulerService,
  PrismaService,
  PromptManagerService,
  callAiWithGuard,
  AiGenerationException,
  EventBusService,
  PromptInjectionGuard,
} from '@tuheg/common-backend';

interface GameCreationPayload {
  userId: string;
  concept: string;
}

const architectResponseSchema = z.object({
  gameName: z.string().describe('一个富有想象力的游戏名称'),
  character: z.object({
    name: z.string().describe('角色的名字'),
    card: z.object({
      coreIdentity: z.string().describe('角色的核心身份或概念'),
      personality: z.array(z.string()).describe('描述角色性格的关键词列表'),
      appearance: z.string().describe('角色的外貌描述'),
    }),
  }),
  worldBook: z.array(
    z.object({
      key: z.string().describe('世界书条目的唯一关键字'),
      content: z.object({
        description: z.string().describe('该条目的详细描述'),
      }),
    }),
  ),
});
type ArchitectResponse = z.infer<typeof architectResponseSchema>;

@Injectable()
export class CreationService {
  private readonly logger = new Logger(CreationService.name);

  constructor(
    private readonly scheduler: DynamicAiSchedulerService,
    private readonly prisma: PrismaService,
    private readonly promptManager: PromptManagerService,
    private readonly eventBus: EventBusService,
    private readonly promptInjectionGuard: PromptInjectionGuard,
  ) {}

  public async createNewWorld(payload: GameCreationPayload): Promise<void> {
    const { userId, concept } = payload;
    this.logger.log(`Starting world creation for user ${userId}`);
    const pseudoUser = { id: userId } as User;

    try {
      // [安全修复] 在调用AI之前检查用户输入是否包含提示注入攻击
      await this.promptInjectionGuard.ensureSafeOrThrow(concept, {
        userId: userId,
      });
      const initialWorld = await this.generateInitialWorld(concept, pseudoUser);
      this.logger.log(`AI has generated initial world: "${initialWorld.gameName}"`);

      const newGame = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const game = await tx.game.create({
          data: {
            name: initialWorld.gameName,
            ownerId: userId,
          },
        });

        await tx.character.create({
          data: {
            gameId: game.id,
            name: initialWorld.character.name,
            card: initialWorld.character.card,
          },
        });

        if (initialWorld.worldBook?.length > 0) {
          await tx.worldBookEntry.createMany({
            data: initialWorld.worldBook.map((entry) => ({
              gameId: game.id,
              key: entry.key,
              content: entry.content,
            })),
          });
        }
        return game;
      });
      this.logger.log(`New game with ID ${newGame.id} successfully saved to database.`);

      this.eventBus.publish('NOTIFY_USER', {
        userId: userId,
        event: 'creation_completed',
        data: {
          message: `New world "${newGame.name}" created successfully.`,
          gameId: newGame.id,
        },
      });
    } catch (error: unknown) {
      // <-- [核心修正] 明确 error 类型为 unknown
      let errorMessage = 'An unknown error occurred during world creation';
      // [核心修正] 类型检查
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.logger.error(
        `Failed to create world for user ${userId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        error instanceof AiGenerationException ? error.details : undefined,
      );

      try {
        await this.eventBus.publish('NOTIFY_USER', {
          userId: userId,
          event: 'creation_failed',
          data: {
            message: 'Failed to create new world.',
            error: errorMessage,
          },
        });
      } catch (eventBusError) {
        this.logger.error(
          'CRITICAL: Failed to even send the creation failure message via event bus.',
          eventBusError,
        );
      }

      // 重新抛出异常以保持测试兼容性
      throw error;
    }
  }

  /**
   * 专门用于在所有重试都失败后的最终失败通知
   * 这个方法确保即使消息被发送到DLQ，用户也能收到失败通知
   */
  public async notifyCreationFailure(userId: string, error: unknown): Promise<void> {
    let errorMessage = 'An unknown error occurred during world creation';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    try {
      await this.eventBus.publish('NOTIFY_USER', {
        userId: userId,
        event: 'creation_failed',
        data: {
          message: 'Failed to create new world after all retry attempts.',
          error: errorMessage,
          finalFailure: true, // 标记这是最终失败，不再重试
        },
      });
      this.logger.log(`Sent final creation failure notification to user ${userId}`);
    } catch (eventBusError) {
      this.logger.error(
        `CRITICAL: Failed to send final creation failure notification to user ${userId}`,
        eventBusError,
      );
    }
  }

  private async generateInitialWorld(concept: string, user: User): Promise<ArchitectResponse> {
    const provider = await this.scheduler.getProviderForRole(user, 'narrative_synthesis');
    const parser = StructuredOutputParser.fromZodSchema(architectResponseSchema);
    const systemPrompt = this.promptManager.getPrompt('00_persona_and_framework.md');

    const prompt = new PromptTemplate({
      template: `{system_prompt}\n# 创世任务指令\n根据以下用户概念，为一次新的游戏人生生成初始设定。\n{format_instructions}\n---\n用户概念: "{concept}"`,
      inputVariables: ['concept', 'system_prompt'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const chain = prompt.pipe(provider.model).pipe(parser);

    try {
      const response = await callAiWithGuard(
        chain,
        {
          concept,
          system_prompt: systemPrompt,
        },
        architectResponseSchema,
      );
      return response;
    } catch (error: unknown) {
      // <-- [核心修正] 明确 error 类型为 unknown
      const errorMessage = error instanceof Error ? error.message : 'Unknown AI error';
      this.logger.error(
        `AI generation failed inside generateInitialWorld: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        `AI failed to generate initial world: ${errorMessage}`,
      );
    }
  }
}
