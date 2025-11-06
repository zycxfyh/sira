<!-- 文件路径: src/components/common/ProcessingOverlay.vue (已修复) -->
<template>
  <div v-if="uiStore.isProcessing" id="processing-overlay" style="display: flex">处理中...</div>
</template>

<script setup>
// [核心修正] 导入正确的 store 和函数名
import { useUIStore } from '@/stores/ui.store';

const uiStore = useUIStore();
</script>
