const { EventEmitter } = require('events')
const fs = require('fs').promises
const path = require('path')

/**
 * 多语言支持管理器
 * 借鉴Google Translate、i18n库和国际化平台的优秀设计理念
 * 提供完整的多语言界面和API响应本地化服务
 */
class MultilingualManager extends EventEmitter {
  constructor (options = {}) {
    super()

    this.configPath = options.configPath || path.join(__dirname, '../config/multilingual.json')
    this.localesPath = options.localesPath || path.join(__dirname, '../locales')
    this.cachePath = options.cachePath || path.join(__dirname, '../cache/translations')

    // 支持的语言列表
    this.supportedLanguages = {
      'zh-CN': {
        name: '中文(简体)',
        nativeName: '中文(简体)',
        flag: '🇨🇳',
        fallback: 'en-US',
        rtl: false
      },
      'zh-TW': {
        name: '中文(繁体)',
        nativeName: '中文(繁體)',
        flag: '🇹🇼',
        fallback: 'zh-CN',
        rtl: false
      },
      'en-US': {
        name: 'English (US)',
        nativeName: 'English (US)',
        flag: '🇺🇸',
        fallback: null,
        rtl: false
      },
      'en-GB': {
        name: 'English (UK)',
        nativeName: 'English (UK)',
        flag: '🇬🇧',
        fallback: 'en-US',
        rtl: false
      },
      'ja-JP': {
        name: '日本語',
        nativeName: '日本語',
        flag: '🇯🇵',
        fallback: 'en-US',
        rtl: false
      },
      'ko-KR': {
        name: '한국어',
        nativeName: '한국어',
        flag: '🇰🇷',
        fallback: 'en-US',
        rtl: false
      },
      'fr-FR': {
        name: 'Français',
        nativeName: 'Français',
        flag: '🇫🇷',
        fallback: 'en-US',
        rtl: false
      },
      'de-DE': {
        name: 'Deutsch',
        nativeName: 'Deutsch',
        flag: '🇩🇪',
        fallback: 'en-US',
        rtl: false
      },
      'es-ES': {
        name: 'Español',
        nativeName: 'Español',
        flag: '🇪🇸',
        fallback: 'en-US',
        rtl: false
      },
      'it-IT': {
        name: 'Italiano',
        nativeName: 'Italiano',
        flag: '🇮🇹',
        fallback: 'en-US',
        rtl: false
      },
      'pt-BR': {
        name: 'Português (BR)',
        nativeName: 'Português (BR)',
        flag: '🇧🇷',
        fallback: 'en-US',
        rtl: false
      },
      'ru-RU': {
        name: 'Русский',
        nativeName: 'Русский',
        flag: '🇷🇺',
        fallback: 'en-US',
        rtl: false
      },
      'ar-SA': {
        name: 'العربية',
        nativeName: 'العربية',
        flag: '🇸🇦',
        fallback: 'en-US',
        rtl: true
      },
      'hi-IN': {
        name: 'हिन्दी',
        nativeName: 'हिन्दी',
        flag: '🇮🇳',
        fallback: 'en-US',
        rtl: false
      }
    }

    // 默认语言
    this.defaultLanguage = 'zh-CN'

    // 翻译资源缓存
    this.translationCache = new Map()

    // 用户语言偏好
    this.userPreferences = new Map()

    // 翻译统计
    this.translationStats = {
      totalRequests: 0,
      cacheHits: 0,
      apiCalls: 0,
      avgResponseTime: 0,
      lastUpdated: new Date().toISOString()
    }

    // 翻译提供商配置
    this.translationProviders = {
      google: {
        name: 'Google Translate',
        enabled: true,
        apiKey: process.env.GOOGLE_TRANSLATE_API_KEY,
        baseUrl: 'https://translation.googleapis.com/v3',
        rateLimit: 1000, // requests per minute
        supportedLanguages: Object.keys(this.supportedLanguages)
      },
      azure: {
        name: 'Azure Translator',
        enabled: false,
        apiKey: process.env.AZURE_TRANSLATOR_KEY,
        region: process.env.AZURE_TRANSLATOR_REGION,
        baseUrl: 'https://api.cognitive.microsofttranslator.com',
        rateLimit: 2000,
        supportedLanguages: Object.keys(this.supportedLanguages)
      },
      openai: {
        name: 'OpenAI GPT',
        enabled: true,
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-3.5-turbo',
        rateLimit: 100,
        supportedLanguages: ['zh-CN', 'zh-TW', 'en-US', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES']
      }
    }

    // 当前活跃的翻译提供商
    this.activeProvider = 'google'

    // 初始化
    this.initialize()
  }

  /**
   * 初始化多语言管理器
   */
  async initialize () {
    try {
      // 创建必要的目录
      await fs.mkdir(this.localesPath, { recursive: true })
      await fs.mkdir(this.cachePath, { recursive: true })

      // 加载配置
      await this.loadConfiguration()

      // 加载翻译资源
      await this.loadTranslationResources()

      // 启动缓存清理
      this.startCacheCleanup()

      // 启动统计更新
      this.startStatisticsUpdate()

      console.log(`✅ 多语言管理器已初始化，支持 ${Object.keys(this.supportedLanguages).length} 种语言`)
    } catch (error) {
      console.error('❌ 多语言管理器初始化失败:', error.message)
      throw error
    }
  }

  /**
   * 检测用户语言
   */
  detectLanguage (request, context = {}) {
    // 1. 检查显式指定的语言
    const acceptLanguage = request.headers['accept-language']
    const queryLanguage = request.query.lang || request.query.language
    const headerLanguage = request.headers['x-language'] || request.headers['x-lang']

    let detectedLanguage = queryLanguage || headerLanguage

    // 2. 检查用户偏好
    if (!detectedLanguage && context.userId) {
      const userPrefs = this.userPreferences.get(context.userId)
      if (userPrefs?.language) {
        detectedLanguage = userPrefs.language
      }
    }

    // 3. 从Accept-Language头解析
    if (!detectedLanguage && acceptLanguage) {
      detectedLanguage = this.parseAcceptLanguage(acceptLanguage)
    }

    // 4. 检查IP地理位置（简化实现）
    if (!detectedLanguage && context.ip) {
      detectedLanguage = this.detectLanguageByIP(context.ip)
    }

    // 5. 使用默认语言
    if (!detectedLanguage) {
      detectedLanguage = this.defaultLanguage
    }

    // 验证语言是否支持
    if (!this.supportedLanguages[detectedLanguage]) {
      const fallback = this.supportedLanguages[detectedLanguage]?.fallback
      detectedLanguage = fallback || this.defaultLanguage
    }

    return {
      language: detectedLanguage,
      confidence: this.calculateDetectionConfidence(detectedLanguage, request, context),
      method: detectedLanguage === queryLanguage ? 'query'
        : detectedLanguage === headerLanguage ? 'header'
          : context.userId ? 'preference'
            : acceptLanguage ? 'accept-language' : 'default'
    }
  }

  /**
   * 翻译文本
   */
  async translate (text, fromLanguage, toLanguage, options = {}) {
    const startTime = Date.now()
    this.translationStats.totalRequests++

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return text
    }

    // 如果源语言和目标语言相同，直接返回
    if (fromLanguage === toLanguage) {
      return text
    }

    // 检查缓存
    const cacheKey = this.generateCacheKey(text, fromLanguage, toLanguage)
    const cached = this.translationCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24小时缓存
      this.translationStats.cacheHits++
      return cached.translation
    }

    try {
      // 执行翻译
      const translation = await this.performTranslation(text, fromLanguage, toLanguage, options)

      // 缓存结果
      this.translationCache.set(cacheKey, {
        translation,
        timestamp: Date.now(),
        fromLanguage,
        toLanguage
      })

      // 更新统计
      const responseTime = Date.now() - startTime
      this.updateTranslationStats(responseTime)

      this.emit('translationCompleted', {
        text,
        translation,
        fromLanguage,
        toLanguage,
        responseTime,
        provider: this.activeProvider
      })

      return translation
    } catch (error) {
      console.error(`翻译失败 (${fromLanguage} -> ${toLanguage}):`, error.message)

      // 翻译失败时返回原文
      this.emit('translationFailed', {
        text,
        fromLanguage,
        toLanguage,
        error: error.message,
        provider: this.activeProvider
      })

      return text
    }
  }

  /**
   * 本地化API响应
   */
  async localizeResponse (response, targetLanguage, context = {}) {
    if (!response || typeof response !== 'object') {
      return response
    }

    // 如果是错误响应，只翻译错误消息
    if (response.error || response.success === false) {
      const localizedResponse = { ...response }

      if (response.error) {
        localizedResponse.error = await this.translateError(response.error, targetLanguage)
      }

      if (response.message) {
        localizedResponse.message = await this.translate(response.message, 'en-US', targetLanguage)
      }

      return localizedResponse
    }

    // 对于成功响应，根据响应结构进行本地化
    const localizedResponse = await this.localizeObject(response, targetLanguage, context)

    return localizedResponse
  }

  /**
   * 获取本地化资源
   */
  async getLocalizedResource (resourceKey, language, namespace = 'common') {
    const resources = await this.loadLanguageResources(language)
    const namespaceResources = resources[namespace] || {}

    return namespaceResources[resourceKey] || resourceKey
  }

  /**
   * 设置用户语言偏好
   */
  async setUserLanguagePreference (userId, language, preferences = {}) {
    if (!this.supportedLanguages[language]) {
      throw new Error(`不支持的语言: ${language}`)
    }

    const userPrefs = {
      language,
      ...preferences,
      updatedAt: new Date().toISOString()
    }

    this.userPreferences.set(userId, userPrefs)
    await this.saveConfiguration()

    console.log(`✅ 用户语言偏好已设置: ${userId} -> ${language}`)

    this.emit('userPreferenceUpdated', {
      userId,
      language,
      preferences: userPrefs
    })

    return userPrefs
  }

  /**
   * 获取用户语言偏好
   */
  getUserLanguagePreference (userId) {
    return this.userPreferences.get(userId) || {
      language: this.defaultLanguage,
      updatedAt: new Date().toISOString()
    }
  }

  /**
   * 添加翻译资源
   */
  async addTranslationResource (language, namespace, resources) {
    if (!this.supportedLanguages[language]) {
      throw new Error(`不支持的语言: ${language}`)
    }

    const filePath = path.join(this.localesPath, `${language}.json`)
    let existingResources = {}

    try {
      const data = await fs.readFile(filePath, 'utf8')
      existingResources = JSON.parse(data)
    } catch (error) {
      // 文件不存在，使用空对象
    }

    existingResources[namespace] = {
      ...existingResources[namespace],
      ...resources
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(existingResources, null, 2))

    // 重新加载资源
    await this.loadTranslationResources()

    console.log(`✅ 翻译资源已添加: ${language}.${namespace}`)

    this.emit('resourceAdded', {
      language,
      namespace,
      resourceCount: Object.keys(resources).length
    })

    return existingResources[namespace]
  }

  /**
   * 获取翻译统计
   */
  getTranslationStatistics (timeRange = '1h') {
    const stats = { ...this.translationStats }

    // 计算缓存命中率
    stats.cacheHitRate = stats.totalRequests > 0
      ? (stats.cacheHits / stats.totalRequests) : 0

    // 计算API调用率
    stats.apiCallRate = stats.totalRequests > 0
      ? (stats.apiCalls / stats.totalRequests) : 0

    return stats
  }

  /**
   * 清除翻译缓存
   */
  clearTranslationCache () {
    const cacheSize = this.translationCache.size
    this.translationCache.clear()

    console.log(`🧹 翻译缓存已清理: ${cacheSize} 条记录`)

    this.emit('cacheCleared', {
      clearedEntries: cacheSize,
      timestamp: new Date().toISOString()
    })

    return { success: true, clearedEntries: cacheSize }
  }

  // ==================== 私有方法 ====================

  /**
   * 解析Accept-Language头
   */
  parseAcceptLanguage (acceptLanguage) {
    // 简化的语言解析逻辑
    const languages = acceptLanguage.split(',').map(lang => {
      const [language, quality = '1'] = lang.trim().split(';q=')
      return {
        language: language.split('-')[0], // 提取主要语言代码
        fullLanguage: language,
        quality: parseFloat(quality)
      }
    })

    // 按质量排序
    languages.sort((a, b) => b.quality - a.quality)

    // 返回最匹配的支持语言
    for (const lang of languages) {
      if (this.supportedLanguages[lang.fullLanguage]) {
        return lang.fullLanguage
      }
      if (this.supportedLanguages[lang.language]) {
        return lang.language
      }
    }

    return null
  }

  /**
   * 根据IP检测语言（简化实现）
   */
  detectLanguageByIP (ip) {
    // 简化的地理位置检测
    // 在实际实现中，这里应该调用地理位置API
    const ipPrefixes = {
      'zh-CN': ['192.168.', '10.', '172.'], // 本地网络，默认为中文
      'en-US': [] // 默认英文
    }

    for (const [lang, prefixes] of Object.entries(ipPrefixes)) {
      if (prefixes.some(prefix => ip.startsWith(prefix))) {
        return lang
      }
    }

    return this.defaultLanguage
  }

  /**
   * 计算检测置信度
   */
  calculateDetectionConfidence (language, request, context) {
    let confidence = 0.5 // 基础置信度

    // 如果是显式指定的，置信度最高
    if (request.query?.lang || request.headers['x-language']) {
      confidence = 1.0
    }
    // 如果是用户偏好，置信度较高
    else if (context.userId) {
      confidence = 0.9
    } // 如果是从Accept-Language解析的，置信度中等
    else if (request.headers['accept-language']) {
      confidence = 0.7
    } // 如果是默认值，置信度最低
    else {
      confidence = 0.3
    }

    return confidence
  }

  /**
   * 执行翻译
   */
  async performTranslation (text, fromLanguage, toLanguage, options) {
    const provider = this.translationProviders[this.activeProvider]

    if (!provider?.enabled) {
      throw new Error(`翻译提供商 ${this.activeProvider} 未启用`)
    }

    this.translationStats.apiCalls++

    switch (this.activeProvider) {
      case 'google':
        return await this.translateWithGoogle(text, fromLanguage, toLanguage, options)
      case 'azure':
        return await this.translateWithAzure(text, fromLanguage, toLanguage, options)
      case 'openai':
        return await this.translateWithOpenAI(text, fromLanguage, toLanguage, options)
      default:
        throw new Error(`不支持的翻译提供商: ${this.activeProvider}`)
    }
  }

  /**
   * 使用Google Translate API翻译
   */
  async translateWithGoogle (text, fromLanguage, toLanguage, options) {
    const provider = this.translationProviders.google

    if (!provider.apiKey) {
      throw new Error('Google Translate API key not configured')
    }

    const url = `${provider.baseUrl}/translate`
    const params = new URLSearchParams({
      q: text,
      source: fromLanguage,
      target: toLanguage,
      key: provider.apiKey
    })

    const response = await fetch(`${url}?${params}`)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Google Translate API error: ${data.error?.message || 'Unknown error'}`)
    }

    return data.data.translations[0].translatedText
  }

  /**
   * 使用Azure Translator API翻译
   */
  async translateWithAzure (text, fromLanguage, toLanguage, options) {
    const provider = this.translationProviders.azure

    if (!provider.apiKey || !provider.region) {
      throw new Error('Azure Translator API key or region not configured')
    }

    const url = `${provider.baseUrl}/translate`
    const params = new URLSearchParams({
      'api-version': '3.0',
      from: fromLanguage,
      to: toLanguage
    })

    const response = await fetch(`${url}?${params}`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': provider.apiKey,
        'Ocp-Apim-Subscription-Region': provider.region,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{ text }])
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`Azure Translator API error: ${data.error?.message || 'Unknown error'}`)
    }

    return data[0].translations[0].text
  }

  /**
   * 使用OpenAI GPT翻译
   */
  async translateWithOpenAI (text, fromLanguage, toLanguage, options) {
    const provider = this.translationProviders.openai

    if (!provider.apiKey) {
      throw new Error('OpenAI API key not configured')
    }

    const fromLangName = this.supportedLanguages[fromLanguage]?.nativeName || fromLanguage
    const toLangName = this.supportedLanguages[toLanguage]?.nativeName || toLanguage

    const prompt = `请将以下${fromLangName}文本翻译成${toLangName}。只返回翻译结果，不要添加任何解释或额外内容：\n\n${text}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.1
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`)
    }

    return data.choices[0].message.content.trim()
  }

  /**
   * 本地化对象
   */
  async localizeObject (obj, targetLanguage, context) {
    const localized = { ...obj }

    // 递归处理对象中的字符串
    for (const [key, value] of Object.entries(localized)) {
      if (typeof value === 'string') {
        // 检查是否需要翻译
        if (this.shouldTranslateField(key, value)) {
          localized[key] = await this.translate(value, 'en-US', targetLanguage)
        }
      } else if (typeof value === 'object' && value !== null) {
        localized[key] = await this.localizeObject(value, targetLanguage, context)
      }
    }

    return localized
  }

  /**
   * 判断字段是否需要翻译
   */
  shouldTranslateField (fieldName, value) {
    // 不翻译的字段
    const skipFields = [
      'id', 'userId', 'email', 'phone', 'url', 'code', 'status',
      'timestamp', 'createdAt', 'updatedAt', 'version', 'token'
    ]

    if (skipFields.includes(fieldName)) {
      return false
    }

    // 不翻译纯数字、布尔值等
    if (typeof value !== 'string' || /^\d+$/.test(value) || /^true|false$/i.test(value)) {
      return false
    }

    // 翻译包含英文字符的字符串
    return /[a-zA-Z]/.test(value)
  }

  /**
   * 翻译错误消息
   */
  async translateError (error, targetLanguage) {
    if (typeof error === 'string') {
      return await this.translate(error, 'en-US', targetLanguage)
    }

    if (typeof error === 'object' && error.message) {
      const localizedError = { ...error }
      localizedError.message = await this.translate(error.message, 'en-US', targetLanguage)
      return localizedError
    }

    return error
  }

  /**
   * 加载语言资源
   */
  async loadLanguageResources (language) {
    if (this.translationCache.has(`resources_${language}`)) {
      return this.translationCache.get(`resources_${language}`)
    }

    try {
      const filePath = path.join(this.localesPath, `${language}.json`)
      const data = await fs.readFile(filePath, 'utf8')
      const resources = JSON.parse(data)

      this.translationCache.set(`resources_${language}`, resources)
      return resources
    } catch (error) {
      // 如果文件不存在，返回空对象
      const emptyResources = {}
      this.translationCache.set(`resources_${language}`, emptyResources)
      return emptyResources
    }
  }

  /**
   * 加载所有翻译资源
   */
  async loadTranslationResources () {
    for (const language of Object.keys(this.supportedLanguages)) {
      await this.loadLanguageResources(language)
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey (text, fromLanguage, toLanguage) {
    const crypto = require('crypto')
    const hash = crypto.createHash('md5')
    hash.update(`${text}:${fromLanguage}:${toLanguage}`)
    return hash.digest('hex')
  }

  /**
   * 更新翻译统计
   */
  updateTranslationStats (responseTime) {
    const alpha = 0.1 // 指数移动平均
    this.translationStats.avgResponseTime =
      this.translationStats.avgResponseTime * (1 - alpha) + responseTime * alpha
    this.translationStats.lastUpdated = new Date().toISOString()
  }

  /**
   * 启动缓存清理
   */
  startCacheCleanup () {
    // 每小时清理过期缓存
    setInterval(() => {
      const now = Date.now()
      let cleaned = 0

      for (const [key, cached] of this.translationCache.entries()) {
        if (cached.timestamp && now - cached.timestamp > 24 * 60 * 60 * 1000) {
          this.translationCache.delete(key)
          cleaned++
        }
      }

      if (cleaned > 0) {
        console.log(`🧹 翻译缓存清理: ${cleaned} 条过期记录`)
      }
    }, 60 * 60 * 1000)
  }

  /**
   * 启动统计更新
   */
  startStatisticsUpdate () {
    // 每分钟重置计数器（用于计算率）
    setInterval(() => {
      // 这里可以添加更详细的统计更新逻辑
    }, 60 * 1000)
  }

  /**
   * 加载配置
   */
  async loadConfiguration () {
    try {
      const data = await fs.readFile(this.configPath, 'utf8')
      const config = JSON.parse(data)

      if (config.userPreferences) {
        for (const [userId, prefs] of Object.entries(config.userPreferences)) {
          this.userPreferences.set(userId, prefs)
        }
      }

      if (config.activeProvider) {
        this.activeProvider = config.activeProvider
      }

      if (config.defaultLanguage) {
        this.defaultLanguage = config.defaultLanguage
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载多语言配置失败:', error.message)
      }
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration () {
    try {
      const config = {
        userPreferences: Object.fromEntries(this.userPreferences),
        activeProvider: this.activeProvider,
        defaultLanguage: this.defaultLanguage,
        lastUpdated: new Date().toISOString()
      }

      await fs.mkdir(path.dirname(this.configPath), { recursive: true })
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('保存多语言配置失败:', error.message)
    }
  }
}

module.exports = { MultilingualManager }
