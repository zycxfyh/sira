// 文件路径: apps/frontend/src/router/loader.types.ts
// 灵感来源: Remix (https://github.com/remix-run/remix)
// 核心理念: 类型安全的路由数据加载器

import type { RouteLocationNormalized } from 'vue-router';

/**
 * @interface LoaderContext
 * @description Loader 上下文
 */
export interface LoaderContext {
  /** 路由信息 */
  route: RouteLocationNormalized;
  /** 查询参数 */
  params: Record<string, string>;
  /** URL 查询参数 */
  query: Record<string, string>;
  /** 请求头（如果可用） */
  headers?: HeadersInit;
}

/**
 * @type LoaderFunction
 * @description Loader 函数类型
 * @template T - 返回的数据类型
 */
export type LoaderFunction<T = unknown> = (context: LoaderContext) => Promise<T> | T;

/**
 * @interface LoaderResult
 * @description Loader 结果
 */
export interface LoaderResult<T = unknown> {
  /** 数据 */
  data: T;
  /** 错误（如果有） */
  error?: Error;
  /** 状态码 */
  status?: number;
}

/**
 * @interface RouteLoaderConfig
 * @description 路由 Loader 配置
 */
export interface RouteLoaderConfig<T = unknown> {
  /** Loader 函数 */
  loader: LoaderFunction<T>;
  /** 是否启用缓存 */
  cache?: boolean;
  /** 缓存时间（毫秒） */
  cacheTime?: number;
  /** 错误处理函数 */
  onError?: (error: Error, context: LoaderContext) => void;
  /** 重试配置 */
  retry?: {
    /** 最大重试次数 */
    maxRetries: number;
    /** 重试延迟（毫秒） */
    delay: number;
  };
}
