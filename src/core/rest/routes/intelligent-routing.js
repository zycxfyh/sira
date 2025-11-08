const express = require('express');
const { IntelligentRoutingManager } = require('../../intelligent-routing-manager');

let intelligentRoutingManager = null;

/**
 * 智能路由API路由
 * 借鉴OpenRouter的智能路由API设计理念
 * 提供复杂度感知的模型路由服务
 */
function intelligentRoutingRoutes() {
  const router = express.Router();

  // 初始化智能路由管理器
  if (!intelligentRoutingManager) {
    intelligentRoutingManager = new IntelligentRoutingManager();
    intelligentRoutingManager.initialize().catch(console.error);
  }

  // ==================== 路由服务 ====================

  /**
   * POST /intelligent-routing/route
   * 执行智能路由决策
   */
  router.post('/route', async (req, res) => {
    try {
      const { request, context = {} } = req.body;

      if (!request) {
        return res.status(400).json({
          success: false,
          error: '缺少请求内容',
          required: ['request'],
        });
      }

      // 设置请求上下文
      const routingContext = {
        ...context,
        userId: context.userId || req.headers['x-user-id'] || 'anonymous',
        requestId: context.requestId || req.headers['x-request-id'],
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      };

      const routingResult = await intelligentRoutingManager.routeRequest(request, routingContext);

      res.json({
        success: routingResult.success,
        model: routingResult.model,
        provider: routingResult.provider,
        routingStrategy: routingResult.routingStrategy,
        confidence: routingResult.decision?.confidence || 0,
        reasoning: routingResult.reasoning,
        analysis: routingResult.analysis,
        alternatives: routingResult.decision?.alternatives || [],
        metadata: routingResult.metadata,
      });
    } catch (error) {
      console.error('智能路由执行失败:', error);
      res.status(500).json({
        success: false,
        error: '智能路由执行失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /intelligent-routing/route-batch
   * 批量执行智能路由决策
   */
  router.post('/route-batch', async (req, res) => {
    try {
      const { requests, context = {} } = req.body;

      if (!requests || !Array.isArray(requests)) {
        return res.status(400).json({
          success: false,
          error: '缺少请求列表',
          required: ['requests'],
        });
      }

      if (requests.length > 100) {
        return res.status(400).json({
          success: false,
          error: '批量请求数量不能超过100个',
        });
      }

      // 设置批次上下文
      const batchContext = {
        ...context,
        userId: context.userId || req.headers['x-user-id'] || 'anonymous',
        batchId: context.batchId || req.headers['x-batch-id'] || `batch_${Date.now()}`,
        timestamp: new Date().toISOString(),
      };

      const routingResults = await intelligentRoutingManager.routeBatchRequests(
        requests,
        batchContext
      );

      // 统计结果
      const stats = {
        total: routingResults.length,
        successful: routingResults.filter(r => r.success).length,
        failed: routingResults.filter(r => !r.success).length,
        cacheHits: routingResults.filter(r => r.metadata?.cacheHit).length,
      };

      res.json({
        success: true,
        data: routingResults,
        stats,
        batchId: batchContext.batchId,
      });
    } catch (error) {
      console.error('批量智能路由执行失败:', error);
      res.status(500).json({
        success: false,
        error: '批量智能路由执行失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /intelligent-routing/analyze
   * 分析请求复杂度（不执行路由）
   */
  router.post('/analyze', async (req, res) => {
    try {
      const { request } = req.body;

      if (!request) {
        return res.status(400).json({
          success: false,
          error: '缺少请求内容',
        });
      }

      const analysis = intelligentRoutingManager.complexityAnalyzer.analyzeComplexity(request);

      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      console.error('复杂度分析失败:', error);
      res.status(500).json({
        success: false,
        error: '复杂度分析失败',
        message: error.message,
      });
    }
  });

  // ==================== 策略管理 ====================

  /**
   * GET /intelligent-routing/strategy
   * 获取当前路由策略
   */
  router.get('/strategy', async (req, res) => {
    try {
      const strategy = intelligentRoutingManager.getCurrentStrategy();

      res.json({
        success: true,
        data: strategy,
      });
    } catch (error) {
      console.error('获取路由策略失败:', error);
      res.status(500).json({
        success: false,
        error: '获取路由策略失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /intelligent-routing/strategy
   * 设置路由策略
   */
  router.post('/strategy', async (req, res) => {
    try {
      const { strategy } = req.body;

      if (!strategy) {
        return res.status(400).json({
          success: false,
          error: '缺少策略名称',
          required: ['strategy'],
        });
      }

      const result = await intelligentRoutingManager.setRoutingStrategy(strategy);

      res.json({
        success: true,
        data: result,
        message: `路由策略已切换到: ${result.name}`,
      });
    } catch (error) {
      console.error('设置路由策略失败:', error);
      res.status(400).json({
        success: false,
        error: '设置路由策略失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /intelligent-routing/strategies
   * 获取所有可用路由策略
   */
  router.get('/strategies', async (req, res) => {
    try {
      const strategies = {};

      for (const [key, strategy] of Object.entries(intelligentRoutingManager.routingStrategies)) {
        strategies[key] = {
          name: strategy.name,
          weights: strategy.weights,
          description: intelligentRoutingManager.getStrategyDescription(key),
          isActive: key === intelligentRoutingManager.activeStrategy,
        };
      }

      res.json({
        success: true,
        data: strategies,
      });
    } catch (error) {
      console.error('获取路由策略列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取路由策略列表失败',
        message: error.message,
      });
    }
  });

  // ==================== 用户偏好管理 ====================

  /**
   * GET /intelligent-routing/preferences/:userId
   * 获取用户路由偏好
   */
  router.get('/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      const preferences = intelligentRoutingManager.getUserPreferences(userId);

      if (!preferences) {
        return res.status(404).json({
          success: false,
          error: '用户偏好不存在',
        });
      }

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      console.error('获取用户偏好失败:', error);
      res.status(500).json({
        success: false,
        error: '获取用户偏好失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /intelligent-routing/preferences/:userId
   * 更新用户路由偏好
   */
  router.post('/preferences/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = req.body;

      // 验证偏好设置
      const validPreferences = {};
      const allowedKeys = [
        'preferredModels',
        'budgetLimit',
        'speedPreference',
        'qualityPreference',
      ];

      for (const key of allowedKeys) {
        if (preferences[key] !== undefined) {
          validPreferences[key] = preferences[key];
        }
      }

      if (Object.keys(validPreferences).length === 0) {
        return res.status(400).json({
          success: false,
          error: '没有有效的偏好设置',
          allowedKeys,
        });
      }

      // 验证偏好值
      if (
        validPreferences.speedPreference &&
        !['fast', 'balanced', 'slow'].includes(validPreferences.speedPreference)
      ) {
        return res.status(400).json({
          success: false,
          error: '无效的速度偏好值',
          allowedValues: ['fast', 'balanced', 'slow'],
        });
      }

      if (
        validPreferences.qualityPreference &&
        !['high', 'balanced', 'low'].includes(validPreferences.qualityPreference)
      ) {
        return res.status(400).json({
          success: false,
          error: '无效的质量偏好值',
          allowedValues: ['high', 'balanced', 'low'],
        });
      }

      const updatedPreferences = await intelligentRoutingManager.updateUserPreferences(
        userId,
        validPreferences
      );

      res.json({
        success: true,
        data: updatedPreferences,
        message: '用户偏好已更新',
      });
    } catch (error) {
      console.error('更新用户偏好失败:', error);
      res.status(400).json({
        success: false,
        error: '更新用户偏好失败',
        message: error.message,
      });
    }
  });

  // ==================== 统计和监控 ====================

  /**
   * GET /intelligent-routing/stats
   * 获取路由统计信息
   */
  router.get('/stats', async (req, res) => {
    try {
      const { timeRange = '1h' } = req.query;

      const stats = intelligentRoutingManager.getRoutingStatistics(timeRange);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('获取路由统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取路由统计失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /intelligent-routing/suggestions
   * 获取路由优化建议
   */
  router.get('/suggestions', async (req, res) => {
    try {
      const suggestions = intelligentRoutingManager.getRoutingSuggestions();

      res.json({
        success: true,
        data: suggestions,
      });
    } catch (error) {
      console.error('获取路由建议失败:', error);
      res.status(500).json({
        success: false,
        error: '获取路由建议失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /intelligent-routing/cache
   * 获取缓存状态
   */
  router.get('/cache', async (req, res) => {
    try {
      const cacheStats = {
        enabled: intelligentRoutingManager.cacheEnabled,
        size: intelligentRoutingManager.routeCache.size,
        ttl: intelligentRoutingManager.cacheTTL,
        hitRate: intelligentRoutingManager.getRoutingStatistics().cacheHitRate,
      };

      res.json({
        success: true,
        data: cacheStats,
      });
    } catch (error) {
      console.error('获取缓存状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取缓存状态失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /intelligent-routing/cache/clear
   * 清除路由缓存
   */
  router.post('/cache/clear', async (req, res) => {
    try {
      const result = intelligentRoutingManager.clearRouteCache();

      res.json({
        success: true,
        data: result,
        message: '路由缓存已清理',
      });
    } catch (error) {
      console.error('清理路由缓存失败:', error);
      res.status(500).json({
        success: false,
        error: '清理路由缓存失败',
        message: error.message,
      });
    }
  });

  // ==================== 模型能力查询 ====================

  /**
   * GET /intelligent-routing/models
   * 获取所有可用模型及其能力
   */
  router.get('/models', async (req, res) => {
    try {
      const models = {};

      for (const [model, capability] of Object.entries(
        intelligentRoutingManager.routingDecisionEngine.modelCapabilities
      )) {
        models[model] = {
          provider: intelligentRoutingManager.routingDecisionEngine.getProviderForModel(model),
          maxTokens: capability.maxTokens,
          strengths: capability.strengths,
          weaknesses: capability.weaknesses,
          costPerToken: capability.costPerToken,
          avgResponseTime: capability.avgResponseTime,
          successRate: capability.successRate,
        };
      }

      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      console.error('获取模型列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取模型列表失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /intelligent-routing/models/:model
   * 获取特定模型的详细信息
   */
  router.get('/models/:model', async (req, res) => {
    try {
      const { model } = req.params;

      const capability = intelligentRoutingManager.routingDecisionEngine.modelCapabilities[model];

      if (!capability) {
        return res.status(404).json({
          success: false,
          error: '模型不存在',
        });
      }

      // 获取实时性能指标
      const performanceMetrics =
        intelligentRoutingManager.routingDecisionEngine.performanceMetrics.get(model);

      const modelInfo = {
        model,
        provider: intelligentRoutingManager.routingDecisionEngine.getProviderForModel(model),
        capabilities: capability,
        performance: performanceMetrics || {
          avgResponseTime: capability.avgResponseTime,
          successRate: capability.successRate,
          lastUpdated: null,
        },
      };

      res.json({
        success: true,
        data: modelInfo,
      });
    } catch (error) {
      console.error('获取模型详情失败:', error);
      res.status(500).json({
        success: false,
        error: '获取模型详情失败',
        message: error.message,
      });
    }
  });

  // ==================== 健康检查 ====================

  /**
   * GET /intelligent-routing/health
   * 智能路由服务健康检查
   */
  router.get('/health', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          complexityAnalyzer: intelligentRoutingManager.complexityAnalyzer
            ? 'healthy'
            : 'unavailable',
          routingDecisionEngine: intelligentRoutingManager.routingDecisionEngine
            ? 'healthy'
            : 'unavailable',
        },
        stats: {
          totalRequests: intelligentRoutingManager.routingStats.totalRequests,
          cacheSize: intelligentRoutingManager.routeCache.size,
          activeStrategy: intelligentRoutingManager.activeStrategy,
        },
      };

      // 检查组件状态
      if (
        !intelligentRoutingManager.complexityAnalyzer ||
        !intelligentRoutingManager.routingDecisionEngine
      ) {
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error('健康检查失败:', error);
      res.status(503).json({
        success: false,
        error: '健康检查失败',
        message: error.message,
      });
    }
  });

  return router;
}

module.exports = intelligentRoutingRoutes;
