<!-- 文件路径: src/components/common/JournalModal.vue (已修复) -->
<template>
  <div id="journal-modal" class="modal-backdrop" @click.self="uiStore.hideJournalModal">
    <div class="modal">
      <div
        class="modal-header"
        style="display: flex; justify-content: space-between; align-items: center"
      >
        <h2>冒险日志</h2>
        <button class="button" @click="uiStore.hideJournalModal">关闭</button>
      </div>
      <div class="modal-content">
        <div
          id="journal-window"
          style="
            background-color: #111;
            padding: 15px;
            border-radius: 5px;
            height: 60vh;
            overflow-y: auto;
          "
        >
          <p
            v-for="(p, index) in reversedNarrativeLog"
            :key="index"
            :style="{
              fontStyle: p.isMeta ? 'italic' : 'normal',
              color: p.isMeta ? '#aaa' : 'var(--primary-text)',
            }"
          >
            {{ p.text }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
// [核心修正] 导入正确的 store 和函数名
import { useUIStore } from '@/stores/ui.store';
import { useGameStore } from '@/stores/game.store';

const uiStore = useUIStore();
const gameStore = useGameStore();

const reversedNarrativeLog = computed(() => {
  return [...gameStore.narrativeLog].reverse();
});
</script>
