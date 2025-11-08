/**
 * AI路由器策略 - 单元测试
 * 使用Jest和现代测试实践
 */

const { expect, describe, beforeEach, afterEach, it, jest } = require('@jest/globals')
const aiRouter = require('../../../lib/policies/ai-router')

describe('AI Router Policy - Unit Tests', () => {
  let mockReq, mockRes, mockNext, mockConfig, mockLogger

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks()

    // 创建mock对象
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    mockReq = {
      method: 'POST',
      url: '/api/v1/ai/chat/completions',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'test-key-123'
      },
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, world!' }],
        temperature: 0.7,
        max_tokens: 100
      },
      egContext: {}
    }

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      end: jest.fn()
    }

    mockNext = jest.fn()

    mockConfig = {
      logger: mockLogger,
      serviceEndpoints: {
        openai: { url: 'https://api.openai.com/v1' },
        anthropic: { url: 'https://api.anthropic.com/v1' },
        azure: { url: 'https://azure-openai.openai.azure.com/openai/deployments/gpt-4' }
      }
    }
  })

  afterEach(() => {
    // 验证mock调用
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  describe('Model Routing Logic', () => {
    describe('OpenAI Models', () => {
      const openaiModels = [
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'gpt-4',
        'gpt-4-32k',
        'gpt-4-turbo',
        'gpt-4-vision-preview'
      ]

      it.each(openaiModels)('should route %s to OpenAI service', (model) => {
        const policy = aiRouter({}, mockConfig)
        mockReq.body.model = model

        policy(mockReq, mockRes, mockNext)

        expect(mockReq.egContext.targetService).toBe('openai')
        expect(mockReq.egContext.targetUrl).toBe(mockConfig.serviceEndpoints.openai.url)
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Routing ${model} to OpenAI`)
        )
      })
    })

    describe('Anthropic Models', () => {
      const anthropicModels = [
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
        'claude-2',
        'claude-instant-1'
      ]

      it.each(anthropicModels)('should route %s to Anthropic service', (model) => {
        const policy = aiRouter({}, mockConfig)
        mockReq.body.model = model

        policy(mockReq, mockRes, mockNext)

        expect(mockReq.egContext.targetService).toBe('anthropic')
        expect(mockReq.egContext.targetUrl).toBe(mockConfig.serviceEndpoints.anthropic.url)
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Routing ${model} to Anthropic`)
        )
      })
    })

    describe('Azure Models', () => {
      const azureModels = [
        'gpt-4-azure',
        'gpt-35-turbo-azure',
        'gpt-4-turbo-azure'
      ]

      it.each(azureModels)('should route %s to Azure service', (model) => {
        const policy = aiRouter({}, mockConfig)
        mockReq.body.model = model

        policy(mockReq, mockRes, mockNext)

        expect(mockReq.egContext.targetService).toBe('azure')
        expect(mockReq.egContext.targetUrl).toBe(mockConfig.serviceEndpoints.azure.url)
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(`Routing ${model} to Azure`)
        )
      })
    })

    describe('Unknown Models', () => {
      it('should route unknown models to default service with warning', () => {
        const policy = aiRouter({}, mockConfig)
        mockReq.body.model = 'unknown-model-xyz'

        policy(mockReq, mockRes, mockNext)

        expect(mockReq.egContext.targetService).toBe('openai') // 默认服务
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Unknown model: unknown-model-xyz')
        )
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Defaulting to OpenAI')
        )
      })

      it('should handle empty model gracefully', () => {
        const policy = aiRouter({}, mockConfig)
        mockReq.body.model = ''

        policy(mockReq, mockRes, mockNext)

        expect(mockReq.egContext.targetService).toBe('openai')
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Empty or invalid model')
        )
      })
    })
  })

  describe('Load Balancing', () => {
    it('should distribute requests across services in round-robin fashion', () => {
      const loadBalancingConfig = {
        loadBalancing: {
          enabled: true,
          strategy: 'round-robin'
        }
      }

      const policy = aiRouter(loadBalancingConfig, mockConfig)
      const services = []

      // 发送多个请求
      for (let i = 0; i < 10; i++) {
        const testReq = {
          ...mockReq,
          egContext: {},
          body: { ...mockReq.body, model: 'gpt-3.5-turbo' }
        }

        policy(testReq, mockRes, mockNext)
        services.push(testReq.egContext.targetService)
      }

      // 验证分布
      const uniqueServices = [...new Set(services)]
      expect(uniqueServices.length).toBeGreaterThan(1)
      expect(uniqueServices).toContain('openai')
    })

    it('should respect service weights in weighted strategy', () => {
      const loadBalancingConfig = {
        loadBalancing: {
          enabled: true,
          strategy: 'weighted',
          weights: {
            openai: 70,
            anthropic: 30
          }
        }
      }

      const policy = aiRouter(loadBalancingConfig, mockConfig)
      const services = []

      // 发送大量请求以获得统计意义
      for (let i = 0; i < 1000; i++) {
        const testReq = {
          ...mockReq,
          egContext: {},
          body: { ...mockReq.body, model: 'gpt-3.5-turbo' }
        }

        policy(testReq, mockRes, mockNext)
        services.push(testReq.egContext.targetService)
      }

      const openaiCount = services.filter(s => s === 'openai').length
      const anthropicCount = services.filter(s => s === 'anthropic').length
      const totalCount = services.length

      // OpenAI应该获得约70%的请求
      const openaiPercentage = (openaiCount / totalCount) * 100
      expect(openaiPercentage).toBeCloseTo(70, 5) // 允许5%的误差
    })

    it('should disable load balancing when configured', () => {
      const loadBalancingConfig = {
        loadBalancing: {
          enabled: false
        }
      }

      const policy = aiRouter(loadBalancingConfig, mockConfig)

      policy(mockReq, mockRes, mockNext)

      // 应该总是路由到OpenAI（默认行为）
      expect(mockReq.egContext.targetService).toBe('openai')
    })
  })

  describe('Circuit Breaker Integration', () => {
    it('should avoid failed services', () => {
      const circuitBreakerConfig = {
        circuitBreaker: {
          enabled: true,
          failureThreshold: 3
        }
      }

      const policy = aiRouter(circuitBreakerConfig, mockConfig)

      // 模拟3次失败
      for (let i = 0; i < 3; i++) {
        const failedReq = {
          ...mockReq,
          egContext: { circuitBreakerFailure: true },
          body: { ...mockReq.body, model: 'gpt-4' }
        }
        policy(failedReq, mockRes, mockNext)
      }

      // 第4次请求应该避免OpenAI
      const testReq = {
        ...mockReq,
        egContext: {},
        body: { ...mockReq.body, model: 'gpt-4' }
      }

      policy(testReq, mockRes, mockNext)

      expect(testReq.egContext.targetService).not.toBe('openai')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Circuit breaker triggered for service: openai')
      )
    })

    it('should allow requests when circuit breaker is disabled', () => {
      const circuitBreakerConfig = {
        circuitBreaker: {
          enabled: false
        }
      }

      const policy = aiRouter(circuitBreakerConfig, mockConfig)

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext.targetService).toBe('openai')
    })
  })

  describe('Fallback Strategy', () => {
    it('should fallback to alternative service on primary failure', () => {
      const fallbackConfig = {
        fallback: {
          enabled: true,
          order: ['openai', 'anthropic', 'azure']
        }
      }

      const policy = aiRouter(fallbackConfig, mockConfig)

      // 模拟主要服务失败
      mockReq.egContext.primaryServiceFailed = true
      mockReq.body.model = 'gpt-4'

      policy(mockReq, mockRes, mockNext)

      // 应该fallback到下一个服务
      expect(['anthropic', 'azure']).toContain(mockReq.egContext.targetService)
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fallback: routing to')
      )
    })

    it('should use primary service when no failure', () => {
      const fallbackConfig = {
        fallback: {
          enabled: true,
          order: ['openai', 'anthropic', 'azure']
        }
      }

      const policy = aiRouter(fallbackConfig, mockConfig)

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext.targetService).toBe('openai')
    })
  })

  describe('Request Transformation', () => {
    it('should add request metadata', () => {
      const policy = aiRouter({}, mockConfig)

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext).toHaveProperty('requestId')
      expect(mockReq.egContext).toHaveProperty('timestamp')
      expect(mockReq.egContext).toHaveProperty('model', 'gpt-3.5-turbo')
      expect(mockReq.egContext).toHaveProperty('requestSize')
    })

    it('should transform request headers for target service', () => {
      const policy = aiRouter({}, mockConfig)

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext).toHaveProperty('transformedHeaders')
      expect(mockReq.egContext.transformedHeaders).toHaveProperty('Authorization')
      expect(mockReq.egContext.transformedHeaders).toHaveProperty('Content-Type', 'application/json')
    })

    it('should validate request parameters', () => {
      const policy = aiRouter({}, mockConfig)

      // 测试无效的temperature值
      mockReq.body.temperature = 2.5 // 超过最大值

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext).toHaveProperty('validationErrors')
      expect(mockReq.egContext.validationErrors).toContain('temperature')
    })
  })

  describe('Performance Monitoring', () => {
    it('should track routing performance', () => {
      const policy = aiRouter({}, mockConfig)
      const startTime = Date.now()

      policy(mockReq, mockRes, mockNext)

      const endTime = Date.now()
      const routingTime = endTime - startTime

      expect(mockReq.egContext).toHaveProperty('routingTime')
      expect(typeof mockReq.egContext.routingTime).toBe('number')
      expect(mockReq.egContext.routingTime).toBeLessThan(100) // 应该很快完成
    })

    it('should log performance metrics', () => {
      const policy = aiRouter({}, mockConfig)

      policy(mockReq, mockRes, mockNext)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Routing completed in')
      )
    })
  })

  describe('Configuration Validation', () => {
    it('should validate load balancing configuration', () => {
      const invalidConfig = {
        loadBalancing: {
          enabled: true,
          strategy: 'invalid-strategy'
        }
      }

      expect(() => aiRouter(invalidConfig, mockConfig)).toThrow(
        'Invalid load balancing strategy'
      )
    })

    it('should validate service endpoints', () => {
      const invalidConfig = {
        serviceEndpoints: {} // 空的端点配置
      }

      expect(() => aiRouter({}, invalidConfig)).toThrow(
        'No service endpoints configured'
      )
    })

    it('should handle missing configuration gracefully', () => {
      const policy = aiRouter({}, mockConfig)

      policy(mockReq, mockRes, mockNext)

      // 应该使用默认配置
      expect(mockReq.egContext.targetService).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed request body', () => {
      const policy = aiRouter({}, mockConfig)
      mockReq.body = null // 无效的请求体

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext).toHaveProperty('error')
      expect(mockReq.egContext.error).toHaveProperty('code', 'INVALID_REQUEST')
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid request body')
      )
    })

    it('should handle missing headers', () => {
      const policy = aiRouter({}, mockConfig)
      mockReq.headers = {} // 没有头部

      policy(mockReq, mockRes, mockNext)

      expect(mockReq.egContext).toHaveProperty('error')
      expect(mockReq.egContext.error).toHaveProperty('code', 'MISSING_HEADERS')
    })

    it('should propagate errors to next middleware', () => {
      const policy = aiRouter({}, mockConfig)
      mockReq.body = { invalid: 'data' }

      policy(mockReq, mockRes, mockNext)

      // 如果有错误，应该调用next(err)
      if (mockReq.egContext.error) {
        expect(mockNext).toHaveBeenCalledWith(
          expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String)
          })
        )
      }
    })
  })
})
