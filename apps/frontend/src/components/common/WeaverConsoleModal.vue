<!-- 文件路径: src/components/common/WeaverConsoleModal.vue (已修复) -->
<template>
  <div class="modal-backdrop" @click.self="uiStore.hideWeaverConsole">
    <div class="modal">
      <div class="modal-header">
        <h2>织世者控制台</h2>
        <p style="color: #aaa; margin: 0.5rem 0 0 0; font-style: italic">
          在这里，你将行使导演的最终剪辑权。
        </p>
      </div>

      <div class="modal-content" v-if="editableCharacter">
        <div class="form-grid">
          <label for="weaver-hp">生命值 (HP)</label>
          <input id="weaver-hp" type="number" v-model.number="editableCharacter.hp" />

          <label for="weaver-maxHp">最大生命值</label>
          <input id="weaver-maxHp" type="number" v-model.number="editableCharacter.maxHp" />

          <label for="weaver-mp">精神力 (MP)</label>
          <input id="weaver-mp" type="number" v-model.number="editableCharacter.mp" />

          <label for="weaver-maxMp">最大精神力</label>
          <input id="weaver-maxMp" type="number" v-model.number="editableCharacter.maxMp" />

          <label for="weaver-status">当前状态</label>
          <input id="weaver-status" type="text" v-model.trim="editableCharacter.status" />
        </div>
      </div>
      <div v-else>
        <p>无法加载角色数据...</p>
      </div>

      <div class="button-group">
        <div class="button" @click="uiStore.hideWeaverConsole">取消</div>
        <div class="button primary" @click="handleSaveChanges">应用更改</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// [核心修正] 导入正确的 store 和函数名
import { useUIStore } from '@/stores/ui.store';
import { useGameStore } from '@/stores/game.store';

const uiStore = useUIStore();
const gameStore = useGameStore();

const editableCharacter = ref(null);

onMounted(() => {
  if (gameStore.currentGame?.character) {
    editableCharacter.value = JSON.parse(JSON.stringify(gameStore.currentGame.character));
  }
});

function handleSaveChanges() {
  if (!editableCharacter.value || !gameStore.currentGame?.id) return;

  const originalCharacter = gameStore.currentGame.character;
  const changes = {};
  for (const key in editableCharacter.value) {
    if (originalCharacter && editableCharacter.value[key] !== originalCharacter[key]) {
      changes[key] = editableCharacter.value[key];
    }
  }

  if (Object.keys(changes).length > 0) {
    gameStore.updateCharacterState(gameStore.currentGame.id, changes);
  } else {
    uiStore.hideWeaverConsole();
  }
}
</script>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
  align-items: center;
}
.form-grid label {
  text-align: right;
  font-weight: bold;
}
</style>
