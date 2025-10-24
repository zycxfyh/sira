<!-- 文件路径: src/views/WelcomeView.vue (Sentry测试版) -->
<template>
  <div class="page active">
    <div class="center-content">
      <h1>协议 V8.2 已激活</h1>
      <p>欢迎，尊敬的“观测者”。<br />“中枢系统 (Nexus)” 已准备就绪。</p>
      <router-link to="/login" class="button primary">连接至中枢系统</router-link>

      <!-- ===== 这是我们新增的“红色按钮” ===== -->
      <button @click="triggerFrontendError" class="button" style="margin-top: 20px; border-color: red; color: red;">
        触发前端Sentry测试
      </button>
      <!-- =================================== -->

    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';

function triggerFrontendError() {
  throw new Error('Sentry Frontend Test - ' + new Date().toISOString());
}
</script>