const express = require('express')
const { ABTestManager } = require('../../ab-test-manager')

let abTestManager = null

/**
 * A/B测试API路由
 * 借鉴RESTful设计理念，提供完整的CRUD操作和分析接口
 */
function abTestsRoutes() {
  const router = express.Router()

  // 初始化A/B测试管理器
  if (!abTestManager) {
    abTestManager = new ABTestManager()
    abTestManager.initialize().catch(console.error)
  }

  // ==================== 测试管理 ====================

  /**
   * GET /ab-tests
   * 获取所有测试概览
   */
  router.get('/', async (req, res) => {
    try {
      const overview = abTestManager.getTestsOverview()
      res.json({
        success: true,
        data: overview,
        total: overview.length
      })
    } catch (error) {
      console.error('获取A/B测试概览失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试概览失败',
        message: error.message
      })
    }
  })

  /**
   * POST /ab-tests
   * 创建新测试
   */
  router.post('/', async (req, res) => {
    try {
      const testConfig = req.body

      if (!testConfig.name || !testConfig.variants || !testConfig.target) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['name', 'variants', 'target']
        })
      }

      const test = await abTestManager.createTest(testConfig)
      res.status(201).json({
        success: true,
        data: test,
        message: 'A/B测试创建成功'
      })
    } catch (error) {
      console.error('创建A/B测试失败:', error)
      res.status(400).json({
        success: false,
        error: '创建测试失败',
        message: error.message
      })
    }
  })

  /**
   * GET /ab-tests/:testId
   * 获取测试详情
   */
  router.get('/:testId', async (req, res) => {
    try {
      const { testId } = req.params
      const test = abTestManager.tests.get(testId)

      if (!test) {
        return res.status(404).json({
          success: false,
          error: '测试不存在'
        })
      }

      res.json({
        success: true,
        data: test
      })
    } catch (error) {
      console.error('获取A/B测试详情失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试详情失败',
        message: error.message
      })
    }
  })

  /**
   * PUT /ab-tests/:testId
   * 更新测试配置
   */
  router.put('/:testId', async (req, res) => {
    try {
      const { testId } = req.params
      const updates = req.body

      const test = abTestManager.tests.get(testId)
      if (!test) {
        return res.status(404).json({
          success: false,
          error: '测试不存在'
        })
      }

      // 不允许更新运行中的测试的关键配置
      if (test.status === 'running') {
        const restrictedFields = ['variants', 'allocation', 'target', 'conditions']
        const hasRestrictedUpdate = restrictedFields.some(field => updates.hasOwnProperty(field))

        if (hasRestrictedUpdate) {
          return res.status(400).json({
            success: false,
            error: '运行中的测试不能更新关键配置',
            restrictedFields
          })
        }
      }

      // 更新测试配置
      Object.assign(test, updates, {
        updatedAt: new Date().toISOString()
      })

      await abTestManager.saveTestConfigurations()

      res.json({
        success: true,
        data: test,
        message: '测试配置更新成功'
      })
    } catch (error) {
      console.error('更新A/B测试失败:', error)
      res.status(500).json({
        success: false,
        error: '更新测试失败',
        message: error.message
      })
    }
  })

  /**
   * DELETE /ab-tests/:testId
   * 删除测试
   */
  router.delete('/:testId', async (req, res) => {
    try {
      const { testId } = req.params

      await abTestManager.deleteTest(testId)

      res.json({
        success: true,
        message: '测试删除成功'
      })
    } catch (error) {
      console.error('删除A/B测试失败:', error)
      res.status(400).json({
        success: false,
        error: '删除测试失败',
        message: error.message
      })
    }
  })

  // ==================== 测试控制 ====================

  /**
   * POST /ab-tests/:testId/start
   * 启动测试
   */
  router.post('/:testId/start', async (req, res) => {
    try {
      const { testId } = req.params

      await abTestManager.startTest(testId)

      res.json({
        success: true,
        message: '测试启动成功'
      })
    } catch (error) {
      console.error('启动A/B测试失败:', error)
      res.status(400).json({
        success: false,
        error: '启动测试失败',
        message: error.message
      })
    }
  })

  /**
   * POST /ab-tests/:testId/pause
   * 暂停测试
   */
  router.post('/:testId/pause', async (req, res) => {
    try {
      const { testId } = req.params

      await abTestManager.pauseTest(testId)

      res.json({
        success: true,
        message: '测试暂停成功'
      })
    } catch (error) {
      console.error('暂停A/B测试失败:', error)
      res.status(400).json({
        success: false,
        error: '暂停测试失败',
        message: error.message
      })
    }
  })

  /**
   * POST /ab-tests/:testId/stop
   * 停止测试
   */
  router.post('/:testId/stop', async (req, res) => {
    try {
      const { testId } = req.params

      await abTestManager.stopTest(testId)

      res.json({
        success: true,
        message: '测试停止成功'
      })
    } catch (error) {
      console.error('停止A/B测试失败:', error)
      res.status(400).json({
        success: false,
        error: '停止测试失败',
        message: error.message
      })
    }
  })

  // ==================== 测试分析 ====================

  /**
   * GET /ab-tests/:testId/analysis
   * 获取测试分析结果
   */
  router.get('/:testId/analysis', async (req, res) => {
    try {
      const { testId } = req.params

      const analysis = abTestManager.getTestAnalysis(testId)

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: '测试不存在或无分析数据'
        })
      }

      res.json({
        success: true,
        data: analysis
      })
    } catch (error) {
      console.error('获取A/B测试分析失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试分析失败',
        message: error.message
      })
    }
  })

  /**
   * GET /ab-tests/:testId/results
   * 获取测试原始结果数据
   */
  router.get('/:testId/results', async (req, res) => {
    try {
      const { testId } = req.params
      const { metric, variant, limit = 1000 } = req.query

      const results = abTestManager.results.get(testId)

      if (!results) {
        return res.status(404).json({
          success: false,
          error: '测试结果不存在'
        })
      }

      let filteredResults = results.metrics

      // 按指标过滤
      if (metric) {
        filteredResults = { [metric]: results.metrics[metric] }
      }

      // 按变体过滤
      if (variant) {
        Object.keys(filteredResults).forEach(metricName => {
          if (filteredResults[metricName][variant]) {
            filteredResults[metricName] = { [variant]: filteredResults[metricName][variant] }
          } else {
            delete filteredResults[metricName]
          }
        })
      }

      // 限制返回数量
      Object.keys(filteredResults).forEach(metricName => {
        Object.keys(filteredResults[metricName]).forEach(variantId => {
          filteredResults[metricName][variantId] = filteredResults[metricName][variantId]
            .slice(-parseInt(limit))
        })
      })

      res.json({
        success: true,
        data: {
          testId,
          metrics: filteredResults,
          updatedAt: results.updatedAt
        }
      })
    } catch (error) {
      console.error('获取A/B测试结果失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试结果失败',
        message: error.message
      })
    }
  })

  // ==================== 流量分配 ====================

  /**
   * POST /ab-tests/:testId/allocate
   * 为用户分配测试变体
   */
  router.post('/:testId/allocate', async (req, res) => {
    try {
      const { testId } = req.params
      const { userId, context = {} } = req.body

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: '缺少userId参数'
        })
      }

      const allocation = abTestManager.allocateVariant(testId, userId, context)

      if (!allocation) {
        return res.json({
          success: true,
          data: null,
          message: '用户未参与测试'
        })
      }

      res.json({
        success: true,
        data: allocation
      })
    } catch (error) {
      console.error('分配A/B测试变体失败:', error)
      res.status(500).json({
        success: false,
        error: '分配测试变体失败',
        message: error.message
      })
    }
  })

  /**
   * POST /ab-tests/:testId/record
   * 记录测试结果
   */
  router.post('/:testId/record', async (req, res) => {
    try {
      const { testId } = req.params
      const { variantId, userId, metrics } = req.body

      if (!variantId || !userId || !metrics) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['variantId', 'userId', 'metrics']
        })
      }

      await abTestManager.recordResult(testId, variantId, userId, metrics)

      res.json({
        success: true,
        message: '测试结果记录成功'
      })
    } catch (error) {
      console.error('记录A/B测试结果失败:', error)
      res.status(500).json({
        success: false,
        error: '记录测试结果失败',
        message: error.message
      })
    }
  })

  // ==================== 批量操作 ====================

  /**
   * POST /ab-tests/batch/start
   * 批量启动测试
   */
  router.post('/batch/start', async (req, res) => {
    try {
      const { testIds } = req.body

      if (!Array.isArray(testIds)) {
        return res.status(400).json({
          success: false,
          error: 'testIds必须是数组'
        })
      }

      const results = []
      for (const testId of testIds) {
        try {
          await abTestManager.startTest(testId)
          results.push({ testId, success: true })
        } catch (error) {
          results.push({ testId, success: false, error: error.message })
        }
      }

      res.json({
        success: true,
        data: results,
        message: `批量启动完成，成功: ${results.filter(r => r.success).length}，失败: ${results.filter(r => !r.success).length}`
      })
    } catch (error) {
      console.error('批量启动A/B测试失败:', error)
      res.status(500).json({
        success: false,
        error: '批量启动测试失败',
        message: error.message
      })
    }
  })

  /**
   * POST /ab-tests/batch/stop
   * 批量停止测试
   */
  router.post('/batch/stop', async (req, res) => {
    try {
      const { testIds } = req.body

      if (!Array.isArray(testIds)) {
        return res.status(400).json({
          success: false,
          error: 'testIds必须是数组'
        })
      }

      const results = []
      for (const testId of testIds) {
        try {
          await abTestManager.stopTest(testId)
          results.push({ testId, success: true })
        } catch (error) {
          results.push({ testId, success: false, error: error.message })
        }
      }

      res.json({
        success: true,
        data: results,
        message: `批量停止完成，成功: ${results.filter(r => r.success).length}，失败: ${results.filter(r => !r.success).length}`
      })
    } catch (error) {
      console.error('批量停止A/B测试失败:', error)
      res.status(500).json({
        success: false,
        error: '批量停止测试失败',
        message: error.message
      })
    }
  })

  return router
}

module.exports = abTestsRoutes
