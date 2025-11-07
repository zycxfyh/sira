// 文件路径: apps/backend/apps/logic-agent/src/logic.service.ts (已重构)

import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { User } from '@prisma/client';
import { RuleEngineService } from './rule-engine.service';

import {
  DynamicAiSchedulerService,
  EventBusService,
  GameActionJobData,
  DirectiveSet,
  directiveSetSchema,
  PromptManagerService,
  callAiWithGuard, // <-- 导入护栏函数
  AiGenerationException, // <-- 导入自定义异常
  PromptInjectionGuard, // <-- 导入提示注入防护
} from '@tuheg/common-backend';

@Injectable()
export class LogicService {
  private readonly logger = new Logger(LogicService.name);

  constructor(
    private readonly scheduler: DynamicAiSchedulerService,
    private readonly ruleEngine: RuleEngineService,
    private readonly eventBus: EventBusService,
    private readonly promptManager: PromptManagerService,
    private readonly promptInjectionGuard: PromptInjectionGuard,
  ) {}

  public async processLogic(jobData: GameActionJobData): Promise<void> {
    this.logger.log(`Processing logic for game ${jobData.gameId}`);
    const pseudoUser = { id: jobData.userId } as User;
    const directives = await this.generateDirectives(jobData, pseudoUser);
    this.logger.log(`Generated ${directives.length} directives for game ${jobData.gameId}.`);
    await this.ruleEngine.execute(jobData.gameId, directives);
    this.logger.log(`Directives executed for game ${jobData.gameId}.`);
    this.eventBus.publish('LOGIC_PROCESSING_COMPLETE', {
      gameId: jobData.gameId,
      userId: jobData.userId,
      playerAction: jobData.playerAction,
    });
    this.logger.log(`Published LOGIC_PROCESSING_COMPLETE for game ${jobData.gameId}.`);
  }

  protected async generateDirectives(
    jobData: GameActionJobData,
    user: User,
  ): Promise<DirectiveSet> {
    try {
      // [安全修复] 在调用AI之前检查输入是否包含提示注入攻击
      const securityCheck = await this.promptInjectionGuard.checkInput(
        JSON.stringify(jobData.playerAction),
        {
          userId: jobData.userId,
          correlationId: jobData.correlationId,
        },
      );

      if (!securityCheck.allowed) {
        throw new BadRequestException(`Input failed security validation: ${securityCheck.reason}`);
      }

      const provider = await this.scheduler.getProviderForRole(user, 'logic_parsing');
      const parser = StructuredOutputParser.fromZodSchema(directiveSetSchema);
      const systemPrompt = this.promptManager.getPrompt('01_logic_engine.md');

      const prompt = new PromptTemplate({
        template: `{system_prompt}\n# 推理任务\n{format_instructions}\n---\n当前世界状态:\n\`\`\`json\n{game_state}\n\`\`\`\n---\n玩家行动:\n\`\`\`json\n{player_action}\n\`\`\``,
        inputVariables: ['game_state', 'player_action', 'system_prompt'],
        partialVariables: {
          format_instructions: parser.getFormatInstructions(),
        },
      });

      const chain = prompt.pipe(provider.model).pipe(parser);

      // [核心改造] 使用护栏函数替换直接调用
      const response = await callAiWithGuard(
        chain,
        {
          game_state: JSON.stringify(jobData.gameStateSnapshot),
          player_action: JSON.stringify(jobData.playerAction),
          system_prompt: systemPrompt,
        },
        directiveSetSchema,
      );

      return response;
    } catch (error: unknown) {
      // 如果是BadRequestException（如提示注入检查失败），直接重新抛出
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage =
        error instanceof AiGenerationException
          ? 'AI Guard: Failed to generate valid directives.'
          : 'An unknown error occurred during directive generation.';

      this.logger.error(
        `LogicAI Error on game ${jobData.gameId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        error instanceof AiGenerationException ? error.details : undefined,
      );
      throw new InternalServerErrorException(
        `LogicAI failed to generate directives: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}
