const crypto = require("node:crypto");
const axios = require("axios");
const fs = require("node:fs").promises;
const path = require("node:path");

/**
 * Webhook通知系统 - 借鉴Stripe和GitHub的设计理念
 * 支持异步事件通知、可靠投递、重试机制和安全验证
 */
class WebhookManager {
  constructor(options = {}) {
    this.configPath =
      options.configPath || path.join(__dirname, "../config/webhooks.json");
    this.deliveryLogPath =
      options.deliveryLogPath ||
      path.join(__dirname, "../data/webhook-deliveries.json");

    // 安全检查：不允许使用默认密钥
    this.secretKey = options.secretKey || process.env.WEBHOOK_SECRET;
    if (!this.secretKey) {
      throw new Error(
        "Webhook configuration error: Missing required security credentials. Please check your environment configuration.",
      );
    }
    this.maxRetries = options.maxRetries || 5;
    this.retryDelays = options.retryDelays || [1000, 2000, 5000, 10000, 30000]; // 指数退避重试间隔
    this.timeout = options.timeout || 10000; // 10秒超时
    this.concurrencyLimit = options.concurrencyLimit || 10; // 并发限制

    this.webhooks = new Map(); // webhookId -> webhook配置
    this.deliveryQueue = []; // 待投递的事件队列
    this.activeDeliveries = new Set(); // 正在进行的投递
    this.deliveryHistory = new Map(); // webhookId -> 投递历史

    this.initialized = false;
  }

  /**
   * 初始化Webhook管理器
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 加载webhook配置
      await this.loadWebhookConfigurations();
      // 加载投递历史
      await this.loadDeliveryHistory();
      // 启动投递处理器
      this.startDeliveryProcessor();

      this.initialized = true;
      console.log(
        `✅ Webhook管理器已初始化，加载了 ${this.webhooks.size} 个webhook配置`,
      );
    } catch (error) {
      console.error("❌ Webhook管理器初始化失败:", error.message);
      throw error;
    }
  }

  /**
   * 注册webhook
   */
  async registerWebhook(webhookConfig) {
    const webhookId = webhookConfig.id || this.generateWebhookId();

    if (this.webhooks.has(webhookId)) {
      throw new Error(`Webhook ${webhookId} 已存在`);
    }

    const webhook = {
      id: webhookId,
      url: webhookConfig.url,
      events: webhookConfig.events || ["*"], // 支持通配符*
      secret: webhookConfig.secret || this.generateSecret(),
      userId: webhookConfig.userId,
      description: webhookConfig.description,
      headers: webhookConfig.headers || {},
      retryPolicy: webhookConfig.retryPolicy || {
        maxRetries: this.maxRetries,
        retryDelays: this.retryDelays,
      },
      filters: webhookConfig.filters || {}, // 事件过滤条件
      status: "active", // active, paused, disabled
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastTriggeredAt: null,
      successCount: 0,
      failureCount: 0,
    };

    // 验证webhook配置
    this.validateWebhookConfig(webhook);

    this.webhooks.set(webhookId, webhook);
    await this.saveWebhookConfigurations();

    console.log(`✅ 注册Webhook: ${webhookId} - ${webhook.url}`);
    return webhook;
  }

  /**
   * 更新webhook
   */
  async updateWebhook(webhookId, updates) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} 不存在`);
    }

    // 不允许更新关键字段
    const restrictedFields = [
      "id",
      "createdAt",
      "successCount",
      "failureCount",
    ];
    restrictedFields.forEach((field) => {
      if (Object.hasOwn(updates, field)) {
        delete updates[field];
      }
    });

    Object.assign(webhook, updates, {
      updatedAt: new Date().toISOString(),
    });

    // 重新验证配置
    this.validateWebhookConfig(webhook);

    await this.saveWebhookConfigurations();
    console.log(`✅ 更新Webhook: ${webhookId}`);
    return webhook;
  }

  /**
   * 删除webhook
   */
  async deleteWebhook(webhookId) {
    if (!this.webhooks.has(webhookId)) {
      throw new Error(`Webhook ${webhookId} 不存在`);
    }

    this.webhooks.delete(webhookId);
    this.deliveryHistory.delete(webhookId);

    await this.saveWebhookConfigurations();
    await this.saveDeliveryHistory();

    console.log(`🗑️ 删除Webhook: ${webhookId}`);
  }

  /**
   * 触发webhook事件
   */
  async triggerEvent(eventType, eventData, options = {}) {
    const event = {
      id: this.generateEventId(),
      type: eventType,
      data: eventData,
      timestamp: new Date().toISOString(),
      source: options.source || "sira-gateway",
      userId: options.userId,
      requestId: options.requestId,
    };

    console.log(`📡 触发Webhook事件: ${eventType}`, { eventId: event.id });

    // 查找匹配的webhooks
    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter((webhook) => webhook.status === "active")
      .filter((webhook) => this.matchesEvent(webhook, event));

    if (matchingWebhooks.length === 0) {
      console.log(`⚠️ 无匹配的Webhook配置: ${eventType}`);
      return { delivered: 0, total: 0 };
    }

    const delivered = 0;
    const deliveries = [];

    // 为每个匹配的webhook创建投递任务
    for (const webhook of matchingWebhooks) {
      const delivery = {
        webhookId: webhook.id,
        event,
        attempts: 0,
        status: "pending",
        createdAt: new Date().toISOString(),
        nextRetryAt: new Date().toISOString(),
      };

      deliveries.push(delivery);
      this.deliveryQueue.push(delivery);
    }

    console.log(`📨 加入投递队列: ${matchingWebhooks.length} 个webhook`);

    // 等待队列处理（可选）
    if (options.waitForDelivery) {
      // 简单等待机制，实际应用中可能需要更复杂的处理
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      delivered,
      total: matchingWebhooks.length,
      eventId: event.id,
    };
  }

  /**
   * 手动重试失败的投递
   */
  async retryFailedDeliveries(webhookId = null) {
    const failedDeliveries = this.deliveryQueue.filter(
      (delivery) =>
        delivery.status === "failed" &&
        (!webhookId || delivery.webhookId === webhookId),
    );

    for (const delivery of failedDeliveries) {
      delivery.status = "pending";
      delivery.nextRetryAt = new Date().toISOString();
    }

    console.log(`🔄 重试失败的投递: ${failedDeliveries.length} 个`);
    return failedDeliveries.length;
  }

  /**
   * 获取webhook统计信息
   */
  getWebhookStats(webhookId = null) {
    if (webhookId) {
      const webhook = this.webhooks.get(webhookId);
      const history = this.deliveryHistory.get(webhookId) || [];

      if (!webhook) return null;

      const stats = {
        webhookId,
        url: webhook.url,
        status: webhook.status,
        events: webhook.events,
        totalDeliveries: history.length,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        successRate:
          history.length > 0
            ? ((webhook.successCount / history.length) * 100).toFixed(2)
            : 0,
        lastTriggeredAt: webhook.lastTriggeredAt,
        recentDeliveries: history.slice(-10).reverse(), // 最近10次投递
      };

      return stats;
    }

    // 返回所有webhooks的统计
    const allStats = [];
    for (const [id, webhook] of this.webhooks) {
      const history = this.deliveryHistory.get(id) || [];
      allStats.push({
        webhookId: id,
        url: webhook.url,
        status: webhook.status,
        events: webhook.events,
        totalDeliveries: history.length,
        successCount: webhook.successCount,
        failureCount: webhook.failureCount,
        successRate:
          history.length > 0
            ? ((webhook.successCount / history.length) * 100).toFixed(2)
            : 0,
        lastTriggeredAt: webhook.lastTriggeredAt,
      });
    }

    return allStats;
  }

  /**
   * 测试webhook连接
   */
  async testWebhook(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error(`Webhook ${webhookId} 不存在`);
    }

    const testEvent = {
      id: this.generateEventId(),
      type: "webhook.test",
      data: {
        message: "This is a test webhook delivery",
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      source: "sira-gateway-test",
    };

    try {
      await this.deliverWebhook(webhook, testEvent);
      console.log(`✅ Webhook测试成功: ${webhookId}`);
      return { success: true, message: "测试成功" };
    } catch (error) {
      console.log(`❌ Webhook测试失败: ${webhookId} - ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 生成webhook ID
   */
  generateWebhookId() {
    return `wh_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * 生成事件ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }

  /**
   * 生成webhook密钥
   */
  generateSecret() {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * 验证webhook配置
   */
  validateWebhookConfig(webhook) {
    if (!webhook.url) throw new Error("Webhook URL不能为空");
    if (!this.isValidUrl(webhook.url)) throw new Error("无效的URL格式");

    if (!webhook.events || !Array.isArray(webhook.events)) {
      throw new Error("events必须是数组");
    }

    if (webhook.events.length === 0) {
      throw new Error("至少需要订阅一个事件");
    }
  }

  /**
   * 检查URL是否有效
   */
  isValidUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  /**
   * 检查事件是否匹配webhook
   */
  matchesEvent(webhook, event) {
    // 检查事件类型
    const eventMatches = webhook.events.some((pattern) => {
      if (pattern === "*") return true;
      if (pattern.endsWith("*")) {
        return event.type.startsWith(pattern.slice(0, -1));
      }
      return pattern === event.type;
    });

    if (!eventMatches) return false;

    // 检查过滤条件
    if (webhook.filters.userId && event.userId !== webhook.filters.userId) {
      return false;
    }

    if (webhook.filters.source && event.source !== webhook.filters.source) {
      return false;
    }

    return true;
  }

  /**
   * 启动投递处理器
   */
  startDeliveryProcessor() {
    setInterval(() => {
      this.processDeliveryQueue();
    }, 1000); // 每秒检查一次队列
  }

  /**
   * 处理投递队列
   */
  async processDeliveryQueue() {
    if (this.deliveryQueue.length === 0) return;
    if (this.activeDeliveries.size >= this.concurrencyLimit) return;

    // 找到待处理的投递
    const pendingDelivery = this.deliveryQueue.find(
      (delivery) =>
        delivery.status === "pending" &&
        new Date(delivery.nextRetryAt) <= new Date(),
    );

    if (!pendingDelivery) return;

    // 标记为正在处理
    pendingDelivery.status = "processing";
    this.activeDeliveries.add(pendingDelivery.event.id);

    // 异步处理投递
    this.processDelivery(pendingDelivery).finally(() => {
      this.activeDeliveries.delete(pendingDelivery.event.id);
    });
  }

  /**
   * 处理单个投递
   */
  async processDelivery(delivery) {
    const webhook = this.webhooks.get(delivery.webhookId);
    if (!webhook || webhook.status !== "active") {
      delivery.status = "cancelled";
      return;
    }

    try {
      await this.deliverWebhook(webhook, delivery.event);
      delivery.status = "delivered";
      webhook.successCount++;
      webhook.lastTriggeredAt = new Date().toISOString();

      // 记录成功投递历史
      this.recordDeliveryHistory(webhook.id, {
        eventId: delivery.event.id,
        eventType: delivery.event.type,
        status: "success",
        deliveredAt: new Date().toISOString(),
        attempt: delivery.attempts + 1,
      });

      console.log(
        `✅ Webhook投递成功: ${webhook.id} -> ${delivery.event.type}`,
      );
    } catch (error) {
      delivery.attempts++;
      webhook.failureCount++;

      // 记录失败投递历史
      this.recordDeliveryHistory(webhook.id, {
        eventId: delivery.event.id,
        eventType: delivery.event.type,
        status: "failed",
        error: error.message,
        attempt: delivery.attempts,
        failedAt: new Date().toISOString(),
      });

      // 检查是否需要重试
      const { maxRetries } = webhook.retryPolicy;
      if (delivery.attempts < maxRetries) {
        delivery.status = "pending";
        const delay =
          webhook.retryPolicy.retryDelays[delivery.attempts - 1] || 30000;
        delivery.nextRetryAt = new Date(Date.now() + delay).toISOString();
        console.log(
          `🔄 Webhook重试安排: ${webhook.id}, ${delivery.attempts}/${maxRetries}, 延迟${delay}ms`,
        );
      } else {
        delivery.status = "failed";
        console.log(`❌ Webhook投递最终失败: ${webhook.id}, 超过最大重试次数`);
      }
    }

    // 保存配置（更新计数器）
    await this.saveWebhookConfigurations();
  }

  /**
   * 投递webhook
   */
  async deliverWebhook(webhook, event) {
    const payload = JSON.stringify(event);

    // 生成签名
    const signature = this.generateSignature(payload, webhook.secret);

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "Sira-Webhook/1.0",
      "X-Sira-Webhook-ID": webhook.id,
      "X-Sira-Event-Type": event.type,
      "X-Sira-Signature": signature,
      ...webhook.headers,
    };

    try {
      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: this.timeout,
        validateStatus: (status) => status < 500, // 接受4xx错误，只重试5xx错误
      });

      // 检查响应状态
      if (response.status >= 200 && response.status < 300) {
        return response;
      } else {
        throw new Error(`Webhook返回错误状态: ${response.status}`);
      }
    } catch (error) {
      if (error.response) {
        // 服务器返回了错误状态码
        if (error.response.status >= 400 && error.response.status < 500) {
          // 客户端错误，不重试
          throw new Error(
            `Webhook客户端错误: ${error.response.status} - ${error.response.statusText}`,
          );
        } else {
          // 服务器错误，重试
          throw new Error(
            `Webhook服务器错误: ${error.response.status} - ${error.response.statusText}`,
          );
        }
      } else if (error.code === "ECONNREFUSED") {
        throw new Error("Webhook连接被拒绝");
      } else if (error.code === "ENOTFOUND") {
        throw new Error("Webhook域名无法解析");
      } else if (error.code === "ETIMEDOUT") {
        throw new Error("Webhook请求超时");
      } else {
        throw new Error(`Webhook投递失败: ${error.message}`);
      }
    }
  }

  /**
   * 生成签名
   */
  generateSignature(payload, secret) {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload, "utf8");
    return `sha256=${hmac.digest("hex")}`;
  }

  /**
   * 验证签名
   */
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * 记录投递历史
   */
  recordDeliveryHistory(webhookId, record) {
    if (!this.deliveryHistory.has(webhookId)) {
      this.deliveryHistory.set(webhookId, []);
    }

    const history = this.deliveryHistory.get(webhookId);
    history.push(record);

    // 限制历史记录数量，避免内存泄漏
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * 加载webhook配置
   */
  async loadWebhookConfigurations() {
    try {
      const data = await fs.readFile(this.configPath, "utf8");
      const configs = JSON.parse(data);

      for (const [webhookId, config] of Object.entries(configs)) {
        this.webhooks.set(webhookId, config);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("加载Webhook配置失败:", error.message);
      }
    }
  }

  /**
   * 保存webhook配置
   */
  async saveWebhookConfigurations() {
    const configs = {};
    for (const [webhookId, webhook] of this.webhooks) {
      configs[webhookId] = webhook;
    }

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2));
  }

  /**
   * 加载投递历史
   */
  async loadDeliveryHistory() {
    try {
      const data = await fs.readFile(this.deliveryLogPath, "utf8");
      const history = JSON.parse(data);

      for (const [webhookId, records] of Object.entries(history)) {
        this.deliveryHistory.set(webhookId, records);
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("加载Webhook投递历史失败:", error.message);
      }
    }
  }

  /**
   * 保存投递历史
   */
  async saveDeliveryHistory() {
    const history = {};
    for (const [webhookId, records] of this.deliveryHistory) {
      history[webhookId] = records;
    }

    await fs.mkdir(path.dirname(this.deliveryLogPath), { recursive: true });
    await fs.writeFile(this.deliveryLogPath, JSON.stringify(history, null, 2));
  }
}

module.exports = { WebhookManager };
