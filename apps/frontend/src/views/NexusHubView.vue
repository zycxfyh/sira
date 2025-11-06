<!-- 文件路径: apps/frontend/src/views/NexusHubView.vue (已更新) -->
<template>
  <div class="page active">
    <div class="top-right-actions">
      <span @click="settingsStore.showAiSettingsModal" class="api-settings-icon" title="AI指挥中心">
        ⚙️
      </span>
    </div>

    <div class="center-content" style="justify-content: flex-start; padding-top: 2rem">
      <h2>观测者中枢</h2>
      <p>这里是您在每次旅程之间的永恒基地与强化中心。</p>
      <div class="nexus-main-layout">
        <div class="nexus-panel">
          <h3>新的开始</h3>
          <p>开启一次全新的化身，探索未知的世界。</p>
          <router-link to="/creation" class="button primary">开启一次新的化身</router-link>
        </div>
        <div class="nexus-panel">
          <h3>读取化身档案</h3>
          <p>从之前的决策点继续您的旅程。</p>

          <SaveList
            :is-loading="isLoading"
            :game-list="gameList"
            @load-game="loadGame"
            @delete-game="deleteGame"
          />
        </div>
      </div>
      <div class="button-group" style="justify-content: center">
        <button @click="authStore.logout()" class="button">断开连接</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { apiService } from '@/services/api.service';
import { useToast } from '@/composables/useToast';
import SaveList from '@/components/nexus/SaveList.vue';

const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const router = useRouter();
const { show: showToast } = useToast();

const gameList = ref([]);
const isLoading = ref(true);

async function fetchGames() {
  isLoading.value = true;
  try {
    gameList.value = await apiService.games.getAll();
  } catch (error) {
    showToast(`读取档案失败: ${error.message}`, 'error');
  } finally {
    isLoading.value = false;
  }
}

function loadGame(gameId) {
  router.push(`/game/${gameId}`);
}

async function deleteGame(gameId) {
  if (!confirm(`确定要永久删除此化身档案吗？此操作无法撤销。`)) {
    return;
  }
  try {
    const response = await apiService.games.delete(gameId);
    showToast(response.message, 'success');
    await fetchGames();
  } catch (error) {
    showToast(`删除失败: ${error.message}`, 'error');
  }
}

onMounted(fetchGames);
</script>

<style scoped>
.top-right-actions {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 10;
}

.api-settings-icon {
  font-size: 1.8rem;
  cursor: pointer;
  padding: 8px;
  border-radius: 50%;
  transition:
    background-color 0.3s,
    transform 0.3s;
  display: inline-block;
}

.api-settings-icon:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: rotate(45deg);
}
</style>
