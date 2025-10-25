<!-- 文件路径: apps/frontend/src/components/common/AiConfigCard.vue -->
<template>
  <div class="ai-config-card" :class="{ 'is-new': isNew, 'is-loading': isLoading }">
    <div class="form-grid">
      <!-- Provider Selection -->
      <div>
        <label>供应商 (Provider)</label>
        <select v-model="editableConfig.provider" @change="onProviderChange" :disabled="isLoading">
          <option disabled value="">请选择一个供应商</option>
          <optgroup v-for="group in providerGroups" :key="group.label" :label="group.label">
            <option v-for="provider in group.providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </optgroup>
        </select>
      </div>

      <!-- Model ID Selection -->
      <div>
        <label>模型ID (Model ID)</label>
        <select v-model="editableConfig.modelId" :disabled="isLoading">
          <option v-if="!fetchedModels.length" disabled value="">{{ modelSelectPlaceholder }}</option>
          <option v-for="modelId in fetchedModels" :key="modelId" :value="modelId">
            {{ modelId }}
          </option>
          <!-- Allow showing saved value even if not in fetched list -->
          <option v-if="editableConfig.modelId && !fetchedModels.includes(editableConfig.modelId)" :value="editableConfig.modelId">
            {{ editableConfig.modelId }} (自定义)
          </option>
        </select>
      </div>

      <!-- Base URL Input -->
      <div class="full-width">
        <label>API 基础地址 (Base URL)</label>
        <div class="input-with-button">
          <input type="text" v-model.trim="editableConfig.baseUrl" placeholder="选择供应商后将自动填充" :disabled="isLoading">
          <button class="button small" @click="handleTestConnection" :disabled="isLoading">
            {{ testButtonText }}
          </button>
        </div>
      </div>

      <!-- API Key Input -->
      <div class="full-width">
        <label>API 密钥 (API Key)</label>
        <input type="password" v-model.trim="editableConfig.apiKey" placeholder="在此输入您的API密钥" :disabled="isLoading">
      </div>
      
      <!-- Role Assignment -->
      <div class="full-width">
        <label>能力分配 (此AI核心负责的任务)</label>
        <div class="roles-group">
          <label v-for="role in availableRoles" :key="role.id">
            <input type="checkbox" :value="role.id" v-model="selectedRoles" :disabled="isLoading || props.isGlobal">
            {{ role.name }}
            <span class="tooltip">{{ role.description }}</span>
          </label>
        </div>
         <p v-if="props.isGlobal" class="global-mode-text">简易模式下，此AI将负责所有任务。</p>
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div class="button-group">
      <button v-if="!isNew" class="button danger" @click="handleDelete" :disabled="isLoading">删除</button>
      <button v-else class="button danger" @click="handleCancelNew" :disabled="isLoading">取消</button>
      <div>
        <button v-if="!isNew" class="button" @click="resetChanges" :disabled="isLoading">重置</button>
        <button class="button primary" @click="handleSave" :disabled="isLoading">
          {{ isNew ? '创建' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useSettingsStore, ALL_AI_ROLES } from '@/stores/settings.store';
import { apiService } from '@/services/api.service';
import { useToast } from '@/composables/useToast';

const props = defineProps({
  config: { type: Object, required: true },
  isGlobal: { type: Boolean, default: false },
});

const settingsStore = useSettingsStore();
const { show: showToast } = useToast();

const isNew = computed(() => !!props.config.isNew);
const editableConfig = ref(JSON.parse(JSON.stringify(props.config)));
const isLoading = ref(false);
const isTesting = ref(false);
const fetchedModels = ref([]);

// --- Data for Provider Select ---
const providers = {
  china: [
    { id: 'DeepSeek', name: 'DeepSeek (深度求索)', baseUrl: 'https://api.deepseek.com' },
    { id: 'Moonshot', name: 'Moonshot (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1' },
    // ... (Add other providers from your previous code)
  ],
  international: [
    { id: 'OpenAI', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
    { id: 'Groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
    // ...
  ],
  local: [
    { id: 'Ollama', name: 'Ollama (本地)', baseUrl: 'http://localhost:11434/v1' },
    { id: 'CustomOpenAICompatible', name: '自定义兼容接口', baseUrl: '' },
  ],
};
const providerGroups = ref([
  { label: '国内供应商', providers: providers.china },
  { label: '国际供应商', providers: providers.international },
  { label: '本地与其他', providers: providers.local },
]);

// --- Data for Role Assignment ---
const availableRoles = ref([
  { id: 'logic_parsing', name: '逻辑解析', description: '将玩家的自然语言输入翻译成确定的游戏世界规则变更。' },
  { id: 'narrative_synthesis', name: '叙事合成', description: '将游戏世界状态的变化渲染成生动的故事文本和玩家选项。' },
  { id: 'planner', name: '任务规划', description: '(高级) 负责将复杂任务分解为多个子任务，进行AI协作。' },
  { id: 'critic', name: '输出审查', description: '(高级) 负责审查其他AI的输出质量，并提出修改意见。' },
]);

const selectedRoles = computed({
  get: () => editableConfig.value.assignedRoles ? editableConfig.value.assignedRoles.split(',') : [],
  set: (newValue) => { editableConfig.value.assignedRoles = newValue.join(','); },
});

// --- Computed Properties for UI ---
const modelSelectPlaceholder = computed(() => {
  if (!editableConfig.value.provider) return '请先选择供应商';
  if (!editableConfig.value.apiKey) return '请填写API Key';
  return '请点击右侧按钮获取';
});

const testButtonText = computed(() => {
  if(isTesting.value) return '测试中...';
  if(fetchedModels.value.length > 0) return '重新获取';
  return '测试 & 获取模型';
});

// --- Methods ---
function onProviderChange() {
  const allProviders = [...providers.china, ...providers.international, ...providers.local];
  const selectedProvider = allProviders.find(p => p.id === editableConfig.value.provider);
  if (selectedProvider) {
    editableConfig.value.baseUrl = selectedProvider.baseUrl;
  }
  fetchedModels.value = [];
  editableConfig.value.modelId = '';
}

async function handleTestConnection() {
  if (!editableConfig.value.apiKey) {
    return showToast('请输入API Key后再测试连接。', 'error');
  }
  
  isTesting.value = true;
  fetchedModels.value = [];
  
  try {
    const payload = {
      provider: editableConfig.value.provider,
      apiKey: editableConfig.value.apiKey,
      baseUrl: editableConfig.value.baseUrl || null,
    };
    const response = await apiService.settings.testConnection(payload);
    fetchedModels.value = response.models;
    
    if (response.models.length > 0) {
      if (!editableConfig.value.modelId || !response.models.includes(editableConfig.value.modelId)) {
         editableConfig.value.modelId = response.models[0];
      }
      showToast(`成功获取 ${response.models.length} 个模型！`, 'success');
    } else {
      showToast('连接成功，但未找到可用模型。', 'info');
    }
  } catch (error) {
    showToast(`连接测试失败: ${error.message}`, 'error');
  } finally {
    isTesting.value = false;
  }
}

function handleSave() {
  const dataToSave = { ...editableConfig.value };
  
  if (props.isGlobal) {
    dataToSave.assignedRoles = ALL_AI_ROLES.join(',');
  }
  
  if (!dataToSave.provider || !dataToSave.apiKey || !dataToSave.modelId || !dataToSave.assignedRoles) {
    return showToast('供应商、API Key、模型ID和能力分配均为必填项。', 'error');
  }

  if (isNew.value) {
    const { isNew, id, ...creationData } = dataToSave;
    settingsStore.createAiConfiguration(creationData);
  } else {
    settingsStore.updateAiConfiguration(props.config.id, dataToSave);
  }
}

function handleDelete() {
  if (confirm(`确定要删除 "${props.config.provider}" 这个AI配置吗？`)) {
    settingsStore.deleteAiConfiguration(props.config.id);
  }
}

function resetChanges() {
  editableConfig.value = JSON.parse(JSON.stringify(props.config));
  // Also reset fetched models if not a new card
  if (!isNew.value) {
    fetchedModels.value = [];
  }
}

function handleCancelNew() {
  settingsStore.removeNewConfigCard(props.config.id);
}

watch(() => props.config, (newVal) => {
  editableConfig.value = JSON.parse(JSON.stringify(newVal));
}, { deep: true, immediate: true });
</script>

<style scoped>
/* (Styles are mostly the same as your provided AiConfigCard.vue, with minor additions) */
.ai-config-card {
  background-color: var(--primary-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}
.ai-config-card:hover {
  border-color: var(--accent-color);
}
.ai-config-card.is-new {
  border-left: 3px solid var(--success-color);
}
.ai-config-card.is-loading {
  opacity: 0.7;
  pointer-events: none;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1.5rem;
}
.full-width {
  grid-column: 1 / -1;
}
label {
  display: block;
  font-weight: bold;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}
.input-with-button {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.input-with-button input {
  flex-grow: 1;
}
.button.small {
  padding: 8px 12px;
  font-size: 0.8rem;
  margin: 0;
  white-space: nowrap;
}
.roles-group {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  background-color: var(--secondary-bg);
  padding: 1rem;
  border-radius: 5px;
}
.roles-group label {
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}
.tooltip {
    visibility: hidden;
    width: 220px;
    background-color: #555;
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 5px 10px;
    position: absolute;
    z-index: 1;
    bottom: 125%;
    left: 50%;
    margin-left: -110px;
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.8rem;
    pointer-events: none;
}
.roles-group label:hover .tooltip {
    visibility: visible;
    opacity: 1;
}
.global-mode-text {
  font-size: 0.9rem;
  font-style: italic;
  color: #888;
  margin-top: 0.5rem;
}
.button-group {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>