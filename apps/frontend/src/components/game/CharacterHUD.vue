<!-- 文件路径: apps/frontend/src/components/game/CharacterHUD.vue (已最终修复) -->
<template>
  <div id="character-hud" class="game-panel">
    <h3>角色状态</h3>
    
    <template v-if="gameStore.currentGame && gameStore.currentGame.character">
      <div 
        class="button" 
        @click="uiStore.showCharacterSheetModal" 
        style="width: 100%; box-sizing: border-box; margin: 10px 0;"
      >
        查看化身档案
      </div>
      
      <div class="panel-content">
        <div class="stat-bar">
          <label>
            生命值 (HP): {{ gameStore.currentGame.character.hp }} / {{ gameStore.currentGame.character.maxHp }}
          </label>
          <div class="bar-container">
            <div 
              class="bar-fill health" 
              :style="{ width: hpPercentage }"
            ></div>
          </div>
        </div>
        
        <div class="stat-bar">
          <label>
            精神力 (MP): {{ gameStore.currentGame.character.mp }} / {{ gameStore.currentGame.character.maxMp }}
          </label>
          <div class="bar-container">
            <div 
              class="bar-fill mana" 
              :style="{ width: mpPercentage }"
            ></div>
          </div>
        </div>
        
        <div id="status-effects">
          <h4>当前状态</h4>
          <p><span>{{ gameStore.currentGame.character.status || '未知' }}</span></p>
        </div>
      </div>
    </template>

    <div v-else class="panel-content">
      <p>正在等待化身数据...</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/game.store';
// [核心修正] 导入正确的 store 和函数名
import { useUIStore } from '@/stores/ui.store';

const gameStore = useGameStore();
// [核心修正] 获取正确的 store 实例
const uiStore = useUIStore();

const hpPercentage = computed(() => {
  const char = gameStore.currentGame?.character;
  if (!char || !char.maxHp) return '0%';
  return `${(char.hp / char.maxHp) * 100}%`;
});

const mpPercentage = computed(() => {
  const char = gameStore.currentGame?.character;
  if (!char || !char.maxMp) return '0%';
  return `${(char.mp / char.maxMp) * 100}%`;
});
</script>