/**
 * Sira AI网关 - 负载测试工具
 * 基于Apache JMeter、Locust、k6的最佳实践，实现高性能负载测试
 */

const EventEmitter = require('events')
const axios = require('axios')
const { performance } = require('perf_hooks')

/**
 * 负载测试工具
 * 支持多种负载模式：恒定负载、阶梯负载、峰值负载、随机负载
 */
class LoadTestingTool extends EventEmitter {
  constructor(options = {}) {
    super()

    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8080',
      maxConcurrency: options.maxConcurrency || 100,
      rampUpTime: options.rampUpTime || 60, // 秒
      testDuration: options.testDuration || 300, // 秒
      cooldownTime: options.cooldownTime || 30, // 秒
      requestTimeout: options.requestTimeout || 30000, // 毫秒
      enableMetrics: options.enableMetrics !== false,
      ...options
    }

    // 测试状态
    this.isRunning = false
    this.startTime = null
    this.endTime = null

    // 负载配置
    this.loadProfiles = {
      constant: this.constantLoad.bind(this),
      ramp: this.rampLoad.bind(this),
      spike: this.spikeLoad.bind(this),
      random: this.randomLoad.bind(this),
      stress: this.stressLoad.bind(this)
    }

    // 统计数据
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errors: new Map(),
      throughput: [],
      concurrency: [],
      timestamps: []
    }

    // HTTP客户端配置
    this.httpClient = axios.create({
      baseURL: this.options.baseUrl,
      timeout: this.options.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sira-Load-Tester/1.0'
      }
    })

    // 测试场景
    this.testScenarios = new Map()
  }

  /**
   * 初始化负载测试工具
   */
  async initialize() {
    console.log('🔧 初始化负载测试工具')
    this.setupDefaultScenarios()
  }

  /**
   * 设置默认测试场景
   */
  setupDefaultScenarios() {
    // AI聊天场景
    this.addScenario('ai_chat', {
      name: 'AI聊天负载测试',
      endpoint: '/chat/completions',
      method: 'POST',
      payload: {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: '请写一段关于人工智能的短文' }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      headers: {
        'Authorization': 'Bearer sk-test-key',
        'Content-Type': 'application/json'
      }
    })

    // 参数管理场景
    this.addScenario('parameter_management', {
      name: '参数管理负载测试',
      endpoint: '/parameters/optimize',
      method: 'POST',
      payload: {
        parameters: {
          temperature: 0.8,
          top_p: 0.9,
          frequency_penalty: 0.1,
          presence_penalty: 0.1
        },
        task_type: 'creative'
      }
    })

    // 批量处理场景
    this.addScenario('batch_processing', {
      name: '批量处理负载测试',
      endpoint: '/batch-processing/batches',
      method: 'POST',
      payload: {
        requests: Array.from({ length: 10 }, (_, i) => ({
          id: `req_${i}`,
          model: 'gpt-3.5-turbo',
          prompt: `请生成第${i + 1}个测试文本`
        }))
      }
    })

    // 流式响应场景
    this.addScenario('streaming', {
      name: '流式响应负载测试',
      endpoint: '/streaming/streams',
      method: 'POST',
      payload: {
        userId: 'test_user',
        options: {
          maxConnections: 5
        }
      }
    })
  }

  /**
   * 添加测试场景
   */
  addScenario(name, config) {
    this.testScenarios.set(name, {
      name: config.name || name,
      endpoint: config.endpoint,
      method: config.method || 'GET',
      payload: config.payload || {},
      headers: config.headers || {},
      setup: config.setup,
      teardown: config.teardown
    })
  }

  /**
   * 运行负载测试
   */
  async runLoadTest(config) {
    const {
      scenario = 'ai_chat',
      loadProfile = 'ramp',
      targetRPS = 10,
      duration = this.options.testDuration,
      maxConcurrency = this.options.maxConcurrency
    } = config

    if (this.isRunning) {
      throw new Error('负载测试已在运行中')
    }

    this.isRunning = true
    this.startTime = Date.now()
    this.resetStats()

    console.log(`🚀 开始负载测试: ${scenario} (${loadProfile}模式)`)

    this.emit('testStart', {
      scenario,
      loadProfile,
      targetRPS,
      duration,
      maxConcurrency
    })

    try {
      const scenarioConfig = this.testScenarios.get(scenario)
      if (!scenarioConfig) {
        throw new Error(`测试场景不存在: ${scenario}`)
      }

      const loadFunction = this.loadProfiles[loadProfile]
      if (!loadFunction) {
        throw new Error(`负载模式不存在: ${loadProfile}`)
      }

      // 执行负载测试
      await loadFunction({
        scenario: scenarioConfig,
        targetRPS,
        duration,
        maxConcurrency
      })

      this.endTime = Date.now()

      const results = this.generateReport()

      this.emit('testComplete', results)

      return results

    } catch (error) {
      console.error('负载测试失败:', error.message)
      this.emit('testError', error)
      throw error
    } finally {
      this.isRunning = false
    }
  }

  /**
   * 恒定负载模式
   */
  async constantLoad(config) {
    const { scenario, targetRPS, duration, maxConcurrency } = config
    const interval = 1000 / targetRPS // 请求间隔(毫秒)
    const endTime = Date.now() + (duration * 1000)

    console.log(`📊 恒定负载模式: ${targetRPS} RPS, 持续 ${duration} 秒`)

    const workers = []
    for (let i = 0; i < Math.min(maxConcurrency, targetRPS); i++) {
      workers.push(this.createWorker(scenario, interval, endTime))
    }

    await Promise.all(workers)
  }

  /**
   * 阶梯负载模式
   */
  async rampLoad(config) {
    const { scenario, targetRPS, duration, maxConcurrency } = config
    const rampUpTime = this.options.rampUpTime * 1000
    const endTime = Date.now() + (duration * 1000)

    console.log(`📈 阶梯负载模式: 0 -> ${targetRPS} RPS, 持续 ${duration} 秒`)

    let currentRPS = 0
    const rpsIncrement = targetRPS / (rampUpTime / 1000)

    while (Date.now() < endTime && currentRPS < targetRPS) {
      currentRPS = Math.min(currentRPS + rpsIncrement, targetRPS)
      const interval = 1000 / currentRPS

      const workers = []
      for (let i = 0; i < Math.min(maxConcurrency, Math.ceil(currentRPS)); i++) {
        workers.push(this.createWorker(scenario, interval, Math.min(endTime, Date.now() + 1000)))
      }

      await Promise.all(workers)
    }
  }

  /**
   * 峰值负载模式
   */
  async spikeLoad(config) {
    const { scenario, targetRPS, duration, maxConcurrency } = config
    const spikeDuration = 10 // 10秒峰值
    const normalRPS = targetRPS * 0.2
    const endTime = Date.now() + (duration * 1000)

    console.log(`⚡ 峰值负载模式: 峰值 ${targetRPS} RPS, 持续 ${duration} 秒`)

    while (Date.now() < endTime) {
      const isSpike = Math.random() < 0.3 // 30%时间处于峰值
      const currentRPS = isSpike ? targetRPS : normalRPS
      const interval = 1000 / currentRPS

      const spikeEndTime = Math.min(endTime, Date.now() + (isSpike ? spikeDuration * 1000 : 5000))

      const workers = []
      for (let i = 0; i < Math.min(maxConcurrency, Math.ceil(currentRPS)); i++) {
        workers.push(this.createWorker(scenario, interval, spikeEndTime))
      }

      await Promise.all(workers)
    }
  }

  /**
   * 随机负载模式
   */
  async randomLoad(config) {
    const { scenario, targetRPS, duration, maxConcurrency } = config
    const endTime = Date.now() + (duration * 1000)

    console.log(`🎲 随机负载模式: 平均 ${targetRPS} RPS, 持续 ${duration} 秒`)

    while (Date.now() < endTime) {
      // 正态分布随机RPS
      const variation = (Math.random() - 0.5) * 0.5 // ±50%变化
      const currentRPS = Math.max(1, targetRPS * (1 + variation))
      const interval = 1000 / currentRPS

      const workers = []
      for (let i = 0; i < Math.min(maxConcurrency, Math.ceil(currentRPS)); i++) {
        workers.push(this.createWorker(scenario, interval, Math.min(endTime, Date.now() + 1000)))
      }

      await Promise.all(workers)
    }
  }

  /**
   * 压力测试模式
   */
  async stressLoad(config) {
    const { scenario, targetRPS, duration, maxConcurrency } = config
    const endTime = Date.now() + (duration * 1000)
    let currentConcurrency = 1

    console.log(`💥 压力测试模式: 递增并发数直到 ${maxConcurrency}, 持续 ${duration} 秒`)

    while (Date.now() < endTime && currentConcurrency <= maxConcurrency) {
      const interval = 1000 / targetRPS

      const workers = []
      for (let i = 0; i < currentConcurrency; i++) {
        workers.push(this.createWorker(scenario, interval, Math.min(endTime, Date.now() + 5000)))
      }

      await Promise.all(workers)

      // 每5秒增加并发数
      currentConcurrency = Math.min(currentConcurrency * 2, maxConcurrency)
    }
  }

  /**
   * 创建工作线程
   */
  createWorker(scenario, interval, endTime) {
    return new Promise(async (resolve) => {
      const timer = setInterval(async () => {
        if (Date.now() >= endTime) {
          clearInterval(timer)
          resolve()
          return
        }

        try {
          await this.makeRequest(scenario)
        } catch (error) {
          // 静默处理请求错误，继续测试
        }
      }, interval)
    })
  }

  /**
   * 发送HTTP请求
   */
  async makeRequest(scenario) {
    const startTime = performance.now()

    try {
      const response = await this.httpClient.request({
        url: scenario.endpoint,
        method: scenario.method,
        data: scenario.payload,
        headers: scenario.headers
      })

      const responseTime = performance.now() - startTime

      this.recordSuccess(responseTime, response.status)

    } catch (error) {
      const responseTime = performance.now() - startTime
      this.recordFailure(responseTime, error)
    }
  }

  /**
   * 记录成功请求
   */
  recordSuccess(responseTime, statusCode) {
    this.stats.totalRequests++
    this.stats.successfulRequests++
    this.stats.totalResponseTime += responseTime

    if (responseTime < this.stats.minResponseTime) {
      this.stats.minResponseTime = responseTime
    }
    if (responseTime > this.stats.maxResponseTime) {
      this.stats.maxResponseTime = responseTime
    }

    this.stats.responseTimes.push(responseTime)

    // 记录吞吐量（每秒请求数）
    const timestamp = Date.now()
    this.stats.throughput.push({
      timestamp,
      rps: 1,
      responseTime
    })

    this.emit('requestSuccess', {
      responseTime,
      statusCode,
      timestamp
    })
  }

  /**
   * 记录失败请求
   */
  recordFailure(responseTime, error) {
    this.stats.totalRequests++
    this.stats.failedRequests++
    this.stats.totalResponseTime += responseTime

    const errorType = error.code || error.response?.status || 'UNKNOWN'
    this.stats.errors.set(errorType, (this.stats.errors.get(errorType) || 0) + 1)

    this.emit('requestFailure', {
      responseTime,
      error: error.message,
      type: errorType
    })
  }

  /**
   * 重置统计数据
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      responseTimes: [],
      errors: new Map(),
      throughput: [],
      concurrency: [],
      timestamps: []
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    const duration = (this.endTime - this.startTime) / 1000 // 秒
    const avgResponseTime = this.stats.totalRequests > 0 ?
      this.stats.totalResponseTime / this.stats.totalRequests : 0
    const successRate = this.stats.totalRequests > 0 ?
      (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(2) : 0
    const avgRPS = this.stats.totalRequests / duration

    // 计算响应时间分布
    const responseTimePercentiles = this.calculatePercentiles(this.stats.responseTimes, [50, 95, 99])

    // 计算吞吐量趋势
    const throughputTrend = this.calculateThroughputTrend()

    return {
      summary: {
        duration,
        totalRequests: this.stats.totalRequests,
        successfulRequests: this.stats.successfulRequests,
        failedRequests: this.stats.failedRequests,
        successRate: `${successRate}%`,
        averageRPS: avgRPS.toFixed(2),
        averageResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        minResponseTime: this.stats.totalRequests > 0 ? `${this.stats.minResponseTime.toFixed(2)}ms` : 'N/A',
        maxResponseTime: this.stats.totalRequests > 0 ? `${this.stats.maxResponseTime.toFixed(2)}ms` : 'N/A'
      },
      responseTimeDistribution: {
        p50: responseTimePercentiles[50] !== undefined ? `${responseTimePercentiles[50].toFixed(2)}ms` : 'N/A',
        p95: responseTimePercentiles[95] !== undefined ? `${responseTimePercentiles[95].toFixed(2)}ms` : 'N/A',
        p99: responseTimePercentiles[99] !== undefined ? `${responseTimePercentiles[99].toFixed(2)}ms` : 'N/A'
      },
      errors: Object.fromEntries(this.stats.errors),
      throughput: throughputTrend,
      recommendations: this.generateRecommendations(successRate, avgResponseTime, avgRPS)
    }
  }

  /**
   * 计算百分位数
   */
  calculatePercentiles(values, percentiles) {
    if (values.length === 0) return {}

    const sorted = [...values].sort((a, b) => a - b)
    const result = {}

    percentiles.forEach(p => {
      const index = Math.ceil((p / 100) * sorted.length) - 1
      result[p] = sorted[Math.max(0, Math.min(index, sorted.length - 1))]
    })

    return result
  }

  /**
   * 计算吞吐量趋势
   */
  calculateThroughputTrend() {
    if (this.stats.throughput.length === 0) return []

    // 按时间窗口聚合吞吐量
    const windowSize = 5000 // 5秒窗口
    const windows = new Map()

    this.stats.throughput.forEach(point => {
      const window = Math.floor(point.timestamp / windowSize) * windowSize
      if (!windows.has(window)) {
        windows.set(window, { count: 0, totalTime: 0 })
      }
      const data = windows.get(window)
      data.count++
      data.totalTime += point.responseTime
    })

    return Array.from(windows.entries())
      .sort(([a], [b]) => a - b)
      .map(([timestamp, data]) => ({
        timestamp,
        rps: data.count / (windowSize / 1000),
        avgResponseTime: data.totalTime / data.count
      }))
  }

  /**
   * 生成测试建议
   */
  generateRecommendations(successRate, avgResponseTime, avgRPS) {
    const recommendations = []

    if (parseFloat(successRate) < 95) {
      recommendations.push('成功率低于95%，建议检查系统稳定性或增加资源')
    }

    if (avgResponseTime > 1000) {
      recommendations.push('平均响应时间超过1秒，建议优化性能或增加缓存')
    }

    if (avgRPS < 10) {
      recommendations.push('平均RPS较低，建议检查系统配置或网络延迟')
    }

    if (this.stats.errors.size > 0) {
      const topError = Array.from(this.stats.errors.entries())
        .sort(([,a], [,b]) => b - a)[0]
      recommendations.push(`最常见的错误: ${topError[0]} (${topError[1]}次)`)
    }

    return recommendations
  }

  /**
   * 停止负载测试
   */
  stop() {
    this.isRunning = false
    console.log('🛑 负载测试已停止')
    this.emit('testStopped')
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      stats: {
        totalRequests: this.stats.totalRequests,
        successfulRequests: this.stats.successfulRequests,
        failedRequests: this.stats.failedRequests,
        currentRPS: this.stats.totalRequests / Math.max(1, (Date.now() - (this.startTime || Date.now())) / 1000)
      }
    }
  }
}

module.exports = { LoadTestingTool }
