// apps/frontend/src/stores/app.store.js

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  // 用于在创世流程中临时存储上传的角色卡数据
  const uploadedCharacterCard = ref(null);

  function setUploadedCharacterCard(cardData) {
    uploadedCharacterCard.value = cardData;
  }

  function clearUploadedCharacterCard() {
    uploadedCharacterCard.value = null;
  }

  return {
    uploadedCharacterCard,
    setUploadedCharacterCard,
    clearUploadedCharacterCard,
  };
});
