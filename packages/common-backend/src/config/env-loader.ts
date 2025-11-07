// 文件路径: packages/common-backend/src/config/env-loader.ts
// 核心理念: 支持环境变量扩展和多环境配置

import { config } from 'dotenv';
import { expand } from 'dotenv-expand';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * @interface EnvLoaderOptions
 * @description 环境加载器选项
 */
export interface EnvLoaderOptions {
  /** 环境名称 */
  env?: string;
  /** 配置目录 */
  configDir?: string;
  /** 是否覆盖已有变量 */
  override?: boolean;
  /** 是否静默失败 */
  silent?: boolean;
}

/**
 * @class EnvLoader
 * @description 环境变量加载器
 * 支持环境变量扩展和多环境配置
 */
export class EnvLoader {
  /**
   * @method load
   * @description 加载环境变量
   *
   * @example
   * ```typescript
   * // 加载 .env 文件
   * EnvLoader.load();
   *
   * // 加载特定环境的配置
   * EnvLoader.load({ env: 'production' });
   * ```
   */
  public static load(options: EnvLoaderOptions = {}): void {
    const {
      env = process.env.NODE_ENV || 'development',
      configDir = process.cwd(),
      override = false,
      silent = false,
    } = options;

    // 加载顺序：
    // 1. .env (基础配置)
    // 2. .env.local (本地覆盖，不提交到 Git)
    // 3. .env.{env} (环境特定配置，如 .env.production)
    // 4. .env.{env}.local (环境特定的本地覆盖)

    const envFiles = ['.env', '.env.local', `.env.${env}`, `.env.${env}.local`];

    for (const envFile of envFiles) {
      const envPath = resolve(configDir, envFile);

      if (existsSync(envPath)) {
        try {
          const result = config({
            path: envPath,
            override,
          });

          if (result.error && !silent) {
            console.warn(`Failed to load ${envFile}:`, result.error.message);
          } else if (result.parsed) {
            // 扩展环境变量（支持 ${VAR} 引用）
            expand(result);
            console.log(`✓ Loaded ${envFile}`);
          }
        } catch (error) {
          if (!silent) {
            console.warn(`Error loading ${envFile}:`, error);
          }
        }
      }
    }
  }

  /**
   * @method loadForApp
   * @description 为特定应用加载环境变量
   *
   * @example
   * ```typescript
   * // 为 backend-gateway 加载配置
   * EnvLoader.loadForApp('backend-gateway');
   * ```
   */
  public static loadForApp(appName: string, options: EnvLoaderOptions = {}): void {
    const { env = process.env.NODE_ENV || 'development', configDir = process.cwd() } = options;

    // 应用特定的环境文件
    const appEnvFiles = [
      `.env.${appName}`,
      `.env.${appName}.local`,
      `.env.${appName}.${env}`,
      `.env.${appName}.${env}.local`,
    ];

    for (const envFile of appEnvFiles) {
      const envPath = resolve(configDir, envFile);

      if (existsSync(envPath)) {
        try {
          const result = config({
            path: envPath,
            override: true, // 应用特定配置覆盖全局配置
          });

          if (result.parsed) {
            expand(result);
            console.log(`✓ Loaded ${envFile} for ${appName}`);
          }
        } catch (error) {
          console.warn(`Error loading ${envFile}:`, error);
        }
      }
    }
  }
}
