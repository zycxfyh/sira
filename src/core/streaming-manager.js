const { EventEmitter } = require("node:events");
const crypto = require("node:crypto");
const WebSocket = require("ws");

/**
 * 实时流式响应管理器
 * 借鉴OpenAI流式API、Twitter实时流和WebSocket最佳实践
 * 提供高性能的SSE和WebSocket流式响应服务
 */
class StreamingManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.configPath =
      options.configPath ||
      require("node:path").join(__dirname, "../config/streaming.json");

    // 流式配置
    this.maxConnections = options.maxConnections || 1000; // 最大并发连接数
    this.connectionTimeout = options.connectionTimeout || 300000; // 连接超时 (5分钟)
    this.keepAliveInterval = options.keepAliveInterval || 30000; // 保活间隔 (30秒)
    this.maxMessageSize = options.maxMessageSize || 1024 * 1024; // 最大消息大小 (1MB)
    this.compressionEnabled = options.compressionEnabled !== false; // 启用压缩

    // 连接管理
    this.activeConnections = new Map(); // connectionId -> connection info
    this.sseConnections = new Map(); // SSE连接
    this.wsConnections = new Map(); // WebSocket连接

    // 流式会话管理
    this.activeStreams = new Map(); // streamId -> stream info

    // 性能监控
    this.performanceStats = {
      totalConnections: 0,
      activeConnections: 0,
      totalStreams: 0,
      activeStreams: 0,
      messagesSent: 0,
      bytesTransferred: 0,
      avgResponseTime: 0,
      connectionErrors: 0,
      lastUpdated: new Date().toISOString(),
    };

    // 连接池管理
    this.connectionPool = {
      available: new Set(),
      busy: new Set(),
      maxPoolSize: options.maxPoolSize || 100,
    };

    // 流式数据缓冲
    this.streamBuffers = new Map();

    // 初始化
    this.initialize();
  }

  /**
   * 初始化流式响应管理器
   */
  async initialize() {
    try {
      // 加载配置
      await this.loadConfiguration();

      // 启动连接清理
      this.startConnectionCleanup();

      // 启动性能监控
      this.startPerformanceMonitoring();

      // 启动保活机制
      this.startKeepAlive();

      console.log(
        `✅ 流式响应管理器已初始化，最大连接数: ${this.maxConnections}`,
      );
    } catch (error) {
      console.error("❌ 流式响应管理器初始化失败:", error.message);
      throw error;
    }
  }

  /**
   * 创建SSE连接
   */
  createSSEConnection(req, res, options = {}) {
    const connectionId = this.generateConnectionId();
    const streamId = options.streamId || this.generateStreamId();

    // 设置SSE响应头
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // 创建连接信息
    const connection = {
      id: connectionId,
      streamId,
      type: "sse",
      req,
      res,
      createdAt: new Date().toISOString(),
      lastActivity: Date.now(),
      userId: req.headers["x-user-id"] || "anonymous",
      clientIP: req.ip,
      userAgent: req.headers["user-agent"],
      options,
    };

    // 存储连接
    this.activeConnections.set(connectionId, connection);
    this.sseConnections.set(connectionId, connection);

    // 更新统计
    this.performanceStats.totalConnections++;
    this.performanceStats.activeConnections = this.activeConnections.size;

    // 设置连接超时
    const timeout = setTimeout(() => {
      this.closeConnection(connectionId, "timeout");
    }, this.connectionTimeout);

    connection.timeout = timeout;

    // 监听连接关闭
    req.on("close", () => {
      this.closeConnection(connectionId, "client_disconnect");
    });

    req.on("error", (error) => {
      console.error(`SSE连接错误 ${connectionId}:`, error.message);
      this.closeConnection(connectionId, "connection_error");
    });

    // 发送初始连接事件
    this.sendSSEEvent(res, "connection", {
      connectionId,
      streamId,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `📡 SSE连接已建立: ${connectionId} (${this.activeConnections.size} 活跃连接)`,
    );

    this.emit("sseConnectionCreated", connection);

    return { connectionId, streamId };
  }

  /**
   * 创建WebSocket连接
   */
  createWebSocketConnection(ws, req, options = {}) {
    const connectionId = this.generateConnectionId();
    const streamId = options.streamId || this.generateStreamId();

    // 创建连接信息
    const connection = {
      id: connectionId,
      streamId,
      type: "websocket",
      ws,
      req,
      createdAt: new Date().toISOString(),
      lastActivity: Date.now(),
      userId: req.headers["x-user-id"] || "anonymous",
      clientIP: req.ip,
      userAgent: req.headers["user-agent"],
      options,
    };

    // 存储连接
    this.activeConnections.set(connectionId, connection);
    this.wsConnections.set(connectionId, connection);

    // 更新统计
    this.performanceStats.totalConnections++;
    this.performanceStats.activeConnections = this.activeConnections.size;

    // WebSocket事件处理
    ws.on("message", (data) => {
      this.handleWebSocketMessage(connectionId, data);
    });

    ws.on("close", (code, _reason) => {
      this.closeConnection(connectionId, `websocket_close_${code}`);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket连接错误 ${connectionId}:`, error.message);
      this.closeConnection(connectionId, "websocket_error");
    });

    ws.on("ping", () => {
      connection.lastActivity = Date.now();
      ws.pong();
    });

    // 发送欢迎消息
    this.sendWebSocketMessage(ws, "connection", {
      connectionId,
      streamId,
      timestamp: new Date().toISOString(),
      message: "WebSocket connection established",
    });

    console.log(
      `🔌 WebSocket连接已建立: ${connectionId} (${this.wsConnections.size} 活跃连接)`,
    );

    this.emit("wsConnectionCreated", connection);

    return { connectionId, streamId };
  }

  /**
   * 发送流式数据
   */
  async sendStreamData(streamId, data, options = {}) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      throw new Error(`流 ${streamId} 不存在`);
    }

    const { eventType = "data", metadata = {} } = options;

    // 更新流统计
    stream.messageCount = (stream.messageCount || 0) + 1;
    stream.lastActivity = Date.now();

    // 根据连接类型发送数据
    for (const connectionId of stream.connections) {
      const connection = this.activeConnections.get(connectionId);
      if (!connection) continue;

      try {
        if (connection.type === "sse") {
          this.sendSSEEvent(connection.res, eventType, data, metadata);
        } else if (connection.type === "websocket") {
          this.sendWebSocketMessage(connection.ws, eventType, data, metadata);
        }

        // 更新连接活跃时间
        connection.lastActivity = Date.now();
      } catch (error) {
        console.error(`发送流数据失败 ${connectionId}:`, error.message);
        this.closeConnection(connectionId, "send_error");
      }
    }

    // 更新性能统计
    this.performanceStats.messagesSent++;
    const dataSize = JSON.stringify(data).length;
    this.performanceStats.bytesTransferred += dataSize;

    this.emit("streamDataSent", { streamId, data, options });
  }

  /**
   * 创建流式会话
   */
  createStream(userId, options = {}) {
    const streamId = this.generateStreamId();

    const stream = {
      id: streamId,
      userId,
      createdAt: new Date().toISOString(),
      lastActivity: Date.now(),
      connections: new Set(),
      messageCount: 0,
      status: "active",
      options: {
        maxConnections: options.maxConnections || 10,
        timeout: options.timeout || this.connectionTimeout,
        ...options,
      },
    };

    this.activeStreams.set(streamId, stream);
    this.performanceStats.totalStreams++;
    this.performanceStats.activeStreams = this.activeStreams.size;

    console.log(`🌊 流式会话已创建: ${streamId}`);

    this.emit("streamCreated", stream);

    return stream;
  }

  /**
   * 将连接加入流
   */
  joinStream(streamId, connectionId) {
    const stream = this.activeStreams.get(streamId);
    const connection = this.activeConnections.get(connectionId);

    if (!stream) {
      throw new Error(`流 ${streamId} 不存在`);
    }

    if (!connection) {
      throw new Error(`连接 ${connectionId} 不存在`);
    }

    // 检查连接限制
    if (stream.connections.size >= stream.options.maxConnections) {
      throw new Error(`流 ${streamId} 已达到最大连接数限制`);
    }

    // 检查用户权限
    if (stream.userId !== connection.userId) {
      throw new Error("无权加入此流");
    }

    stream.connections.add(connectionId);
    connection.streamId = streamId;

    console.log(`🔗 连接已加入流: ${connectionId} -> ${streamId}`);

    this.emit("connectionJoinedStream", { streamId, connectionId });

    return { streamId, connectionId };
  }

  /**
   * 离开流
   */
  leaveStream(streamId, connectionId) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.connections.delete(connectionId);
    }

    const connection = this.activeConnections.get(connectionId);
    if (connection) {
      connection.streamId = null;
    }

    console.log(`🔌 连接已离开流: ${connectionId} <- ${streamId}`);

    this.emit("connectionLeftStream", { streamId, connectionId });
  }

  /**
   * 关闭流
   */
  closeStream(streamId, reason = "manual") {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    // 断开所有连接
    for (const connectionId of stream.connections) {
      this.closeConnection(connectionId, `stream_closed_${reason}`);
    }

    stream.status = "closed";
    stream.closedAt = new Date().toISOString();
    stream.closeReason = reason;

    this.activeStreams.delete(streamId);
    this.performanceStats.activeStreams = this.activeStreams.size;

    console.log(`🏁 流已关闭: ${streamId} (${reason})`);

    this.emit("streamClosed", { streamId, reason });
  }

  /**
   * 发送SSE事件
   */
  sendSSEEvent(res, event, data, metadata = {}) {
    try {
      const eventData = {
        event,
        data,
        id: metadata.id || Date.now(),
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);

      // 强制刷新缓冲区
      if (res.flush) {
        res.flush();
      }
    } catch (error) {
      console.error("发送SSE事件失败:", error.message);
    }
  }

  /**
   * 发送WebSocket消息
   */
  sendWebSocketMessage(ws, type, payload, metadata = {}) {
    try {
      const message = {
        type,
        payload,
        timestamp: new Date().toISOString(),
        ...metadata,
      };

      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("发送WebSocket消息失败:", error.message);
    }
  }

  /**
   * 处理WebSocket消息
   */
  handleWebSocketMessage(connectionId, data) {
    try {
      const connection = this.wsConnections.get(connectionId);
      if (!connection) return;

      const message = JSON.parse(data.toString());

      // 更新连接活跃时间
      connection.lastActivity = Date.now();

      // 处理不同类型的消息
      switch (message.type) {
        case "ping":
          this.sendWebSocketMessage(connection.ws, "pong", {
            timestamp: Date.now(),
          });
          break;

        case "join_stream":
          if (message.streamId) {
            this.joinStream(message.streamId, connectionId);
          }
          break;

        case "leave_stream":
          if (connection.streamId) {
            this.leaveStream(connection.streamId, connectionId);
          }
          break;

        case "heartbeat":
          this.sendWebSocketMessage(connection.ws, "heartbeat", {
            serverTime: Date.now(),
            connectionAge:
              Date.now() - new Date(connection.createdAt).getTime(),
          });
          break;

        default:
          this.emit("wsMessageReceived", { connectionId, message });
      }
    } catch (error) {
      console.error(`处理WebSocket消息失败 ${connectionId}:`, error.message);
    }
  }

  /**
   * 广播消息到所有连接
   */
  broadcast(message, options = {}) {
    const { userId, eventType = "broadcast", metadata = {} } = options;

    let connections = Array.from(this.activeConnections.values());

    // 如果指定了用户，只广播给该用户的连接
    if (userId) {
      connections = connections.filter((conn) => conn.userId === userId);
    }

    for (const connection of connections) {
      try {
        if (connection.type === "sse") {
          this.sendSSEEvent(connection.res, eventType, message, metadata);
        } else if (connection.type === "websocket") {
          this.sendWebSocketMessage(
            connection.ws,
            eventType,
            message,
            metadata,
          );
        }
      } catch (error) {
        console.error(`广播消息失败 ${connection.id}:`, error.message);
      }
    }

    console.log(
      `📢 广播消息已发送: ${eventType} (${connections.length} 个连接)`,
    );
  }

  /**
   * 关闭连接
   */
  closeConnection(connectionId, reason = "manual") {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) return;

    try {
      // 从流中移除连接
      if (connection.streamId) {
        this.leaveStream(connection.streamId, connectionId);
      }

      // 关闭连接
      if (connection.type === "sse") {
        if (!connection.res.finished) {
          this.sendSSEEvent(connection.res, "close", { reason });
          connection.res.end();
        }
        this.sseConnections.delete(connectionId);
      } else if (connection.type === "websocket") {
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1000, reason);
        }
        this.wsConnections.delete(connectionId);
      }

      // 清理超时定时器
      if (connection.timeout) {
        clearTimeout(connection.timeout);
      }

      this.activeConnections.delete(connectionId);
      this.performanceStats.activeConnections = this.activeConnections.size;

      console.log(`🔌 连接已关闭: ${connectionId} (${reason})`);

      this.emit("connectionClosed", { connectionId, reason });
    } catch (error) {
      console.error(`关闭连接失败 ${connectionId}:`, error.message);
    }
  }

  /**
   * 获取连接统计
   */
  getConnectionStats() {
    const now = Date.now();
    const connections = Array.from(this.activeConnections.values());

    const stats = {
      total: this.performanceStats.totalConnections,
      active: this.activeConnections.size,
      sse: this.sseConnections.size,
      websocket: this.wsConnections.size,
      byUser: {},
      byIP: {},
      avgConnectionAge: 0,
      oldestConnection: null,
      newestConnection: null,
    };

    let totalAge = 0;

    for (const conn of connections) {
      const age = now - new Date(conn.createdAt).getTime();
      totalAge += age;

      // 按用户统计
      stats.byUser[conn.userId] = (stats.byUser[conn.userId] || 0) + 1;

      // 按IP统计
      stats.byIP[conn.clientIP] = (stats.byIP[conn.clientIP] || 0) + 1;

      // 最老和最新的连接
      if (
        !stats.oldestConnection ||
        age > now - new Date(stats.oldestConnection.createdAt).getTime()
      ) {
        stats.oldestConnection = {
          id: conn.id,
          age: Math.round(age / 1000),
          createdAt: conn.createdAt,
        };
      }

      if (
        !stats.newestConnection ||
        age < now - new Date(stats.newestConnection.createdAt).getTime()
      ) {
        stats.newestConnection = {
          id: conn.id,
          age: Math.round(age / 1000),
          createdAt: conn.createdAt,
        };
      }
    }

    stats.avgConnectionAge =
      connections.length > 0
        ? Math.round(totalAge / connections.length / 1000)
        : 0;

    return stats;
  }

  /**
   * 获取流统计
   */
  getStreamStats() {
    const streams = Array.from(this.activeStreams.values());

    const stats = {
      total: this.performanceStats.totalStreams,
      active: this.activeStreams.size,
      byUser: {},
      avgConnectionsPerStream: 0,
      avgMessagesPerStream: 0,
      mostActiveStream: null,
    };

    let totalConnections = 0;
    let totalMessages = 0;

    for (const stream of streams) {
      // 按用户统计
      stats.byUser[stream.userId] = (stats.byUser[stream.userId] || 0) + 1;

      totalConnections += stream.connections.size;
      totalMessages += stream.messageCount || 0;

      // 最活跃的流
      if (
        !stats.mostActiveStream ||
        (stream.messageCount || 0) > (stats.mostActiveStream.messageCount || 0)
      ) {
        stats.mostActiveStream = {
          id: stream.id,
          userId: stream.userId,
          connections: stream.connections.size,
          messageCount: stream.messageCount || 0,
        };
      }
    }

    stats.avgConnectionsPerStream =
      streams.length > 0 ? (totalConnections / streams.length).toFixed(2) : 0;
    stats.avgMessagesPerStream =
      streams.length > 0 ? (totalMessages / streams.length).toFixed(2) : 0;

    return stats;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成连接ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * 生成流ID
   */
  generateStreamId() {
    return `stream_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * 启动连接清理
   */
  startConnectionCleanup() {
    // 每分钟清理超时连接
    setInterval(() => {
      const now = Date.now();
      const timeoutThreshold = now - this.connectionTimeout;

      for (const [connectionId, connection] of this.activeConnections) {
        if (connection.lastActivity < timeoutThreshold) {
          this.closeConnection(connectionId, "cleanup_timeout");
        }
      }
    }, 60000);
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    // 每30秒更新性能统计
    setInterval(() => {
      this.emit("performanceStats", this.performanceStats);
    }, 30000);
  }

  /**
   * 启动保活机制
   */
  startKeepAlive() {
    // 每30秒发送保活消息
    setInterval(() => {
      const now = Date.now();

      // SSE保活
      for (const [connectionId, connection] of this.sseConnections) {
        if (connection.res && !connection.res.finished) {
          try {
            this.sendSSEEvent(connection.res, "ping", { timestamp: now });
            connection.lastActivity = now;
          } catch (_error) {
            this.closeConnection(connectionId, "keepalive_error");
          }
        }
      }

      // WebSocket保活
      for (const [connectionId, connection] of this.wsConnections) {
        if (connection.ws.readyState === WebSocket.OPEN) {
          try {
            connection.ws.ping();
            connection.lastActivity = now;
          } catch (_error) {
            this.closeConnection(connectionId, "keepalive_error");
          }
        }
      }
    }, this.keepAliveInterval);
  }

  /**
   * 加载配置
   */
  async loadConfiguration() {
    try {
      const fs = require("node:fs").promises;
      const data = await fs.readFile(this.configPath, "utf8");
      const config = JSON.parse(data);

      if (config.performanceStats) {
        this.performanceStats = {
          ...this.performanceStats,
          ...config.performanceStats,
        };
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("加载流式响应配置失败:", error.message);
      }
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration() {
    try {
      const fs = require("node:fs").promises;
      const config = {
        performanceStats: this.performanceStats,
        lastUpdated: new Date().toISOString(),
      };

      await fs.mkdir(require("node:path").dirname(this.configPath), {
        recursive: true,
      });
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error("保存流式响应配置失败:", error.message);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStatistics() {
    return {
      ...this.performanceStats,
      connectionStats: this.getConnectionStats(),
      streamStats: this.getStreamStats(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };
  }
}

module.exports = { StreamingManager };
