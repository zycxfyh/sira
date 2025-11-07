const { EventEmitter } = require('events')

/**
 * 路由决策引擎
 * 借鉴OpenRouter的智能路由算法和Google的负载均衡策略
 * 综合考虑复杂度、性能、成本、可用性等多维度因素进行最优路由决策
 */
class RoutingDecisionEngine extends EventEmitter {
  constructor(options = {}) {
    super()

    this.configPath = options.configPath || require('path').join(__dirname, '../config/routing-decision.json')
    this.decisionHistory = []
    this.maxHistorySize = options.maxHistorySize || 1000

    // 决策权重配置
    this.weights = {
      performance: 0.3,    // 性能权重 (响应时间、成功率)
      cost: 0.25,          // 成本权重 (价格、预算)
      quality: 0.25,       // 质量权重 (模型能力匹配度)
      availability: 0.2    // 可用性权重 (当前负载、配额)
    }

    // 模型能力矩阵
    this.modelCapabilities = {
      'gpt-4': {
        maxTokens: 8192,
        strengths: ['reasoning', 'coding', 'analysis', 'math', 'creative'],
        weaknesses: ['speed'],
        costPerToken: 0.06,
        avgResponseTime: 3000, // ms
        successRate: 0.98
      },
      'gpt-3.5-turbo': {
        maxTokens: 4096,
        strengths: ['conversational', 'general', 'speed'],
        weaknesses: ['complex_reasoning', 'advanced_math'],
        costPerToken: 0.002,
        avgResponseTime: 1500,
        successRate: 0.99
      },
      'claude-2': {
        maxTokens: 100000,
        strengths: ['reasoning', 'creative', 'analysis', 'long_context'],
        weaknesses: ['coding', 'math'],
        costPerToken: 0.008,
        avgResponseTime: 2500,
        successRate: 0.97
      },
      'claude-instant': {
        maxTokens: 100000,
        strengths: ['conversational', 'speed', 'long_context'],
        weaknesses: ['complex_reasoning', 'coding'],
        costPerToken: 0.0008,
        avgResponseTime: 1000,
        successRate: 0.98
      },
      'gemini-pro': {
        maxTokens: 32768,
        strengths: ['multimodal', 'analysis', 'general'],
        weaknesses: ['coding', 'math'],
        costPerToken: 0.001,
        avgResponseTime: 2000,
        successRate: 0.96
      },
      'codellama-34b': {
        maxTokens: 16384,
        strengths: ['coding', 'technical', 'analysis'],
        weaknesses: ['creative', 'general_conversation'],
        costPerToken: 0.0008,
        avgResponseTime: 4000,
        successRate: 0.95
      },
      'mathstral-7b': {
        maxTokens: 32768,
        strengths: ['math', 'reasoning', 'analysis'],
        weaknesses: ['creative', 'coding'],
        costPerToken: 0.0006,
        avgResponseTime: 3500,
        successRate: 0.94
      }
    }

    // 用户偏好配置
    this.userPreferences = new Map()

    // 实时性能指标
    this.performanceMetrics = new Map()

    // A/B测试状态
    this.abTestAllocations = new Map()

    // 初始化
    this.initialize()
  }

  /**
   * 初始化决策引擎
   */
  async initialize() {
    try {
      // 加载配置
      await this.loadConfiguration()

      // 启动性能监控
      this.startPerformanceMonitoring()

      console.log(`✅ 路由决策引擎已初始化，支持 ${Object.keys(this.modelCapabilities).length} 个模型`)
    } catch (error) {
      console.error('❌ 路由决策引擎初始化失败:', error.message)
      throw error
    }
  }

  /**
   * 做出路由决策
   */
  async makeRoutingDecision(request, context = {}) {
    const decision = {
      model: null,
      provider: null,
      reasoning: [],
      confidence: 0,
      alternatives: [],
      metadata: {
        decisionId: this.generateDecisionId(),
        timestamp: new Date().toISOString(),
        processingTime: 0
      }
    }

    const startTime = Date.now()

    try {
      // 1. 提取决策上下文
      const decisionContext = await this.buildDecisionContext(request, context)

      // 2. 生成候选模型列表
      const candidates = this.generateCandidates(decisionContext)

      if (candidates.length === 0) {
        decision.reasoning.push('没有找到合适的候选模型')
        return decision
      }

      // 3. 评估每个候选者
      const evaluations = await this.evaluateCandidates(candidates, decisionContext)

      // 4. 选择最优模型
      const bestCandidate = this.selectOptimalCandidate(evaluations, decisionContext)

      if (bestCandidate) {
        decision.model = bestCandidate.model
        decision.provider = bestCandidate.provider
        decision.confidence = bestCandidate.score
        decision.reasoning = bestCandidate.reasoning

        // 添加备选方案
        const alternatives = evaluations
          .filter(e => e.model !== bestCandidate.model)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map(e => ({
            model: e.model,
            provider: e.provider,
            score: e.score,
            reasoning: e.reasoning.slice(0, 2)
          }))

        decision.alternatives = alternatives
      }

      // 5. 记录决策历史
      this.recordDecision(decision, decisionContext)

    } catch (error) {
      console.error('路由决策失败:', error)
      decision.reasoning.push(`决策过程出错: ${error.message}`)

      // 出错时使用默认模型
      decision.model = 'gpt-3.5-turbo'
      decision.provider = 'openai'
      decision.confidence = 0.5
    }

    decision.metadata.processingTime = Date.now() - startTime
    return decision
  }

  /**
   * 构建决策上下文
   */
  async buildDecisionContext(request, context) {
    const decisionContext = {
      userId: context.userId || 'anonymous',
      requestId: context.requestId || this.generateRequestId(),
      complexity: context.complexityAnalysis || {},
      taskType: context.taskType || 'general',
      userPreferences: {},
      performanceHistory: {},
      budget: context.budget || {},
      constraints: context.constraints || {},
      abTestAllocation: null
    }

    // 获取用户偏好
    decisionContext.userPreferences = this.userPreferences.get(decisionContext.userId) || {
      preferredModels: [],
      budgetLimit: null,
      speedPreference: 'balanced',
      qualityPreference: 'balanced'
    }

    // 获取性能历史
    decisionContext.performanceHistory = await this.getPerformanceHistory(decisionContext.userId)

    // 检查A/B测试分配
    decisionContext.abTestAllocation = this.abTestAllocations.get(decisionContext.userId)

    // 提取预算约束
    if (context.maxCost || context.budgetLimit) {
      decisionContext.budget = {
        maxCost: context.maxCost || context.budgetLimit,
        currency: 'USD'
      }
    }

    // 提取其他约束
    decisionContext.constraints = {
      maxTokens: context.maxTokens || request.max_tokens || 4096,
      requiredCapabilities: context.requiredCapabilities || [],
      excludedModels: context.excludedModels || [],
      preferredProvider: context.preferredProvider,
      ...decisionContext.constraints
    }

    return decisionContext
  }

  /**
   * 生成候选模型列表
   */
  generateCandidates(context) {
    const candidates = []

    // 基于复杂度推荐的模型
    const recommendedModels = context.complexity.recommendedModels || []

    // 用户偏好的模型
    const preferredModels = context.userPreferences.preferredModels || []

    // 所有可用模型
    const allModels = Object.keys(this.modelCapabilities)

    // 合并候选列表
    const candidateSet = new Set([
      ...recommendedModels,
      ...preferredModels,
      ...allModels.slice(0, 3) // 至少包含前3个通用模型
    ])

    // 应用约束条件
    for (const model of candidateSet) {
      const capability = this.modelCapabilities[model]
      if (!capability) continue

      // 检查token限制
      if (capability.maxTokens < context.constraints.maxTokens) {
        continue
      }

      // 检查排除列表
      if (context.constraints.excludedModels.includes(model)) {
        continue
      }

      // 检查预算约束
      if (context.budget.maxCost && capability.costPerToken > context.budget.maxCost) {
        continue
      }

      // 检查提供商偏好
      if (context.constraints.preferredProvider) {
        const provider = this.getProviderForModel(model)
        if (provider !== context.constraints.preferredProvider) {
          continue
        }
      }

      candidates.push({
        model,
        provider: this.getProviderForModel(model),
        capability
      })
    }

    return candidates
  }

  /**
   * 评估候选模型
   */
  async evaluateCandidates(candidates, context) {
    const evaluations = []

    for (const candidate of candidates) {
      const evaluation = {
        model: candidate.model,
        provider: candidate.provider,
        scores: {},
        totalScore: 0,
        reasoning: []
      }

      try {
        // 1. 性能评分
        evaluation.scores.performance = await this.scorePerformance(candidate, context)
        evaluation.reasoning.push(`性能评分: ${evaluation.scores.performance.toFixed(2)}`)

        // 2. 成本评分
        evaluation.scores.cost = this.scoreCost(candidate, context)
        evaluation.reasoning.push(`成本评分: ${evaluation.scores.cost.toFixed(2)}`)

        // 3. 质量评分
        evaluation.scores.quality = this.scoreQuality(candidate, context)
        evaluation.reasoning.push(`质量评分: ${evaluation.scores.quality.toFixed(2)}`)

        // 4. 可用性评分
        evaluation.scores.availability = await this.scoreAvailability(candidate, context)
        evaluation.reasoning.push(`可用性评分: ${evaluation.scores.availability.toFixed(2)}`)

        // 计算加权总分
        evaluation.totalScore = this.calculateWeightedScore(evaluation.scores)

        // 添加用户偏好加成
        if (context.userPreferences.preferredModels?.includes(candidate.model)) {
          evaluation.totalScore += 0.1
          evaluation.reasoning.push('用户偏好模型 +0.1')
        }

        // A/B测试强制选择
        if (context.abTestAllocation && context.abTestAllocation.model === candidate.model) {
          evaluation.totalScore += 1.0
          evaluation.reasoning.push('A/B测试指定模型 +1.0')
        }

      } catch (error) {
        console.error(`评估模型 ${candidate.model} 失败:`, error)
        evaluation.totalScore = 0
        evaluation.reasoning.push(`评估失败: ${error.message}`)
      }

      evaluations.push(evaluation)
    }

    return evaluations
  }

  /**
   * 性能评分
   */
  async scorePerformance(candidate, context) {
    const capability = candidate.capability
    let score = 0

    // 响应时间评分 (越快越好)
    const responseTime = await this.getCurrentResponseTime(candidate.model)
    const targetTime = context.userPreferences.speedPreference === 'fast' ? 2000 :
                      context.userPreferences.speedPreference === 'slow' ? 5000 : 3000

    if (responseTime <= targetTime * 0.5) score += 1.0
    else if (responseTime <= targetTime) score += 0.8
    else if (responseTime <= targetTime * 1.5) score += 0.6
    else score += 0.3

    // 成功率评分
    score += capability.successRate * 0.5

    // 历史性能评分
    const historyScore = await this.getHistoricalPerformanceScore(candidate.model, context.userId)
    score += historyScore * 0.3

    return Math.min(1.0, score / 1.8) // 归一化到0-1
  }

  /**
   * 成本评分
   */
  scoreCost(candidate, context) {
    const capability = candidate.capability

    // 如果有预算限制，基于预算打分
    if (context.budget.maxCost) {
      const costRatio = capability.costPerToken / context.budget.maxCost
      if (costRatio <= 0.1) return 1.0
      if (costRatio <= 0.5) return 0.8
      if (costRatio <= 1.0) return 0.5
      return 0.2
    }

    // 否则基于相对成本打分 (成本越低分数越高)
    const maxCost = Math.max(...Object.values(this.modelCapabilities).map(c => c.costPerToken))
    const normalizedCost = capability.costPerToken / maxCost
    return 1.0 - normalizedCost * 0.8 // 保留20%的最低分
  }

  /**
   * 质量评分
   */
  scoreQuality(candidate, context) {
    const capability = candidate.capability
    const taskType = context.complexity.taskType || context.taskType

    let score = 0

    // 任务匹配度
    if (capability.strengths.includes(taskType)) {
      score += 0.6
    } else if (!capability.weaknesses.includes(taskType)) {
      score += 0.4
    } else {
      score += 0.2
    }

    // 复杂度匹配度
    const complexity = context.complexity.complexity || 'medium'
    const complexityMatch = this.assessComplexityMatch(candidate.model, complexity)
    score += complexityMatch * 0.4

    return Math.min(1.0, score)
  }

  /**
   * 可用性评分
   */
  async scoreAvailability(candidate, context) {
    // 检查当前负载和配额状态
    const loadStatus = await this.getProviderLoadStatus(candidate.provider)
    const quotaStatus = await this.getProviderQuotaStatus(candidate.provider, context.userId)

    let score = 1.0

    // 负载惩罚
    if (loadStatus > 0.8) score *= 0.7 // 高负载
    else if (loadStatus > 0.6) score *= 0.9 // 中等负载

    // 配额惩罚
    if (quotaStatus > 0.9) score *= 0.5 // 配额即将用尽
    else if (quotaStatus > 0.7) score *= 0.8 // 配额紧张

    return score
  }

  /**
   * 计算加权总分
   */
  calculateWeightedScore(scores) {
    return (
      scores.performance * this.weights.performance +
      scores.cost * this.weights.cost +
      scores.quality * this.weights.quality +
      scores.availability * this.weights.availability
    )
  }

  /**
   * 选择最优候选者
   */
  selectOptimalCandidate(evaluations, context) {
    if (evaluations.length === 0) return null

    // 按总分排序
    evaluations.sort((a, b) => b.totalScore - a.totalScore)

    const best = evaluations[0]

    // 如果最佳分数太低，使用备选策略
    if (best.totalScore < 0.3) {
      console.warn(`最佳模型分数过低 (${best.totalScore})，使用备选策略`)
      return this.selectFallbackCandidate(evaluations, context)
    }

    return {
      model: best.model,
      provider: best.provider,
      score: best.totalScore,
      reasoning: best.reasoning
    }
  }

  /**
   * 备选候选者选择策略
   */
  selectFallbackCandidate(evaluations, context) {
    // 优先选择最便宜的可用模型
    const cheapest = evaluations.reduce((min, current) =>
      current.capability.costPerToken < min.capability.costPerToken ? current : min
    )

    return {
      model: cheapest.model,
      provider: cheapest.provider,
      score: 0.5,
      reasoning: ['使用最低成本备选方案']
    }
  }

  /**
   * 评估复杂度匹配度
   */
  assessComplexityMatch(model, complexity) {
    const modelTier = this.getModelTier(model)
    const complexityTier = this.getComplexityTier(complexity)

    if (modelTier >= complexityTier) return 1.0
    if (modelTier === complexityTier - 1) return 0.7
    return 0.4
  }

  /**
   * 获取模型等级
   */
  getModelTier(model) {
    const tiers = {
      'gpt-4': 5,
      'claude-2': 4,
      'codellama-34b': 4,
      'mathstral-7b': 4,
      'gpt-3.5-turbo': 3,
      'gemini-pro': 3,
      'claude-instant': 2
    }
    return tiers[model] || 1
  }

  /**
   * 获取复杂度等级
   */
  getComplexityTier(complexity) {
    const tiers = {
      'very_high': 5,
      'high': 4,
      'medium': 3,
      'low_medium': 2,
      'low': 1
    }
    return tiers[complexity] || 3
  }

  /**
   * 获取模型对应的提供商
   */
  getProviderForModel(model) {
    const providerMap = {
      'gpt-4': 'openai',
      'gpt-3.5-turbo': 'openai',
      'claude-2': 'anthropic',
      'claude-instant': 'anthropic',
      'gemini-pro': 'google',
      'codellama-34b': 'meta',
      'mathstral-7b': 'mistral'
    }
    return providerMap[model] || 'unknown'
  }

  /**
   * 获取当前响应时间
   */
  async getCurrentResponseTime(model) {
    // 从性能指标中获取，或使用默认值
    const metrics = this.performanceMetrics.get(model)
    return metrics?.avgResponseTime || this.modelCapabilities[model]?.avgResponseTime || 2000
  }

  /**
   * 获取历史性能评分
   */
  async getHistoricalPerformanceScore(model, userId) {
    // 简化的历史评分逻辑
    const userHistory = this.performanceMetrics.get(`${userId}_${model}`)
    return userHistory?.successRate || 0.5
  }

  /**
   * 获取提供商负载状态
   */
  async getProviderLoadStatus(provider) {
    // 模拟负载检测，实际应该从监控系统获取
    const loads = {
      'openai': Math.random() * 0.8,
      'anthropic': Math.random() * 0.7,
      'google': Math.random() * 0.6,
      'meta': Math.random() * 0.5,
      'mistral': Math.random() * 0.4
    }
    return loads[provider] || 0.5
  }

  /**
   * 获取提供商配额状态
   */
  async getProviderQuotaStatus(provider, userId) {
    // 模拟配额检测
    return Math.random() * 0.6 // 0-0.6表示配额使用率
  }

  /**
   * 获取性能历史
   */
  async getPerformanceHistory(userId) {
    // 简化的性能历史
    return {
      avgResponseTime: 2000,
      successRate: 0.95,
      preferredModels: [],
      totalRequests: 100
    }
  }

  /**
   * 记录决策历史
   */
  recordDecision(decision, context) {
    const historyEntry = {
      decisionId: decision.metadata.decisionId,
      timestamp: decision.metadata.timestamp,
      userId: context.userId,
      requestId: context.requestId,
      selectedModel: decision.model,
      selectedProvider: decision.provider,
      confidence: decision.confidence,
      complexity: context.complexity,
      taskType: context.taskType,
      processingTime: decision.metadata.processingTime,
      alternatives: decision.alternatives
    }

    this.decisionHistory.push(historyEntry)

    // 限制历史记录大小
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.shift()
    }

    // 触发决策记录事件
    this.emit('decisionRecorded', historyEntry)
  }

  /**
   * 获取决策统计
   */
  getDecisionStatistics(timeRange = '1h') {
    const now = Date.now()
    const rangeMs = this.parseTimeRange(timeRange)

    const recentDecisions = this.decisionHistory.filter(
      d => now - new Date(d.timestamp).getTime() < rangeMs
    )

    const stats = {
      totalDecisions: recentDecisions.length,
      avgConfidence: 0,
      avgProcessingTime: 0,
      modelDistribution: {},
      providerDistribution: {},
      taskTypeDistribution: {},
      complexityDistribution: {}
    }

    if (recentDecisions.length === 0) return stats

    let totalConfidence = 0
    let totalProcessingTime = 0

    for (const decision of recentDecisions) {
      totalConfidence += decision.confidence
      totalProcessingTime += decision.processingTime

      // 统计模型使用分布
      stats.modelDistribution[decision.selectedModel] =
        (stats.modelDistribution[decision.selectedModel] || 0) + 1

      stats.providerDistribution[decision.selectedProvider] =
        (stats.providerDistribution[decision.selectedProvider] || 0) + 1

      stats.taskTypeDistribution[decision.taskType] =
        (stats.taskTypeDistribution[decision.taskType] || 0) + 1

      if (decision.complexity?.complexity) {
        stats.complexityDistribution[decision.complexity.complexity] =
          (stats.complexityDistribution[decision.complexity.complexity] || 0) + 1
      }
    }

    stats.avgConfidence = totalConfidence / recentDecisions.length
    stats.avgProcessingTime = totalProcessingTime / recentDecisions.length

    return stats
  }

  /**
   * 解析时间范围
   */
  parseTimeRange(range) {
    const unit = range.slice(-1)
    const value = parseInt(range.slice(0, -1))

    const multipliers = {
      's': 1000,
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000
    }

    return value * (multipliers[unit] || 60 * 60 * 1000)
  }

  /**
   * 生成决策ID
   */
  generateDecisionId() {
    return `decision_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    // 每5分钟更新一次性能指标
    setInterval(() => {
      this.updatePerformanceMetrics()
    }, 5 * 60 * 1000)
  }

  /**
   * 更新性能指标
   */
  async updatePerformanceMetrics() {
    // 这里应该从实际的监控系统获取数据
    // 暂时使用模拟数据
    for (const [model, capability] of Object.entries(this.modelCapabilities)) {
      const currentMetrics = {
        avgResponseTime: capability.avgResponseTime * (0.8 + Math.random() * 0.4),
        successRate: capability.successRate * (0.95 + Math.random() * 0.05),
        lastUpdated: new Date().toISOString()
      }

      this.performanceMetrics.set(model, currentMetrics)
    }
  }

  /**
   * 加载配置
   */
  async loadConfiguration() {
    try {
      const fs = require('fs').promises
      const path = require('path')

      // 确保配置目录存在
      await fs.mkdir(path.dirname(this.configPath), { recursive: true })

      const data = await fs.readFile(this.configPath, 'utf8')
      const config = JSON.parse(data)

      if (config.userPreferences) {
        for (const [userId, prefs] of Object.entries(config.userPreferences)) {
          this.userPreferences.set(userId, prefs)
        }
      }

      if (config.weights) {
        this.weights = { ...this.weights, ...config.weights }
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载路由决策配置失败:', error.message)
      }
      // 使用默认配置
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration() {
    try {
      const fs = require('fs').promises
      const config = {
        userPreferences: Object.fromEntries(this.userPreferences),
        weights: this.weights,
        lastUpdated: new Date().toISOString()
      }

      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('保存路由决策配置失败:', error.message)
    }
  }
}

module.exports = { RoutingDecisionEngine }
