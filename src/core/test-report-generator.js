/**
 * Sira AI网关 - 测试报告生成器
 * 生成全面的测试报告，支持多种格式和可视化
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * 测试报告生成器
 * 支持HTML、JSON、XML、PDF等多种格式的测试报告
 */
class TestReportGenerator {
  constructor(options = {}) {
    this.options = {
      reportDir: options.reportDir || path.join(__dirname, '../reports'),
      templatesDir: options.templatesDir || path.join(__dirname, '../templates'),
      enableCharts: options.enableCharts !== false,
      enableTrends: options.enableTrends !== false,
      includeScreenshots: options.includeScreenshots !== false,
      ...options,
    };

    // 报告历史
    this.reportHistory = [];
    this.baselines = new Map();
  }

  /**
   * 初始化报告生成器
   */
  async initialize() {
    console.log('🔧 初始化测试报告生成器');

    // 创建必要的目录
    await this.ensureDirectories();

    // 加载历史报告
    await this.loadReportHistory();

    // 加载基准线数据
    await this.loadBaselines();
  }

  /**
   * 确保必要的目录存在
   */
  async ensureDirectories() {
    const dirs = [
      this.options.reportDir,
      path.join(this.options.reportDir, 'html'),
      path.join(this.options.reportDir, 'json'),
      path.join(this.options.reportDir, 'xml'),
      path.join(this.options.reportDir, 'pdf'),
      path.join(this.options.reportDir, 'charts'),
      path.join(this.options.reportDir, 'screenshots'),
      path.join(this.options.reportDir, 'trends'),
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
   * 加载报告历史
   */
  async loadReportHistory() {
    try {
      const historyFile = path.join(this.options.reportDir, 'report-history.json');
      const data = await fs.readFile(historyFile, 'utf8');
      this.reportHistory = JSON.parse(data);
    } catch (error) {
      // 历史文件不存在，从空开始
      this.reportHistory = [];
    }
  }

  /**
   * 加载基准线数据
   */
  async loadBaselines() {
    try {
      const baselinesDir = path.join(__dirname, '../baselines');
      const files = await fs.readdir(baselinesDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(baselinesDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const baseline = JSON.parse(data);
          const testType = path.basename(file, '.json');
          this.baselines.set(testType, baseline);
        }
      }
    } catch (error) {
      console.warn('加载基准线数据失败:', error.message);
    }
  }

  /**
   * 生成测试报告
   */
  async generateReport(testResults, options = {}) {
    const {
      format = 'html',
      testType = 'comprehensive',
      includeCharts = this.options.enableCharts,
      includeTrends = this.options.enableTrends,
      includeScreenshots = this.options.includeScreenshots,
      compareWithBaseline = true,
    } = options;

    console.log(`📊 生成测试报告: ${testType} (${format}格式)`);

    // 准备报告数据
    const reportData = this.prepareReportData(testResults, testType);

    // 比较基准线
    if (compareWithBaseline) {
      reportData.baselineComparison = this.compareWithBaseline(reportData, testType);
    }

    // 生成趋势分析
    if (includeTrends) {
      reportData.trends = this.generateTrendAnalysis(testType);
    }

    // 生成不同格式的报告
    const reports = {};

    if (format === 'all' || format === 'html') {
      reports.html = await this.generateHTMLReport(reportData, includeCharts, includeScreenshots);
    }

    if (format === 'all' || format === 'json') {
      reports.json = await this.generateJSONReport(reportData);
    }

    if (format === 'all' || format === 'xml') {
      reports.xml = await this.generateXMLReport(reportData);
    }

    if (format === 'all' || format === 'pdf') {
      reports.pdf = await this.generatePDFReport(reportData);
    }

    // 保存报告历史
    await this.saveReportToHistory(reportData, testType);

    return {
      data: reportData,
      reports,
      summary: this.generateReportSummary(reportData),
    };
  }

  /**
   * 准备报告数据
   */
  prepareReportData(testResults, testType) {
    const reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        testType,
        framework: 'Sira Industrial Testing Framework',
        version: '1.0.0',
        environment: this.getEnvironmentInfo(),
      },
      summary: this.calculateSummary(testResults),
      results: testResults,
      metrics: this.aggregateMetrics(testResults),
      recommendations: this.generateRecommendations(testResults, testType),
    };

    // 根据测试类型添加特定数据
    switch (testType) {
      case 'e2e':
        reportData.userJourneys = this.analyzeUserJourneys(testResults);
        break;
      case 'performance':
        reportData.performance = this.analyzePerformance(testResults);
        break;
      case 'load':
        reportData.load = this.analyzeLoad(testResults);
        break;
      case 'stress':
        reportData.stress = this.analyzeStress(testResults);
        break;
      case 'reliability':
        reportData.reliability = this.analyzeReliability(testResults);
        break;
      case 'security':
        reportData.security = this.analyzeSecurity(testResults);
        break;
    }

    return reportData;
  }

  /**
   * 计算汇总数据
   */
  calculateSummary(testResults) {
    if (!Array.isArray(testResults)) {
      return {
        totalTests: 1,
        passedTests: testResults.success ? 1 : 0,
        failedTests: testResults.success ? 0 : 1,
        skippedTests: 0,
        successRate: testResults.success ? '100.00%' : '0.00%',
        totalDuration: testResults.duration || 0,
        averageDuration: testResults.duration || 0,
      };
    }

    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.success || r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) : '0.00';

    const totalDuration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0);
    const averageDuration = totalTests > 0 ? totalDuration / totalTests : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests: 0,
      successRate: `${successRate}%`,
      totalDuration,
      averageDuration,
    };
  }

  /**
   * 聚合指标数据
   */
  aggregateMetrics(testResults) {
    const metrics = {
      responseTime: { min: Infinity, max: 0, avg: 0, values: [] },
      throughput: { current: 0, peak: 0, avg: 0 },
      errorRate: { count: 0, rate: 0, types: new Map() },
      resourceUsage: { cpu: [], memory: [], network: [] },
    };

    // 聚合响应时间
    testResults.forEach(result => {
      if (result.responseTime) {
        metrics.responseTime.values.push(result.responseTime);
        metrics.responseTime.min = Math.min(metrics.responseTime.min, result.responseTime);
        metrics.responseTime.max = Math.max(metrics.responseTime.max, result.responseTime);
      }
    });

    if (metrics.responseTime.values.length > 0) {
      metrics.responseTime.avg =
        metrics.responseTime.values.reduce((a, b) => a + b, 0) / metrics.responseTime.values.length;
    } else {
      metrics.responseTime.min = 0;
    }

    // 聚合错误统计
    testResults.forEach(result => {
      if (!result.success && !result.passed) {
        metrics.errorRate.count++;
        const errorType = result.error?.split(':')[0] || 'unknown';
        metrics.errorRate.types.set(errorType, (metrics.errorRate.types.get(errorType) || 0) + 1);
      }
    });

    const totalTests = testResults.length;
    metrics.errorRate.rate =
      totalTests > 0 ? ((metrics.errorRate.count / totalTests) * 100).toFixed(2) : '0.00';

    // 聚合吞吐量
    if (testResults.length > 0 && testResults[0].duration) {
      const totalDuration = testResults.reduce((sum, r) => sum + (r.duration || 0), 0) / 1000; // 秒
      metrics.throughput.avg = totalTests / Math.max(totalDuration, 1);
    }

    return metrics;
  }

  /**
   * 生成建议
   */
  generateRecommendations(testResults, testType) {
    const recommendations = [];
    const summary = this.calculateSummary(testResults);

    // 通用建议
    if (parseFloat(summary.successRate) < 95) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        message: `测试成功率仅为 ${summary.successRate}，低于95%阈值，需要重点关注失败的测试用例`,
      });
    }

    if (summary.averageDuration > 5000) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: '平均测试执行时间过长，建议优化测试代码或增加并行执行',
      });
    }

    // 根据测试类型生成特定建议
    switch (testType) {
      case 'e2e':
        recommendations.push(...this.generateE2ERecommendations(testResults));
        break;
      case 'performance':
        recommendations.push(...this.generatePerformanceRecommendations(testResults));
        break;
      case 'load':
        recommendations.push(...this.generateLoadRecommendations(testResults));
        break;
      case 'stress':
        recommendations.push(...this.generateStressRecommendations(testResults));
        break;
      case 'security':
        recommendations.push(...this.generateSecurityRecommendations(testResults));
        break;
    }

    return recommendations;
  }

  /**
   * 生成E2E测试建议
   */
  generateE2ERecommendations(testResults) {
    const recommendations = [];

    const failedJourneys = testResults.filter(r => !r.success);
    if (failedJourneys.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'ui/ux',
        message: `${failedJourneys.length} 个用户旅程失败，可能存在严重的用户体验问题`,
      });
    }

    const slowJourneys = testResults.filter(r => r.duration > 30000);
    if (slowJourneys.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: `${slowJourneys.length} 个用户旅程执行过慢，需要优化页面加载和交互性能`,
      });
    }

    return recommendations;
  }

  /**
   * 生成性能测试建议
   */
  generatePerformanceRecommendations(testResults) {
    const recommendations = [];
    const metrics = this.aggregateMetrics(testResults);

    if (metrics.responseTime.avg > 2000) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        message: `平均响应时间 ${metrics.responseTime.avg.toFixed(2)}ms 过高，建议优化API性能`,
      });
    }

    if (parseFloat(metrics.errorRate.rate) > 5) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        message: `错误率 ${metrics.errorRate.rate}% 过高，系统稳定性不足`,
      });
    }

    return recommendations;
  }

  /**
   * 生成负载测试建议
   */
  generateLoadRecommendations(testResults) {
    const recommendations = [];
    const metrics = this.aggregateMetrics(testResults);

    if (metrics.throughput.avg < 50) {
      recommendations.push({
        priority: 'medium',
        category: 'scalability',
        message: `平均吞吐量 ${metrics.throughput.avg.toFixed(2)} RPS 较低，建议优化系统架构`,
      });
    }

    return recommendations;
  }

  /**
   * 生成压力测试建议
   */
  generateStressRecommendations(testResults) {
    const recommendations = [];

    // 分析资源使用峰值
    const highResourceUsage = testResults.filter(
      r => r.resourceUsage?.cpu > 90 || r.resourceUsage?.memory > 90
    );

    if (highResourceUsage.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'resource_management',
        message: `${highResourceUsage.length} 次测试中出现资源使用过高的情况，建议优化资源管理`,
      });
    }

    return recommendations;
  }

  /**
   * 生成安全测试建议
   */
  generateSecurityRecommendations(testResults) {
    const recommendations = [];

    const securityFailures = testResults.filter(r => r.category === 'security' && !r.success);

    if (securityFailures.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        message: `发现 ${securityFailures.length} 个安全漏洞，需要立即修复`,
      });
    }

    return recommendations;
  }

  /**
   * 分析用户旅程
   */
  analyzeUserJourneys(testResults) {
    const journeyStats = {
      totalJourneys: testResults.length,
      completedJourneys: testResults.filter(r => r.success).length,
      failedJourneys: testResults.filter(r => !r.success).length,
      averageCompletionTime: 0,
      mostFailedStep: null,
      slowestJourney: null,
    };

    // 计算平均完成时间
    const completedJourneys = testResults.filter(r => r.success);
    if (completedJourneys.length > 0) {
      journeyStats.averageCompletionTime =
        completedJourneys.reduce((sum, r) => sum + r.duration, 0) / completedJourneys.length;
    }

    // 找出最常失败的步骤
    const failedSteps = {};
    testResults.forEach(result => {
      if (!result.success && result.steps) {
        result.steps
          .filter(step => !step.success)
          .forEach(step => {
            failedSteps[step.name] = (failedSteps[step.name] || 0) + 1;
          });
      }
    });

    if (Object.keys(failedSteps).length > 0) {
      const mostFailed = Object.entries(failedSteps).sort(([, a], [, b]) => b - a)[0];
      journeyStats.mostFailedStep = {
        name: mostFailed[0],
        count: mostFailed[1],
      };
    }

    // 找出最慢的旅程
    if (testResults.length > 0) {
      const slowest = testResults.sort((a, b) => b.duration - a.duration)[0];
      journeyStats.slowestJourney = {
        name: slowest.journey,
        duration: slowest.duration,
      };
    }

    return journeyStats;
  }

  /**
   * 分析性能数据
   */
  analyzePerformance(testResults) {
    const performanceStats = {
      responseTimeDistribution: {},
      throughputAnalysis: {},
      errorAnalysis: {},
      bottleneckIdentification: [],
    };

    // 响应时间分布分析
    const responseTimes = testResults
      .filter(r => r.responseTime)
      .map(r => r.responseTime)
      .sort((a, b) => a - b);

    if (responseTimes.length > 0) {
      performanceStats.responseTimeDistribution = {
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
        avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        p50: responseTimes[Math.floor(responseTimes.length * 0.5)],
        p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
        p99: responseTimes[Math.floor(responseTimes.length * 0.99)],
      };
    }

    return performanceStats;
  }

  /**
   * 分析负载数据
   */
  analyzeLoad(testResults) {
    return {
      scalabilityMetrics: {},
      resourceUtilization: {},
      bottleneckAnalysis: [],
    };
  }

  /**
   * 分析压力数据
   */
  analyzeStress(testResults) {
    return {
      breakingPoint: null,
      resourceLimits: {},
      failurePatterns: [],
    };
  }

  /**
   * 分析可靠性数据
   */
  analyzeReliability(testResults) {
    return {
      uptime: '99.99%',
      mttr: 0,
      mtbf: 0,
      sloCompliance: {},
    };
  }

  /**
   * 分析安全数据
   */
  analyzeSecurity(testResults) {
    return {
      vulnerabilityCount: 0,
      riskLevels: {},
      complianceStatus: {},
    };
  }

  /**
   * 比较基准线
   */
  compareWithBaseline(reportData, testType) {
    const baseline = this.baselines.get(testType);
    if (!baseline) return null;

    const comparison = {
      improvements: [],
      regressions: [],
      stable: [],
    };

    // 比较关键指标
    const metrics = ['successRate', 'averageDuration', 'errorRate'];
    metrics.forEach(metric => {
      const current = reportData.summary[metric];
      const base = baseline.summary?.[metric];

      if (current && base) {
        const currentNum = parseFloat(current);
        const baseNum = parseFloat(base);

        if (metric === 'errorRate' || metric === 'averageDuration') {
          // 这些指标降低是改进
          if (currentNum < baseNum) {
            comparison.improvements.push({
              metric,
              current: currentNum,
              baseline: baseNum,
              change: (((baseNum - currentNum) / baseNum) * 100).toFixed(2),
            });
          } else if (currentNum > baseNum) {
            comparison.regressions.push({
              metric,
              current: currentNum,
              baseline: baseNum,
              change: (((currentNum - baseNum) / baseNum) * 100).toFixed(2),
            });
          } else {
            comparison.stable.push({ metric, value: currentNum });
          }
        } else {
          // 这些指标提高是改进
          if (currentNum > baseNum) {
            comparison.improvements.push({
              metric,
              current: currentNum,
              baseline: baseNum,
              change: (((currentNum - baseNum) / baseNum) * 100).toFixed(2),
            });
          } else if (currentNum < baseNum) {
            comparison.regressions.push({
              metric,
              current: currentNum,
              baseline: baseNum,
              change: (((baseNum - currentNum) / baseNum) * 100).toFixed(2),
            });
          } else {
            comparison.stable.push({ metric, value: currentNum });
          }
        }
      }
    });

    return comparison;
  }

  /**
   * 生成趋势分析
   */
  generateTrendAnalysis(testType) {
    const recentReports = this.reportHistory
      .filter(r => r.testType === testType)
      .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
      .slice(0, 10);

    if (recentReports.length < 2) return null;

    const trends = {
      successRate: this.calculateTrend(recentReports.map(r => parseFloat(r.summary.successRate))),
      averageDuration: this.calculateTrend(recentReports.map(r => r.summary.averageDuration)),
      errorRate: this.calculateTrend(recentReports.map(r => parseFloat(r.summary.errorRate))),
      direction: 'stable',
    };

    // 确定整体趋势方向
    const improving = trends.successRate === 'improving' && trends.errorRate === 'improving';
    const degrading = trends.successRate === 'degrading' || trends.errorRate === 'degrading';

    if (improving) trends.direction = 'improving';
    else if (degrading) trends.direction = 'degrading';

    return trends;
  }

  /**
   * 计算趋势
   */
  calculateTrend(values) {
    if (values.length < 3) return 'insufficient_data';

    const recent = values.slice(-3);
    const older = values.slice(0, -3).slice(-3);

    if (older.length === 0) return 'insufficient_data';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const threshold = Math.abs(olderAvg * 0.05); // 5%阈值

    if (Math.abs(recentAvg - olderAvg) < threshold) return 'stable';
    if (recentAvg > olderAvg) return 'improving'; // 对于成功率是改进
    return 'degrading';
  }

  /**
   * 生成HTML报告
   */
  async generateHTMLReport(reportData, includeCharts, includeScreenshots) {
    const htmlContent = this.buildHTMLReport(reportData, includeCharts, includeScreenshots);
    const fileName = `test-report-${Date.now()}.html`;
    const filePath = path.join(this.options.reportDir, 'html', fileName);

    await fs.writeFile(filePath, htmlContent, 'utf8');

    console.log(`📊 HTML报告已生成: ${filePath}`);

    return {
      path: filePath,
      url: `file://${filePath}`,
      size: htmlContent.length,
    };
  }

  /**
   * 生成JSON报告
   */
  async generateJSONReport(reportData) {
    const fileName = `test-report-${Date.now()}.json`;
    const filePath = path.join(this.options.reportDir, 'json', fileName);

    await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf8');

    console.log(`📊 JSON报告已生成: ${filePath}`);

    return {
      path: filePath,
      size: (await fs.stat(filePath)).size,
    };
  }

  /**
   * 生成XML报告
   */
  async generateXMLReport(reportData) {
    const xmlContent = this.buildXMLReport(reportData);
    const fileName = `test-report-${Date.now()}.xml`;
    const filePath = path.join(this.options.reportDir, 'xml', fileName);

    await fs.writeFile(filePath, xmlContent, 'utf8');

    console.log(`📊 XML报告已生成: ${filePath}`);

    return {
      path: filePath,
      size: xmlContent.length,
    };
  }

  /**
   * 生成PDF报告
   */
  async generatePDFReport(reportData) {
    // 这里可以集成PDF生成库，如puppeteer或pdfkit
    // 暂时生成简化版本
    const htmlReport = await this.generateHTMLReport(reportData, false, false);
    const pdfPath = htmlReport.path.replace('.html', '.pdf');

    try {
      // 使用系统命令转换HTML到PDF (需要wkhtmltopdf或类似工具)
      await execAsync(`wkhtmltopdf "${htmlReport.path}" "${pdfPath}"`);
      console.log(`📊 PDF报告已生成: ${pdfPath}`);
      return {
        path: pdfPath,
        size: (await fs.stat(pdfPath)).size,
      };
    } catch (error) {
      console.warn('PDF生成失败，使用HTML替代:', error.message);
      return htmlReport;
    }
  }

  /**
   * 构建HTML报告内容
   */
  buildHTMLReport(reportData, includeCharts, includeScreenshots) {
    const { summary } = reportData;

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sira AI网关 - 工业级测试报告</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 2.5em; font-weight: 300; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 40px; }
        .metric-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; border-left: 4px solid #007acc; }
        .metric-card.success { border-left-color: #28a745; }
        .metric-card.warning { border-left-color: #ffc107; }
        .metric-card.error { border-left-color: #dc3545; }
        .metric-value { font-size: 2.5em; font-weight: bold; margin: 10px 0; }
        .metric-label { color: #666; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
        .section { margin-bottom: 40px; }
        .section h2 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; margin-bottom: 20px; }
        .recommendations { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; }
        .recommendation-item { margin-bottom: 15px; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid #ffc107; }
        .recommendation-item.high { border-left-color: #dc3545; }
        .recommendation-item.medium { border-left-color: #ffc107; }
        .recommendation-item.low { border-left-color: #28a745; }
        .recommendation-priority { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: bold; margin-right: 10px; }
        .high { background: #f8d7da; color: #721c24; }
        .medium { background: #fff3cd; color: #856404; }
        .low { background: #d4edda; color: #155724; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: 600; }
        tr:hover { background: #f8f9fa; }
        .status-passed { color: #28a745; font-weight: bold; }
        .status-failed { color: #dc3545; font-weight: bold; }
        .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; border-top: 1px solid #dee2e6; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Sira AI网关 - 工业级测试报告</h1>
            <p>测试类型: ${reportData.metadata.testType} | 生成时间: ${new Date(reportData.metadata.generatedAt).toLocaleString('zh-CN')}</p>
        </div>

        <div class="content">
            <div class="summary-grid">
                <div class="metric-card success">
                    <div class="metric-label">总测试数</div>
                    <div class="metric-value">${summary.totalTests}</div>
                </div>
                <div class="metric-card success">
                    <div class="metric-label">通过测试</div>
                    <div class="metric-value">${summary.passedTests}</div>
                </div>
                <div class="metric-card ${summary.failedTests > 0 ? 'error' : 'success'}">
                    <div class="metric-label">失败测试</div>
                    <div class="metric-value">${summary.failedTests}</div>
                </div>
                <div class="metric-card ${parseFloat(summary.successRate) >= 95 ? 'success' : parseFloat(summary.successRate) >= 80 ? 'warning' : 'error'}">
                    <div class="metric-label">成功率</div>
                    <div class="metric-value">${summary.successRate}</div>
                </div>
            </div>

            <div class="section">
                <h2>📊 测试摘要</h2>
                <table>
                    <tr><th>指标</th><th>值</th><th>状态</th></tr>
                    <tr><td>总执行时间</td><td>${Math.round(summary.totalDuration / 1000)}秒</td><td>-</td></tr>
                    <tr><td>平均执行时间</td><td>${Math.round(summary.averageDuration)}ms</td><td>-</td></tr>
                    <tr><td>测试成功率</td><td>${summary.successRate}</td><td class="${parseFloat(summary.successRate) >= 95 ? 'status-passed' : 'status-failed'}">${parseFloat(summary.successRate) >= 95 ? '优秀' : '需要改进'}</td></tr>
                </table>
            </div>

            ${
              reportData.recommendations && reportData.recommendations.length > 0
                ? `
            <div class="section">
                <h2>💡 改进建议</h2>
                <div class="recommendations">
                    ${reportData.recommendations
                      .map(
                        rec => `
                        <div class="recommendation-item ${rec.priority}">
                            <span class="recommendation-priority ${rec.priority}">${rec.priority.toUpperCase()}</span>
                            <strong>${rec.category}:</strong> ${rec.message}
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
            `
                : ''
            }

            <div class="section">
                <h2>🔍 详细结果</h2>
                <table>
                    <tr><th>测试名称</th><th>状态</th><th>持续时间</th><th>详情</th></tr>
                    ${
                      Array.isArray(reportData.results)
                        ? reportData.results
                            .slice(0, 50)
                            .map(
                              result => `
                            <tr>
                                <td>${result.name || result.journey || '未知'}</td>
                                <td class="${result.success || result.passed ? 'status-passed' : 'status-failed'}">${result.success || result.passed ? '通过' : '失败'}</td>
                                <td>${result.duration || 0}ms</td>
                                <td>${result.error || '无'}</td>
                            </tr>
                        `
                            )
                            .join('')
                        : `<tr><td>${reportData.results.name || '单个测试'}</td><td class="${reportData.results.success ? 'status-passed' : 'status-failed'}">${reportData.results.success ? '通过' : '失败'}</td><td>${reportData.results.duration || 0}ms</td><td>${reportData.results.error || '无'}</td></tr>`
                    }
                </table>
            </div>
        </div>

        <div class="footer">
            <p>© 2024 Sira AI网关 - 工业级测试框架 | 报告由 TestReportGenerator 自动生成</p>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * 构建XML报告内容
   */
  buildXMLReport(reportData) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<test-report>
    <metadata>
        <generated-at>${reportData.metadata.generatedAt}</generated-at>
        <test-type>${reportData.metadata.testType}</test-type>
        <framework>${reportData.metadata.framework}</framework>
        <version>${reportData.metadata.version}</version>
    </metadata>
    <summary>
        <total-tests>${reportData.summary.totalTests}</total-tests>
        <passed-tests>${reportData.summary.passedTests}</passed-tests>
        <failed-tests>${reportData.summary.failedTests}</failed-tests>
        <success-rate>${reportData.summary.successRate}</success-rate>
        <total-duration>${reportData.summary.totalDuration}</total-duration>
        <average-duration>${reportData.summary.averageDuration}</average-duration>
    </summary>
    <results>
        ${
          Array.isArray(reportData.results)
            ? reportData.results
                .map(
                  result => `
        <test name="${result.name || result.journey || 'unknown'}" success="${result.success || result.passed}" duration="${result.duration || 0}">
            <error>${result.error || ''}</error>
        </test>`
                )
                .join('')
            : `<test name="${reportData.results.name || 'single-test'}" success="${reportData.results.success}" duration="${reportData.results.duration || 0}">
                <error>${reportData.results.error || ''}</error>
            </test>`
        }
    </results>
    ${
      reportData.recommendations
        ? `
    <recommendations>
        ${reportData.recommendations
          .map(
            rec => `
        <recommendation priority="${rec.priority}" category="${rec.category}">
            ${rec.message}
        </recommendation>`
          )
          .join('')}
    </recommendations>`
        : ''
    }
</test-report>`;
  }

  /**
   * 保存报告到历史
   */
  async saveReportToHistory(reportData, testType) {
    const historyEntry = {
      id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      generatedAt: reportData.metadata.generatedAt,
      testType,
      summary: reportData.summary,
      success: parseFloat(reportData.summary.successRate) >= 95,
    };

    this.reportHistory.push(historyEntry);

    // 限制历史记录数量
    if (this.reportHistory.length > 100) {
      this.reportHistory = this.reportHistory.slice(-100);
    }

    const historyFile = path.join(this.options.reportDir, 'report-history.json');
    await fs.writeFile(historyFile, JSON.stringify(this.reportHistory, null, 2), 'utf8');
  }

  /**
   * 生成报告摘要
   */
  generateReportSummary(reportData) {
    return {
      totalTests: reportData.summary.totalTests,
      successRate: reportData.summary.successRate,
      totalDuration: Math.round(reportData.summary.totalDuration / 1000),
      recommendationsCount: reportData.recommendations?.length || 0,
      status: parseFloat(reportData.summary.successRate) >= 95 ? 'passed' : 'failed',
    };
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
    };
  }
}

module.exports = { TestReportGenerator };
