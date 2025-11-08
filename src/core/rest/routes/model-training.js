const express = require('express');
const multer = require('multer');
const { ModelTrainingManager } = require('../../model-training-manager');

let modelTrainingManager = null;

/**
 * 模型训练API路由
 * 借鉴Hugging Face和OpenAI的设计理念，提供完整的模型微调生命周期管理
 */
function modelTrainingRoutes() {
  const router = express.Router();

  // 初始化模型训练管理器
  if (!modelTrainingManager) {
    modelTrainingManager = new ModelTrainingManager();
    modelTrainingManager.initialize().catch(console.error);
  }

  // 配置multer用于文件上传
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB限制
      files: 1,
    },
    fileFilter: (req, file, cb) => {
      // 只允许特定格式的文件
      const allowedMimes = ['application/json', 'text/plain', 'text/csv', 'application/x-ndjson'];

      if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.jsonl')) {
        cb(null, true);
      } else {
        cb(new Error('不支持的文件格式。只支持JSON、CSV、TXT和JSONL格式'));
      }
    },
  });

  // ==================== 数据集管理 ====================

  /**
   * GET /model-training/datasets
   * 获取数据集列表
   */
  router.get('/datasets', async (req, res) => {
    try {
      const { userId, limit = 50, offset = 0 } = req.query;

      let datasets = Array.from(modelTrainingManager.datasets.values());

      // 过滤用户数据集
      if (userId) {
        datasets = datasets.filter(dataset => dataset.userId === userId);
      }

      // 分页
      const total = datasets.length;
      datasets = datasets.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      // 格式化响应
      const formattedDatasets = datasets.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        format: dataset.format,
        size: dataset.size,
        recordCount: dataset.recordCount,
        validation: dataset.validation,
        userId: dataset.userId,
        createdAt: dataset.metadata.createdAt,
        updatedAt: dataset.metadata.updatedAt,
      }));

      res.json({
        success: true,
        data: formattedDatasets,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
      });
    } catch (error) {
      console.error('获取数据集列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取数据集列表失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /model-training/datasets
   * 上传数据集
   */
  router.post('/datasets', upload.single('file'), async (req, res) => {
    try {
      const { name, description, format = 'jsonl', userId } = req.body;
      const { file } = req;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: '缺少文件',
        });
      }

      if (!name) {
        return res.status(400).json({
          success: false,
          error: '数据集名称不能为空',
        });
      }

      // 创建文件流
      const fileStream = this.createReadStreamFromBuffer(file.buffer);

      const dataset = await modelTrainingManager.uploadDataset(
        {
          name,
          description,
          format,
          userId: userId || req.headers['x-user-id'] || 'anonymous',
        },
        fileStream
      );

      res.status(201).json({
        success: true,
        data: {
          id: dataset.id,
          name: dataset.name,
          format: dataset.format,
          size: dataset.size,
          recordCount: dataset.recordCount,
          validation: dataset.validation,
          createdAt: dataset.metadata.createdAt,
        },
        message: '数据集上传成功',
      });
    } catch (error) {
      console.error('上传数据集失败:', error);
      res.status(400).json({
        success: false,
        error: '上传数据集失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /model-training/datasets/:datasetId
   * 获取数据集详情
   */
  router.get('/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params;
      const dataset = modelTrainingManager.datasets.get(datasetId);

      if (!dataset) {
        return res.status(404).json({
          success: false,
          error: '数据集不存在',
        });
      }

      // 检查权限
      const userId = req.headers['x-user-id'];
      if (userId && dataset.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权访问此数据集',
        });
      }

      res.json({
        success: true,
        data: dataset,
      });
    } catch (error) {
      console.error('获取数据集详情失败:', error);
      res.status(500).json({
        success: false,
        error: '获取数据集详情失败',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /model-training/datasets/:datasetId
   * 删除数据集
   */
  router.delete('/datasets/:datasetId', async (req, res) => {
    try {
      const { datasetId } = req.params;
      const dataset = modelTrainingManager.datasets.get(datasetId);

      if (!dataset) {
        return res.status(404).json({
          success: false,
          error: '数据集不存在',
        });
      }

      // 检查权限
      const userId = req.headers['x-user-id'];
      if (userId && dataset.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权删除此数据集',
        });
      }

      // 检查是否有训练作业使用此数据集
      for (const [jobId, job] of modelTrainingManager.trainingJobs) {
        if (
          job.datasetId === datasetId &&
          ['queued', 'preparing', 'training'].includes(job.status)
        ) {
          return res.status(400).json({
            success: false,
            error: '数据集正在被训练作业使用，无法删除',
          });
        }
      }

      modelTrainingManager.datasets.delete(datasetId);
      await modelTrainingManager.saveConfigurations();

      // 删除实际文件
      try {
        await require('fs').promises.unlink(dataset.filePath);
      } catch (fileError) {
        console.warn(`删除数据集文件失败: ${fileError.message}`);
      }

      res.json({
        success: true,
        message: '数据集删除成功',
      });
    } catch (error) {
      console.error('删除数据集失败:', error);
      res.status(500).json({
        success: false,
        error: '删除数据集失败',
        message: error.message,
      });
    }
  });

  // ==================== 训练作业管理 ====================

  /**
   * GET /model-training/jobs
   * 获取训练作业列表
   */
  router.get('/jobs', async (req, res) => {
    try {
      const { userId, status, limit = 50, offset = 0 } = req.query;

      let jobs = Array.from(modelTrainingManager.trainingJobs.values());

      // 过滤条件
      if (userId) {
        jobs = jobs.filter(job => job.userId === userId);
      }

      if (status) {
        const statusList = status.split(',');
        jobs = jobs.filter(job => statusList.includes(job.status));
      }

      // 按创建时间倒序
      jobs.sort((a, b) => new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt));

      // 分页
      const total = jobs.length;
      jobs = jobs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

      // 格式化响应
      const formattedJobs = jobs.map(job => ({
        id: job.id,
        name: job.name,
        description: job.description,
        userId: job.userId,
        datasetId: job.datasetId,
        baseModel: job.baseModel,
        provider: job.provider,
        status: job.status,
        progress: job.progress,
        estimatedCost: job.monitoring.estimatedCost,
        actualCost: job.monitoring.actualCost,
        startTime: job.monitoring.startTime,
        endTime: job.monitoring.endTime,
        createdAt: job.metadata.createdAt,
        updatedAt: job.metadata.updatedAt,
      }));

      res.json({
        success: true,
        data: formattedJobs,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < total,
        },
      });
    } catch (error) {
      console.error('获取训练作业列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取训练作业列表失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /model-training/jobs
   * 创建训练作业
   */
  router.post('/jobs', async (req, res) => {
    try {
      const jobConfig = req.body;

      if (!jobConfig.name || !jobConfig.datasetId || !jobConfig.baseModel) {
        return res.status(400).json({
          success: false,
          error: '缺少必需参数',
          required: ['name', 'datasetId', 'baseModel'],
        });
      }

      // 设置用户ID
      jobConfig.userId = jobConfig.userId || req.headers['x-user-id'] || 'anonymous';

      // 验证数据集存在且属于用户
      const dataset = modelTrainingManager.datasets.get(jobConfig.datasetId);
      if (!dataset) {
        return res.status(400).json({
          success: false,
          error: '数据集不存在',
        });
      }

      if (dataset.userId !== jobConfig.userId) {
        return res.status(403).json({
          success: false,
          error: '无权使用此数据集',
        });
      }

      const job = await modelTrainingManager.createTrainingJob(jobConfig);

      res.status(201).json({
        success: true,
        data: {
          id: job.id,
          name: job.name,
          datasetId: job.datasetId,
          baseModel: job.baseModel,
          provider: job.provider,
          status: job.status,
          estimatedCost: job.monitoring.estimatedCost,
          createdAt: job.metadata.createdAt,
        },
        message: '训练作业创建成功',
      });
    } catch (error) {
      console.error('创建训练作业失败:', error);
      res.status(400).json({
        success: false,
        error: '创建训练作业失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /model-training/jobs/:jobId
   * 获取训练作业详情
   */
  router.get('/jobs/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = modelTrainingManager.trainingJobs.get(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: '训练作业不存在',
        });
      }

      // 检查权限
      const userId = req.headers['x-user-id'];
      if (userId && job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权访问此训练作业',
        });
      }

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      console.error('获取训练作业详情失败:', error);
      res.status(500).json({
        success: false,
        error: '获取训练作业详情失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /model-training/jobs/:jobId/start
   * 启动训练作业
   */
  router.post('/jobs/:jobId/start', async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.headers['x-user-id'];

      const job = modelTrainingManager.trainingJobs.get(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: '训练作业不存在',
        });
      }

      // 检查权限
      if (userId && job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权启动此训练作业',
        });
      }

      await modelTrainingManager.startTrainingJob(jobId);

      res.json({
        success: true,
        message: '训练作业启动成功',
      });
    } catch (error) {
      console.error('启动训练作业失败:', error);
      res.status(400).json({
        success: false,
        error: '启动训练作业失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /model-training/jobs/:jobId/stop
   * 停止训练作业
   */
  router.post('/jobs/:jobId/stop', async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.headers['x-user-id'];

      const job = modelTrainingManager.trainingJobs.get(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: '训练作业不存在',
        });
      }

      // 检查权限
      if (userId && job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权停止此训练作业',
        });
      }

      await modelTrainingManager.stopTrainingJob(jobId, 'manual');

      res.json({
        success: true,
        message: '训练作业停止成功',
      });
    } catch (error) {
      console.error('停止训练作业失败:', error);
      res.status(400).json({
        success: false,
        error: '停止训练作业失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /model-training/jobs/:jobId/status
   * 获取训练作业状态
   */
  router.get('/jobs/:jobId/status', async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.headers['x-user-id'];

      const status = modelTrainingManager.getTrainingJobStatus(jobId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: '训练作业不存在',
        });
      }

      // 检查权限
      const job = modelTrainingManager.trainingJobs.get(jobId);
      if (userId && job && job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权查看此训练作业状态',
        });
      }

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      console.error('获取训练作业状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取训练作业状态失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /model-training/jobs/:jobId/logs
   * 获取训练日志
   */
  router.get('/jobs/:jobId/logs', async (req, res) => {
    try {
      const { jobId } = req.params;
      const { limit = 100, offset = 0, level } = req.query;
      const userId = req.headers['x-user-id'];

      const logs = modelTrainingManager.getTrainingLogs(jobId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        level,
      });

      if (!logs) {
        return res.status(404).json({
          success: false,
          error: '训练作业不存在',
        });
      }

      // 检查权限
      const job = modelTrainingManager.trainingJobs.get(jobId);
      if (userId && job && job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权查看此训练作业日志',
        });
      }

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      console.error('获取训练日志失败:', error);
      res.status(500).json({
        success: false,
        error: '获取训练日志失败',
        message: error.message,
      });
    }
  });

  // ==================== 模型部署管理 ====================

  /**
   * GET /model-training/models
   * 获取用户模型列表
   */
  router.get('/models', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] || req.query.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: '缺少userId参数',
        });
      }

      const models = modelTrainingManager.getUserModels(userId);

      res.json({
        success: true,
        data: models,
      });
    } catch (error) {
      console.error('获取用户模型列表失败:', error);
      res.status(500).json({
        success: false,
        error: '获取用户模型列表失败',
        message: error.message,
      });
    }
  });

  /**
   * POST /model-training/jobs/:jobId/deploy
   * 部署训练完成的模型
   */
  router.post('/jobs/:jobId/deploy', async (req, res) => {
    try {
      const { jobId } = req.params;
      const deploymentConfig = req.body;
      const userId = req.headers['x-user-id'];

      const job = modelTrainingManager.trainingJobs.get(jobId);
      if (!job) {
        return res.status(404).json({
          success: false,
          error: '训练作业不存在',
        });
      }

      // 检查权限
      if (userId && job.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权部署此模型',
        });
      }

      const deployedModel = await modelTrainingManager.deployTrainedModel(jobId, deploymentConfig);

      res.status(201).json({
        success: true,
        data: {
          id: deployedModel.id,
          name: deployedModel.name,
          baseModel: deployedModel.baseModel,
          provider: deployedModel.provider,
          status: deployedModel.status,
          endpoint: deployedModel.config.endpoint,
          deployedAt: deployedModel.metrics.deployedAt,
        },
        message: '模型部署启动成功',
      });
    } catch (error) {
      console.error('部署模型失败:', error);
      res.status(400).json({
        success: false,
        error: '部署模型失败',
        message: error.message,
      });
    }
  });

  /**
   * DELETE /model-training/models/:modelId
   * 删除部署的模型
   */
  router.delete('/models/:modelId', async (req, res) => {
    try {
      const { modelId } = req.params;
      const userId = req.headers['x-user-id'];

      const model = modelTrainingManager.deployedModels.get(modelId);
      if (!model) {
        return res.status(404).json({
          success: false,
          error: '模型不存在',
        });
      }

      // 检查权限
      if (userId && model.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: '无权删除此模型',
        });
      }

      await modelTrainingManager.deleteDeployedModel(modelId);

      res.json({
        success: true,
        message: '模型删除成功',
      });
    } catch (error) {
      console.error('删除模型失败:', error);
      res.status(400).json({
        success: false,
        error: '删除模型失败',
        message: error.message,
      });
    }
  });

  // ==================== 系统信息 ====================

  /**
   * GET /model-training/providers
   * 获取支持的训练提供商
   */
  router.get('/providers', async (req, res) => {
    try {
      const providers = {};

      for (const [providerId, provider] of modelTrainingManager.providers) {
        providers[providerId] = {
          name: provider.name,
          supportedModels: provider.supportedModels,
          maxDatasetSize: provider.maxDatasetSize,
          supportedFormats: provider.supportedFormats,
          pricing: provider.pricing,
        };
      }

      res.json({
        success: true,
        data: providers,
      });
    } catch (error) {
      console.error('获取训练提供商失败:', error);
      res.status(500).json({
        success: false,
        error: '获取训练提供商失败',
        message: error.message,
      });
    }
  });

  /**
   * GET /model-training/stats
   * 获取训练系统统计信息
   */
  router.get('/stats', async (req, res) => {
    try {
      const jobs = Array.from(modelTrainingManager.trainingJobs.values());
      const datasets = Array.from(modelTrainingManager.datasets.values());
      const models = Array.from(modelTrainingManager.deployedModels.values());

      const stats = {
        totalJobs: jobs.length,
        runningJobs: jobs.filter(job => job.status === 'training').length,
        completedJobs: jobs.filter(job => job.status === 'completed').length,
        failedJobs: jobs.filter(job => job.status === 'failed').length,
        totalDatasets: datasets.length,
        totalDatasetSize: datasets.reduce((sum, ds) => sum + ds.size, 0),
        totalModels: models.length,
        activeModels: models.filter(model => model.status === 'deployed').length,
        providers: modelTrainingManager.providers.size,
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('获取训练统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取训练统计失败',
        message: error.message,
      });
    }
  });

  return router;
}

// 辅助函数：从buffer创建可读流
function createReadStreamFromBuffer(buffer) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

module.exports = modelTrainingRoutes;
