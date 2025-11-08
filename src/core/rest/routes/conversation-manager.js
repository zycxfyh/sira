/**
 * Sira AI网关 - 对话管理 REST API路由
 * 借鉴Redis设计理念，提供完整的对话历史管理接口
 */

const express = require('express')
const { conversationManager } = require('../../conversation-manager')

const router = express.Router()

// 中间件：异步错误处理
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

// 中间件：验证会话存在
const validateSession = (req, res, next) => {
  const { sessionId } = req.params
  const session = conversationManager.getSession(sessionId)

  if (!session) {
    return res.status(404).json({
      success: false,
      error: '对话会话不存在'
    })
  }

  req.session = session
  next()
}

// 中间件：验证用户权限
const validateUserAccess = (req, res, next) => {
  const { userId } = req.params
  const authUserId = req.headers['x-user-id'] || req.query.userId || 'anonymous'

  // 简单的权限检查（实际应该更复杂）
  if (userId && userId !== authUserId && authUserId !== 'admin') {
    return res.status(403).json({
      success: false,
      error: '无权限访问此用户的对话'
    })
  }

  req.authUserId = authUserId
  next()
}

// ==================== 会话管理 ====================

/**
 * 创建新对话会话
 * POST /conversations
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    userId = 'anonymous',
    title,
    metadata = {},
    contextWindow
  } = req.body

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: '用户ID是必需的'
    })
  }

  try {
    const session = conversationManager.createSession(userId, {
      title,
      metadata,
      contextWindow
    })

    res.status(201).json({
      success: true,
      data: {
        session: {
          id: session.id,
          userId: session.userId,
          title: session.title,
          createdAt: session.createdAt,
          status: session.status,
          metadata: session.metadata
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 获取用户的所有会话
 * GET /conversations/:userId
 */
router.get('/:userId', validateUserAccess, asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { status = 'active', limit = 20, offset = 0 } = req.query

  try {
    const sessions = conversationManager.getUserSessions(userId, status)
    const paginatedSessions = sessions.slice(parseInt(offset), parseInt(offset) + parseInt(limit))

    res.json({
      success: true,
      data: {
        sessions: paginatedSessions,
        total: sessions.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 搜索用户会话
 * GET /conversations/:userId/search
 */
router.get('/:userId/search', validateUserAccess, asyncHandler(async (req, res) => {
  const { userId } = req.params
  const { q: query, status = 'active', limit = 20 } = req.query

  try {
    const sessions = conversationManager.searchSessions(userId, query, {
      status,
      limit: parseInt(limit)
    })

    res.json({
      success: true,
      data: {
        sessions,
        query,
        total: sessions.length
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 获取会话详情
 * GET /conversations/session/:sessionId
 */
router.get('/session/:sessionId', validateSession, (req, res) => {
  const session = req.session

  res.json({
    success: true,
    data: {
      session: {
        id: session.id,
        userId: session.userId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        lastActivity: session.lastActivity,
        status: session.status,
        metadata: session.metadata,
        stats: session.stats,
        summary: session.summary,
        topics: Array.from(session.topics),
        messageCount: session.messages.length
      }
    }
  })
})

/**
 * 更新会话信息
 * PUT /conversations/session/:sessionId
 */
router.put('/session/:sessionId', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  const updates = req.body

  // 不允许更新某些字段
  delete updates.id
  delete updates.userId
  delete updates.createdAt

  try {
    const session = conversationManager.updateSession(sessionId, updates)

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          updatedAt: session.updatedAt,
          status: session.status,
          metadata: session.metadata
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 删除会话
 * DELETE /conversations/session/:sessionId
 */
router.delete('/session/:sessionId', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params

  try {
    const deleted = conversationManager.deleteSession(sessionId)

    res.json({
      success: true,
      message: deleted ? '会话已删除' : '会话不存在'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 归档会话
 * POST /conversations/session/:sessionId/archive
 */
router.post('/session/:sessionId/archive', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params

  try {
    const session = conversationManager.archiveSession(sessionId)

    res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          archivedAt: session.archivedAt
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 消息管理 ====================

/**
 * 添加消息到会话
 * POST /conversations/session/:sessionId/messages
 */
router.post('/session/:sessionId/messages', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  const {
    role,
    content,
    metadata = {},
    importance = 'medium'
  } = req.body

  if (!role || !content) {
    return res.status(400).json({
      success: false,
      error: '消息角色和内容都是必需的'
    })
  }

  if (!['user', 'assistant', 'system'].includes(role)) {
    return res.status(400).json({
      success: false,
      error: '无效的消息角色'
    })
  }

  try {
    const message = conversationManager.addMessage(sessionId, {
      role,
      content,
      metadata,
      importance
    })

    res.status(201).json({
      success: true,
      data: {
        message: {
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          tokens: message.tokens,
          importance: message.importance
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 获取会话消息历史
 * GET /conversations/session/:sessionId/messages
 */
router.get('/session/:sessionId/messages', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  const { limit, offset = 0, role } = req.query

  const session = req.session
  let messages = session.messages

  // 过滤消息角色
  if (role) {
    messages = messages.filter(m => m.role === role)
  }

  // 分页
  const start = parseInt(offset)
  const end = limit ? start + parseInt(limit) : undefined
  const paginatedMessages = messages.slice(start, end)

  res.json({
    success: true,
    data: {
      messages: paginatedMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        tokens: m.tokens,
        importance: m.importance,
        isSummary: m.isSummary || false
      })),
      total: messages.length,
      limit: limit ? parseInt(limit) : messages.length,
      offset: start
    }
  })
}))

/**
 * 获取会话上下文
 * GET /conversations/session/:sessionId/context
 */
router.get('/session/:sessionId/context', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  const { limit } = req.query

  try {
    const contextMessages = conversationManager.getContext(sessionId, limit ? parseInt(limit) : null)

    res.json({
      success: true,
      data: {
        context: contextMessages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          isSummary: m.isSummary || false,
          isMemory: m.isMemory || false
        })),
        sessionId,
        contextSize: contextMessages.length
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 删除会话中的消息
 * DELETE /conversations/session/:sessionId/messages/:messageId
 */
router.delete('/session/:sessionId/messages/:messageId', validateSession, asyncHandler(async (req, res) => {
  const { sessionId, messageId } = req.params
  const session = req.session

  try {
    const messageIndex = session.messages.findIndex(m => m.id === messageId)

    if (messageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '消息不存在'
      })
    }

    // 从消息数组中移除
    const deletedMessage = session.messages.splice(messageIndex, 1)[0]

    // 更新统计信息
    session.stats.totalMessages--
    session.stats.totalTokens -= deletedMessage.tokens

    if (deletedMessage.role === 'user') {
      session.stats.userMessages--
    } else if (deletedMessage.role === 'assistant') {
      session.stats.assistantMessages--
    }

    session.updatedAt = new Date()

    res.json({
      success: true,
      message: '消息已删除',
      data: {
        deletedMessage: {
          id: deletedMessage.id,
          role: deletedMessage.role,
          timestamp: deletedMessage.timestamp
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 数据管理 ====================

/**
 * 导出会话数据
 * GET /conversations/session/:sessionId/export
 */
router.get('/session/:sessionId/export', validateSession, asyncHandler(async (req, res) => {
  const { sessionId } = req.params
  const { format = 'json' } = req.query

  try {
    const sessionData = conversationManager.exportSession(sessionId)

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="conversation-${sessionId}.json"`)
      res.json(sessionData)
    } else {
      // 转换为其他格式（暂时只支持JSON）
      res.status(400).json({
        success: false,
        error: '暂不支持的导出格式'
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 导入会话数据
 * POST /conversations/import
 */
router.post('/import', asyncHandler(async (req, res) => {
  const { sessionData } = req.body

  if (!sessionData || !sessionData.id) {
    return res.status(400).json({
      success: false,
      error: '无效的会话数据'
    })
  }

  try {
    const session = conversationManager.importSession(sessionData)

    res.status(201).json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
          messageCount: session.messages.length
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 批量删除会话
 * POST /conversations/batch/delete
 */
router.post('/batch/delete', asyncHandler(async (req, res) => {
  const { sessionIds } = req.body

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: '请提供要删除的会话ID列表'
    })
  }

  if (sessionIds.length > 50) {
    return res.status(400).json({
      success: false,
      error: '批量删除数量不能超过50个'
    })
  }

  const results = []
  let successCount = 0
  let failCount = 0

  for (const sessionId of sessionIds) {
    try {
      const deleted = conversationManager.deleteSession(sessionId)
      results.push({ sessionId, success: deleted })
      if (deleted) successCount++
      else failCount++
    } catch (error) {
      results.push({ sessionId, success: false, error: error.message })
      failCount++
    }
  }

  res.json({
    success: true,
    data: {
      results,
      summary: {
        total: sessionIds.length,
        successful: successCount,
        failed: failCount
      }
    }
  })
}))

// ==================== 记忆网络 ====================

/**
 * 获取相关记忆
 * GET /conversations/memory
 */
router.get('/memory', asyncHandler(async (req, res) => {
  const { query, limit = 5 } = req.query

  if (!query) {
    return res.status(400).json({
      success: false,
      error: '查询参数是必需的'
    })
  }

  try {
    const memories = conversationManager.memoryNetwork.retrieveMemories(query, parseInt(limit))

    res.json({
      success: true,
      data: {
        memories: memories.map(m => ({
          key: m.key,
          content: m.content,
          relevance: m.relevance,
          timestamp: m.timestamp,
          accessCount: m.accessCount
        })),
        query,
        count: memories.length
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 添加全局记忆
 * POST /conversations/memory
 */
router.post('/memory', asyncHandler(async (req, res) => {
  const { key, content, metadata = {} } = req.body

  if (!key || !content) {
    return res.status(400).json({
      success: false,
      error: '记忆键和内容都是必需的'
    })
  }

  try {
    const memory = conversationManager.memoryNetwork.addMemory(key, content, metadata)

    res.status(201).json({
      success: true,
      data: {
        memory: {
          id: memory.id,
          key: memory.key,
          content: memory.content,
          timestamp: memory.timestamp
        }
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 统计和监控 ====================

/**
 * 获取对话统计
 * GET /conversations/stats
 */
router.get('/stats', (req, res) => {
  const stats = conversationManager.getStats()

  res.json({
    success: true,
    data: {
      stats,
      timestamp: new Date()
    }
  })
})

/**
 * 获取用户对话概览
 * GET /conversations/:userId/overview
 */
router.get('/:userId/overview', validateUserAccess, asyncHandler(async (req, res) => {
  const { userId } = req.params

  try {
    const sessions = conversationManager.getUserSessions(userId)
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0)
    const totalTokens = sessions.reduce((sum, s) => sum + s.totalTokens, 0)

    // 计算最活跃的会话
    const mostActiveSession = sessions.reduce((max, current) =>
      current.messageCount > max.messageCount ? current : max,
    sessions[0] || null
    )

    // 计算会话活跃度分布
    const activityDistribution = {
      high: sessions.filter(s => s.messageCount > 50).length,
      medium: sessions.filter(s => s.messageCount > 10 && s.messageCount <= 50).length,
      low: sessions.filter(s => s.messageCount <= 10).length
    }

    res.json({
      success: true,
      data: {
        userId,
        overview: {
          totalSessions: sessions.length,
          totalMessages,
          totalTokens,
          avgMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0,
          avgTokensPerSession: sessions.length > 0 ? Math.round(totalTokens / sessions.length) : 0,
          mostActiveSession: mostActiveSession ? {
            id: mostActiveSession.id,
            title: mostActiveSession.title,
            messageCount: mostActiveSession.messageCount
          } : null,
          activityDistribution
        },
        recentSessions: sessions.slice(0, 5)
      }
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

// ==================== 系统维护 ====================

/**
 * 清理过期数据
 * POST /conversations/cleanup
 */
router.post('/cleanup', asyncHandler(async (req, res) => {
  try {
    conversationManager.cleanup()

    res.json({
      success: true,
      message: '数据清理完成',
      timestamp: new Date()
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
}))

/**
 * 健康检查
 * GET /conversations/health
 */
router.get('/health', (req, res) => {
  const stats = conversationManager.getStats()

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      stats: {
        totalSessions: stats.totalSessions,
        activeSessions: stats.activeSessionsCount,
        totalMessages: stats.totalMessages,
        totalTokens: stats.totalTokens
      },
      version: '1.0'
    }
  })
})

module.exports = router
