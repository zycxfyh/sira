<!-- 文件路径: apps/frontend/src/components/game/WorldHUD.vue (已最终修复) -->
<template>
  <div id="world-hud" class="game-panel">
    <h3>世界信息</h3>
    <div class="panel-content">
      <p><strong>世界:</strong> {{ gameStore.currentGame?.name || '未知' }}</p>

      <div
        class="meta-actions"
        style="margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color)"
      >
        <button
          class="button primary"
          style="width: 100%; box-sizing: border-box; margin-bottom: 10px"
          @click="uiStore.showWeaverConsole"
        >
          织世者控制台
        </button>
        <button class="button" @click="uiStore.showJournalModal">查阅冒险日志</button>
        <button class="button" @click="returnToNexus">返回中枢系统</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// [核心修正] 导入正确的 store 和函数名
import { useUIStore } from '@/stores/ui.store';
import { useGameStore } from '@/stores/game.store';
import { useRouter } from 'vue-router';

// [核心修正] 获取正确的 store 实例
const uiStore = useUIStore();
const gameStore = useGameStore();
const router = useRouter();

function returnToNexus() {
  if (confirm('确定要中断当前化身，返回中枢系统吗？')) {
    router.push('/nexus');
  }
}
</script>
