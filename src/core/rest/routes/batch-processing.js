const express = require("express");
const { BatchProcessingManager } = require("../../batch-processing-manager");

let batchProcessingManager = null;

/**
 * 批量处理API路由
 * 借鉴AWS Batch API和Google Cloud Batch的设计理念
 * 提供完整的批量AI请求处理和监控接口
 */
function batchProcessingRoutes() {
  const router = express.Router();

  // 初始化批量处理管理器
  if (!batchProcessingManager) {
    batchProcessingManager = new BatchProcessingManager();
    batchProcessingManager.initialize().catch(console.error);
  }

  // ==================== 批量任务管理 ====================

  /**
   * POST /batch-processing/batches
   * 提交批量处理任务
   */
  router.post("/batches", async (req, res) => {
    try {
      const batchRequest = req.body;

      if (!batchRequest.requests || !Array.isArray(batchRequest.requests)) {
        return res.status(400).json({
          success: false,
          error: "缺少请求列表",
          required: ["requests"],
        });
      }

      // 设置默认值
      batchRequest.userId =
        batchRequest.userId || req.headers["x-user-id"] || "anonymous";
      batchRequest.source = batchRequest.source || "api";

      const batch = await batchProcessingManager.submitBatch(batchRequest, {
        userId: req.headers["x-user-id"],
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({
        success: true,
        data: {
          id: batch.id,
          name: batch.name,
          status: batch.status,
          totalRequests: batch.totalRequests,
          priority: batch.config.priority,
          estimatedCompletionTime: new Date(
            Date.now() + batch.totalRequests * 2000,
          ).toISOString(), // 粗略估算
          createdAt: batch.monitoring.createdAt,
        },
        message: "批量任务已提交",
      });
    } catch (error) {
      console.error("提交批量任务失败:", error);
      res.status(400).json({
        success: false,
        error: "提交批量任务失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /batch-processing/batches
   * 获取批量任务列表
   */
  router.get("/batches", async (req, res) => {
    try {
      const { userId, status, priority, limit = 20, offset = 0 } = req.query;

      const effectiveUserId = userId || req.headers["x-user-id"];
      if (!effectiveUserId) {
        return res.status(400).json({
          success: false,
          error: "缺少用户ID",
        });
      }

      const result = batchProcessingManager.getUserBatches(effectiveUserId, {
        status: status?.split(","),
        priority,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });

      res.json({
        success: true,
        data: result.batches,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("获取批量任务列表失败:", error);
      res.status(500).json({
        success: false,
        error: "获取批量任务列表失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /batch-processing/batches/:batchId
   * 获取批量任务详情
   */
  router.get("/batches/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const userId = req.headers["x-user-id"];

      const batch = batchProcessingManager.getBatchStatus(batchId);

      if (!batch) {
        return res.status(404).json({
          success: false,
          error: "批量任务不存在",
        });
      }

      // 检查权限
      if (userId && batch.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "无权访问此批量任务",
        });
      }

      res.json({
        success: true,
        data: batch,
      });
    } catch (error) {
      console.error("获取批量任务详情失败:", error);
      res.status(500).json({
        success: false,
        error: "获取批量任务详情失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /batch-processing/batches/:batchId/status
   * 获取批量任务状态（简要信息）
   */
  router.get("/batches/:batchId/status", async (req, res) => {
    try {
      const { batchId } = req.params;
      const userId = req.headers["x-user-id"];

      const batch = batchProcessingManager.getBatchStatus(batchId);

      if (!batch) {
        return res.status(404).json({
          success: false,
          error: "批量任务不存在",
        });
      }

      // 检查权限
      if (userId && batch.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "无权访问此批量任务",
        });
      }

      res.json({
        success: true,
        data: {
          id: batch.id,
          name: batch.name,
          status: batch.status,
          progress: batch.progress,
          createdAt: batch.monitoring.createdAt,
          startedAt: batch.monitoring.startedAt,
          completedAt: batch.monitoring.completedAt,
          duration: batch.monitoring.duration,
          avgResponseTime: batch.monitoring.avgResponseTime,
        },
      });
    } catch (error) {
      console.error("获取批量任务状态失败:", error);
      res.status(500).json({
        success: false,
        error: "获取批量任务状态失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /batch-processing/batches/:batchId/results
   * 获取批量任务结果
   */
  router.get("/batches/:batchId/results", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { limit = 50, offset = 0, includeErrors = true } = req.query;
      const userId = req.headers["x-user-id"];

      const batch = batchProcessingManager.getBatchStatus(batchId);

      if (!batch) {
        return res.status(404).json({
          success: false,
          error: "批量任务不存在",
        });
      }

      // 检查权限
      if (userId && batch.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "无权访问此批量任务",
        });
      }

      const results = batchProcessingManager.getBatchResults(batchId, {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        includeErrors: includeErrors === "true",
      });

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error("获取批量任务结果失败:", error);
      res.status(500).json({
        success: false,
        error: "获取批量任务结果失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /batch-processing/batches/:batchId/cancel
   * 取消批量任务
   */
  router.post("/batches/:batchId/cancel", async (req, res) => {
    try {
      const { batchId } = req.params;
      const { reason = "user_cancelled" } = req.body;
      const userId = req.headers["x-user-id"];

      const batch = batchProcessingManager.getBatchStatus(batchId);

      if (!batch) {
        return res.status(404).json({
          success: false,
          error: "批量任务不存在",
        });
      }

      // 检查权限
      if (userId && batch.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "无权取消此批量任务",
        });
      }

      await batchProcessingManager.cancelBatch(batchId, reason);

      res.json({
        success: true,
        message: "批量任务已取消",
      });
    } catch (error) {
      console.error("取消批量任务失败:", error);
      res.status(400).json({
        success: false,
        error: "取消批量任务失败",
        message: error.message,
      });
    }
  });

  /**
   * DELETE /batch-processing/batches/:batchId
   * 删除批量任务（仅限已完成的任务）
   */
  router.delete("/batches/:batchId", async (req, res) => {
    try {
      const { batchId } = req.params;
      const userId = req.headers["x-user-id"];

      const batch = batchProcessingManager.getBatchStatus(batchId);

      if (!batch) {
        return res.status(404).json({
          success: false,
          error: "批量任务不存在",
        });
      }

      // 检查权限
      if (userId && batch.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: "无权删除此批量任务",
        });
      }

      // 只允许删除已完成或失败的任务
      if (!["completed", "failed", "cancelled"].includes(batch.status)) {
        return res.status(400).json({
          success: false,
          error: "只能删除已完成、失败或取消的任务",
        });
      }

      batchProcessingManager.completedBatches.delete(batchId);
      await batchProcessingManager.saveConfiguration();

      res.json({
        success: true,
        message: "批量任务已删除",
      });
    } catch (error) {
      console.error("删除批量任务失败:", error);
      res.status(500).json({
        success: false,
        error: "删除批量任务失败",
        message: error.message,
      });
    }
  });

  // ==================== 队列管理 ====================

  /**
   * GET /batch-processing/queue
   * 获取队列状态
   */
  router.get("/queue", async (_req, res) => {
    try {
      const stats = batchProcessingManager.getPerformanceStatistics();

      res.json({
        success: true,
        data: {
          activeWorkers: stats.activeWorkers,
          queueLengths: stats.queueLengths,
          activeBatches: stats.activeBatches,
          cacheSize: stats.cacheSize,
          maxConcurrency: batchProcessingManager.maxConcurrency,
        },
      });
    } catch (error) {
      console.error("获取队列状态失败:", error);
      res.status(500).json({
        success: false,
        error: "获取队列状态失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /batch-processing/queue/priority
   * 获取优先级队列内容（管理员功能）
   */
  router.get("/queue/priority", async (req, res) => {
    try {
      // 这里应该添加管理员权限检查
      const isAdmin = req.headers["x-admin"] === "true";

      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: "需要管理员权限",
        });
      }

      const queues = {
        priority: batchProcessingManager.scheduler.priorityQueue.map(
          (batch) => ({
            id: batch.id,
            name: batch.name,
            userId: batch.userId,
            totalRequests: batch.totalRequests,
            createdAt: batch.monitoring.createdAt,
          }),
        ),
        normal: batchProcessingManager.scheduler.normalQueue
          .slice(0, 10)
          .map((batch) => ({
            id: batch.id,
            name: batch.name,
            userId: batch.userId,
            totalRequests: batch.totalRequests,
            createdAt: batch.monitoring.createdAt,
          })),
        lowPriority: batchProcessingManager.scheduler.lowPriorityQueue
          .slice(0, 5)
          .map((batch) => ({
            id: batch.id,
            name: batch.name,
            userId: batch.userId,
            totalRequests: batch.totalRequests,
            createdAt: batch.monitoring.createdAt,
          })),
      };

      res.json({
        success: true,
        data: queues,
      });
    } catch (error) {
      console.error("获取优先级队列失败:", error);
      res.status(500).json({
        success: false,
        error: "获取优先级队列失败",
        message: error.message,
      });
    }
  });

  // ==================== 批量模板 ====================

  /**
   * GET /batch-processing/templates
   * 获取批量处理模板
   */
  router.get("/templates", async (_req, res) => {
    try {
      const templates = {
        text_classification: {
          name: "文本分类批量处理",
          description: "批量对文本进行分类分析",
          config: {
            requests: [
              {
                model: "gpt-3.5-turbo",
                messages: [
                  {
                    role: "system",
                    content: "你是一个文本分类专家，请分析文本的情感倾向。",
                  },
                  { role: "user", content: "{{text}}" },
                ],
                max_tokens: 100,
              },
            ],
          },
        },
        content_generation: {
          name: "内容生成批量处理",
          description: "批量生成相关内容",
          config: {
            requests: [
              {
                model: "gpt-4",
                messages: [
                  {
                    role: "user",
                    content: '根据主题 "{{topic}}" 生成一篇短文',
                  },
                ],
                max_tokens: 500,
              },
            ],
          },
        },
        data_analysis: {
          name: "数据分析批量处理",
          description: "批量进行数据分析和洞察",
          config: {
            requests: [
              {
                model: "gpt-4",
                messages: [
                  { role: "system", content: "你是一个数据分析专家。" },
                  { role: "user", content: "分析以下数据: {{data}}" },
                ],
                max_tokens: 300,
              },
            ],
          },
        },
        translation: {
          name: "翻译批量处理",
          description: "批量翻译文本内容",
          config: {
            requests: [
              {
                model: "gpt-3.5-turbo",
                messages: [
                  { role: "user", content: '将以下英文翻译成中文: "{{text}}"' },
                ],
                max_tokens: 200,
              },
            ],
          },
        },
      };

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      console.error("获取批量模板失败:", error);
      res.status(500).json({
        success: false,
        error: "获取批量模板失败",
        message: error.message,
      });
    }
  });

  // ==================== 统计和监控 ====================

  /**
   * GET /batch-processing/stats
   * 获取批量处理统计信息
   */
  router.get("/stats", async (_req, res) => {
    try {
      const stats = batchProcessingManager.getPerformanceStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("获取批量处理统计失败:", error);
      res.status(500).json({
        success: false,
        error: "获取批量处理统计失败",
        message: error.message,
      });
    }
  });

  /**
   * GET /batch-processing/cache
   * 获取缓存状态
   */
  router.get("/cache", async (_req, res) => {
    try {
      const stats = batchProcessingManager.getPerformanceStatistics();

      res.json({
        success: true,
        data: {
          cacheSize: stats.cacheSize,
          cacheTTL: batchProcessingManager.cacheTTL,
          estimatedMemoryUsage: stats.cacheSize * 2048, // 粗略估算每条缓存2KB
        },
      });
    } catch (error) {
      console.error("获取缓存状态失败:", error);
      res.status(500).json({
        success: false,
        error: "获取缓存状态失败",
        message: error.message,
      });
    }
  });

  /**
   * POST /batch-processing/cache/clear
   * 清除批量处理缓存
   */
  router.post("/cache/clear", async (_req, res) => {
    try {
      const result = batchProcessingManager.clearTranslationCache();

      res.json({
        success: true,
        data: result,
        message: "批量处理缓存已清理",
      });
    } catch (error) {
      console.error("清理批量处理缓存失败:", error);
      res.status(500).json({
        success: false,
        error: "清理批量处理缓存失败",
        message: error.message,
      });
    }
  });

  // ==================== 健康检查 ====================

  /**
   * GET /batch-processing/health
   * 批量处理服务健康检查
   */
  router.get("/health", async (_req, res) => {
    try {
      const stats = batchProcessingManager.getPerformanceStatistics();

      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        components: {
          batchProcessingManager: !!batchProcessingManager,
          scheduler: !!batchProcessingManager?.scheduler,
        },
        stats: {
          activeWorkers: stats.activeWorkers,
          activeBatches: stats.activeBatches,
          queueLengths: stats.queueLengths,
          cacheSize: stats.cacheSize,
          maxConcurrency: batchProcessingManager.maxConcurrency,
        },
      };

      // 检查组件状态
      if (!batchProcessingManager || !batchProcessingManager.scheduler) {
        health.status = "unhealthy";
      }

      // 检查队列积压
      const totalQueued =
        stats.queueLengths.priority +
        stats.queueLengths.normal +
        stats.queueLengths.lowPriority;
      if (totalQueued > 100) {
        health.status = "degraded";
        health.warnings = ["队列积压严重"];
      }

      const statusCode =
        health.status === "healthy"
          ? 200
          : health.status === "degraded"
            ? 200
            : 503;

      res.status(statusCode).json({
        success: true,
        data: health,
      });
    } catch (error) {
      console.error("健康检查失败:", error);
      res.status(503).json({
        success: false,
        error: "健康检查失败",
        message: error.message,
      });
    }
  });

  return router;
}

module.exports = batchProcessingRoutes;
