const WebSocket = require("ws");
const { StreamingManager } = require("../streaming-manager");

let streamingManager = null;
let wss = null;

/**
 * WebSocket服务器中间件
 * 借鉴Socket.IO和原生WebSocket的设计理念
 * 提供WebSocket连接管理和流式数据传输
 */
function createWebSocketServer(server, options = {}) {
  // 初始化流式响应管理器
  if (!streamingManager) {
    streamingManager = new StreamingManager(options.streamingOptions || {});
    streamingManager.initialize().catch(console.error);
  }

  // 创建WebSocket服务器
  wss = new WebSocket.Server({
    server,
    path: options.path || "/ws",
    maxPayload: options.maxPayload || 1024 * 1024, // 1MB
    ...options.wsOptions,
  });

  console.log(`🔌 WebSocket服务器已启动，路径: ${options.path || "/ws"}`);

  // WebSocket连接处理
  wss.on("connection", (ws, req) => {
    try {
      // 创建WebSocket连接
      const result = streamingManager.createWebSocketConnection(ws, req, {
        userAgent: req.headers["user-agent"],
        origin: req.headers.origin,
        ...options.connectionOptions,
      });

      console.log(`🔌 WebSocket连接已处理: ${result.connectionId}`);

      // 设置连接特定的消息处理器（如果需要的话）
      // 这里主要通过StreamingManager处理
    } catch (error) {
      console.error("WebSocket连接处理失败:", error);
      ws.close(1011, "Connection setup failed");
    }
  });

  // 服务器事件处理
  wss.on("error", (error) => {
    console.error("WebSocket服务器错误:", error);
  });

  wss.on("close", () => {
    console.log("🔌 WebSocket服务器已关闭");
  });

  return wss;
}

/**
 * WebSocket路由中间件
 * 用于Express应用中的WebSocket路由处理
 */
function websocketMiddleware(_options = {}) {
  return (req, _res, next) => {
    // 如果是WebSocket升级请求，传递给WebSocket服务器
    if (
      req.headers.upgrade &&
      req.headers.upgrade.toLowerCase() === "websocket"
    ) {
      // WebSocket握手由WebSocket.Server自动处理
      return next();
    }

    // 为请求对象添加WebSocket辅助方法
    req.ws = {
      // 发送消息到特定流
      sendToStream: (streamId, data, options = {}) => {
        if (streamingManager) {
          return streamingManager.sendStreamData(streamId, data, options);
        }
        throw new Error("StreamingManager not initialized");
      },

      // 广播消息
      broadcast: (message, options = {}) => {
        if (streamingManager) {
          return streamingManager.broadcast(message, options);
        }
        throw new Error("StreamingManager not initialized");
      },

      // 获取连接统计
      getConnectionStats: () => {
        if (streamingManager) {
          return streamingManager.getConnectionStats();
        }
        throw new Error("StreamingManager not initialized");
      },
    };

    next();
  };
}

/**
 * 获取WebSocket服务器实例
 */
function getWebSocketServer() {
  return wss;
}

/**
 * 获取流式响应管理器实例
 */
function getStreamingManager() {
  return streamingManager;
}

/**
 * 广播消息到所有WebSocket连接
 */
function broadcastToWebSockets(message, options = {}) {
  if (!streamingManager) {
    throw new Error("StreamingManager not initialized");
  }

  return streamingManager.broadcast(message, {
    ...options,
    connectionType: "websocket",
  });
}

/**
 * 发送消息到特定WebSocket连接
 */
function sendToWebSocket(connectionId, message, options = {}) {
  if (!streamingManager) {
    throw new Error("StreamingManager not initialized");
  }

  const connection = streamingManager.wsConnections.get(connectionId);
  if (!connection) {
    throw new Error(`WebSocket connection ${connectionId} not found`);
  }

  if (connection.ws.readyState === WebSocket.OPEN) {
    streamingManager.sendWebSocketMessage(
      connection.ws,
      options.eventType || "message",
      message,
      options.metadata,
    );
    return true;
  }

  return false;
}

/**
 * 获取WebSocket连接统计
 */
function getWebSocketStats() {
  if (!streamingManager) {
    return { error: "StreamingManager not initialized" };
  }

  const stats = streamingManager.getConnectionStats();
  return {
    ...stats,
    websocketConnections: streamingManager.wsConnections.size,
    serverInfo: wss
      ? {
          clients: wss.clients.size,
          path: wss.path,
          options: wss.options,
        }
      : null,
  };
}

module.exports = {
  createWebSocketServer,
  websocketMiddleware,
  getWebSocketServer,
  getStreamingManager,
  broadcastToWebSockets,
  sendToWebSocket,
  getWebSocketStats,
};
