/**
 * Sira AI网关 - 图像生成管理器
 * 统一管理多种图像生成AI模型的接口
 *
 * 支持的模型:
 * - DALL-E (OpenAI)
 * - Midjourney
 * - Stable Diffusion
 * - Firefly (Adobe)
 * - Kandinsky
 * - Craiyon
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

// 图像生成配置
const IMAGE_CONFIG = {
  maxConcurrentJobs: 10,
  maxQueueSize: 100,
  defaultProvider: 'openai_dalle',
  defaultModel: 'dall-e-3',
  maxPromptLength: 1000,
  supportedFormats: ['png', 'jpg', 'webp'],
  maxImageSize: '1024x1024',
  defaultQuality: 'standard'
};

// 支持的图像生成提供商配置
const IMAGE_PROVIDERS = {
  openai_dalle: {
    name: 'OpenAI DALL-E',
    baseUrl: 'https://api.openai.com/v1/images/generations',
    models: ['dall-e-2', 'dall-e-3'],
    maxSize: '1024x1024',
    supportsEdit: true,
    supportsVariation: true
  },
  midjourney: {
    name: 'Midjourney',
    baseUrl: 'https://api.midjourney.com/v1/imagine',
    models: ['midjourney-v5', 'midjourney-v6'],
    maxSize: '1024x1024',
    supportsEdit: false,
    supportsVariation: true,
    asyncProcessing: true
  },
  stability_ai: {
    name: 'Stability AI',
    baseUrl: 'https://api.stability.ai/v1/generation',
    models: ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-v1-6'],
    maxSize: '1024x1024',
    supportsEdit: true,
    supportsVariation: true
  },
  replicate: {
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1/predictions',
    models: [
      'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
      'cjwbw/anything-v3-better-vae:09a5805203f4c12da649ec1923bb7729517ca25fcac790e640eaa9ed66573b65'
    ],
    maxSize: '1024x1024',
    supportsEdit: false,
    supportsVariation: false
  },
  adobe_firefly: {
    name: 'Adobe Firefly',
    baseUrl: 'https://firefly-api.adobe.io/v2/images/generate',
    models: ['firefly-v1', 'firefly-v2'],
    maxSize: '1024x1024',
    supportsEdit: true,
    supportsVariation: true
  }
};

// 图像生成任务类
class ImageGenerationJob {
  constructor(options = {}) {
    this.id = crypto.randomUUID();
    this.userId = options.userId || 'anonymous';
    this.provider = options.provider || IMAGE_CONFIG.defaultProvider;
    this.model = options.model || IMAGE_CONFIG.defaultModel;
    this.prompt = options.prompt || '';
    this.negativePrompt = options.negativePrompt || '';
    this.size = options.size || IMAGE_CONFIG.maxImageSize;
    this.quality = options.quality || IMAGE_CONFIG.defaultQuality;
    this.style = options.style || 'natural';
    this.count = Math.min(options.count || 1, 4); // 最多4张
    this.format = options.format || 'png';

    // 任务状态
    this.status = 'queued'; // queued, processing, completed, failed
    this.progress = 0;
    this.createdAt = new Date();
    this.startedAt = null;
    this.completedAt = null;
    this.result = null;
    this.error = null;

    // 元数据
    this.metadata = {
      estimatedCost: 0,
      actualCost: 0,
      processingTime: 0,
      retryCount: 0
    };
  }

  // 更新进度
  updateProgress(progress, status = null) {
    this.progress = Math.max(0, Math.min(100, progress));
    if (status) {
      this.status = status;
    }

    if (status === 'processing' && !this.startedAt) {
      this.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      this.completedAt = new Date();
      if (this.startedAt) {
        this.metadata.processingTime = this.completedAt - this.startedAt;
      }
    }
  }

  // 设置结果
  setResult(images, cost = 0) {
    this.result = {
      images: images,
      generatedAt: new Date(),
      count: images.length
    };
    this.metadata.actualCost = cost;
    this.updateProgress(100, 'completed');
  }

  // 设置错误
  setError(error) {
    this.error = {
      message: error.message || 'Unknown error',
      code: error.code || 'GENERATION_FAILED',
      timestamp: new Date()
    };
    this.updateProgress(0, 'failed');
  }

  // 重试
  retry() {
    this.metadata.retryCount++;
    this.status = 'queued';
    this.progress = 0;
    this.error = null;
    this.result = null;
    this.startedAt = null;
    this.completedAt = null;
  }
}

// 图像生成队列类
class ImageGenerationQueue {
  constructor(maxConcurrent = IMAGE_CONFIG.maxConcurrentJobs) {
    this.queue = [];
    this.processing = new Set();
    this.maxConcurrent = maxConcurrent;
    this.completed = new Map();
  }

  // 添加任务到队列
  enqueue(job) {
    if (this.queue.length >= IMAGE_CONFIG.maxQueueSize) {
      throw new Error('Queue is full');
    }
    this.queue.push(job);
    return job.id;
  }

  // 获取下一个待处理任务
  dequeue() {
    if (this.processing.size >= this.maxConcurrent) {
      return null;
    }

    const job = this.queue.find(job => job.status === 'queued');
    if (job) {
      job.updateProgress(0, 'processing');
      this.processing.add(job.id);
    }
    return job;
  }

  // 完成任务
  complete(jobId, result = null, cost = 0) {
    const job = this.getJob(jobId);
    if (job) {
      if (result) {
        job.setResult(result, cost);
      }
      this.processing.delete(jobId);
      this.completed.set(jobId, job);
    }
  }

  // 任务失败
  fail(jobId, error) {
    const job = this.getJob(jobId);
    if (job) {
      job.setError(error);
      this.processing.delete(jobId);
      // 如果重试次数未达到上限，可以重新入队
      if (job.metadata.retryCount < 3) {
        job.retry();
        // 重新入队
        setTimeout(() => {
          this.queue.unshift(job);
        }, 1000 * (job.metadata.retryCount + 1)); // 递增延迟
      } else {
        this.completed.set(jobId, job);
      }
    }
  }

  // 获取任务
  getJob(jobId) {
    return this.queue.find(job => job.id === jobId) ||
           Array.from(this.processing).find(job => job.id === jobId) ||
           this.completed.get(jobId);
  }

  // 获取队列状态
  getStats() {
    return {
      queued: this.queue.filter(job => job.status === 'queued').length,
      processing: this.processing.size,
      completed: this.completed.size,
      total: this.queue.length + this.processing.size + this.completed.size
    };
  }
}

// 图像风格预设
const IMAGE_STYLES = {
  natural: {
    name: '自然风格',
    description: '自然的、写实的图像',
    promptPrefix: '',
    negativePrompt: 'cartoon, anime, illustration'
  },
  artistic: {
    name: '艺术风格',
    description: '艺术化的、富有创意的图像',
    promptPrefix: 'in the style of a masterpiece painting, artistic, creative',
    negativePrompt: 'photorealistic, realistic'
  },
  cartoon: {
    name: '卡通风格',
    description: '卡通动漫风格的图像',
    promptPrefix: 'cartoon style, animated, vibrant colors',
    negativePrompt: 'realistic, photorealistic'
  },
  minimalist: {
    name: '极简风格',
    description: '简洁、现代的极简设计',
    promptPrefix: 'minimalist, clean design, simple, modern',
    negativePrompt: 'complex, detailed, busy'
  },
  cyberpunk: {
    name: '赛博朋克',
    description: '未来科技、霓虹灯风格',
    promptPrefix: 'cyberpunk, futuristic, neon lights, high tech',
    negativePrompt: 'natural, rustic, medieval'
  },
  fantasy: {
    name: '奇幻风格',
    description: '魔法、幻想世界的图像',
    promptPrefix: 'fantasy, magical, mystical, enchanted',
    negativePrompt: 'modern, realistic, contemporary'
  }
};

// 主要图像生成管理器类
class ImageGeneratorManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.queue = new ImageGenerationQueue();
    this.jobs = new Map();
    this.providers = new Map(Object.entries(IMAGE_PROVIDERS));
    this.config = { ...IMAGE_CONFIG, ...options };

    // 启动队列处理器
    this.startQueueProcessor();

    log_info('图像生成管理器初始化完成');
  }

  // 生成图像
  async generateImage(options = {}) {
    const {
      userId,
      provider = this.config.defaultProvider,
      model = this.config.defaultModel,
      prompt,
      negativePrompt = '',
      size = this.config.maxImageSize,
      quality = this.config.defaultQuality,
      style = 'natural',
      count = 1,
      format = 'png'
    } = options;

    // 验证输入
    if (!prompt || prompt.length > this.config.maxPromptLength) {
      throw new Error(`Prompt is required and must be less than ${this.config.maxPromptLength} characters`);
    }

    if (!this.providers.has(provider)) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const providerConfig = this.providers.get(provider);
    if (!providerConfig.models.includes(model)) {
      throw new Error(`Model ${model} not supported by provider ${provider}`);
    }

    // 创建任务
    const job = new ImageGenerationJob({
      userId,
      provider,
      model,
      prompt: this.enhancePrompt(prompt, style),
      negativePrompt: negativePrompt + (IMAGE_STYLES[style]?.negativePrompt || ''),
      size,
      quality,
      style,
      count,
      format
    });

    // 估算成本
    job.metadata.estimatedCost = this.estimateCost(provider, model, count);

    // 添加到队列
    this.queue.enqueue(job);
    this.jobs.set(job.id, job);

    this.emit('jobCreated', job);

    log_info(`创建图像生成任务: ${job.id} - ${provider}/${model}`);

    return job.id;
  }

  // 生成图像变体
  async generateVariation(jobId, options = {}) {
    const originalJob = this.jobs.get(jobId);
    if (!originalJob || !originalJob.result) {
      throw new Error('Original job not found or has no result');
    }

    const provider = originalJob.provider;
    const providerConfig = this.providers.get(provider);

    if (!providerConfig.supportsVariation) {
      throw new Error(`Provider ${provider} does not support variations`);
    }

    // 从原图生成变体
    const variationOptions = {
      ...options,
      userId: originalJob.userId,
      provider,
      model: originalJob.model,
      prompt: originalJob.prompt,
      referenceImage: originalJob.result.images[0], // 使用第一张图作为参考
      variation: true
    };

    return this.generateImage(variationOptions);
  }

  // 编辑图像
  async editImage(jobId, options = {}) {
    const originalJob = this.jobs.get(jobId);
    if (!originalJob || !originalJob.result) {
      throw new Error('Original job not found or has no result');
    }

    const { mask, editPrompt } = options;
    const provider = originalJob.provider;
    const providerConfig = this.providers.get(provider);

    if (!providerConfig.supportsEdit) {
      throw new Error(`Provider ${provider} does not support image editing`);
    }

    if (!mask) {
      throw new Error('Mask is required for image editing');
    }

    const editOptions = {
      ...options,
      userId: originalJob.userId,
      provider,
      model: originalJob.model,
      prompt: editPrompt || originalJob.prompt,
      referenceImage: originalJob.result.images[0],
      mask,
      edit: true
    };

    return this.generateImage(editOptions);
  }

  // 增强提示词
  enhancePrompt(prompt, style) {
    const styleConfig = IMAGE_STYLES[style];
    if (!styleConfig) {
      return prompt;
    }

    let enhancedPrompt = prompt;

    if (styleConfig.promptPrefix) {
      enhancedPrompt = `${styleConfig.promptPrefix}, ${prompt}`;
    }

    // 添加质量提示
    enhancedPrompt += ', high quality, detailed, professional';

    return enhancedPrompt;
  }

  // 估算成本
  estimateCost(provider, model, count) {
    const costMap = {
      openai_dalle: {
        'dall-e-2': 0.02,
        'dall-e-3': 0.04
      },
      midjourney: {
        'midjourney-v5': 0.03,
        'midjourney-v6': 0.03
      },
      stability_ai: {
        'stable-diffusion-xl-1024-v1-0': 0.02,
        'stable-diffusion-v1-6': 0.01
      }
    };

    const providerCosts = costMap[provider];
    if (!providerCosts) return 0;

    const costPerImage = providerCosts[model] || 0.02;
    return costPerImage * count;
  }

  // 获取任务状态
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      result: job.result,
      metadata: job.metadata
    };
  }

  // 获取用户任务历史
  getUserJobs(userId, limit = 20) {
    const userJobs = Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    return userJobs.map(job => ({
      id: job.id,
      status: job.status,
      provider: job.provider,
      model: job.model,
      prompt: job.prompt.substring(0, 100) + '...',
      createdAt: job.createdAt,
      completedAt: job.completedAt
    }));
  }

  // 获取队列统计
  getQueueStats() {
    return {
      ...this.queue.getStats(),
      activeJobs: Array.from(this.jobs.values()).filter(job =>
        ['queued', 'processing'].includes(job.status)
      ).length
    };
  }

  // 获取支持的提供商
  getProviders() {
    return Array.from(this.providers.entries()).map(([key, config]) => ({
      id: key,
      name: config.name,
      models: config.models,
      maxSize: config.maxSize,
      supportsEdit: config.supportsEdit,
      supportsVariation: config.supportsVariation,
      asyncProcessing: config.asyncProcessing || false
    }));
  }

  // 获取支持的风格
  getStyles() {
    return Object.entries(IMAGE_STYLES).map(([key, config]) => ({
      id: key,
      name: config.name,
      description: config.description
    }));
  }

  // 启动队列处理器
  startQueueProcessor() {
    setInterval(() => {
      const job = this.queue.dequeue();
      if (job) {
        this.processJob(job);
      }
    }, 1000); // 每秒检查一次
  }

  // 处理任务 (这里应该调用实际的AI服务)
  async processJob(job) {
    try {
      log_info(`开始处理图像生成任务: ${job.id}`);

      // 这里应该调用实际的图像生成API
      // 暂时模拟处理过程
      await this.simulateImageGeneration(job);

      // 完成任务
      const mockImages = [
        `https://example.com/generated/${job.id}/image1.${job.format}`,
        `https://example.com/generated/${job.id}/image2.${job.format}`
      ].slice(0, job.count);

      this.queue.complete(job.id, mockImages, job.metadata.estimatedCost);

      this.emit('jobCompleted', job);

      log_info(`图像生成任务完成: ${job.id}`);

    } catch (error) {
      log_error(`图像生成任务失败: ${job.id} - ${error.message}`);
      this.queue.fail(job.id, error);
      this.emit('jobFailed', job);
    }
  }

  // 模拟图像生成 (用于测试)
  async simulateImageGeneration(job) {
    // 模拟不同的处理时间
    const processingTime = 2000 + Math.random() * 8000; // 2-10秒

    // 更新进度
    job.updateProgress(25);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.3));

    job.updateProgress(50);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.3));

    job.updateProgress(75);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.3));

    job.updateProgress(90);
    await new Promise(resolve => setTimeout(resolve, processingTime * 0.1));
  }
}

// 日志函数
function log_info(message) {
  console.log(`[ImageGenerator] ${new Date().toISOString()} - ${message}`);
}

function log_error(message) {
  console.error(`[ImageGenerator Error] ${new Date().toISOString()} - ${message}`);
}

// 导出单例实例
const imageGeneratorManager = new ImageGeneratorManager();

module.exports = {
  ImageGeneratorManager,
  ImageGenerationJob,
  ImageGenerationQueue,
  imageGeneratorManager,
  IMAGE_STYLES,
  IMAGE_PROVIDERS
};
