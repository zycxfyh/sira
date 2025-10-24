// apps/frontend/src/services/api.service.js
// 目的：移除对 Pinia 的直接依赖，拦截器从 localStorage 获取 token。
// 遇到 401 时触发 window 事件 'api:unauthorized'，由上层（auth.store / app）处理登出。

import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  // 你可以在这里添加 timeout 等全局配置
});

// Request interceptor: 不依赖 Pinia，直接从 localStorage 读取 token
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('user-token');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // 如果 localStorage 不可用（SSR/隐私模式），忽略
      // console.warn('Could not read localStorage token', e);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: 返回 response.data，统一错误包装。
// 401 => 触发全局事件 'api:unauthorized'（不直接调用 store）
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem('user-token');
        localStorage.removeItem('user-info');
      } catch (e) {
        // ignore
      }
      // 触发全局事件，由应用层（auth.store 或 main.js）监听并处理 logout/跳转
      try {
        window.dispatchEvent(new CustomEvent('api:unauthorized', { detail: { status: 401 } }));
      } catch (e) {
        // ignore if window not available
      }
    }

    const errorMessage = error.response?.data?.message || error.message || 'Unknown API error';
    const enhancedError = new Error(errorMessage);
    enhancedError.details = error.response?.data?.errors || null;
    enhancedError.status = status || null;
    return Promise.reject(enhancedError);
  },
);

// API surface: 按功能分组，和你之前的 apiService 保持一致的形状
const authService = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userInfo) => apiClient.post('/auth/register', userInfo),
  getProfile: () => apiClient.get('/auth/profile'),
};

const gamesService = {
  getAll: () => apiClient.get('/games'),
  getById: (id) => apiClient.get(`/games/${id}`),
  createNarrative: (concept) => apiClient.post('/games/narrative-driven', concept),
  submitAction: (id, action) => apiClient.post(`/games/${id}/actions`, action),
  delete: (id) => apiClient.delete(`/games/${id}`),
  updateCharacter: (id, data) => apiClient.patch(`/games/${id}/character`, data),
};

const settingsService = {
  getAllAiConfigurations: () => apiClient.get('/settings/ai-configurations'),
  createAiConfiguration: (configData) => apiClient.post('/settings/ai-configurations', configData),
  updateAiConfiguration: (id, updateData) => apiClient.patch(`/settings/ai-configurations/${id}`, updateData),
  deleteAiConfiguration: (id) => apiClient.delete(`/settings/ai-configurations/${id}`),
  testConnection: (payload) => apiClient.post('/settings/ai-configurations/test-connection', payload),
};

export const apiService = {
  auth: authService,
  games: gamesService,
  settings: settingsService,
};

export default apiService;
