// 文件路径: packages/common-backend/src/plugins/plugin.module.ts
// 核心理念: 模块化导出，方便其他模块使用

import { Module } from '@nestjs/common';
import { PluginLoader } from './plugin.loader';
import { PluginRegistry } from './plugin.registry';

/**
 * @module PluginModule
 * @description VS Code 风格的插件系统模块
 * 提供插件注册、加载、激活等功能
 */
@Module({
  providers: [PluginRegistry, PluginLoader],
  exports: [PluginRegistry, PluginLoader],
})
export class PluginModule {}
