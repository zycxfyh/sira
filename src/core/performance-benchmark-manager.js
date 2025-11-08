/**
 * Sira AI网关 - 性能基准测试管理模块
 * 提供全面的AI模型性能评估系统
 */

const EventEmitter = require('events')
const fs = require('fs').promises
const path = require('path')
const { performance } = require('perf_hooks')

class PerformanceBenchmarkManager extends EventEmitter {
  constructor (options = {}) {
    super()

    this.options = {
      resultsDir: options.resultsDir || path.join(process.cwd(), 'benchmark-results'),
      maxConcurrency: options.maxConcurrency || 5,
      defaultIterations: options.defaultIterations || 5,
      timeout: options.timeout || 30000, // 30秒超时
      enableDetailedLogging: options.enableDetailedLogging || false,
      ...options
    }

    // 测试结果存储
    this.results = new Map()
    this.activeTests = new Set()

    // 指标计算器
    this.metricsCalculator = new MetricsCalculator()

    // 测试执行器
    this.testExecutor = new TestExecutor(this.options)

    this.initializeResultsDirectory()
    this.emit('initialized')
    console.log('✅ 性能基准测试管理模块初始化完成')
  }

  /**
     * 初始化结果目录
     */
  async initializeResultsDirectory () {
    try {
      await fs.mkdir(this.options.resultsDir, { recursive: true })
      console.log(`📁 基准测试结果目录: ${this.options.resultsDir}`)
    } catch (error) {
      console.error('创建结果目录失败:', error)
    }
  }

  /**
     * 运行基准测试
     */
  async runBenchmark (config) {
    const testId = this.generateTestId()
    const startTime = performance.now()

    try {
      this.activeTests.add(testId)

      const testConfig = this.normalizeConfig(config)
      console.log(`🚀 开始基准测试: ${testId}`)

      // 验证配置
      this.validateBenchmarkConfig(testConfig)

      // 执行测试
      const results = await this.executeBenchmark(testConfig, testId)

      // 分析结果
      const analysis = this.analyzeResults(results, testConfig)

      // 保存结果
      const testResult = {
        testId,
        config: testConfig,
        results,
        analysis,
        metadata: {
          startTime: new Date(startTime).toISOString(),
          endTime: new Date().toISOString(),
          duration: performance.now() - startTime,
          version: '1.0.0'
        }
      }

      await this.saveResults(testResult)
      this.results.set(testId, testResult)

      this.emit('benchmarkCompleted', testResult)
      console.log(`✅ 基准测试完成: ${testId}`)

      return testResult
    } catch (error) {
      console.error(`❌ 基准测试失败: ${testId}`, error)
      this.emit('benchmarkFailed', { testId, error: error.message })
      throw error
    } finally {
      this.activeTests.delete(testId)
    }
  }

  /**
     * 生成测试ID
     */
  generateTestId () {
    return `benchmark_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
     * 标准化配置
     */
  normalizeConfig (config) {
    return {
      name: config.name || `Benchmark ${new Date().toLocaleString()}`,
      models: config.models || ['gpt-4', 'deepseek-chat'],
      tasks: config.tasks || ['simple_qa'],
      iterations: config.iterations || this.options.defaultIterations,
      concurrency: config.concurrency || this.options.maxConcurrency,
      timeout: config.timeout || this.options.timeout,
      parameters: config.parameters || {},
      includeQualityAssessment: config.includeQualityAssessment !== false,
      generateReport: config.generateReport !== false,
      ...config
    }
  }

  /**
     * 验证基准测试配置
     */
  validateBenchmarkConfig (config) {
    if (!config.models || config.models.length === 0) {
      throw new Error('至少需要指定一个模型')
    }

    if (!config.tasks || config.tasks.length === 0) {
      throw new Error('至少需要指定一个测试任务')
    }

    if (config.iterations < 1) {
      throw new Error('迭代次数必须大于0')
    }

    if (config.concurrency < 1 || config.concurrency > 20) {
      throw new Error('并发数必须在1-20之间')
    }
  }

  /**
     * 执行基准测试
     */
  async executeBenchmark (config, testId) {
    const results = {
      models: {},
      tasks: {},
      summary: {}
    }

    // 为每个模型执行测试
    for (const model of config.models) {
      console.log(`🤖 测试模型: ${model}`)
      results.models[model] = await this.testExecutor.runModelTests(
        model,
        config.tasks,
        config.iterations,
        config,
        testId
      )
    }

    // 按任务聚合结果
    for (const task of config.tasks) {
      results.tasks[task] = this.aggregateTaskResults(results.models, task)
    }

    // 生成汇总统计
    results.summary = this.generateSummaryStats(results, config)

    return results
  }

  /**
     * 聚合任务结果
     */
  aggregateTaskResults (modelResults, task) {
    const taskResults = {
      model_performance: {},
      averages: {},
      best_performer: null,
      worst_performer: null
    }

    for (const [model, results] of Object.entries(modelResults)) {
      if (results.tasks && results.tasks[task]) {
        taskResults.model_performance[model] = results.tasks[task]
      }
    }

    // 计算平均值
    const metrics = ['response_time', 'tokens_used', 'cost', 'quality_score']
    for (const metric of metrics) {
      const values = Object.values(taskResults.model_performance)
        .map(r => r[metric])
        .filter(v => v !== undefined && v !== null)

      if (values.length > 0) {
        taskResults.averages[metric] = {
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          std: this.calculateStd(values)
        }
      }
    }

    // 找出最佳和最差表现者
    const performances = Object.entries(taskResults.model_performance)
    if (performances.length > 0) {
      taskResults.best_performer = performances.reduce((best, [model, perf]) =>
        perf.response_time < best.perf.response_time ? { model, perf } : best,
      { model: performances[0][0], perf: performances[0][1] }
      )

      taskResults.worst_performer = performances.reduce((worst, [model, perf]) =>
        perf.response_time > worst.perf.response_time ? { model, perf } : worst,
      { model: performances[0][0], perf: performances[0][1] }
      )
    }

    return taskResults
  }

  /**
     * 生成汇总统计
     */
  generateSummaryStats (results, config) {
    const summary = {
      total_tests: 0,
      total_duration: 0,
      average_response_time: 0,
      average_cost: 0,
      average_quality: 0,
      cost_efficiency_rankings: [],
      performance_rankings: [],
      quality_rankings: []
    }

    const allPerformances = []

    for (const [model, modelResults] of Object.entries(results.models)) {
      if (modelResults.summary) {
        summary.total_tests += modelResults.summary.total_requests || 0
        summary.total_duration += modelResults.summary.total_duration || 0

        allPerformances.push({
          model,
          response_time: modelResults.summary.average_response_time,
          cost: modelResults.summary.average_cost,
          quality: modelResults.summary.average_quality_score,
          cost_efficiency: modelResults.summary.cost_per_token
        })
      }
    }

    if (allPerformances.length > 0) {
      summary.average_response_time = allPerformances.reduce((sum, p) => sum + p.response_time, 0) / allPerformances.length
      summary.average_cost = allPerformances.reduce((sum, p) => sum + p.cost, 0) / allPerformances.length
      summary.average_quality = allPerformances.reduce((sum, p) => sum + (p.quality || 0), 0) / allPerformances.length

      // 生成排名
      summary.performance_rankings = allPerformances
        .sort((a, b) => a.response_time - b.response_time)
        .map(p => ({ model: p.model, value: p.response_time }))

      summary.cost_efficiency_rankings = allPerformances
        .filter(p => p.cost_efficiency)
        .sort((a, b) => a.cost_efficiency - b.cost_efficiency)
        .map(p => ({ model: p.model, value: p.cost_efficiency }))

      summary.quality_rankings = allPerformances
        .filter(p => p.quality)
        .sort((a, b) => b.quality - a.quality)
        .map(p => ({ model: p.model, value: p.quality }))
    }

    return summary
  }

  /**
     * 分析结果
     */
  analyzeResults (results, config) {
    return {
      performance_analysis: this.analyzePerformance(results),
      cost_analysis: this.analyzeCost(results),
      quality_analysis: this.analyzeQuality(results),
      recommendations: this.generateRecommendations(results, config)
    }
  }

  /**
     * 性能分析
     */
  analyzePerformance (results) {
    const analysis = {
      fastest_model: null,
      slowest_model: null,
      response_time_distribution: {},
      stability_metrics: {}
    }

    const modelTimes = {}

    for (const [model, modelResults] of Object.entries(results.models)) {
      if (modelResults.summary && modelResults.summary.average_response_time) {
        modelTimes[model] = modelResults.summary.average_response_time
      }
    }

    if (Object.keys(modelTimes).length > 0) {
      const sorted = Object.entries(modelTimes).sort((a, b) => a[1] - b[1])
      analysis.fastest_model = { model: sorted[0][0], time: sorted[0][1] }
      analysis.slowest_model = { model: sorted[sorted.length - 1][0], time: sorted[sorted.length - 1][1] }

      // 计算响应时间分布
      const times = Object.values(modelTimes)
      analysis.response_time_distribution = {
        mean: times.reduce((a, b) => a + b, 0) / times.length,
        median: this.calculateMedian(times),
        p95: this.calculatePercentile(times, 95),
        p99: this.calculatePercentile(times, 99)
      }
    }

    return analysis
  }

  /**
     * 成本分析
     */
  analyzeCost (results) {
    const analysis = {
      cheapest_model: null,
      most_expensive_model: null,
      cost_distribution: {},
      cost_efficiency_scores: {}
    }

    const modelCosts = {}

    for (const [model, modelResults] of Object.entries(results.models)) {
      if (modelResults.summary && modelResults.summary.average_cost) {
        modelCosts[model] = modelResults.summary.average_cost
      }
    }

    if (Object.keys(modelCosts).length > 0) {
      const sorted = Object.entries(modelCosts).sort((a, b) => a[1] - b[1])
      analysis.cheapest_model = { model: sorted[0][0], cost: sorted[0][1] }
      analysis.most_expensive_model = { model: sorted[sorted.length - 1][0], cost: sorted[sorted.length - 1][1] }

      // 计算成本效率分数
      for (const [model, cost] of Object.entries(modelCosts)) {
        const quality = results.models[model]?.summary?.average_quality_score || 1
        analysis.cost_efficiency_scores[model] = quality / cost
      }
    }

    return analysis
  }

  /**
     * 质量分析
     */
  analyzeQuality (results) {
    const analysis = {
      highest_quality_model: null,
      lowest_quality_model: null,
      quality_distribution: {},
      consistency_scores: {}
    }

    const modelQualities = {}

    for (const [model, modelResults] of Object.entries(results.models)) {
      if (modelResults.summary && modelResults.summary.average_quality_score) {
        modelQualities[model] = modelResults.summary.average_quality_score
      }
    }

    if (Object.keys(modelQualities).length > 0) {
      const sorted = Object.entries(modelQualities).sort((a, b) => b[1] - a[1])
      analysis.highest_quality_model = { model: sorted[0][0], quality: sorted[0][1] }
      analysis.lowest_quality_model = { model: sorted[sorted.length - 1][0], quality: sorted[sorted.length - 1][1] }

      // 计算质量分布
      const qualities = Object.values(modelQualities)
      analysis.quality_distribution = {
        mean: qualities.reduce((a, b) => a + b, 0) / qualities.length,
        median: this.calculateMedian(qualities),
        std: this.calculateStd(qualities)
      }
    }

    return analysis
  }

  /**
     * 生成推荐
     */
  generateRecommendations (results, config) {
    const recommendations = {
      best_overall: null,
      best_for_speed: null,
      best_for_cost: null,
      best_for_quality: null,
      suggestions: []
    }

    const modelScores = {}

    for (const [model, modelResults] of Object.entries(results.models)) {
      if (modelResults.summary) {
        const summary = modelResults.summary
        modelScores[model] = {
          speed_score: summary.average_response_time ? 1 / summary.average_response_time : 0,
          cost_score: summary.average_cost ? 1 / summary.average_cost : 0,
          quality_score: summary.average_quality_score || 0
        }
      }
    }

    // 计算综合得分 (归一化后平均)
    for (const [model, scores] of Object.entries(modelScores)) {
      const normalizedScores = this.normalizeScores(scores)
      modelScores[model].overall_score = (normalizedScores.speed_score + normalizedScores.cost_score + normalizedScores.quality_score) / 3
    }

    if (Object.keys(modelScores).length > 0) {
      // 最佳综合表现
      const bestOverall = Object.entries(modelScores)
        .sort((a, b) => b[1].overall_score - a[1].overall_score)[0]
      recommendations.best_overall = bestOverall[0]

      // 最佳速度
      const bestSpeed = Object.entries(modelScores)
        .sort((a, b) => b[1].speed_score - a[1].speed_score)[0]
      recommendations.best_for_speed = bestSpeed[0]

      // 最佳成本效益
      const bestCost = Object.entries(modelScores)
        .sort((a, b) => b[1].cost_score - a[1].cost_score)[0]
      recommendations.best_for_cost = bestCost[0]

      // 最佳质量
      const bestQuality = Object.entries(modelScores)
        .sort((a, b) => b[1].quality_score - a[1].quality_score)[0]
      recommendations.best_for_quality = bestQuality[0]
    }

    // 生成建议
    recommendations.suggestions = this.generateSuggestions(results, config)

    return recommendations
  }

  /**
     * 生成建议
     */
  generateSuggestions (results, config) {
    const suggestions = []

    // 基于性能的建议
    const perfAnalysis = this.analyzePerformance(results)
    if (perfAnalysis.fastest_model && perfAnalysis.slowest_model) {
      const speedup = perfAnalysis.slowest_model.time / perfAnalysis.fastest_model.time
      if (speedup > 2) {
        suggestions.push(`考虑使用 ${perfAnalysis.fastest_model.model} 替代 ${perfAnalysis.slowest_model.model} 可提升 ${Math.round((speedup - 1) * 100)}% 的响应速度`)
      }
    }

    // 基于成本的建议
    const costAnalysis = this.analyzeCost(results)
    if (costAnalysis.cheapest_model && costAnalysis.most_expensive_model) {
      const savings = costAnalysis.most_expensive_model.cost / costAnalysis.cheapest_model.cost
      if (savings > 1.5) {
        suggestions.push(`切换到 ${costAnalysis.cheapest_model.model} 可节省 ${Math.round((savings - 1) * 100)}% 的成本`)
      }
    }

    // 基于质量的建议
    const qualityAnalysis = this.analyzeQuality(results)
    if (qualityAnalysis.highest_quality_model && qualityAnalysis.quality_distribution.std > 0.3) {
      suggestions.push(`对于高质量要求任务，推荐使用 ${qualityAnalysis.highest_quality_model.model}`)
    }

    return suggestions
  }

  /**
     * 保存结果
     */
  async saveResults (testResult) {
    const filename = `benchmark_${testResult.testId}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
    const filepath = path.join(this.options.resultsDir, filename)

    try {
      await fs.writeFile(filepath, JSON.stringify(testResult, null, 2), 'utf8')
      console.log(`💾 结果已保存: ${filepath}`)
    } catch (error) {
      console.error('保存结果失败:', error)
    }
  }

  /**
     * 获取测试结果
     */
  getResults (testId = null) {
    if (testId) {
      return this.results.get(testId) || null
    }
    return Array.from(this.results.values())
  }

  /**
     * 获取最新结果
     */
  getLatestResults (limit = 10) {
    return Array.from(this.results.values())
      .sort((a, b) => new Date(b.metadata.startTime) - new Date(a.metadata.startTime))
      .slice(0, limit)
  }

  /**
     * 比较模型性能
     */
  compareModels (models, metric = 'response_time') {
    const comparison = {
      metric,
      rankings: [],
      differences: {}
    }

    const modelValues = {}

    for (const model of models) {
      const latestResult = this.getLatestResults(1).find(r =>
        r.config.models.includes(model)
      )

      if (latestResult && latestResult.results.models[model]) {
        const summary = latestResult.results.models[model].summary
        if (summary) {
          switch (metric) {
            case 'response_time':
              modelValues[model] = summary.average_response_time
              break
            case 'cost':
              modelValues[model] = summary.average_cost
              break
            case 'quality':
              modelValues[model] = summary.average_quality_score
              break
            case 'cost_efficiency':
              modelValues[model] = summary.cost_per_token
              break
          }
        }
      }
    }

    // 生成排名
    comparison.rankings = Object.entries(modelValues)
      .sort((a, b) => {
        // 对于成本和响应时间，越小越好；对于质量和效率，越大越好
        if (metric === 'response_time' || metric === 'cost' || metric === 'cost_efficiency') {
          return a[1] - b[1]
        } else {
          return b[1] - a[1]
        }
      })
      .map(([model, value]) => ({ model, value }))

    // 计算差异
    if (comparison.rankings.length >= 2) {
      const best = comparison.rankings[0]
      const worst = comparison.rankings[comparison.rankings.length - 1]

      comparison.differences = {
        best_to_worst: metric === 'response_time' || metric === 'cost'
          ? `${((worst.value / best.value - 1) * 100).toFixed(1)}% 差异`
          : `${((best.value / worst.value - 1) * 100).toFixed(1)}% 差异`,
        improvement_potential: `切换到 ${best.model} 可获得显著提升`
      }
    }

    return comparison
  }

  /**
     * 工具函数
     */
  calculateStd (values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squareDiffs = values.map(value => Math.pow(value - mean, 2))
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length
    return Math.sqrt(avgSquareDiff)
  }

  calculateMedian (values) {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  }

  calculatePercentile (values, percentile) {
    const sorted = [...values].sort((a, b) => a - b)
    const index = (percentile / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)
    const weight = index % 1

    if (upper >= sorted.length) return sorted[sorted.length - 1]
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  normalizeScores (scores) {
    const normalized = {}
    for (const [key, value] of Object.entries(scores)) {
      // 简单的归一化，确保所有分数在0-1范围内
      normalized[key] = Math.max(0, Math.min(1, value / 100))
    }
    return normalized
  }

  /**
     * 导出结果
     */
  exportResults (format = 'json') {
    const allResults = this.getResults()

    switch (format) {
      case 'json':
        return JSON.stringify(allResults, null, 2)
      case 'csv':
        return this.convertToCSV(allResults)
      default:
        throw new Error(`不支持的导出格式: ${format}`)
    }
  }

  /**
     * 转换为CSV
     */
  convertToCSV (results) {
    const csv = ['Test ID,Model,Task,Response Time,Cost,Quality Score,Status']

    for (const result of results) {
      for (const [model, modelResults] of Object.entries(result.results.models)) {
        for (const [task, taskResults] of Object.entries(modelResults.tasks || {})) {
          csv.push([
            result.testId,
            model,
            task,
            taskResults.response_time || '',
            taskResults.cost || '',
            taskResults.quality_score || '',
            taskResults.status || 'completed'
          ].join(','))
        }
      }
    }

    return csv.join('\n')
  }
}

/**
 * 指标计算器
 */
class MetricsCalculator {
  calculateResponseTimeStats (times) {
    if (!times || times.length === 0) return {}

    const sorted = [...times].sort((a, b) => a - b)

    return {
      mean: times.reduce((a, b) => a + b, 0) / times.length,
      median: sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  calculateCostEfficiency (cost, quality, tokens) {
    if (!cost || !tokens) return 0
    const costPerToken = cost / tokens
    const qualityBonus = quality || 1
    return qualityBonus / costPerToken
  }

  calculateStabilityScore (times) {
    if (!times || times.length < 2) return 0

    const mean = times.reduce((a, b) => a + b, 0) / times.length
    const variance = times.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / times.length
    const std = Math.sqrt(variance)

    // 稳定性分数：标准差越小，分数越高 (0-1)
    return Math.max(0, Math.min(1, 1 - (std / mean)))
  }
}

/**
 * 测试执行器
 */
class TestExecutor {
  constructor (options) {
    this.options = options
    this.activeRequests = new Map()
  }

  async runModelTests (model, tasks, iterations, config, testId) {
    const results = {
      model,
      tasks: {},
      summary: {
        total_requests: 0,
        successful_requests: 0,
        failed_requests: 0,
        total_duration: 0,
        average_response_time: 0,
        average_cost: 0,
        average_quality_score: 0,
        cost_per_token: 0
      }
    }

    // 导入测试用例
    const { testCases } = require('./benchmark-test-cases')

    // 为每个任务执行测试
    for (const task of tasks) {
      if (!testCases[task]) {
        console.warn(`⚠️ 未知任务类型: ${task}`)
        continue
      }

      console.log(`📋 执行任务: ${task} (${iterations} 次迭代)`)
      results.tasks[task] = await this.runTaskTests(
        model,
        task,
        testCases[task],
        iterations,
        config,
        testId
      )
    }

    // 计算汇总统计
    this.calculateModelSummary(results)

    return results
  }

  async runTaskTests (model, task, testCase, iterations, config, testId) {
    const taskResults = {
      iterations: [],
      response_times: [],
      costs: [],
      quality_scores: [],
      tokens_used: [],
      errors: []
    }

    // 并发执行测试
    const concurrency = Math.min(config.concurrency, iterations)
    const chunks = this.chunkArray(Array.from({ length: iterations }, (_, i) => i), concurrency)

    for (const chunk of chunks) {
      const promises = chunk.map(async (iteration) => {
        try {
          const result = await this.runSingleTest(
            model,
            task,
            testCase,
            iteration,
            config,
            testId
          )

          taskResults.iterations.push({
            iteration,
            ...result,
            status: 'success'
          })

          if (result.response_time) taskResults.response_times.push(result.response_time)
          if (result.cost) taskResults.costs.push(result.cost)
          if (result.quality_score !== undefined) taskResults.quality_scores.push(result.quality_score)
          if (result.tokens_used) taskResults.tokens_used.push(result.tokens_used)
        } catch (error) {
          taskResults.errors.push({
            iteration,
            error: error.message,
            timestamp: new Date().toISOString()
          })

          taskResults.iterations.push({
            iteration,
            status: 'failed',
            error: error.message
          })
        }
      })

      await Promise.all(promises)

      // 添加小延迟避免并发过高
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // 计算任务统计
    return this.calculateTaskStats(taskResults)
  }

  async runSingleTest (model, task, testCase, iteration, config, testId) {
    const startTime = performance.now()

    try {
      // 生成测试输入
      const testInput = testCase.generateInput ? testCase.generateInput() : testCase.input

      // 构建请求
      const requestBody = {
        model,
        messages: [{ role: 'user', content: testInput }],
        ...config.parameters
      }

      // 这里应该调用实际的AI网关API
      // 为了演示，我们模拟一个响应
      const mockResponse = await this.simulateAIRequest(requestBody, config.timeout)

      const endTime = performance.now()
      const responseTime = endTime - startTime

      // 模拟质量评估
      const qualityScore = config.includeQualityAssessment
        ? this.assessQuality(mockResponse.content, testCase.expected_output) : null

      // 模拟成本计算
      const tokensUsed = mockResponse.content.length / 4 // 粗略估算
      const cost = this.calculateEstimatedCost(model, tokensUsed)

      return {
        response_time: responseTime,
        content: mockResponse.content,
        tokens_used: tokensUsed,
        cost: cost,
        quality_score: qualityScore,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      const endTime = performance.now()
      throw new Error(`测试失败: ${error.message} (耗时: ${(endTime - startTime).toFixed(2)}ms)`)
    }
  }

  async simulateAIRequest (requestBody, timeout) {
    // 模拟网络延迟
    const delay = Math.random() * 1000 + 500 // 500-1500ms
    await new Promise(resolve => setTimeout(resolve, delay))

    // 模拟响应内容
    const responses = [
      '这是一个模拟的AI响应，用于性能基准测试。测试内容质量和响应时间。',
      'Performance benchmark test response. This simulates a typical AI model output for evaluation purposes.',
      '基准测试模拟响应。评估模型的响应速度、成本效益和输出质量。',
      'Mock response for benchmarking. Used to measure latency, cost, and quality metrics.',
      'AI模型性能测试响应内容。包含足够的信息用于质量评估和统计分析。'
    ]

    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      finish_reason: 'stop'
    }
  }

  assessQuality (actualOutput, expectedOutput) {
    if (!expectedOutput) return 0.8 // 默认分数

    // 简单的质量评估（实际应该使用更复杂的算法）
    const similarity = this.calculateTextSimilarity(actualOutput, expectedOutput)
    return Math.max(0.1, Math.min(1.0, similarity))
  }

  calculateTextSimilarity (text1, text2) {
    // 简单的相似度计算
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  calculateEstimatedCost (model, tokens) {
    // 估算成本（实际应该从配置中获取）
    const costPerToken = {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.015,
      'deepseek-chat': 0.001,
      'qwen-max': 0.002
    }

    return (costPerToken[model] || 0.01) * tokens
  }

  calculateTaskStats (taskResults) {
    const stats = {
      total_iterations: taskResults.iterations.length,
      successful_iterations: taskResults.response_times.length,
      failed_iterations: taskResults.errors.length,
      success_rate: 0,
      response_time: {},
      cost: {},
      quality_score: {},
      tokens_used: {},
      status: 'completed'
    }

    stats.success_rate = stats.successful_iterations / stats.total_iterations

    if (taskResults.response_times.length > 0) {
      stats.response_time = this.calculateStats(taskResults.response_times)
    }

    if (taskResults.costs.length > 0) {
      stats.cost = this.calculateStats(taskResults.costs)
    }

    if (taskResults.quality_scores.length > 0) {
      stats.quality_score = this.calculateStats(taskResults.quality_scores)
    }

    if (taskResults.tokens_used.length > 0) {
      stats.tokens_used = this.calculateStats(taskResults.tokens_used)
    }

    return stats
  }

  calculateStats (values) {
    if (values.length === 0) return {}

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / values.length

    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
    const std = Math.sqrt(variance)

    return {
      mean,
      median: sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      std,
      p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
      count: values.length
    }
  }

  calculateModelSummary (results) {
    const summary = results.summary
    let totalResponseTime = 0
    let totalCost = 0
    let totalQuality = 0
    let totalTokens = 0
    let qualityCount = 0

    for (const [taskName, taskResults] of Object.entries(results.tasks)) {
      summary.total_requests += taskResults.total_iterations
      summary.successful_requests += taskResults.successful_iterations
      summary.failed_requests += taskResults.failed_iterations

      if (taskResults.response_time.mean) {
        totalResponseTime += taskResults.response_time.mean
      }

      if (taskResults.cost.mean) {
        totalCost += taskResults.cost.mean
      }

      if (taskResults.quality_score && taskResults.quality_score.mean !== undefined) {
        totalQuality += taskResults.quality_score.mean
        qualityCount++
      }

      if (taskResults.tokens_used.mean) {
        totalTokens += taskResults.tokens_used.mean
      }
    }

    const taskCount = Object.keys(results.tasks).length
    if (taskCount > 0) {
      summary.average_response_time = totalResponseTime / taskCount
      summary.average_cost = totalCost / taskCount
      if (qualityCount > 0) {
        summary.average_quality_score = totalQuality / qualityCount
      }
      if (totalTokens > 0) {
        summary.cost_per_token = totalCost / totalTokens
      }
    }
  }

  chunkArray (array, size) {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}

// 创建全局实例
const performanceBenchmarkManager = new PerformanceBenchmarkManager()

// 导出类和实例
module.exports = {
  PerformanceBenchmarkManager,
  performanceBenchmarkManager,
  MetricsCalculator,
  TestExecutor
}
