/**
 * Sira AI网关 - 性能测试工具
 * 基于Apache JMeter、Gatling和Artillery的最佳实践
 * 提供全面的性能基准测试和容量规划
 */

const EventEmitter = require('events');
const { performance, PerformanceObserver } = require('perf_hooks');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * 性能测试工具
 * 执行多种类型的性能测试：基准测试、负载测试、峰值测试、容量测试
 */
class PerformanceTestingTool extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8080',
      testDuration: options.testDuration || 300, // 5分钟
      warmupTime: options.warmupTime || 60, // 1分钟预热
      cooldownTime: options.cooldownTime || 30, // 30秒冷却
      concurrentUsers: options.concurrentUsers || 100,
      rampUpTime: options.rampUpTime || 120, // 2分钟爬坡
      thinkTime: options.thinkTime || 1000, // 1秒思考时间
      timeout: options.timeout || 30000,
      enableMetrics: options.enableMetrics !== false,
      reportDir: options.reportDir || path.join(__dirname, '../reports/performance'),
      ...options,
    };

    // 测试状态
    this.isRunning = false;
    this.startTime = null;
    this.testPhase = 'idle'; // idle, warmup, test, cooldown

    // 性能指标收集
    this.metrics = {
      responseTime: {
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        values: [],
      },
      throughput: {
        current: 0,
        peak: 0,
        average: 0,
        timeline: [],
      },
      errorRate: {
        count: 0,
        rate: 0.0,
        errors: new Map(),
      },
      resourceUsage: {
        cpu: [],
        memory: [],
        network: [],
      },
      concurrentUsers: [],
      timestamps: [],
    };

    // 测试场景
    this.testScenarios = new Map();
    this.setupTestScenarios();

    // HTTP客户端池
    this.httpClients = [];

    // 性能观察者
    this.performanceObserver = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        this.recordPerformanceEntry(entry);
      }
    });
    this.performanceObserver.observe({ entryTypes: ['measure', 'function'] });
  }

  /**
   * 初始化性能测试工具
   */
  async initialize() {
    console.log('🔧 初始化性能测试工具');

    // 创建报告目录
    await fs.mkdir(this.options.reportDir, { recursive: true });

    // 初始化HTTP客户端池
    this.initializeHttpClients();
  }

  /**
   * 初始化HTTP客户端池
   */
  initializeHttpClients() {
    for (let i = 0; i < this.options.concurrentUsers; i++) {
      const client = axios.create({
        baseURL: this.options.baseUrl,
        timeout: this.options.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Sira-Performance-Tester/1.0',
        },
      });

      // 添加请求/响应拦截器
      client.interceptors.request.use(config => {
        config.metadata = { startTime: performance.now() };
        return config;
      });

      client.interceptors.response.use(
        response => {
          const duration = performance.now() - response.config.metadata.startTime;
          this.recordResponse(response, duration);
          return response;
        },
        error => {
          const duration = performance.now() - error.config?.metadata?.startTime || 0;
          this.recordError(error, duration);
          throw error;
        }
      );

      this.httpClients.push(client);
    }
  }

  /**
   * 设置测试场景
   */
  setupTestScenarios() {
    // AI聊天性能测试
    this.testScenarios.set('ai_chat_performance', {
      name: 'AI聊天性能测试',
      description: '测试AI聊天接口的性能表现',
      endpoint: '/chat/completions',
      method: 'POST',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: '请写一首关于技术的诗' }],
        max_tokens: 100,
        temperature: 0.7,
      },
      headers: {
        Authorization: 'Bearer sk-test-key',
      },
      weight: 0.7, // 70%的请求
    });

    // 参数优化性能测试
    this.testScenarios.set('parameter_optimization', {
      name: '参数优化性能测试',
      description: '测试参数优化接口的性能',
      endpoint: '/parameters/optimize',
      method: 'POST',
      payload: {
        parameters: {
          temperature: 0.8,
          top_p: 0.9,
          frequency_penalty: 0.1,
        },
        task_type: 'creative',
      },
      weight: 0.1, // 10%的请求
    });

    // API密钥验证测试
    this.testScenarios.set('api_key_validation', {
      name: 'API密钥验证性能测试',
      description: '测试API密钥验证的性能',
      endpoint: '/api-keys/validate',
      method: 'POST',
      payload: {
        key: 'sk-test-key-123',
        permissions: ['read', 'write'],
      },
      weight: 0.1, // 10%的请求
    });

    // 批量处理测试
    this.testScenarios.set('batch_processing', {
      name: '批量处理性能测试',
      description: '测试批量处理接口的性能',
      endpoint: '/batch-processing/batches',
      method: 'POST',
      payload: {
        requests: Array.from({ length: 5 }, (_, i) => ({
          id: `req_${i}`,
          model: 'gpt-3.5-turbo',
          prompt: `生成测试内容 ${i + 1}`,
        })),
      },
      weight: 0.05, // 5%的请求
    });

    // 健康检查测试
    this.testScenarios.set('health_check', {
      name: '健康检查性能测试',
      description: '测试健康检查接口的性能',
      endpoint: '/health',
      method: 'GET',
      weight: 0.05, // 5%的请求
    });
  }

  /**
   * 运行性能测试
   */
  async runPerformanceTest(config = {}) {
    const {
      scenario = 'ai_chat_performance',
      testType = 'load', // benchmark, load, stress, spike, volume
      duration = this.options.testDuration,
      concurrentUsers = this.options.concurrentUsers,
      targetRPS = 50,
    } = config;

    if (this.isRunning) {
      throw new Error('性能测试已在运行中');
    }

    this.isRunning = true;
    this.startTime = Date.now();

    console.log(`📊 开始性能测试: ${scenario} (${testType}模式)`);

    this.emit('testStart', {
      scenario,
      testType,
      duration,
      concurrentUsers,
      targetRPS,
    });

    try {
      let results;

      switch (testType) {
        case 'benchmark':
          results = await this.runBenchmarkTest(scenario, duration);
          break;
        case 'load':
          results = await this.runLoadTest(scenario, targetRPS, duration, concurrentUsers);
          break;
        case 'stress':
          results = await this.runStressTest(scenario, concurrentUsers, duration);
          break;
        case 'spike':
          results = await this.runSpikeTest(scenario, targetRPS, duration);
          break;
        case 'volume':
          results = await this.runVolumeTest(scenario, duration);
          break;
        default:
          results = await this.runLoadTest(scenario, targetRPS, duration, concurrentUsers);
      }

      const report = this.generatePerformanceReport(results);

      this.emit('testComplete', report);

      return report;
    } catch (error) {
      console.error('性能测试失败:', error.message);
      this.emit('testError', error);
      throw error;
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * 运行基准测试
   */
  async runBenchmarkTest(scenario, duration) {
    console.log(`📈 运行基准测试: ${scenario}`);

    const scenarioConfig = this.testScenarios.get(scenario);
    if (!scenarioConfig) {
      throw new Error(`测试场景不存在: ${scenario}`);
    }

    // 预热阶段
    await this.warmupPhase(30, scenarioConfig);

    // 基准测试阶段
    this.testPhase = 'benchmark';
    const endTime = Date.now() + duration * 1000;
    const results = [];

    while (Date.now() < endTime) {
      const startTime = performance.now();

      try {
        const response = await this.httpClients[0].request({
          url: scenarioConfig.endpoint,
          method: scenarioConfig.method,
          data: scenarioConfig.payload,
          headers: scenarioConfig.headers,
        });

        const responseTime = performance.now() - startTime;
        results.push({
          success: true,
          responseTime,
          statusCode: response.status,
          timestamp: Date.now(),
        });
      } catch (error) {
        const responseTime = performance.now() - startTime;
        results.push({
          success: false,
          responseTime,
          error: error.message,
          statusCode: error.response?.status || 0,
          timestamp: Date.now(),
        });
      }

      // 控制请求频率
      await this.sleep(1000); // 1秒间隔
    }

    return results;
  }

  /**
   * 运行负载测试
   */
  async runLoadTest(scenario, targetRPS, duration, concurrentUsers) {
    console.log(`📊 运行负载测试: ${scenario} (${targetRPS} RPS)`);

    // 预热阶段
    await this.warmupPhase(this.options.warmupTime, this.testScenarios.get(scenario));

    // 爬坡阶段
    await this.rampUpPhase(targetRPS, this.options.rampUpTime);

    // 负载测试阶段
    this.testPhase = 'load';
    const endTime = Date.now() + duration * 1000;
    const interval = 1000 / targetRPS;
    const workers = [];
    const results = [];

    // 启动多个工作线程
    for (let i = 0; i < Math.min(concurrentUsers, targetRPS); i++) {
      workers.push(this.createLoadWorker(scenario, interval, endTime, results));
    }

    await Promise.all(workers);

    // 冷却阶段
    await this.cooldownPhase();

    return results;
  }

  /**
   * 运行压力测试
   */
  async runStressTest(scenario, maxUsers, duration) {
    console.log(`💥 运行压力测试: ${scenario} (最大用户数: ${maxUsers})`);

    const scenarioConfig = this.testScenarios.get(scenario);
    const endTime = Date.now() + duration * 1000;
    const results = [];

    // 逐渐增加并发用户数
    let currentUsers = 1;
    const userIncrement = Math.max(1, Math.floor(maxUsers / (duration / 10))); // 每10秒增加

    while (Date.now() < endTime && currentUsers <= maxUsers) {
      const interval = 1000 / currentUsers; // 根据用户数调整间隔

      const workers = [];
      for (let i = 0; i < currentUsers; i++) {
        workers.push(
          this.createStressWorker(
            scenarioConfig,
            interval,
            Math.min(endTime, Date.now() + 10000),
            results,
            i
          )
        );
      }

      await Promise.all(workers);

      currentUsers = Math.min(currentUsers + userIncrement, maxUsers);
    }

    return results;
  }

  /**
   * 运行峰值测试
   */
  async runSpikeTest(scenario, targetRPS, duration) {
    console.log(`⚡ 运行峰值测试: ${scenario} (峰值RPS: ${targetRPS})`);

    const scenarioConfig = this.testScenarios.get(scenario);
    const endTime = Date.now() + duration * 1000;
    const results = [];

    // 正常负载 -> 峰值 -> 正常负载 的模式
    const phases = [
      { rps: targetRPS * 0.2, duration: duration * 0.3 }, // 正常负载
      { rps: targetRPS, duration: duration * 0.4 }, // 峰值负载
      { rps: targetRPS * 0.2, duration: duration * 0.3 }, // 恢复正常
    ];

    for (const phase of phases) {
      if (Date.now() >= endTime) break;

      const phaseEndTime = Math.min(endTime, Date.now() + phase.duration * 1000);
      const interval = 1000 / phase.rps;

      const workers = [];
      for (let i = 0; i < Math.min(this.options.concurrentUsers, Math.ceil(phase.rps)); i++) {
        workers.push(
          this.createSpikeWorker(scenarioConfig, interval, phaseEndTime, results, phase.rps)
        );
      }

      await Promise.all(workers);
    }

    return results;
  }

  /**
   * 运行容量测试
   */
  async runVolumeTest(scenario, duration) {
    console.log(`📦 运行容量测试: ${scenario}`);

    const scenarioConfig = this.testScenarios.get(scenario);
    const endTime = Date.now() + duration * 1000;
    const results = [];

    // 大数据量测试
    const largePayload = {
      ...scenarioConfig.payload,
      messages: Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `这是测试消息 ${i + 1}，包含大量文本内容用于测试系统处理大数据量的能力。`.repeat(
          10
        ),
      })),
    };

    while (Date.now() < endTime) {
      try {
        const response = await this.httpClients[0].request({
          url: scenarioConfig.endpoint,
          method: scenarioConfig.method,
          data: largePayload,
          headers: scenarioConfig.headers,
          timeout: 60000, // 容量测试使用更长的超时时间
        });

        results.push({
          success: true,
          responseTime: performance.now() - performance.now(), // 会被拦截器覆盖
          dataSize: JSON.stringify(largePayload).length,
          statusCode: response.status,
          timestamp: Date.now(),
        });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          dataSize: JSON.stringify(largePayload).length,
          statusCode: error.response?.status || 0,
          timestamp: Date.now(),
        });
      }

      await this.sleep(5000); // 容量测试间隔较长
    }

    return results;
  }

  /**
   * 创建负载测试工作线程
   */
  createLoadWorker(scenario, interval, endTime, results) {
    return new Promise(resolve => {
      const scenarioConfig = this.testScenarios.get(scenario);
      const clientIndex = Math.floor(Math.random() * this.httpClients.length);

      const executeRequest = async () => {
        try {
          await this.httpClients[clientIndex].request({
            url: scenarioConfig.endpoint,
            method: scenarioConfig.method,
            data: scenarioConfig.payload,
            headers: scenarioConfig.headers,
          });
          // 结果会被拦截器记录
        } catch (error) {
          // 错误会被拦截器记录
        }
      };

      const runLoop = () => {
        if (Date.now() >= endTime) {
          resolve();
          return;
        }

        executeRequest().then(() => {
          setTimeout(runLoop, interval);
        });
      };

      runLoop();
    });
  }

  /**
   * 创建压力测试工作线程
   */
  createStressWorker(scenarioConfig, interval, endTime, results, workerId) {
    return new Promise(resolve => {
      const clientIndex = workerId % this.httpClients.length;

      const executeRequest = async () => {
        try {
          await this.httpClients[clientIndex].request({
            url: scenarioConfig.endpoint,
            method: scenarioConfig.method,
            data: scenarioConfig.payload,
            headers: scenarioConfig.headers,
          });
        } catch (error) {
          // 错误处理
        }
      };

      const runLoop = () => {
        if (Date.now() >= endTime) {
          resolve();
          return;
        }

        executeRequest().then(() => {
          setTimeout(runLoop, interval);
        });
      };

      runLoop();
    });
  }

  /**
   * 创建峰值测试工作线程
   */
  createSpikeWorker(scenarioConfig, interval, endTime, results, targetRPS) {
    return new Promise(resolve => {
      const clientIndex = Math.floor(Math.random() * this.httpClients.length);

      const executeRequest = async () => {
        try {
          await this.httpClients[clientIndex].request({
            url: scenarioConfig.endpoint,
            method: scenarioConfig.method,
            data: scenarioConfig.payload,
            headers: scenarioConfig.headers,
          });
        } catch (error) {
          // 错误处理
        }
      };

      const runLoop = () => {
        if (Date.now() >= endTime) {
          resolve();
          return;
        }

        executeRequest().then(() => {
          setTimeout(runLoop, interval);
        });
      };

      runLoop();
    });
  }

  /**
   * 预热阶段
   */
  async warmupPhase(duration, scenarioConfig) {
    this.testPhase = 'warmup';
    console.log(`🔥 预热阶段: ${duration}秒`);

    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
      try {
        await this.httpClients[0].request({
          url: scenarioConfig.endpoint,
          method: scenarioConfig.method,
          data: scenarioConfig.payload,
          headers: scenarioConfig.headers,
        });
      } catch (error) {
        // 预热阶段忽略错误
      }

      await this.sleep(1000);
    }

    console.log('🔥 预热阶段完成');
  }

  /**
   * 爬坡阶段
   */
  async rampUpPhase(targetRPS, duration) {
    this.testPhase = 'ramp_up';
    console.log(`📈 爬坡阶段: 0 -> ${targetRPS} RPS (${duration}秒)`);

    const endTime = Date.now() + duration * 1000;
    let currentRPS = 0;
    const rpsIncrement = targetRPS / (duration / 1); // 每秒增加

    while (Date.now() < endTime && currentRPS < targetRPS) {
      currentRPS = Math.min(currentRPS + rpsIncrement, targetRPS);
      const interval = 1000 / currentRPS;

      // 发送请求
      try {
        await this.httpClients[0].get('/health');
      } catch (error) {
        // 忽略爬坡阶段错误
      }

      await this.sleep(interval);
    }

    console.log('📈 爬坡阶段完成');
  }

  /**
   * 冷却阶段
   */
  async cooldownPhase() {
    this.testPhase = 'cooldown';
    console.log(`❄️ 冷却阶段: ${this.options.cooldownTime}秒`);

    await this.sleep(this.options.cooldownTime * 1000);
    console.log('❄️ 冷却阶段完成');
  }

  /**
   * 记录响应
   */
  recordResponse(response, responseTime) {
    this.metrics.responseTime.values.push(responseTime);

    if (responseTime < this.metrics.responseTime.min) {
      this.metrics.responseTime.min = responseTime;
    }
    if (responseTime > this.metrics.responseTime.max) {
      this.metrics.responseTime.max = responseTime;
    }

    // 更新吞吐量
    const timestamp = Date.now();
    this.metrics.throughput.current++;
    this.metrics.throughput.timeline.push({
      timestamp,
      rps: this.metrics.throughput.current,
      responseTime,
    });

    if (this.metrics.throughput.current > this.metrics.throughput.peak) {
      this.metrics.throughput.peak = this.metrics.throughput.current;
    }

    this.metrics.timestamps.push(timestamp);
  }

  /**
   * 记录错误
   */
  recordError(error, responseTime) {
    this.metrics.errorRate.count++;

    const errorType = this.categorizeError(error);
    this.metrics.errorRate.errors.set(
      errorType,
      (this.metrics.errorRate.errors.get(errorType) || 0) + 1
    );

    // 即使出错也记录响应时间用于统计
    if (responseTime > 0) {
      this.metrics.responseTime.values.push(responseTime);
    }
  }

  /**
   * 记录性能条目
   */
  recordPerformanceEntry(entry) {
    // 处理性能观察者记录的条目
    console.log(`性能条目: ${entry.name} - ${entry.duration.toFixed(2)}ms`);
  }

  /**
   * 分类错误
   */
  categorizeError(error) {
    if (error.code === 'ECONNREFUSED') return 'connection_refused';
    if (error.code === 'ETIMEDOUT') return 'timeout';
    if (error.response?.status >= 500) return 'server_error';
    if (error.response?.status >= 400) return 'client_error';
    return 'unknown';
  }

  /**
   * 生成性能测试报告
   */
  generatePerformanceReport(results) {
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;

    // 计算响应时间统计
    const responseTimes = results.filter(r => r.success).map(r => r.responseTime);
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const percentiles = this.calculatePercentiles(responseTimes, [50, 95, 99]);

    // 计算吞吐量
    const avgThroughput =
      this.metrics.throughput.timeline.length > 0
        ? this.metrics.throughput.timeline.reduce((sum, point) => sum + point.rps, 0) /
          this.metrics.throughput.timeline.length
        : 0;

    // 计算错误率
    const errorRate = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

    const report = {
      summary: {
        duration: (Date.now() - this.startTime) / 1000,
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate: `${((successfulRequests / totalRequests) * 100).toFixed(2)}%`,
        errorRate: `${errorRate.toFixed(2)}%`,
        averageResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        minResponseTime: `${this.metrics.responseTime.min.toFixed(2)}ms`,
        maxResponseTime: `${this.metrics.responseTime.max.toFixed(2)}ms`,
        p50ResponseTime: `${percentiles[50]?.toFixed(2) || 0}ms`,
        p95ResponseTime: `${percentiles[95]?.toFixed(2) || 0}ms`,
        p99ResponseTime: `${percentiles[99]?.toFixed(2) || 0}ms`,
        averageThroughput: avgThroughput.toFixed(2),
        peakThroughput: this.metrics.throughput.peak,
      },
      metrics: this.metrics,
      errors: Object.fromEntries(this.metrics.errorRate.errors),
      recommendations: this.generatePerformanceRecommendations(
        avgResponseTime,
        errorRate,
        avgThroughput,
        percentiles
      ),
    };

    return report;
  }

  /**
   * 计算百分位数
   */
  calculatePercentiles(values, percentiles) {
    if (values.length === 0) return {};

    const sorted = [...values].sort((a, b) => a - b);
    const result = {};

    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[p] = sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    });

    return result;
  }

  /**
   * 生成性能建议
   */
  generatePerformanceRecommendations(avgResponseTime, errorRate, avgThroughput, percentiles) {
    const recommendations = [];

    if (avgResponseTime > 2000) {
      recommendations.push('平均响应时间超过2秒，建议优化数据库查询和缓存策略');
    }

    if (percentiles[95] > 5000) {
      recommendations.push('95%响应时间超过5秒，存在严重的性能问题');
    }

    if (errorRate > 5) {
      recommendations.push('错误率超过5%，系统稳定性不足');
    }

    if (avgThroughput < 10) {
      recommendations.push('平均吞吐量过低，建议增加服务器资源或优化架构');
    }

    return recommendations;
  }

  /**
   * 休眠工具函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    console.log('🧹 清理性能测试环境');
    this.isRunning = false;

    // 断开性能观察者
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }

    // 清理HTTP客户端
    this.httpClients.length = 0;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      testPhase: this.testPhase,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      metrics: {
        totalRequests: this.metrics.responseTime.values.length,
        currentThroughput: this.metrics.throughput.current,
        errorCount: this.metrics.errorRate.count,
      },
    };
  }

  /**
   * 停止性能测试
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 性能测试已停止');
    this.emit('testStopped');
  }
}

module.exports = { PerformanceTestingTool };
