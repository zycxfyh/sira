// 文件路径: src/stores/game.store.js (瘦身版)

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { apiService } from '@/services/api.service';
import { useUIStore } from './ui.store'; // 修正: ui.store
import { useToast } from '@/composables/useToast';

export const useGameStore = defineStore('game', () => {
  const { show: showToast } = useToast();
  const uiStore = useUIStore();

  // --- State ---
  const currentGame = ref(null);
  const narrativeLog = ref([]);
  const commandInputValue = ref('');
  const isAiThinking = ref(false); // 追踪AI是否正在处理当前会话的行动

  // --- Actions ---

  /**
   * [重构] loadGame 现在只负责获取初始数据
   */
  async function loadGame(gameId) {
    uiStore.isProcessing = true;
    try {
      const gameData = await apiService.games.getById(gameId);
      currentGame.value = gameData;
      // 初始化叙事日志
      narrativeLog.value = [
        { text: `降临至世界 "${gameData.name || '一个未知世界'}"...`, isMeta: true },
      ];
      // [注释] 连接WebSocket的职责已移交给 main.js 和 realtime.store
    } catch (error) {
      showToast(`加载世界失败: ${error.message}`, 'error');
      currentGame.value = null;
      throw error; // 向上抛出错误，让视图可以处理
    } finally {
      uiStore.isProcessing = false;
    }
  }

  /**
   * [核心重构] submitAction 只负责“触发”，不再等待或处理结果
   */
  async function submitAction(gameId, type, payload) {
    if (isAiThinking.value) {
      showToast('AI 正在思考中，请稍候...', 'info');
      return;
    }
    try {
      // [注释] 异步发送API请求来“触发”后台任务。
      // 我们不关心它的返回值，因为结果将通过WebSocket推送。
      await apiService.games.submitAction(gameId, { type, payload });
      // [注释] 成功触发后，我们只需等待'processing_started'事件即可。
      // isAiThinking 的状态将由 handleProcessingStarted 来设置。
    } catch (error) {
      // 只有在触发API本身失败时才会进入这里
      showToast(`行动请求失败: ${error.message}`, 'error');
      isAiThinking.value = false; // 确保在触发失败时重置状态
    }
  }

  // --- [新增] 被动处理器 Actions (供 realtime.store 调用) ---

  /**
   * 处理器：当收到 'processing_started' 事件时被调用
   */
  function handleProcessingStarted(data) {
    console.log('[GameStore] AI processing started:', data);
    isAiThinking.value = true;
    narrativeLog.value.push({
      text: data.message || 'AI 正在思考...',
      isMeta: true,
    });
  }

  /**
   * 处理器：当收到 'processing_completed' 事件时被调用
   */
  function handleProcessingCompleted(data) {
    console.log('[GameStore] AI processing completed:', data);
    const { progression } = data;
    if (!progression) {
      return;
    }

    // 从叙事日志中移除最后一条“正在思考”的消息
    if (narrativeLog.value.length > 0 && narrativeLog.value.at(-1).isMeta) {
      narrativeLog.value.pop();
    }

    if (progression.narrative) {
      narrativeLog.value.push({ text: progression.narrative, isMeta: false });
    }
    // [重要] 后端微服务架构中，角色状态的更新由 RuleEngine 精确完成，
    // 叙事AI不再返回 characterUpdate。我们需要在接收到事件后，
    // 主动重新获取最新的角色状态。
    // (这是一个高级优化，暂时我们可以先依赖前端的乐观更新)

    if (progression.options && currentGame.value) {
      currentGame.value.options = progression.options;
    }
    isAiThinking.value = false;
  }

  /**
   * 处理器：当收到 'processing_failed' 事件时被调用
   */
  function handleProcessingFailed(data) {
    console.error('[GameStore] AI processing failed:', data);
    isAiThinking.value = false;
    // 移除“正在思考”的消息
    if (narrativeLog.value.length > 0 && narrativeLog.value.at(-1).isMeta) {
      narrativeLog.value.pop();
    }
    showToast(`行动处理失败: ${data.error || '未知错误'}`, 'error');
  }

  // 其他 action，例如手动更新角色状态
  async function updateCharacterState(gameId, updateData) {
    try {
      const updatedCharacter = await apiService.games.updateCharacter(gameId, updateData);
      if (currentGame.value && currentGame.value.character) {
        Object.assign(currentGame.value.character, updatedCharacter);
      }
      showToast('角色状态已通过织世者控制台更新。', 'success');
      uiStore.hideWeaverConsole();
    } catch (error) {
      showToast(`更新角色失败: ${error.message}`, 'error');
    }
  }

  return {
    currentGame,
    narrativeLog,
    commandInputValue,
    isAiThinking,
    loadGame,
    submitAction,
    updateCharacterState,
    // 导出新的处理器方法
    handleProcessingStarted,
    handleProcessingCompleted,
    handleProcessingFailed,
  };
});
