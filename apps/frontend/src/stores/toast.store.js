// 文件路径: apps/frontend/src/stores/toast.store.js

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  // Toast消息列表
  const toasts = ref([]);

  // Toast ID计数器
  let toastIdCounter = 0;

  /**
   * 添加新的Toast消息
   * @param {string} message - 消息内容
   * @param {'info' | 'success' | 'error'} type - 消息类型
   * @param {number} duration - 显示时长(毫秒)
   */
  function addToast(message, type = 'info', duration = 3000) {
    const id = ++toastIdCounter;

    const toast = {
      id,
      message,
      type,
      duration,
      createdAt: Date.now(),
    };

    toasts.value.push(toast);

    // 自动移除Toast
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  /**
   * 移除指定的Toast消息
   * @param {number} id - Toast ID
   */
  function removeToast(id) {
    const index = toasts.value.findIndex((toast) => toast.id === id);
    if (index > -1) {
      toasts.value.splice(index, 1);
    }
  }

  /**
   * 清空所有Toast消息
   */
  function clearAllToasts() {
    toasts.value = [];
  }

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
  };
});
