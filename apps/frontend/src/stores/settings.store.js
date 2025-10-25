// apps/frontend/src/stores/settings.store.js
// 修正并增强：兼容后端返回的 roles: []（或旧的 assignedRoles 字符串）
// 在向后端提交时统一发送 roles: string[]（比发送 CSV 更稳健）
// 返回给 UI 的每个配置都会包含一个兼容字段 `roles`（string[]）和 `assignedRoles`（CSV，仅用于兼容旧 UI）

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '@/services/api.service';
import { useToast } from '@/composables/useToast';
import { useUIStore } from './ui.store';

// 同步到后端的所有可能角色（前端视图使用）
export const ALL_AI_ROLES = [
  'logic_parsing',
  'narrative_synthesis',
  'planner',
  'critic',
];

export const useSettingsStore = defineStore('settings', () => {
  const { show: showToast } = useToast();
  const uiStore = useUIStore();

  // State
  const aiConfigurations = ref([]); // each item normalized to include .roles: string[]
  const isLoading = ref(false);
  const configViewMode = ref('simple'); // 'simple' | 'expert'

  // Helpers --------------------------------------------------------------

  // Normalize a single config object coming from the server to a stable shape for UI
  function normalizeConfigFromServer(raw) {
    // raw may have:
    // - roles: [{ id?, name? }, 'logic_parsing', ...] OR ['logic_parsing', ...]
    // - assignedRoles: 'logic_parsing,narrative_synthesis' (legacy)
    const c = { ...raw };

    // Normalize roles to string[]
    if (Array.isArray(c.roles)) {
      // roles might be array of strings or array of objects
      c.roles = c.roles.map((r) => (typeof r === 'string' ? r : r.name || r.id || '')).filter(Boolean);
    } else if (typeof c.assignedRoles === 'string') {
      c.roles = c.assignedRoles
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      c.roles = [];
    }

    // Keep legacy CSV for UI components that still expect it
    c.assignedRoles = (c.roles && c.roles.length > 0) ? c.roles.join(',') : '';

    // Mark new configs (client-side only)
    if (c.isNew === undefined) c.isNew = false;

    return c;
  }

  // Convert UI object to payload expected by server (prefer roles: string[])
  function buildPayloadForServer(form) {
    // form may include assignedRoles string or roles array
    let roles = [];
    if (Array.isArray(form.roles)) {
      roles = form.roles;
    } else if (typeof form.assignedRoles === 'string') {
      roles = form.assignedRoles.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return {
      provider: form.provider ?? '',
      apiKey: form.apiKey ?? '',
      modelId: form.modelId ?? '',
      baseUrl: form.baseUrl ?? null,
      // Send roles as array of strings; backend should accept this.
      roles,
    };
  }

  // Computed -------------------------------------------------------------

  const globalAiConfig = computed(() => {
    const list = aiConfigurations.value || [];
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];

    // prefer config that contains all roles
    const full = list.find((c) => Array.isArray(c.roles) && c.roles.length === ALL_AI_ROLES.length);
    return full || null;
  });

  // Actions --------------------------------------------------------------

  async function fetchAiConfigurations() {
    isLoading.value = true;
    try {
      const raw = await apiService.settings.getAllAiConfigurations();
      if (!Array.isArray(raw)) {
        // defensive: if server returns an object with data, try unwrap
        if (raw && Array.isArray(raw.data)) {
          aiConfigurations.value = raw.data.map(normalizeConfigFromServer);
        } else {
          aiConfigurations.value = [];
          showToast('后端返回的 AI 配置格式异常', 'error');
        }
      } else {
        aiConfigurations.value = raw.map(normalizeConfigFromServer);
      }
    } catch (error) {
      console.error('[SettingsStore] fetchAiConfigurations error:', error);
      showToast(`获取AI配置失败: ${error.message || error}`, 'error');
    } finally {
      isLoading.value = false;
    }
  }

  function setConfigViewMode(mode) {
    configViewMode.value = mode === 'expert' ? 'expert' : 'simple';
  }

  function addNewConfigCard() {
    const newConfig = {
      id: `new_${Date.now()}`,
      provider: '',
      apiKey: '',
      modelId: '',
      baseUrl: '',
      roles: [],
      assignedRoles: '',
      isNew: true,
    };
    aiConfigurations.value.push(newConfig);
    configViewMode.value = 'expert';
  }

  function removeNewConfigCard(id) {
    aiConfigurations.value = aiConfigurations.value.filter((c) => c.id !== id);
  }

  async function createAiConfiguration(creationData) {
    isLoading.value = true;
    try {
      const payload = buildPayloadForServer(creationData);
      await apiService.settings.createAiConfiguration(payload);
      showToast('AI配置已成功创建！', 'success');
      await fetchAiConfigurations();
    } catch (error) {
      console.error('[SettingsStore] createAiConfiguration error:', error);
      showToast(`创建失败: ${error?.details ? JSON.stringify(error.details) : error.message}`, 'error');
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateAiConfiguration(id, updateData) {
    isLoading.value = true;
    try {
      const payload = buildPayloadForServer(updateData);
      await apiService.settings.updateAiConfiguration(id, payload);
      showToast('AI配置已成功更新！', 'success');
      await fetchAiConfigurations();
    } catch (error) {
      console.error('[SettingsStore] updateAiConfiguration error:', error);
      showToast(`更新失败: ${error?.details ? JSON.stringify(error.details) : error.message}`, 'error');
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteAiConfiguration(id) {
    isLoading.value = true;
    try {
      await apiService.settings.deleteAiConfiguration(id);
      showToast('AI配置已成功删除！', 'success');
      aiConfigurations.value = aiConfigurations.value.filter((c) => c.id !== id);
    } catch (error) {
      console.error('[SettingsStore] deleteAiConfiguration error:', error);
      showToast(`删除失败: ${error.message}`, 'error');
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  function showAiSettingsModal() {
    // 确保在显示前刷新数据
    fetchAiConfigurations().finally(() => {
      uiStore.showAiSettingsModal();
    });
  }

  // Expose
  return {
    aiConfigurations,
    isLoading,
    configViewMode,
    globalAiConfig,

    fetchAiConfigurations,
    setConfigViewMode,
    addNewConfigCard,
    removeNewConfigCard,
    createAiConfiguration,
    updateAiConfiguration,
    deleteAiConfiguration,
    showAiSettingsModal,

    hideAiSettingsModal: uiStore.hideAiSettingsModal,
  };
});
