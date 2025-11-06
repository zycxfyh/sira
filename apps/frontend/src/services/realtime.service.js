// 文件路径: src/services/realtime.service.js

import { io } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

/**
 * @class RealtimeService
 * @description 一个单例服务，用于管理与后端 WebSocket 服务器的连接和事件通信。
 */
class RealtimeService {
  /**
   * @type {RealtimeService | null}
   * @private
   */
  static _instance = null;

  /**
   * @type {import('socket.io-client').Socket | null}
   * @private
   */
  socket = null;

  /**
   * 获取 RealtimeService 的单例实例。
   * @returns {RealtimeService}
   */
  static getInstance() {
    if (!RealtimeService._instance) {
      RealtimeService._instance = new RealtimeService();
    }
    return RealtimeService._instance;
  }

  /**
   * [核心] 建立与 WebSocket 服务器的连接。
   * 这个方法是幂等的，即多次调用不会创建多个连接。
   */
  connect() {
    // 如果已经连接或正在连接，则不执行任何操作
    if (this.socket && this.socket.connected) {
      console.log('[RealtimeService] Already connected.');
      return;
    }

    const authStore = useAuthStore();
    if (!authStore.isLoggedIn || !authStore.user) {
      console.error('[RealtimeService] Cannot connect without a logged-in user.');
      return;
    }

    // 从 .env.local 或默认值获取后端API基地址
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    // 将 http://localhost:3000 转换为 ws://localhost:8080
    // 这是一个简化的转换，假设 WebSocket 端口总是 8080
    // 在生产环境中，这应该通过更健壮的方式配置
    const wsUrl = apiBaseUrl.replace('http', 'ws').replace('3000', '8080');

    console.log(`[RealtimeService] Attempting to connect to ${wsUrl}/updates...`);

    // 创建 socket 实例
    this.socket = io(`${wsUrl}/updates`, {
      // [关键] 在连接握手时，通过查询参数将用户的唯一标识符发送给后端。
      // 后端 UpdatesGateway 将使用这个 userId 来建立 socketId -> userId 的映射。
      query: {
        userId: authStore.user.id,
      },
      transports: ['websocket'], // 强制使用 WebSocket 传输
      reconnectionAttempts: 5, // 尝试重连5次
      reconnectionDelay: 3000, // 每次重连间隔3秒
    });

    // --- 监听内置事件以进行调试和状态管理 ---

    this.socket.on('connect', () => {
      console.log(`[RealtimeService] Successfully connected with socket ID: ${this.socket.id}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn(`[RealtimeService] Disconnected. Reason: ${reason}`);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[RealtimeService] Connection Error:', error.message);
    });
  }

  /**
   * [核心] 断开与 WebSocket 服务器的连接。
   */
  disconnect() {
    if (this.socket) {
      console.log('[RealtimeService] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * [核心] 监听来自服务器的特定事件。
   * @param {string} eventName - 要监听的事件名称 (e.g., 'processing_completed')
   * @param {(...args: any[]) => void} callback - 事件触发时执行的回调函数
   */
  on(eventName, callback) {
    if (!this.socket) {
      console.error(
        `[RealtimeService] Cannot listen to event '${eventName}'. Socket is not connected.`,
      );
      return;
    }
    this.socket.on(eventName, callback);
  }

  /**
   * [核心] 移除对特定事件的监听。
   * 在组件销毁时调用此方法，以防止内存泄漏。
   * @param {string} eventName - 要移除监听的事件名称
   */
  off(eventName) {
    if (!this.socket) {
      return;
    }
    this.socket.off(eventName);
  }
}

// 导出单例实例，而不是类本身。
// 这确保了在整个应用中，所有导入此模块的地方都使用同一个 RealtimeService 实例。
export const realtimeService = RealtimeService.getInstance();
