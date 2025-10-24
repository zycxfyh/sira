<!-- 文件路径: src/components/game/MainInteractionPanel.vue (UI优化版) -->
<script setup>
import { useGameStore } from '@/stores/game.store';

const gameStore = useGameStore();

function submitCommand() {
  const commandText = gameStore.commandInputValue.trim();
  if (commandText && gameStore.currentGame) {
    gameStore.submitAction(gameStore.currentGame.id, 'command', commandText);
    gameStore.commandInputValue = '';
  }
}

function handleOptionClick(option) {
  if (gameStore.currentGame) {
    gameStore.submitAction(gameStore.currentGame.id, 'option', option);
  }
}
</script>

<template>
    <div class="main-interaction-panel game-panel">
        <div id="narrative-window">
          <p v-for="(entry, index) in gameStore.narrativeLog" :key="index"
             :style="{ fontStyle: entry.isMeta ? 'italic' : 'normal', color: entry.isMeta ? '#aaa' : 'var(--primary-text)' }">
            {{ entry.text }}
          </p>
        </div>

        <!-- [核心优化] 当 isAiThinking 为 true 时，禁用所有选项 -->
        <div id="options-container">
          <button 
            v-for="option in gameStore.currentGame?.options" 
            :key="option.text" 
            class="option-button" 
            @click="handleOptionClick(option)"
            :disabled="gameStore.isAiThinking"
          >
            <div class="option-header">{{ option.dimension }}</div>
            <div class="option-details">{{ option.text }} ({{ option.success_rate }})</div>
          </button>
        </div>

        <!-- [核心优化] 当 isAiThinking 为 true 时，禁用输入框和提交按钮 -->
        <div id="command-input-container">
          <input 
            type="text" 
            id="command-input" 
            placeholder="输入你的自定义行动..."
            v-model="gameStore.commandInputValue"
            @keyup.enter="submitCommand"
            :disabled="gameStore.isAiThinking"
          />
          <button 
            id="command-submit" 
            class="button primary" 
            @click="submitCommand"
            :disabled="gameStore.isAiThinking"
          >
            {{ gameStore.isAiThinking ? '思考中...' : '执行' }}
          </button>
        </div>
    </div>
</template>