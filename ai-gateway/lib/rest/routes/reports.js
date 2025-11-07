const express = require('express')
const { ReportGenerator } = require('../../report-generator')

let reportGenerator = null

/**
 * 报告管理API路由
 * 借鉴RESTful设计理念，提供完整的报告生成、管理和导出功能
 */
function reportsRoutes () {
  const router = express.Router()

  // 初始化报告生成器
  if (!reportGenerator) {
    reportGenerator = new ReportGenerator()
    reportGenerator.initialize().catch(console.error)
  }

  // ==================== 报告生成 ====================

  /**
   * POST /reports/generate
   * 生成报告
   */
  router.post('/generate', async (req, res) => {
    try {
      const {
        type,
        timeRange = '24h',
        filters = {},
        format = 'json',
        includeCharts = true,
        cache = true
      } = req.body

      if (!type) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['type']
        })
      }

      const report = await reportGenerator.generateReport(type, {
        timeRange,
        filters,
        format,
        includeCharts,
        cache
      })

      res.json({
        success: true,
        data: report
      })
    } catch (error) {
      console.error('生成报告失败:', error)
      res.status(500).json({
        success: false,
        error: '生成报告失败',
        message: error.message
      })
    }
  })

  /**
   * GET /reports/types
   * 获取支持的报告类型
   */
  router.get('/types', async (req, res) => {
    try {
      const reportTypes = Object.keys(reportGenerator.reportTypes).map(type => ({
        type,
        name: getReportTypeName(type),
        description: getReportTypeDescription(type),
        parameters: getReportTypeParameters(type)
      }))

      res.json({
        success: true,
        data: reportTypes
      })
    } catch (error) {
      console.error('获取报告类型失败:', error)
      res.status(500).json({
        success: false,
        error: '获取报告类型失败',
        message: error.message
      })
    }
  })

  // ==================== 仪表板 ====================

  /**
   * GET /reports/dashboard/:type
   * 获取仪表板数据
   */
  router.get('/dashboard/:type', async (req, res) => {
    try {
      const { type } = req.params
      const { timeRange = '24h', refresh = false } = req.query

      const dashboardData = await reportGenerator.getDashboardData(type, {
        timeRange,
        refresh: refresh === 'true'
      })

      res.json({
        success: true,
        data: dashboardData
      })
    } catch (error) {
      console.error('获取仪表板数据失败:', error)
      res.status(500).json({
        success: false,
        error: '获取仪表板数据失败',
        message: error.message
      })
    }
  })

  /**
   * GET /reports/dashboards
   * 获取支持的仪表板类型
   */
  router.get('/dashboards', async (req, res) => {
    try {
      const dashboardTypes = [
        {
          type: 'overview',
          name: '总览仪表板',
          description: '系统整体运行状态总览',
          metrics: ['请求数', '用户数', '响应时间', '错误率', '总成本']
        },
        {
          type: 'performance',
          name: '性能仪表板',
          description: '系统性能指标监控',
          metrics: ['响应时间', '吞吐量', '延迟分布', '性能瓶颈']
        },
        {
          type: 'usage',
          name: '使用情况仪表板',
          description: 'API使用情况统计',
          metrics: ['请求分布', '用户活跃度', '功能使用率', '成本分析']
        },
        {
          type: 'errors',
          name: '错误分析仪表板',
          description: '系统错误监控和分析',
          metrics: ['错误率', '错误类型', '错误趋势', '影响分析']
        }
      ]

      res.json({
        success: true,
        data: dashboardTypes
      })
    } catch (error) {
      console.error('获取仪表板类型失败:', error)
      res.status(500).json({
        success: false,
        error: '获取仪表板类型失败',
        message: error.message
      })
    }
  })

  // ==================== 自定义报告 ====================

  /**
   * GET /reports/custom
   * 获取自定义报告列表
   */
  router.get('/custom', async (req, res) => {
    try {
      const customReports = Array.from(reportGenerator.customReports.values())
        .map(report => ({
          id: report.id,
          name: report.name,
          description: report.description,
          type: report.type,
          enabled: report.enabled,
          schedule: report.schedule,
          lastGeneratedAt: report.lastGeneratedAt,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt
        }))

      res.json({
        success: true,
        data: customReports
      })
    } catch (error) {
      console.error('获取自定义报告失败:', error)
      res.status(500).json({
        success: false,
        error: '获取自定义报告失败',
        message: error.message
      })
    }
  })

  /**
   * POST /reports/custom
   * 创建自定义报告
   */
  router.post('/custom', async (req, res) => {
    try {
      const reportConfig = req.body

      if (!reportConfig.name || !reportConfig.config) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['name', 'config']
        })
      }

      const customReport = await reportGenerator.createCustomReport(reportConfig)

      res.status(201).json({
        success: true,
        data: customReport,
        message: '自定义报告创建成功'
      })
    } catch (error) {
      console.error('创建自定义报告失败:', error)
      res.status(400).json({
        success: false,
        error: '创建自定义报告失败',
        message: error.message
      })
    }
  })

  /**
   * GET /reports/custom/:reportId
   * 获取自定义报告详情
   */
  router.get('/custom/:reportId', async (req, res) => {
    try {
      const { reportId } = req.params

      const customReport = reportGenerator.customReports.get(reportId)
      if (!customReport) {
        return res.status(404).json({
          success: false,
          error: '自定义报告不存在'
        })
      }

      res.json({
        success: true,
        data: customReport
      })
    } catch (error) {
      console.error('获取自定义报告详情失败:', error)
      res.status(500).json({
        success: false,
        error: '获取自定义报告详情失败',
        message: error.message
      })
    }
  })

  /**
   * PUT /reports/custom/:reportId
   * 更新自定义报告
   */
  router.put('/custom/:reportId', async (req, res) => {
    try {
      const { reportId } = req.params
      const updates = req.body

      const customReport = reportGenerator.customReports.get(reportId)
      if (!customReport) {
        return res.status(404).json({
          success: false,
          error: '自定义报告不存在'
        })
      }

      // 更新报告配置
      Object.assign(customReport, updates, {
        updatedAt: new Date().toISOString()
      })

      await reportGenerator.saveReportConfigurations()

      res.json({
        success: true,
        data: customReport,
        message: '自定义报告更新成功'
      })
    } catch (error) {
      console.error('更新自定义报告失败:', error)
      res.status(500).json({
        success: false,
        error: '更新自定义报告失败',
        message: error.message
      })
    }
  })

  /**
   * DELETE /reports/custom/:reportId
   * 删除自定义报告
   */
  router.delete('/custom/:reportId', async (req, res) => {
    try {
      const { reportId } = req.params

      const customReport = reportGenerator.customReports.get(reportId)
      if (!customReport) {
        return res.status(404).json({
          success: false,
          error: '自定义报告不存在'
        })
      }

      reportGenerator.customReports.delete(reportId)
      await reportGenerator.saveReportConfigurations()

      res.json({
        success: true,
        message: '自定义报告删除成功'
      })
    } catch (error) {
      console.error('删除自定义报告失败:', error)
      res.status(500).json({
        success: false,
        error: '删除自定义报告失败',
        message: error.message
      })
    }
  })

  /**
   * POST /reports/custom/:reportId/generate
   * 生成自定义报告
   */
  router.post('/custom/:reportId/generate', async (req, res) => {
    try {
      const { reportId } = req.params
      const { timeRange = '24h', format = 'json' } = req.body

      const customReport = reportGenerator.customReports.get(reportId)
      if (!customReport) {
        return res.status(404).json({
          success: false,
          error: '自定义报告不存在'
        })
      }

      const report = await reportGenerator.generateReport(customReport.type, {
        timeRange,
        filters: customReport.config.filters || {},
        format,
        config: customReport.config
      })

      res.json({
        success: true,
        data: report
      })
    } catch (error) {
      console.error('生成自定义报告失败:', error)
      res.status(500).json({
        success: false,
        error: '生成自定义报告失败',
        message: error.message
      })
    }
  })

  // ==================== 报告导出 ====================

  /**
   * POST /reports/export
   * 导出报告
   */
  router.post('/export', async (req, res) => {
    try {
      const { type, timeRange = '24h', filters = {}, format = 'json', filename } = req.body

      if (!type) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['type']
        })
      }

      // 生成报告
      const report = await reportGenerator.generateReport(type, {
        timeRange,
        filters,
        format: 'json' // 内部使用JSON格式
      })

      // 导出报告
      const exportResult = await reportGenerator.exportReport(report, format, { filename })

      if (filename) {
        // 返回文件路径
        res.json({
          success: true,
          data: {
            filePath: exportResult.filePath,
            mimeType: exportResult.mimeType,
            size: exportResult.size
          },
          message: '报告导出成功'
        })
      } else {
        // 直接返回数据
        res.set('Content-Type', exportResult.mimeType)
        res.set('Content-Length', exportResult.size)

        if (format === 'json') {
          res.set('Content-Disposition', `attachment; filename="report_${type}_${new Date().toISOString().split('T')[0]}.json"`)
        }

        res.send(exportResult.data)
      }
    } catch (error) {
      console.error('导出报告失败:', error)
      res.status(500).json({
        success: false,
        error: '导出报告失败',
        message: error.message
      })
    }
  })

  // ==================== 统计和监控 ====================

  /**
   * GET /reports/stats
   * 获取报告生成统计
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = {
        totalCustomReports: reportGenerator.customReports.size,
        enabledCustomReports: Array.from(reportGenerator.customReports.values()).filter(r => r.enabled).length,
        cacheSize: reportGenerator.reportCache.size,
        supportedReportTypes: Object.keys(reportGenerator.reportTypes).length,
        supportedDashboardTypes: 4, // overview, performance, usage, errors
        supportedExportFormats: ['json', 'csv', 'html'] // pdf暂未实现
      }

      res.json({
        success: true,
        data: stats
      })
    } catch (error) {
      console.error('获取报告统计失败:', error)
      res.status(500).json({
        success: false,
        error: '获取报告统计失败',
        message: error.message
      })
    }
  })

  // ==================== 批量操作 ====================

  /**
   * POST /reports/batch/generate
   * 批量生成报告
   */
  router.post('/batch/generate', async (req, res) => {
    try {
      const { reports } = req.body

      if (!Array.isArray(reports)) {
        return res.status(400).json({
          success: false,
          error: 'reports必须是数组'
        })
      }

      const results = []
      for (const reportConfig of reports) {
        try {
          const report = await reportGenerator.generateReport(reportConfig.type, {
            timeRange: reportConfig.timeRange || '24h',
            filters: reportConfig.filters || {},
            format: reportConfig.format || 'json'
          })

          results.push({
            id: reportConfig.id,
            success: true,
            report
          })
        } catch (error) {
          results.push({
            id: reportConfig.id,
            success: false,
            error: error.message
          })
        }
      }

      const successCount = results.filter(r => r.success).length

      res.json({
        success: true,
        data: results,
        message: `批量生成完成，成功: ${successCount}，失败: ${results.length - successCount}`
      })
    } catch (error) {
      console.error('批量生成报告失败:', error)
      res.status(500).json({
        success: false,
        error: '批量生成报告失败',
        message: error.message
      })
    }
  })

  /**
   * POST /reports/batch/export
   * 批量导出报告
   */
  router.post('/batch/export', async (req, res) => {
    try {
      const { reports, format = 'json' } = req.body

      if (!Array.isArray(reports)) {
        return res.status(400).json({
          success: false,
          error: 'reports必须是数组'
        })
      }

      const results = []
      for (const reportConfig of reports) {
        try {
          const report = await reportGenerator.generateReport(reportConfig.type, {
            timeRange: reportConfig.timeRange || '24h',
            filters: reportConfig.filters || {}
          })

          const exportResult = await reportGenerator.exportReport(report, format, {
            filename: reportConfig.filename
          })

          results.push({
            id: reportConfig.id,
            success: true,
            exportResult
          })
        } catch (error) {
          results.push({
            id: reportConfig.id,
            success: false,
            error: error.message
          })
        }
      }

      const successCount = results.filter(r => r.success).length

      res.json({
        success: true,
        data: results,
        message: `批量导出完成，成功: ${successCount}，失败: ${results.length - successCount}`
      })
    } catch (error) {
      console.error('批量导出报告失败:', error)
      res.status(500).json({
        success: false,
        error: '批量导出报告失败',
        message: error.message
      })
    }
  })

  return router
}

// 报告类型名称映射
function getReportTypeName (type) {
  const names = {
    'usage-summary': '使用情况汇总',
    'performance-analysis': '性能分析',
    'error-analysis': '错误分析',
    'cost-analysis': '成本分析',
    'user-behavior': '用户行为分析',
    'provider-comparison': '供应商对比',
    'trend-analysis': '趋势分析',
    'custom-dashboard': '自定义仪表板'
  }
  return names[type] || type
}

// 报告类型描述映射
function getReportTypeDescription (type) {
  const descriptions = {
    'usage-summary': 'API调用的总体统计信息，包括请求量、用户数、成本等',
    'performance-analysis': '系统性能指标分析，包括响应时间、吞吐量等',
    'error-analysis': '错误统计和分析，帮助识别系统问题',
    'cost-analysis': '成本使用情况分析和优化建议',
    'user-behavior': '用户使用行为分析和洞察',
    'provider-comparison': '不同AI供应商的对比分析',
    'trend-analysis': '时间序列趋势分析和预测',
    'custom-dashboard': '用户自定义的仪表板报告'
  }
  return descriptions[type] || '自定义报告类型'
}

// 报告类型参数映射
function getReportTypeParameters (type) {
  const baseParams = {
    timeRange: { type: 'string', default: '24h', description: '时间范围 (例如: 24h, 7d, 30d)' },
    filters: { type: 'object', default: {}, description: '过滤条件' },
    format: { type: 'string', default: 'json', description: '输出格式' }
  }

  const specificParams = {
    'custom-dashboard': {
      config: { type: 'object', required: true, description: '仪表板配置' }
    }
  }

  return { ...baseParams, ...(specificParams[type] || {}) }
}

module.exports = reportsRoutes
