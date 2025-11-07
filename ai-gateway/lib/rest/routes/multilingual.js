const express = require('express')
const { getMultilingualManager } = require('../../middleware/localization')

let multilingualManager = null

/**
 * 多语言API路由
 * 借鉴i18n REST API和语言服务平台的优秀设计理念
 * 提供完整的多语言管理和翻译服务接口
 */
function multilingualRoutes() {
  const router = express.Router()

  // 获取多语言管理器实例
  multilingualManager = getMultilingualManager()

  // ==================== 语言检测和管理 ====================

  /**
   * GET /multilingual/languages
   * 获取支持的语言列表
   */
  router.get('/languages', async (req, res) => {
    try {
      const languages = {}

      for (const [code, info] of Object.entries(multilingualManager.supportedLanguages)) {
        languages[code] = {
          code,
          name: info.name,
          nativeName: info.nativeName,
          flag: info.flag,
          fallback: info.fallback,
          rtl: info.rtl,
          isDefault: code === multilingualManager.defaultLanguage
        }
      }

      res.json({
        success: true,
        data: languages,
        defaultLanguage: multilingualManager.defaultLanguage
      })
    } catch (error) {
      console.error('获取语言列表失败:', error)
      res.status(500).json({
        success: false,
        error: '获取语言列表失败',
        message: error.message
      })
    }
  })

  /**
   * POST /multilingual/detect
   * 检测文本语言
   */
  router.post('/detect', async (req, res) => {
    try {
      const { text, context = {} } = req.body

      if (!text) {
        return res.status(400).json({
          success: false,
          error: '缺少文本内容',
          required: ['text']
        })
      }

      // 创建模拟请求对象用于语言检测
      const mockRequest = {
        headers: req.headers,
        query: req.query
      }

      const detection = multilingualManager.detectLanguage(mockRequest, {
        userId: context.userId,
        ip: req.ip,
        ...context
      })

      res.json({
        success: true,
        data: {
          language: detection.language,
          confidence: detection.confidence,
          method: detection.method,
          languageInfo: multilingualManager.supportedLanguages[detection.language]
        }
      })
    } catch (error) {
      console.error('语言检测失败:', error)
      res.status(500).json({
        success: false,
        error: '语言检测失败',
        message: error.message
      })
    }
  })

  /**
   * GET /multilingual/current
   * 获取当前请求的语言信息
   */
  router.get('/current', async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          language: req.language,
          confidence: req.languageConfidence,
          detectionMethod: req.languageDetectionMethod,
          languageInfo: multilingualManager.supportedLanguages[req.language],
          supportedLanguages: Object.keys(multilingualManager.supportedLanguages)
        }
      })
    } catch (error) {
      console.error('获取当前语言信息失败:', error)
      res.status(500).json({
        success: false,
        error: '获取当前语言信息失败',
        message: error.message
      })
    }
  })

  // ==================== 翻译服务 ====================

  /**
   * POST /multilingual/translate
   * 翻译文本
   */
  router.post('/translate', async (req, res) => {
    try {
      const { text, fromLanguage, toLanguage, options = {} } = req.body

      if (!text) {
        return res.status(400).json({
          success: false,
          error: '缺少文本内容',
          required: ['text']
        })
      }

      const from = fromLanguage || 'auto'
      const to = toLanguage || req.language || multilingualManager.defaultLanguage

      if (!multilingualManager.supportedLanguages[to]) {
        return res.status(400).json({
          success: false,
          error: '不支持的目标语言',
          supportedLanguages: Object.keys(multilingualManager.supportedLanguages)
        })
      }

      const translation = await multilingualManager.translate(text, from, to, options)

      res.json({
        success: true,
        data: {
          originalText: text,
          translatedText: translation,
          fromLanguage: from,
          toLanguage: to,
          provider: multilingualManager.activeProvider
        }
      })
    } catch (error) {
      console.error('翻译失败:', error)
      res.status(500).json({
        success: false,
        error: '翻译失败',
        message: error.message
      })
    }
  })

  /**
   * POST /multilingual/translate-batch
   * 批量翻译文本
   */
  router.post('/translate-batch', async (req, res) => {
    try {
      const { texts, fromLanguage, toLanguage, options = {} } = req.body

      if (!texts || !Array.isArray(texts)) {
        return res.status(400).json({
          success: false,
          error: '缺少文本列表',
          required: ['texts']
        })
      }

      if (texts.length > 100) {
        return res.status(400).json({
          success: false,
          error: '批量翻译数量不能超过100个'
        })
      }

      const from = fromLanguage || 'auto'
      const to = toLanguage || req.language || multilingualManager.defaultLanguage

      const translations = await Promise.all(
        texts.map(async (text, index) => {
          try {
            const translation = await multilingualManager.translate(text, from, to, options)
            return {
              index,
              originalText: text,
              translatedText: translation,
              success: true
            }
          } catch (error) {
            return {
              index,
              originalText: text,
              error: error.message,
              success: false
            }
          }
        })
      )

      const successful = translations.filter(t => t.success).length
      const failed = translations.filter(t => !t.success).length

      res.json({
        success: true,
        data: {
          translations,
          stats: {
            total: translations.length,
            successful,
            failed
          },
          fromLanguage: from,
          toLanguage: to,
          provider: multilingualManager.activeProvider
        }
      })
    } catch (error) {
      console.error('批量翻译失败:', error)
      res.status(500).json({
        success: false,
        error: '批量翻译失败',
        message: error.message
      })
    }
  })

  // ==================== 用户语言偏好管理 ====================

  /**
   * GET /multilingual/preferences/:userId
   * 获取用户语言偏好
   */
  router.get('/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params

      const preferences = multilingualManager.getUserLanguagePreference(userId)

      res.json({
        success: true,
        data: preferences
      })
    } catch (error) {
      console.error('获取用户语言偏好失败:', error)
      res.status(500).json({
        success: false,
        error: '获取用户语言偏好失败',
        message: error.message
      })
    }
  })

  /**
   * POST /multilingual/preferences/:userId
   * 设置用户语言偏好
   */
  router.post('/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params
      const { language, ...preferences } = req.body

      if (!language) {
        return res.status(400).json({
          success: false,
          error: '缺少语言设置',
          required: ['language']
        })
      }

      if (!multilingualManager.supportedLanguages[language]) {
        return res.status(400).json({
          success: false,
          error: '不支持的语言',
          supportedLanguages: Object.keys(multilingualManager.supportedLanguages)
        })
      }

      const updatedPreferences = await multilingualManager.setUserLanguagePreference(userId, language, preferences)

      res.json({
        success: true,
        data: updatedPreferences,
        message: '用户语言偏好已更新'
      })
    } catch (error) {
      console.error('设置用户语言偏好失败:', error)
      res.status(400).json({
        success: false,
        error: '设置用户语言偏好失败',
        message: error.message
      })
    }
  })

  // ==================== 翻译资源管理 ====================

  /**
   * GET /multilingual/resources/:language/:namespace?
   * 获取翻译资源
   */
  router.get('/resources/:language/:namespace?', async (req, res) => {
    try {
      const { language, namespace = 'common' } = req.params

      if (!multilingualManager.supportedLanguages[language]) {
        return res.status(400).json({
          success: false,
          error: '不支持的语言',
          supportedLanguages: Object.keys(multilingualManager.supportedLanguages)
        })
      }

      const resources = await multilingualManager.getLocalizedResource('', language, namespace)

      res.json({
        success: true,
        data: resources,
        language,
        namespace
      })
    } catch (error) {
      console.error('获取翻译资源失败:', error)
      res.status(500).json({
        success: false,
        error: '获取翻译资源失败',
        message: error.message
      })
    }
  })

  /**
   * POST /multilingual/resources/:language/:namespace
   * 添加翻译资源
   */
  router.post('/resources/:language/:namespace', async (req, res) => {
    try {
      const { language, namespace } = req.params
      const resources = req.body

      if (!multilingualManager.supportedLanguages[language]) {
        return res.status(400).json({
          success: false,
          error: '不支持的语言',
          supportedLanguages: Object.keys(multilingualManager.supportedLanguages)
        })
      }

      if (!resources || typeof resources !== 'object') {
        return res.status(400).json({
          success: false,
          error: '缺少翻译资源数据'
        })
      }

      const updatedResources = await multilingualManager.addTranslationResource(language, namespace, resources)

      res.json({
        success: true,
        data: updatedResources,
        message: `翻译资源已添加: ${language}.${namespace}`
      })
    } catch (error) {
      console.error('添加翻译资源失败:', error)
      res.status(400).json({
        success: false,
        error: '添加翻译资源失败',
        message: error.message
      })
    }
  })

  // ==================== 翻译提供商管理 ====================

  /**
   * GET /multilingual/providers
   * 获取翻译提供商信息
   */
  router.get('/providers', async (req, res) => {
    try {
      const providers = {}

      for (const [key, provider] of Object.entries(multilingualManager.translationProviders)) {
        providers[key] = {
          name: provider.name,
          enabled: provider.enabled,
          supportedLanguages: provider.supportedLanguages,
          rateLimit: provider.rateLimit,
          isActive: key === multilingualManager.activeProvider
        }
      }

      res.json({
        success: true,
        data: providers,
        activeProvider: multilingualManager.activeProvider
      })
    } catch (error) {
      console.error('获取翻译提供商失败:', error)
      res.status(500).json({
        success: false,
        error: '获取翻译提供商失败',
        message: error.message
      })
    }
  })

  /**
   * POST /multilingual/providers/:provider/switch
   * 切换翻译提供商
   */
  router.post('/providers/:provider/switch', async (req, res) => {
    try {
      const { provider } = req.params

      if (!multilingualManager.translationProviders[provider]) {
        return res.status(400).json({
          success: false,
          error: '未知的翻译提供商',
          availableProviders: Object.keys(multilingualManager.translationProviders)
        })
      }

      const providerConfig = multilingualManager.translationProviders[provider]
      if (!providerConfig.enabled) {
        return res.status(400).json({
          success: false,
          error: '翻译提供商未启用',
          message: `${providerConfig.name} 提供商未配置或未启用`
        })
      }

      const oldProvider = multilingualManager.activeProvider
      multilingualManager.activeProvider = provider
      await multilingualManager.saveConfiguration()

      console.log(`🔄 翻译提供商已切换: ${multilingualManager.translationProviders[oldProvider].name} -> ${providerConfig.name}`)

      res.json({
        success: true,
        data: {
          activeProvider: provider,
          providerInfo: {
            name: providerConfig.name,
            supportedLanguages: providerConfig.supportedLanguages,
            rateLimit: providerConfig.rateLimit
          }
        },
        message: `翻译提供商已切换到 ${providerConfig.name}`
      })
    } catch (error) {
      console.error('切换翻译提供商失败:', error)
      res.status(500).json({
        success: false,
        error: '切换翻译提供商失败',
        message: error.message
      })
    }
  })

  // ==================== 统计和监控 ====================

  /**
   * GET /multilingual/stats
   * 获取翻译统计信息
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = multilingualManager.getTranslationStatistics()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('获取翻译统计失败:', error)
      res.status(500).json({
        success: false,
        error: '获取翻译统计失败',
        message: error.message
      })
    }
  })

  /**
   * GET /multilingual/cache
   * 获取缓存状态
   */
  router.get('/cache', async (req, res) => {
    try {
      const cacheStats = {
        enabled: true, // 缓存总是启用的
        size: multilingualManager.translationCache.size,
        estimatedMemoryUsage: multilingualManager.translationCache.size * 1024, // 粗略估算
        hitRate: multilingualManager.getTranslationStatistics().cacheHitRate
      }

      res.json({
        success: true,
        data: cacheStats
      })
    } catch (error) {
      console.error('获取缓存状态失败:', error)
      res.status(500).json({
        success: false,
        error: '获取缓存状态失败',
        message: error.message
      })
    }
  })

  /**
   * POST /multilingual/cache/clear
   * 清除翻译缓存
   */
  router.post('/cache/clear', async (req, res) => {
    try {
      const result = multilingualManager.clearTranslationCache()

      res.json({
        success: true,
        data: result,
        message: '翻译缓存已清理'
      })
    } catch (error) {
      console.error('清理翻译缓存失败:', error)
      res.status(500).json({
        success: false,
        error: '清理翻译缓存失败',
        message: error.message
      })
    }
  })

  // ==================== 健康检查 ====================

  /**
   * GET /multilingual/health
   * 多语言服务健康检查
   */
  router.get('/health', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          multilingualManager: !!multilingualManager,
          translationProviders: Object.values(multilingualManager.translationProviders)
            .filter(p => p.enabled).length > 0
        },
        stats: {
          supportedLanguages: Object.keys(multilingualManager.supportedLanguages).length,
          activeProvider: multilingualManager.activeProvider,
          cacheSize: multilingualManager.translationCache.size,
          totalRequests: multilingualManager.translationStats.totalRequests
        }
      }

      // 检查组件状态
      if (!multilingualManager) {
        health.status = 'unhealthy'
      }

      const enabledProviders = Object.values(multilingualManager.translationProviders)
        .filter(p => p.enabled)

      if (enabledProviders.length === 0) {
        health.status = 'degraded'
      }

      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'degraded' ? 200 : 503

      res.status(statusCode).json({
        success: true,
        data: health
      })
    } catch (error) {
      console.error('健康检查失败:', error)
      res.status(503).json({
        success: false,
        error: '健康检查失败',
        message: error.message
      })
    }
  })

  return router
}

module.exports = multilingualRoutes
