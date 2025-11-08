/**
 * Sira AI网关 - 图像生成 REST API路由
 * 提供完整的图像生成功能接口
 */

const express = require('express');
const {
  imageGeneratorManager,
  IMAGE_STYLES,
  IMAGE_PROVIDERS,
} = require('../../image-generator-manager');

const router = express.Router();

// 中间件：异步错误处理
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 中间件：验证任务ID
const validateJobId = (req, res, next) => {
  const { jobId } = req.params;
  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: '缺少任务ID',
    });
  }

  const job = imageGeneratorManager.getJobStatus(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: '任务不存在',
    });
  }

  req.job = job;
  next();
};

// ==================== 图像生成 ====================

/**
 * 生成图像
 * POST /images/generate
 */
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const {
      userId = 'anonymous',
      provider = 'openai_dalle',
      model = 'dall-e-3',
      prompt,
      negativePrompt = '',
      size = '1024x1024',
      quality = 'standard',
      style = 'natural',
      count = 1,
      format = 'png',
    } = req.body;

    // 验证必需参数
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: prompt',
      });
    }

    if (prompt.length > 1000) {
      return res.status(400).json({
        success: false,
        error: '提示词长度不能超过1000字符',
      });
    }

    if (count < 1 || count > 4) {
      return res.status(400).json({
        success: false,
        error: '生成数量必须在1-4之间',
      });
    }

    try {
      const jobId = await imageGeneratorManager.generateImage({
        userId,
        provider,
        model,
        prompt,
        negativePrompt,
        size,
        quality,
        style,
        count,
        format,
      });

      res.json({
        success: true,
        data: {
          jobId,
          message: '图像生成任务已创建',
          estimatedWaitTime: '30-60秒',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * 生成图像变体
 * POST /images/variation/:jobId
 */
router.post(
  '/variation/:jobId',
  validateJobId,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { job } = req;

    // 检查原任务是否完成
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: '原任务未完成，无法生成变体',
      });
    }

    const { userId = job.userId, count = 1, style = job.style } = req.body;

    try {
      const variationJobId = await imageGeneratorManager.generateVariation(jobId, {
        userId,
        count,
        style,
      });

      res.json({
        success: true,
        data: {
          jobId: variationJobId,
          message: '图像变体生成任务已创建',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * 编辑图像
 * POST /images/edit/:jobId
 */
router.post(
  '/edit/:jobId',
  validateJobId,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { job } = req;

    // 检查原任务是否完成
    if (job.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: '原任务未完成，无法编辑图像',
      });
    }

    const { mask, editPrompt, userId = job.userId } = req.body;

    if (!mask) {
      return res.status(400).json({
        success: false,
        error: '编辑图像需要提供mask参数',
      });
    }

    try {
      const editJobId = await imageGeneratorManager.editImage(jobId, {
        userId,
        mask,
        editPrompt,
      });

      res.json({
        success: true,
        data: {
          jobId: editJobId,
          message: '图像编辑任务已创建',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

// ==================== 任务管理 ====================

/**
 * 获取任务状态
 * GET /images/job/:jobId
 */
router.get('/job/:jobId', validateJobId, (req, res) => {
  const { job } = req;

  res.json({
    success: true,
    data: {
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        provider: job.provider,
        model: job.model,
        prompt: job.prompt,
        style: job.style,
        count: job.count,
        format: job.format,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        result: job.result,
        error: job.error,
        metadata: job.metadata,
      },
    },
  });
});

/**
 * 获取用户任务历史
 * GET /images/history/:userId
 */
router.get(
  '/history/:userId',
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    try {
      const jobs = imageGeneratorManager.getUserJobs(userId, parseInt(limit));

      res.json({
        success: true,
        data: {
          jobs: jobs.slice(parseInt(offset)),
          total: jobs.length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

/**
 * 取消任务
 * DELETE /images/job/:jobId
 */
router.delete('/job/:jobId', validateJobId, (req, res) => {
  const { job } = req;

  // 检查任务是否可以取消
  if (['completed', 'failed'].includes(job.status)) {
    return res.status(400).json({
      success: false,
      error: '已完成或失败的任务无法取消',
    });
  }

  // 这里应该实现实际的取消逻辑
  // 暂时只返回成功响应

  res.json({
    success: true,
    message: '任务取消请求已提交',
  });
});

// ==================== 系统信息 ====================

/**
 * 获取队列统计
 * GET /images/stats
 */
router.get('/stats', (req, res) => {
  const stats = imageGeneratorManager.getQueueStats();

  res.json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * 获取支持的提供商
 * GET /images/providers
 */
router.get('/providers', (req, res) => {
  const providers = imageGeneratorManager.getProviders();

  res.json({
    success: true,
    data: {
      providers,
    },
  });
});

/**
 * 获取支持的风格
 * GET /images/styles
 */
router.get('/styles', (req, res) => {
  const styles = imageGeneratorManager.getStyles();

  res.json({
    success: true,
    data: {
      styles,
    },
  });
});

/**
 * 获取提供商模型信息
 * GET /images/models/:provider
 */
router.get('/models/:provider', (req, res) => {
  const { provider } = req.params;

  const providerConfig = IMAGE_PROVIDERS[provider];
  if (!providerConfig) {
    return res.status(404).json({
      success: false,
      error: '提供商不存在',
    });
  }

  res.json({
    success: true,
    data: {
      provider,
      name: providerConfig.name,
      models: providerConfig.models,
      maxSize: providerConfig.maxSize,
      supportsEdit: providerConfig.supportsEdit,
      supportsVariation: providerConfig.supportsVariation,
      asyncProcessing: providerConfig.asyncProcessing || false,
    },
  });
});

// ==================== 批量操作 ====================

/**
 * 批量生成图像
 * POST /images/batch
 */
router.post(
  '/batch',
  asyncHandler(async (req, res) => {
    const { userId = 'anonymous', requests = [] } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: '批量请求必须是非空数组',
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        success: false,
        error: '批量请求数量不能超过10个',
      });
    }

    try {
      const jobIds = [];

      for (const request of requests) {
        const jobId = await imageGeneratorManager.generateImage({
          userId,
          ...request,
        });
        jobIds.push(jobId);
      }

      res.json({
        success: true,
        data: {
          jobIds,
          message: `已创建 ${jobIds.length} 个图像生成任务`,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

// ==================== 预设模板 ====================

/**
 * 获取图像生成模板
 * GET /images/templates
 */
router.get('/templates', (req, res) => {
  const templates = [
    {
      id: 'portrait',
      name: '人物肖像',
      description: '生成人物肖像照片',
      prompt:
        'A professional portrait photo of a person, high quality, detailed face, natural lighting',
      category: '人物',
    },
    {
      id: 'landscape',
      name: '风景画',
      description: '生成自然风景图像',
      prompt: 'A beautiful landscape with mountains and lake, scenic view, high quality, detailed',
      category: '风景',
    },
    {
      id: 'concept_art',
      name: '概念艺术',
      description: '生成奇幻概念艺术',
      prompt: 'Concept art of a mystical fantasy scene, detailed illustration, magical atmosphere',
      category: '艺术',
    },
    {
      id: 'product',
      name: '产品展示',
      description: '生成产品展示图像',
      prompt: 'Professional product photography, clean background, high quality, commercial style',
      category: '商业',
    },
    {
      id: 'anime',
      name: '动漫风格',
      description: '生成动漫风格图像',
      prompt:
        'Anime style illustration, vibrant colors, detailed character design, Japanese animation',
      category: '动漫',
    },
  ];

  res.json({
    success: true,
    data: {
      templates,
    },
  });
});

/**
 * 使用模板生成图像
 * POST /images/generate-from-template
 */
router.post(
  '/generate-from-template',
  asyncHandler(async (req, res) => {
    const { templateId, userId = 'anonymous', customizations = {} } = req.body;

    // 获取模板
    const templates = await new Promise(resolve => {
      router.get('/templates', (req, res) => {
        const templates = [
          {
            id: 'portrait',
            name: '人物肖像',
            prompt:
              'A professional portrait photo of a person, high quality, detailed face, natural lighting',
          },
          {
            id: 'landscape',
            name: '风景画',
            prompt:
              'A beautiful landscape with mountains and lake, scenic view, high quality, detailed',
          },
        ];
        resolve(templates);
      });
    });

    const template = templates.find(t => t.id === templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在',
      });
    }

    // 应用自定义设置
    const generationOptions = {
      userId,
      prompt: customizations.prompt || template.prompt,
      provider: customizations.provider,
      model: customizations.model,
      style: customizations.style,
      size: customizations.size,
      count: customizations.count,
    };

    try {
      const jobId = await imageGeneratorManager.generateImage(generationOptions);

      res.json({
        success: true,
        data: {
          jobId,
          template: template.name,
          message: '使用模板的图像生成任务已创建',
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  })
);

// ==================== 健康检查 ====================

/**
 * 健康检查
 * GET /images/health
 */
router.get('/health', (req, res) => {
  const stats = imageGeneratorManager.getQueueStats();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      queueStats: stats,
      version: '1.0',
    },
  });
});

module.exports = router;
