// 文件路径: src/composables/useToast.js

import { useToastStore } from '@/stores/toast.store';

/**
 * 一个显示 Toast 通知的组合式函数。
 * 使用响应式状态管理替代直接DOM操作。
 * 返回一个包含 show 方法的对象。
 */
export function useToast() {
  const toastStore = useToastStore();

  /**
   * 显示Toast通知
   * @param {string} message - 显示的消息
   * @param {'info' | 'success' | 'error'} [type='info'] - 通知的类型
   * @param {number} [duration=3000] - 显示时长 (毫秒)
   */
  function show(message, type = 'info', duration = 3000) {
    toastStore.addToast(message, type, duration);
  }

  // 返回一个包含 show 方法的对象，这是组合式函数的标准模式
  return { show };
}
