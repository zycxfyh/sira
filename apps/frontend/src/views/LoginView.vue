<!-- 文件路径: src/views/LoginView.vue -->
<template>
  <div class="page active">
    <div class="center-content">
      <!-- 根据当前模式显示不同的标题 -->
      <h2>{{ isLoginMode ? '观测者登录' : '成为新的观测者' }}</h2>

      <!-- 登录/注册表单 -->
      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <label for="email">邮箱地址:</label>
          <input
            id="email"
            type="email"
            v-model="credentials.email"
            placeholder="your@email.com"
            required
          />
        </div>
        <div class="form-group">
          <label for="password">密码:</label>
          <input
            id="password"
            type="password"
            v-model="credentials.password"
            placeholder="至少8个字符"
            required
          />
        </div>

        <!-- 错误信息展示 -->
        <p v-if="error" class="error-message">{{ error }}</p>

        <!-- 提交按钮 -->
        <button type="submit" class="button primary" :disabled="isLoading">
          {{ isLoading ? '处理中...' : (isLoginMode ? '登录' : '注册') }}
        </button>
      </form>

      <!-- 切换模式的链接 -->
      <p class="switch-mode">
        {{ isLoginMode ? '还没有账户？' : '已有账户？' }}
        <a @click.prevent="toggleMode">{{ isLoginMode ? '立即注册' : '点击登录' }}</a>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router'; // <-- [核心修正] 导入 useRouter
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from '@/composables/useToast';

// true: 登录模式, false: 注册模式
const isLoginMode = ref(true);
const credentials = ref({ email: '', password: '' });
const isLoading = ref(false);
const error = ref(null);

const authStore = useAuthStore();
const router = useRouter(); // <-- [核心修正] 获取 router 实例
const { show: showToast } = useToast();

function toggleMode() {
  isLoginMode.value = !isLoginMode.value;
  error.value = null;
}

async function handleSubmit() {
  error.value = null;
  isLoading.value = true;

  try {
    if (isLoginMode.value) {
      await authStore.login(credentials.value);
      // [核心修正] 在登录成功后，手动触发路由跳转
      await router.push('/nexus');
    } else {
      await authStore.register(credentials.value);
      showToast('注册成功！请使用您的新账户登录。', 'success');
      toggleMode();
    }
  } catch (err) {
    // 捕获AuthStore或API服务抛出的错误
    // 确保 err 是一个对象并且有 message 属性
    error.value = (err && err.message) ? err.message : '发生未知错误';
  } finally {
    isLoading.value = false;
  }
}
</script>
<style scoped>
/* 为这个视图添加一些特定的样式 */
.auth-form {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.form-group label {
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.error-message {
  color: var(--error-color);
  margin: 0;
  text-align: center;
}

.switch-mode {
  margin-top: 1.5rem;
}

.switch-mode a {
  color: var(--accent-color);
  text-decoration: underline;
  cursor: pointer;
  margin-left: 0.5rem;
}
</style>