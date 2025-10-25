// 文件路径: apps/creation-agent/src/creation-agent.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

// 从 @tuheg/common-backend 导入所有需要的共享模块
import {
  PrismaModule,
  PromptManagerModule,
  AiProviderFactory,
  DynamicAiSchedulerService,
} from '@tuheg/common-backend';

// 导入本模块自己的器官
import { CreationAgentController } from './creation-agent.controller';
import { CreationService } from './creation.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HttpModule, // 导入HttpModule，用于未来可能的回调
    PrismaModule,
    PromptManagerModule,
  ],
  controllers: [CreationAgentController],
  providers: [CreationService, DynamicAiSchedulerService, AiProviderFactory],
})
export class CreationAgentModule {}
