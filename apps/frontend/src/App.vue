<!-- 文件路径: apps/frontend/src/App.vue (已更新) -->
<template>
  <div id="app-container">
    <RouterView />
    <CharacterSheetModal v-if="uiStore.isCharacterSheetModalVisible" />
    <JournalModal v-if="uiStore.isJournalModalVisible" />
    <WeaverConsoleModal v-if="uiStore.isWeaverConsoleVisible" />
    <!-- [核心] 在这里挂载我们的新模态框 -->
    <AISettingsModal v-if="uiStore.isAiSettingsModalVisible" />
    <ProcessingOverlay />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';

// 导入所有模态框和覆盖层组件
import CharacterSheetModal from '@/components/common/CharacterSheetModal.vue';
import JournalModal from '@/components/common/JournalModal.vue';
import ProcessingOverlay from '@/components/common/ProcessingOverlay.vue';
import WeaverConsoleModal from '@/components/common/WeaverConsoleModal.vue';
// [核心] 导入新创建的模态框组件
import AISettingsModal from '@/components/common/AISettingsModal.vue';

const authStore = useAuthStore();
const uiStore = useUIStore();

onMounted(() => {
  authStore.verifyAuthOnLoad();
});
</script>