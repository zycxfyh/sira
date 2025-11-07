const express = require('express')
const { StreamingManager } = require('../../streaming-manager')

let streamingManager = null

/**
 * 流式响应API路由
 * 借鉴OpenAI流式API和Twitter Streaming API的设计理念
 * 提供完整的SSE和WebSocket流式响应管理接口
 */
function streamingRoutes() {
  const router = express.Router()

  // 初始化流式响应管理器
  if (!streamingManager) {
    streamingManager = new StreamingManager()
    streamingManager.initialize().catch(console.error)
  }

  // ==================== SSE流式响应 ====================

  /**
   * GET /streaming/sse
   * 建立SSE连接
   */
  router.get('/sse', (req, res) => {
    try {
      const options = {
        streamId: req.query.streamId,
        userId: req.headers['x-user-id'] || req.query.userId
      }

      const result = streamingManager.createSSEConnection(req, res, options)

      // SSE连接已建立，响应将在createSSEConnection中处理
      console.log(`📡 SSE流已建立: ${result.connectionId}`)

    } catch (error) {
      console.error('建立SSE连接失败:', error)
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: '建立SSE连接失败',
          message: error.message
        })
      }
    }
  })

  /**
   * POST /streaming/sse/:streamId/data
   * 向SSE流发送数据
   */
  router.post('/sse/:streamId/data', async (req, res) => {
    try {
      const { streamId } = req.params
      const { data, eventType = 'data', metadata = {} } = req.body

      if (!data) {
        return res.status(400).json({
          success: false,
          error: '缺少数据内容'
        })
      }

      await streamingManager.sendStreamData(streamId, data, {
        eventType,
        metadata: {
          ...metadata,
          source: 'api',
          sender: req.headers['x-user-id'] || 'api'
        }
      })

      res.json({
        success: true,
        message: '数据已发送到流'
      })
    } catch (error) {
      console.error('发送SSE数据失败:', error)
      res.status(400).json({
        success: false,
        error: '发送SSE数据失败',
        message: error.message
      })
    }
  })

  // ==================== 流式会话管理 ====================

  /**
   * POST /streaming/streams
   * 创建流式会话
   */
  router.post('/streams', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.body.userId || 'anonymous'
      const options = req.body.options || {}

      const stream = streamingManager.createStream(userId, options)

      res.status(201).json({
        success: true,
        data: {
          streamId: stream.id,
          userId: stream.userId,
          status: stream.status,
          createdAt: stream.createdAt,
          options: stream.options
        },
        message: '流式会话已创建'
      })
    } catch (error) {
      console.error('创建流式会话失败:', error)
      res.status(400).json({
        success: false,
        error: '创建流式会话失败',
        message: error.message
      })
    }
  })

  /**
   * GET /streaming/streams
   * 获取流式会话列表
   */
  router.get('/streams', async (req, res) => {
    try {
      const { userId, status = 'active', limit = 20, offset = 0 } = req.query

      const effectiveUserId = userId || req.headers['x-user-id']
      if (!effectiveUserId) {
        return res.status(400).json({
          success: false,
          error: '缺少用户ID'
        })
      }

      // 获取用户的所有活跃流
      const userStreams = Array.from(streamingManager.activeStreams.values())
        .filter(stream => stream.userId === effectiveUserId)
        .filter(stream => !status || stream.status === status)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      const total = userStreams.length
      const streams = userStreams.slice(parseInt(offset), parseInt(offset) + parseInt(limit))

      const formattedStreams = streams.map(stream => ({
        id: stream.id,
        userId: stream.userId,
        status: stream.status,
        connections: stream.connections.size,
        messageCount: stream.messageCount,
        createdAt: stream.createdAt,
        lastActivity: new Date(stream.lastActivity).toISOString()
      }))

      res.json({
        success: true,
        data: formattedStreams,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total
        }
      })
    } catch (error) {
      console.error('获取流式会话列表失败:', error)
      res.status(500).json({
        success: false,
        error: '获取流式会话列表失败',
        message: error.message
      })
    }
  })

  /**
   * GET /streaming/streams/:streamId
   * 获取流式会话详情
   */
  router.get('/streams/:streamId', async (req, res) => {
    try {
      const { streamId } = req.params
      const userId = req.headers['x-user-id']

      const stream = streamingManager.activeStreams.get(streamId)

      if (!stream) {
        return res.status(404).json({
          success: false,
          error: '流式会话不存在'
        })
      }

      // 检查权限
      if (userId && stream.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权访问此流式会话'
        })
      }

      res.json({
        success: true,
        data: {
          id: stream.id,
          userId: stream.userId,
          status: stream.status,
          connections: Array.from(stream.connections),
          connectionCount: stream.connections.size,
          messageCount: stream.messageCount,
          createdAt: stream.createdAt,
          lastActivity: new Date(stream.lastActivity).toISOString(),
          options: stream.options
        }
      })
    } catch (error) {
      console.error('获取流式会话详情失败:', error)
      res.status(500).json({
        success: false,
        error: '获取流式会话详情失败',
        message: error.message
      })
    }
  })

  /**
   * POST /streaming/streams/:streamId/join
   * 加入流式会话
   */
  router.post('/streams/:streamId/join', async (req, res) => {
    try {
      const { streamId } = req.params
      const connectionId = req.body.connectionId || req.headers['x-connection-id']

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: '缺少连接ID'
        })
      }

      const result = streamingManager.joinStream(streamId, connectionId)

      res.json({
        success: true,
        data: result,
        message: '已成功加入流式会话'
      })
    } catch (error) {
      console.error('加入流式会话失败:', error)
      res.status(400).json({
        success: false,
        error: '加入流式会话失败',
        message: error.message
      })
    }
  })

  /**
   * POST /streaming/streams/:streamId/leave
   * 离开流式会话
   */
  router.post('/streams/:streamId/leave', async (req, res) => {
    try {
      const { streamId } = req.params
      const connectionId = req.body.connectionId || req.headers['x-connection-id']

      if (!connectionId) {
        return res.status(400).json({
          success: false,
          error: '缺少连接ID'
        })
      }

      streamingManager.leaveStream(streamId, connectionId)

      res.json({
        success: true,
        message: '已成功离开流式会话'
      })
    } catch (error) {
      console.error('离开流式会话失败:', error)
      res.status(400).json({
        success: false,
        error: '离开流式会话失败',
        message: error.message
      })
    }
  })

  /**
   * POST /streaming/streams/:streamId/send
   * 向流发送数据
   */
  router.post('/streams/:streamId/send', async (req, res) => {
    try {
      const { streamId } = req.params
      const { data, eventType = 'data', metadata = {} } = req.body
      const userId = req.headers['x-user-id']

      if (!data) {
        return res.status(400).json({
          success: false,
          error: '缺少数据内容'
        })
      }

      // 检查流的所有权
      const stream = streamingManager.activeStreams.get(streamId)
      if (!stream) {
        return res.status(404).json({
          success: false,
          error: '流式会话不存在'
        })
      }

      if (userId && stream.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权向此流发送数据'
        })
      }

      await streamingManager.sendStreamData(streamId, data, {
        eventType,
        metadata: {
          ...metadata,
          sender: userId || 'api',
          source: 'api'
        }
      })

      res.json({
        success: true,
        message: '数据已发送到流'
      })
    } catch (error) {
      console.error('发送流数据失败:', error)
      res.status(400).json({
        success: false,
        error: '发送流数据失败',
        message: error.message
      })
    }
  })

  /**
   * DELETE /streaming/streams/:streamId
   * 关闭流式会话
   */
  router.delete('/streams/:streamId', async (req, res) => {
    try {
      const { streamId } = req.params
      const { reason = 'api_request' } = req.body
      const userId = req.headers['x-user-id']

      const stream = streamingManager.activeStreams.get(streamId)
      if (!stream) {
        return res.status(404).json({
          success: false,
          error: '流式会话不存在'
        })
      }

      // 检查权限
      if (userId && stream.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权关闭此流式会话'
        })
      }

      streamingManager.closeStream(streamId, reason)

      res.json({
        success: true,
        message: '流式会话已关闭'
      })
    } catch (error) {
      console.error('关闭流式会话失败:', error)
      res.status(400).json({
        success: false,
        error: '关闭流式会话失败',
        message: error.message
      })
    }
  })

  // ==================== 广播和通知 ====================

  /**
   * POST /streaming/broadcast
   * 广播消息到所有连接
   */
  router.post('/broadcast', async (req, res) => {
    try {
      const { message, userId, eventType = 'broadcast', metadata = {} } = req.body

      if (!message) {
        return res.status(400).json({
          success: false,
          error: '缺少消息内容'
        })
      }

      streamingManager.broadcast(message, {
        userId,
        eventType,
        metadata: {
          ...metadata,
          broadcaster: req.headers['x-user-id'] || 'api',
          timestamp: new Date().toISOString()
        }
      })

      res.json({
        success: true,
        message: '广播消息已发送'
      })
    } catch (error) {
      console.error('广播消息失败:', error)
      res.status(500).json({
        success: false,
        error: '广播消息失败',
        message: error.message
      })
    }
  })

  // ==================== 连接管理 ====================

  /**
   * GET /streaming/connections
   * 获取连接列表（管理员功能）
   */
  router.get('/connections', async (req, res) => {
    try {
      // 这里应该添加管理员权限检查
      const isAdmin = req.headers['x-admin'] === 'true'

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: '需要管理员权限'
        })
      }

      const connections = Array.from(streamingManager.activeConnections.values())
        .map(conn => ({
          id: conn.id,
          type: conn.type,
          streamId: conn.streamId,
          userId: conn.userId,
          clientIP: conn.clientIP,
          createdAt: conn.createdAt,
          lastActivity: new Date(conn.lastActivity).toISOString(),
          age: Math.round((Date.now() - conn.lastActivity) / 1000)
        }))

      res.json({
        success: true,
        data: connections,
        total: connections.length
      })
    } catch (error) {
      console.error('获取连接列表失败:', error)
      res.status(500).json({
        success: false,
        error: '获取连接列表失败',
        message: error.message
      })
    }
  })

  /**
   * DELETE /streaming/connections/:connectionId
   * 关闭指定连接
   */
  router.delete('/connections/:connectionId', async (req, res) => {
    try {
      const { connectionId } = req.params
      const { reason = 'admin_request' } = req.body

      // 这里应该添加管理员权限检查
      const isAdmin = req.headers['x-admin'] === 'true'

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: '需要管理员权限'
        })
      }

      streamingManager.closeConnection(connectionId, reason)

      res.json({
        success: true,
        message: '连接已关闭'
      })
    } catch (error) {
      console.error('关闭连接失败:', error)
      res.status(400).json({
        success: false,
        error: '关闭连接失败',
        message: error.message
      })
    }
  })

  // ==================== 统计和监控 ====================

  /**
   * GET /streaming/stats
   * 获取流式响应统计信息
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = streamingManager.getPerformanceStatistics()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('获取流式统计失败:', error)
      res.status(500).json({
        success: false,
        error: '获取流式统计失败',
        message: error.message
      })
    }
  })

  /**
   * GET /streaming/connections/stats
   * 获取连接统计
   */
  router.get('/connections/stats', async (req, res) => {
    try {
      const stats = streamingManager.getConnectionStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('获取连接统计失败:', error)
      res.status(500).json({
        success: false,
        error: '获取连接统计失败',
        message: error.message
      })
    }
  })

  /**
   * GET /streaming/streams/stats
   * 获取流统计
   */
  router.get('/streams/stats', async (req, res) => {
    try {
      const stats = streamingManager.getStreamStats()

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('获取流统计失败:', error)
      res.status(500).json({
        success: false,
        error: '获取流统计失败',
        message: error.message
      })
    }
  })

  // ==================== 健康检查 ====================

  /**
   * GET /streaming/health
   * 流式响应服务健康检查
   */
  router.get('/health', async (req, res) => {
    try {
      const stats = streamingManager.getPerformanceStatistics()

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          streamingManager: !!streamingManager,
          activeConnections: stats.activeConnections,
          activeStreams: stats.activeStreams
        },
        stats: {
          totalConnections: stats.totalConnections,
          activeConnections: stats.activeConnections,
          totalStreams: stats.totalStreams,
          activeStreams: stats.activeStreams,
          messagesSent: stats.messagesSent,
          bytesTransferred: stats.bytesTransferred,
          connectionErrors: stats.connectionErrors
        }
      }

      // 检查组件状态
      if (!streamingManager) {
        health.status = 'unhealthy'
      }

      // 检查连接负载
      if (stats.activeConnections > streamingManager.maxConnections * 0.9) {
        health.status = 'warning'
        health.warnings = ['连接数接近上限']
      }

      // 检查错误率
      const errorRate = stats.totalConnections > 0 ? stats.connectionErrors / stats.totalConnections : 0
      if (errorRate > 0.1) {
        health.status = 'warning'
        health.warnings = (health.warnings || []).concat(['连接错误率较高'])
      }

      const statusCode = health.status === 'healthy' ? 200 :
                        health.status === 'warning' ? 200 : 503

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

module.exports = streamingRoutes
