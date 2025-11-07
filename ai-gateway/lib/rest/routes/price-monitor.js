/**
 * Sira AI网关 - 价格监控 REST API路由
 * 借鉴Prometheus和Grafana的设计理念，提供完整的价格监控接口
 */

const express = require('express');
const { priceMonitorManager } = require('../../price-monitor-manager');

const router = express.Router();

// 中间件：异步错误处理
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ==================== 价格数据查询 ====================

/**
 * 获取当前价格
 * GET /prices/current
 */
router.get('/current', (req, res) => {
  const { provider, model } = req.query;
  const prices = priceMonitorManager.getPriceStats(provider, model);

  res.json({
    success: true,
    data: {
      prices,
      total: prices.length,
      timestamp: new Date()
    }
  });
});

/**
 * 获取价格历史
 * GET /prices/history/:provider/:model
 */
router.get('/history/:provider/:model', (req, res) => {
  const { provider, model } = req.params;
  const { hours = 24 } = req.query;

  const history = priceMonitorManager.getPriceHistory(provider, model, parseInt(hours));

  res.json({
    success: true,
    data: {
      provider,
      model,
      history,
      hours: parseInt(hours),
      timestamp: new Date()
    }
  });
});

/**
 * 获取价格统计
 * GET /prices/stats
 */
router.get('/stats', (req, res) => {
  const { provider, model, groupBy = 'provider' } = req.query;
  const stats = priceMonitorManager.getPriceStats(provider, model);

  // 按提供商分组统计
  const groupedStats = {};
  for (const stat of stats) {
    const key = stat[groupBy] || 'unknown';
    if (!groupedStats[key]) {
      groupedStats[key] = [];
    }
    groupedStats[key].push(stat);
  }

  res.json({
    success: true,
    data: {
      stats,
      grouped: groupedStats,
      total: stats.length,
      timestamp: new Date()
    }
  });
});

/**
 * 获取价格趋势
 * GET /prices/trends
 */
router.get('/trends', (req, res) => {
  const { hours = 24 } = req.query;
  const allStats = priceMonitorManager.getPriceStats();

  const trends = allStats.map(stat => {
    const history = priceMonitorManager.getPriceHistory(stat.provider, stat.model, parseInt(hours));
    const trend = history.length > 1 ? history[history.length - 1].price - history[0].price : 0;
    const trendPercent = history.length > 1 ? (trend / history[0].price) * 100 : 0;

    return {
      provider: stat.provider,
      model: stat.model,
      currentPrice: stat.currentPrice,
      trend,
      trendPercent,
      trendDirection: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
      dataPoints: history.length,
      timeRange: `${hours} hours`
    };
  });

  res.json({
    success: true,
    data: {
      trends,
      timeRange: `${hours} hours`,
      timestamp: new Date()
    }
  });
});

// ==================== 告警管理 ====================

/**
 * 获取价格告警
 * GET /prices/alerts
 */
router.get('/alerts', (req, res) => {
  const { hours = 24, severity, provider, model } = req.query;
  let alerts = priceMonitorManager.getPriceAlerts(parseInt(hours));

  // 过滤告警
  if (severity) {
    alerts = alerts.filter(a => a.severity === severity);
  }

  if (provider) {
    alerts = alerts.filter(a => a.provider === provider);
  }

  if (model) {
    alerts = alerts.filter(a => a.model === model);
  }

  // 统计告警数量
  const alertStats = {
    total: alerts.length,
    bySeverity: {},
    byProvider: {},
    byType: {}
  };

  for (const alert of alerts) {
    alertStats.bySeverity[alert.severity] = (alertStats.bySeverity[alert.severity] || 0) + 1;
    alertStats.byProvider[alert.provider] = (alertStats.byProvider[alert.provider] || 0) + 1;
    alertStats.byType[alert.type] = (alertStats.byType[alert.type] || 0) + 1;
  }

  res.json({
    success: true,
    data: {
      alerts,
      stats: alertStats,
      timeRange: `${hours} hours`,
      timestamp: new Date()
    }
  });
});

/**
 * 创建价格告警规则
 * POST /prices/alert-rules
 */
router.post('/alert-rules', asyncHandler(async (req, res) => {
  const {
    provider,
    model,
    threshold = 0.05,
    type = 'both', // increase, decrease, both
    severity = 'medium',
    enabled = true
  } = req.body;

  if (!provider || !model) {
    return res.status(400).json({
      success: false,
      error: '提供商和模型名称都是必需的'
    });
  }

  // 这里应该实现告警规则存储和应用逻辑
  // 暂时返回模拟响应
  const rule = {
    id: `rule_${Date.now()}`,
    provider,
    model,
    threshold,
    type,
    severity,
    enabled,
    createdAt: new Date()
  };

  res.json({
    success: true,
    data: {
      rule,
      message: '价格告警规则已创建'
    }
  });
}));

// ==================== 路由优化 ====================

/**
 * 获取最优路由
 * GET /prices/optimal-route
 */
router.get('/optimal-route', (req, res) => {
  const { modelType, maxPrice, requiredRegion } = req.query;

  if (!modelType) {
    return res.status(400).json({
      success: false,
      error: '模型类型是必需的'
    });
  }

  const constraints = {};
  if (maxPrice) constraints.maxPrice = parseFloat(maxPrice);
  if (requiredRegion) constraints.requiredRegion = requiredRegion;

  const optimalRoute = priceMonitorManager.getOptimalRoute(modelType, constraints);

  if (!optimalRoute) {
    return res.status(404).json({
      success: false,
      error: `未找到 ${modelType} 类型的可用路由`
    });
  }

  res.json({
    success: true,
    data: {
      modelType,
      optimalRoute,
      constraints,
      timestamp: new Date()
    }
  });
});

/**
 * 获取所有模型类型的路由优化结果
 * GET /prices/route-optimization
 */
router.get('/route-optimization', (req, res) => {
  const optimizations = {};

  // 定义常见的模型类型
  const modelTypes = ['gpt', 'claude', 'gemini', 'image', 'speech'];

  for (const modelType of modelTypes) {
    const optimalRoute = priceMonitorManager.getOptimalRoute(modelType);
    if (optimalRoute) {
      optimizations[modelType] = optimalRoute;
    }
  }

  res.json({
    success: true,
    data: {
      optimizations,
      modelTypes: Object.keys(optimizations),
      timestamp: new Date()
    }
  });
});

// ==================== 成本预测 ====================

/**
 * 获取成本预测
 * GET /prices/prediction
 */
router.get('/prediction', (req, res) => {
  const { modelType, days = 30 } = req.query;

  if (!modelType) {
    return res.status(400).json({
      success: false,
      error: '模型类型是必需的'
    });
  }

  const prediction = priceMonitorManager.getCostPrediction(modelType, parseInt(days));

  if (prediction.error) {
    return res.status(400).json({
      success: false,
      error: prediction.error
    });
  }

  res.json({
    success: true,
    data: {
      prediction,
      message: '基于历史数据的成本预测结果'
    }
  });
});

/**
 * 获取成本节约建议
 * GET /prices/cost-savings
 */
router.get('/cost-savings', (req, res) => {
  const currentRoutes = priceMonitorManager.routeOptimizer.optimizeRoutes();
  const savings = {};

  for (const [modelType, route] of Object.entries(currentRoutes)) {
    const alternatives = priceMonitorManager.getProvidersForModel(modelType);
    if (alternatives.length > 1) {
      const sortedByPrice = alternatives.sort((a, b) => a.price - b.price);
      const bestPrice = sortedByPrice[0].price;
      const currentPrice = route.price;

      if (currentPrice > bestPrice) {
        const monthlySavings = (currentPrice - bestPrice) * 1000; // 假设每月1000次调用
        savings[modelType] = {
          currentProvider: route.provider,
          currentPrice,
          bestProvider: sortedByPrice[0].provider,
          bestPrice,
          monthlySavings,
          percentageSaving: ((currentPrice - bestPrice) / currentPrice) * 100
        };
      }
    }
  }

  res.json({
    success: true,
    data: {
      savings,
      totalMonthlySavings: Object.values(savings).reduce((sum, s) => sum + s.monthlySavings, 0),
      timestamp: new Date()
    }
  });
});

// ==================== 数据导出 ====================

/**
 * 导出价格数据
 * GET /prices/export
 */
router.get('/export', asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query;

  if (!['json', 'csv'].includes(format)) {
    return res.status(400).json({
      success: false,
      error: '不支持的导出格式，支持: json, csv'
    });
  }

  try {
    const data = await priceMonitorManager.exportPriceData(format);

    const mimeType = format === 'json' ? 'application/json' : 'text/csv';
    const filename = `price-monitor-export-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

// ==================== 可视化数据 ====================

/**
 * 获取仪表盘数据
 * GET /prices/dashboard
 */
router.get('/dashboard', (req, res) => {
  const stats = priceMonitorManager.getPriceStats();
  const alerts = priceMonitorManager.getPriceAlerts(24);

  // 计算关键指标
  const metrics = {
    totalProviders: new Set(stats.map(s => s.provider)).size,
    totalModels: stats.length,
    activeAlerts: alerts.length,
    avgPriceChange: 0,
    priceVolatility: 0
  };

  if (stats.length > 0) {
    const changes = stats.map(s => s.volatility || 0).filter(v => v > 0);
    metrics.avgPriceChange = changes.length > 0 ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    metrics.priceVolatility = Math.sqrt(changes.reduce((sum, v) => sum + v * v, 0) / Math.max(changes.length, 1));
  }

  // 价格趋势图数据 (最近7天)
  const trendData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    const dayPrices = stats.map(stat => {
      const history = priceMonitorManager.getPriceHistory(stat.provider, stat.model, 24 * 7);
      const dayData = history.filter(h => h.timestamp >= dayStart && h.timestamp < new Date(dayStart.getTime() + 24 * 60 * 60 * 1000));
      const avgPrice = dayData.length > 0 ? dayData.reduce((sum, h) => sum + h.price, 0) / dayData.length : stat.currentPrice;

      return {
        provider: stat.provider,
        model: stat.model,
        avgPrice
      };
    });

    trendData.push({
      date: dayStart.toISOString().split('T')[0],
      prices: dayPrices
    });
  }

  // 告警分布
  const alertDistribution = {
    bySeverity: {},
    byProvider: {},
    byType: {}
  };

  for (const alert of alerts) {
    alertDistribution.bySeverity[alert.severity] = (alertDistribution.bySeverity[alert.severity] || 0) + 1;
    alertDistribution.byProvider[alert.provider] = (alertDistribution.byProvider[alert.provider] || 0) + 1;
    alertDistribution.byType[alert.type] = (alertDistribution.byType[alert.type] || 0) + 1;
  }

  res.json({
    success: true,
    data: {
      metrics,
      trendData,
      alertDistribution,
      recentAlerts: alerts.slice(0, 10),
      timestamp: new Date()
    }
  });
});

/**
 * 获取图表数据
 * GET /prices/charts/:chartType
 */
router.get('/charts/:chartType', (req, res) => {
  const { chartType } = req.params;
  const { hours = 24 } = req.query;

  let chartData = {};

  switch (chartType) {
    case 'price-comparison':
      // 价格对比图
      const stats = priceMonitorManager.getPriceStats();
      chartData = {
        labels: stats.map(s => `${s.provider}/${s.model}`),
        datasets: [{
          label: '当前价格',
          data: stats.map(s => s.currentPrice),
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      };
      break;

    case 'price-history':
      // 价格历史图
      const historyData = [];
      const providers = ['openai', 'anthropic', 'google'];

      for (const provider of providers) {
        const providerStats = priceMonitorManager.getPriceStats(provider);
        if (providerStats.length > 0) {
          const stat = providerStats[0]; // 取第一个模型作为代表
          const history = priceMonitorManager.getPriceHistory(stat.provider, stat.model, parseInt(hours));

          historyData.push({
            label: provider,
            data: history.map(h => ({ x: h.timestamp, y: h.price })),
            borderColor: getProviderColor(provider),
            fill: false
          });
        }
      }

      chartData = {
        datasets: historyData
      };
      break;

    case 'alert-timeline':
      // 告警时间线
      const alerts = priceMonitorManager.getPriceAlerts(parseInt(hours));
      chartData = {
        labels: alerts.map(a => a.timestamp.toISOString()),
        datasets: [{
          label: '告警数量',
          data: alerts.map((a, i) => alerts.slice(0, i + 1).length),
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      };
      break;

    default:
      return res.status(400).json({
        success: false,
        error: '不支持的图表类型'
      });
  }

  res.json({
    success: true,
    data: {
      chartType,
      chartData,
      timeRange: `${hours} hours`,
      timestamp: new Date()
    }
  });
});

// ==================== 系统管理 ====================

/**
 * 手动触发价格更新
 * POST /prices/update
 */
router.post('/update', asyncHandler(async (req, res) => {
  try {
    await priceMonitorManager.updatePrices();

    res.json({
      success: true,
      message: '价格数据更新已触发',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * 清理过期数据
 * POST /prices/cleanup
 */
router.post('/cleanup', asyncHandler(async (req, res) => {
  try {
    priceMonitorManager.cleanup();

    res.json({
      success: true,
      message: '过期数据清理完成',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

/**
 * 获取系统状态
 * GET /prices/health
 */
router.get('/health', (req, res) => {
  const stats = priceMonitorManager.getPriceStats();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      totalPricePoints: stats.length,
      activeProviders: new Set(stats.map(s => s.provider)).size,
      lastUpdate: new Date(),
      uptime: process.uptime(),
      version: '1.0'
    }
  });
});

// 提供商颜色映射
function getProviderColor(provider) {
  const colors = {
    openai: '#10a37f',
    anthropic: '#d97706',
    google: '#4285f4',
    azure: '#0078d4',
    aws: '#ff9900'
  };
  return colors[provider] || '#6b7280';
}

module.exports = router;
