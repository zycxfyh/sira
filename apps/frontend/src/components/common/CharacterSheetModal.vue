<!-- 文件路径: src/components/common/CharacterSheetModal.vue (已修复) -->
<template>
    <div id="character-sheet-modal" class="modal-backdrop" @click.self="uiStore.hideCharacterSheetModal">
        <div class="modal">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
            <h2>化身档案</h2>
            <div>
              <button class="button primary" @click="exportCharacterCard">导出角色卡</button>
              <button class="button" @click="uiStore.hideCharacterSheetModal">关闭</button>
            </div>
          </div>
          <div class="modal-content" v-if="gameStore.currentGame?.character?.card">
            <h4>姓名</h4><p>{{ gameStore.currentGame.character.name }}</p>
            <h4>核心身份</h4><p>{{ gameStore.currentGame.character.card.coreIdentity }}</p>
            <h4>性格</h4>
            <ul><li v-for="trait in gameStore.currentGame.character.card.personality" :key="trait">{{ trait }}</li></ul>
            <h4>外貌</h4><p>{{ gameStore.currentGame.character.card.appearance }}</p>
          </div>
        </div>
      </div>
</template>

<script setup>
// [核心修正] 导入正确的 store 和函数名
import { useUIStore } from '@/stores/ui.store';
import { useGameStore } from '@/stores/game.store';
import { useAssets } from '@/composables/useAssets';

const uiStore = useUIStore();
const gameStore = useGameStore();
const { exportCharacterCard } = useAssets();
</script>