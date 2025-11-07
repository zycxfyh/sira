// 文件路径: apps/frontend/src/composables/useRouteLoader.ts
// 核心理念: 在 Vue Router 中使用 Loader 模式加载数据

import { ref, type Ref } from 'vue';
import { useRoute } from 'vue-router';
import type { LoaderContext, LoaderFunction, RouteLoaderConfig } from '../router/loader.types';

/**
 * @function useRouteLoader
 * @description Remix 风格的 Vue Router 数据加载器
 *
 * @example
 * ```typescript
 * const { data, loading, error } = useRouteLoader(
 *   async (context) => {
 *     const response = await apiService.games.getById(context.params.id);
 *     return response.data;
 *   },
 *   {
 *     cache: true,
 *     cacheTime: 5 * 60 * 1000, // 5分钟
 *     retry: {
 *       maxRetries: 3,
 *       delay: 1000,
 *     },
 *   }
 * );
 * ```
 */
export function useRouteLoader<T = unknown>(
  loader: LoaderFunction<T>,
  config?: RouteLoaderConfig<T>,
): {
  data: Ref<T | null>;
  loading: Ref<boolean>;
  error: Ref<Error | null>;
  reload: () => Promise<void>;
} {
  const route = useRoute();
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<Error | null>(null);

  // 缓存键
  const cacheKey = route.fullPath;
  const cache = config?.cache !== false ? new Map<string, { data: T; timestamp: number }>() : null;

  /**
   * 执行 Loader
   */
  const executeLoader = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // 检查缓存
      if (cache) {
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < (config?.cacheTime ?? 5 * 60 * 1000)) {
          data.value = cached.data;
          loading.value = false;
          return;
        }
      }

      // 创建上下文
      const context: LoaderContext = {
        route,
        params: route.params as Record<string, string>,
        query: route.query as Record<string, string>,
      };

      // 执行 Loader（带重试）
      let lastError: Error | null = null;
      const maxRetries = config?.retry?.maxRetries ?? 0;
      const delay = config?.retry?.delay ?? 1000;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await loader(context);
          data.value = result;

          // 更新缓存
          if (cache) {
            cache.set(cacheKey, {
              data: result,
              timestamp: Date.now(),
            });
          }

          loading.value = false;
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < maxRetries) {
            // 等待后重试
            await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
          }
        }
      }

      // 所有重试都失败
      throw lastError ?? new Error('Loader execution failed');
    } catch (err) {
      const loaderError = err instanceof Error ? err : new Error(String(err));
      error.value = loaderError;

      // 调用错误处理函数
      if (config?.onError) {
        const context: LoaderContext = {
          route,
          params: route.params as Record<string, string>,
          query: route.query as Record<string, string>,
        };
        config.onError(loaderError, context);
      }

      loading.value = false;
    }
  };

  // 初始加载
  executeLoader();

  // 路由变化时重新加载
  // const stopWatcher = watch(route, executeLoader); // 可以添加路由监听

  return {
    data,
    loading,
    error,
    reload: executeLoader,
  };
}
