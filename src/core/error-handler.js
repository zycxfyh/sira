/**
 * Sira AI网关 - 错误处理和重试机制
 * 处理AI供应商连接错误、API限流、超时等异常情况
 */

const EventEmitter = require('events')

class AIErrorHandler extends EventEmitter {
  constructor (options = {}) {
    super()
    this.maxRetries = options.maxRetries || 3
    this.baseDelay = options.baseDelay || 1000 // 1秒
    this.maxDelay = options.maxDelay || 30000 // 30秒
    this.backoffMultiplier = options.backoffMultiplier || 2
    this.jitter = options.jitter !== false // 默认启用抖动
    this.retryableErrors = new Set([
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'EAI_AGAIN',
      'rate_limit_exceeded',
      'quota_exceeded',
      'temporary_server_error',
      'internal_server_error',
      'bad_gateway',
      'service_unavailable',
      'gateway_timeout'
    ])
  }

  /**
     * 检查错误是否可以重试
     * @param {Error} error - 错误对象
     * @param {Object} response - API响应
     * @returns {boolean} 是否可以重试
     */
  isRetryableError (error, response) {
    // 检查HTTP状态码 - 更精确的重试逻辑
    if (response && response.status) {
      const status = response.status

      // 明确的重试状态码
      if (status === 429) return true // Rate limit - 应该重试
      if (status === 408) return true // Request timeout - 应该重试
      if (status === 503) return true // Service unavailable - 临时问题，应该重试
      if (status === 502) return true // Bad gateway - 网关问题，应该重试
      if (status === 504) return true // Gateway timeout - 应该重试

      // 谨慎对待5xx错误 - 有些永远不会成功
      if (status >= 500 && status < 600) {
        // 不重试的服务器错误
        if (status === 501) return false // Not implemented - 永久错误
        if (status === 505) return false // HTTP version not supported - 永久错误
        if (status === 507) return false // Insufficient storage - 通常是永久问题

        // 其他5xx错误可以重试，但要小心
        return true
      }

      // 客户端错误通常不应该重试
      if (status >= 400 && status < 500) {
        return false
      }
    }

    // 检查错误码 - 使用预定义的重试错误集合
    if (error && error.code) {
      if (this.retryableErrors.has(error.code)) return true
    }

    // 检查网络相关错误 - 减少对消息文本的依赖
    if (error && error.code) {
      const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN']
      if (networkErrors.includes(error.code)) return true
    }

    // 检查API特定的错误类型 - 更结构化的方法
    if (response && response.error) {
      const errorType = response.error.type || response.error.code
      if (errorType && this.retryableErrors.has(errorType)) return true

      // 检查特定的错误类型
      const retryableTypes = ['rate_limit_error', 'timeout_error', 'server_overloaded', 'temporary_failure']
      if (errorType && retryableTypes.includes(errorType.toLowerCase())) return true
    }

    // 对于未知错误，默认不重试 - 更保守的方法
    return false
  }

  /**
     * 计算下次重试的延迟时间
     * @param {number} attempt - 当前重试次数 (从1开始)
     * @returns {number} 延迟时间(毫秒)
     */
  calculateDelay (attempt) {
    let delay = this.baseDelay * Math.pow(this.backoffMultiplier, attempt - 1)

    // 应用最大延迟限制
    delay = Math.min(delay, this.maxDelay)

    // 添加抖动以避免惊群效应
    if (this.jitter) {
      const jitter = delay * 0.1 * Math.random() // 10%的随机抖动
      delay += jitter
    }

    return Math.floor(delay)
  }

  /**
     * 执行重试逻辑
     * @param {Function} operation - 要执行的操作函数
     * @param {Object} options - 重试选项
     * @returns {Promise} 执行结果
     */
  async withRetry (operation, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries
    const context = options.context || {}

    let lastError

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        this.emit('attempt', { attempt, maxRetries, context })

        const result = await operation()

        if (attempt > 1) {
          this.emit('retrySuccess', { attempt, maxRetries, context, result })
        }

        return result
      } catch (error) {
        lastError = error

        // 检查是否可以重试
        const shouldRetry = attempt <= maxRetries && this.isRetryableError(error, context.response)

        this.emit('error', {
          attempt,
          maxRetries,
          error,
          context,
          willRetry: shouldRetry
        })

        if (!shouldRetry) {
          break
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt)
        this.emit('retry', { attempt, maxRetries, delay, context, error })

        // 等待延迟
        await this.sleep(delay)
      }
    }

    // 所有重试都失败
    this.emit('exhausted', { maxRetries, lastError, context })
    throw lastError
  }

  /**
     * 睡眠函数
     * @param {number} ms - 睡眠毫秒数
     */
  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
     * 创建供应商特定的错误处理器
     * @param {string} provider - 供应商名称
     * @returns {AIErrorHandler} 供应商特定的错误处理器
     */
  createProviderHandler (provider) {
    const providerConfig = this.getProviderConfig(provider)
    return new AIErrorHandler(providerConfig)
  }

  /**
     * 获取供应商特定的配置
     * @param {string} provider - 供应商名称
     * @returns {Object} 供应商配置
     */
  getProviderConfig (provider) {
    const providerConfigs = {
      openai: {
        maxRetries: 3,
        baseDelay: 1000,
        retryableErrors: new Set([
          'rate_limit_exceeded',
          'internal_server_error',
          'bad_gateway',
          'service_unavailable'
        ])
      },
      anthropic: {
        maxRetries: 3,
        baseDelay: 2000,
        retryableErrors: new Set([
          'rate_limit_error',
          'overloaded_error',
          'internal_error'
        ])
      },
      deepseek: {
        maxRetries: 3,
        baseDelay: 1000,
        retryableErrors: new Set([
          'rate_limit_reached',
          'internal_server_error',
          'service_unavailable'
        ])
      },
      default: {
        maxRetries: 3,
        baseDelay: 1000
      }
    }

    return providerConfigs[provider] || providerConfigs.default
  }

  /**
     * 格式化错误信息
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     * @returns {Object} 格式化的错误信息
     */
  formatError (error, context = {}) {
    return {
      timestamp: new Date().toISOString(),
      provider: context.provider || 'unknown',
      operation: context.operation || 'unknown',
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      },
      context: {
        attempt: context.attempt,
        maxRetries: context.maxRetries,
        requestId: context.requestId,
        model: context.model,
        tokens: context.tokens
      },
      retryable: this.isRetryableError(error, context.response),
      suggestion: this.getErrorSuggestion(error, context)
    }
  }

  /**
     * 获取错误处理建议
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     * @returns {string} 处理建议
     */
  getErrorSuggestion (error, context) {
    const errorCode = error.code || (error.response && error.response.error && error.response.error.code)
    const statusCode = error.response && error.response.status

    // API密钥错误
    if (errorCode === 'invalid_api_key' || errorCode === 'unauthorized') {
      return '请检查API密钥是否正确配置'
    }

    // 配额不足
    if (errorCode === 'quota_exceeded' || errorCode === 'insufficient_quota') {
      return 'API使用配额已耗尽，请充值或升级套餐'
    }

    // 频率限制
    if (errorCode === 'rate_limit_exceeded' || statusCode === 429) {
      return '请求频率过高，请稍后重试或降低请求频率'
    }

    // 模型不存在
    if (errorCode === 'model_not_found' || error.message.includes('model')) {
      return '指定的模型不存在或不可用，请检查模型名称'
    }

    // 网络错误
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return '网络连接失败，请检查网络连接和API端点'
    }

    // 超时错误
    if (error.code === 'ETIMEDOUT' || statusCode === 408) {
      return '请求超时，请检查网络连接或增加超时时间'
    }

    // 服务器错误
    if (statusCode >= 500) {
      return '服务器内部错误，请稍后重试或联系供应商支持'
    }

    return '请查看详细错误信息，或联系技术支持'
  }

  /**
     * 记录错误日志
     * @param {Object} formattedError - 格式化的错误信息
     */
  logError (formattedError) {
    const logLevel = formattedError.retryable ? 'WARN' : 'ERROR'

    console.log(`[${logLevel}] ${formattedError.timestamp} - ${formattedError.provider} ${formattedError.operation}`)
    console.log(`  错误: ${formattedError.error.message}`)
    console.log(`  建议: ${formattedError.suggestion}`)

    if (formattedError.context.attempt > 1) {
      console.log(`  重试: ${formattedError.context.attempt}/${formattedError.context.maxRetries}`)
    }

    this.emit('logged', formattedError)
  }
}

// 导出单例实例
const errorHandler = new AIErrorHandler()

// 导出类和实例
module.exports = {
  AIErrorHandler,
  errorHandler
}
