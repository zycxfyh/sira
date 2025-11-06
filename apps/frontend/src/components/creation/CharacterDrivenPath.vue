<!-- 文件路径: src/components/creation/CharacterDrivenPath.vue (最终修正版) -->
<template>
  <div id="creation-path-character" class="page active">
    <div
      class="center-content"
      style="justify-content: flex-start; padding-top: 2rem; text-align: left; align-items: stretch"
    >
      <h2>角色驱动路径：导入化身</h2>
      <p>
        上传一个预先定义好的角色卡（.json
        格式）。世界架构AI将围绕您的角色特性和背景，量身定制一个与之相匹配的初始世界。
      </p>
      <div class="step-content" style="margin-top: 2rem; flex-grow: 1">
        <label for="character-card-input">上传角色卡:</label>
        <input
          type="file"
          id="character-card-input"
          accept=".json"
          @change="handleCharacterCardUpload"
        />
        <div v-if="appStore.uploadedCharacterCard" class="character-preview-card">
          <h4>已载入: {{ appStore.uploadedCharacterCard.name }}</h4>
          <p><strong>核心身份:</strong> {{ appStore.uploadedCharacterCard.coreIdentity }}</p>
          <p><strong>性格:</strong> {{ appStore.uploadedCharacterCard.personality.join(', ') }}</p>
        </div>
      </div>
      <div class="button-group">
        <button class="button" @click="emit('back')">返回选择路径</button>
        <button
          class="button primary"
          :disabled="!appStore.uploadedCharacterCard"
          @click="onStartClick"
        >
          载入化身并生成世界
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// =================================================================
// [核心修正] 修正了 useAppStore 的导入路径，这是导致黑屏的根本原因
// =================================================================
import { useAppStore } from '@/stores/app.store';
import { useAssets } from '@/composables/useAssets';

const appStore = useAppStore();
const { handleCharacterCardUpload } = useAssets();

const emit = defineEmits(['back', 'start-creation']);

function onStartClick() {
  if (appStore.uploadedCharacterCard) {
    // [注释] 此处的 start-creation 事件将由父组件 CreationHubView.vue 捕获
    emit('start-creation', appStore.uploadedCharacterCard);
  }
}
</script>
