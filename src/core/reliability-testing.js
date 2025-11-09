/**
 * Sira AI网关 - 可靠性测试工具
 * 基于Google SRE和AWS Well-Architected可靠性最佳实践
 * 测试系统在长时间运行下的稳定性和可靠性
 */

const EventEmitter = require("node:events");
const { performance } = require("node:perf_hooks");

/**
 * 可靠性测试工具
 * 长期运行测试，验证系统的稳定性和可靠性指标
 */
class ReliabilityTestingTool extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      testDuration: options.testDuration || 24 * 60 * 60 * 1000, // 24小时
      checkInterval: options.checkInterval || 30000, // 30秒检查间隔
      uptimeTarget: options.uptimeTarget || 99.9, // 99.9%可用性目标
      responseTimeTarget: options.responseTimeTarget || 1000, // 1秒响应时间目标
      errorRateTarget: options.errorRateTarget || 0.1, // 0.1%错误率目标
      enableLongRunning: options.enableLongRunning !== false,
      enableResourceMonitoring: options.enableResourceMonitoring !== false,
      enableFailureRecovery: options.enableFailureRecovery !== false,
      ...options,
    };

    // 测试状态
    this.isRunning = false;
    this.startTime = null;
    this.testStats = {
      uptime: 100.0,
      availability: 100.0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      outages: [],
      currentOutage: null,
      lastHealthCheck: null,
      healthChecks: [],
      resourceUsage: [],
      errorPatterns: new Map(),
    };

    // SLO监控
    this.sloMonitor = new SLOMonitor(this.options);

    // 故障检测器
    this.failureDetector = new FailureDetector();

    // 恢复测试器
    this.recoveryTester = new RecoveryTester();
  }

  /**
   * 初始化可靠性测试工具
   */
  async initialize() {
    console.log("🔧 初始化可靠性测试工具");
    await this.sloMonitor.initialize();
    await this.failureDetector.initialize();
    await this.recoveryTester.initialize();
  }

  /**
   * 运行可靠性测试
   */
  async runReliabilityTest(config = {}) {
    const {
      duration = this.options.testDuration,
      scenarios = ["basic_health", "load_sustained", "failure_recovery"],
      intensity = "medium",
    } = config;

    if (this.isRunning) {
      throw new Error("可靠性测试已在运行中");
    }

    this.isRunning = true;
    this.startTime = Date.now();

    console.log(`🔄 开始可靠性测试: ${duration / (24 * 60 * 60 * 1000)}天`);

    this.emit("testStart", {
      duration,
      scenarios,
      intensity,
    });

    try {
      // 并行运行多个可靠性测试场景
      const testPromises = scenarios.map((scenario) =>
        this.runReliabilityScenario(scenario, intensity, duration),
      );

      // 添加持续监控任务
      testPromises.push(this.continuousMonitoring(duration));

      await Promise.allSettled(testPromises);

      const results = this.generateReliabilityReport();

      this.emit("testComplete", results);

      return results;
    } catch (error) {
      console.error("可靠性测试失败:", error.message);
      this.emit("testError", error);
      throw error;
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * 运行可靠性测试场景
   */
  async runReliabilityScenario(scenario, intensity, duration) {
    console.log(`📋 运行可靠性场景: ${scenario} (${intensity})`);

    switch (scenario) {
      case "basic_health":
        return this.runBasicHealthTest(duration);
      case "load_sustained":
        return this.runSustainedLoadTest(intensity, duration);
      case "failure_recovery":
        return this.runFailureRecoveryTest(duration);
      case "resource_leak":
        return this.runResourceLeakTest(duration);
      case "network_stability":
        return this.runNetworkStabilityTest(duration);
      default:
        console.warn(`未知可靠性场景: ${scenario}`);
        return null;
    }
  }

  /**
   * 基础健康测试
   */
  async runBasicHealthTest(duration) {
    console.log("🏥 运行基础健康测试");

    const endTime = Date.now() + duration;
    const { checkInterval } = this.options;

    while (Date.now() < endTime && this.isRunning) {
      const healthResult = await this.performHealthCheck();
      this.testStats.healthChecks.push(healthResult);

      if (!healthResult.healthy) {
        this.recordOutage("health_check_failed", healthResult.error);
      }

      await this.sleep(checkInterval);
    }

    console.log("🏥 基础健康测试完成");
  }

  /**
   * 持续负载测试
   */
  async runSustainedLoadTest(intensity, duration) {
    console.log(`📊 运行持续负载测试 (${intensity})`);

    const endTime = Date.now() + duration;
    const targetRPS = this.getIntensityRPS(intensity);
    const interval = 1000 / targetRPS;

    while (Date.now() < endTime && this.isRunning) {
      const startTime = performance.now();

      try {
        // 执行API调用
        const result = await this.performAPICall();

        const responseTime = performance.now() - startTime;
        this.recordRequest(result.success, responseTime);

        if (!result.success) {
          this.recordError(result.error);
        }
      } catch (error) {
        const responseTime = performance.now() - startTime;
        this.recordRequest(false, responseTime);
        this.recordError(error);
      }

      await this.sleep(interval);
    }

    console.log("📊 持续负载测试完成");
  }

  /**
   * 故障恢复测试
   */
  async runFailureRecoveryTest(duration) {
    console.log("🔄 运行故障恢复测试");

    const endTime = Date.now() + duration;
    const failureInterval = 5 * 60 * 1000; // 5分钟注入一次故障
    let lastFailureTime = 0;

    while (Date.now() < endTime && this.isRunning) {
      const now = Date.now();

      // 定期注入故障
      if (now - lastFailureTime > failureInterval) {
        await this.injectRandomFailure();
        lastFailureTime = now;

        // 等待恢复
        await this.sleep(60000); // 1分钟观察恢复

        // 检查恢复状态
        const recoveryResult = await this.checkRecovery();
        if (!recoveryResult.recovered) {
          this.recordOutage("recovery_failed", recoveryResult.error);
        }
      }

      // 持续监控
      await this.performHealthCheck();
      await this.sleep(this.options.checkInterval);
    }

    console.log("🔄 故障恢复测试完成");
  }

  /**
   * 资源泄漏测试
   */
  async runResourceLeakTest(duration) {
    console.log("🧠 运行资源泄漏测试");

    const endTime = Date.now() + duration;
    const checkInterval = 2 * 60 * 1000; // 2分钟检查一次

    const initialMemory = process.memoryUsage().heapUsed;
    let lastMemoryCheck = initialMemory;

    while (Date.now() < endTime && this.isRunning) {
      await this.sleep(checkInterval);

      const currentMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = currentMemory - lastMemoryCheck;
      const totalGrowth = currentMemory - initialMemory;

      // 记录资源使用情况
      this.testStats.resourceUsage.push({
        timestamp: Date.now(),
        memory: currentMemory,
        growth: memoryGrowth,
        totalGrowth,
      });

      // 检查内存泄漏 (每2分钟增长超过10MB)
      if (memoryGrowth > 10 * 1024 * 1024) {
        console.warn(
          `⚠️ 检测到潜在内存泄漏: +${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        );
        this.emit("potentialMemoryLeak", {
          growth: memoryGrowth,
          timestamp: Date.now(),
        });
      }

      lastMemoryCheck = currentMemory;
    }

    console.log("🧠 资源泄漏测试完成");
  }

  /**
   * 网络稳定性测试
   */
  async runNetworkStabilityTest(duration) {
    console.log("🌐 运行网络稳定性测试");

    const endTime = Date.now() + duration;
    const checkInterval = 30000; // 30秒检查一次

    while (Date.now() < endTime && this.isRunning) {
      const networkResult = await this.testNetworkConnectivity();

      if (!networkResult.stable) {
        this.recordOutage("network_unstable", networkResult.error);
      }

      // 测试网络延迟
      const latencyResult = await this.measureNetworkLatency();
      if (latencyResult.latency > 5000) {
        // 5秒
        console.warn(`⚠️ 网络延迟过高: ${latencyResult.latency}ms`);
      }

      await this.sleep(checkInterval);
    }

    console.log("🌐 网络稳定性测试完成");
  }

  /**
   * 持续监控
   */
  async continuousMonitoring(duration) {
    console.log("📊 开始持续监控");

    const endTime = Date.now() + duration;
    const monitorInterval = 10000; // 10秒

    while (Date.now() < endTime && this.isRunning) {
      // 更新SLO指标
      await this.sloMonitor.updateMetrics(this.testStats);

      // 检查SLO违规
      const sloViolations = this.sloMonitor.checkViolations();
      if (sloViolations.length > 0) {
        sloViolations.forEach((violation) => {
          console.warn(`⚠️ SLO违规: ${violation.metric} - ${violation.message}`);
          this.emit("sloViolation", violation);
        });
      }

      // 故障检测
      const failures = await this.failureDetector.detectFailures();
      if (failures.length > 0) {
        failures.forEach((failure) => {
          this.recordOutage(failure.type, failure.details);
          this.emit("failureDetected", failure);
        });
      }

      await this.sleep(monitorInterval);
    }

    console.log("📊 持续监控完成");
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    try {
      const axios = require("axios");
      const response = await axios.get("http://localhost:8080/health", {
        timeout: 5000,
      });

      const healthy = response.status === 200 && response.data.success;

      this.testStats.lastHealthCheck = {
        timestamp: Date.now(),
        healthy,
        responseTime: response.data.responseTime || 0,
        statusCode: response.status,
      };

      return this.testStats.lastHealthCheck;
    } catch (error) {
      return {
        timestamp: Date.now(),
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * 执行API调用
   */
  async performAPICall() {
    try {
      const axios = require("axios");
      const response = await axios.post(
        "http://localhost:8080/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: "Hello" }],
          max_tokens: 50,
        },
        {
          headers: { Authorization: "Bearer test-key" },
          timeout: 30000,
        },
      );

      return {
        success: true,
        responseTime: response.data.responseTime || 0,
        statusCode: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status || 0,
      };
    }
  }

  /**
   * 测试网络连接性
   */
  async testNetworkConnectivity() {
    try {
      const axios = require("axios");
      const response = await axios.get("https://httpbin.org/status/200", {
        timeout: 10000,
      });

      return {
        stable: response.status === 200,
        latency: response.data.responseTime || 0,
      };
    } catch (error) {
      return {
        stable: false,
        error: error.message,
      };
    }
  }

  /**
   * 测量网络延迟
   */
  async measureNetworkLatency() {
    const axios = require("axios");
    const startTime = performance.now();

    try {
      await axios.get("https://httpbin.org/delay/0.1", { timeout: 5000 });
      const latency = performance.now() - startTime;

      return { latency };
    } catch (error) {
      return { latency: Infinity, error: error.message };
    }
  }

  /**
   * 注入随机故障
   */
  async injectRandomFailure() {
    const failures = [
      "network_timeout",
      "service_restart",
      "memory_pressure",
      "cpu_overload",
    ];

    const randomFailure = failures[Math.floor(Math.random() * failures.length)];
    console.log(`💣 注入故障: ${randomFailure}`);

    // 这里可以实现具体的故障注入逻辑
    // 为了演示，我们只是记录故障
    this.recordOutage(`injected_${randomFailure}`, "测试故障注入");
  }

  /**
   * 检查恢复状态
   */
  async checkRecovery() {
    const healthResult = await this.performHealthCheck();

    return {
      recovered: healthResult.healthy,
      error: healthResult.error,
    };
  }

  /**
   * 记录请求
   */
  recordRequest(success, responseTime) {
    this.testStats.totalRequests++;
    this.testStats.totalResponseTime += responseTime;

    if (success) {
      this.testStats.successfulRequests++;
    } else {
      this.testStats.failedRequests++;
    }
  }

  /**
   * 记录错误
   */
  recordError(error) {
    const errorType = this.categorizeError(error);
    this.testStats.errorPatterns.set(
      errorType,
      (this.testStats.errorPatterns.get(errorType) || 0) + 1,
    );
  }

  /**
   * 记录中断
   */
  recordOutage(type, details) {
    if (this.testStats.currentOutage) {
      // 结束当前中断
      this.testStats.currentOutage.endTime = Date.now();
      this.testStats.currentOutage.duration =
        this.testStats.currentOutage.endTime -
        this.testStats.currentOutage.startTime;
      this.testStats.outages.push(this.testStats.currentOutage);
    }

    // 开始新中断
    this.testStats.currentOutage = {
      type,
      details,
      startTime: Date.now(),
      endTime: null,
      duration: null,
    };

    console.warn(`⚠️ 系统中断: ${type} - ${details}`);
    this.emit("outageRecorded", this.testStats.currentOutage);
  }

  /**
   * 分类错误
   */
  categorizeError(error) {
    if (error.message.includes("timeout")) return "timeout";
    if (error.message.includes("ECONNREFUSED")) return "connection_refused";
    if (error.message.includes("ENOTFOUND")) return "dns_error";
    if (error.response?.status >= 500) return "server_error";
    if (error.response?.status >= 400) return "client_error";
    return "unknown";
  }

  /**
   * 获取强度对应的RPS
   */
  getIntensityRPS(intensity) {
    switch (intensity) {
      case "low":
        return 1;
      case "medium":
        return 5;
      case "high":
        return 10;
      case "extreme":
        return 20;
      default:
        return 5;
    }
  }

  /**
   * 生成可靠性测试报告
   */
  generateReliabilityReport() {
    const duration = (Date.now() - this.startTime) / 1000; // 秒
    const totalDowntime =
      this.testStats.outages.reduce(
        (sum, outage) => sum + (outage.duration || 0),
        0,
      ) / 1000; // 秒
    const uptime = ((duration - totalDowntime) / duration) * 100;

    const errorRate =
      this.testStats.totalRequests > 0
        ? (this.testStats.failedRequests / this.testStats.totalRequests) * 100
        : 0;

    const avgResponseTime =
      this.testStats.totalRequests > 0
        ? this.testStats.totalResponseTime / this.testStats.totalRequests
        : 0;

    const sloStatus = this.sloMonitor.getStatus();

    return {
      summary: {
        duration,
        uptime: uptime.toFixed(4),
        availability: uptime.toFixed(4),
        totalRequests: this.testStats.totalRequests,
        successfulRequests: this.testStats.successfulRequests,
        failedRequests: this.testStats.failedRequests,
        errorRate: errorRate.toFixed(4),
        averageResponseTime: avgResponseTime.toFixed(2),
        totalOutages: this.testStats.outages.length,
        totalDowntime,
      },
      outages: this.testStats.outages,
      sloCompliance: sloStatus,
      errorPatterns: Object.fromEntries(this.testStats.errorPatterns),
      resourceUsage: this.testStats.resourceUsage,
      recommendations: this.generateReliabilityRecommendations(
        uptime,
        errorRate,
        avgResponseTime,
        sloStatus,
      ),
    };
  }

  /**
   * 生成可靠性建议
   */
  generateReliabilityRecommendations(
    uptime,
    errorRate,
    avgResponseTime,
    sloStatus,
  ) {
    const recommendations = [];

    if (uptime < this.options.uptimeTarget) {
      recommendations.push(
        `可用性未达到目标 ${this.options.uptimeTarget}%，当前: ${uptime.toFixed(2)}%。建议加强系统稳定性。`,
      );
    }

    if (errorRate > this.options.errorRateTarget) {
      recommendations.push(
        `错误率超过目标 ${this.options.errorRateTarget}%，当前: ${errorRate.toFixed(2)}%。建议改进错误处理。`,
      );
    }

    if (avgResponseTime > this.options.responseTimeTarget) {
      recommendations.push(
        `平均响应时间超过目标 ${this.options.responseTimeTarget}ms，当前: ${avgResponseTime.toFixed(2)}ms。建议优化性能。`,
      );
    }

    if (this.testStats.outages.length > 5) {
      recommendations.push(
        "系统中断次数过多，建议检查系统架构和故障恢复机制。",
      );
    }

    if (sloStatus.violations > 0) {
      recommendations.push(
        `存在 ${sloStatus.violations} 个SLO违规，建议立即采取纠正措施。`,
      );
    }

    return recommendations;
  }

  /**
   * 休眠工具函数
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    console.log("🧹 清理可靠性测试环境");
    this.isRunning = false;

    // 结束当前中断记录
    if (this.testStats.currentOutage) {
      this.testStats.currentOutage.endTime = Date.now();
      this.testStats.currentOutage.duration =
        this.testStats.currentOutage.endTime -
        this.testStats.currentOutage.startTime;
      this.testStats.outages.push(this.testStats.currentOutage);
      this.testStats.currentOutage = null;
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    const totalDowntime = this.testStats.outages.reduce(
      (sum, outage) => sum + (outage.duration || 0),
      0,
    );
    const uptime =
      duration > 0 ? ((duration - totalDowntime) / duration) * 100 : 100;

    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      duration,
      uptime: uptime.toFixed(4),
      totalRequests: this.testStats.totalRequests,
      successfulRequests: this.testStats.successfulRequests,
      failedRequests: this.testStats.failedRequests,
      totalOutages: this.testStats.outages.length,
      sloStatus: this.sloMonitor.getStatus(),
    };
  }

  /**
   * 停止可靠性测试
   */
  stop() {
    this.isRunning = false;
    console.log("🛑 可靠性测试已停止");
    this.emit("testStopped");
  }
}

/**
 * SLO监控器
 */
class SLOMonitor {
  constructor(options) {
    this.options = options;
    this.metrics = {
      uptime: 100.0,
      availability: 100.0,
      errorRate: 0.0,
      responseTime: 0,
      violations: [],
    };
  }

  async initialize() {
    console.log("🔧 初始化SLO监控器");
  }

  async updateMetrics(stats) {
    // 更新指标
    const totalRequests = stats.totalRequests || 0;
    const failedRequests = stats.failedRequests || 0;
    const totalResponseTime = stats.totalResponseTime || 0;

    this.metrics.errorRate =
      totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;
    this.metrics.responseTime =
      totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    // 计算可用性
    const totalTime = stats.startTime ? Date.now() - stats.startTime : 0;
    const downtime = stats.outages.reduce(
      (sum, outage) => sum + (outage.duration || 0),
      0,
    );
    this.metrics.availability =
      totalTime > 0 ? ((totalTime - downtime) / totalTime) * 100 : 100;
  }

  checkViolations() {
    const violations = [];

    if (this.metrics.availability < this.options.uptimeTarget) {
      violations.push({
        metric: "availability",
        target: this.options.uptimeTarget,
        current: this.metrics.availability,
        message: `可用性未达到目标: ${this.metrics.availability.toFixed(2)}% < ${this.options.uptimeTarget}%`,
      });
    }

    if (this.metrics.errorRate > this.options.errorRateTarget) {
      violations.push({
        metric: "error_rate",
        target: this.options.errorRateTarget,
        current: this.metrics.errorRate,
        message: `错误率超过目标: ${this.metrics.errorRate.toFixed(2)}% > ${this.options.errorRateTarget}%`,
      });
    }

    if (this.metrics.responseTime > this.options.responseTimeTarget) {
      violations.push({
        metric: "response_time",
        target: this.options.responseTimeTarget,
        current: this.metrics.responseTime,
        message: `响应时间超过目标: ${this.metrics.responseTime.toFixed(2)}ms > ${this.options.responseTimeTarget}ms`,
      });
    }

    return violations;
  }

  getStatus() {
    return {
      ...this.metrics,
      violations: this.checkViolations().length,
      compliance: this.checkViolations().length === 0,
    };
  }
}

/**
 * 故障检测器
 */
class FailureDetector {
  constructor() {
    this.failurePatterns = [
      { type: "response_time_spike", threshold: 5000, window: 60000 },
      { type: "error_rate_spike", threshold: 0.5, window: 300000 },
      { type: "memory_leak", threshold: 100 * 1024 * 1024, window: 3600000 },
      { type: "cpu_overload", threshold: 95, window: 300000 },
    ];
    this.history = new Map();
  }

  async initialize() {
    console.log("🔧 初始化故障检测器");
  }

  async detectFailures() {
    const failures = [];
    const now = Date.now();

    for (const pattern of this.failurePatterns) {
      const windowStart = now - pattern.window;
      const recentData = this.getRecentData(pattern.type, windowStart);

      if (this.checkThreshold(pattern, recentData)) {
        failures.push({
          type: pattern.type,
          timestamp: now,
          threshold: pattern.threshold,
          actual: this.getActualValue(pattern, recentData),
          details: `${pattern.type} 超过阈值`,
        });
      }
    }

    return failures;
  }

  getRecentData(_type, _windowStart) {
    // 这里应该从实际监控数据获取
    // 为了演示，返回模拟数据
    return [];
  }

  checkThreshold(_pattern, _data) {
    // 阈值检查逻辑
    return false; // 简化实现
  }

  getActualValue(_pattern, _data) {
    // 获取实际值逻辑
    return 0; // 简化实现
  }
}

/**
 * 恢复测试器
 */
class RecoveryTester {
  constructor() {
    this.recoveryTests = [];
  }

  async initialize() {
    console.log("🔧 初始化恢复测试器");
  }

  async testRecovery() {
    // 恢复测试逻辑
    const test = {
      timestamp: Date.now(),
      type: "recovery_test",
      passed: true,
    };

    this.recoveryTests.push(test);
  }

  getStats() {
    const passed = this.recoveryTests.filter((t) => t.passed).length;
    return {
      totalTests: this.recoveryTests.length,
      passed,
      successRate:
        this.recoveryTests.length > 0
          ? ((passed / this.recoveryTests.length) * 100).toFixed(2)
          : 0,
    };
  }
}

module.exports = {
  ReliabilityTestingTool,
  SLOMonitor,
  FailureDetector,
  RecoveryTester,
};
