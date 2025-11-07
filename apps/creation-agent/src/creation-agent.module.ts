// 文件路径: apps/creation-agent/src/creation-agent.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// 从 @tuheg/common-backend 导入所有需要的共享模块
import {
  PrismaModule,
  PromptManagerModule,
  AiProviderFactory,
  DynamicAiSchedulerService,
  EventBusModule,
  PromptInjectionGuard,
} from '@tuheg/common-backend';

// 导入本模块自己的器官
import { CreationAgentController } from './creation-agent.controller';
import { CreationService } from './creation.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PromptManagerModule,
    EventBusModule,
  ],
  controllers: [CreationAgentController],
  providers: [CreationService, DynamicAiSchedulerService, AiProviderFactory, PromptInjectionGuard],
})
export class CreationAgentModule {}
