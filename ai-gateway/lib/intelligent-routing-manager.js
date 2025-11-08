const { EventEmitter } = require('events')
const { ComplexityAnalyzer } = require('./complexity-analyzer')
const { RoutingDecisionEngine } = require('./routing-decision-engine')

/**
 * 智能路由管理器
 * 借鉴OpenRouter的智能路由系统和Netflix的动态路由策略
 * 提供复杂度感知的智能模型路由服务
 */
class IntelligentRoutingManager extends EventEmitter {
  constructor (options = {}) {
    super()

    this.configPath = options.configPath || require('path').join(__dirname, '../config/intelligent-routing.json')
    this.enableAdaptiveLearning = options.enableAdaptiveLearning !== false
    this.cacheEnabled = options.cacheEnabled !== false
    this.cacheTTL = options.cacheTTL || 300000 // 5分钟缓存

    // 核心组件
    this.complexityAnalyzer = null
    this.routingDecisionEngine = null

    // 路由缓存
    this.routeCache = new Map()

    // 路由策略
    this.routingStrategies = {
      performance_first: {
        name: '性能优先',
        weights: { performance: 0.4, cost: 0.2, quality: 0.3, availability: 0.1 }
      },
      cost_first: {
        name: '成本优先',
        weights: { performance: 0.2, cost: 0.4, quality: 0.3, availability: 0.1 }
      },
      quality_first: {
        name: '质量优先',
        weights: { performance: 0.2, cost: 0.2, quality: 0.4, availability: 0.2 }
      },
      balanced: {
        name: '均衡策略',
        weights: { performance: 0.25, cost: 0.25, quality: 0.25, availability: 0.25 }
      },
      adaptive: {
        name: '自适应策略',
        weights: null // 动态调整
      }
    }

    // 当前活跃策略
    this.activeStrategy = 'balanced'

    // 路由统计
    this.routingStats = {
      totalRequests: 0,
      cacheHits: 0,
      avgComplexityAnalysisTime: 0,
      avgDecisionTime: 0,
      strategyDistribution: {},
      modelDistribution: {},
      lastUpdated: new Date().toISOString()
    }

    this.initialized = false
  }

  /**
   * 初始化智能路由管理器
   */
  async initialize () {
    if (this.initialized) return

    try {
      // 初始化复杂度分析器
      this.complexityAnalyzer = new ComplexityAnalyzer()

      // 初始化路由决策引擎
      this.routingDecisionEngine = new RoutingDecisionEngine()
      await this.routingDecisionEngine.initialize()

      // 设置事件监听
      this.setupEventListeners()

      // 启动自适应学习
      if (this.enableAdaptiveLearning) {
        this.startAdaptiveLearning()
      }

      // 启动缓存清理
      if (this.cacheEnabled) {
        this.startCacheCleanup()
      }

      // 加载配置
      await this.loadConfiguration()

      this.initialized = true
      console.log(`✅ 智能路由管理器已初始化，当前策略: ${this.routingStrategies[this.activeStrategy].name}`)
    } catch (error) {
      console.error('❌ 智能路由管理器初始化失败:', error.message)
      throw error
    }
  }

  /**
   * 执行智能路由
   */
  async routeRequest (request, context = {}) {
    const routingResult = {
      success: false,
      model: null,
      provider: null,
      routingStrategy: this.activeStrategy,
      analysis: null,
      decision: null,
      reasoning: [],
      metadata: {
        requestId: context.requestId || this.generateRequestId(),
        timestamp: new Date().toISOString(),
        processingTime: 0,
        cacheHit: false
      }
    }

    const startTime = Date.now()

    try {
      this.routingStats.totalRequests++

      // 1. 检查缓存
      const cacheKey = this.generateCacheKey(request, context)
      if (this.cacheEnabled) {
        const cachedResult = this.getCachedRoute(cacheKey)
        if (cachedResult) {
          routingResult.success = true
          routingResult.model = cachedResult.model
          routingResult.provider = cachedResult.provider
          routingResult.metadata.cacheHit = true
          routingResult.reasoning = cachedResult.reasoning
          this.routingStats.cacheHits++

          routingResult.metadata.processingTime = Date.now() - startTime
          return routingResult
        }
      }

      // 2. 复杂度分析
      const analysisStart = Date.now()
      const complexityAnalysis = this.complexityAnalyzer.analyzeComplexity(request)
      const analysisTime = Date.now() - analysisStart

      routingResult.analysis = complexityAnalysis
      routingResult.reasoning.push(`复杂度分析: ${complexityAnalysis.complexity} (${analysisTime}ms)`)

      // 更新统计
      this.updateAnalysisStats(analysisTime)

      // 3. 路由决策
      const decisionStart = Date.now()

      // 构建决策上下文
      const decisionContext = {
        ...context,
        complexityAnalysis,
        taskType: complexityAnalysis.taskType,
        routingStrategy: this.activeStrategy,
        strategyWeights: this.routingStrategies[this.activeStrategy].weights
      }

      // 如果使用自适应策略，动态调整权重
      if (this.activeStrategy === 'adaptive') {
        decisionContext.strategyWeights = this.calculateAdaptiveWeights(context)
      }

      const decision = await this.routingDecisionEngine.makeRoutingDecision(request, decisionContext)
      const decisionTime = Date.now() - decisionStart

      routingResult.decision = decision
      routingResult.reasoning.push(`路由决策: ${decision.model} (${decisionTime}ms)`)

      // 更新统计
      this.updateDecisionStats(decisionTime, decision.model)

      // 4. 设置最终结果
      if (decision.model && decision.provider) {
        routingResult.success = true
        routingResult.model = decision.model
        routingResult.provider = decision.provider
        routingResult.reasoning.push(...decision.reasoning)

        // 缓存结果
        if (this.cacheEnabled) {
          this.setCachedRoute(cacheKey, {
            model: decision.model,
            provider: decision.provider,
            reasoning: decision.reasoning,
            expiresAt: Date.now() + this.cacheTTL
          })
        }
      } else {
        routingResult.reasoning.push('无法确定合适的路由')
      }
    } catch (error) {
      console.error('智能路由执行失败:', error)
      routingResult.reasoning.push(`路由失败: ${error.message}`)

      // 失败时使用默认路由
      routingResult.success = true
      routingResult.model = 'gpt-3.5-turbo'
      routingResult.provider = 'openai'
      routingResult.reasoning.push('使用默认路由 (gpt-3.5-turbo)')
    }

    routingResult.metadata.processingTime = Date.now() - startTime

    // 触发路由完成事件
    this.emit('routingCompleted', routingResult)

    return routingResult
  }

  /**
   * 批量路由请求
   */
  async routeBatchRequests (requests, context = {}) {
    const results = []

    // 并发处理，但限制并发数
    const batchSize = Math.min(requests.length, 10)
    const batches = []

    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize))
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (request) => {
        const requestContext = {
          ...context,
          requestId: request.id || this.generateRequestId(),
          batchId: context.batchId || this.generateBatchId()
        }

        return await this.routeRequest(request, requestContext)
      })

      const batchResults = await Promise.allSettled(batchPromises)

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          // 处理失败的请求
          results.push({
            success: false,
            error: result.reason.message,
            metadata: {
              requestId: 'unknown',
              timestamp: new Date().toISOString()
            }
          })
        }
      }
    }

    return results
  }

  /**
   * 设置路由策略
   */
  async setRoutingStrategy (strategyName) {
    if (!this.routingStrategies[strategyName]) {
      throw new Error(`未知的路由策略: ${strategyName}`)
    }

    const oldStrategy = this.activeStrategy
    this.activeStrategy = strategyName

    // 清除缓存（策略改变时）
    if (this.cacheEnabled) {
      this.routeCache.clear()
    }

    // 保存配置
    await this.saveConfiguration()

    console.log(`🔄 路由策略已切换: ${this.routingStrategies[oldStrategy].name} -> ${this.routingStrategies[strategyName].name}`)

    this.emit('strategyChanged', {
      oldStrategy,
      newStrategy: strategyName,
      timestamp: new Date().toISOString()
    })

    return {
      success: true,
      strategy: strategyName,
      name: this.routingStrategies[strategyName].name,
      weights: this.routingStrategies[strategyName].weights
    }
  }

  /**
   * 获取当前路由策略
   */
  getCurrentStrategy () {
    return {
      strategy: this.activeStrategy,
      name: this.routingStrategies[this.activeStrategy].name,
      weights: this.routingStrategies[this.activeStrategy].weights,
      description: this.getStrategyDescription(this.activeStrategy)
    }
  }

  /**
   * 获取路由统计信息
   */
  getRoutingStatistics (timeRange = '1h') {
    const decisionStats = this.routingDecisionEngine.getDecisionStatistics(timeRange)

    return {
      ...this.routingStats,
      decisionStats,
      cacheHitRate: this.routingStats.totalRequests > 0
        ? (this.routingStats.cacheHits / this.routingStats.totalRequests) : 0,
      activeStrategy: this.activeStrategy,
      strategyName: this.routingStrategies[this.activeStrategy].name,
      cacheSize: this.routeCache.size,
      lastUpdated: new Date().toISOString()
    }
  }

  /**
   * 获取路由建议
   */
  getRoutingSuggestions (context = {}) {
    const suggestions = []

    // 基于当前统计提供建议
    const stats = this.getRoutingStatistics()

    // 缓存命中率建议
    if (stats.cacheHitRate < 0.3) {
      suggestions.push({
        type: 'cache_optimization',
        priority: 'medium',
        message: '缓存命中率较低，考虑调整缓存TTL或启用更智能的缓存策略',
        action: 'increase_cache_ttl'
      })
    }

    // 策略建议
    const modelDistribution = stats.decisionStats.modelDistribution
    const totalDecisions = stats.decisionStats.totalDecisions

    if (totalDecisions > 10) {
      const mostUsedModel = Object.entries(modelDistribution)
        .sort(([, a], [, b]) => b - a)[0]?.[0]

      if (mostUsedModel && modelDistribution[mostUsedModel] / totalDecisions > 0.8) {
        suggestions.push({
          type: 'strategy_optimization',
          priority: 'high',
          message: `单个模型(${mostUsedModel})使用率过高，考虑调整路由策略以提高多样性`,
          action: 'diversify_routing'
        })
      }
    }

    // 性能建议
    if (stats.avgDecisionTime > 500) {
      suggestions.push({
        type: 'performance_optimization',
        priority: 'medium',
        message: '路由决策时间较长，考虑优化复杂度分析算法或启用缓存',
        action: 'optimize_performance'
      })
    }

    return suggestions
  }

  /**
   * 更新用户偏好
   */
  async updateUserPreferences (userId, preferences) {
    if (!this.routingDecisionEngine) {
      throw new Error('路由决策引擎未初始化')
    }

    // 合并现有偏好
    const existingPrefs = this.routingDecisionEngine.userPreferences.get(userId) || {}
    const updatedPrefs = { ...existingPrefs, ...preferences }

    this.routingDecisionEngine.userPreferences.set(userId, updatedPrefs)

    // 保存配置
    await this.routingDecisionEngine.saveConfiguration()

    console.log(`✅ 用户偏好已更新: ${userId}`)

    this.emit('userPreferencesUpdated', {
      userId,
      preferences: updatedPrefs,
      timestamp: new Date().toISOString()
    })

    return updatedPrefs
  }

  /**
   * 获取用户偏好
   */
  getUserPreferences (userId) {
    if (!this.routingDecisionEngine) {
      return null
    }

    return this.routingDecisionEngine.userPreferences.get(userId) || {
      preferredModels: [],
      budgetLimit: null,
      speedPreference: 'balanced',
      qualityPreference: 'balanced'
    }
  }

  /**
   * 强制刷新缓存
   */
  clearRouteCache () {
    const cacheSize = this.routeCache.size
    this.routeCache.clear()

    console.log(`🧹 路由缓存已清理: ${cacheSize} 条记录`)

    this.emit('cacheCleared', {
      clearedEntries: cacheSize,
      timestamp: new Date().toISOString()
    })

    return { success: true, clearedEntries: cacheSize }
  }

  // ==================== 私有方法 ====================

  /**
   * 设置事件监听
   */
  setupEventListeners () {
    // 监听决策引擎的事件
    this.routingDecisionEngine.on('decisionRecorded', (decision) => {
      this.emit('decisionRecorded', decision)
    })

    // 监听复杂度分析事件
    if (this.complexityAnalyzer && typeof this.complexityAnalyzer.on === 'function') {
      this.complexityAnalyzer.on('analysisCompleted', (analysis) => {
        this.emit('analysisCompleted', analysis)
      })
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey (request, context) {
    const keyData = {
      content: this.extractCacheableContent(request),
      userId: context.userId || 'anonymous',
      strategy: this.activeStrategy,
      constraints: context.constraints || {}
    }

    const crypto = require('crypto')
    const hash = crypto.createHash('md5')
    hash.update(JSON.stringify(keyData))
    return hash.digest('hex')
  }

  /**
   * 提取可缓存的内容
   */
  extractCacheableContent (request) {
    if (typeof request === 'string') {
      return request.substring(0, 1000) // 只缓存前1000字符
    }

    if (request.messages && Array.isArray(request.messages)) {
      // 只缓存最后一条用户消息
      const lastUserMessage = request.messages
        .filter(m => m.role === 'user')
        .pop()

      return lastUserMessage ? lastUserMessage.content.substring(0, 1000) : ''
    }

    return JSON.stringify(request).substring(0, 1000)
  }

  /**
   * 获取缓存的路由
   */
  getCachedRoute (cacheKey) {
    const cached = this.routeCache.get(cacheKey)
    if (!cached) return null

    if (Date.now() > cached.expiresAt) {
      this.routeCache.delete(cacheKey)
      return null
    }

    return cached
  }

  /**
   * 设置缓存的路由
   */
  setCachedRoute (cacheKey, routeData) {
    this.routeCache.set(cacheKey, routeData)
  }

  /**
   * 启动缓存清理
   */
  startCacheCleanup () {
    // 每分钟清理过期缓存
    setInterval(() => {
      const now = Date.now()
      let cleaned = 0

      for (const [key, cached] of this.routeCache.entries()) {
        if (now > cached.expiresAt) {
          this.routeCache.delete(key)
          cleaned++
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 清理过期缓存: ${cleaned} 条`)
      }
    }, 60000)
  }

  /**
   * 计算自适应权重
   */
  calculateAdaptiveWeights (context) {
    // 基于上下文动态调整权重
    const weights = { ...this.routingStrategies.balanced.weights }

    // 如果用户指定了速度偏好
    if (context.userPreferences?.speedPreference === 'fast') {
      weights.performance += 0.1
      weights.cost -= 0.05
      weights.quality -= 0.05
    }

    // 如果有预算限制
    if (context.budget?.maxCost) {
      weights.cost += 0.15
      weights.performance -= 0.1
      weights.quality -= 0.05
    }

    // 如果是复杂任务
    if (context.complexityAnalysis?.complexity === 'high' ||
        context.complexityAnalysis?.complexity === 'very_high') {
      weights.quality += 0.1
      weights.performance -= 0.1
    }

    // 归一化权重
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
    Object.keys(weights).forEach(key => {
      weights[key] = weights[key] / totalWeight
    })

    return weights
  }

  /**
   * 启动自适应学习
   */
  startAdaptiveLearning () {
    // 每小时分析路由效果并调整策略
    setInterval(() => {
      this.performAdaptiveLearning()
    }, 60 * 60 * 1000) // 1小时
  }

  /**
   * 执行自适应学习
   */
  async performAdaptiveLearning () {
    try {
      const stats = this.getRoutingStatistics('24h') // 分析过去24小时的数据

      if (stats.totalRequests < 100) {
        return // 数据不足，跳过学习
      }

      // 分析当前的路由效果
      const suggestions = this.getRoutingSuggestions()

      // 如果有高优先级建议，自动调整策略
      const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high')

      if (highPrioritySuggestions.length > 0) {
        const suggestion = highPrioritySuggestions[0]

        if (suggestion.action === 'diversify_routing') {
          // 切换到均衡策略以提高多样性
          await this.setRoutingStrategy('balanced')
          console.log('🤖 自适应学习: 检测到模型使用过于集中，切换到均衡策略')
        }
      }

      this.emit('adaptiveLearningCompleted', {
        stats,
        suggestions,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('自适应学习执行失败:', error)
    }
  }

  /**
   * 更新分析统计
   */
  updateAnalysisStats (analysisTime) {
    const alpha = 0.1 // 指数移动平均的平滑因子
    this.routingStats.avgComplexityAnalysisTime =
      this.routingStats.avgComplexityAnalysisTime * (1 - alpha) + analysisTime * alpha
  }

  /**
   * 更新决策统计
   */
  updateDecisionStats (decisionTime, selectedModel) {
    const alpha = 0.1
    this.routingStats.avgDecisionTime =
      this.routingStats.avgDecisionTime * (1 - alpha) + decisionTime * alpha

    // 更新策略使用分布
    this.routingStats.strategyDistribution[this.activeStrategy] =
      (this.routingStats.strategyDistribution[this.activeStrategy] || 0) + 1

    // 更新模型使用分布
    this.routingStats.modelDistribution[selectedModel] =
      (this.routingStats.modelDistribution[selectedModel] || 0) + 1

    this.routingStats.lastUpdated = new Date().toISOString()
  }

  /**
   * 获取策略描述
   */
  getStrategyDescription (strategy) {
    const descriptions = {
      performance_first: '优先选择响应速度最快的模型',
      cost_first: '优先选择成本最低的模型',
      quality_first: '优先选择质量最好的模型',
      balanced: '在性能、成本、质量之间取得平衡',
      adaptive: '根据实时数据动态调整路由策略'
    }

    return descriptions[strategy] || '未知策略'
  }

  /**
   * 生成请求ID
   */
  generateRequestId () {
    return `req_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`
  }

  /**
   * 生成批次ID
   */
  generateBatchId () {
    return `batch_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`
  }

  /**
   * 加载配置
   */
  async loadConfiguration () {
    try {
      const fs = require('fs').promises
      const data = await fs.readFile(this.configPath, 'utf8')
      const config = JSON.parse(data)

      if (config.activeStrategy) {
        this.activeStrategy = config.activeStrategy
      }

      if (config.routingStrategies) {
        this.routingStrategies = { ...this.routingStrategies, ...config.routingStrategies }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载智能路由配置失败:', error.message)
      }
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration () {
    try {
      const fs = require('fs').promises
      const config = {
        activeStrategy: this.activeStrategy,
        routingStrategies: this.routingStrategies,
        lastUpdated: new Date().toISOString()
      }

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('保存智能路由配置失败:', error.message)
    }
  }
}

module.exports = { IntelligentRoutingManager }
