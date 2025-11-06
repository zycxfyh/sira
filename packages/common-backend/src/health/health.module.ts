// 文件路径: apps/backend/libs/common/src/health/health.module.ts

import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
