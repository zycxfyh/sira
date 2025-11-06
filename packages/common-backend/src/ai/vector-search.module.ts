// 文件路径: packages/common-backend/src/ai/vector-search.module.ts
// 职责: VectorSearchService 的 NestJS 模块

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { AiProviderFactory } from "./ai-provider.factory";
import { DynamicAiSchedulerService } from "./dynamic-ai-scheduler.service";
import { VectorSearchService } from "./vector-search.service";

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    VectorSearchService,
    DynamicAiSchedulerService,
    AiProviderFactory,
  ],
  exports: [VectorSearchService],
})
export class VectorSearchModule {}
