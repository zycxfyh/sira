// 文件路径: src/settings/settings.module.ts (依赖注入修正版)

import { Module } from '@nestjs/common';
// [核心补丁] 从 @nestjs/axios 导入 HttpModule
import { HttpModule } from '@nestjs/axios';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
// [注释] PrismaModule 是全局的，所以这里不需要导入

@Module({
  // [核心补-丁] 将 HttpModule 添加到 SettingsModule 的 imports 数组中
  imports: [HttpModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
