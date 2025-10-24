// apps/frontend/src/stores/realtime.store.js
// 目标：防止重复绑定事件、在 disconnect 时解绑所有 handler、实现简单重连/backoff 逻辑
// 依赖：realtimeService（需提供 connect(), disconnect(), on(), off(), isConnected() 或 connected flag），
//        useGameStore, useJobsStore, useUIStore, useToast

import { defineStore } from 'pinia';
import { useToast } from '@/composables/useToast';
import { realtimeService } from '@/services/realtime.service';
import { useGameStore } from './game.store';
import { useJobsStore } from './jobs.store';
import { useUIStore } from './ui.store';

export const useRealtimeStore = defineStore('realtime', () => {
  const { show: showToast } = useToast();

  // internal flags and handler refs so we can off() them later
  let _isBound = false;
  let _isConnected = false;
  let _reconnectAttempts = 0;
  let _reconnectTimer = null;

  // Named handlers so we can remove them
  const handlers = {
    onConnect: () => {
      _isConnected = true;
      _reconnectAttempts = 0;
      const uiStore = useUIStore();
      uiStore.setConnectionStatus('connected');
      console.log('[Realtime] connected');
    },

    onDisconnect: (reason) => {
      _isConnected = false;
      const uiStore = useUIStore();
      uiStore.setConnectionStatus('disconnected');
      console.warn('[Realtime] disconnected:', reason);
      // Try reconnect with backoff
      scheduleReconnectWithBackoff();
    },

    onProcessingStarted: (data) => {
      const gameStore = useGameStore();
      gameStore.handleProcessingStarted(data);
    },

    onProcessingCompleted: (data) => {
      const gameStore = useGameStore();
      gameStore.handleProcessingCompleted(data);
    },

    onProcessingFailed: (data) => {
      const gameStore = useGameStore();
      gameStore.handleProcessingFailed(data);
    },

    onCreationCompleted: (data) => {
      const jobsStore = useJobsStore();
      const uiStore = useUIStore();
      showToast(data.message || 'New world created!', 'success');
      if (data.jobId) {
        jobsStore.updateJob(data.jobId, { status: 'success' });
      }
      if (data.gameId && uiStore.router) {
        uiStore.router.push(`/game/${data.gameId}`).catch(() => {});
      }
    },

    onCreationFailed: (data) => {
      const jobsStore = useJobsStore();
      showToast(data.error || 'World creation failed.', 'error');
      if (data.jobId) {
        jobsStore.updateJob(data.jobId, { status: 'failed', error: data.error });
      }
    },
  };

  // Backoff reconnect: exponential with jitter, capped
  function scheduleReconnectWithBackoff() {
    if (_reconnectTimer) return; // already scheduled
    _reconnectAttempts += 1;
    const maxAttempts = 8;
    if (_reconnectAttempts > maxAttempts) {
      console.error('[Realtime] max reconnect attempts reached');
      return;
    }
    // base ms
    const base = 1000;
    const backoff = Math.min(30000, base * 2 ** (_reconnectAttempts - 1));
    // add jitter +/- 20%
    const jitter = Math.floor(backoff * 0.2 * (Math.random() - 0.5));
    const delay = backoff + jitter;

    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      try {
        connect(); // attempt reconnect
      } catch (e) {
        console.error('[Realtime] reconnect attempt failed:', e);
        scheduleReconnectWithBackoff();
      }
    }, delay);
  }

  // Bind event handlers idempotently
  function bindHandlers() {
    if (_isBound) return;
    if (!realtimeService) {
      console.warn('[Realtime] realtimeService not available');
      return;
    }

    // Use 'on' to register named handlers
    realtimeService.on('connect', handlers.onConnect);
    realtimeService.on('disconnect', handlers.onDisconnect);

    realtimeService.on('processing_started', handlers.onProcessingStarted);
    realtimeService.on('processing_completed', handlers.onProcessingCompleted);
    realtimeService.on('processing_failed', handlers.onProcessingFailed);

    realtimeService.on('creation_completed', handlers.onCreationCompleted);
    realtimeService.on('creation_failed', handlers.onCreationFailed);

    _isBound = true;
  }

  // Unbind handlers
  function unbindHandlers() {
    if (!_isBound || !realtimeService) return;
    try {
      realtimeService.off('connect', handlers.onConnect);
      realtimeService.off('disconnect', handlers.onDisconnect);

      realtimeService.off('processing_started', handlers.onProcessingStarted);
      realtimeService.off('processing_completed', handlers.onProcessingCompleted);
      realtimeService.off('processing_failed', handlers.onProcessingFailed);

      realtimeService.off('creation_completed', handlers.onCreationCompleted);
      realtimeService.off('creation_failed', handlers.onCreationFailed);
    } catch (e) {
      // Some adapters expose removeListener / removeAllListeners only
      try {
        if (typeof realtimeService.removeAllListeners === 'function') {
          realtimeService.removeAllListeners();
        }
      } catch (err) {
        console.warn('[Realtime] unbindHandlers fallback failed', err);
      }
    } finally {
      _isBound = false;
    }
  }

  // Public API -----------------------------------------------------------

  function connect() {
    // idempotent: if service exposes isConnected(), use that; otherwise rely on local flag
    const remoteIsConnected =
      realtimeService && typeof realtimeService.isConnected === 'function'
        ? realtimeService.isConnected()
        : !!realtimeService?.connected || _isConnected;

    if (remoteIsConnected) {
      // ensure handlers are bound
      bindHandlers();
      return;
    }

    // Bind handlers first to catch events during connect
    bindHandlers();

    try {
      realtimeService.connect();
      // if realtimeService.connect is synchronous, handlers will see 'connect'
      // otherwise onConnect will set _isConnected
    } catch (error) {
      console.error('[Realtime] connect error:', error);
      scheduleReconnectWithBackoff();
    }
  }

  function disconnect() {
    // Cancel any pending reconnect
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    try {
      if (realtimeService && typeof realtimeService.disconnect === 'function') {
        realtimeService.disconnect();
      }
    } catch (e) {
      console.warn('[Realtime] disconnect warning', e);
    } finally {
      unbindHandlers();
      _isConnected = false;
    }
  }

  return {
    connect,
    disconnect,
  };
});
