// 文件路径: packages/common-backend/src/plugins/plugin.types.ts
// 核心理念: 贡献点（Contribution Points）、激活事件（Activation Events）、API 稳定性

/**
 * @interface PluginManifest
 * @description 插件清单文件（类似 VS Code 的 package.json）
 */
export interface PluginManifest {
  /** 插件唯一标识符 */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description?: string;
  /** 插件作者 */
  author?: string;
  /** 插件主页 */
  homepage?: string;
  /** 插件仓库 */
  repository?: string;
  /** 插件贡献的能力 */
  contributes?: PluginContributions;
  /** 激活事件（何时加载插件） */
  activationEvents?: string[];
  /** 插件入口点 */
  main?: string;
  /** 插件依赖 */
  dependencies?: Record<string, string>;
  /** 其他元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * @interface PluginContributions
 * @description 插件贡献的能力（类似 VS Code 的 contributes）
 */
export interface PluginContributions {
  /** AI Provider 贡献点 */
  aiProviders?: AiProviderContribution[];
  /** AI 工具贡献点 */
  aiTools?: AiToolContribution[];
  /** 其他贡献点 */
  [key: string]: unknown;
}

/**
 * @interface AiProviderContribution
 * @description AI Provider 贡献点
 */
export interface AiProviderContribution {
  /** Provider 类型标识符 */
  type: string;
  /** Provider 名称 */
  name: string;
  /** Provider 描述 */
  description: string;
  /** Provider 工厂函数 */
  factory: (config: unknown) => unknown;
  /** 默认配置 */
  defaultConfig?: Record<string, unknown>;
  /** 配置 Schema（Zod） */
  configSchema?: unknown;
}

/**
 * @interface AiToolContribution
 * @description AI 工具贡献点
 */
export interface AiToolContribution {
  /** 工具标识符 */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具执行函数 */
  execute: (input: unknown) => Promise<unknown> | unknown;
  /** 工具参数 Schema */
  inputSchema?: unknown;
}

/**
 * @interface PluginContext
 * @description 插件上下文（提供给插件的 API）
 */
export interface PluginContext {
  /** 插件 ID */
  pluginId: string;
  /** 插件配置 */
  config: Record<string, unknown>;
  /** 日志记录器 */
  logger: {
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    debug: (message: string, ...args: unknown[]) => void;
  };
  /** 其他 API */
  [key: string]: unknown;
}

/**
 * @interface Plugin
 * @description 插件接口
 */
export interface Plugin {
  /** 插件清单 */
  manifest: PluginManifest;
  /** 激活插件 */
  activate(context: PluginContext): Promise<void> | void;
  /** 停用插件 */
  deactivate?(): Promise<void> | void;
}

/**
 * @type PluginFactory
 * @description 插件工厂函数
 */
export type PluginFactory = (context: PluginContext) => Plugin;
