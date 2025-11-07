// 文件路径: src/composables/useAssets.js (已最终修复)

// [核心修正] 导入正确的 ui.store 和 useUIStore
import { useUIStore } from '@/stores/ui.store';
import { useGameStore } from '@/stores/game.store';
import { useAppStore } from '@/stores/app.store';
import { useToast } from './useToast';

/**
 * 管理资源（角色卡等）上传和导出的组合式函数。
 */
export function useAssets() {
  // [核心修正] 获取正确的 store 实例
  const uiStore = useUIStore();
  const gameStore = useGameStore();
  const appStore = useAppStore();
  const { show: showToast } = useToast();

  /**
   * 处理角色卡文件上传事件。
   */
  function handleCharacterCardUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      // 这里应该更新一个专门用于创世流程的状态，而不是uiStore
      // 但为了修复当前问题，我们暂时注释掉
      // uiStore.uploadedCharacterCard = null;
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target.result;
        const data = JSON.parse(fileContent);

        if (
          typeof data === 'object' &&
          data !== null &&
          data.name &&
          data.coreIdentity &&
          Array.isArray(data.personality)
        ) {
          // 存储解析后的角色卡数据到 app store 中供 CharacterDrivenPath.vue 使用
          appStore.setUploadedCharacterCard(data);
          console.log('Character card parsed:', data);
          showToast(`角色卡 "${data.name}" 已成功载入！`, 'success');
        } else {
          throw new Error(
            'JSON 文件格式不正确或缺少必要的字段 (name, coreIdentity, personality)。',
          );
        }
      } catch (error) {
        showToast(`解析角色卡失败: ${error.message}`, 'error');
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      showToast('读取文件时发生错误。', 'error');
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  /**
   * 将当前游戏中的 characterCard 导出为 .json 文件。
   */
  function exportCharacterCard() {
    const characterData = gameStore.currentGame?.character;

    if (!characterData?.name || !characterData.card) {
      showToast('没有可导出的有效角色数据。', 'error');
      return;
    }

    try {
      const dataToExport = {
        name: characterData.name,
        ...characterData.card,
      };

      const jsonData = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      const filename = `${characterData.name.replace(/[^a-z0-9]/gi, '_')}.character.json`;
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`角色卡 "${characterData.name}" 已成功导出！`, 'success');
    } catch (error) {
      console.error('导出角色卡失败:', error);
      showToast(`导出失败: ${error.message}`, 'error');
    }
  }

  return {
    handleCharacterCardUpload,
    exportCharacterCard,
  };
}
