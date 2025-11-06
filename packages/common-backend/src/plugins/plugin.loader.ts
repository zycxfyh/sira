// 文件路径: packages/common-backend/src/plugins/plugin.loader.ts
// 灵感来源: VS Code Extension Loader
// 核心理念: 动态加载插件，支持按需激活

import { Injectable, Logger } from "@nestjs/common";
import type { PluginFactory, PluginManifest } from "./plugin.types";
import { PluginRegistry } from "./plugin.registry";

/**
 * @class PluginLoader
 * @description 插件加载器，负责从文件系统或配置加载插件
 */
@Injectable()
export class PluginLoader {
  private readonly logger = new Logger(PluginLoader.name);

  constructor(private readonly registry: PluginRegistry) {}

  /**
   * @method loadFromManifest
   * @description 从清单文件加载插件
   * @param manifest - 插件清单
   * @param factory - 插件工厂函数
   */
  public async loadFromManifest(
    manifest: PluginManifest,
    factory: PluginFactory,
  ): Promise<void> {
    try {
      this.logger.debug(`Loading plugin "${manifest.id}" from manifest...`);

      // 验证清单
      this.validateManifest(manifest);

      // 创建插件实例
      const context = this.registry.getPluginContext(manifest.id);
      if (!context) {
        throw new Error(`Plugin context for "${manifest.id}" not found`);
      }

      const plugin = factory(context);
      plugin.manifest = manifest;

      // 注册插件
      this.registry.register(plugin);

      // 检查是否需要立即激活
      const activationEvents = manifest.activationEvents ?? [];
      if (activationEvents.includes("*") || activationEvents.length === 0) {
        // 立即激活
        await this.registry.activatePlugin(manifest.id);
      } else {
        // 延迟激活（等待激活事件）
        this.logger.debug(
          `Plugin "${manifest.id}" will be activated on events: ${activationEvents.join(", ")}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to load plugin "${manifest.id}":`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * @method loadFromConfig
   * @description 从配置对象加载插件
   * @param config - 插件配置
   */
  public async loadFromConfig(config: {
    manifest: PluginManifest;
    factory: PluginFactory;
  }): Promise<void> {
    await this.loadFromManifest(config.manifest, config.factory);
  }

  /**
   * @method validateManifest
   * @description 验证插件清单
   */
  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.id) {
      throw new Error("Plugin manifest must have an 'id' field");
    }

    if (!manifest.name) {
      throw new Error("Plugin manifest must have a 'name' field");
    }

    if (!manifest.version) {
      throw new Error("Plugin manifest must have a 'version' field");
    }

    // 验证 ID 格式（类似 npm 包名）
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(manifest.id)) {
      throw new Error(
        `Plugin ID "${manifest.id}" is invalid. Must be a valid identifier (lowercase, alphanumeric, hyphens only).`,
      );
    }
  }

  /**
   * @method unloadPlugin
   * @description 卸载插件
   */
  public async unloadPlugin(pluginId: string): Promise<void> {
    await this.registry.unregister(pluginId);
  }
}

