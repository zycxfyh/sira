// apps/frontend/src/stores/auth.store.js
// 修复点：login() 在请求 profile 之前先把 token 写入 localStorage（拦截器依赖 localStorage）
// 订阅全局事件 'api:unauthorized' 以保证在被动 401 时清理本地状态并跳转

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '@/services/api.service';
import { useUIStore } from './ui.store';
import * as Sentry from '@sentry/vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('user-token') || null);
  const user = ref(null);
  try {
    const raw = localStorage.getItem('user-info');
    user.value = raw ? JSON.parse(raw) : null;
  } catch (e) {
    user.value = null;
  }

  const isLoggedIn = computed(() => !!token.value);

  function setAuth(newToken, newUserInfo) {
    user.value = newUserInfo;
    token.value = newToken;
    try {
      if (newToken) {
        localStorage.setItem('user-token', newToken);
      } else {
        localStorage.removeItem('user-token');
      }
      if (newUserInfo) {
        localStorage.setItem('user-info', JSON.stringify(newUserInfo));
      } else {
        localStorage.removeItem('user-info');
      }
    } catch (e) {
      // ignore localStorage write errors
    }
    // Sentry 用户上下文
    try {
      if (newUserInfo) {
        Sentry.setUser({ id: newUserInfo.id, email: newUserInfo.email });
      } else {
        Sentry.setUser(null);
      }
    } catch (e) {
      // ignore if Sentry not available
    }
  }

  function clearAuth() {
    user.value = null;
    token.value = null;
    try {
      localStorage.removeItem('user-token');
      localStorage.removeItem('user-info');
    } catch (e) {
      // ignore
    }
    try {
      Sentry.setUser(null);
    } catch (e) {}
    // 导航到登录页（如果路由已注入 ui store）
    const uiStore = useUIStore();
    if (uiStore.router && uiStore.router.currentRoute.value?.name !== 'Login') {
      uiStore.router.push({ name: 'Login' }).catch(() => {});
    }
  }

  // 注册 API 全局未授权事件，确保被动 401 时也能退出登录
  // 注意：不要在 SSR 情况下执行 window 操作（此仓库假设浏览器环境）
  if (typeof window !== 'undefined') {
    window.addEventListener('api:unauthorized', () => {
      // 不要自动弹窗或二次请求，直接清理状态即可
      clearAuth();
    });
  }

  async function register(credentials) {
    return apiService.auth.register(credentials);
  }

  async function login(credentials) {
    try {
      // 登录请求。返回值形如 { access_token: '...' } 或取决于后端
      const loginResponse = await apiService.auth.login(credentials);

      // 后端可能返回 access_token 或 token 字段，兼容两种
      const accessToken =
        loginResponse?.access_token ?? loginResponse?.token ?? loginResponse?.accessToken ?? null;

      if (!accessToken) {
        throw new Error('Login response did not include access token.');
      }

      // 关键：在请求 profile 之前先把 token 写入 localStorage（拦截器从 localStorage 读取）
      token.value = accessToken;
      try {
        localStorage.setItem('user-token', accessToken);
      } catch (e) {
        // ignore
      }

      // 现在 getProfile 会走拦截器并携带 Authorization header
      const profile = await apiService.auth.getProfile();

      // 将 token + profile 固定入 state/localStorage 并上报 Sentry
      setAuth(accessToken, profile);

      return { token: accessToken, profile };
    } catch (error) {
      // 登录失败则清理
      clearAuth();
      console.error('[AuthStore] Login failed:', error);
      throw error;
    }
  }

  function logout() {
    clearAuth();
  }

  async function verifyAuthOnLoad() {
    if (token.value) {
      try {
        const freshProfile = await apiService.auth.getProfile();
        setAuth(token.value, freshProfile);
      } catch (error) {
        // token 无效或请求失败，清理本地状态
        console.warn('[AuthStore] verifyAuthOnLoad failed:', error?.message ?? error);
        clearAuth();
      }
    }
  }

  return {
    token,
    user,
    isLoggedIn,
    setAuth,
    register,
    login,
    logout,
    verifyAuthOnLoad,
  };
});
