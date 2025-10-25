// 文件路径: src/main.js (已最终重构)

import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import * as Sentry from "@sentry/vue";

import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth.store';
import { useRealtimeStore } from './stores/realtime.store';
import { useUIStore } from './stores/ui.store';

const app = createApp(App);

Sentry.init({
  app,
  dsn: "https://32649f48cc92311f48b725cd96c3dbe3@o4510229377384448.ingest.us.sentry.io/4510229411790848",
  integrations: [
    Sentry.browserTracingIntegration({ router }),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 1.0, 
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
  environment: import.meta.env.MODE,
});

const pinia = createPinia();
app.use(pinia);
app.use(router);

// [核心重构] 将 router 实例存入 ui.store，以便 store 可以访问
const uiStore = useUIStore();
uiStore.setRouter(router);

app.mount('#app');

// --- [核心重构] 建立响应式的实时连接 ---
const authStore = useAuthStore();
const realtimeStore = useRealtimeStore();

// 订阅 auth.store 的状态变化
authStore.$subscribe((mutation, state) => {
  const newToken = state.token;
  // 确保 oldToken 的获取方式在 Pinia 中是健壮的
  const oldToken = mutation.events?.oldValue ?? null;

  if (newToken && !oldToken) {
    console.log('[main.js] User logged in. Connecting to realtime service...');
    realtimeStore.connect();
  } else if (!newToken && oldToken) {
    console.log('[main.js] User logged out. Disconnecting from realtime service...');
    realtimeStore.disconnect();
  }
});

// 在应用加载时，检查是否已经处于登录状态
if (authStore.isLoggedIn) {
  console.log('[main.js] Initial state is logged in. Connecting to realtime service...');
  realtimeStore.connect();
}