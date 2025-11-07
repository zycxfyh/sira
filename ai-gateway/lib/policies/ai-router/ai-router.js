const axios = require('axios')
const { usageAnalytics } = require('../../usage-analytics')
const { parameterManager } = require('../../parameter-manager')
const { promptTemplateManager } = require('../../prompt-template-manager')
const { apiKeyManager } = require('../../api-key-manager')
const { ABTestManager } = require('../../ab-test-manager')
const { RulesEngine } = require('../../rules-engine')

// AI Router Policy
// Routes AI requests to appropriate providers based on cost, performance, and availability
module.exports = function (params, config) {
  const logger = config.logger || console

  // Configuration validation
  const validationErrors = validateConfiguration(params)
  if (validationErrors.length > 0) {
    const error = new Error(`AI Router configuration validation failed: ${validationErrors.join(', ')}`)
    logger.error(error.message)
    throw error
  }

  // Merge with default configuration
  const finalConfig = Object.assign({
    timeout: 30000,
    retryAttempts: 3,
    routingStrategy: 'cost', // cost, performance, availability
    fallbackEnabled: true,
    healthCheckInterval: 60000
  }, params)

  // AI Provider configurations
  const providers = {
    openai: {
      baseUrl: 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      costPerToken: { 'gpt-4': 0.03, 'gpt-4-turbo': 0.01, 'gpt-3.5-turbo': 0.002 },
      authHeader: 'Authorization',
      authPrefix: 'Bearer'
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1',
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      costPerToken: { 'claude-3-opus': 0.015, 'claude-3-sonnet': 0.003, 'claude-3-haiku': 0.00025 },
      authHeader: 'x-api-key',
      authPrefix: ''
    },
    azure: {
      baseUrl: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com/',
      models: ['gpt-4', 'gpt-3.5-turbo'],
      costPerToken: { 'gpt-4': 0.03, 'gpt-3.5-turbo': 0.002 },
      authHeader: 'api-key',
      authPrefix: '',
      deploymentMap: {
        'gpt-4': 'gpt-4',
        'gpt-3.5-turbo': 'gpt-35-turbo'
      }
    }
  }

  // Provider performance tracking
  const providerStats = new Map()

  // Initialize provider stats
  Object.keys(providers).forEach(provider => {
    providerStats.set(provider, {
      successCount: 0,
      errorCount: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      lastFailureTime: null,
      isCircuitBreakerOpen: false
    })
  })

  // Model to provider mapping
  const modelProviders = {}
  Object.entries(providers).forEach(([provider, providerConfig]) => {
    providerConfig.models.forEach(model => {
      if (!modelProviders[model]) {
        modelProviders[model] = []
      }
      modelProviders[model].push(provider)
    })
  })

  return function aiRouter (req, res, next) {
    const startTime = Date.now()

    // Extract user ID from headers or generate one
    const userId = req.headers['x-user-id'] || req.headers['user-id'] || req.ip || 'anonymous'
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Initialize rules engine for custom routing rules
    let rulesEngine = null
    try {
      if (!global.rulesEngine) {
        global.rulesEngine = new RulesEngine()
        await global.rulesEngine.initialize()
      }
      rulesEngine = global.rulesEngine
    } catch (error) {
      logger.warn('Rules engine initialization failed, continuing without custom rules:', error.message)
    }

    // Extract AI model from request body
    let model, parameters, taskType, parameterPreset, promptTemplate, templateVariables
    try {
      const body = req.body
      model = body.model
      parameters = body.parameters || {}
      taskType = body.task_type || req.headers['x-task-type']
      parameterPreset = body.parameter_preset || req.headers['x-parameter-preset']
      promptTemplate = body.prompt_template || req.headers['x-prompt-template']
      templateVariables = body.template_variables || {}

      if (!model) {
        // 记录错误统计
        usageAnalytics.recordRequest({
          userId,
          requestId,
          statusCode: 400,
          error: 'MISSING_MODEL',
          timestamp: new Date(),
          responseTime: Date.now() - startTime
        })

        return res.status(400).json({
          error: 'Model is required',
          code: 'MISSING_MODEL'
        })
      }

      // Check if model is supported
      if (!modelProviders[model]) {
        // 记录错误统计
        usageAnalytics.recordRequest({
          userId,
          requestId,
          statusCode: 400,
          error: 'UNSUPPORTED_MODEL',
          timestamp: new Date(),
          responseTime: Date.now() - startTime
        })

        return res.status(400).json({
          error: `Unsupported model: ${model}`,
          code: 'UNSUPPORTED_MODEL'
        })
      }

      // 处理参数预设
      if (parameterPreset) {
        const preset = parameterManager.getParameterPreset(parameterPreset)
        if (preset) {
          parameters = { ...preset.parameters, ...parameters }
          logger.info(`Applied parameter preset: ${parameterPreset}`, { userId, model })
        } else {
          logger.warn(`Unknown parameter preset: ${parameterPreset}`, { userId })
        }
      }

      // 优化参数
      parameters = parameterManager.optimizeParameters(parameters, taskType, model)

      // 验证参数
      const validation = parameterManager.validateParameters(parameters)
      if (!validation.valid) {
        usageAnalytics.recordRequest({
          userId,
          requestId,
          statusCode: 400,
          error: 'INVALID_PARAMETERS',
          timestamp: new Date(),
          responseTime: Date.now() - startTime
        })

        return res.status(400).json({
          error: 'Invalid parameters',
          code: 'INVALID_PARAMETERS',
          details: validation.errors,
          warnings: validation.warnings
        })
      }

      // 记录参数警告
      if (validation.warnings.length > 0) {
        logger.warn('Parameter warnings', {
          userId,
          model,
          warnings: validation.warnings
        })
      }

      // 处理提示词模板
      let renderedPrompt = null
      if (promptTemplate) {
        try {
          const templateParts = promptTemplate.split('.')
          if (templateParts.length === 2) {
            const [category, templateId] = templateParts
            const renderResult = promptTemplateManager.renderTemplate(category, templateId, templateVariables)

            // 将渲染后的提示词替换到messages中
            if (body.messages && Array.isArray(body.messages)) {
              // 找到最后一个用户消息并替换内容
              for (let i = body.messages.length - 1; i >= 0; i--) {
                if (body.messages[i].role === 'user') {
                  body.messages[i].content = renderResult.rendered
                  renderedPrompt = renderResult
                  break
                }
              }
            }

            logger.info(`Applied prompt template: ${promptTemplate}`, {
              userId,
              model,
              template: renderResult.template.name
            })
          } else {
            logger.warn(`Invalid prompt template format: ${promptTemplate}`, { userId })
          }
        } catch (error) {
          logger.warn(`Prompt template rendering failed: ${promptTemplate}`, {
            userId,
            error: error.message
          })
          // 模板渲染失败不影响请求继续处理
        }
      }

    } catch (error) {
      logger.error('Failed to parse request body:', error)

      // 记录错误统计
      usageAnalytics.recordRequest({
        userId,
        requestId,
        statusCode: 400,
        error: 'INVALID_REQUEST',
        timestamp: new Date(),
        responseTime: Date.now() - startTime
      })

      return res.status(400).json({
        error: 'Invalid request body',
        code: 'INVALID_REQUEST'
      })
    }

    // 自定义规则引擎：应用用户定义的路由规则
    let routingContext = {
      user: {
        id: userId,
        tier: req.headers['x-user-tier'] || 'free',
        ip: req.ip,
        userAgent: req.headers['user-agent']
      },
      request: {
        id: requestId,
        method: req.method,
        url: req.url,
        headers: req.headers,
        model: model,
        parameters: parameters,
        taskType: taskType,
        parameterPreset: parameterPreset,
        promptTemplate: promptTemplate,
        estimatedCost: calculateEstimatedCost(model, parameters),
        timestamp: new Date().toISOString()
      },
      system: {
        timestamp: new Date().toISOString(),
        loadAverage: process.loadavg ? process.loadavg()[0] : 0,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime()
      },
      routing: {
        provider: null,
        model: model,
        parameters: parameters,
        cost: null,
        performance: null
      }
    }

    // 执行自定义路由规则
    if (rulesEngine) {
      try {
        const ruleResult = await rulesEngine.executeRules(routingContext, {
          ruleSetId: params.routingRuleSetId || 'routing-rules',
          maxResults: 5,
          dryRun: false
        })

        if (ruleResult.matched && ruleResult.results.length > 0) {
          logger.info(`Applied ${ruleResult.results.length} custom routing rules`, {
            userId,
            requestId,
            rulesApplied: ruleResult.results.map(r => r.ruleName)
          })

          // 应用规则执行结果
          for (const result of ruleResult.results) {
            // 规则执行结果已经通过actions应用到了routingContext中
            if (routingContext.routing.provider) {
              selectedProvider = routingContext.routing.provider
            }
            if (routingContext.routing.model) {
              model = routingContext.routing.model
            }
            if (routingContext.routing.parameters) {
              parameters = { ...parameters, ...routingContext.routing.parameters }
            }
          }
        }
      } catch (error) {
        logger.warn('Custom routing rules execution failed, continuing with default routing:', {
          userId,
          requestId,
          error: error.message
        })
      }
    }

    // A/B测试：检查是否有适用于当前请求的测试
    let abTestAllocation = null
    let abTestManager = null

    try {
      // 延迟初始化A/B测试管理器
      if (!global.abTestManager) {
        global.abTestManager = new ABTestManager()
        await global.abTestManager.initialize()
      }
      abTestManager = global.abTestManager

      // 查找适用于当前请求的A/B测试
      const context = {
        userId,
        provider: null, // 稍后根据测试目标设置
        model,
        taskType,
        requestId
      }

      // 首先查找provider相关的测试
      const providerTests = Array.from(abTestManager.tests.values())
        .filter(test => test.status === 'running' && test.target === 'provider')

      for (const test of providerTests) {
        const allocation = abTestManager.allocateVariant(test.id, userId, context)
        if (allocation) {
          abTestAllocation = { ...allocation, target: 'provider' }
          break
        }
      }

      // 如果没有provider测试，查找model相关的测试
      if (!abTestAllocation) {
        const modelTests = Array.from(abTestManager.tests.values())
          .filter(test => test.status === 'running' && test.target === 'model')

        for (const test of modelTests) {
          const allocation = abTestManager.allocateVariant(test.id, userId, context)
          if (allocation) {
            abTestAllocation = { ...allocation, target: 'model' }
            break
          }
        }
      }

      // 如果有A/B测试分配，根据测试变体调整请求参数
      if (abTestAllocation) {
        const variant = abTestAllocation.variant
        logger.info(`A/B测试分配: ${abTestAllocation.testId} -> 变体 ${abTestAllocation.variantId}`, {
          userId,
          requestId,
          variant: variant.name
        })

        // 根据测试目标应用变体
        if (abTestAllocation.target === 'provider') {
          // 强制使用测试指定的provider
          selectedProvider = variant.id // variant.id 存储provider名称
        } else if (abTestAllocation.target === 'model') {
          // 强制使用测试指定的model
          model = variant.id // variant.id 存储model名称
        }
        // 其他测试目标可以在这里扩展
      }
    } catch (error) {
      logger.warn('A/B测试处理失败，继续正常流程', {
        userId,
        requestId,
        error: error.message
      })
      // A/B测试失败不影响正常请求处理
    }

    // Select best provider for the model (如果没有被A/B测试覆盖)
    let selectedProvider = selectedProvider || selectBestProvider(model, req)

    if (!selectedProvider) {
      // 记录错误统计
      usageAnalytics.recordRequest({
        userId,
        requestId,
        statusCode: 503,
        error: 'NO_AVAILABLE_PROVIDERS',
        timestamp: new Date(),
        responseTime: Date.now() - startTime
      })

      return res.status(503).json({
        error: 'No available providers for model',
        code: 'NO_AVAILABLE_PROVIDERS'
      })
    }

    // Transform request for the selected provider (包含参数转换)
    const transformedRequest = transformRequest(req.body, selectedProvider, parameters)

    // Get provider configuration and API key
    const providerConfig = providers[selectedProvider]

    // 从API密钥管理器获取可用的密钥
    const availableKeys = apiKeyManager.getAvailableKeys(selectedProvider, userId, ['read', 'write'])
    if (availableKeys.length === 0) {
      usageAnalytics.recordRequest({
        userId,
        requestId,
        statusCode: 429,
        error: 'NO_AVAILABLE_KEYS',
        timestamp: new Date(),
        responseTime: Date.now() - startTime
      })

      return res.status(429).json({
        error: `No available API keys for provider: ${selectedProvider}`,
        code: 'NO_AVAILABLE_KEYS'
      })
    }

    // 选择最佳密钥
    const selectedKey = apiKeyManager.selectBestKey(selectedProvider, userId, ['read', 'write'], {
      strategy: 'least_used' // 使用最少使用的密钥
    })

    if (!selectedKey) {
      usageAnalytics.recordRequest({
        userId,
        requestId,
        statusCode: 429,
        error: 'KEY_SELECTION_FAILED',
        timestamp: new Date(),
        responseTime: Date.now() - startTime
      })

      return res.status(429).json({
        error: 'Failed to select API key',
        code: 'KEY_SELECTION_FAILED'
      })
    }

    // 获取完整的密钥信息
    const keyData = apiKeyManager.getKey(selectedProvider, selectedKey.id)
    if (!keyData) {
      usageAnalytics.recordRequest({
        userId,
        requestId,
        statusCode: 500,
        error: 'KEY_RETRIEVAL_FAILED',
        timestamp: new Date(),
        responseTime: Date.now() - startTime
      })

      return res.status(500).json({
        error: 'Failed to retrieve API key',
        code: 'KEY_RETRIEVAL_FAILED'
      })
    }

    // Build target URL
    const targetUrl = buildTargetUrl(providerConfig, req.url, transformedRequest)

    // Prepare headers with API key from key manager
    const headers = buildHeaders(providerConfig, req.headers, keyData)

    // Make the request
    axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: transformedRequest,
      timeout: params.timeout || 30000,
      validateStatus: () => true // Don't throw on any status code
    })
      .then(response => {
        const responseTime = Date.now() - startTime

        // Record provider performance
        recordProviderPerformance(selectedProvider, response.status < 400, responseTime)

        // Transform response if needed
        const transformedResponse = transformResponse(response.data, selectedProvider)

        // Extract token usage from response
        const tokens = extractTokenUsage(transformedResponse, selectedProvider)
        const cost = calculateCost(selectedProvider, model, tokens)

        // 记录API密钥使用情况
        apiKeyManager.recordKeyUsage(selectedKey.id, {
          tokens: tokens.total || 0,
          cost: cost || 0,
          responseTime,
          statusCode: response.status,
          timestamp: new Date()
        })

        // 记录成功请求统计
        usageAnalytics.recordRequest({
          userId,
          requestId,
          provider: selectedProvider,
          model,
          tokens: tokens.total || 0,
          cost: cost || 0,
          responseTime,
          statusCode: response.status,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        })

        // Add custom headers
        res.set({
          'x-ai-provider': selectedProvider,
          'x-ai-model': model,
          'x-response-time': responseTime,
          'x-tokens-used': tokens.total || 0,
          'x-cost': cost || 0,
          'x-request-id': requestId
        })

        // A/B测试：记录成功请求的结果
        if (abTestAllocation && abTestManager) {
          try {
            const metrics = {
              response_time: responseTime,
              cost: cost || 0,
              quality_score: calculateQualityScore(transformedResponse, model) // 简单的质量评分
            }

            await abTestManager.recordResult(
              abTestAllocation.testId,
              abTestAllocation.variantId,
              userId,
              metrics
            )

            logger.debug(`A/B测试结果记录成功: ${abTestAllocation.testId}`, {
              userId,
              requestId,
              variantId: abTestAllocation.variantId,
              metrics
            })
          } catch (error) {
            logger.warn('A/B测试结果记录失败', {
              userId,
              requestId,
              testId: abTestAllocation.testId,
              error: error.message
            })
          }
        }

        // Send response
        res.status(response.status).json(transformedResponse)

        logger.info('AI request processed', {
          requestId,
          userId,
          model,
          provider: selectedProvider,
          responseTime,
          statusCode: response.status,
          tokens: tokens.total,
          cost
        })
      })
      .catch(error => {
        const responseTime = Date.now() - startTime

        // Record provider performance
        recordProviderPerformance(selectedProvider, false, responseTime)

        // A/B测试：记录失败请求的结果
        if (abTestAllocation && abTestManager) {
          try {
            const metrics = {
              response_time: responseTime,
              cost: 0,
              quality_score: 0, // 失败请求的质量评分
              error_count: 1 // 错误计数
            }

            await abTestManager.recordResult(
              abTestAllocation.testId,
              abTestAllocation.variantId,
              userId,
              metrics
            )

            logger.debug(`A/B测试错误结果记录成功: ${abTestAllocation.testId}`, {
              userId,
              requestId,
              variantId: abTestAllocation.variantId,
              error: error.code || 'PROVIDER_ERROR'
            })
          } catch (recordError) {
            logger.warn('A/B测试错误结果记录失败', {
              userId,
              requestId,
              testId: abTestAllocation.testId,
              error: recordError.message
            })
          }
        }

        // 记录失败请求统计
        usageAnalytics.recordRequest({
          userId,
          requestId,
          provider: selectedProvider,
          model,
          statusCode: 502,
          error: error.code || 'PROVIDER_ERROR',
          responseTime,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.headers['user-agent']
        })

        logger.error('AI provider request failed', {
          requestId,
          userId,
          model,
          provider: selectedProvider,
          error: error.message,
          responseTime
        })

        // Return error response
        res.status(502).json({
          error: 'AI provider error',
          code: 'PROVIDER_ERROR',
          requestId,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
      })
  }

  // Select best provider based on cost, performance, and availability
  function selectBestProvider (model, req) {
    const availableProviders = modelProviders[model]

    if (!availableProviders || availableProviders.length === 0) {
      return null
    }

    // Filter out providers with circuit breaker open
    const healthyProviders = availableProviders.filter(provider => {
      const stats = providerStats.get(provider)
      return !stats.isCircuitBreakerOpen
    })

    if (healthyProviders.length === 0) {
      // Reset circuit breaker for provider with oldest failure
      const oldestFailure = availableProviders.reduce((oldest, provider) => {
        const stats = providerStats.get(provider)
        if (!oldest || (stats.lastFailureTime && stats.lastFailureTime < oldest.lastFailureTime)) {
          return { provider, lastFailureTime: stats.lastFailureTime }
        }
        return oldest
      }, null)

      if (oldestFailure) {
        const stats = providerStats.get(oldestFailure.provider)
        stats.isCircuitBreakerOpen = false
        stats.errorCount = Math.floor(stats.errorCount * 0.5)
        logger.info(`Circuit breaker reset for provider: ${oldestFailure.provider}`)
        return oldestFailure.provider
      }

      return availableProviders[0] // Fallback
    }

    // Select provider based on cost (cheapest first)
    return healthyProviders.reduce((best, provider) => {
      const bestCost = providers[best].costPerToken[model] || 0
      const providerCost = providers[provider].costPerToken[model] || 0
      return providerCost < bestCost ? provider : best
    })
  }

  // Transform request for specific provider
  function transformRequest (body, provider, parameters) {
    const transformed = { ...body }

    // 转换通用参数为供应商特定格式
    try {
      const providerParameters = parameterManager.transformParameters(parameters, provider, body.model)
      Object.assign(transformed, providerParameters)
    } catch (error) {
      logger.warn(`Parameter transformation failed for ${provider}:`, error.message)
      // 继续处理，使用原始参数
    }

    if (provider === 'anthropic') {
      // Transform OpenAI format to Anthropic format
      if (transformed.messages) {
        // Extract system message
        const systemMessage = transformed.messages.find(msg => msg.role === 'system')
        if (systemMessage) {
          transformed.system = systemMessage.content
          transformed.messages = transformed.messages.filter(msg => msg.role !== 'system')
        }

        // Map roles
        transformed.messages = transformed.messages.map(msg => ({
          ...msg,
          role: msg.role === 'assistant' ? 'assistant' : 'user'
        }))

        // 确保max_tokens参数正确
        if (transformed.max_tokens_to_sample) {
          transformed.max_tokens = transformed.max_tokens_to_sample
          delete transformed.max_tokens_to_sample
        }
      }
    } else if (provider === 'azure') {
      // Azure uses different endpoint structure
      const deploymentName = providers.azure.deploymentMap[body.model] || body.model
      transformed.model = deploymentName
    } else if (provider === 'google_gemini') {
      // Google Gemini format
      if (transformed.messages) {
        // Convert messages to Gemini format
        const lastMessage = transformed.messages[transformed.messages.length - 1]
        transformed.contents = [{
          parts: [{ text: lastMessage.content }]
        }]
        delete transformed.messages
      }
    }

    // 清理不支持的参数
    const providerMapping = parameterManager.parameterMappings.providers[provider]
    if (providerMapping) {
      for (const [commonParam, providerParam] of Object.entries(providerMapping)) {
        if (providerParam === null && transformed[commonParam] !== undefined) {
          delete transformed[commonParam]
          logger.debug(`Removed unsupported parameter: ${commonParam} for ${provider}`)
        }
      }
    }

    return transformed
  }

  // Transform response to unified format
  function transformResponse (data, provider) {
    if (provider === 'anthropic') {
      // Transform Anthropic response to OpenAI-like format
      return {
        id: data.id || `anthropic-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: data.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: data.content?.[0]?.text || ''
          },
          finish_reason: data.stop_reason || 'stop'
        }],
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        }
      }
    }

    return data // OpenAI and Azure already return compatible format
  }

  // Extract token usage from response
  function extractTokenUsage (response, provider) {
    if (!response || !response.usage) {
      return { prompt: 0, completion: 0, total: 0 }
    }

    const usage = response.usage
    return {
      prompt: usage.prompt_tokens || 0,
      completion: usage.completion_tokens || 0,
      total: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
    }
  }

  // Calculate cost based on provider, model and token usage
  function calculateCost (provider, model, tokens) {
    const providerConfig = providers[provider]
    if (!providerConfig || !providerConfig.costPerToken) {
      return 0
    }

    const costPerToken = providerConfig.costPerToken[model] || 0
    return costPerToken * (tokens.total || 0)
  }

  // Build target URL
  function buildTargetUrl (providerConfig, originalUrl, requestBody) {
    let endpoint = originalUrl

    if (providerConfig === providers.azure) {
      // Azure uses deployment-based URLs
      const deploymentName = providers.azure.deploymentMap[requestBody.model] || requestBody.model
      endpoint = `/openai/deployments/${deploymentName}/chat/completions?api-version=2023-12-01`
    }

    return `${providerConfig.baseUrl}${endpoint}`
  }

  // Build headers for provider
  function buildHeaders (providerConfig, originalHeaders, keyData) {
    const headers = { ...originalHeaders }

    // Remove hop-by-hop headers
    delete headers.host
    delete headers.connection
    delete headers['keep-alive']
    delete headers['proxy-authenticate']
    delete headers['proxy-authorization']
    delete headers.te
    delete headers.trailers
    delete headers['transfer-encoding']
    delete headers.upgrade

    // Set content type
    headers['content-type'] = 'application/json'

    // Add provider-specific authentication using key from key manager
    if (keyData && keyData.key) {
      if (selectedProvider === 'openai' || selectedProvider === 'azure') {
        headers['Authorization'] = `Bearer ${keyData.key}`
      } else if (selectedProvider === 'anthropic') {
        headers['x-api-key'] = keyData.key
      } else if (selectedProvider === 'google_gemini') {
        headers['x-goog-api-key'] = keyData.key
      } else {
        // For other providers, use Bearer token by default
        headers['Authorization'] = `Bearer ${keyData.key}`
      }
    } else {
      // Fallback to legacy method if keyData is not available
      const apiKey = getApiKey(providerConfig)
      if (apiKey) {
        if (providerConfig.authPrefix) {
          headers[providerConfig.authHeader] = `${providerConfig.authPrefix} ${apiKey}`
        } else {
          headers[providerConfig.authHeader] = apiKey
        }
      }
    }

    return headers
  }

  // Get API key for provider
  function getApiKey (providerConfig) {
    // In production, these should come from secure environment variables
    const keyMap = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      azure: process.env.AZURE_OPENAI_API_KEY
    }

    return keyMap[providerConfig.name || Object.keys(providers).find(key => providers[key] === providerConfig)]
  }

  // Record provider performance
  function recordProviderPerformance (provider, success, responseTime) {
    const stats = providerStats.get(provider)
    if (!stats) return

    stats.totalRequests++
    if (success) {
      stats.successCount++
      stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests
    } else {
      stats.errorCount++
      stats.lastFailureTime = Date.now()

      // Circuit breaker logic
      const errorRate = stats.errorCount / stats.totalRequests
      if (errorRate > 0.5 && stats.totalRequests > 10) {
        stats.isCircuitBreakerOpen = true
        logger.warn(`Circuit breaker opened for provider: ${provider}`, { errorRate, totalRequests: stats.totalRequests })
      }
    }

    providerStats.set(provider, stats)
  }
}

// Configuration validation function
function validateConfiguration (params) {
  const errors = []

  if (!params) {
    errors.push('Configuration object is required')
    return errors
  }

  // Validate timeout
  if (params.timeout !== undefined) {
    if (typeof params.timeout !== 'number' || params.timeout < 1000 || params.timeout > 300000) {
      errors.push('timeout must be a number between 1000 and 300000 milliseconds')
    }
  }

  // Validate retry attempts
  if (params.retryAttempts !== undefined) {
    if (typeof params.retryAttempts !== 'number' || params.retryAttempts < 0 || params.retryAttempts > 10) {
      errors.push('retryAttempts must be a number between 0 and 10')
    }
  }

  // Validate routing strategy
  if (params.routingStrategy !== undefined) {
    const validStrategies = ['cost', 'performance', 'availability', 'round-robin']
    if (!validStrategies.includes(params.routingStrategy)) {
      errors.push(`routingStrategy must be one of: ${validStrategies.join(', ')}`)
    }
  }

  // Validate health check interval
  if (params.healthCheckInterval !== undefined) {
    if (typeof params.healthCheckInterval !== 'number' || params.healthCheckInterval < 10000 || params.healthCheckInterval > 3600000) {
      errors.push('healthCheckInterval must be a number between 10000 and 3600000 milliseconds')
    }
  }

  return errors
}

// 计算AI响应质量评分 (0-100)
/**
 * 简单的质量评分算法，基于响应长度、内容丰富度和格式规范性
 * @param {Object} response - AI API响应
 * @param {string} model - 使用的模型
 * @returns {number} 质量评分 (0-100)
 */
function calculateQualityScore(response, model) {
  try {
    if (!response || typeof response !== 'object') {
      return 0
    }

    let score = 50 // 基础分数

    // 检查响应结构
    if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
      const choice = response.choices[0]

      if (choice.message && choice.message.content) {
        const content = choice.message.content

        // 内容长度评分 (10分)
        const length = content.length
        if (length > 500) score += 10
        else if (length > 200) score += 5
        else if (length < 50) score -= 5

        // 内容丰富度评分 (20分)
        const sentences = content.split(/[.!?]+/).length
        const words = content.split(/\s+/).length
        const avgWordsPerSentence = words / Math.max(sentences, 1)

        if (avgWordsPerSentence > 15) score += 10 // 句子结构好
        else if (avgWordsPerSentence > 10) score += 5
        else if (avgWordsPerSentence < 5) score -= 5

        // 词汇多样性评分 (10分)
        const uniqueWords = new Set(content.toLowerCase().split(/\s+/)).size
        const diversityRatio = uniqueWords / Math.max(words, 1)
        if (diversityRatio > 0.6) score += 10
        else if (diversityRatio > 0.4) score += 5

        // 格式规范性评分 (10分)
        if (content.includes('\n\n')) score += 5 // 有段落分隔
        if (/^[A-Z]/.test(content)) score += 5 // 首字母大写
      }

      // 完成状态评分 (10分)
      if (choice.finish_reason === 'stop') score += 10
      else if (choice.finish_reason === 'length') score += 5
    }

    // 模型特定评分调整
    if (model.includes('gpt-4')) {
      score += 5 // GPT-4 基础分数更高
    } else if (model.includes('claude')) {
      score += 3 // Claude 基础分数较高
    }

    // 确保分数在0-100范围内
    return Math.max(0, Math.min(100, Math.round(score)))
  } catch (error) {
    console.warn('质量评分计算失败:', error.message)
    return 50 // 默认中等分数
  }
}

// 计算请求的预估成本
function calculateEstimatedCost(model, parameters) {
  try {
    const { max_tokens = 1000 } = parameters

    // 简化的成本估算，实际应用中应该基于历史数据和更精确的模型
    const costPerThousandTokens = {
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.015,
      'claude-3-sonnet': 0.003,
      'claude-3-haiku': 0.00025
    }

    const costPerToken = costPerThousandTokens[model] || 0.01
    return (max_tokens / 1000) * costPerToken
  } catch (error) {
    return 0.01 // 默认预估成本
  }
}
