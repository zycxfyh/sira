const { performanceBenchmarkManager } = require('../../performance-benchmark-manager')
const { testCases, testSuites, getTestCase, getTestSuite } = require('../../benchmark-test-cases')

/**
 * Performance Benchmark API Routes
 * 提供性能基准测试相关的API接口
 */

module.exports = function (router, { logger }) {
  /**
   * GET /benchmark/test-cases
   * 获取所有测试用例
   */
  router.get('/benchmark/test-cases', async (req, res) => {
    try {
      const { category, difficulty, search, limit = 50 } = req.query

      let results = []

      if (category) {
        results = getTestCase(category) ? [{ id: category, ...getTestCase(category) }] : []
      } else if (difficulty) {
        // 这里需要从benchmark-test-cases.js中获取对应难度等级的测试用例
        const { difficultyLevels } = require('../../benchmark-test-cases')
        const taskIds = difficultyLevels[difficulty] || []
        results = taskIds.map(id => ({ id, ...getTestCase(id) })).filter(Boolean)
      } else if (search) {
        const { searchTestCases } = require('../../benchmark-test-cases')
        results = searchTestCases(search)
      } else {
        results = Object.entries(testCases).map(([id, testCase]) => ({
          id,
          ...testCase
        }))
      }

      // 限制返回数量
      results = results.slice(0, parseInt(limit))

      res.json({
        success: true,
        data: {
          test_cases: results,
          count: results.length,
          total: Object.keys(testCases).length
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取测试用例失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试用例失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/test-cases/:taskId
   * 获取特定测试用例详情
   */
  router.get('/benchmark/test-cases/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params
      const testCase = getTestCase(taskId)

      if (!testCase) {
        return res.status(404).json({
          success: false,
          error: '测试用例不存在',
          message: `测试用例 '${taskId}' 不存在`
        })
      }

      res.json({
        success: true,
        data: {
          test_case: { id: taskId, ...testCase }
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取测试用例详情失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试用例详情失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/suites
   * 获取所有测试套件
   */
  router.get('/benchmark/suites', async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          suites: testSuites,
          count: Object.keys(testSuites).length
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取测试套件失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试套件失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/suites/:suiteId
   * 获取特定测试套件详情
   */
  router.get('/benchmark/suites/:suiteId', async (req, res) => {
    try {
      const { suiteId } = req.params
      const suite = getTestSuite(suiteId)

      if (!suite) {
        return res.status(404).json({
          success: false,
          error: '测试套件不存在',
          message: `测试套件 '${suiteId}' 不存在`
        })
      }

      res.json({
        success: true,
        data: {
          suite: { id: suiteId, ...suite }
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取测试套件详情失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试套件详情失败',
        message: error.message
      })
    }
  })

  /**
   * POST /benchmark/run
   * 运行基准测试
   */
  router.post('/benchmark/run', async (req, res) => {
    try {
      const config = req.body

      // 验证请求参数
      if (!config || typeof config !== 'object') {
        return res.status(400).json({
          success: false,
          error: '请求参数无效',
          message: '请提供有效的测试配置'
        })
      }

      // 开始异步运行测试
      const testPromise = performanceBenchmarkManager.runBenchmark(config)

      // 对于长时间运行的测试，返回任务ID
      const timeout = setTimeout(async () => {
        try {
          const result = await testPromise
          // 这里可以实现结果通知机制
          logger.info(`基准测试完成: ${result.testId}`)
        } catch (error) {
          logger.error('基准测试失败:', error)
        }
      }, 100) // 短暂延迟后继续处理

      // 立即返回确认响应
      res.json({
        success: true,
        data: {
          message: '基准测试已启动',
          status: 'running',
          estimated_duration: '根据配置而定，可能需要几分钟'
        },
        timestamp: new Date().toISOString()
      })

      // 等待测试完成
      try {
        const result = await testPromise
        // 测试完成后可以发送通知或更新状态
      } catch (error) {
        // 错误已经在manager中处理
      }
    } catch (error) {
      logger.error('启动基准测试失败:', error)
      res.status(500).json({
        success: false,
        error: '启动基准测试失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/results
   * 获取基准测试结果
   */
  router.get('/benchmark/results', async (req, res) => {
    try {
      const { testId, limit = 10, format = 'summary' } = req.query

      let results

      if (testId) {
        results = performanceBenchmarkManager.getResults(testId)
        if (!results) {
          return res.status(404).json({
            success: false,
            error: '测试结果不存在',
            message: `测试ID '${testId}' 的结果不存在`
          })
        }
        results = [results]
      } else {
        results = performanceBenchmarkManager.getLatestResults(parseInt(limit))
      }

      // 根据格式处理结果
      let processedResults
      switch (format) {
        case 'detailed':
          processedResults = results
          break
        case 'summary':
        default:
          processedResults = results.map(result => ({
            testId: result.testId,
            config: result.config,
            summary: result.analysis,
            metadata: result.metadata
          }))
          break
      }

      res.json({
        success: true,
        data: {
          results: processedResults,
          count: processedResults.length
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取基准测试结果失败:', error)
      res.status(500).json({
        success: false,
        error: '获取基准测试结果失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/results/:testId
   * 获取特定测试的详细结果
   */
  router.get('/benchmark/results/:testId', async (req, res) => {
    try {
      const { testId } = req.params
      const result = performanceBenchmarkManager.getResults(testId)

      if (!result) {
        return res.status(404).json({
          success: false,
          error: '测试结果不存在',
          message: `测试ID '${testId}' 的结果不存在`
        })
      }

      res.json({
        success: true,
        data: {
          result
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取测试详细结果失败:', error)
      res.status(500).json({
        success: false,
        error: '获取测试详细结果失败',
        message: error.message
      })
    }
  })

  /**
   * POST /benchmark/compare
   * 比较模型性能
   */
  router.post('/benchmark/compare', async (req, res) => {
    try {
      const { models, metric = 'response_time' } = req.body

      if (!models || !Array.isArray(models) || models.length < 2) {
        return res.status(400).json({
          success: false,
          error: '参数无效',
          message: '至少需要提供2个模型进行比较'
        })
      }

      const comparison = performanceBenchmarkManager.compareModels(models, metric)

      res.json({
        success: true,
        data: {
          comparison,
          models: models,
          metric: metric
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('模型性能比较失败:', error)
      res.status(500).json({
        success: false,
        error: '模型性能比较失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/status
   * 获取基准测试状态
   */
  router.get('/benchmark/status', async (req, res) => {
    try {
      const activeTests = Array.from(performanceBenchmarkManager.activeTests)
      const latestResults = performanceBenchmarkManager.getLatestResults(5)

      res.json({
        success: true,
        data: {
          active_tests: activeTests.length,
          active_test_ids: activeTests,
          recent_results: latestResults.length,
          latest_test: latestResults[0] ? {
            testId: latestResults[0].testId,
            startTime: latestResults[0].metadata.startTime,
            status: 'completed'
          } : null
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('获取基准测试状态失败:', error)
      res.status(500).json({
        success: false,
        error: '获取基准测试状态失败',
        message: error.message
      })
    }
  })

  /**
   * POST /benchmark/quick-test
   * 运行快速测试
   */
  router.post('/benchmark/quick-test', async (req, res) => {
    try {
      const { models, tasks = ['simple_qa', 'math_calculation'] } = req.body

      if (!models || !Array.isArray(models)) {
        return res.status(400).json({
          success: false,
          error: '参数无效',
          message: '请提供有效的模型列表'
        })
      }

      // 创建快速测试配置
      const quickConfig = {
        name: '快速性能测试',
        models: models,
        tasks: tasks,
        iterations: 3,
        concurrency: 2,
        timeout: 10000,
        includeQualityAssessment: false,
        generateReport: false
      }

      // 运行测试
      const result = await performanceBenchmarkManager.runBenchmark(quickConfig)

      res.json({
        success: true,
        data: {
          testId: result.testId,
          summary: result.analysis,
          message: '快速测试完成'
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('快速测试失败:', error)
      res.status(500).json({
        success: false,
        error: '快速测试失败',
        message: error.message
      })
    }
  })

  /**
   * DELETE /benchmark/results/:testId
   * 删除测试结果
   */
  router.delete('/benchmark/results/:testId', async (req, res) => {
    try {
      const { testId } = req.params

      // 这里应该实现删除功能
      // 由于当前实现没有删除方法，我们返回不支持的响应
      res.status(501).json({
        success: false,
        error: '功能暂未实现',
        message: '删除测试结果功能暂未实现'
      })
    } catch (error) {
      logger.error('删除测试结果失败:', error)
      res.status(500).json({
        success: false,
        error: '删除测试结果失败',
        message: error.message
      })
    }
  })

  /**
   * GET /benchmark/export
   * 导出测试结果
   */
  router.get('/benchmark/export', async (req, res) => {
    try {
      const { format = 'json', testId } = req.query

      let dataToExport

      if (testId) {
        const result = performanceBenchmarkManager.getResults(testId)
        if (!result) {
          return res.status(404).json({
            success: false,
            error: '测试结果不存在',
            message: `测试ID '${testId}' 的结果不存在`
          })
        }
        dataToExport = [result]
      } else {
        dataToExport = performanceBenchmarkManager.getResults()
      }

      const exportedData = performanceBenchmarkManager.exportResults(format)

      // 设置响应头
      const mimeTypes = {
        json: 'application/json',
        csv: 'text/csv'
      }

      res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename="benchmark_results.${format}"`)

      res.send(exportedData)
    } catch (error) {
      logger.error('导出测试结果失败:', error)
      res.status(500).json({
        success: false,
        error: '导出测试结果失败',
        message: error.message
      })
    }
  })

  /**
   * POST /benchmark/suite/:suiteId/run
   * 运行测试套件
   */
  router.post('/benchmark/suite/:suiteId/run', async (req, res) => {
    try {
      const { suiteId } = req.params
      const suite = getTestSuite(suiteId)

      if (!suite) {
        return res.status(404).json({
          success: false,
          error: '测试套件不存在',
          message: `测试套件 '${suiteId}' 不存在`
        })
      }

      // 合并用户提供的配置
      const config = {
        ...suite,
        ...req.body,
        name: req.body.name || suite.name
      }

      // 运行测试
      const result = await performanceBenchmarkManager.runBenchmark(config)

      res.json({
        success: true,
        data: {
          testId: result.testId,
          suite: suiteId,
          summary: result.analysis,
          message: `${suite.name} 测试完成`
        },
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      logger.error('运行测试套件失败:', error)
      res.status(500).json({
        success: false,
        error: '运行测试套件失败',
        message: error.message
      })
    }
  })

  logger.info('Performance Benchmark API routes loaded')
}
