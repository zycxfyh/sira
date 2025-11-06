// 文件路径: packages/common-backend/src/ai/context-summarizer.module.ts
// 职责: ContextSummarizerService 的 NestJS 模块

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AiProviderFactory } from './ai-provider.factory';
import { ContextSummarizerService } from './context-summarizer.service';
import { DynamicAiSchedulerService } from './dynamic-ai-scheduler.service';
import { VectorSearchModule } from './vector-search.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    VectorSearchModule,
    // [注意] MemoryHierarchyModule 由调用方导入，不在这里导入以避免循环依赖
  ],
  providers: [ContextSummarizerService, DynamicAiSchedulerService, AiProviderFactory],
  exports: [ContextSummarizerService],
})
export class ContextSummarizerModule {}
