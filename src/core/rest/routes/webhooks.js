const express = require('express');
const { WebhookManager } = require('../../webhook-manager');

let webhookManager = null;

/**
 * Webhook管理API路由
 * 借鉴Stripe和GitHub的webhook管理设计，提供完整的webhook生命周期管理
 */
function webhooksRoutes() {
  const router = express.Router();

  // 初始化Webhook管理器
  if (!webhookManager) {
    webhookManager = new WebhookManager();
    webhookManager.initialize().catch(console.error);
  }

  // ==================== Webhook管理 ====================

  /**
   * GET /webhooks
   * 获取所有webhooks
   */
  router.get('/', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;

      const webhooks = Array.from(webhookManager.webhooks.values())
        .filter(webhook => !userId || webhook.userId === userId)
        .map(webhook => ({
          id: webhook.id,
          url: webhook.url,
          events: webhook.events,
          status: webhook.status,
          description: webhook.description,
          createdAt: webhook.createdAt,
          lastTriggeredAt: webhook.lastTriggeredAt,
          successCount: webhook.successCount,
          failureCount: webhook.failureCount,
        }));

      res.json({
        success: true,
        data: webhooks,
        total: webhooks.length,
      });
    } catch (error) {
      console.error('获取webhooks失败:', error);
      res.status(500).json({
        success: false,
        error: '获取webhooks失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /webhooks
   * 注册新webhook
   */
  router.post('/', async (req, res) => {
    try {
      const webhookConfig = req.body;

      if (!webhookConfig.url) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['url'],
        });
      }

      // 设置用户ID（如果未提供）
      if (!webhookConfig.userId) {
        webhookConfig.userId = req.headers['x-user-id'] || req.ip || 'anonymous';
      }

      const webhook = await webhookManager.registerWebhook(webhookConfig);

      res.status(201).json({
        success: true,
        data: {
          id: webhook.id,
          url: webhook.url,
          secret: webhook.secret, // 只在创建时返回密钥
          events: webhook.events,
          status: webhook.status,
          createdAt: webhook.createdAt,
        },
        message: 'Webhook注册成功',
      });
    } catch (error) {
      console.error('注册webhook失败:', error);
      res.status(400).json({
        success: false,
        error: '注册webhook失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /webhooks/:webhookId
   * 获取webhook详情
   */
  router.get('/:webhookId', async (req, res) => {
    try {
      const { webhookId } = req.params;
      const webhook = webhookManager.webhooks.get(webhookId);

      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook不存在',
        });
      }

      // 检查权限（用户只能查看自己的webhook）
      const userId = req.headers['x-user-id'];
      if (userId && webhook.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权访问此webhook',
        });
      }

      res.json({
        success: true,
        data: webhook,
      });
    } catch (error) {
      console.error('获取webhook详情失败:', error);
      res.status(500).json({
        success: false,
        error: '获取webhook详情失败',
        message: error.message,
      });
    }
  });

  /**
   * PUT /webhooks/:webhookId
   * 更新webhook配置
   */
  router.put('/:webhookId', async (req, res) => {
    try {
      const { webhookId } = req.params;
      const updates = req.body;
      const userId = req.headers['x-user-id'];

      const webhook = webhookManager.webhooks.get(webhookId);
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook不存在',
        });
      }

      // 检查权限
      if (userId && webhook.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权修改此webhook',
        });
      }

      const updatedWebhook = await webhookManager.updateWebhook(webhookId, updates);

      res.json({
        success: true,
        data: updatedWebhook,
        message: 'Webhook更新成功',
      });
    } catch (error) {
      console.error('更新webhook失败:', error);
      res.status(400).json({
        success: false,
        error: '更新webhook失败',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /webhooks/:webhookId
   * 删除webhook
   */
  router.delete('/:webhookId', async (req, res) => {
    try {
      const { webhookId } = req.params;
      const userId = req.headers['x-user-id'];

      const webhook = webhookManager.webhooks.get(webhookId);
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook不存在',
        });
      }

      // 检查权限
      if (userId && webhook.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权删除此webhook',
        });
      }

      await webhookManager.deleteWebhook(webhookId);

      res.json({
        success: true,
        message: 'Webhook删除成功',
      });
    } catch (error) {
      console.error('删除webhook失败:', error);
      res.status(400).json({
        success: false,
        error: '删除webhook失败',
        message: error.message,
      });
    }
  });

  // ==================== Webhook操作 ====================

  /**
   * POST /webhooks/:webhookId/test
   * 测试webhook连接
   */
  router.post('/:webhookId/test', async (req, res) => {
    try {
      const { webhookId } = req.params;
      const userId = req.headers['x-user-id'];

      const webhook = webhookManager.webhooks.get(webhookId);
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook不存在',
        });
      }

      // 检查权限
      if (userId && webhook.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权测试此webhook',
        });
      }

      const result = await webhookManager.testWebhook(webhookId);

      res.json({
        success: result.success,
        message: result.message,
        data: result,
      });
    } catch (error) {
      console.error('测试webhook失败:', error);
      res.status(500).json({
        success: false,
        error: '测试webhook失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /webhooks/:webhookId/retry
   * 重试失败的投递
   */
  router.post('/:webhookId/retry', async (req, res) => {
    try {
      const { webhookId } = req.params;
      const userId = req.headers['x-user-id'];

      const webhook = webhookManager.webhooks.get(webhookId);
      if (!webhook) {
        return res.status(404).json({
          success: false,
          error: 'Webhook不存在',
        });
      }

      // 检查权限
      if (userId && webhook.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权操作此webhook',
        });
      }

      const retryCount = await webhookManager.retryFailedDeliveries(webhookId);

      res.json({
        success: true,
        message: `已安排重试 ${retryCount} 个失败的投递`,
        data: { retryCount },
      });
    } catch (error) {
      console.error('重试webhook投递失败:', error);
      res.status(500).json({
        success: false,
        error: '重试webhook投递失败',
        message: error.message,
      });
    }
  });

  // ==================== 事件触发 ====================

  /**
   * POST /webhooks/trigger
   * 手动触发webhook事件（管理员功能）
   */
  router.post('/trigger', async (req, res) => {
    try {
      const { eventType, eventData, userId, source } = req.body;

      if (!eventType || !eventData) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['eventType', 'eventData'],
        });
      }

      const result = await webhookManager.triggerEvent(eventType, eventData, {
        userId,
        source: source || req.headers['x-source'] || 'manual',
        requestId: req.headers['x-request-id'],
      });

      res.json({
        success: true,
        data: result,
        message: `事件已触发，投递至 ${result.delivered}/${result.total} 个webhook`,
      });
    } catch (error) {
      console.error('触发webhook事件失败:', error);
      res.status(500).json({
        success: false,
        error: '触发webhook事件失败',
        message: error.message,
      });
    }
  });

  // ==================== 统计和监控 ====================

  /**
   * GET /webhooks/stats
   * 获取webhook统计信息
   */
  router.get('/stats/:webhookId?', async (req, res) => {
    try {
      const { webhookId } = req.params;
      const userId = req.headers['x-user-id'];

      const stats = webhookManager.getWebhookStats(webhookId);

      if (webhookId && !stats) {
        return res.status(404).json({
          success: false,
          error: 'Webhook不存在',
        });
      }

      // 如果指定了webhookId，检查权限
      if (webhookId && userId) {
        const webhook = webhookManager.webhooks.get(webhookId);
        if (webhook && webhook.userId !== userId) {
          return res.status(403).json({
            success: false,
            error: '无权查看此webhook统计',
          });
        }
      }

      // 如果没有指定webhookId，只返回当前用户的统计
      if (!webhookId && userId) {
        const userWebhooks = Array.from(webhookManager.webhooks.values())
          .filter(webhook => webhook.userId === userId)
          .map(webhook => webhook.id);

        const userStats = stats.filter(stat => userWebhooks.includes(stat.webhookId));
        return res.json({
          success: true,
          data: userStats,
        });
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('获取webhook统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取webhook统计失败',
        message: error.message,
      });
    }
  });

  // ==================== 批量操作 ====================

  /**
   * POST /webhooks/batch/test
   * 批量测试webhooks
   */
  router.post('/batch/test', async (req, res) => {
    try {
      const { webhookIds } = req.body;
      const userId = req.headers['x-user-id'];

      if (!Array.isArray(webhookIds)) {
        return res.status(400).json({
          success: false,
          error: 'webhookIds必须是数组',
        });
      }

      const results = [];
      for (const webhookId of webhookIds) {
        try {
          const webhook = webhookManager.webhooks.get(webhookId);

          // 检查权限
          if (userId && webhook && webhook.userId !== userId) {
            results.push({
              webhookId,
              success: false,
              error: '无权访问此webhook',
            });
            continue;
          }

          const result = await webhookManager.testWebhook(webhookId);
          results.push({
            webhookId,
            success: result.success,
            message: result.message,
          });
        } catch (error) {
          results.push({
            webhookId,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      res.json({
        success: true,
        data: results,
        message: `批量测试完成，成功: ${successCount}，失败: ${results.length - successCount}`,
      });
    } catch (error) {
      console.error('批量测试webhooks失败:', error);
      res.status(500).json({
        success: false,
        error: '批量测试webhooks失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /webhooks/batch/retry
   * 批量重试失败的投递
   */
  router.post('/batch/retry', async (req, res) => {
    try {
      const { webhookIds } = req.body;
      const userId = req.headers['x-user-id'];

      if (!Array.isArray(webhookIds)) {
        return res.status(400).json({
          success: false,
          error: 'webhookIds必须是数组',
        });
      }

      const results = [];
      let totalRetries = 0;

      for (const webhookId of webhookIds) {
        try {
          const webhook = webhookManager.webhooks.get(webhookId);

          // 检查权限
          if (userId && webhook && webhook.userId !== userId) {
            results.push({
              webhookId,
              success: false,
              error: '无权访问此webhook',
            });
            continue;
          }

          const retryCount = await webhookManager.retryFailedDeliveries(webhookId);
          totalRetries += retryCount;

          results.push({
            webhookId,
            success: true,
            retryCount,
          });
        } catch (error) {
          results.push({
            webhookId,
            success: false,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `批量重试完成，共安排 ${totalRetries} 个投递重试`,
      });
    } catch (error) {
      console.error('批量重试webhooks失败:', error);
      res.status(500).json({
        success: false,
        error: '批量重试webhooks失败',
        message: error.message,
      });
    }
  });

  return router;
}

module.exports = webhooksRoutes;
