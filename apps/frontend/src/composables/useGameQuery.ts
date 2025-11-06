// 文件路径: apps/frontend/src/composables/useGameQuery.js
// 职责: 使用 TanStack Query 管理游戏相关的数据获取
// 策略: 渐进式迁移，与现有 Pinia store 并行运行

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { apiService } from '@/services/api.service';
import { useToast } from '@/composables/useToast';

/**
 * 查询键工厂 - 统一管理所有查询键
 */
export const gameQueryKeys = {
  all: ['games'] as const,
  lists: () => [...gameQueryKeys.all, 'list'] as const,
  list: (filters) => [...gameQueryKeys.lists(), { filters }] as const,
  details: () => [...gameQueryKeys.all, 'detail'] as const,
  detail: (id) => [...gameQueryKeys.details(), id] as const,
};

/**
 * Hook: 获取游戏列表
 * 替代 game.store.js 中的相关逻辑
 */
export function useGameList() {
  const { show: showToast } = useToast();

  return useQuery({
    queryKey: gameQueryKeys.lists(),
    queryFn: async () => {
      const games = await apiService.games.getAll();
      return games;
    },
    onError: (error) => {
      showToast(`获取游戏列表失败: ${error.message}`, 'error');
    },
  });
}

/**
 * Hook: 获取单个游戏详情
 * 替代 game.store.js 中的 loadGame 方法
 */
export function useGame(gameId) {
  const { show: showToast } = useToast();

  return useQuery({
    queryKey: gameQueryKeys.detail(gameId),
    queryFn: async () => {
      if (!gameId) {
        throw new Error('Game ID is required');
      }
      const game = await apiService.games.getById(gameId);
      return game;
    },
    enabled: !!gameId, // 只有当 gameId 存在时才执行查询
    onError: (error) => {
      showToast(`加载游戏失败: ${error.message}`, 'error');
    },
  });
}

/**
 * Hook: 提交玩家行动
 * 替代 game.store.js 中的 submitAction 方法
 */
export function useSubmitAction() {
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gameId, action }) => {
      await apiService.games.submitAction(gameId, action);
    },
    onSuccess: () => {
      // 行动提交成功，不刷新数据（因为结果会通过 WebSocket 推送）
      // 如果需要，可以在这里 invalidate 相关查询
    },
    onError: (error) => {
      showToast(`行动提交失败: ${error.message}`, 'error');
    },
  });
}

/**
 * Hook: 创建新游戏
 */
export function useCreateGame() {
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (concept) => {
      const result = await apiService.games.create({ concept });
      return result;
    },
    onSuccess: () => {
      // 创建成功后，刷新游戏列表
      queryClient.invalidateQueries({ queryKey: gameQueryKeys.lists() });
      showToast('游戏创建请求已提交，正在处理中...', 'success');
    },
    onError: (error) => {
      showToast(`创建游戏失败: ${error.message}`, 'error');
    },
  });
}

/**
 * Hook: 删除游戏
 */
export function useDeleteGame() {
  const { show: showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameId) => {
      await apiService.games.delete(gameId);
    },
    onSuccess: () => {
      // 删除成功后，刷新游戏列表并清除详情缓存
      queryClient.invalidateQueries({ queryKey: gameQueryKeys.lists() });
      queryClient.removeQueries({ queryKey: gameQueryKeys.detail() });
      showToast('游戏已删除', 'success');
    },
    onError: (error) => {
      showToast(`删除游戏失败: ${error.message}`, 'error');
    },
  });
}
