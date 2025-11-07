const { apiKeyManager } = require('../../api-key-manager')

/**
 * API Keys Management API Routes
 * 提供API密钥管理相关的REST API接口
 */

module.exports = function (router, { logger }) {
  /**
   * GET /api-keys
   * 获取API密钥概览
   */
  router.get('/api-keys', async (req, res) => {
    try {
      const overview = apiKeyManager.getOverview()

      res.json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取API密钥概览失败:', error)
      res.status(500).json({
        success: false,
        error: '获取API密钥概览失败',
        message: error.message
      })
    }
  })

  /**
   * GET /api-keys/providers/:provider
   * 获取指定供应商的所有密钥
   */
  router.get('/api-keys/providers/:provider', async (req, res) => {
    try {
      const { provider } = req.params
      const availableKeys = apiKeyManager.getAvailableKeys(provider)

      res.json({
        success: true,
        data: {
          provider,
          keys: availableKeys,
          count: availableKeys.length
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取供应商密钥失败:', error)
      res.status(500).json({
        success: false,
        error: '获取供应商密钥失败',
        message: error.message
      })
    }
  })

  /**
   * POST /api-keys
   * 添加新的API密钥
   */
  router.post('/api-keys', async (req, res) => {
    try {
      const {
        provider,
        key,
        name,
        permissions = ['read', 'write'],
        limits = {},
        tags = [],
        description = '',
        createdBy
      } = req.body

      if (!provider || !key) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数',
          message: 'provider和key参数都是必需的'
        })
      }

      const keyData = {
        key,
        name,
        permissions,
        requestsPerMinute: limits.requestsPerMinute || 60,
        requestsPerHour: limits.requestsPerHour || 1000,
        requestsPerDay: limits.requestsPerDay || 10000,
        tokensPerMinute: limits.tokensPerMinute || 10000,
        tokensPerHour: limits.tokensPerHour || 100000,
        tokensPerDay: limits.tokensPerDay || 1000000,
        tags,
        description,
        createdBy: createdBy || req.headers['x-user-id'] || 'api'
      }

      const keyId = apiKeyManager.addKey(provider, keyData)

      res.status(201).json({
        success: true,
        data: {
          keyId,
          provider,
          message: 'API密钥添加成功'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('添加API密钥失败:', error)

      if (error.message.includes('达到上限')) {
        return res.status(409).json({
          success: false,
          error: '密钥数量达到上限',
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: '添加API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * GET /api-keys/:provider/:keyId
   * 获取特定API密钥的详细信息
   */
  router.get('/api-keys/:provider/:keyId', async (req, res) => {
    try {
      const { provider, keyId } = req.params
      const keyData = apiKeyManager.getKey(provider, keyId)

      if (!keyData) {
        return res.status(404).json({
          success: false,
          error: 'API密钥不存在',
          message: `供应商 ${provider} 的密钥 ${keyId} 不存在`
        })
      }

      res.json({
        success: true,
        data: {
          provider,
          keyId,
          key: keyData
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取API密钥详情失败:', error)
      res.status(500).json({
        success: false,
        error: '获取API密钥详情失败',
        message: error.message
      })
    }
  })

  /**
   * PUT /api-keys/:provider/:keyId
   * 更新API密钥配置
   */
  router.put('/api-keys/:provider/:keyId', async (req, res) => {
    try {
      const { provider, keyId } = req.params
      const updateData = req.body

      // 检查密钥是否存在
      const existingKey = apiKeyManager.getKey(provider, keyId)
      if (!existingKey) {
        return res.status(404).json({
          success: false,
          error: 'API密钥不存在',
          message: `供应商 ${provider} 的密钥 ${keyId} 不存在`
        })
      }

      // 这里需要实现更新逻辑
      // 暂时返回不支持
      res.status(501).json({
        success: false,
        error: '功能暂未实现',
        message: 'API密钥更新功能暂未实现'
      })
    } catch (error) {
      logger.error('更新API密钥失败:', error)
      res.status(500).json({
        success: false,
        error: '更新API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * PUT /api-keys/:provider/:keyId/rotate
   * 轮换API密钥
   */
  router.put('/api-keys/:provider/:keyId/rotate', async (req, res) => {
    try {
      const { provider, keyId } = req.params
      const { newKey, name, description } = req.body

      if (!newKey) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数',
          message: 'newKey参数是必需的'
        })
      }

      const newKeyData = {
        key: newKey,
        name: name || undefined,
        description: description || undefined
      }

      const updatedKey = apiKeyManager.rotateKey(provider, keyId, newKeyData)

      res.json({
        success: true,
        data: {
          provider,
          keyId,
          message: 'API密钥轮换成功',
          nextRotation: updatedKey.rotation.nextRotation
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('轮换API密钥失败:', error)

      if (error.message.includes('不存在')) {
        return res.status(404).json({
          success: false,
          error: 'API密钥不存在',
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: '轮换API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * PUT /api-keys/:provider/:keyId/disable
   * 禁用API密钥
   */
  router.put('/api-keys/:provider/:keyId/disable', async (req, res) => {
    try {
      const { provider, keyId } = req.params
      const { reason = 'api_request' } = req.body

      apiKeyManager.disableKey(provider, keyId, reason)

      res.json({
        success: true,
        data: {
          provider,
          keyId,
          message: 'API密钥已禁用'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('禁用API密钥失败:', error)

      if (error.message.includes('不存在')) {
        return res.status(404).json({
          success: false,
          error: 'API密钥不存在',
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: '禁用API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * PUT /api-keys/:provider/:keyId/enable
   * 启用API密钥
   */
  router.put('/api-keys/:provider/:keyId/enable', async (req, res) => {
    try {
      const { provider, keyId } = req.params

      apiKeyManager.enableKey(provider, keyId)

      res.json({
        success: true,
        data: {
          provider,
          keyId,
          message: 'API密钥已启用'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('启用API密钥失败:', error)

      if (error.message.includes('不存在')) {
        return res.status(404).json({
          success: false,
          error: 'API密钥不存在',
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: '启用API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * DELETE /api-keys/:provider/:keyId
   * 删除API密钥
   */
  router.delete('/api-keys/:provider/:keyId', async (req, res) => {
    try {
      const { provider, keyId } = req.params

      apiKeyManager.deleteKey(provider, keyId)

      res.json({
        success: true,
        data: {
          provider,
          keyId,
          message: 'API密钥已删除'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('删除API密钥失败:', error)

      if (error.message.includes('不存在')) {
        return res.status(404).json({
          success: false,
          error: 'API密钥不存在',
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        error: '删除API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * GET /api-keys/:provider/:keyId/usage
   * 获取API密钥使用统计
   */
  router.get('/api-keys/:provider/:keyId/usage', async (req, res) => {
    try {
      const { keyId } = req.params
      const usage = apiKeyManager.getKeyUsageStats(keyId)

      res.json({
        success: true,
        data: {
          keyId,
          usage
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取API密钥使用统计失败:', error)
      res.status(500).json({
        success: false,
        error: '获取API密钥使用统计失败',
        message: error.message
      })
    }
  })

  /**
   * POST /api-keys/permissions
   * 设置用户权限
   */
  router.post('/api-keys/permissions', async (req, res) => {
    try {
      const { userId, permissions } = req.body

      if (!userId || !permissions) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数',
          message: 'userId和permissions参数都是必需的'
        })
      }

      apiKeyManager.setUserPermissions(userId, permissions)

      res.json({
        success: true,
        data: {
          userId,
          permissions,
          message: '用户权限设置成功'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('设置用户权限失败:', error)
      res.status(500).json({
        success: false,
        error: '设置用户权限失败',
        message: error.message
      })
    }
  })

  /**
   * GET /api-keys/select/:provider
   * 为用户选择最佳API密钥
   */
  router.get('/api-keys/select/:provider', async (req, res) => {
    try {
      const { provider } = req.params
      const { userId, permissions = ['read', 'write'], strategy = 'least_used' } = req.query

      const availableKeys = apiKeyManager.getAvailableKeys(provider, userId, permissions.split(','))
      if (availableKeys.length === 0) {
        return res.status(404).json({
          success: false,
          error: '无可用API密钥',
          message: `供应商 ${provider} 没有符合条件的可用密钥`
        })
      }

      const selectedKey = apiKeyManager.selectBestKey(provider, userId, permissions.split(','), {
        strategy
      })

      if (!selectedKey) {
        return res.status(404).json({
          success: false,
          error: '无法选择API密钥',
          message: '无法根据当前条件选择合适的API密钥'
        })
      }

      res.json({
        success: true,
        data: {
          provider,
          selectedKey: {
            id: selectedKey.id,
            name: selectedKey.name,
            usage: apiKeyManager.getKeyUsageStats(selectedKey.id)
          },
          strategy
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('选择API密钥失败:', error)
      res.status(500).json({
        success: false,
        error: '选择API密钥失败',
        message: error.message
      })
    }
  })

  /**
   * GET /api-keys/rotation/status
   * 获取密钥轮换状态
   */
  router.get('/api-keys/rotation/status', async (req, res) => {
    try {
      // 这里需要实现轮换状态检查逻辑
      // 暂时返回模拟数据
      res.json({
        success: true,
        data: {
          autoRotationEnabled: apiKeyManager.options.enableAutoRotation,
          rotationInterval: apiKeyManager.options.rotationInterval,
          gracePeriod: apiKeyManager.options.gracePeriod,
          message: '轮换状态检查功能正在开发中'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取轮换状态失败:', error)
      res.status(500).json({
        success: false,
        error: '获取轮换状态失败',
        message: error.message
      })
    }
  })

  /**
   * POST /api-keys/export
   * 导出API密钥配置
   */
  router.post('/api-keys/export', async (req, res) => {
    try {
      const { includeKeys = false } = req.body

      const config = apiKeyManager.exportConfig()

      // 如果不包含密钥，则移除加密的密钥数据
      if (!includeKeys) {
        for (const provider in config.keys) {
          for (const keyId in config.keys[provider]) {
            delete config.keys[provider][keyId].encryptedKey
          }
        }
      }

      res.json({
        success: true,
        data: {
          config,
          message: includeKeys ? '包含完整密钥数据的配置已导出' : '不含密钥数据的配置已导出'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('导出API密钥配置失败:', error)
      res.status(500).json({
        success: false,
        error: '导出API密钥配置失败',
        message: error.message
      })
    }
  })

  /**
   * POST /api-keys/import
   * 导入API密钥配置
   */
  router.post('/api-keys/import', async (req, res) => {
    try {
      const { config } = req.body

      if (!config) {
        return res.status(400).json({
          success: false,
          error: '缺少必要参数',
          message: 'config参数是必需的'
        })
      }

      apiKeyManager.importConfig(config)

      res.json({
        success: true,
        data: {
          message: 'API密钥配置导入成功'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('导入API密钥配置失败:', error)
      res.status(500).json({
        success: false,
        error: '导入API密钥配置失败',
        message: error.message
      })
    }
  })

  logger.info('API Keys Management API routes loaded')
}
