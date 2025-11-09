/**
 * Sira AI网关 - 工业级测试框架
 * 提供全面的测试能力：单元测试、集成测试、性能测试、压力测试、可靠性测试、安全测试
 */

const EventEmitter = require("node:events");
const fs = require("node:fs").promises;
const path = require("node:path");
const { exec } = require("node:child_process");
const util = require("node:util");
const _execAsync = util.promisify(exec);

/**
 * 工业级测试框架
 * 借鉴Google Testing、Netflix Chaos Engineering、AWS Well-Architected Testing的最佳实践
 */
class IndustrialTestingFramework extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      testTimeout: options.testTimeout || 300000, // 5分钟超时
      maxConcurrency: options.maxConcurrency || 10,
      retryAttempts: options.retryAttempts || 3,
      reportDir: options.reportDir || path.join(__dirname, "../reports"),
      baselineDir: options.baselineDir || path.join(__dirname, "../baselines"),
      configDir: options.configDir || path.join(__dirname, "../config"),
      enableChaos: options.enableChaos !== false,
      enableLoadBalancing: options.enableLoadBalancing !== false,
      failFast: options.failFast !== false, // 快速失败模式
      failFastThreshold: options.failFastThreshold || 1, // 失败阈值
      continueOnError: options.continueOnError || false, // 是否在错误时继续
      ...options,
    };

    // 测试状态管理
    this.testSuites = new Map();
    this.testResults = new Map();
    this.performanceBaselines = new Map();
    this.testMetrics = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      startTime: null,
      endTime: null,
      duration: 0,
    };

    // 测试环境配置
    this.environments = {
      unit: { name: "单元测试", setup: this.setupUnitTest.bind(this) },
      integration: {
        name: "集成测试",
        setup: this.setupIntegrationTest.bind(this),
      },
      e2e: { name: "端到端测试", setup: this.setupE2ETest.bind(this) },
      performance: {
        name: "性能测试",
        setup: this.setupPerformanceTest.bind(this),
      },
      load: { name: "负载测试", setup: this.setupLoadTest.bind(this) },
      stress: { name: "压力测试", setup: this.setupStressTest.bind(this) },
      reliability: {
        name: "可靠性测试",
        setup: this.setupReliabilityTest.bind(this),
      },
      security: { name: "安全测试", setup: this.setupSecurityTest.bind(this) },
      chaos: { name: "混沌测试", setup: this.setupChaosTest.bind(this) },
    };

    // 测试工具集合
    this.testingTools = {
      loadGenerator: null,
      metricsCollector: null,
      chaosMonkey: null,
      securityScanner: null,
      performanceProfiler: null,
    };

    // 初始化
    this.initialize();
  }

  /**
   * 初始化测试框架
   */
  async initialize() {
    try {
      // 创建必要的目录
      await this.ensureDirectories();

      // 加载性能基准线
      await this.loadPerformanceBaselines();

      // 初始化测试工具
      await this.initializeTestingTools();

      // 设置事件监听器
      this.setupEventListeners();

      console.log("✅ 工业级测试框架初始化完成");
    } catch (error) {
      console.error("❌ 工业级测试框架初始化失败:", error.message);
      throw error;
    }
  }

  /**
   * 确保必要的目录存在
   */
  async ensureDirectories() {
    const dirs = [
      this.options.reportDir,
      this.options.baselineDir,
      path.join(this.options.reportDir, "unit"),
      path.join(this.options.reportDir, "integration"),
      path.join(this.options.reportDir, "e2e"),
      path.join(this.options.reportDir, "performance"),
      path.join(this.options.reportDir, "load"),
      path.join(this.options.reportDir, "stress"),
      path.join(this.options.reportDir, "reliability"),
      path.join(this.options.reportDir, "security"),
      path.join(this.options.reportDir, "chaos"),
    ];

    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * 加载性能基准线
   */
  async loadPerformanceBaselines() {
    try {
      const baselineFiles = await fs.readdir(this.options.baselineDir);
      for (const file of baselineFiles) {
        if (file.endsWith(".json")) {
          const filePath = path.join(this.options.baselineDir, file);
          const content = await fs.readFile(filePath, "utf8");
          const baseline = JSON.parse(content);
          const testName = path.basename(file, ".json");
          this.performanceBaselines.set(testName, baseline);
        }
      }
      console.log(`📊 加载了 ${this.performanceBaselines.size} 个性能基准线`);
    } catch (error) {
      console.warn("⚠️ 加载性能基准线失败:", error.message);
    }
  }

  /**
   * 初始化测试工具
   */
  async initializeTestingTools() {
    // 加载测试工具模块
    try {
      const { LoadTestingTool } = require("./load-testing");
      this.testingTools.loadGenerator = new LoadTestingTool();

      // MetricsCollector 暂时不可用，使用简单的替代方案
      try {
        const MetricsCollector = require("./metrics-collector");
        this.testingTools.metricsCollector = new MetricsCollector();
      } catch (_error) {
        console.warn("⚠️ MetricsCollector 不可用，使用简化版本");
        this.testingTools.metricsCollector = {
          collect: () => {},
          getMetrics: () => ({}),
        };
      }

      if (this.options.enableChaos) {
        const ChaosMonkey = require("./chaos-monkey");
        this.testingTools.chaosMonkey = new ChaosMonkey();
      }

      // SecurityScanner 暂时不可用，使用简单的替代方案
      try {
        const SecurityScanner = require("./security-testing");
        this.testingTools.securityScanner = new SecurityScanner();
      } catch (_error) {
        console.warn("⚠️ SecurityScanner 不可用，使用简化版本");
        this.testingTools.securityScanner = {
          initialize: async () => {},
          scan: async () => ({ vulnerabilities: [] }),
          getReport: () => ({}),
        };
      }

      // PerformanceProfiler 暂时不可用，使用简单的替代方案
      try {
        const PerformanceProfiler = require("./performance-profiler");
        this.testingTools.performanceProfiler = new PerformanceProfiler();
      } catch (_error) {
        console.warn("⚠️ PerformanceProfiler 不可用，使用简化版本");
        this.testingTools.performanceProfiler = {
          profile: async () => ({}),
          getProfile: () => ({}),
        };
      }

      console.log("🔧 测试工具初始化完成");
    } catch (error) {
      console.warn("⚠️ 某些测试工具初始化失败:", error.message);
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 测试开始事件
    this.on("testStart", (testInfo) => {
      console.log(`🧪 开始测试: ${testInfo.name} (${testInfo.type})`);
      this.testMetrics.totalTests++;
    });

    // 测试完成事件
    this.on("testComplete", (result) => {
      if (result.passed) {
        this.testMetrics.passedTests++;
        console.log(`✅ 测试通过: ${result.name}`);
      } else {
        this.testMetrics.failedTests++;
        console.log(`❌ 测试失败: ${result.name} - ${result.error}`);
      }
    });

    // 性能回归事件
    this.on("performanceRegression", (regression) => {
      console.warn(
        `⚠️ 性能回归检测: ${regression.test} - ${regression.metric}: ${regression.baseline} -> ${regression.current} (${regression.change}%)`,
      );
    });
  }

  /**
   * 注册测试套件
   */
  registerTestSuite(name, config) {
    this.testSuites.set(name, {
      name,
      ...config,
      tests: [],
      results: [],
    });
  }

  /**
   * 添加测试用例
   */
  addTest(suiteName, testConfig) {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`测试套件不存在: ${suiteName}`);
    }

    const test = {
      id: `${suiteName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: testConfig.name,
      type: testConfig.type || "unit",
      description: testConfig.description || "",
      setup: testConfig.setup || (() => {}),
      execute: testConfig.execute,
      teardown: testConfig.teardown || (() => {}),
      timeout: testConfig.timeout || this.options.testTimeout,
      retries: testConfig.retries || this.options.retryAttempts,
      tags: testConfig.tags || [],
      dependencies: testConfig.dependencies || [],
      ...testConfig,
    };

    suite.tests.push(test);
  }

  /**
   * 运行测试
   */
  async runTests(options = {}) {
    const {
      suites = Array.from(this.testSuites.keys()),
      types = Object.keys(this.environments),
      tags = [],
      parallel = true,
      maxConcurrency = this.options.maxConcurrency,
      failFast = this.options.failFast,
      failFastThreshold = this.options.failFastThreshold,
    } = options;

    this.testMetrics.startTime = Date.now();
    this.emit("testingStart", { suites, types, tags });

    const results = [];
    let consecutiveFailures = 0;
    let shouldStop = false;

    // 快速失败检查函数
    const checkFailFast = (result) => {
      if (!failFast) return false;

      if (!result.success && !result.passed) {
        consecutiveFailures++;
        if (consecutiveFailures >= failFastThreshold) {
          console.log(
            `\n🚫 快速失败: 已连续失败 ${consecutiveFailures} 次测试，达到阈值 ${failFastThreshold}`,
          );
          this.emit("failFastTriggered", {
            consecutiveFailures,
            threshold: failFastThreshold,
            lastFailedTest: result.name,
          });
          return true;
        }
      } else {
        consecutiveFailures = 0; // 重置连续失败计数
      }
      return false;
    };

    for (const suiteName of suites) {
      if (shouldStop) {
        console.log(`\n⚠️ 跳过测试套件: ${suiteName} (由于快速失败)`);
        continue;
      }

      const suite = this.testSuites.get(suiteName);
      if (!suite) continue;

      console.log(`\n📋 运行测试套件: ${suiteName}`);

      // 设置测试环境
      await this.setupTestEnvironment(suite);

      // 过滤测试用例
      const filteredTests = suite.tests.filter((test) => {
        if (types.length > 0 && !types.includes(test.type)) return false;
        if (tags.length > 0 && !tags.some((tag) => test.tags.includes(tag)))
          return false;
        return true;
      });

      // 运行测试用例
      if (parallel && filteredTests.length > 1) {
        const parallelResults = await this.runTestsParallel(
          filteredTests,
          maxConcurrency,
          checkFailFast,
        );
        results.push(...parallelResults);

        // 检查并行结果中的失败
        for (const result of parallelResults) {
          if (checkFailFast(result)) {
            shouldStop = true;
            break;
          }
        }
      } else {
        for (const test of filteredTests) {
          if (shouldStop) {
            console.log(`⚠️ 跳过测试: ${test.name} (由于快速失败)`);
            continue;
          }

          const result = await this.runTest(test);
          results.push(result);

          if (checkFailFast(result)) {
            shouldStop = true;
            break;
          }
        }
      }

      // 清理测试环境
      await this.teardownTestEnvironment(suite);
    }

    this.testMetrics.endTime = Date.now();
    this.testMetrics.duration = this.testMetrics.endTime - this.startTime;

    // 如果启用了快速失败，记录停止原因
    if (shouldStop) {
      this.testMetrics.stopReason = "fail_fast";
      this.testMetrics.consecutiveFailures = consecutiveFailures;
      console.log("\n🛑 测试执行因快速失败而提前终止");
    }

    this.emit("testingComplete", results);

    return results;
  }

  /**
   * 并行运行测试
   */
  async runTestsParallel(tests, maxConcurrency, checkFailFast = null) {
    const results = [];
    const running = new Set();
    const queue = [...tests];
    let shouldStopParallel = false;

    const runNext = async () => {
      if (queue.length === 0 || shouldStopParallel) return;

      const test = queue.shift();
      running.add(test.id);

      try {
        const result = await this.runTest(test);
        results.push(result);

        // 检查快速失败条件
        if (checkFailFast?.(result)) {
          shouldStopParallel = true;
          console.log("🛑 并行测试因快速失败而停止");
        }
      } finally {
        running.delete(test.id);
        if (!shouldStopParallel) {
          await runNext();
        }
      }
    };

    // 启动初始批次
    const initialPromises = [];
    for (let i = 0; i < Math.min(maxConcurrency, tests.length); i++) {
      initialPromises.push(runNext());
    }

    await Promise.all(initialPromises);

    return results;
  }

  /**
   * 运行单个测试
   */
  async runTest(test, attempt = 1) {
    const startTime = Date.now();
    const result = {
      id: test.id,
      name: test.name,
      type: test.type,
      status: "running",
      startTime,
      endTime: null,
      duration: null,
      passed: false,
      error: null,
      logs: [],
      metrics: {},
    };

    this.emit("testStart", test);

    try {
      // 设置测试环境
      await test.setup();

      // 执行测试
      const testResult = await Promise.race([
        test.execute(),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("测试超时")), test.timeout),
        ),
      ]);

      result.passed = true;
      result.status = "passed";
      result.result = testResult;
    } catch (error) {
      result.passed = false;
      result.status = "failed";
      result.error = error.message;

      // 重试逻辑
      if (attempt < test.retries) {
        console.log(
          `🔄 重试测试: ${test.name} (尝试 ${attempt + 1}/${test.retries})`,
        );
        return this.runTest(test, attempt + 1);
      }
    } finally {
      try {
        // 清理测试环境
        await test.teardown();
      } catch (teardownError) {
        console.warn(`⚠️ 测试清理失败: ${teardownError.message}`);
      }

      result.endTime = Date.now();
      result.duration = result.endTime - startTime;
    }

    this.emit("testComplete", result);

    // 存储结果
    this.testResults.set(test.id, result);

    return result;
  }

  /**
   * 设置测试环境
   */
  async setupTestEnvironment(suite) {
    if (suite.environment && this.environments[suite.environment]) {
      const env = this.environments[suite.environment];
      console.log(`🔧 设置测试环境: ${env.name}`);
      await env.setup();
    }
  }

  /**
   * 清理测试环境
   */
  async teardownTestEnvironment(suite) {
    // 这里可以添加环境清理逻辑
    console.log(`🧹 清理测试环境: ${suite.name}`);
  }

  // ==================== 测试环境设置 ====================

  async setupUnitTest() {
    // 单元测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "unit";
  }

  async setupIntegrationTest() {
    // 集成测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "integration";
    // 启动依赖服务
  }

  async setupE2ETest() {
    // 端到端测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "e2e";
    // 启动完整应用栈
  }

  async setupPerformanceTest() {
    // 性能测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "performance";
    // 禁用不必要的日志
  }

  async setupLoadTest() {
    // 负载测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "load";
    // 启用负载生成器
    if (this.testingTools.loadGenerator) {
      await this.testingTools.loadGenerator.initialize();
    }
  }

  async setupStressTest() {
    // 压力测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "stress";
    // 设置资源限制
  }

  async setupReliabilityTest() {
    // 可靠性测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "reliability";
    // 设置长期运行配置
  }

  async setupSecurityTest() {
    // 安全测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "security";
    // 启用安全扫描
    if (this.testingTools.securityScanner) {
      await this.testingTools.securityScanner.initialize();
    }
  }

  async setupChaosTest() {
    // 混沌测试环境设置
    process.env.NODE_ENV = "test";
    process.env.TEST_TYPE = "chaos";
    // 启用混沌猴子
    if (this.testingTools.chaosMonkey) {
      await this.testingTools.chaosMonkey.initialize();
    }
  }

  // ==================== 报告生成 ====================

  /**
   * 生成测试报告
   */
  async generateReport(options = {}) {
    const {
      format = "html",
      outputDir = this.options.reportDir,
      includeCharts = true,
      includeMetrics = true,
    } = options;

    const report = {
      metadata: {
        generatedAt: new Date().toISOString(),
        framework: "Sira Industrial Testing Framework",
        version: "1.0.0",
        duration: this.testMetrics.duration,
        totalTests: this.testMetrics.totalTests,
        passedTests: this.testMetrics.passedTests,
        failedTests: this.testMetrics.failedTests,
        skippedTests: this.testMetrics.skippedTests,
      },
      results: Array.from(this.testResults.values()),
      metrics: this.testMetrics,
      performance: Object.fromEntries(this.performanceBaselines),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    // 生成不同格式的报告
    switch (format) {
      case "html":
        await this.generateHTMLReport(report, outputDir);
        break;
      case "json":
        await this.generateJSONReport(report, outputDir);
        break;
      case "xml":
        await this.generateXMLReport(report, outputDir);
        break;
      default:
        await this.generateHTMLReport(report, outputDir);
    }

    return report;
  }

  /**
   * 生成HTML报告
   */
  async generateHTMLReport(report, outputDir) {
    const htmlContent = this.buildHTMLReport(report);
    const reportPath = path.join(outputDir, "test-report.html");
    await fs.writeFile(reportPath, htmlContent, "utf8");
    console.log(`📊 HTML测试报告已生成: ${reportPath}`);
  }

  /**
   * 生成JSON报告
   */
  async generateJSONReport(report, outputDir) {
    const reportPath = path.join(outputDir, "test-report.json");
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`📊 JSON测试报告已生成: ${reportPath}`);
  }

  /**
   * 生成XML报告
   */
  async generateXMLReport(report, outputDir) {
    const xmlContent = this.buildXMLReport(report);
    const reportPath = path.join(outputDir, "test-report.xml");
    await fs.writeFile(reportPath, xmlContent, "utf8");
    console.log(`📊 XML测试报告已生成: ${reportPath}`);
  }

  /**
   * 构建HTML报告内容
   */
  buildHTMLReport(report) {
    const passedPercent =
      report.metadata.totalTests > 0
        ? (
            (report.metadata.passedTests / report.metadata.totalTests) *
            100
          ).toFixed(2)
        : 0;

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sira AI网关 - 工业级测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #007acc; }
        .metric .value { font-size: 2em; font-weight: bold; color: #333; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .tests { margin-top: 30px; }
        .test-item { border: 1px solid #ddd; margin-bottom: 10px; padding: 15px; border-radius: 6px; }
        .test-passed { border-left: 4px solid #28a745; }
        .test-failed { border-left: 4px solid #dc3545; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .test-name { font-weight: bold; }
        .test-duration { color: #666; }
        .test-error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Sira AI网关 - 工业级测试报告</h1>
            <p>生成时间: ${report.metadata.generatedAt}</p>
            <p>测试持续时间: ${Math.round(report.metadata.duration / 1000)}秒</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>总测试数</h3>
                <div class="value">${report.metadata.totalTests}</div>
            </div>
            <div class="metric">
                <h3>通过测试</h3>
                <div class="value passed">${report.metadata.passedTests}</div>
            </div>
            <div class="metric">
                <h3>失败测试</h3>
                <div class="value failed">${report.metadata.failedTests}</div>
            </div>
            <div class="metric">
                <h3>通过率</h3>
                <div class="value ${passedPercent >= 95 ? "passed" : "failed"}">${passedPercent}%</div>
            </div>
        </div>

        <div class="tests">
            <h2>📋 测试详情</h2>
            ${report.results
              .map(
                (test) => `
                <div class="test-item ${test.passed ? "test-passed" : "test-failed"}">
                    <div class="test-header">
                        <span class="test-name">${test.name}</span>
                        <span class="test-duration">${test.duration}ms</span>
                    </div>
                    <div>类型: ${test.type} | 状态: ${test.passed ? "✅ 通过" : "❌ 失败"}</div>
                    ${test.error ? `<div class="test-error">错误: ${test.error}</div>` : ""}
                </div>
            `,
              )
              .join("")}
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * 构建XML报告内容
   */
  buildXMLReport(report) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<test-report>
    <metadata>
        <generated-at>${report.metadata.generatedAt}</generated-at>
        <framework>${report.metadata.framework}</framework>
        <version>${report.metadata.version}</version>
        <duration>${report.metadata.duration}</duration>
        <total-tests>${report.metadata.totalTests}</total-tests>
        <passed-tests>${report.metadata.passedTests}</passed-tests>
        <failed-tests>${report.metadata.failedTests}</failed-tests>
        <skipped-tests>${report.metadata.skippedTests}</skipped-tests>
    </metadata>
    <results>
        ${report.results
          .map(
            (test) => `
        <test id="${test.id}" name="${test.name}" type="${test.type}" status="${test.status}" passed="${test.passed}">
            <duration>${test.duration}</duration>
            ${test.error ? `<error>${test.error}</error>` : ""}
        </test>`,
          )
          .join("")}
    </results>
</test-report>`;
  }

  // ==================== 性能基准管理 ====================

  /**
   * 设置性能基准线
   */
  async setPerformanceBaseline(testName, metrics) {
    this.performanceBaselines.set(testName, {
      ...metrics,
      createdAt: new Date().toISOString(),
      version: "1.0.0",
    });

    const baselinePath = path.join(
      this.options.baselineDir,
      `${testName}.json`,
    );
    await fs.writeFile(
      baselinePath,
      JSON.stringify(this.performanceBaselines.get(testName), null, 2),
    );
    console.log(`📊 性能基准线已设置: ${testName}`);
  }

  /**
   * 比较性能基准线
   */
  comparePerformanceBaseline(testName, currentMetrics) {
    const baseline = this.performanceBaselines.get(testName);
    if (!baseline) return null;

    const regressions = {};
    const improvements = {};

    for (const [metric, currentValue] of Object.entries(currentMetrics)) {
      const baselineValue = baseline[metric];
      if (
        baselineValue &&
        typeof baselineValue === "number" &&
        typeof currentValue === "number"
      ) {
        const change = ((currentValue - baselineValue) / baselineValue) * 100;

        if (Math.abs(change) > 5) {
          // 5%阈值
          if (change > 0) {
            regressions[metric] = {
              baseline: baselineValue,
              current: currentValue,
              change: change.toFixed(2),
            };
          } else {
            improvements[metric] = {
              baseline: baselineValue,
              current: currentValue,
              change: Math.abs(change).toFixed(2),
            };
          }
        }
      }
    }

    return { regressions, improvements };
  }

  /**
   * 获取测试统计信息
   */
  getTestStatistics() {
    return {
      ...this.testMetrics,
      passRate:
        this.testMetrics.totalTests > 0
          ? (
              (this.testMetrics.passedTests / this.testMetrics.totalTests) *
              100
            ).toFixed(2)
          : 0,
      failRate:
        this.testMetrics.totalTests > 0
          ? (
              (this.testMetrics.failedTests / this.testMetrics.totalTests) *
              100
            ).toFixed(2)
          : 0,
      averageDuration:
        this.testMetrics.totalTests > 0
          ? (this.testMetrics.duration / this.testMetrics.totalTests).toFixed(2)
          : 0,
    };
  }
}

module.exports = { IndustrialTestingFramework };
