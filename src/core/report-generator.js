const fs = require("node:fs").promises;
const path = require("node:path");
const { usageAnalytics } = require("./usage-analytics");
const {
  performanceBenchmarkManager,
} = require("./performance-benchmark-manager");

/**
 * 入口统计和报告系统 - 借鉴Grafana、Kibana和DataDog的设计理念
 * 提供全面的API统计、错误分析、性能报告和业务洞察
 */
class ReportGenerator {
  constructor(options = {}) {
    this.configPath =
      options.configPath || path.join(__dirname, "../config/reports.json");
    this.reportsPath =
      options.reportsPath || path.join(__dirname, "../data/reports");
    this.templatesPath =
      options.templatesPath || path.join(__dirname, "../templates/reports");

    this.customReports = new Map(); // 自定义报告配置
    this.scheduledReports = new Map(); // 定时报告配置
    this.reportCache = new Map(); // 报告缓存

    this.initialized = false;

    // 报告类型映射
    this.reportTypes = {
      "usage-summary": this.generateUsageSummaryReport.bind(this),
      "performance-analysis": this.generatePerformanceAnalysisReport.bind(this),
      "error-analysis": this.generateErrorAnalysisReport.bind(this),
      "cost-analysis": this.generateCostAnalysisReport.bind(this),
      "user-behavior": this.generateUserBehaviorReport.bind(this),
      "provider-comparison": this.generateProviderComparisonReport.bind(this),
      "trend-analysis": this.generateTrendAnalysisReport.bind(this),
      "custom-dashboard": this.generateCustomDashboardReport.bind(this),
    };
  }

  /**
   * 初始化报告生成器
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建报告目录
      await fs.mkdir(this.reportsPath, { recursive: true });
      await fs.mkdir(this.templatesPath, { recursive: true });

      // 加载自定义报告配置
      await this.loadReportConfigurations();

      // 启动定时报告生成器
      this.startScheduledReportGenerator();

      this.initialized = true;
      console.log(
        `✅ 报告生成器已初始化，支持 ${Object.keys(this.reportTypes).length} 种报告类型`,
      );
    } catch (error) {
      console.error("❌ 报告生成器初始化失败:", error.message);
      throw error;
    }
  }

  /**
   * 生成报告
   */
  async generateReport(reportType, options = {}) {
    const {
      timeRange = "24h",
      filters = {},
      format = "json",
      includeCharts = true,
      cache = true,
    } = options;

    const cacheKey = `${reportType}_${timeRange}_${JSON.stringify(filters)}_${format}`;

    // 检查缓存
    if (cache && this.reportCache.has(cacheKey)) {
      const cached = this.reportCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) {
        // 5分钟缓存
        return cached.data;
      }
    }

    // 验证报告类型
    if (!this.reportTypes[reportType]) {
      throw new Error(`不支持的报告类型: ${reportType}`);
    }

    try {
      console.log(`📊 生成报告: ${reportType}, 时间范围: ${timeRange}`);

      // 获取时间范围
      const timeFilter = this.parseTimeRange(timeRange);

      // 生成报告数据
      const reportData = await this.reportTypes[reportType]({
        ...options,
        timeFilter,
        filters,
      });

      // 添加元数据
      const report = {
        type: reportType,
        generatedAt: new Date().toISOString(),
        timeRange,
        filters,
        format,
        data: reportData,
        metadata: {
          version: "1.0",
          generator: "Sira Report Engine",
          executionTime: Date.now() - Date.now(), // 会被实际执行时间覆盖
        },
      };

      // 缓存报告
      if (cache) {
        this.reportCache.set(cacheKey, {
          timestamp: Date.now(),
          data: report,
        });
      }

      return report;
    } catch (error) {
      console.error(`报告生成失败: ${reportType} - ${error.message}`);
      throw error;
    }
  }

  /**
   * 创建自定义报告配置
   */
  async createCustomReport(config) {
    const reportId = config.id || this.generateReportId();

    if (this.customReports.has(reportId)) {
      throw new Error(`自定义报告 ${reportId} 已存在`);
    }

    const customReport = {
      id: reportId,
      name: config.name,
      description: config.description,
      type: "custom-dashboard",
      config: config.config || {},
      schedule: config.schedule || null, // 定时配置
      enabled: config.enabled !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.customReports.set(reportId, customReport);
    await this.saveReportConfigurations();

    console.log(`✅ 创建自定义报告: ${reportId} - ${customReport.name}`);
    return customReport;
  }

  /**
   * 导出报告
   */
  async exportReport(report, format = "json", options = {}) {
    const { filename, includeMetadata = true } = options;

    let exportData;
    let mimeType;
    let extension;

    switch (format.toLowerCase()) {
      case "json":
        exportData = JSON.stringify(report, null, 2);
        mimeType = "application/json";
        extension = "json";
        break;

      case "csv":
        exportData = this.convertToCSV(report);
        mimeType = "text/csv";
        extension = "csv";
        break;

      case "html":
        exportData = this.convertToHTML(report);
        mimeType = "text/html";
        extension = "html";
        break;

      case "pdf":
        exportData = await this.convertToPDF(report);
        mimeType = "application/pdf";
        extension = "pdf";
        break;

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }

    // 保存到文件
    if (filename) {
      const filePath = path.join(this.reportsPath, `${filename}.${extension}`);
      await fs.writeFile(filePath, exportData);
      return {
        filePath,
        mimeType,
        size: exportData.length,
      };
    }

    return {
      data: exportData,
      mimeType,
      size: exportData.length,
    };
  }

  /**
   * 获取仪表板数据
   */
  async getDashboardData(dashboardType = "overview", options = {}) {
    const { timeRange = "24h", refresh = false } = options;

    const cacheKey = `dashboard_${dashboardType}_${timeRange}`;

    if (!refresh && this.reportCache.has(cacheKey)) {
      const cached = this.reportCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) {
        // 1分钟缓存
        return cached.data;
      }
    }

    const timeFilter = this.parseTimeRange(timeRange);

    let dashboardData;

    switch (dashboardType) {
      case "overview":
        dashboardData = await this.generateOverviewDashboard(timeFilter);
        break;
      case "performance":
        dashboardData = await this.generatePerformanceDashboard(timeFilter);
        break;
      case "usage":
        dashboardData = await this.generateUsageDashboard(timeFilter);
        break;
      case "errors":
        dashboardData = await this.generateErrorDashboard(timeFilter);
        break;
      default:
        throw new Error(`不支持的仪表板类型: ${dashboardType}`);
    }

    // 缓存仪表板数据
    this.reportCache.set(cacheKey, {
      timestamp: Date.now(),
      data: dashboardData,
    });

    return dashboardData;
  }

  // ==================== 报告生成方法 ====================

  /**
   * 生成使用情况汇总报告
   */
  async generateUsageSummaryReport(options) {
    const { timeFilter, filters } = options;

    const usageData = await usageAnalytics.getAggregatedStats({
      ...timeFilter,
      ...filters,
    });

    return {
      summary: {
        totalRequests: usageData.totalRequests,
        totalUsers: usageData.totalUsers,
        totalCost: usageData.totalCost,
        avgResponseTime: usageData.avgResponseTime,
        successRate: usageData.successRate,
      },
      breakdowns: {
        byProvider: usageData.byProvider,
        byModel: usageData.byModel,
        byUser: usageData.byUser,
        byHour: usageData.byHour,
      },
      trends: {
        requests: this.calculateTrend(usageData.requestsOverTime),
        cost: this.calculateTrend(usageData.costOverTime),
        users: this.calculateTrend(usageData.usersOverTime),
      },
      topMetrics: {
        topUsers: usageData.topUsers,
        topModels: usageData.topModels,
        topErrors: usageData.topErrors,
      },
    };
  }

  /**
   * 生成性能分析报告
   */
  async generatePerformanceAnalysisReport(options) {
    const { timeFilter, filters } = options;

    const performanceData = await usageAnalytics.getPerformanceStats({
      ...timeFilter,
      ...filters,
    });

    return {
      responseTime: {
        avg: performanceData.avgResponseTime,
        p50: performanceData.p50ResponseTime,
        p95: performanceData.p95ResponseTime,
        p99: performanceData.p99ResponseTime,
        distribution: performanceData.responseTimeDistribution,
      },
      throughput: {
        requestsPerSecond: performanceData.requestsPerSecond,
        requestsPerMinute: performanceData.requestsPerMinute,
        peakThroughput: performanceData.peakThroughput,
      },
      latencyBreakdown: {
        byProvider: performanceData.latencyByProvider,
        byModel: performanceData.latencyByModel,
        byEndpoint: performanceData.latencyByEndpoint,
      },
      bottlenecks: performanceData.bottlenecks,
      recommendations: performanceData.recommendations,
    };
  }

  /**
   * 生成错误分析报告
   */
  async generateErrorAnalysisReport(options) {
    const { timeFilter, filters } = options;

    const errorData = await usageAnalytics.getErrorStats({
      ...timeFilter,
      ...filters,
    });

    return {
      summary: {
        totalErrors: errorData.totalErrors,
        errorRate: errorData.errorRate,
        topErrorTypes: errorData.topErrorTypes,
        errorTrend: this.calculateTrend(errorData.errorsOverTime),
      },
      breakdowns: {
        byErrorType: errorData.byErrorType,
        byProvider: errorData.byProvider,
        byModel: errorData.byModel,
        byEndpoint: errorData.byEndpoint,
      },
      errorPatterns: errorData.errorPatterns,
      impactAnalysis: {
        affectedUsers: errorData.affectedUsers,
        revenueImpact: errorData.revenueImpact,
        userExperienceImpact: errorData.userExperienceImpact,
      },
      recommendations: errorData.recommendations,
    };
  }

  /**
   * 生成成本分析报告
   */
  async generateCostAnalysisReport(options) {
    const { timeFilter, filters } = options;

    const costData = await usageAnalytics.getCostStats({
      ...timeFilter,
      ...filters,
    });

    return {
      summary: {
        totalCost: costData.totalCost,
        avgCostPerRequest: costData.avgCostPerRequest,
        costByProvider: costData.costByProvider,
        costTrend: this.calculateTrend(costData.costOverTime),
      },
      breakdowns: {
        byProvider: costData.byProvider,
        byModel: costData.byModel,
        byUser: costData.byUser,
        byTimePeriod: costData.byTimePeriod,
      },
      optimization: {
        potentialSavings: costData.potentialSavings,
        recommendations: costData.recommendations,
        costAnomalies: costData.costAnomalies,
      },
      projections: {
        nextMonth: costData.nextMonthProjection,
        nextQuarter: costData.nextQuarterProjection,
        yearlyTrend: this.calculateTrend(costData.yearlyCostData),
      },
    };
  }

  /**
   * 生成用户行为报告
   */
  async generateUserBehaviorReport(options) {
    const { timeFilter, filters } = options;

    const behaviorData = await usageAnalytics.getUserBehaviorStats({
      ...timeFilter,
      ...filters,
    });

    return {
      userSegmentation: {
        byTier: behaviorData.byTier,
        byActivityLevel: behaviorData.byActivityLevel,
        byUsagePattern: behaviorData.byUsagePattern,
      },
      sessionAnalysis: {
        avgSessionDuration: behaviorData.avgSessionDuration,
        sessionDistribution: behaviorData.sessionDistribution,
        userRetention: behaviorData.userRetention,
      },
      featureUsage: {
        mostUsedFeatures: behaviorData.mostUsedFeatures,
        featureAdoption: behaviorData.featureAdoption,
        featureRetention: behaviorData.featureRetention,
      },
      behavioralInsights: {
        peakUsageTimes: behaviorData.peakUsageTimes,
        userJourney: behaviorData.userJourney,
        churnIndicators: behaviorData.churnIndicators,
      },
    };
  }

  /**
   * 生成供应商对比报告
   */
  async generateProviderComparisonReport(options) {
    const { timeFilter, filters } = options;

    const comparisonData = await usageAnalytics.getProviderComparison({
      ...timeFilter,
      ...filters,
    });

    return {
      performanceComparison: {
        responseTime: comparisonData.responseTimeByProvider,
        successRate: comparisonData.successRateByProvider,
        throughput: comparisonData.throughputByProvider,
        reliability: comparisonData.reliabilityByProvider,
      },
      costComparison: {
        costPerRequest: comparisonData.costPerRequestByProvider,
        totalCost: comparisonData.totalCostByProvider,
        costEfficiency: comparisonData.costEfficiencyByProvider,
      },
      qualityComparison: {
        errorRate: comparisonData.errorRateByProvider,
        userSatisfaction: comparisonData.userSatisfactionByProvider,
        featureCompleteness: comparisonData.featureCompletenessByProvider,
      },
      recommendations: comparisonData.recommendations,
      migrationOpportunities: comparisonData.migrationOpportunities,
    };
  }

  /**
   * 生成趋势分析报告
   */
  async generateTrendAnalysisReport(options) {
    const { timeFilter, filters } = options;

    const trendData = await usageAnalytics.getTrendAnalysis({
      ...timeFilter,
      ...filters,
      periods: ["hour", "day", "week", "month"],
    });

    return {
      growthTrends: {
        userGrowth: this.calculateGrowthRate(trendData.userGrowth),
        requestGrowth: this.calculateGrowthRate(trendData.requestGrowth),
        revenueGrowth: this.calculateGrowthRate(trendData.revenueGrowth),
      },
      seasonalPatterns: {
        daily: trendData.dailyPatterns,
        weekly: trendData.weeklyPatterns,
        monthly: trendData.monthlyPatterns,
      },
      anomalyDetection: {
        spikes: trendData.usageSpikes,
        drops: trendData.usageDrops,
        anomalies: trendData.anomalies,
      },
      forecasting: {
        nextWeek: trendData.nextWeekForecast,
        nextMonth: trendData.nextMonthForecast,
        confidence: trendData.forecastConfidence,
      },
      correlations: {
        userVsRevenue: this.calculateCorrelation(
          trendData.userData,
          trendData.revenueData,
        ),
        performanceVsUsage: this.calculateCorrelation(
          trendData.performanceData,
          trendData.usageData,
        ),
      },
    };
  }

  /**
   * 生成自定义仪表板报告
   */
  async generateCustomDashboardReport(options) {
    const { timeFilter, filters, config } = options;

    const dashboardConfig = config || {};

    // 并发生成多个报告
    const reportPromises = dashboardConfig.widgets.map(async (widget) => {
      const widgetData = await this.generateReport(widget.type, {
        timeRange: widget.timeRange || options.timeRange,
        filters: { ...filters, ...widget.filters },
        includeCharts: true,
      });

      return {
        id: widget.id,
        title: widget.title,
        type: widget.type,
        position: widget.position,
        size: widget.size,
        data: widgetData.data,
      };
    });

    const widgets = await Promise.all(reportPromises);

    return {
      title: dashboardConfig.title || "自定义仪表板",
      description: dashboardConfig.description,
      widgets,
      layout: dashboardConfig.layout || "grid",
      refreshInterval: dashboardConfig.refreshInterval || 300000, // 5分钟
    };
  }

  // ==================== 仪表板生成方法 ====================

  async generateOverviewDashboard(timeFilter) {
    const [usage, performance, errors] = await Promise.all([
      this.generateUsageSummaryReport({ timeFilter }),
      this.generatePerformanceAnalysisReport({ timeFilter }),
      this.generateErrorAnalysisReport({ timeFilter }),
    ]);

    return {
      summary: {
        totalRequests: usage.summary.totalRequests,
        totalUsers: usage.summary.totalUsers,
        avgResponseTime: performance.responseTime.avg,
        errorRate: errors.summary.errorRate,
        totalCost: usage.summary.totalCost,
      },
      charts: {
        requestsOverTime: usage.trends.requests,
        responseTimeDistribution: performance.responseTime.distribution,
        errorsByType: errors.breakdowns.byErrorType,
        costByProvider: usage.breakdowns.byProvider,
      },
      alerts: this.generateAlerts(usage, performance, errors),
      kpis: this.calculateKPIs(usage, performance, errors),
    };
  }

  async generatePerformanceDashboard(timeFilter) {
    const performance = await this.generatePerformanceAnalysisReport({
      timeFilter,
    });

    return {
      metrics: {
        avgResponseTime: performance.responseTime.avg,
        p95ResponseTime: performance.responseTime.p95,
        throughput: performance.throughput.requestsPerSecond,
        errorRate: 0, // 需要从错误报告获取
      },
      charts: {
        responseTimeTrend: performance.responseTime.distribution,
        throughputTrend: performance.throughput,
        latencyByProvider: performance.latencyBreakdown.byProvider,
        latencyByModel: performance.latencyBreakdown.byModel,
      },
      bottlenecks: performance.bottlenecks,
      recommendations: performance.recommendations,
    };
  }

  async generateUsageDashboard(timeFilter) {
    const usage = await this.generateUsageSummaryReport({ timeFilter });

    return {
      metrics: {
        totalRequests: usage.summary.totalRequests,
        totalUsers: usage.summary.totalUsers,
        totalCost: usage.summary.totalCost,
        avgCostPerRequest:
          usage.summary.totalCost / usage.summary.totalRequests,
      },
      charts: {
        requestsByProvider: usage.breakdowns.byProvider,
        requestsByModel: usage.breakdowns.byModel,
        costTrend: usage.trends.cost,
        userGrowth: usage.trends.users,
      },
      topUsers: usage.topMetrics.topUsers,
      topModels: usage.topMetrics.topModels,
    };
  }

  async generateErrorDashboard(timeFilter) {
    const errors = await this.generateErrorAnalysisReport({ timeFilter });

    return {
      metrics: {
        totalErrors: errors.summary.totalErrors,
        errorRate: errors.summary.errorRate,
        mostCommonError: errors.summary.topErrorTypes[0],
      },
      charts: {
        errorsOverTime: errors.summary.errorTrend,
        errorsByType: errors.breakdowns.byErrorType,
        errorsByProvider: errors.breakdowns.byProvider,
        errorsByModel: errors.breakdowns.byModel,
      },
      errorPatterns: errors.errorPatterns,
      impact: errors.impactAnalysis,
    };
  }

  // ==================== 工具方法 ====================

  /**
   * 解析时间范围
   */
  parseTimeRange(timeRange) {
    const now = new Date();
    let startTime;
    const endTime = now;

    const match = timeRange.match(/^(\d+)([hdwm])$/);
    if (!match) {
      throw new Error(`无效的时间范围格式: ${timeRange}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "h": // 小时
        startTime = new Date(now.getTime() - value * 60 * 60 * 1000);
        break;
      case "d": // 天
        startTime = new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
        break;
      case "w": // 周
        startTime = new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
        break;
      case "m": // 月
        startTime = new Date(now.getTime() - value * 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        throw new Error(`不支持的时间单位: ${unit}`);
    }

    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: timeRange,
    };
  }

  /**
   * 计算趋势
   */
  calculateTrend(dataPoints) {
    if (!dataPoints || dataPoints.length < 2) return null;

    const values = dataPoints.map((p) => p.value);
    const times = dataPoints.map((p) => new Date(p.timestamp).getTime());

    // 简单线性回归
    const n = values.length;
    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = times.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trend =
      slope > 0 ? "increasing" : slope < 0 ? "decreasing" : "stable";
    const changePercent = ((values[n - 1] - values[0]) / values[0]) * 100;

    return {
      trend,
      slope,
      changePercent: Math.round(changePercent * 100) / 100,
      projectedNext: slope * (times[n - 1] + (times[1] - times[0])) + intercept,
    };
  }

  /**
   * 计算增长率
   */
  calculateGrowthRate(data) {
    if (!data || data.length < 2) return 0;

    const first = data[0].value;
    const last = data[data.length - 1].value;

    return ((last - first) / first) * 100;
  }

  /**
   * 计算相关性
   */
  calculateCorrelation(data1, data2) {
    if (!data1 || !data2 || data1.length !== data2.length || data1.length < 2) {
      return 0;
    }

    const n = data1.length;
    const sum1 = data1.reduce((a, b) => a + b, 0);
    const sum2 = data2.reduce((a, b) => a + b, 0);
    const sum1Sq = data1.reduce((a, b) => a + b * b, 0);
    const sum2Sq = data2.reduce((a, b) => a + b * b, 0);
    const sum12 = data1.reduce((sum, val, i) => sum + val * data2[i], 0);

    const numerator = n * sum12 - sum1 * sum2;
    const denominator = Math.sqrt(
      (n * sum1Sq - sum1 * sum1) * (n * sum2Sq - sum2 * sum2),
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * 生成告警
   */
  generateAlerts(usage, performance, errors) {
    const alerts = [];

    // 响应时间告警
    if (performance.responseTime.p95 > 5000) {
      alerts.push({
        level: "warning",
        type: "performance",
        message: "P95响应时间过高",
        value: `${performance.responseTime.p95}ms`,
        threshold: "5000ms",
      });
    }

    // 错误率告警
    if (errors.summary.errorRate > 5) {
      alerts.push({
        level: "error",
        type: "reliability",
        message: "错误率过高",
        value: `${errors.summary.errorRate}%`,
        threshold: "5%",
      });
    }

    // 成本异常告警
    const costTrend = usage.trends.cost;
    if (costTrend && Math.abs(costTrend.changePercent) > 50) {
      alerts.push({
        level: "warning",
        type: "cost",
        message: "成本变化异常",
        value: `${costTrend.changePercent}%`,
        threshold: "±50%",
      });
    }

    return alerts;
  }

  /**
   * 计算KPI指标
   */
  calculateKPIs(usage, performance, errors) {
    return {
      responseTime: {
        value: performance.responseTime.avg,
        target: 2000,
        status: performance.responseTime.avg <= 2000 ? "good" : "warning",
      },
      errorRate: {
        value: errors.summary.errorRate,
        target: 1,
        status:
          errors.summary.errorRate <= 1
            ? "good"
            : errors.summary.errorRate <= 5
              ? "warning"
              : "error",
      },
      throughput: {
        value: performance.throughput.requestsPerSecond,
        target: 100,
        status:
          performance.throughput.requestsPerSecond >= 100 ? "good" : "warning",
      },
      costEfficiency: {
        value: usage.summary.totalCost / usage.summary.totalRequests,
        target: 0.01,
        status:
          usage.summary.totalCost / usage.summary.totalRequests <= 0.01
            ? "good"
            : "warning",
      },
    };
  }

  /**
   * 转换为CSV格式
   */
  convertToCSV(report) {
    // 简化的CSV转换，实际实现会更复杂
    const lines = ["Type,Generated At,Time Range"];
    lines.push(`${report.type},${report.generatedAt},${report.timeRange}`);

    return lines.join("\n");
  }

  /**
   * 转换为HTML格式
   */
  convertToHTML(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.type} Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: white; padding: 15px; border: 1px solid #ddd; border-radius: 5px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.type} Report</h1>
        <p>Generated: ${report.generatedAt}</p>
        <p>Time Range: ${report.timeRange}</p>
    </div>
    <div class="summary">
        <!-- 动态生成摘要内容 -->
    </div>
</body>
</html>`;
  }

  /**
   * 转换为PDF格式 (占位符)
   */
  async convertToPDF(_report) {
    // 需要安装pdf生成库，如puppeteer
    throw new Error("PDF导出功能暂未实现");
  }

  /**
   * 生成报告ID
   */
  generateReportId() {
    return `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 启动定时报告生成器
   */
  startScheduledReportGenerator() {
    // 每小时检查一次定时报告
    setInterval(
      () => {
        this.processScheduledReports();
      },
      60 * 60 * 1000,
    ); // 1小时
  }

  /**
   * 处理定时报告
   */
  async processScheduledReports() {
    const now = new Date();

    for (const [reportId, report] of this.customReports) {
      if (!report.enabled || !report.schedule) continue;

      // 检查是否需要生成报告
      if (this.shouldGenerateScheduledReport(report, now)) {
        try {
          console.log(`📅 生成定时报告: ${reportId}`);

          const reportData = await this.generateReport(report.type, {
            timeRange: report.schedule.timeRange || "24h",
            filters: report.schedule.filters || {},
            format: report.schedule.format || "json",
          });

          // 保存或发送报告
          if (report.schedule.export) {
            await this.exportReport(reportData, report.schedule.format, {
              filename: `${reportId}_${now.toISOString().split("T")[0]}`,
            });
          }

          // 更新最后生成时间
          report.lastGeneratedAt = now.toISOString();
          await this.saveReportConfigurations();
        } catch (error) {
          console.error(`定时报告生成失败: ${reportId} - ${error.message}`);
        }
      }
    }
  }

  /**
   * 检查是否应该生成定时报告
   */
  shouldGenerateScheduledReport(report, now) {
    if (!report.lastGeneratedAt) return true;

    const lastGenerated = new Date(report.lastGeneratedAt);
    const { schedule } = report;

    switch (schedule.frequency) {
      case "hourly":
        return now.getTime() - lastGenerated.getTime() >= 60 * 60 * 1000;
      case "daily":
        return now.getDate() !== lastGenerated.getDate();
      case "weekly":
        return (
          now.getDay() === schedule.dayOfWeek &&
          now.getDate() !== lastGenerated.getDate()
        );
      case "monthly":
        return now.getDate() === 1 && lastGenerated.getDate() !== 1;
      default:
        return false;
    }
  }

  /**
   * 加载报告配置
   */
  async loadReportConfigurations() {
    try {
      const data = await fs.readFile(this.configPath, "utf8");
      const config = JSON.parse(data);

      if (config.customReports) {
        for (const [id, report] of Object.entries(config.customReports)) {
          this.customReports.set(id, report);
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("加载报告配置失败:", error.message);
      }
    }
  }

  /**
   * 保存报告配置
   */
  async saveReportConfigurations() {
    const config = {
      customReports: Object.fromEntries(this.customReports),
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}

module.exports = { ReportGenerator };
