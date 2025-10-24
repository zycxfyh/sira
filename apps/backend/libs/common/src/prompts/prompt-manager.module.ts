// 文件路径: libs/common/src/prompts/prompt-manager.module.ts

import { Module } from '@nestjs/common';
import { PromptManagerService } from './prompt-manager.service';

@Module({
  providers: [PromptManagerService],
  exports: [PromptManagerService],
})
export class PromptManagerModule {}