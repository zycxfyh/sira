/**
 * Sira AI网关 - 端到端测试工具
 * 基于Cypress、Playwright和Testing Library的最佳实践
 * 测试完整用户旅程和系统集成
 */

const EventEmitter = require('events')
const puppeteer = require('puppeteer')
const axios = require('axios')

/**
 * 端到端测试工具
 * 模拟真实用户行为，测试完整的功能流程
 */
class E2ETestingTool extends EventEmitter {
  constructor(options = {}) {
    super()

    this.options = {
      baseUrl: options.baseUrl || 'http://localhost:8080',
      apiBaseUrl: options.apiBaseUrl || 'http://localhost:8080',
      headless: options.headless !== false,
      slowMo: options.slowMo || 0,
      timeout: options.timeout || 30000,
      viewport: options.viewport || { width: 1280, height: 720 },
      enableVideo: options.enableVideo || false,
      enableScreenshots: options.enableScreenshots || false,
      testDataDir: options.testDataDir || './test-data',
      ...options
    }

    // 浏览器实例
    this.browser = null
    this.page = null

    // 测试状态
    this.isRunning = false
    this.testResults = []
    this.currentTest = null

    // 测试数据
    this.testUsers = {
      admin: {
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      },
      user: {
        username: 'testuser',
        password: 'user123',
        role: 'user'
      },
      developer: {
        username: 'developer',
        password: 'dev123',
        role: 'developer'
      }
    }

    // API客户端
    this.apiClient = axios.create({
      baseURL: this.options.apiBaseUrl,
      timeout: this.options.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // 用户旅程
    this.userJourneys = new Map()
    this.setupUserJourneys()
  }

  /**
   * 初始化端到端测试工具
   */
  async initialize() {
    console.log('🔧 初始化端到端测试工具')

    // 启动浏览器
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    console.log('🌐 浏览器已启动')
  }

  /**
   * 设置用户旅程
   */
  setupUserJourneys() {
    // AI聊天旅程
    this.userJourneys.set('ai_chat_journey', {
      name: 'AI聊天完整旅程',
      description: '从登录到AI对话的完整用户体验',
      steps: [
        { name: '访问首页', action: 'navigate', url: '/' },
        { name: '用户登录', action: 'login', user: 'user' },
        { name: '导航到聊天页面', action: 'navigate', url: '/chat' },
        { name: '选择AI模型', action: 'selectModel', model: 'gpt-3.5-turbo' },
        { name: '发送消息', action: 'sendMessage', message: '你好，请介绍一下自己' },
        { name: '等待回复', action: 'waitForResponse' },
        { name: '验证回复', action: 'verifyResponse' },
        { name: '发送后续问题', action: 'sendMessage', message: '请详细说明AI的工作原理' },
        { name: '等待回复', action: 'waitForResponse' },
        { name: '验证回复', action: 'verifyResponse' },
        { name: '导出对话', action: 'exportConversation' },
        { name: '登出', action: 'logout' }
      ]
    })

    // API密钥管理旅程
    this.userJourneys.set('api_key_management', {
      name: 'API密钥管理旅程',
      description: '完整的API密钥生命周期管理',
      steps: [
        { name: '管理员登录', action: 'login', user: 'admin' },
        { name: '访问API密钥页面', action: 'navigate', url: '/admin/api-keys' },
        { name: '添加新密钥', action: 'addApiKey', provider: 'openai', key: 'sk-test-key' },
        { name: '验证密钥状态', action: 'verifyKeyStatus' },
        { name: '测试密钥连接', action: 'testKeyConnection' },
        { name: '轮换密钥', action: 'rotateKey' },
        { name: '设置权限', action: 'setPermissions' },
        { name: '监控使用情况', action: 'monitorUsage' },
        { name: '删除密钥', action: 'deleteKey' }
      ]
    })

    // 批量处理旅程
    this.userJourneys.set('batch_processing_journey', {
      name: '批量处理旅程',
      description: '测试批量AI请求处理功能',
      steps: [
        { name: '开发者登录', action: 'login', user: 'developer' },
        { name: '访问批量处理页面', action: 'navigate', url: '/batch' },
        { name: '创建批量任务', action: 'createBatchTask' },
        { name: '上传任务文件', action: 'uploadBatchFile' },
        { name: '配置处理参数', action: 'configureBatchParams' },
        { name: '启动批量处理', action: 'startBatchProcessing' },
        { name: '监控处理进度', action: 'monitorProgress' },
        { name: '验证结果', action: 'verifyBatchResults' },
        { name: '下载结果', action: 'downloadResults' }
      ]
    })

    // 流式响应旅程
    this.userJourneys.set('streaming_journey', {
      name: '流式响应旅程',
      description: '测试实时流式响应功能',
      steps: [
        { name: '用户登录', action: 'login', user: 'user' },
        { name: '访问流式聊天', action: 'navigate', url: '/streaming/chat' },
        { name: '建立流式连接', action: 'establishStream' },
        { name: '发送流式消息', action: 'sendStreamingMessage' },
        { name: '观察实时响应', action: 'observeStreaming' },
        { name: '测试连接稳定性', action: 'testConnectionStability' },
        { name: '断开连接', action: 'disconnectStream' }
      ]
    })

    // 管理面板旅程
    this.userJourneys.set('admin_dashboard_journey', {
      name: '管理面板旅程',
      description: '测试管理员功能和监控面板',
      steps: [
        { name: '管理员登录', action: 'login', user: 'admin' },
        { name: '访问仪表板', action: 'navigate', url: '/admin/dashboard' },
        { name: '查看系统状态', action: 'viewSystemStatus' },
        { name: '检查性能指标', action: 'checkPerformanceMetrics' },
        { name: '查看用户统计', action: 'viewUserStats' },
        { name: '监控API使用', action: 'monitorApiUsage' },
        { name: '检查告警', action: 'checkAlerts' },
        { name: '导出报告', action: 'exportReports' }
      ]
    })
  }

  /**
   * 运行端到端测试
   */
  async runE2ETest(config = {}) {
    const {
      journeys = Array.from(this.userJourneys.keys()),
      parallel = false,
      retries = 2,
      timeout = this.options.timeout
    } = config

    if (this.isRunning) {
      throw new Error('端到端测试已在运行中')
    }

    this.isRunning = true
    this.testResults = []

    console.log(`🚀 开始端到端测试: ${journeys.length} 个用户旅程`)

    this.emit('testStart', { journeys, parallel })

    try {
      const results = []

      if (parallel) {
        // 并行执行
        const promises = journeys.map(journeyName =>
          this.runUserJourney(journeyName, retries, timeout)
        )
        const settledResults = await Promise.allSettled(promises)

        settledResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value)
          } else {
            results.push({
              journey: journeys[index],
              success: false,
              error: result.reason.message,
              duration: 0
            })
          }
        })
      } else {
        // 串行执行
        for (const journeyName of journeys) {
          const result = await this.runUserJourney(journeyName, retries, timeout)
          results.push(result)
        }
      }

      this.testResults = results

      const summary = this.generateE2ESummary(results)

      this.emit('testComplete', summary)

      return summary

    } catch (error) {
      console.error('端到端测试失败:', error.message)
      this.emit('testError', error)
      throw error
    } finally {
      await this.cleanup()
      this.isRunning = false
    }
  }

  /**
   * 运行用户旅程
   */
  async runUserJourney(journeyName, retries = 2, timeout = this.options.timeout) {
    const journey = this.userJourneys.get(journeyName)
    if (!journey) {
      throw new Error(`用户旅程不存在: ${journeyName}`)
    }

    const startTime = Date.now()
    let lastError = null

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`📋 执行用户旅程: ${journey.name} (尝试 ${attempt}/${retries + 1})`)

        const result = await this.executeJourney(journey, timeout)
        const duration = Date.now() - startTime

        return {
          journey: journeyName,
          success: true,
          steps: result.steps,
          duration,
          attempt
        }

      } catch (error) {
        console.warn(`⚠️ 用户旅程失败: ${journeyName} (尝试 ${attempt}) - ${error.message}`)
        lastError = error

        if (attempt <= retries) {
          // 等待后重试
          await this.sleep(2000 * attempt)
          continue
        }
      }
    }

    const duration = Date.now() - startTime
    return {
      journey: journeyName,
      success: false,
      error: lastError.message,
      duration,
      attempt: retries + 1
    }
  }

  /**
   * 执行旅程步骤
   */
  async executeJourney(journey, timeout) {
    // 创建新的页面实例
    const page = await this.browser.newPage()
    await page.setViewport(this.options.viewport)
    await page.setDefaultTimeout(timeout)

    // 设置截图和视频
    if (this.options.enableScreenshots) {
      await page.screenshot({ path: `screenshot-${journey.name}-start.png` })
    }

    const results = {
      steps: [],
      screenshots: [],
      errors: []
    }

    try {
      for (const step of journey.steps) {
        const stepStartTime = Date.now()

        try {
          console.log(`  ➤ 执行步骤: ${step.name}`)

          await this.executeStep(page, step)

          const stepDuration = Date.now() - stepStartTime
          results.steps.push({
            name: step.name,
            success: true,
            duration: stepDuration
          })

          // 步骤成功截图
          if (this.options.enableScreenshots) {
            const screenshotPath = `screenshot-${journey.name}-${step.name}.png`
            await page.screenshot({ path: screenshotPath })
            results.screenshots.push(screenshotPath)
          }

        } catch (error) {
          console.error(`  ❌ 步骤失败: ${step.name} - ${error.message}`)

          results.steps.push({
            name: step.name,
            success: false,
            error: error.message,
            duration: Date.now() - stepStartTime
          })

          results.errors.push({
            step: step.name,
            error: error.message,
            timestamp: Date.now()
          })

          throw error // 重新抛出错误，中止旅程
        }
      }

    } finally {
      // 清理页面
      if (this.options.enableScreenshots) {
        await page.screenshot({ path: `screenshot-${journey.name}-end.png` })
      }
      await page.close()
    }

    return results
  }

  /**
   * 执行单个步骤
   */
  async executeStep(page, step) {
    switch (step.action) {
      case 'navigate':
        await page.goto(this.options.baseUrl + step.url)
        await page.waitForLoadState('networkidle')
        break

      case 'login':
        await this.performLogin(page, step.user)
        break

      case 'logout':
        await this.performLogout(page)
        break

      case 'selectModel':
        await this.selectAIModel(page, step.model)
        break

      case 'sendMessage':
        await this.sendChatMessage(page, step.message)
        break

      case 'waitForResponse':
        await this.waitForAIResponse(page)
        break

      case 'verifyResponse':
        await this.verifyAIResponse(page)
        break

      case 'exportConversation':
        await this.exportConversation(page)
        break

      case 'addApiKey':
        await this.addAPIKey(page, step.provider, step.key)
        break

      case 'verifyKeyStatus':
        await this.verifyAPIKeyStatus(page)
        break

      case 'testKeyConnection':
        await this.testAPIKeyConnection(page)
        break

      case 'rotateKey':
        await this.rotateAPIKey(page)
        break

      case 'setPermissions':
        await this.setAPIKeyPermissions(page)
        break

      case 'monitorUsage':
        await this.monitorAPIKeyUsage(page)
        break

      case 'deleteKey':
        await this.deleteAPIKey(page)
        break

      case 'createBatchTask':
        await this.createBatchTask(page)
        break

      case 'uploadBatchFile':
        await this.uploadBatchFile(page)
        break

      case 'configureBatchParams':
        await this.configureBatchParams(page)
        break

      case 'startBatchProcessing':
        await this.startBatchProcessing(page)
        break

      case 'monitorProgress':
        await this.monitorBatchProgress(page)
        break

      case 'verifyBatchResults':
        await this.verifyBatchResults(page)
        break

      case 'downloadResults':
        await this.downloadBatchResults(page)
        break

      case 'establishStream':
        await this.establishStreamConnection(page)
        break

      case 'sendStreamingMessage':
        await this.sendStreamingMessage(page)
        break

      case 'observeStreaming':
        await this.observeStreamingResponse(page)
        break

      case 'testConnectionStability':
        await this.testStreamStability(page)
        break

      case 'disconnectStream':
        await this.disconnectStream(page)
        break

      case 'viewSystemStatus':
        await this.viewSystemStatus(page)
        break

      case 'checkPerformanceMetrics':
        await this.checkPerformanceMetrics(page)
        break

      case 'viewUserStats':
        await this.viewUserStats(page)
        break

      case 'monitorApiUsage':
        await this.monitorApiUsage(page)
        break

      case 'checkAlerts':
        await this.checkAlerts(page)
        break

      case 'exportReports':
        await this.exportReports(page)
        break

      default:
        throw new Error(`未知的步骤动作: ${step.action}`)
    }
  }

  // ==================== 用户操作方法 ====================

  /**
   * 执行登录
   */
  async performLogin(page, userKey) {
    const user = this.testUsers[userKey]
    if (!user) {
      throw new Error(`测试用户不存在: ${userKey}`)
    }

    // 填写登录表单
    await page.fill('#username', user.username)
    await page.fill('#password', user.password)
    await page.click('#login-button')

    // 等待登录成功
    await page.waitForSelector('.dashboard, .welcome-message', { timeout: 10000 })
  }

  /**
   * 执行登出
   */
  async performLogout(page) {
    await page.click('#logout-button, .logout-link')
    await page.waitForSelector('#login-form, .login-page')
  }

  /**
   * 选择AI模型
   */
  async selectAIModel(page, model) {
    await page.selectOption('#model-selector, .model-select', model)
    await page.waitForTimeout(500) // 等待模型切换
  }

  /**
   * 发送聊天消息
   */
  async sendChatMessage(page, message) {
    await page.fill('#message-input, .chat-input', message)
    await page.click('#send-button, .send-btn')
  }

  /**
   * 等待AI回复
   */
  async waitForAIResponse(page) {
    await page.waitForSelector('.ai-response, .bot-message', { timeout: 30000 })
  }

  /**
   * 验证AI回复
   */
  async verifyAIResponse(page) {
    const responseElement = await page.$('.ai-response, .bot-message')
    if (!responseElement) {
      throw new Error('未找到AI回复元素')
    }

    const responseText = await responseElement.textContent()
    if (!responseText || responseText.trim().length === 0) {
      throw new Error('AI回复为空')
    }
  }

  /**
   * 导出对话
   */
  async exportConversation(page) {
    await page.click('#export-button, .export-btn')
    await page.waitForTimeout(2000) // 等待导出完成
  }

  /**
   * 添加API密钥
   */
  async addAPIKey(page, provider, key) {
    await page.fill('#provider-select', provider)
    await page.fill('#api-key-input', key)
    await page.click('#add-key-button')
    await page.waitForSelector('.key-added-success, .success-message')
  }

  /**
   * 验证API密钥状态
   */
  async verifyAPIKeyStatus(page) {
    const statusElement = await page.$('.key-status')
    const status = await statusElement.textContent()
    if (status.includes('error') || status.includes('failed')) {
      throw new Error(`API密钥状态异常: ${status}`)
    }
  }

  /**
   * 测试API密钥连接
   */
  async testAPIKeyConnection(page) {
    await page.click('#test-connection-button')
    await page.waitForSelector('.connection-success, .test-passed', { timeout: 10000 })
  }

  /**
   * 轮换API密钥
   */
  async rotateAPIKey(page) {
    await page.click('#rotate-key-button')
    await page.waitForSelector('.rotation-success, .key-rotated')
  }

  /**
   * 设置API密钥权限
   */
  async setAPIKeyPermissions(page) {
    await page.check('#read-permission')
    await page.check('#write-permission')
    await page.click('#save-permissions-button')
    await page.waitForSelector('.permissions-saved')
  }

  /**
   * 监控API密钥使用
   */
  async monitorAPIKeyUsage(page) {
    // 检查使用统计是否存在
    const usageElement = await page.$('.usage-stats, .key-usage')
    if (!usageElement) {
      throw new Error('未找到使用统计信息')
    }
  }

  /**
   * 删除API密钥
   */
  async deleteAPIKey(page) {
    await page.click('#delete-key-button')
    await page.waitForSelector('.confirm-delete', { timeout: 5000 })
    await page.click('.confirm-delete-button')
    await page.waitForSelector('.key-deleted-success')
  }

  /**
   * 创建批量任务
   */
  async createBatchTask(page) {
    await page.click('#create-batch-button, .new-batch-btn')
    await page.waitForSelector('.batch-form, .batch-config')
  }

  /**
   * 上传批量文件
   */
  async uploadBatchFile(page) {
    const fileInput = await page.$('#file-upload, .batch-file-input')
    await fileInput.setInputFiles('./test-data/batch-input.json')
    await page.waitForSelector('.file-uploaded, .upload-success')
  }

  /**
   * 配置批量参数
   */
  async configureBatchParams(page) {
    await page.selectOption('#batch-model', 'gpt-3.5-turbo')
    await page.fill('#batch-max-tokens', '100')
    await page.click('#save-batch-config')
  }

  /**
   * 启动批量处理
   */
  async startBatchProcessing(page) {
    await page.click('#start-batch-button')
    await page.waitForSelector('.batch-started, .processing-status')
  }

  /**
   * 监控批量进度
   */
  async monitorBatchProgress(page) {
    // 等待一段时间让批量处理进行
    await page.waitForTimeout(5000)

    const progressElement = await page.$('.progress-bar, .batch-progress')
    if (progressElement) {
      const progress = await progressElement.textContent()
      console.log(`批量处理进度: ${progress}`)
    }
  }

  /**
   * 验证批量结果
   */
  async verifyBatchResults(page) {
    await page.waitForSelector('.batch-completed, .results-ready', { timeout: 30000 })
    const resultsElement = await page.$('.batch-results')
    const resultsText = await resultsElement.textContent()
    if (!resultsText || resultsText.includes('error')) {
      throw new Error('批量处理结果异常')
    }
  }

  /**
   * 下载批量结果
   */
  async downloadBatchResults(page) {
    await page.click('#download-results-button')
    await page.waitForTimeout(2000) // 等待下载开始
  }

  /**
   * 建立流式连接
   */
  async establishStreamConnection(page) {
    await page.click('#connect-stream-button, .stream-connect')
    await page.waitForSelector('.stream-connected, .connection-established')
  }

  /**
   * 发送流式消息
   */
  async sendStreamingMessage(page) {
    await page.fill('#stream-message-input', '请流式回复这个消息')
    await page.click('#send-stream-button')
  }

  /**
   * 观察流式响应
   */
  async observeStreamingResponse(page) {
    await page.waitForSelector('.streaming-response, .stream-output', { timeout: 10000 })
    // 验证流式响应是否实时更新
    const initialContent = await page.$eval('.streaming-response', el => el.textContent)
    await page.waitForTimeout(2000)
    const updatedContent = await page.$eval('.streaming-response', el => el.textContent)

    if (initialContent === updatedContent) {
      throw new Error('流式响应未实时更新')
    }
  }

  /**
   * 测试流连接稳定性
   */
  async testStreamStability(page) {
    // 发送多个消息测试连接稳定性
    for (let i = 0; i < 3; i++) {
      await page.fill('#stream-message-input', `测试消息 ${i + 1}`)
      await page.click('#send-stream-button')
      await page.waitForSelector('.streaming-response', { timeout: 5000 })
      await page.waitForTimeout(1000)
    }
  }

  /**
   * 断开流式连接
   */
  async disconnectStream(page) {
    await page.click('#disconnect-stream-button, .stream-disconnect')
    await page.waitForSelector('.stream-disconnected, .connection-closed')
  }

  /**
   * 查看系统状态
   */
  async viewSystemStatus(page) {
    await page.click('#system-status-tab, .status-link')
    await page.waitForSelector('.system-metrics, .status-dashboard')
  }

  /**
   * 检查性能指标
   */
  async checkPerformanceMetrics(page) {
    const metricsElement = await page.$('.performance-metrics, .metrics-display')
    if (!metricsElement) {
      throw new Error('未找到性能指标')
    }
  }

  /**
   * 查看用户统计
   */
  async viewUserStats(page) {
    await page.click('#user-stats-tab')
    await page.waitForSelector('.user-statistics, .stats-table')
  }

  /**
   * 监控API使用
   */
  async monitorApiUsage(page) {
    await page.click('#api-usage-tab')
    await page.waitForSelector('.api-usage-charts, .usage-metrics')
  }

  /**
   * 检查告警
   */
  async checkAlerts(page) {
    await page.click('#alerts-tab')
    // 检查是否有严重告警
    const criticalAlerts = await page.$$('.alert-critical, .alert-error')
    if (criticalAlerts.length > 0) {
      console.warn(`发现 ${criticalAlerts.length} 个严重告警`)
    }
  }

  /**
   * 导出报告
   */
  async exportReports(page) {
    await page.click('#export-report-button')
    await page.waitForTimeout(3000) // 等待导出完成
  }

  /**
   * 生成端到端测试摘要
   */
  generateE2ESummary(results) {
    const totalJourneys = results.length
    const successfulJourneys = results.filter(r => r.success).length
    const failedJourneys = totalJourneys - successfulJourneys
    const successRate = (successfulJourneys / totalJourneys * 100).toFixed(2)

    const totalSteps = results.reduce((sum, r) => sum + (r.steps?.length || 0), 0)
    const successfulSteps = results.reduce((sum, r) =>
      sum + (r.steps?.filter(s => s.success).length || 0), 0)
    const failedSteps = totalSteps - successfulSteps

    const avgDuration = results.length > 0 ?
      results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0

    return {
      summary: {
        totalJourneys,
        successfulJourneys,
        failedJourneys,
        successRate,
        totalSteps,
        successfulSteps,
        failedSteps,
        averageDuration: avgDuration.toFixed(2)
      },
      results,
      recommendations: this.generateE2ERecommendations(results)
    }
  }

  /**
   * 生成端到端测试建议
   */
  generateE2ERecommendations(results) {
    const recommendations = []

    const failedJourneys = results.filter(r => !r.success)
    if (failedJourneys.length > 0) {
      recommendations.push(`${failedJourneys.length} 个用户旅程失败，需要修复相关功能`)
      failedJourneys.forEach(journey => {
        recommendations.push(`  - ${journey.journey}: ${journey.error}`)
      })
    }

    const slowJourneys = results.filter(r => r.duration > 60000) // 超过1分钟
    if (slowJourneys.length > 0) {
      recommendations.push(`${slowJourneys.length} 个旅程执行过慢，需要优化性能`)
    }

    if (results.some(r => r.attempt > 1)) {
      recommendations.push('某些测试需要重试，表明系统稳定性不足')
    }

    return recommendations
  }

  /**
   * 休眠工具函数
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * 清理测试环境
   */
  async cleanup() {
    console.log('🧹 清理端到端测试环境')

    if (this.page) {
      await this.page.close()
      this.page = null
    }

    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }

    this.isRunning = false
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTest: this.currentTest,
      completedTests: this.testResults.length,
      browserConnected: !!this.browser
    }
  }

  /**
   * 停止端到端测试
   */
  stop() {
    this.isRunning = false
    console.log('🛑 端到端测试已停止')
    this.emit('testStopped')
  }
}

module.exports = { E2ETestingTool }
