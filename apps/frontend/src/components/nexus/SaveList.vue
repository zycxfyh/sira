<!-- 文件路径: src/components/nexus/SaveList.vue -->
<script setup>
defineProps({
  gameList: {
    type: Array,
    required: true,
  },
  isLoading: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits(['load-game', 'delete-game']);

function onLoadGame(gameId) {
  emit('load-game', gameId);
}

function onDeleteGame(gameId) {
  emit('delete-game', gameId);
}
</script>

<template>
  <div>
    <p v-if="isLoading">正在读取档案...</p>

    <div v-else-if="gameList.length > 0" class="save-list">
      <div v-for="game in gameList" :key="game.id" class="save-item" @click="onLoadGame(game.id)">
        <span class="save-item-name">{{ game.name || '未命名世界' }}</span>
        <button class="button save-item-delete" @click.stop="onDeleteGame(game.id)">删除</button>
      </div>
    </div>

    <p v-else>未找到任何化身档案。</p>
  </div>
</template>
