// 文件路径: apps/frontend/src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

import WelcomeView from '@/views/WelcomeView.vue';
import LoginView from '@/views/LoginView.vue';
import NexusHubView from '@/views/NexusHubView.vue';
import CreationHubView from '@/views/CreationHubView.vue';
import GameView from '@/views/GameView.vue';

const routes = [
  { path: '/', name: 'Welcome', component: WelcomeView },
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/nexus', name: 'NexusHub', component: NexusHubView, meta: { requiresAuth: true } },
  {
    path: '/creation',
    name: 'CreationHub',
    component: CreationHubView,
    meta: { requiresAuth: true },
  },
  {
    path: '/game/:id',
    name: 'Game',
    component: GameView,
    props: true,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  // Pinia store必须在导航守卫函数内部获取，以确保Pinia已初始化
  const authStore = useAuthStore();
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  if (requiresAuth && !authStore.isLoggedIn) {
    next({ name: 'Login' });
  } else if (to.name === 'Login' && authStore.isLoggedIn) {
    next({ name: 'NexusHub' });
  } else {
    next();
  }
});

export default router;
