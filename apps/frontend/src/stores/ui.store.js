// 文件路径: src/stores/ui.store.js

import { ref } from 'vue';
import { defineStore } from 'pinia';

export const useUIStore = defineStore('ui', () => {
  // --- 全局加载状态 ---
  const isProcessing = ref(false); // 例如，用于页面跳转时的全局遮罩

  // --- 路由实例 ---
  const router = ref(null);

  // --- 模态框可见性状态 ---
  const isCharacterSheetModalVisible = ref(false);
  const isJournalModalVisible = ref(false);
  const isWeaverConsoleVisible = ref(false);
  // [注释] AI设置模态框的状态现在也由UI Store统一管理
  const isAiSettingsModalVisible = ref(false); 

  // --- [新增] 实时连接状态 ---
  const connectionStatus = ref('disconnected'); // 'connected', 'disconnected', 'reconnecting'

  // --- Actions ---

  function setRouter(routerInstance) {
    router.value = routerInstance;
  }
  
  function setConnectionStatus(status) {
    connectionStatus.value = status;
  }

  function showCharacterSheetModal() {
    isCharacterSheetModalVisible.value = true;
  }
  function hideCharacterSheetModal() {
    isCharacterSheetModalVisible.value = false;
  }

  function showJournalModal() {
    isJournalModalVisible.value = true;
  }
  function hideJournalModal() {
    isJournalModalVisible.value = false;
  }

  function showWeaverConsole() {
    isWeaverConsoleVisible.value = true;
  }
  function hideWeaverConsole() {
    isWeaverConsoleVisible.value = false;
  }
  
  function showAiSettingsModal() {
      isAiSettingsModalVisible.value = true;
  }
  function hideAiSettingsModal() {
      isAiSettingsModalVisible.value = false;
  }

  return {
    isProcessing,
    router,
    isCharacterSheetModalVisible,
    isJournalModalVisible,
    isWeaverConsoleVisible,
    isAiSettingsModalVisible,

    connectionStatus,

    setRouter,
    setConnectionStatus,
    showCharacterSheetModal,
    hideCharacterSheetModal,
    showJournalModal,
    hideJournalModal,
    showWeaverConsole,
    hideWeaverConsole,
    showAiSettingsModal,
    hideAiSettingsModal,
  };
});