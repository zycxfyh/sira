// 文件路径: packages/common-backend/src/ai/memory-hierarchy.module.ts
// 职责: MemoryHierarchyService 的 NestJS 模块

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryHierarchyService } from './memory-hierarchy.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [MemoryHierarchyService],
  exports: [MemoryHierarchyService],
})
export class MemoryHierarchyModule {}
