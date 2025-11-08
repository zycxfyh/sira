const crypto = require('crypto')
const fs = require('fs').promises
const path = require('path')

/**
 * A/B测试框架 - 借鉴Google Optimize和Optimizely设计理念
 * 支持多变量测试、流量分配、实时分析和自动化优化
 */
class ABTestManager {
  constructor (options = {}) {
    this.configPath = options.configPath || path.join(__dirname, '../config/ab-tests.json')
    this.resultsPath = options.resultsPath || path.join(__dirname, '../data/ab-test-results.json')
    this.tests = new Map()
    this.results = new Map()
    this.trafficAllocators = new Map()
    this.initialized = false
  }

  /**
   * 初始化A/B测试管理器
   */
  async initialize () {
    if (this.initialized) return

    try {
      // 加载测试配置
      await this.loadTestConfigurations()
      // 加载测试结果
      await this.loadTestResults()
      // 初始化流量分配器
      this.initializeTrafficAllocators()

      this.initialized = true
      console.log(`✅ A/B测试管理器已初始化，加载了 ${this.tests.size} 个测试配置`)
    } catch (error) {
      console.error('❌ A/B测试管理器初始化失败:', error.message)
      throw error
    }
  }

  /**
   * 创建A/B测试
   */
  async createTest (testConfig) {
    const testId = testConfig.id || this.generateTestId()

    if (this.tests.has(testId)) {
      throw new Error(`测试 ${testId} 已存在`)
    }

    const test = {
      id: testId,
      name: testConfig.name,
      description: testConfig.description,
      status: 'draft', // draft, running, paused, completed
      type: testConfig.type || 'ab', // ab, multivariate
      variants: testConfig.variants || [], // 测试变体
      target: testConfig.target, // 测试目标 (provider, model, parameter_set等)
      conditions: testConfig.conditions || {}, // 测试条件
      traffic: testConfig.traffic || 100, // 参与测试的流量百分比
      allocation: testConfig.allocation || 'even', // 流量分配策略: even, weighted, adaptive
      weights: testConfig.weights || {}, // 变体权重
      metrics: testConfig.metrics || ['response_time', 'cost', 'quality_score'], // 评估指标
      startDate: testConfig.startDate,
      endDate: testConfig.endDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 验证测试配置
    this.validateTestConfig(test)

    this.tests.set(testId, test)
    this.results.set(testId, this.initializeTestResults(test))

    await this.saveTestConfigurations()
    await this.saveTestResults()

    console.log(`✅ 创建A/B测试: ${testId} - ${test.name}`)
    return test
  }

  /**
   * 启动测试
   */
  async startTest (testId) {
    const test = this.tests.get(testId)
    if (!test) {
      throw new Error(`测试 ${testId} 不存在`)
    }

    if (test.status === 'running') {
      throw new Error(`测试 ${testId} 已在运行中`)
    }

    test.status = 'running'
    test.startDate = new Date().toISOString()
    test.updatedAt = new Date().toISOString()

    // 初始化流量分配器
    this.initializeTrafficAllocator(test)

    await this.saveTestConfigurations()
    console.log(`🚀 启动A/B测试: ${testId}`)
  }

  /**
   * 暂停测试
   */
  async pauseTest (testId) {
    const test = this.tests.get(testId)
    if (!test) {
      throw new Error(`测试 ${testId} 不存在`)
    }

    test.status = 'paused'
    test.updatedAt = new Date().toISOString()

    await this.saveTestConfigurations()
    console.log(`⏸️ 暂停A/B测试: ${testId}`)
  }

  /**
   * 停止测试
   */
  async stopTest (testId) {
    const test = this.tests.get(testId)
    if (!test) {
      throw new Error(`测试 ${testId} 不存在`)
    }

    test.status = 'completed'
    test.endDate = new Date().toISOString()
    test.updatedAt = new Date().toISOString()

    await this.saveTestConfigurations()
    console.log(`🛑 停止A/B测试: ${testId}`)
  }

  /**
   * 为用户分配测试变体
   */
  allocateVariant (testId, userId, context = {}) {
    const test = this.tests.get(testId)
    if (!test || test.status !== 'running') {
      return null
    }

    // 检查测试条件
    if (!this.checkTestConditions(test, context)) {
      return null
    }

    // 检查流量百分比
    if (Math.random() * 100 > test.traffic) {
      return null // 不参与测试
    }

    const allocator = this.trafficAllocators.get(testId)
    if (!allocator) {
      console.warn(`流量分配器不存在: ${testId}`)
      return null
    }

    const variantId = allocator.allocate(userId)
    return {
      testId,
      variantId,
      variant: test.variants.find(v => v.id === variantId)
    }
  }

  /**
   * 记录测试结果
   */
  async recordResult (testId, variantId, userId, metrics) {
    const test = this.tests.get(testId)
    if (!test) return

    const results = this.results.get(testId)
    if (!results) return

    const timestamp = new Date().toISOString()

    // 记录每个指标
    Object.entries(metrics).forEach(([metricName, value]) => {
      if (!results.metrics[metricName]) {
        results.metrics[metricName] = {}
      }

      if (!results.metrics[metricName][variantId]) {
        results.metrics[metricName][variantId] = []
      }

      results.metrics[metricName][variantId].push({
        userId,
        value,
        timestamp
      })
    })

    results.updatedAt = timestamp
    await this.saveTestResults()
  }

  /**
   * 获取测试结果分析
   */
  getTestAnalysis (testId) {
    const test = this.tests.get(testId)
    const results = this.results.get(testId)

    if (!test || !results) {
      return null
    }

    const analysis = {
      testId,
      testName: test.name,
      status: test.status,
      variants: test.variants,
      metrics: {},
      winner: null,
      confidence: 0,
      sampleSize: 0
    }

    // 分析每个指标
    Object.entries(results.metrics).forEach(([metricName, variantData]) => {
      analysis.metrics[metricName] = {}

      Object.entries(variantData).forEach(([variantId, dataPoints]) => {
        const values = dataPoints.map(d => d.value)
        const count = values.length

        analysis.metrics[metricName][variantId] = {
          count,
          mean: this.calculateMean(values),
          median: this.calculateMedian(values),
          std: this.calculateStd(values),
          min: Math.min(...values),
          max: Math.max(...values)
        }

        analysis.sampleSize += count
      })

      // 简单的统计显著性检验 (简化版)
      const variants = Object.keys(analysis.metrics[metricName])
      if (variants.length >= 2) {
        const controlVariant = variants[0]
        const testVariant = variants[1]

        const controlData = variantData[controlVariant] || []
        const testData = variantData[testVariant] || []

        if (controlData.length > 10 && testData.length > 10) {
          const controlMean = this.calculateMean(controlData.map(d => d.value))
          const testMean = this.calculateMean(testData.map(d => d.value))

          // 计算提升百分比
          const improvement = ((testMean - controlMean) / controlMean) * 100
          analysis.metrics[metricName].improvement = improvement
          analysis.metrics[metricName].significance = this.calculateSignificance(controlData, testData)
        }
      }
    })

    // 确定获胜者 (基于综合评分)
    analysis.winner = this.determineWinner(analysis)

    return analysis
  }

  /**
   * 获取所有测试概览
   */
  getTestsOverview () {
    const overview = []

    for (const [testId, test] of this.tests) {
      const results = this.results.get(testId)
      const analysis = this.getTestAnalysis(testId)

      overview.push({
        id: testId,
        name: test.name,
        status: test.status,
        type: test.type,
        variants: test.variants.length,
        traffic: test.traffic,
        startDate: test.startDate,
        endDate: test.endDate,
        totalSamples: analysis ? analysis.sampleSize : 0,
        winner: analysis ? analysis.winner : null,
        createdAt: test.createdAt
      })
    }

    return overview
  }

  /**
   * 删除测试
   */
  async deleteTest (testId) {
    if (!this.tests.has(testId)) {
      throw new Error(`测试 ${testId} 不存在`)
    }

    this.tests.delete(testId)
    this.results.delete(testId)
    this.trafficAllocators.delete(testId)

    await this.saveTestConfigurations()
    await this.saveTestResults()

    console.log(`🗑️ 删除A/B测试: ${testId}`)
  }

  // ==================== 私有方法 ====================

  /**
   * 生成测试ID
   */
  generateTestId () {
    return `ab_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  }

  /**
   * 验证测试配置
   */
  validateTestConfig (test) {
    if (!test.name) throw new Error('测试名称不能为空')
    if (!test.variants || test.variants.length < 2) throw new Error('至少需要2个测试变体')
    if (!test.target) throw new Error('测试目标不能为空')

    // 验证变体
    test.variants.forEach(variant => {
      if (!variant.id) throw new Error('变体ID不能为空')
      if (!variant.name) throw new Error('变体名称不能为空')
    })

    // 检查变体ID唯一性
    const variantIds = test.variants.map(v => v.id)
    if (new Set(variantIds).size !== variantIds.length) {
      throw new Error('变体ID必须唯一')
    }
  }

  /**
   * 初始化测试结果
   */
  initializeTestResults (test) {
    return {
      testId: test.id,
      metrics: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 初始化流量分配器
   */
  initializeTrafficAllocators () {
    for (const [testId, test] of this.tests) {
      if (test.status === 'running') {
        this.initializeTrafficAllocator(test)
      }
    }
  }

  /**
   * 初始化单个测试的流量分配器
   */
  initializeTrafficAllocator (test) {
    const allocator = new TrafficAllocator(test)
    this.trafficAllocators.set(test.id, allocator)
  }

  /**
   * 检查测试条件
   */
  checkTestConditions (test, context) {
    const conditions = test.conditions

    if (conditions.userId && !context.userId?.match(new RegExp(conditions.userId))) {
      return false
    }

    if (conditions.provider && context.provider !== conditions.provider) {
      return false
    }

    if (conditions.model && context.model !== conditions.model) {
      return false
    }

    if (conditions.taskType && context.taskType !== conditions.taskType) {
      return false
    }

    return true
  }

  /**
   * 加载测试配置
   */
  async loadTestConfigurations () {
    try {
      const data = await fs.readFile(this.configPath, 'utf8')
      const configs = JSON.parse(data)

      for (const [testId, config] of Object.entries(configs)) {
        this.tests.set(testId, config)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载A/B测试配置失败:', error.message)
      }
      // 如果文件不存在，创建空的Map
    }
  }

  /**
   * 保存测试配置
   */
  async saveTestConfigurations () {
    const configs = {}
    for (const [testId, test] of this.tests) {
      configs[testId] = test
    }

    await fs.mkdir(path.dirname(this.configPath), { recursive: true })
    await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2))
  }

  /**
   * 加载测试结果
   */
  async loadTestResults () {
    try {
      const data = await fs.readFile(this.resultsPath, 'utf8')
      const results = JSON.parse(data)

      for (const [testId, result] of Object.entries(results)) {
        this.results.set(testId, result)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载A/B测试结果失败:', error.message)
      }
    }
  }

  /**
   * 保存测试结果
   */
  async saveTestResults () {
    const results = {}
    for (const [testId, result] of this.results) {
      results[testId] = result
    }

    await fs.mkdir(path.dirname(this.resultsPath), { recursive: true })
    await fs.writeFile(this.resultsPath, JSON.stringify(results, null, 2))
  }

  /**
   * 计算平均值
   */
  calculateMean (values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  /**
   * 计算中位数
   */
  calculateMedian (values) {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  }

  /**
   * 计算标准差
   */
  calculateStd (values) {
    const mean = this.calculateMean(values)
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2))
    return Math.sqrt(this.calculateMean(squaredDiffs))
  }

  /**
   * 计算统计显著性 (简化版t检验)
   */
  calculateSignificance (groupA, groupB) {
    const valuesA = groupA.map(d => d.value)
    const valuesB = groupB.map(d => d.value)

    const meanA = this.calculateMean(valuesA)
    const meanB = this.calculateMean(valuesB)
    const stdA = this.calculateStd(valuesA)
    const stdB = this.calculateStd(valuesB)

    const nA = valuesA.length
    const nB = valuesB.length

    // t统计量
    const t = Math.abs(meanA - meanB) / Math.sqrt((stdA * stdA / nA) + (stdB * stdB / nB))

    // 简化的p值估计 (近似)
    const df = nA + nB - 2
    const pValue = this.approximatePValue(t, df)

    return {
      tStatistic: t,
      pValue,
      significant: pValue < 0.05,
      confidence: Math.max(0, Math.min(100, (1 - pValue) * 100))
    }
  }

  /**
   * 近似p值计算
   */
  approximatePValue (t, df) {
    // 简化的t分布累积分布函数近似
    const x = t / Math.sqrt(df)
    const p = 1 / (1 + Math.exp(-x * 1.5))
    return 2 * (1 - p) // 双尾检验
  }

  /**
   * 确定测试获胜者
   */
  determineWinner (analysis) {
    if (!analysis.metrics || Object.keys(analysis.metrics).length === 0) {
      return null
    }

    // 简单的获胜者确定逻辑 (可以扩展为更复杂的算法)
    const variants = new Set()
    Object.values(analysis.metrics).forEach(metric => {
      Object.keys(metric).forEach(variantId => {
        if (variantId !== 'improvement' && variantId !== 'significance') {
          variants.add(variantId)
        }
      })
    })

    if (variants.size < 2) return null

    const variantScores = {}

    // 为每个变体计算综合得分
    for (const variantId of variants) {
      let score = 0
      let metricCount = 0

      Object.entries(analysis.metrics).forEach(([metricName, metricData]) => {
        const variantData = metricData[variantId]
        if (variantData && variantData.count > 10) { // 至少10个样本
          // 对于响应时间，越低越好；对于其他指标，越高越好
          const value = metricName === 'response_time'
            ? -variantData.mean : variantData.mean
          score += value
          metricCount++
        }
      })

      variantScores[variantId] = metricCount > 0 ? score / metricCount : 0
    }

    // 找到得分最高的变体
    let winner = null
    let maxScore = -Infinity

    Object.entries(variantScores).forEach(([variantId, score]) => {
      if (score > maxScore) {
        maxScore = score
        winner = variantId
      }
    })

    return winner
  }
}

/**
 * 流量分配器 - 支持多种分配策略
 */
class TrafficAllocator {
  constructor (test) {
    this.test = test
    this.userAssignments = new Map() // userId -> variantId
    this.strategy = test.allocation || 'even'
    this.weights = test.weights || {}
  }

  /**
   * 为用户分配变体
   */
  allocate (userId) {
    // 如果用户已被分配，返回之前的分配
    if (this.userAssignments.has(userId)) {
      return this.userAssignments.get(userId)
    }

    const variantId = this.allocateNew(userId)
    this.userAssignments.set(userId, variantId)
    return variantId
  }

  /**
   * 为新用户分配变体
   */
  allocateNew (userId) {
    const variants = this.test.variants
    const variantIds = variants.map(v => v.id)

    switch (this.strategy) {
      case 'even':
        return this.allocateEvenly(userId, variantIds)
      case 'weighted':
        return this.allocateWeighted(userId, variantIds)
      case 'adaptive':
        return this.allocateAdaptively(userId, variantIds)
      default:
        return this.allocateEvenly(userId, variantIds)
    }
  }

  /**
   * 均匀分配
   */
  allocateEvenly (userId, variantIds) {
    const hash = crypto.createHash('md5').update(userId).digest('hex')
    const index = parseInt(hash.substring(0, 8), 16) % variantIds.length
    return variantIds[index]
  }

  /**
   * 加权分配
   */
  allocateWeighted (userId, variantIds) {
    const totalWeight = variantIds.reduce((sum, id) => sum + (this.weights[id] || 1), 0)
    const hash = crypto.createHash('md5').update(userId).digest('hex')
    const random = parseInt(hash.substring(0, 8), 16) / 0xFFFFFFFF

    let cumulativeWeight = 0
    for (const variantId of variantIds) {
      cumulativeWeight += (this.weights[variantId] || 1) / totalWeight
      if (random <= cumulativeWeight) {
        return variantId
      }
    }

    return variantIds[0] // fallback
  }

  /**
   * 自适应分配 (简化为均匀分配，实际可以基于实时性能)
   */
  allocateAdaptively (userId, variantIds) {
    // 实际实现中可以基于实时性能指标调整权重
    // 这里简化为均匀分配
    return this.allocateEvenly(userId, variantIds)
  }
}

module.exports = { ABTestManager, TrafficAllocator }
