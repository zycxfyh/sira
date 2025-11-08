/**
 * Sira AI网关 - 压力测试工具
 * 基于Netflix的Chaos Monkey和AWS的Stress Testing最佳实践
 * 测试系统在极端条件下的表现和弹性
 */

const EventEmitter = require('events');
const { performance } = require('perf_hooks');
const os = require('os');

/**
 * 压力测试工具
 * 模拟高负载、资源耗尽、内存泄漏等极端场景
 */
class StressTestingTool extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxMemoryUsage: options.maxMemoryUsage || 0.8, // 80%内存使用率
      maxCPUUsage: options.maxCPUUsage || 0.9, // 90%CPU使用率
      testDuration: options.testDuration || 600, // 10分钟
      rampUpTime: options.rampUpTime || 120, // 2分钟预热
      cooldownTime: options.cooldownTime || 60, // 1分钟冷却
      memoryGrowthRate: options.memoryGrowthRate || 10 * 1024 * 1024, // 10MB/秒
      connectionPoolSize: options.connectionPoolSize || 1000,
      enableResourceExhaustion: options.enableResourceExhaustion !== false,
      enableMemoryLeaks: options.enableMemoryLeaks !== false,
      enableCPUStress: options.enableCPUStress !== false,
      ...options,
    };

    // 测试状态
    this.isRunning = false;
    this.startTime = null;
    this.testPhase = 'idle'; // idle, warmup, stress, cooldown

    // 系统监控
    this.systemMetrics = {
      memory: [],
      cpu: [],
      network: [],
      disk: [],
      timestamps: [],
    };

    // 压力源
    this.stressSources = {
      memory: null,
      cpu: null,
      network: null,
      io: null,
    };

    // 故障注入器
    this.failureInjector = new FailureInjector();

    // 恢复机制测试器
    this.resilienceTester = new ResilienceTester();
  }

  /**
   * 初始化压力测试工具
   */
  async initialize() {
    console.log('🔧 初始化压力测试工具');
    await this.failureInjector.initialize();
    await this.resilienceTester.initialize();
  }

  /**
   * 运行压力测试
   */
  async runStressTest(config = {}) {
    const {
      scenario = 'full_system',
      intensity = 'high',
      duration = this.options.testDuration,
      enableFailures = true,
    } = config;

    if (this.isRunning) {
      throw new Error('压力测试已在运行中');
    }

    this.isRunning = true;
    this.startTime = Date.now();

    console.log(`💥 开始压力测试: ${scenario} (${intensity}强度)`);

    this.emit('testStart', {
      scenario,
      intensity,
      duration,
      enableFailures,
    });

    try {
      // 预热阶段
      await this.warmupPhase(duration * 0.2);

      // 压力阶段
      await this.stressPhase(scenario, intensity, duration * 0.6, enableFailures);

      // 故障注入阶段 (如果启用)
      if (enableFailures) {
        await this.failureInjectionPhase(duration * 0.1);
      }

      // 恢复阶段
      await this.recoveryPhase(duration * 0.1);

      const results = this.generateStressReport();

      this.emit('testComplete', results);

      return results;
    } catch (error) {
      console.error('压力测试失败:', error.message);
      this.emit('testError', error);
      throw error;
    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * 预热阶段
   */
  async warmupPhase(duration) {
    this.testPhase = 'warmup';
    console.log(`🔥 预热阶段: ${duration}秒`);

    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
      await this.monitorSystem();
      await this.sleep(1000); // 每秒监控一次
    }

    this.emit('warmupComplete');
  }

  /**
   * 压力阶段
   */
  async stressPhase(scenario, intensity, duration, enableFailures) {
    this.testPhase = 'stress';
    console.log(`💥 压力阶段: ${scenario} (${intensity}) - ${duration}秒`);

    const endTime = Date.now() + duration * 1000;

    // 根据场景启动相应的压力源
    const stressTasks = [];

    switch (scenario) {
      case 'memory_stress':
        stressTasks.push(this.applyMemoryStress(intensity, endTime));
        break;
      case 'cpu_stress':
        stressTasks.push(this.applyCPUStress(intensity, endTime));
        break;
      case 'network_stress':
        stressTasks.push(this.applyNetworkStress(intensity, endTime));
        break;
      case 'io_stress':
        stressTasks.push(this.applyIOStress(intensity, endTime));
        break;
      case 'full_system':
      default:
        stressTasks.push(
          this.applyMemoryStress(intensity, endTime),
          this.applyCPUStress(intensity, endTime),
          this.applyNetworkStress(intensity, endTime),
          this.applyIOStress(intensity, endTime)
        );
        break;
    }

    // 如果启用故障注入，添加故障注入任务
    if (enableFailures) {
      stressTasks.push(this.injectFailuresRandomly(endTime));
    }

    // 并行执行所有压力任务
    await Promise.all(stressTasks);

    this.emit('stressComplete');
  }

  /**
   * 故障注入阶段
   */
  async failureInjectionPhase(duration) {
    this.testPhase = 'failure_injection';
    console.log(`💣 故障注入阶段: ${duration}秒`);

    const endTime = Date.now() + duration * 1000;

    while (Date.now() < endTime) {
      await this.failureInjector.injectRandomFailure();
      await this.monitorSystem();
      await this.sleep(5000); // 每5秒注入一个故障
    }

    this.emit('failureInjectionComplete');
  }

  /**
   * 恢复阶段
   */
  async recoveryPhase(duration) {
    this.testPhase = 'recovery';
    console.log(`🔄 恢复阶段: ${duration}秒`);

    const endTime = Date.now() + duration * 1000;

    // 停止所有压力源
    await this.stopAllStressSources();

    // 监控恢复过程
    while (Date.now() < endTime) {
      await this.monitorSystem();
      await this.resilienceTester.testRecovery();
      await this.sleep(2000);
    }

    this.emit('recoveryComplete');
  }

  /**
   * 应用内存压力
   */
  async applyMemoryStress(intensity, endTime) {
    console.log(`🧠 应用内存压力: ${intensity}强度`);

    const memoryChunks = [];
    const chunkSize = this.getIntensityValue(intensity, {
      low: 10 * 1024 * 1024, // 10MB
      medium: 50 * 1024 * 1024, // 50MB
      high: 200 * 1024 * 1024, // 200MB
      extreme: 500 * 1024 * 1024, // 500MB
    });

    while (Date.now() < endTime) {
      try {
        // 分配内存块
        const chunk = Buffer.alloc(chunkSize);
        memoryChunks.push(chunk);

        // 检查内存使用率
        const memUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;

        if (memUsage > this.options.maxMemoryUsage) {
          console.warn(`⚠️ 内存使用率过高: ${(memUsage * 100).toFixed(2)}%`);
          // 释放一些内存
          const toRelease = Math.floor(memoryChunks.length * 0.1);
          memoryChunks.splice(0, toRelease);
          if (global.gc) global.gc();
        }

        await this.sleep(1000);
      } catch (error) {
        console.error('内存压力测试出错:', error.message);
        break;
      }
    }

    // 清理内存
    memoryChunks.length = 0;
    if (global.gc) global.gc();

    console.log('🧠 内存压力测试完成');
  }

  /**
   * 应用CPU压力
   */
  async applyCPUStress(intensity, endTime) {
    console.log(`⚡ 应用CPU压力: ${intensity}强度`);

    const workerCount = this.getIntensityValue(intensity, {
      low: 2,
      medium: 4,
      high: 8,
      extreme: os.cpus().length,
    });

    const workers = [];

    for (let i = 0; i < workerCount; i++) {
      workers.push(this.createCPUWorker(endTime));
    }

    await Promise.all(workers);
    console.log('⚡ CPU压力测试完成');
  }

  /**
   * 创建CPU压力工作线程
   */
  createCPUWorker(endTime) {
    return new Promise(resolve => {
      const worker = async () => {
        while (Date.now() < endTime) {
          // 执行CPU密集型计算
          let result = 0;
          for (let i = 0; i < 1000000; i++) {
            result += Math.sin(i) * Math.cos(i);
          }

          // 小延迟避免完全阻塞
          await this.sleep(10);
        }
        resolve();
      };

      worker();
    });
  }

  /**
   * 应用网络压力
   */
  async applyNetworkStress(intensity, endTime) {
    console.log(`🌐 应用网络压力: ${intensity}强度`);

    const connectionCount = this.getIntensityValue(intensity, {
      low: 50,
      medium: 200,
      high: 500,
      extreme: 1000,
    });

    const connections = [];

    for (let i = 0; i < connectionCount; i++) {
      connections.push(this.createNetworkConnection(endTime));
    }

    await Promise.all(connections);
    console.log('🌐 网络压力测试完成');
  }

  /**
   * 创建网络连接
   */
  async createNetworkConnection(endTime) {
    // 模拟网络连接压力
    const axios = require('axios');

    while (Date.now() < endTime) {
      try {
        // 发送大量小请求
        await axios.get('http://httpbin.org/delay/0.1', { timeout: 5000 });
      } catch (error) {
        // 忽略网络错误
      }

      await this.sleep(100);
    }
  }

  /**
   * 应用IO压力
   */
  async applyIOStress(intensity, endTime) {
    console.log(`💾 应用IO压力: ${intensity}强度`);

    const fileCount = this.getIntensityValue(intensity, {
      low: 10,
      medium: 50,
      high: 100,
      extreme: 200,
    });

    const ioTasks = [];

    for (let i = 0; i < fileCount; i++) {
      ioTasks.push(this.createIOWorker(endTime, i));
    }

    await Promise.all(ioTasks);
    console.log('💾 IO压力测试完成');
  }

  /**
   * 创建IO工作线程
   */
  async createIOWorker(endTime, workerId) {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');

    const tempDir = os.tmpdir();
    const fileName = path.join(tempDir, `stress_test_${workerId}_${Date.now()}.tmp`);

    try {
      while (Date.now() < endTime) {
        // 写入大文件
        const data = Buffer.alloc(1024 * 1024); // 1MB
        await fs.writeFile(fileName, data);

        // 读取文件
        await fs.readFile(fileName);

        // 删除文件
        await fs.unlink(fileName);

        await this.sleep(500);
      }
    } catch (error) {
      console.error(`IO工作线程 ${workerId} 出错:`, error.message);
    }
  }

  /**
   * 随机注入故障
   */
  async injectFailuresRandomly(endTime) {
    while (Date.now() < endTime) {
      const failureTypes = ['network_latency', 'memory_leak', 'cpu_spike', 'disk_full'];
      const randomFailure = failureTypes[Math.floor(Math.random() * failureTypes.length)];

      await this.failureInjector.injectFailure(randomFailure, {
        duration: Math.random() * 10000 + 5000, // 5-15秒
        intensity: Math.random(),
      });

      await this.sleep(15000 + Math.random() * 15000); // 15-30秒间隔
    }
  }

  /**
   * 监控系统状态
   */
  async monitorSystem() {
    const timestamp = Date.now();

    // 内存监控
    const memUsage = process.memoryUsage();
    this.systemMetrics.memory.push({
      timestamp,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      usagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    });

    // CPU监控
    const cpuUsage = process.cpuUsage();
    this.systemMetrics.cpu.push({
      timestamp,
      user: cpuUsage.user,
      system: cpuUsage.system,
      total: cpuUsage.user + cpuUsage.system,
    });

    // 网络监控 (简化版)
    this.systemMetrics.network.push({
      timestamp,
      connections: Math.floor(Math.random() * 1000), // 模拟数据
    });

    // 磁盘监控 (简化版)
    const fs = require('fs');
    const diskStats = {
      timestamp,
      free: Math.floor(Math.random() * 1000000000), // 模拟数据
      used: Math.floor(Math.random() * 1000000000), // 模拟数据
    };
    this.systemMetrics.disk.push(diskStats);

    this.systemMetrics.timestamps.push(timestamp);

    // 保持最近10分钟的数据
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    this.trimMetrics(tenMinutesAgo);

    this.emit('systemMetrics', {
      memory: memUsage,
      cpu: cpuUsage,
      timestamp,
    });
  }

  /**
   * 修剪指标数据
   */
  trimMetrics(cutoffTime) {
    const trimArray = (arr, timeKey = 'timestamp') => {
      const startIndex = arr.findIndex(item => item[timeKey] >= cutoffTime);
      if (startIndex > 0) {
        arr.splice(0, startIndex);
      }
    };

    trimArray(this.systemMetrics.memory);
    trimArray(this.systemMetrics.cpu);
    trimArray(this.systemMetrics.network);
    trimArray(this.systemMetrics.disk);
    trimArray(this.systemMetrics.timestamps);
  }

  /**
   * 停止所有压力源
   */
  async stopAllStressSources() {
    console.log('🛑 停止所有压力源');

    // 停止内存压力
    if (global.gc) global.gc();

    // 停止CPU压力 (通过改变标志位)

    // 停止网络压力 (通过改变标志位)

    // 停止IO压力 (通过改变标志位)

    await this.sleep(2000); // 等待清理完成
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    console.log('🧹 清理压力测试环境');

    await this.stopAllStressSources();
    await this.failureInjector.cleanup();
    await this.resilienceTester.cleanup();

    // 强制垃圾回收
    if (global.gc) {
      global.gc();
      global.gc();
    }

    this.testPhase = 'idle';
  }

  /**
   * 生成压力测试报告
   */
  generateStressReport() {
    const memoryStats = this.calculateMemoryStats();
    const cpuStats = this.calculateCPUStats();
    const failureStats = this.failureInjector.getStats();
    const resilienceStats = this.resilienceTester.getStats();

    return {
      summary: {
        duration: (Date.now() - this.startTime) / 1000,
        testPhase: this.testPhase,
        systemLoad: this.calculateSystemLoad(),
      },
      memory: memoryStats,
      cpu: cpuStats,
      failures: failureStats,
      resilience: resilienceStats,
      recommendations: this.generateStressRecommendations(memoryStats, cpuStats, failureStats),
    };
  }

  /**
   * 计算内存统计
   */
  calculateMemoryStats() {
    if (this.systemMetrics.memory.length === 0) return {};

    const memoryData = this.systemMetrics.memory;
    const heapUsed = memoryData.map(m => m.heapUsed);
    const usagePercent = memoryData.map(m => m.usagePercent);

    return {
      peakUsage: Math.max(...heapUsed),
      averageUsage: heapUsed.reduce((a, b) => a + b, 0) / heapUsed.length,
      minUsage: Math.min(...heapUsed),
      peakUsagePercent: Math.max(...usagePercent),
      averageUsagePercent: usagePercent.reduce((a, b) => a + b, 0) / usagePercent.length,
    };
  }

  /**
   * 计算CPU统计
   */
  calculateCPUStats() {
    if (this.systemMetrics.cpu.length === 0) return {};

    const cpuData = this.systemMetrics.cpu;
    const totalCPU = cpuData.map(c => c.total);

    return {
      peakUsage: Math.max(...totalCPU),
      averageUsage: totalCPU.reduce((a, b) => a + b, 0) / totalCPU.length,
      minUsage: Math.min(...totalCPU),
    };
  }

  /**
   * 计算系统负载
   */
  calculateSystemLoad() {
    const memoryLoad =
      this.systemMetrics.memory.length > 0
        ? this.systemMetrics.memory[this.systemMetrics.memory.length - 1].usagePercent / 100
        : 0;

    const cpuLoad =
      this.systemMetrics.cpu.length > 0
        ? this.systemMetrics.cpu[this.systemMetrics.cpu.length - 1].total / 1000000
        : 0; // 转换为秒

    return {
      memory: memoryLoad,
      cpu: cpuLoad,
      overall: (memoryLoad + cpuLoad) / 2,
    };
  }

  /**
   * 生成压力测试建议
   */
  generateStressRecommendations(memoryStats, cpuStats, failureStats) {
    const recommendations = [];

    if (memoryStats.peakUsagePercent > 85) {
      recommendations.push('内存使用率过高，建议优化内存管理或增加内存资源');
    }

    if (cpuStats.peakUsage > 90000000) {
      // 90秒
      recommendations.push('CPU使用率过高，建议优化算法或增加CPU资源');
    }

    if (failureStats.totalFailures > 10) {
      recommendations.push('系统在压力下出现较多故障，建议加强错误处理和恢复机制');
    }

    if (memoryStats.averageUsagePercent > 70) {
      recommendations.push('平均内存使用率较高，建议检查内存泄漏');
    }

    return recommendations;
  }

  /**
   * 获取强度对应的数值
   */
  getIntensityValue(intensity, values) {
    switch (intensity) {
      case 'low':
        return values.low;
      case 'medium':
        return values.medium;
      case 'high':
        return values.high;
      case 'extreme':
        return values.extreme;
      default:
        return values.medium;
    }
  }

  /**
   * 休眠工具函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
      systemLoad: this.calculateSystemLoad(),
      metricsCount: {
        memory: this.systemMetrics.memory.length,
        cpu: this.systemMetrics.cpu.length,
        network: this.systemMetrics.network.length,
        disk: this.systemMetrics.disk.length,
      },
    };
  }

  /**
   * 停止压力测试
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 压力测试已停止');
    this.emit('testStopped');
  }
}

/**
 * 故障注入器
 */
class FailureInjector {
  constructor() {
    this.failures = new Map();
  }

  async initialize() {
    console.log('🔧 初始化故障注入器');
  }

  async injectFailure(type, options = {}) {
    console.log(`💣 注入故障: ${type}`);

    switch (type) {
      case 'network_latency':
        await this.injectNetworkLatency(options);
        break;
      case 'memory_leak':
        await this.injectMemoryLeak(options);
        break;
      case 'cpu_spike':
        await this.injectCPUSpike(options);
        break;
      case 'disk_full':
        await this.injectDiskFull(options);
        break;
      default:
        console.warn(`未知故障类型: ${type}`);
    }

    this.failures.set(Date.now(), { type, options });
  }

  async injectRandomFailure() {
    const types = ['network_latency', 'memory_leak', 'cpu_spike'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    await this.injectFailure(randomType);
  }

  async injectNetworkLatency(options) {
    // 模拟网络延迟 (简化实现)
    console.log('🌐 模拟网络延迟');
    await new Promise(resolve => setTimeout(resolve, options.duration || 5000));
  }

  async injectMemoryLeak(options) {
    // 模拟内存泄漏
    console.log('🧠 模拟内存泄漏');
    const leaks = [];
    for (let i = 0; i < 1000; i++) {
      leaks.push(Buffer.alloc(1024 * 1024)); // 1MB
    }
    // 故意不清理，模拟泄漏
  }

  async injectCPUSpike(options) {
    // 模拟CPU峰值
    console.log('⚡ 模拟CPU峰值');
    const start = Date.now();
    while (Date.now() - start < (options.duration || 10000)) {
      Math.random() * Math.sin(Date.now());
    }
  }

  async injectDiskFull(options) {
    // 模拟磁盘满载 (简化实现)
    console.log('💾 模拟磁盘满载');
    // 这里可以创建大量临时文件
  }

  async cleanup() {
    // 清理所有注入的故障
    if (global.gc) global.gc();
    console.log('🧹 故障注入器清理完成');
  }

  getStats() {
    return {
      totalFailures: this.failures.size,
      failureTypes: Array.from(this.failures.values()).reduce((acc, f) => {
        acc[f.type] = (acc[f.type] || 0) + 1;
        return acc;
      }, {}),
    };
  }
}

/**
 * 恢复机制测试器
 */
class ResilienceTester {
  constructor() {
    this.recoveryTests = [];
  }

  async initialize() {
    console.log('🔧 初始化恢复机制测试器');
  }

  async testRecovery() {
    // 测试系统的恢复能力
    const recoveryTest = {
      timestamp: Date.now(),
      type: 'recovery_check',
      status: 'passed',
    };

    try {
      // 检查内存使用是否在合理范围内
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed / memUsage.heapTotal > 0.9) {
        recoveryTest.status = 'warning';
        recoveryTest.message = '内存使用率过高';
      }

      // 检查是否有未处理的错误
      // 这里可以添加更多恢复检查
    } catch (error) {
      recoveryTest.status = 'failed';
      recoveryTest.error = error.message;
    }

    this.recoveryTests.push(recoveryTest);
  }

  async cleanup() {
    console.log('🧹 恢复机制测试器清理完成');
  }

  getStats() {
    const passed = this.recoveryTests.filter(t => t.status === 'passed').length;
    const warnings = this.recoveryTests.filter(t => t.status === 'warning').length;
    const failed = this.recoveryTests.filter(t => t.status === 'failed').length;

    return {
      totalTests: this.recoveryTests.length,
      passed,
      warnings,
      failed,
      successRate:
        this.recoveryTests.length > 0 ? ((passed / this.recoveryTests.length) * 100).toFixed(2) : 0,
    };
  }
}

module.exports = { StressTestingTool, FailureInjector, ResilienceTester };
