// 文件路径: packages/common-backend/src/schedule/schedule.module.ts
// 核心理念: 定时任务调度，支持 Cron 表达式

import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

/**
 * @module ScheduleModule
 * @description 定时任务调度模块
 * 提供 Cron 任务调度功能
 */
@Module({
  imports: [NestScheduleModule.forRoot()],
  exports: [NestScheduleModule],
})
export class ScheduleModule {}
