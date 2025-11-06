<!-- 文件路径: src/views/GameView.vue (瘦身版) -->
<template>
  <div id="main-game-screen" class="page active">
    <div v-if="isLoading" class="center-content">
      <h2>正在降临至世界...</h2>
    </div>

    <div v-else-if="gameStore.currentGame" class="game-layout">
      <CharacterHUD />
      <MainInteractionPanel />
      <WorldHUD />
    </div>

    <div v-else class="center-content">
      <h2>降临失败</h2>
      <p>{{ error || '无法加载游戏世界。该存档可能已损坏或不存在。' }}</p>
      <router-link to="/nexus" class="button">返回中枢</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'; // [核心修正] 移除了 onUnmounted
import { useGameStore } from '@/stores/game.store';
import { useToast } from '@/composables/useToast';
import { useRouter } from 'vue-router'; // [新增] 导入 useRouter

// 导入所有子组件
import CharacterHUD from '@/components/game/CharacterHUD.vue';
import MainInteractionPanel from '@/components/game/MainInteractionPanel.vue';
import WorldHUD from '@/components/game/WorldHUD.vue';

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
});

const gameStore = useGameStore();
const { show: showToast } = useToast();
const router = useRouter(); // [新增] 获取 router 实例

const isLoading = ref(true);
const error = ref(null);

// [核心重构] onMounted 现在只负责加载初始游戏数据
onMounted(async () => {
  error.value = null;
  isLoading.value = true;

  try {
    // [注释] loadGame 现在只获取HTTP数据。WebSocket连接已由 authStore 状态自动管理。
    await gameStore.loadGame(props.id);
  } catch (err) {
    error.value = err.message;
    showToast(`加载世界失败: ${err.message}`, 'error');
    // [注释] 可以在加载失败后，自动导航回主菜单
    // router.push('/nexus');
  } finally {
    isLoading.value = false;
  }
});

// [核心重构] onUnmounted hook 已被完全移除。
// game.store 不再需要手动清理，因为它不持有任何需要清理的监听器。
// realtime.store 的生命周期与用户登录状态绑定，不受单个视图切换的影响。
</script>
