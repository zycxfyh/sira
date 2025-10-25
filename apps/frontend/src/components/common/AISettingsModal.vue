<!-- 文件路径: apps/frontend/src/components/common/AISettingsModal.vue -->
<template>
  <div class="modal-backdrop" @click.self="settingsStore.hideAiSettingsModal">
    <div class="modal">
      <div class="modal-header">
        <h2>AI 指挥中心</h2>
        <p class="subtitle">管理驱动您所有叙事宇宙的AI核心。</p>
        
        <!-- 视图模式切换器 -->
        <div class="mode-switcher">
          <button 
            :class="{ active: settingsStore.configViewMode === 'simple' }"
            @click="settingsStore.setConfigViewMode('simple')">
            简易模式
          </button>
          <button 
            :class="{ active: settingsStore.configViewMode === 'expert' }"
            @click="settingsStore.setConfigViewMode('expert')">
            专家模式
          </button>
        </div>
      </div>

      <div class="modal-content">
        <!-- 加载状态 -->
        <div v-if="settingsStore.isLoading" class="center-content">
          <p>正在从后端同步AI配置...</p>
        </div>

        <!-- 简易模式视图 -->
        <div v-else-if="settingsStore.configViewMode === 'simple'" class="simple-mode-view">
          <p class="mode-description">
            您只需配置一个全能AI。系统将智能地用它完成所有任务。
          </p>
          <AiConfigCard
            v-if="settingsStore.globalAiConfig"
            :key="settingsStore.globalAiConfig.id"
            :config="settingsStore.globalAiConfig"
            :is-global="true"
          />
          <div v-else class="center-content empty-state">
            <p>未找到全局AI配置。</p>
            <p>请点击下方的“新增配置”来添加您的第一个全局AI核心，或切换到专家模式进行管理。</p>
          </div>
        </div>

        <!-- 专家模式视图 -->
        <div v-else-if="settingsStore.configViewMode === 'expert'" class="expert-mode-view">
           <p class="mode-description">
            您可以为系统的不同能力（如逻辑、叙事）分别指派不同的AI模型。
          </p>
          <div v-if="settingsStore.aiConfigurations.length > 0" class="config-list">
            <AiConfigCard
              v-for="config in settingsStore.aiConfigurations"
              :key="config.id"
              :config="config"
            />
          </div>
          <div v-else class="center-content empty-state">
            <p>未配置任何AI。</p>
          </div>
        </div>
      </div>

      <!-- 全局操作按钮 -->
      <div class="button-group">
        <button class="button" @click="settingsStore.addNewConfigCard">新增AI配置</button>
        <button class="button primary" @click="settingsStore.hideAiSettingsModal">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSettingsStore } from '@/stores/settings.store';
import AiConfigCard from './AiConfigCard.vue';

const settingsStore = useSettingsStore();
</script>

<style scoped>
.modal {
  width: 90%;
  max-width: 800px; /* Increased width for better layout */
}
.subtitle {
  color: #aaa;
  margin: 0.5rem 0 0 0;
  font-style: italic;
  font-size: 0.9rem;
}
.config-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.button-group {
  justify-content: space-between;
}
.mode-switcher {
  margin-top: 1.5rem;
  background-color: var(--primary-bg);
  border-radius: 8px;
  padding: 4px;
  display: inline-flex;
}
.mode-switcher button {
  padding: 8px 16px;
  border: none;
  background-color: transparent;
  color: var(--primary-text);
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s ease;
}
.mode-switcher button.active {
  background-color: var(--accent-color);
  color: var(--primary-bg);
  font-weight: bold;
}
.mode-description {
  margin-bottom: 1.5rem;
  padding: 0.75rem;
  background-color: rgba(0, 170, 255, 0.1);
  border-left: 3px solid var(--accent-color);
  border-radius: 4px;
  font-size: 0.9rem;
  color: #ccc;
}
.empty-state {
  padding: 2rem;
  color: #888;
}
</style>