// 文件路径: packages/common-backend/src/ai/dynamic-ai-scheduler.service.ts

import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, AiConfiguration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderFactory } from './ai-provider.factory';
import type { AiProvider, AiRole } from '../types/ai-providers.types';

@Injectable()
export class DynamicAiSchedulerService {
  private readonly logger = new Logger(DynamicAiSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  public async getProviderForRole(user: User, role: AiRole): Promise<AiProvider> {
    this.logger.debug(`[Scheduler] New request for role: "${role}" from user ${user.id}`);

    // [!] 核心改造 1: 查询逻辑翻译
    // 我们不再查询一个字符串数组，而是查询一个关系。
    // 我们要找的是：一个 AiConfiguration，它的 'roles' 关系中，
    // 'some' (至少有一个) Role 的 'name' 字段等于我们想要的 'role'。
    const dedicatedConfig = await this.prisma.aiConfiguration.findFirst({
      where: {
        ownerId: user.id,
        roles: {
          some: {
            name: role, // 这就是新的、正确的 Prisma 关系查询语法
          },
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

    // 优先级 2: 征用逻辑保持不变
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

    // 优先级 3: 后备逻辑保持不变，但模拟对象结构需要改变
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
      const modelId = this.configService.get<string>('FALLBACK_MODEL_ID', 'deepseek-chat');
      const baseUrlFromEnv = this.configService.get<string>('FALLBACK_BASE_URL');

      // [!] 核心改造 2: 模拟对象结构翻译
      // 新的 AiConfiguration 类型没有 `assignedRoles` 字段。
      // 我们创建一个不包含任何角色信息的、纯粹的配置对象。
      // 注意：这个模拟对象缺少 'roles' 属性，所以我们需要告诉 TypeScript
      // 它符合 AiConfiguration 的形状（通过类型断言 as AiConfiguration）。
      const fallbackConfig = {
        id: 'system-fallback',
        provider: 'DeepSeek',
        apiKey,
        baseUrl: baseUrlFromEnv ?? null,
        modelId,
        ownerId: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AiConfiguration; // 类型断言，表示我们确信这个对象的结构是兼容的

      return this.aiProviderFactory.createProvider(fallbackConfig);
    } catch (error) {
      this.logger.error(
        'System fallback AI configuration is missing or invalid. Check your .env file for FALLBACK_... variables.',
      );
      throw new Error('System default AI is not configured.');
    }
  }
}
