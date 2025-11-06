// 文件路径: apps/narrative-agent/src/narrative-agent.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NarrativeAgentController } from './narrative-agent.controller';
import { NarrativeService } from './narrative.service';

// [核心修正] 从 @tuheg/common-backend 导入所有需要的共享模块
import {
  PrismaModule,
  AiProviderFactory,
  DynamicAiSchedulerService,
  PromptManagerModule, // [核心] 导入“图书馆部门”
} from '@tuheg/common-backend';
import { HttpModule } from '@nestjs/axios'; // [核心] 导入HttpModule用于回调网关

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PromptManagerModule, // [核心] 将“图书馆部门”加入到“工具清单”中
    HttpModule, // [核心] 添加HttpModule
  ],
  controllers: [NarrativeAgentController],
  providers: [NarrativeService, DynamicAiSchedulerService, AiProviderFactory],
})
export class NarrativeAgentModule {}
