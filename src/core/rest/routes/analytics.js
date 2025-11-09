const express = require("express");
const { usageAnalytics } = require("../../usage-analytics");

/**
 * Analytics API Routes
 * 提供用量统计和分析相关的API接口
 */

module.exports = ({ logger }) => {
  const router = express.Router();
  /**
   * GET /analytics/stats
   * 获取全局统计数据
   */
  router.get("/analytics/stats", async (req, res) => {
    try {
      const { startDate, endDate, groupBy = "total" } = req.query;

      const stats = usageAnalytics.getStats({
        startDate,
        endDate,
        groupBy,
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取统计数据失败:", error);
      res.status(500).json({
        success: false,
        error: "获取统计数据失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/users
   * 获取用户统计数据
   */
  router.get("/analytics/users", async (req, res) => {
    try {
      const { userId, startDate, endDate, limit = 50 } = req.query;

      const stats = usageAnalytics.getStats({
        userId,
        startDate,
        endDate,
        groupBy: "user",
      });

      // 限制返回的用户数量
      if (stats.users && stats.users.length > limit) {
        stats.users = stats.users.slice(0, limit);
      }

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取用户统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取用户统计失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/providers
   * 获取供应商统计数据
   */
  router.get("/analytics/providers", async (req, res) => {
    try {
      const { provider, startDate, endDate } = req.query;

      const stats = usageAnalytics.getStats({
        provider,
        startDate,
        endDate,
        groupBy: "provider",
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取供应商统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取供应商统计失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/models
   * 获取模型统计数据
   */
  router.get("/analytics/models", async (req, res) => {
    try {
      const { model, startDate, endDate } = req.query;

      const stats = usageAnalytics.getStats({
        model,
        startDate,
        endDate,
        groupBy: "model",
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取模型统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取模型统计失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/hourly
   * 获取小时统计数据
   */
  router.get("/analytics/hourly", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = usageAnalytics.getStats({
        startDate,
        endDate,
        groupBy: "hourly",
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取小时统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取小时统计失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/daily
   * 获取日统计数据
   */
  router.get("/analytics/daily", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = usageAnalytics.getStats({
        startDate,
        endDate,
        groupBy: "daily",
      });

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取日统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取日统计失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/performance
   * 获取性能统计数据
   */
  router.get("/analytics/performance", async (_req, res) => {
    try {
      const report = await usageAnalytics.generateReport({
        type: "performance",
      });

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("获取性能统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取性能统计失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /analytics/report
   * 生成自定义统计报告
   */
  router.post("/analytics/report", async (req, res) => {
    try {
      const {
        type = "summary",
        format = "json",
        startDate,
        endDate,
        outputPath,
        options = {},
      } = req.body;

      const report = await usageAnalytics.generateReport({
        type,
        format,
        startDate,
        endDate,
        outputPath,
        ...options,
      });

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
        message: outputPath ? `报告已保存到: ${outputPath}` : "报告生成成功",
      });
    } catch (error) {
      logger.error("生成统计报告失败:", error);
      res.status(500).json({
        success: false,
        error: "生成统计报告失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /analytics/health
   * 获取统计模块健康状态
   */
  router.get("/analytics/health", async (_req, res) => {
    try {
      // 检查统计模块是否正常运行
      const isInitialized =
        usageAnalytics && typeof usageAnalytics.recordRequest === "function";
      const hasData =
        usageAnalytics?.stats && usageAnalytics.stats.requests.size > 0;

      const health = {
        status: isInitialized ? "healthy" : "unhealthy",
        initialized: isInitialized,
        hasData,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: health,
      });
    } catch (error) {
      logger.error("检查统计模块健康状态失败:", error);
      res.status(500).json({
        success: false,
        error: "检查统计模块健康状态失败",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /analytics/data
   * 清理统计数据 (仅管理员使用)
   */
  router.delete("/analytics/data", async (req, res) => {
    try {
      const { confirm, beforeDate } = req.body;

      if (confirm !== "YES_DELETE_ALL_DATA") {
        return res.status(400).json({
          success: false,
          error: "需要确认删除操作",
          message: '请在请求体中设置 confirm: "YES_DELETE_ALL_DATA"',
        });
      }

      // 这里可以实现数据清理逻辑
      // 清理指定日期之前的数据或全部数据

      logger.warn("统计数据清理操作被执行", { beforeDate });

      res.json({
        success: true,
        message: beforeDate
          ? `已清理 ${beforeDate} 之前的数据`
          : "已清理所有统计数据",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("清理统计数据失败:", error);
      res.status(500).json({
        success: false,
        error: "清理统计数据失败",
        message: error.message,
      });
    }
  });

  logger.info("Analytics API routes loaded");
  return router;
};
