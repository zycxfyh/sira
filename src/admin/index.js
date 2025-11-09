const express = require("express");
const path = require("node:path");
const { AdminAPI } = require("./rest-api");
const { AuthManager } = require("./auth-manager");
const { MonitoringDashboard } = require("./monitoring-dashboard");

/**
 * Sira AI Gateway 管理模块
 * 整合REST API、权限管理和监控面板
 */
class AdminModule {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3001,
      jwtSecret: options.jwtSecret || "sira-admin-secret-key",
      enableFrontend: options.enableFrontend !== false,
      frontendPath: options.frontendPath || path.join(__dirname, "public"),
      ...options,
    };

    this.api = null;
    this.auth = null;
    this.monitoring = null;
    this.app = null;
    this.server = null;

    this.initialized = false;
  }

  /**
   * 初始化管理模块
   */
  async initialize() {
    if (this.initialized) return;

    console.log("🚀 初始化管理模块...");

    try {
      // 初始化权限管理器
      this.auth = new AuthManager({
        jwtSecret: this.options.jwtSecret,
      });

      // 初始化监控面板
      this.monitoring = new MonitoringDashboard({
        updateInterval: 5000,
        retentionPeriod: 24 * 60 * 60 * 1000,
      });
      await this.monitoring.initialize();

      // 初始化REST API
      this.api = new AdminAPI({
        port: this.options.port,
        jwtSecret: this.options.jwtSecret,
        authManager: this.auth,
        monitoring: this.monitoring,
      });

      // 如果启用前端，设置静态文件服务
      if (this.options.enableFrontend) {
        this.setupFrontend();
      }

      // 集成组件
      this.integrateComponents();

      this.initialized = true;
      console.log("✅ 管理模块初始化完成");

      this.emit("initialized", {
        port: this.options.port,
        hasFrontend: this.options.enableFrontend,
        components: ["auth", "monitoring", "api"],
      });
    } catch (error) {
      console.error("❌ 管理模块初始化失败:", error);
      throw error;
    }
  }

  /**
   * 设置前端服务
   */
  setupFrontend() {
    if (!this.api || !this.api.app) return;

    // 提供静态文件服务
    this.api.app.use(express.static(this.options.frontendPath));

    // SPA路由回退
    this.api.app.get("/", (_req, res) => {
      res.sendFile(path.join(this.options.frontendPath, "index.html"));
    });

    console.log(`🌐 前端文件服务已设置: ${this.options.frontendPath}`);
  }

  /**
   * 集成各个组件
   */
  integrateComponents() {
    if (!this.api || !this.auth || !this.monitoring) return;

    // 将权限管理器和监控面板注入到API中
    this.api.authManager = this.auth;
    this.api.monitoring = this.monitoring;

    // 扩展API路由以使用这些组件
    this.extendAPIRoutes();
  }

  /**
   * 扩展API路由
   */
  extendAPIRoutes() {
    const adminRouter = this.api.app._router.stack.find(
      (layer) => layer.route && layer.route.path === "/api/admin",
    );

    if (!adminRouter) return;

    const adminRoutes = adminRouter.handle;

    // 添加用户管理路由
    adminRoutes.get("/users", async (_req, res) => {
      try {
        const users = this.auth.getUsers();
        res.json({ success: true, data: users });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    adminRoutes.post("/users", async (req, res) => {
      try {
        const user = await this.auth.createUser(req.body);
        res.status(201).json({ success: true, data: user });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    adminRoutes.put("/users/:id", async (req, res) => {
      try {
        const user = await this.auth.updateUser(req.params.id, req.body);
        res.json({ success: true, data: user });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    adminRoutes.delete("/users/:id", async (req, res) => {
      try {
        const result = await this.auth.deleteUser(req.params.id);
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    // 添加监控路由
    adminRoutes.get("/dashboard", async (_req, res) => {
      try {
        const dashboard = this.monitoring.getDashboardOverview();
        res.json({ success: true, data: dashboard });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    adminRoutes.get("/monitoring/realtime", async (_req, res) => {
      try {
        const data = this.monitoring.getRealtimeData();
        res.json({ success: true, data });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    adminRoutes.get("/monitoring/history", async (req, res) => {
      try {
        const data = this.monitoring.getDetailedMetrics(req.query.timeRange);
        res.json({ success: true, data });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    adminRoutes.get("/monitoring/alerts", async (req, res) => {
      try {
        const alerts = this.monitoring.getAlerts({
          status: req.query.status,
          severity: req.query.severity,
          limit: parseInt(req.query.limit, 10) || 50,
        });
        res.json({ success: true, data: alerts });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    adminRoutes.post("/monitoring/alerts/:id/acknowledge", async (req, res) => {
      try {
        const result = this.monitoring.acknowledgeAlert(
          req.params.id,
          req.user.username,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });

    adminRoutes.post("/monitoring/alerts/:id/resolve", async (req, res) => {
      try {
        const result = this.monitoring.resolveAlert(
          req.params.id,
          req.body.resolution,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    });
  }

  /**
   * 启动管理模块
   */
  async start() {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log("🔄 启动管理模块...");

    try {
      await this.api.start();
      console.log(`✅ 管理模块已启动 - API端口: ${this.options.port}`);

      if (this.options.enableFrontend) {
        console.log(`🌐 管理界面: http://localhost:${this.options.port}`);
      }

      this.emit("started", {
        port: this.options.port,
        frontend: this.options.enableFrontend,
      });
    } catch (error) {
      console.error("❌ 启动管理模块失败:", error);
      throw error;
    }
  }

  /**
   * 停止管理模块
   */
  async stop() {
    console.log("🛑 停止管理模块...");

    try {
      if (this.monitoring) {
        await this.monitoring.stop();
      }

      if (this.api) {
        await this.api.stop();
      }

      console.log("✅ 管理模块已停止");
      this.emit("stopped");
    } catch (error) {
      console.error("停止管理模块时出错:", error);
      throw error;
    }
  }

  /**
   * 获取模块状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      running: this.api ? this.api.getStatus().running : false,
      port: this.options.port,
      components: {
        auth: !!this.auth,
        monitoring: !!this.monitoring,
        api: !!this.api,
        frontend: this.options.enableFrontend,
      },
      stats: {
        auth: this.auth ? this.auth.getUserStats() : null,
        monitoring: this.monitoring ? this.monitoring.getStats() : null,
        api: this.api ? this.api.getStatus() : null,
      },
    };
  }

  /**
   * 获取监控概览
   */
  getMonitoringOverview() {
    if (!this.monitoring) return null;
    return this.monitoring.getDashboardOverview();
  }

  /**
   * 获取用户统计
   */
  getUserStats() {
    if (!this.auth) return null;
    return this.auth.getUserStats();
  }

  /**
   * 创建告警
   */
  createAlert(alertData) {
    if (!this.monitoring) return null;
    return this.monitoring.createAlert(alertData);
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts() {
    if (!this.monitoring) return [];
    return this.monitoring.getAlerts({ status: "active" });
  }

  /**
   * 导出配置
   */
  exportConfig() {
    return {
      port: this.options.port,
      jwtSecret: this.options.jwtSecret ? "[HIDDEN]" : null,
      enableFrontend: this.options.enableFrontend,
      frontendPath: this.options.frontendPath,
      monitoring: {
        updateInterval: this.monitoring?.options.updateInterval,
        retentionPeriod: this.monitoring?.options.retentionPeriod,
      },
    };
  }

  /**
   * 重新加载配置
   */
  async reloadConfig(newConfig = {}) {
    console.log("🔄 重新加载管理模块配置...");

    // 合并新配置
    Object.assign(this.options, newConfig);

    // 重新初始化组件
    if (newConfig.jwtSecret && this.auth) {
      this.auth.options.jwtSecret = newConfig.jwtSecret;
    }

    console.log("✅ 配置重新加载完成");
  }
}

// 事件发射器继承
const EventEmitter = require("node:events");
Object.setPrototypeOf(AdminModule.prototype, EventEmitter.prototype);

module.exports = { AdminModule };
