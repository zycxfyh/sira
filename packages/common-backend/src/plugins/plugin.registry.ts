// 文件路径: packages/common-backend/src/plugins/plugin.registry.ts
// 核心理念: 插件注册表，管理所有已安装和激活的插件

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Plugin, PluginContext } from './plugin.types';

/**
 * @class PluginRegistry
 * @description 插件注册表，管理所有插件
 */
@Injectable()
export class PluginRegistry implements OnModuleInit {
  private readonly logger = new Logger(PluginRegistry.name);
  private readonly plugins = new Map<string, Plugin>();
  private readonly contexts = new Map<string, PluginContext>();

  async onModuleInit() {
    this.logger.log('Plugin registry initialized');
  }

  /**
   * @method register
   * @description 注册插件
   */
  public register(plugin: Plugin): void {
    const { id } = plugin.manifest;

    if (this.plugins.has(id)) {
      this.logger.warn(`Plugin "${id}" is already registered, overwriting...`);
    }

    this.plugins.set(id, plugin);
    this.logger.log(`Plugin "${id}" (${plugin.manifest.version}) registered`);

    // 创建插件上下文
    const context: PluginContext = {
      pluginId: id,
      config: {},
      logger: {
        info: (message, ...args) => {
          this.logger.log(`[${id}] ${message}`, ...args);
        },
        warn: (message, ...args) => {
          this.logger.warn(`[${id}] ${message}`, ...args);
        },
        error: (message, ...args) => {
          this.logger.error(`[${id}] ${message}`, ...args);
        },
        debug: (message, ...args) => {
          this.logger.debug(`[${id}] ${message}`, ...args);
        },
      },
    };

    this.contexts.set(id, context);
  }

  /**
   * @method unregister
   * @description 注销插件
   */
  public async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      this.logger.warn(`Plugin "${pluginId}" not found, skipping unregister`);
      return;
    }

    // 停用插件
    if (plugin.deactivate) {
      try {
        await plugin.deactivate();
      } catch (error) {
        this.logger.error(
          `Error deactivating plugin "${pluginId}":`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    this.plugins.delete(pluginId);
    this.contexts.delete(pluginId);
    this.logger.log(`Plugin "${pluginId}" unregistered`);
  }

  /**
   * @method getPlugin
   * @description 获取插件
   */
  public getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * @method getPlugins
   * @description 获取所有已注册的插件
   */
  public getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * @method getPluginContext
   * @description 获取插件上下文
   */
  public getPluginContext(pluginId: string): PluginContext | undefined {
    return this.contexts.get(pluginId);
  }

  /**
   * @method activatePlugin
   * @description 激活插件
   */
  public async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    const context = this.contexts.get(pluginId);
    if (!context) {
      throw new Error(`Plugin context for "${pluginId}" not found`);
    }

    try {
      this.logger.log(`Activating plugin "${pluginId}"...`);
      await plugin.activate(context);
      this.logger.log(`Plugin "${pluginId}" activated successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to activate plugin "${pluginId}":`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * @method getPluginsByContribution
   * @description 根据贡献点获取插件
   */
  public getPluginsByContribution(
    contributionType: string,
  ): Array<{ plugin: Plugin; contribution: unknown }> {
    const results: Array<{ plugin: Plugin; contribution: unknown }> = [];

    for (const plugin of this.plugins.values()) {
      const contributions = plugin.manifest.contributes;
      if (!contributions) {
        continue;
      }

      const contribution = contributions[contributionType];
      if (contribution) {
        results.push({ plugin, contribution });
      }
    }

    return results;
  }

  /**
   * @method getAiProviderContributions
   * @description 获取所有 AI Provider 贡献
   */
  public getAiProviderContributions() {
    return this.getPluginsByContribution('aiProviders');
  }

  /**
   * @method getAiToolContributions
   * @description 获取所有 AI 工具贡献
   */
  public getAiToolContributions() {
    return this.getPluginsByContribution('aiTools');
  }
}
