// 文件路径: libs/common/src/ai/dynamic-ai-scheduler.service.ts

import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, AiConfiguration } from '@prisma/client';

// [核心修正] 放弃所有相对路径，统一使用 @app/common 绝对路径别名
import type { AiProvider, AiRole } from '../types/ai-providers.types';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderFactory } from './ai-provider.factory';

@Injectable()
export class DynamicAiSchedulerService {
  private readonly logger = new Logger(DynamicAiSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  public async getProviderForRole(
    user: User,
    role: AiRole,
  ): Promise<AiProvider> {
    this.logger.debug(
      `[Scheduler] New request for role: "${role}" from user ${user.id}`,
    );

    // 优先级 1: 查找用户为该能力（role）明确指派的AI
    const dedicatedConfig = await this.prisma.aiConfiguration.findFirst({
      where: {
        ownerId: user.id,
        assignedRoles: {
          contains: role,
        },
      },
    });

    if (dedicatedConfig) {
      this.logger.log(
        `[Scheduler] Priority 1 (Dedicated): Found dedicated config "${dedicatedConfig.provider}/${dedicatedConfig.modelId}" for role "${role}".`,
      );
      return this.aiProviderFactory.createProvider(dedicatedConfig);
    }
    this.logger.debug(
      `[Scheduler] Priority 1 (Dedicated): No dedicated AI found for role "${role}".`,
    );

    // 优先级 2: 如果没有，则征用用户配置的任何其他可用AI
    const anyUserConfig = await this.prisma.aiConfiguration.findFirst({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'asc' },
    });

    if (anyUserConfig) {
      this.logger.log(
        `[Scheduler] Priority 2 (Requisition): Requisitioning general-purpose AI "${anyUserConfig.provider}/${anyUserConfig.modelId}" for role "${role}".`,
      );
      return this.aiProviderFactory.createProvider(anyUserConfig);
    }
    this.logger.debug(
      `[Scheduler] Priority 2 (Requisition): User has no AI configurations at all.`,
    );

    // 优先级 3: 如果用户一个AI都没配置，才启用系统后备AI
    this.logger.warn(
      `[Scheduler] Priority 3 (System Fallback): Falling back to system default AI for role "${role}".`,
    );
    try {
      return this.createFallbackProvider();
    } catch (error) {
      this.logger.error(
        `[Scheduler] CRITICAL FAILURE: System fallback AI failed to initialize.`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        'AI processing failed: No AI is available or configured correctly.',
      );
    }
  }

  private createFallbackProvider(): AiProvider {
    try {
      const apiKey = this.configService.getOrThrow<string>('FALLBACK_API_KEY');
      const modelId = this.configService.get<string>(
        'FALLBACK_MODEL_ID',
        'deepseek-chat',
      );
      const baseUrlFromEnv =
        this.configService.get<string>('FALLBACK_BASE_URL');

      const fallbackConfig: AiConfiguration = {
        id: 'system-fallback',
        provider: 'DeepSeek',
        apiKey,
        baseUrl: baseUrlFromEnv ?? null,
        modelId,
        assignedRoles: 'system-default',
        ownerId: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return this.aiProviderFactory.createProvider(fallbackConfig);
    } catch (error) {
      this.logger.error(
        'System fallback AI configuration is missing or invalid. Check your .env file for FALLBACK_... variables.',
      );
      throw new Error('System default AI is not configured.');
    }
  }
}
