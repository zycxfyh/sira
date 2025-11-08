const express = require('express');
const { RulesEngine } = require('../../rules-engine');

let rulesEngine = null;

/**
 * 规则引擎管理API路由
 * 借鉴RESTful设计理念，提供完整的规则生命周期管理和执行接口
 */
function rulesRoutes() {
  const router = express.Router();

  // 初始化规则引擎
  if (!rulesEngine) {
    rulesEngine = new RulesEngine();
    rulesEngine.initialize().catch(console.error);
  }

  // ==================== 规则管理 ====================

  /**
   * GET /rules
   * 获取所有规则
   */
  router.get('/', async (req, res) => {
    try {
      const { enabled, tags, limit = 100, offset = 0 } = req.query;

      let rules = Array.from(rulesEngine.rules.values());

      // 过滤条件
      if (enabled !== undefined) {
        const enabledBool = enabled === 'true';
        rules = rules.filter(rule => rule.enabled === enabledBool);
      }

      if (tags) {
        const tagList = tags.split(',');
        rules = rules.filter(rule => tagList.some(tag => rule.tags.includes(tag)));
      }

      // 分页
      const total = rules.length;
      rules = rules.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      // 格式化响应
      const formattedRules = rules.map(rule => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        priority: rule.priority,
        enabled: rule.enabled,
        tags: rule.tags,
        conditions: rule.conditions,
        actions: rule.actions,
        executionCount: rule.executionCount,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        successRate:
          rule.executionCount > 0
            ? ((rule.successCount / rule.executionCount) * 100).toFixed(2)
            : 0,
        lastExecutedAt: rule.lastExecutedAt,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      }));

      res.json({
        success: true,
        data: formattedRules,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
      });
    } catch (error) {
      console.error('获取规则列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取规则列表失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /rules
   * 创建新规则
   */
  router.post('/', async (req, res) => {
    try {
      const ruleConfig = req.body;

      if (!ruleConfig.name || !ruleConfig.conditions || !ruleConfig.actions) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['name', 'conditions', 'actions'],
        });
      }

      const rule = await rulesEngine.createRule(ruleConfig);

      res.status(201).json({
        success: true,
        data: {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          priority: rule.priority,
          enabled: rule.enabled,
          conditions: rule.conditions,
          actions: rule.actions,
          createdAt: rule.createdAt,
        },
        message: '规则创建成功',
      });
    } catch (error) {
      console.error('创建规则失败:', error);
      res.status(400).json({
        success: false,
        error: '创建规则失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /rules/:ruleId
   * 获取规则详情
   */
  router.get('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;
      const rule = rulesEngine.rules.get(ruleId);

      if (!rule) {
        return res.status(404).json({
          success: false,
          error: '规则不存在',
        });
      }

      res.json({
        success: true,
        data: rule,
      });
    } catch (error) {
      console.error('获取规则详情失败:', error);
      res.status(500).json({
        success: false,
        error: '获取规则详情失败',
        message: error.message,
      });
    }
  });

  /**
   * PUT /rules/:ruleId
   * 更新规则
   */
  router.put('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      const updatedRule = await rulesEngine.updateRule(ruleId, updates);

      res.json({
        success: true,
        data: updatedRule,
        message: '规则更新成功',
      });
    } catch (error) {
      console.error('更新规则失败:', error);
      res.status(400).json({
        success: false,
        error: '更新规则失败',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /rules/:ruleId
   * 删除规则
   */
  router.delete('/:ruleId', async (req, res) => {
    try {
      const { ruleId } = req.params;

      await rulesEngine.deleteRule(ruleId);

      res.json({
        success: true,
        message: '规则删除成功',
      });
    } catch (error) {
      console.error('删除规则失败:', error);
      res.status(400).json({
        success: false,
        error: '删除规则失败',
        message: error.message,
      });
    }
  });

  // ==================== 规则集管理 ====================

  /**
   * GET /rules/sets
   * 获取所有规则集
   */
  router.get('/sets', async (req, res) => {
    try {
      const { enabled, limit = 50, offset = 0 } = req.query;

      let ruleSets = Array.from(rulesEngine.ruleSets.values());

      // 过滤条件
      if (enabled !== undefined) {
        const enabledBool = enabled === 'true';
        ruleSets = ruleSets.filter(ruleSet => ruleSet.enabled === enabledBool);
      }

      // 分页
      const total = ruleSets.length;
      ruleSets = ruleSets.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      res.json({
        success: true,
        data: ruleSets,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
      });
    } catch (error) {
      console.error('获取规则集列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取规则集列表失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /rules/sets
   * 创建规则集
   */
  router.post('/sets', async (req, res) => {
    try {
      const ruleSetConfig = req.body;

      if (!ruleSetConfig.name || !ruleSetConfig.rules) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['name', 'rules'],
        });
      }

      const ruleSet = await rulesEngine.createRuleSet(ruleSetConfig);

      res.status(201).json({
        success: true,
        data: ruleSet,
        message: '规则集创建成功',
      });
    } catch (error) {
      console.error('创建规则集失败:', error);
      res.status(400).json({
        success: false,
        error: '创建规则集失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /rules/sets/:ruleSetId
   * 获取规则集详情
   */
  router.get('/sets/:ruleSetId', async (req, res) => {
    try {
      const { ruleSetId } = req.params;
      const ruleSet = rulesEngine.ruleSets.get(ruleSetId);

      if (!ruleSet) {
        return res.status(404).json({
          success: false,
          error: '规则集不存在',
        });
      }

      res.json({
        success: true,
        data: ruleSet,
      });
    } catch (error) {
      console.error('获取规则集详情失败:', error);
      res.status(500).json({
        success: false,
        error: '获取规则集详情失败',
        message: error.message,
      });
    }
  });

  /**
   * PUT /rules/sets/:ruleSetId
   * 更新规则集
   */
  router.put('/sets/:ruleSetId', async (req, res) => {
    try {
      const { ruleSetId } = req.params;
      const updates = req.body;

      const ruleSet = rulesEngine.ruleSets.get(ruleSetId);
      if (!ruleSet) {
        return res.status(404).json({
          success: false,
          error: '规则集不存在',
        });
      }

      Object.assign(ruleSet, updates, {
        updatedAt: new Date().toISOString(),
      });

      // 验证规则集中的规则是否存在
      for (const ruleId of ruleSet.rules) {
        if (!rulesEngine.rules.has(ruleId)) {
          throw new Error(`规则 ${ruleId} 不存在`);
        }
      }

      await rulesEngine.saveRuleConfigurations();

      res.json({
        success: true,
        data: ruleSet,
        message: '规则集更新成功',
      });
    } catch (error) {
      console.error('更新规则集失败:', error);
      res.status(400).json({
        success: false,
        error: '更新规则集失败',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /rules/sets/:ruleSetId
   * 删除规则集
   */
  router.delete('/sets/:ruleSetId', async (req, res) => {
    try {
      const { ruleSetId } = req.params;

      await rulesEngine.deleteRuleSet(ruleSetId);

      res.json({
        success: true,
        message: '规则集删除成功',
      });
    } catch (error) {
      console.error('删除规则集失败:', error);
      res.status(400).json({
        success: false,
        error: '删除规则集失败',
        message: error.message,
      });
    }
  });

  // ==================== 规则执行 ====================

  /**
   * POST /rules/execute
   * 执行规则
   */
  router.post('/execute', async (req, res) => {
    try {
      const { context, ruleSetId, options = {} } = req.body;

      if (!context) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['context'],
        });
      }

      const result = await rulesEngine.executeRules(context, {
        ruleSetId,
        maxResults: options.maxResults || 10,
        dryRun: options.dryRun || false,
        includeLog: options.includeLog || false,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('执行规则失败:', error);
      res.status(500).json({
        success: false,
        error: '执行规则失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /rules/:ruleId/test
   * 测试规则条件
   */
  router.post('/:ruleId/test', async (req, res) => {
    try {
      const { ruleId } = req.params;
      const { context } = req.body;

      if (!context) {
        return res.status(400).json({
          success: false,
          error: '缺少context参数',
        });
      }

      const result = await rulesEngine.testRuleCondition(ruleId, context);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('测试规则失败:', error);
      res.status(400).json({
        success: false,
        error: '测试规则失败',
        message: error.message,
      });
    }
  });

  // ==================== 统计和监控 ====================

  /**
   * GET /rules/stats
   * 获取规则统计信息
   */
  router.get('/stats/:ruleId?', async (req, res) => {
    try {
      const { ruleId } = req.params;

      const stats = rulesEngine.getRuleStats(ruleId);

      if (ruleId && !stats) {
        return res.status(404).json({
          success: false,
          error: '规则不存在',
        });
      }

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('获取规则统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取规则统计失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /rules/engine/stats
   * 获取规则引擎统计信息
   */
  router.get('/engine/stats', async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          rulesCount: rulesEngine.rules.size,
          ruleSetsCount: rulesEngine.ruleSets.size,
          enabledRulesCount: Array.from(rulesEngine.rules.values()).filter(r => r.enabled).length,
          enabledRuleSetsCount: Array.from(rulesEngine.ruleSets.values()).filter(rs => rs.enabled)
            .length,
          engineStats: rulesEngine.stats,
        },
      });
    } catch (error) {
      console.error('获取引擎统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取引擎统计失败',
        message: error.message,
      });
    }
  });

  // ==================== 模板和示例 ====================

  /**
   * GET /rules/templates
   * 获取规则模板
   */
  router.get('/templates', async (req, res) => {
    try {
      const templates = {
        routing: {
          name: '智能路由规则',
          description: '基于用户等级和请求类型的智能路由',
          priority: 10,
          conditions: [
            {
              type: 'field',
              field: 'user.tier',
              operator: 'equals',
              value: 'premium',
            },
            {
              type: 'field',
              field: 'request.model',
              operator: 'in',
              value: ['gpt-4', 'claude-3-opus'],
            },
          ],
          actions: [
            {
              type: 'setField',
              params: {
                field: 'routing.provider',
                value: 'openai',
              },
            },
            {
              type: 'log',
              params: {
                level: 'info',
                message: 'Premium user routed to OpenAI GPT-4',
              },
            },
          ],
          tags: ['routing', 'premium'],
        },
        rateLimit: {
          name: '速率限制规则',
          description: '根据用户类型设置不同的速率限制',
          priority: 5,
          conditions: [
            {
              type: 'field',
              field: 'user.tier',
              operator: 'equals',
              value: 'free',
            },
          ],
          actions: [
            {
              type: 'modifyRequest',
              params: {
                modifications: [
                  {
                    type: 'set',
                    field: 'rateLimit.requestsPerHour',
                    value: 10,
                  },
                ],
              },
            },
          ],
          tags: ['rate-limit', 'free-tier'],
        },
        costControl: {
          name: '成本控制规则',
          description: '高成本请求需要额外验证',
          priority: 15,
          conditions: [
            {
              type: 'field',
              field: 'request.estimatedCost',
              operator: 'greaterThan',
              value: 1.0,
            },
            {
              type: 'field',
              field: 'user.tier',
              operator: 'notEquals',
              value: 'enterprise',
            },
          ],
          actions: [
            {
              type: 'setField',
              params: {
                field: 'request.requiresApproval',
                value: true,
              },
            },
            {
              type: 'webhook',
              params: {
                url: 'https://your-app.com/approval-required',
                method: 'POST',
              },
            },
          ],
          tags: ['cost-control', 'approval'],
        },
      };

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      console.error('获取规则模板失败:', error);
      res.status(500).json({
        success: false,
        error: '获取规则模板失败',
        message: error.message,
      });
    }
  });

  return router;
}

module.exports = rulesRoutes;
