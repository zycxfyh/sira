/**
 * Sira AI网关 - 价格监控管理器
 * 借鉴Prometheus、Grafana和云成本管理工具的设计理念
 *
 * 核心特性:
 * - 实时价格监控: 自动采集所有供应商的最新价格
 * - 历史价格追踪: 存储价格变动历史数据
 * - 价格变动告警: 检测异常价格变动并触发告警
 * - 智能路由优化: 根据价格动态调整路由策略
 * - 成本预测分析: 基于历史数据预测未来成本
 * - 可视化仪表盘: 提供直观的价格监控界面
 * - 多维度分析: 按模型、地区、时间等多维度分析
 */

const { EventEmitter } = require('events')
const fs = require('fs').promises
const path = require('path')

// 价格监控配置
const PRICE_CONFIG = {
  updateInterval: 5 * 60 * 1000, // 5分钟更新一次
  historyRetention: 90 * 24 * 60 * 60 * 1000, // 90天历史数据
  priceChangeThreshold: 0.05, // 5%价格变动阈值
  alertCooldown: 60 * 60 * 1000, // 告警冷却1小时
  predictionDays: 30, // 成本预测天数
  dataDir: './data/price-monitor'
}

// 价格数据结构
class PriceData {
  constructor (provider, model, region = 'global') {
    this.provider = provider
    this.model = model
    this.region = region
    this.currentPrice = 0
    this.previousPrice = 0
    this.lastUpdate = null
    this.priceHistory = []
    this.alerts = []
    this.metadata = {
      currency: 'USD',
      unit: 'per 1K tokens',
      lastAlertTime: null,
      changeCount: 0
    }
  }

  // 更新价格
  updatePrice (newPrice, timestamp = new Date()) {
    this.previousPrice = this.currentPrice
    this.currentPrice = newPrice
    this.lastUpdate = timestamp

    // 添加到历史记录
    this.priceHistory.push({
      price: newPrice,
      timestamp,
      changePercent: this.previousPrice > 0 ? (newPrice - this.previousPrice) / this.previousPrice : 0
    })

    // 限制历史记录数量
    if (this.priceHistory.length > 1000) {
      this.priceHistory = this.priceHistory.slice(-1000)
    }

    // 检测价格变动
    if (this.previousPrice > 0) {
      const changePercent = Math.abs((newPrice - this.previousPrice) / this.previousPrice)
      if (changePercent >= PRICE_CONFIG.priceChangeThreshold) {
        this.triggerPriceAlert(newPrice, changePercent, timestamp)
      }
    }

    this.metadata.changeCount++
  }

  // 触发价格告警
  triggerPriceAlert (newPrice, changePercent, timestamp) {
    const now = Date.now()

    // 检查告警冷却时间
    if (this.metadata.lastAlertTime &&
        now - this.metadata.lastAlertTime < PRICE_CONFIG.alertCooldown) {
      return
    }

    const alert = {
      type: newPrice > this.previousPrice ? 'price_increase' : 'price_decrease',
      oldPrice: this.previousPrice,
      newPrice,
      changePercent,
      timestamp,
      severity: changePercent > 0.2 ? 'high' : changePercent > 0.1 ? 'medium' : 'low'
    }

    this.alerts.push(alert)
    this.metadata.lastAlertTime = now

    // 限制告警数量
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    return alert
  }

  // 获取价格趋势
  getPriceTrend (hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    const recentPrices = this.priceHistory.filter(p => p.timestamp >= cutoff)

    if (recentPrices.length < 2) return 'stable'

    const first = recentPrices[0].price
    const last = recentPrices[recentPrices.length - 1].price
    const change = (last - first) / first

    if (Math.abs(change) < 0.01) return 'stable'
    return change > 0 ? 'increasing' : 'decreasing'
  }

  // 获取统计信息
  getStats () {
    if (this.priceHistory.length === 0) return null

    const prices = this.priceHistory.map(p => p.price)
    const changes = this.priceHistory.slice(1).map(p => p.changePercent)

    return {
      currentPrice: this.currentPrice,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      volatility: changes.length > 0 ? Math.sqrt(changes.reduce((a, b) => a + b * b, 0) / changes.length) : 0,
      totalChanges: this.metadata.changeCount,
      lastUpdate: this.lastUpdate,
      trend: this.getPriceTrend()
    }
  }
}

// 价格收集器类 (借鉴Prometheus的采集器设计)
class PriceCollector {
  constructor (provider, config) {
    this.provider = provider
    this.config = config
    this.lastCollectTime = null
    this.collectErrors = 0
    this.maxRetries = 3
  }

  // 收集价格数据 (抽象方法，需要子类实现)
  async collect () {
    throw new Error('collect() method must be implemented by subclass')
  }

  // 重试机制
  async collectWithRetry () {
    let lastError

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const data = await this.collect()
        this.lastCollectTime = new Date()
        this.collectErrors = 0
        return data
      } catch (error) {
        lastError = error
        this.collectErrors++
        logWarn(`价格收集失败 ${this.provider} (尝试 ${attempt}/${this.maxRetries}): ${error.message}`)

        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // 递增延迟
        }
      }
    }

    throw lastError
  }

  // 验证收集的数据
  validateData (data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid price data format')
    }

    // 检查必需字段
    if (!data.models || !Array.isArray(data.models)) {
      throw new Error('Price data must contain models array')
    }

    // 验证每个模型的价格数据
    for (const model of data.models) {
      if (!model.name || typeof model.price !== 'number' || model.price < 0) {
        throw new Error(`Invalid model data: ${JSON.stringify(model)}`)
      }
    }

    return true
  }
}

// OpenAI价格收集器
class OpenAIPriceCollector extends PriceCollector {
  async collect () {
    // 这里应该调用OpenAI的定价API或从官方网站爬取
    // 暂时返回模拟数据
    const data = {
      models: [
        { name: 'gpt-3.5-turbo', price: 0.002, unit: 'per 1K tokens' },
        { name: 'gpt-4', price: 0.03, unit: 'per 1K tokens' },
        { name: 'gpt-4-turbo', price: 0.01, unit: 'per 1K tokens' },
        { name: 'dall-e-3', price: 0.04, unit: 'per image' },
        { name: 'whisper-1', price: 0.006, unit: 'per minute' },
        { name: 'tts-1', price: 0.000015, unit: 'per character' }
      ],
      currency: 'USD',
      lastUpdate: new Date()
    }

    this.validateData(data)
    return data
  }
}

// Anthropic价格收集器
class AnthropicPriceCollector extends PriceCollector {
  async collect () {
    const data = {
      models: [
        { name: 'claude-3-opus', price: 0.015, unit: 'per 1K tokens' },
        { name: 'claude-3-sonnet', price: 0.003, unit: 'per 1K tokens' },
        { name: 'claude-3-haiku', price: 0.00025, unit: 'per 1K tokens' }
      ],
      currency: 'USD',
      lastUpdate: new Date()
    }

    this.validateData(data)
    return data
  }
}

// 谷歌价格收集器
class GooglePriceCollector extends PriceCollector {
  async collect () {
    const data = {
      models: [
        { name: 'gemini-pro', price: 0.001, unit: 'per 1K tokens' },
        { name: 'gemini-pro-vision', price: 0.0025, unit: 'per 1K tokens' },
        { name: 'text-bison', price: 0.001, unit: 'per 1K tokens' }
      ],
      currency: 'USD',
      lastUpdate: new Date()
    }

    this.validateData(data)
    return data
  }
}

// 路由优化器类 (借鉴智能路由算法)
class RouteOptimizer {
  constructor (priceMonitor) {
    this.priceMonitor = priceMonitor
    this.optimizationRules = new Map()
    this.lastOptimization = null
  }

  // 添加优化规则
  addRule (modelType, rule) {
    this.optimizationRules.set(modelType, rule)
  }

  // 获取最优路由
  getOptimalRoute (modelType, constraints = {}) {
    const rule = this.optimizationRules.get(modelType)
    if (!rule) {
      return this.getDefaultRoute(modelType)
    }

    const candidates = this.priceMonitor.getProvidersForModel(modelType)
    if (candidates.length === 0) {
      return null
    }

    // 应用规则进行排序和选择
    const sorted = candidates.sort((a, b) => {
      const scoreA = this.calculateRouteScore(a, rule, constraints)
      const scoreB = this.calculateRouteScore(b, rule, constraints)
      return scoreA - scoreB // 低分优先 (低成本、高性能)
    })

    return sorted[0]
  }

  // 计算路由得分 (借鉴多目标优化算法)
  calculateRouteScore (provider, rule, constraints) {
    let score = 0

    // 价格权重
    if (rule.priceWeight > 0) {
      const price = this.priceMonitor.getCurrentPrice(provider.provider, provider.model)
      score += rule.priceWeight * (price || 1)
    }

    // 性能权重 (响应时间)
    if (rule.performanceWeight > 0) {
      const latency = provider.metadata?.avgLatency || 1000
      score += rule.performanceWeight * (latency / 1000)
    }

    // 可靠性权重 (成功率)
    if (rule.reliabilityWeight > 0) {
      const successRate = provider.metadata?.successRate || 0.95
      score += rule.reliabilityWeight * (1 - successRate)
    }

    // 约束检查
    if (constraints.maxPrice && provider.price > constraints.maxPrice) {
      score += 1000 // 大幅降低优先级
    }

    if (constraints.requiredRegion && provider.region !== constraints.requiredRegion) {
      score += 500 // 降低优先级
    }

    return score
  }

  // 获取默认路由
  getDefaultRoute (modelType) {
    const candidates = this.priceMonitor.getProvidersForModel(modelType)
    return candidates.length > 0 ? candidates[0] : null
  }

  // 批量优化路由
  optimizeRoutes () {
    const optimizations = {}

    for (const [modelType, rule] of this.optimizationRules) {
      const optimalRoute = this.getOptimalRoute(modelType)
      if (optimalRoute) {
        optimizations[modelType] = optimalRoute
      }
    }

    this.lastOptimization = new Date()
    return optimizations
  }
}

// 成本预测器类 (借鉴时间序列预测算法)
class CostPredictor {
  constructor (priceMonitor) {
    this.priceMonitor = priceMonitor
    this.predictionModels = new Map()
  }

  // 预测未来成本
  predictCosts (modelType, days = PRICE_CONFIG.predictionDays, confidence = 0.95) {
    const historicalData = this.getHistoricalPriceData(modelType)
    if (historicalData.length < 7) {
      return { error: 'Insufficient historical data for prediction' }
    }

    // 简单的线性回归预测 (可以扩展为更复杂的算法)
    const predictions = this.linearRegressionPrediction(historicalData, days)

    // 计算置信区间
    const confidenceInterval = this.calculateConfidenceInterval(historicalData, confidence)

    return {
      modelType,
      predictions,
      confidenceInterval,
      predictionDays: days,
      basedOnDays: historicalData.length,
      lastUpdated: new Date()
    }
  }

  // 获取历史价格数据
  getHistoricalPriceData (modelType) {
    const providers = this.priceMonitor.getProvidersForModel(modelType)
    const allData = []

    for (const provider of providers) {
      const priceData = this.priceMonitor.priceData.get(`${provider.provider}_${provider.model}`)
      if (priceData && priceData.priceHistory.length > 0) {
        allData.push(...priceData.priceHistory.map(p => ({
          timestamp: p.timestamp,
          price: p.price,
          provider: provider.provider,
          model: provider.model
        })))
      }
    }

    // 按时间排序并返回最近30天的数据
    return allData
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter(p => p.timestamp >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  }

  // 线性回归预测
  linearRegressionPrediction (data, days) {
    const predictions = []
    const now = Date.now()

    for (let i = 1; i <= days; i++) {
      const futureTime = now + i * 24 * 60 * 60 * 1000
      const predictedPrice = this.predictPriceAtTime(data, futureTime)
      predictions.push({
        date: new Date(futureTime),
        predictedPrice,
        day: i
      })
    }

    return predictions
  }

  // 在特定时间预测价格
  predictPriceAtTime (data, timestamp) {
    if (data.length < 2) return data[0]?.price || 0

    // 简单的线性回归
    const n = data.length
    const timestamps = data.map(p => p.timestamp.getTime())
    const prices = data.map(p => p.price)

    const sumX = timestamps.reduce((a, b) => a + b, 0)
    const sumY = prices.reduce((a, b) => a + b, 0)
    const sumXY = timestamps.reduce((sum, x, i) => sum + x * prices[i], 0)
    const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0)

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    return slope * timestamp + intercept
  }

  // 计算置信区间
  calculateConfidenceInterval (data, confidence) {
    if (data.length < 2) return { lower: 0, upper: 0 }

    const prices = data.map(p => p.price)
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / (prices.length - 1)
    const stdDev = Math.sqrt(variance)

    // t分布近似 (简化计算)
    const tValue = 2.0 // 95%置信区间近似值
    const margin = tValue * stdDev / Math.sqrt(prices.length)

    return {
      lower: mean - margin,
      upper: mean + margin,
      confidence,
      margin
    }
  }
}

// 主要价格监控管理器类
class PriceMonitorManager extends EventEmitter {
  constructor (options = {}) {
    super()

    this.priceData = new Map()
    this.collectors = new Map()
    this.routeOptimizer = new RouteOptimizer(this)
    this.costPredictor = new CostPredictor(this)
    this.config = { ...PRICE_CONFIG, ...options }

    // 初始化收集器
    this.initCollectors()

    // 初始化路由优化规则
    this.initOptimizationRules()

    // 启动监控循环
    this.startMonitoring()

    logInfo('价格监控管理器初始化完成')
  }

  // 初始化价格收集器
  initCollectors () {
    this.collectors.set('openai', new OpenAIPriceCollector('openai', {}))
    this.collectors.set('anthropic', new AnthropicPriceCollector('anthropic', {}))
    this.collectors.set('google', new GooglePriceCollector('google', {}))

    // 可以继续添加更多收集器
  }

  // 初始化路由优化规则
  initOptimizationRules () {
    // GPT模型优化规则
    this.routeOptimizer.addRule('gpt', {
      priceWeight: 0.7,
      performanceWeight: 0.2,
      reliabilityWeight: 0.1,
      constraints: {}
    })

    // Claude模型优化规则
    this.routeOptimizer.addRule('claude', {
      priceWeight: 0.8,
      performanceWeight: 0.1,
      reliabilityWeight: 0.1,
      constraints: {}
    })

    // 图像生成优化规则
    this.routeOptimizer.addRule('image', {
      priceWeight: 0.9,
      performanceWeight: 0.05,
      reliabilityWeight: 0.05,
      constraints: {}
    })
  }

  // 启动监控循环
  startMonitoring () {
    // 立即执行一次
    this.updatePrices()

    // 设置定时更新
    setInterval(() => {
      this.updatePrices()
    }, this.config.updateInterval)
  }

  // 更新所有价格
  async updatePrices () {
    logInfo('开始更新价格数据...')

    const updatePromises = []
    for (const [providerName, collector] of this.collectors) {
      updatePromises.push(this.updateProviderPrices(providerName, collector))
    }

    try {
      await Promise.allSettled(updatePromises)
      logInfo('价格数据更新完成')

      // 检查是否需要重新优化路由
      this.checkRouteOptimization()
    } catch (error) {
      logError(`价格更新过程中出现错误: ${error.message}`)
    }
  }

  // 更新单个提供商的价格
  async updateProviderPrices (providerName, collector) {
    try {
      const data = await collector.collectWithRetry()

      for (const model of data.models) {
        const key = `${providerName}_${model.name}`
        let priceData = this.priceData.get(key)

        if (!priceData) {
          priceData = new PriceData(providerName, model.name)
          this.priceData.set(key, priceData)
        }

        const oldPrice = priceData.currentPrice
        priceData.updatePrice(model.price)

        // 发出价格更新事件
        this.emit('priceUpdated', {
          provider: providerName,
          model: model.name,
          oldPrice,
          newPrice: model.price,
          timestamp: new Date()
        })

        // 检查是否有告警
        const alert = priceData.alerts[priceData.alerts.length - 1]
        if (alert && alert.timestamp > new Date(Date.now() - 60000)) { // 最近1分钟的告警
          this.emit('priceAlert', alert)
        }
      }
    } catch (error) {
      logError(`更新 ${providerName} 价格失败: ${error.message}`)
      this.emit('priceUpdateError', {
        provider: providerName,
        error: error.message,
        timestamp: new Date()
      })
    }
  }

  // 检查路由优化
  checkRouteOptimization () {
    const optimizations = this.routeOptimizer.optimizeRoutes()

    for (const [modelType, route] of Object.entries(optimizations)) {
      this.emit('routeOptimized', {
        modelType,
        optimalRoute: route,
        timestamp: new Date()
      })
    }
  }

  // 获取当前价格
  getCurrentPrice (provider, model) {
    const key = `${provider}_${model}`
    const priceData = this.priceData.get(key)
    return priceData ? priceData.currentPrice : null
  }

  // 获取价格历史
  getPriceHistory (provider, model, hours = 24) {
    const key = `${provider}_${model}`
    const priceData = this.priceData.get(key)

    if (!priceData) return []

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
    return priceData.priceHistory.filter(p => p.timestamp >= cutoff)
  }

  // 获取支持某个模型的提供商
  getProvidersForModel (modelType) {
    const providers = []

    for (const [key, priceData] of this.priceData) {
      if (priceData.currentPrice > 0) {
        const [provider, model] = key.split('_')

        // 检查模型类型匹配
        if (this.isModelTypeMatch(model, modelType)) {
          providers.push({
            provider,
            model,
            price: priceData.currentPrice,
            region: priceData.region,
            metadata: priceData.getStats()
          })
        }
      }
    }

    return providers
  }

  // 检查模型类型是否匹配
  isModelTypeMatch (model, modelType) {
    const typeMappings = {
      gpt: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
      claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      gemini: ['gemini-pro', 'gemini-pro-vision'],
      image: ['dall-e-3', 'midjourney-v5', 'stable-diffusion-xl'],
      speech: ['whisper-1', 'tts-1']
    }

    return typeMappings[modelType]?.some(m => model.includes(m)) || false
  }

  // 获取价格统计
  getPriceStats (provider = null, model = null) {
    const stats = []

    for (const [key, priceData] of this.priceData) {
      if ((!provider || key.startsWith(`${provider}_`)) &&
          (!model || key.endsWith(`_${model}`))) {
        const priceStats = priceData.getStats()
        if (priceStats) {
          stats.push({
            provider: priceData.provider,
            model: priceData.model,
            ...priceStats
          })
        }
      }
    }

    return stats
  }

  // 获取价格告警
  getPriceAlerts (hours = 24) {
    const alerts = []
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)

    for (const [key, priceData] of this.priceData) {
      for (const alert of priceData.alerts) {
        if (alert.timestamp >= cutoff) {
          alerts.push({
            provider: priceData.provider,
            model: priceData.model,
            ...alert
          })
        }
      }
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp)
  }

  // 获取最优路由
  getOptimalRoute (modelType, constraints = {}) {
    return this.routeOptimizer.getOptimalRoute(modelType, constraints)
  }

  // 获取成本预测
  getCostPrediction (modelType, days = 30) {
    return this.costPredictor.predictCosts(modelType, days)
  }

  // 导出价格数据
  async exportPriceData (format = 'json') {
    const data = {
      exportTime: new Date(),
      priceData: Array.from(this.priceData.entries()).map(([key, data]) => ({
        key,
        ...data,
        priceHistory: data.priceHistory.slice(-100) // 只导出最近100条记录
      })),
      stats: this.getPriceStats(),
      alerts: this.getPriceAlerts(168) // 最近7天的告警
    }

    if (format === 'csv') {
      return this.convertToCSV(data)
    }

    return JSON.stringify(data, null, 2)
  }

  // 转换为CSV格式
  convertToCSV (data) {
    const csvLines = ['Provider,Model,Current Price,Min Price,Max Price,Avg Price,Volatility,Changes,Trend,Last Update']

    for (const stat of data.stats) {
      csvLines.push([
        stat.provider,
        stat.model,
        stat.currentPrice,
        stat.minPrice,
        stat.maxPrice,
        stat.avgPrice,
        stat.volatility,
        stat.totalChanges,
        stat.trend,
        stat.lastUpdate
      ].join(','))
    }

    return csvLines.join('\n')
  }

  // 清理过期数据
  cleanup () {
    const cutoff = new Date(Date.now() - this.config.historyRetention)

    for (const [key, priceData] of this.priceData) {
      // 清理过期历史记录
      priceData.priceHistory = priceData.priceHistory.filter(p => p.timestamp >= cutoff)

      // 清理过期告警
      priceData.alerts = priceData.alerts.filter(a => a.timestamp >= cutoff)
    }

    logInfo('价格监控数据清理完成')
  }
}

// 日志函数
function logInfo (message) {
  console.log(`[PriceMonitor] ${new Date().toISOString()} - ${message}`)
}

function logWarn (message) {
  console.log(`[PriceMonitor WARN] ${new Date().toISOString()} - ${message}`)
}

function logError (message) {
  console.error(`[PriceMonitor ERROR] ${new Date().toISOString()} - ${message}`)
}

// 导出单例实例
const priceMonitorManager = new PriceMonitorManager()

module.exports = {
  PriceMonitorManager,
  PriceData,
  PriceCollector,
  OpenAIPriceCollector,
  AnthropicPriceCollector,
  GooglePriceCollector,
  RouteOptimizer,
  CostPredictor,
  priceMonitorManager
}
