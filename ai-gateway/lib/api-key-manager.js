/**
 * Sira AI网关 - API密钥管理模块
 * 提供完整的API密钥生命周期管理和智能轮换功能
 */

const crypto = require('crypto')
const EventEmitter = require('events')

class APIKeyManager extends EventEmitter {
  constructor (options = {}) {
    super()

    this.options = {
      encryptionKey: options.encryptionKey || this.generateEncryptionKey(),
      maxKeysPerProvider: options.maxKeysPerProvider || 10,
      rotationInterval: options.rotationInterval || 24 * 60 * 60 * 1000, // 24小时
      gracePeriod: options.gracePeriod || 60 * 60 * 1000, // 1小时宽限期
      rateLimitWindow: options.rateLimitWindow || 60 * 1000, // 1分钟
      enableAutoRotation: options.enableAutoRotation !== false,
      ...options
    }

    // 密钥存储
    this.keys = new Map() // provider -> keyId -> keyData
    this.keyUsage = new Map() // keyId -> usageStats
    this.permissions = new Map() // userId -> permissions
    this.rateLimits = new Map() // keyId -> rateLimitData

    // 轮换计划
    this.rotationSchedule = new Map()

    // 初始化自动轮换
    if (this.options.enableAutoRotation) {
      this.startAutoRotation()
    }

    console.log('✅ API密钥管理模块初始化完成')
  }

  /**
     * 生成加密密钥
     */
  generateEncryptionKey () {
    return crypto.randomBytes(32)
  }

  /**
     * 加密API密钥
     */
  encryptKey (key) {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', this.options.encryptionKey, iv)
    let encrypted = cipher.update(key, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    return { encrypted, iv: iv.toString('hex') }
  }

  /**
     * 解密API密钥
     */
  decryptKey (encryptedData) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.options.encryptionKey, Buffer.from(encryptedData.iv, 'hex'))
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  /**
     * 添加API密钥
     */
  addKey (provider, keyData) {
    if (!this.keys.has(provider)) {
      this.keys.set(provider, new Map())
    }

    const providerKeys = this.keys.get(provider)

    // 检查密钥数量限制
    if (providerKeys.size >= this.options.maxKeysPerProvider) {
      throw new Error(`供应商 ${provider} 的密钥数量已达到上限 ${this.options.maxKeysPerProvider}`)
    }

    const keyId = this.generateKeyId()
    const encryptedKey = this.encryptKey(keyData.key)

    const keyRecord = {
      id: keyId,
      provider,
      name: keyData.name || `Key ${keyId.slice(-8)}`,
      encryptedKey,
      permissions: keyData.permissions || ['read', 'write'],
      limits: {
        requestsPerMinute: keyData.requestsPerMinute || 60,
        requestsPerHour: keyData.requestsPerHour || 1000,
        requestsPerDay: keyData.requestsPerDay || 10000,
        tokensPerMinute: keyData.tokensPerMinute || 10000,
        tokensPerHour: keyData.tokensPerHour || 100000,
        tokensPerDay: keyData.tokensPerDay || 1000000
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: keyData.createdBy || 'system',
        tags: keyData.tags || [],
        description: keyData.description || ''
      },
      status: 'active',
      rotation: {
        lastRotated: new Date().toISOString(),
        nextRotation: this.calculateNextRotation(),
        rotationCount: 0
      }
    }

    providerKeys.set(keyId, keyRecord)
    this.initializeKeyUsage(keyId)
    this.initializeRateLimit(keyId, keyRecord.limits)

    this.emit('keyAdded', { provider, keyId, keyRecord })
    console.log(`✅ 已添加API密钥: ${provider}/${keyId}`)

    return keyId
  }

  /**
     * 获取API密钥
     */
  getKey (provider, keyId) {
    const providerKeys = this.keys.get(provider)
    if (!providerKeys) {
      return null
    }

    const keyRecord = providerKeys.get(keyId)
    if (!keyRecord) {
      return null
    }

    // 返回解密后的密钥信息（不包含加密密钥）
    return {
      ...keyRecord,
      key: this.decryptKey(keyRecord.encryptedKey),
      encryptedKey: undefined
    }
  }

  /**
     * 获取可用的API密钥
     */
  getAvailableKeys (provider, userId = null, requiredPermissions = []) {
    const providerKeys = this.keys.get(provider)
    if (!providerKeys) {
      return []
    }

    const availableKeys = []

    for (const [keyId, keyRecord] of providerKeys) {
      // 检查密钥状态
      if (keyRecord.status !== 'active') {
        continue
      }

      // 检查权限
      if (userId && !this.checkUserPermission(userId, provider, keyId)) {
        continue
      }

      // 检查所需权限
      if (requiredPermissions.length > 0 &&
                !requiredPermissions.every(perm => keyRecord.permissions.includes(perm))) {
        continue
      }

      // 检查使用限制
      if (this.isKeyRateLimited(keyId)) {
        continue
      }

      availableKeys.push({
        id: keyId,
        name: keyRecord.name,
        permissions: keyRecord.permissions,
        limits: keyRecord.limits,
        usage: this.getKeyUsageStats(keyId)
      })
    }

    return availableKeys
  }

  /**
     * 选择最佳API密钥
     */
  selectBestKey (provider, userId = null, requiredPermissions = [], preferences = {}) {
    const availableKeys = this.getAvailableKeys(provider, userId, requiredPermissions)

    if (availableKeys.length === 0) {
      return null
    }

    // 基于策略选择密钥
    const strategy = preferences.strategy || 'round_robin'

    switch (strategy) {
      case 'least_used':
        return this.selectLeastUsedKey(availableKeys)
      case 'random':
        return availableKeys[Math.floor(Math.random() * availableKeys.length)]
      case 'round_robin':
      default:
        return this.selectRoundRobinKey(provider, availableKeys)
    }
  }

  /**
     * 选择使用最少的密钥
     */
  selectLeastUsedKey (availableKeys) {
    let bestKey = availableKeys[0]
    let minUsage = this.getKeyUsageStats(bestKey.id).totalRequests

    for (const key of availableKeys.slice(1)) {
      const usage = this.getKeyUsageStats(key.id).totalRequests
      if (usage < minUsage) {
        minUsage = usage
        bestKey = key
      }
    }

    return bestKey
  }

  /**
     * 轮询选择密钥
     */
  selectRoundRobinKey (provider, availableKeys) {
    // 简单的轮询实现
    const providerKeys = Array.from(this.keys.get(provider).keys())
    const activeKeys = providerKeys.filter(keyId => {
      const record = this.keys.get(provider).get(keyId)
      return record.status === 'active'
    })

    if (activeKeys.length === 0) return availableKeys[0]

    // 使用简单的哈希轮询
    const now = Date.now()
    const index = now % activeKeys.length

    return availableKeys.find(key => key.id === activeKeys[index]) || availableKeys[0]
  }

  /**
     * 记录密钥使用
     */
  recordKeyUsage (keyId, usageData) {
    const usage = this.keyUsage.get(keyId)
    if (!usage) {
      this.initializeKeyUsage(keyId)
      return
    }

    const now = Date.now()
    const minute = Math.floor(now / 60000)
    const hour = Math.floor(now / 3600000)
    const day = Math.floor(now / 86400000)

    // 更新计数器
    usage.totalRequests++
    usage.totalTokens += usageData.tokens || 0
    usage.totalCost += usageData.cost || 0

    // 更新时间窗口计数器
    if (!usage.minuteCounts.has(minute)) {
      usage.minuteCounts.set(minute, { requests: 0, tokens: 0 })
    }
    usage.minuteCounts.get(minute).requests++
    usage.minuteCounts.get(minute).tokens += usageData.tokens || 0

    if (!usage.hourCounts.has(hour)) {
      usage.hourCounts.set(hour, { requests: 0, tokens: 0 })
    }
    usage.hourCounts.get(hour).requests++
    usage.hourCounts.get(hour).tokens += usageData.tokens || 0

    if (!usage.dayCounts.has(day)) {
      usage.dayCounts.set(day, { requests: 0, tokens: 0 })
    }
    usage.dayCounts.get(day).requests++
    usage.dayCounts.get(day).tokens += usageData.tokens || 0

    // 更新最后使用时间
    usage.lastUsed = new Date().toISOString()

    // 检查是否超过限制
    if (this.checkUsageLimits(keyId, usage)) {
      this.emit('keyLimitExceeded', { keyId, usage, limits: this.getKeyLimits(keyId) })
    }
  }

  /**
     * 检查使用限制
     */
  checkUsageLimits (keyId, usage) {
    const limits = this.getKeyLimits(keyId)
    if (!limits) return false

    const now = Date.now()
    const minute = Math.floor(now / 60000)
    const hour = Math.floor(now / 3600000)
    const day = Math.floor(now / 86400000)

    const minuteUsage = usage.minuteCounts.get(minute) || { requests: 0, tokens: 0 }
    const hourUsage = usage.hourCounts.get(hour) || { requests: 0, tokens: 0 }
    const dayUsage = usage.dayCounts.get(day) || { requests: 0, tokens: 0 }

    return (
      minuteUsage.requests >= limits.requestsPerMinute ||
            minuteUsage.tokens >= limits.tokensPerMinute ||
            hourUsage.requests >= limits.requestsPerHour ||
            hourUsage.tokens >= limits.tokensPerHour ||
            dayUsage.requests >= limits.requestsPerDay ||
            dayUsage.tokens >= limits.tokensPerDay
    )
  }

  /**
     * 检查密钥是否被限流
     */
  isKeyRateLimited (keyId) {
    const rateLimitData = this.rateLimits.get(keyId)
    if (!rateLimitData) return false

    const now = Date.now()
    return now < rateLimitData.until
  }

  /**
     * 轮换API密钥
     */
  async rotateKey (provider, keyId, newKeyData) {
    const providerKeys = this.keys.get(provider)
    if (!providerKeys) {
      throw new Error(`供应商 ${provider} 不存在`)
    }

    const keyRecord = providerKeys.get(keyId)
    if (!keyRecord) {
      throw new Error(`密钥 ${keyId} 不存在`)
    }

    // 备份旧密钥
    const oldKey = { ...keyRecord }

    // 更新密钥
    const encryptedKey = this.encryptKey(newKeyData.key)
    keyRecord.encryptedKey = encryptedKey
    keyRecord.rotation.lastRotated = new Date().toISOString()
    keyRecord.rotation.nextRotation = this.calculateNextRotation()
    keyRecord.rotation.rotationCount++

    // 更新元数据
    if (newKeyData.name) keyRecord.name = newKeyData.name
    if (newKeyData.description) keyRecord.metadata.description = newKeyData.description

    this.emit('keyRotated', { provider, keyId, oldKey, newKey: keyRecord })
    console.log(`🔄 已轮换API密钥: ${provider}/${keyId}`)

    return keyRecord
  }

  /**
     * 禁用API密钥
     */
  disableKey (provider, keyId, reason = 'manual') {
    const providerKeys = this.keys.get(provider)
    if (!providerKeys) {
      throw new Error(`供应商 ${provider} 不存在`)
    }

    const keyRecord = providerKeys.get(keyId)
    if (!keyRecord) {
      throw new Error(`密钥 ${keyId} 不存在`)
    }

    keyRecord.status = 'disabled'
    keyRecord.metadata.disabledAt = new Date().toISOString()
    keyRecord.metadata.disabledReason = reason

    this.emit('keyDisabled', { provider, keyId, reason })
    console.log(`🚫 已禁用API密钥: ${provider}/${keyId} (${reason})`)
  }

  /**
     * 启用API密钥
     */
  enableKey (provider, keyId) {
    const providerKeys = this.keys.get(provider)
    if (!providerKeys) {
      throw new Error(`供应商 ${provider} 不存在`)
    }

    const keyRecord = providerKeys.get(keyId)
    if (!keyRecord) {
      throw new Error(`密钥 ${keyId} 不存在`)
    }

    keyRecord.status = 'active'
    keyRecord.metadata.enabledAt = new Date().toISOString()
    delete keyRecord.metadata.disabledAt
    delete keyRecord.metadata.disabledReason

    this.emit('keyEnabled', { provider, keyId })
    console.log(`✅ 已启用API密钥: ${provider}/${keyId}`)
  }

  /**
     * 删除API密钥
     */
  deleteKey (provider, keyId) {
    const providerKeys = this.keys.get(provider)
    if (!providerKeys) {
      throw new Error(`供应商 ${provider} 不存在`)
    }

    if (!providerKeys.has(keyId)) {
      throw new Error(`密钥 ${keyId} 不存在`)
    }

    const keyRecord = providerKeys.get(keyId)
    providerKeys.delete(keyId)

    // 清理相关数据
    this.keyUsage.delete(keyId)
    this.rateLimits.delete(keyId)

    this.emit('keyDeleted', { provider, keyId, keyRecord })
    console.log(`🗑️ 已删除API密钥: ${provider}/${keyId}`)
  }

  /**
     * 设置用户权限
     */
  setUserPermissions (userId, permissions) {
    this.permissions.set(userId, permissions)
    this.emit('permissionsUpdated', { userId, permissions })
  }

  /**
     * 检查用户权限
     */
  checkUserPermission (userId, provider, keyId) {
    const userPermissions = this.permissions.get(userId)
    if (!userPermissions) return false

    // 检查是否有对该供应商的权限
    if (userPermissions.providers && !userPermissions.providers.includes(provider)) {
      return false
    }

    // 检查是否有对该密钥的权限
    if (userPermissions.keys && !userPermissions.keys.includes(keyId)) {
      return false
    }

    return true
  }

  /**
     * 获取密钥使用统计
     */
  getKeyUsageStats (keyId) {
    const usage = this.keyUsage.get(keyId)
    if (!usage) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        lastUsed: null
      }
    }

    return {
      totalRequests: usage.totalRequests,
      totalTokens: usage.totalTokens,
      totalCost: usage.totalCost,
      lastUsed: usage.lastUsed,
      currentMinuteRequests: this.getCurrentWindowUsage(usage.minuteCounts, 60000),
      currentHourRequests: this.getCurrentWindowUsage(usage.hourCounts, 3600000),
      currentDayRequests: this.getCurrentWindowUsage(usage.dayCounts, 86400000)
    }
  }

  /**
     * 获取当前时间窗口的使用量
     */
  getCurrentWindowUsage (counts, windowSize) {
    const now = Date.now()
    const currentWindow = Math.floor(now / windowSize)
    return counts.get(currentWindow) || { requests: 0, tokens: 0 }
  }

  /**
     * 获取所有供应商和密钥概览
     */
  getOverview () {
    const overview = {
      providers: {},
      totalKeys: 0,
      activeKeys: 0,
      disabledKeys: 0,
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0
    }

    for (const [provider, providerKeys] of this.keys) {
      const providerStats = {
        totalKeys: providerKeys.size,
        activeKeys: 0,
        disabledKeys: 0,
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        keys: []
      }

      for (const [keyId, keyRecord] of providerKeys) {
        if (keyRecord.status === 'active') {
          providerStats.activeKeys++
          overview.activeKeys++
        } else {
          providerStats.disabledKeys++
          overview.disabledKeys++
        }

        const usage = this.getKeyUsageStats(keyId)
        providerStats.totalRequests += usage.totalRequests
        providerStats.totalTokens += usage.totalTokens
        providerStats.totalCost += usage.totalCost

        providerStats.keys.push({
          id: keyId,
          name: keyRecord.name,
          status: keyRecord.status,
          usage: usage
        })
      }

      overview.providers[provider] = providerStats
      overview.totalKeys += providerStats.totalKeys
      overview.totalRequests += providerStats.totalRequests
      overview.totalTokens += providerStats.totalTokens
      overview.totalCost += providerStats.totalCost
    }

    return overview
  }

  /**
     * 启动自动轮换
     */
  startAutoRotation () {
    // 每小时检查一次需要轮换的密钥
    setInterval(() => {
      this.checkAndRotateKeys()
    }, 60 * 60 * 1000) // 1小时

    console.log('🔄 自动密钥轮换已启动')
  }

  /**
     * 检查并轮换密钥
     */
  async checkAndRotateKeys () {
    const now = new Date()

    for (const [provider, providerKeys] of this.keys) {
      for (const [keyId, keyRecord] of providerKeys) {
        if (keyRecord.status !== 'active') continue

        const nextRotation = new Date(keyRecord.rotation.nextRotation)
        if (now >= nextRotation) {
          // 密钥需要轮换
          this.emit('keyRotationDue', { provider, keyId, keyRecord })

          // 这里可以集成自动生成新密钥的逻辑
          // 现在只是记录事件，实际轮换需要手动操作
          console.log(`⚠️ 密钥即将到期需要轮换: ${provider}/${keyId}`)
        }
      }
    }
  }

  /**
     * 生成密钥ID
     */
  generateKeyId () {
    return `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  }

  /**
     * 计算下次轮换时间
     */
  calculateNextRotation () {
    const now = new Date()
    now.setTime(now.getTime() + this.options.rotationInterval)
    return now.toISOString()
  }

  /**
     * 初始化密钥使用统计
     */
  initializeKeyUsage (keyId) {
    this.keyUsage.set(keyId, {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      lastUsed: null,
      minuteCounts: new Map(),
      hourCounts: new Map(),
      dayCounts: new Map()
    })
  }

  /**
     * 初始化速率限制
     */
  initializeRateLimit (keyId, limits) {
    this.rateLimits.set(keyId, {
      limits,
      blocked: false,
      until: 0
    })
  }

  /**
     * 获取密钥限制
     */
  getKeyLimits (keyId) {
    for (const providerKeys of this.keys.values()) {
      for (const keyRecord of providerKeys.values()) {
        if (keyRecord.id === keyId) {
          return keyRecord.limits
        }
      }
    }
    return null
  }

  /**
     * 导出配置
     */
  exportConfig () {
    const config = {
      keys: {},
      permissions: Object.fromEntries(this.permissions),
      options: this.options
    }

    // 导出密钥（包含加密数据）
    for (const [provider, providerKeys] of this.keys) {
      config.keys[provider] = {}
      for (const [keyId, keyRecord] of providerKeys) {
        config.keys[provider][keyId] = keyRecord
      }
    }

    return config
  }

  /**
     * 导入配置
     */
  importConfig (config) {
    if (config.keys) {
      for (const [provider, providerKeys] of Object.entries(config.keys)) {
        if (!this.keys.has(provider)) {
          this.keys.set(provider, new Map())
        }

        const targetProviderKeys = this.keys.get(provider)
        for (const [keyId, keyRecord] of Object.entries(providerKeys)) {
          targetProviderKeys.set(keyId, keyRecord)
          this.initializeKeyUsage(keyId)
          this.initializeRateLimit(keyId, keyRecord.limits)
        }
      }
    }

    if (config.permissions) {
      for (const [userId, permissions] of Object.entries(config.permissions)) {
        this.permissions.set(userId, permissions)
      }
    }

    console.log('✅ API密钥配置导入完成')
  }
}

// 创建全局实例
const apiKeyManager = new APIKeyManager()

// 导出类和实例
module.exports = {
  APIKeyManager,
  apiKeyManager
}
