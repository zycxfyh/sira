const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

/**
 * 模型训练接口系统 - 借鉴Hugging Face、OpenAI Fine-tuning的设计理念
 * 支持用户自定义数据集进行模型微调，提供完整的训练生命周期管理
 */
class ModelTrainingManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.configPath = options.configPath || path.join(__dirname, '../config/model-training.json');
    this.datasetsPath = options.datasetsPath || path.join(__dirname, '../data/datasets');
    this.modelsPath = options.modelsPath || path.join(__dirname, '../data/models');
    this.jobsPath = options.jobsPath || path.join(__dirname, '../data/training-jobs');

    this.trainingJobs = new Map(); // jobId -> training job
    this.datasets = new Map(); // datasetId -> dataset info
    this.deployedModels = new Map(); // modelId -> deployed model
    this.providers = new Map(); // provider -> training capabilities

    this.initialized = false;

    // 默认训练提供商配置
    this.defaultProviders = {
      openai: {
        name: 'OpenAI',
        supportedModels: ['gpt-3.5-turbo', 'gpt-4'],
        maxDatasetSize: 100000, // 最大数据集大小 (条目)
        supportedFormats: ['jsonl'],
        pricing: {
          'gpt-3.5-turbo': 0.008, // 美元/1000 tokens
          'gpt-4': 0.06,
        },
      },
      huggingface: {
        name: 'Hugging Face',
        supportedModels: ['bert-base', 'gpt2', 't5-small'],
        maxDatasetSize: 1000000,
        supportedFormats: ['json', 'csv', 'txt'],
        pricing: {
          'bert-base': 0.001,
          gpt2: 0.002,
          't5-small': 0.003,
        },
      },
      anthropic: {
        name: 'Anthropic',
        supportedModels: ['claude-2'],
        maxDatasetSize: 50000,
        supportedFormats: ['jsonl'],
        pricing: {
          'claude-2': 0.016,
        },
      },
    };

    // 训练状态
    this.jobStatuses = {
      queued: 'queued',
      preparing: 'preparing',
      training: 'training',
      validating: 'validating',
      completed: 'completed',
      failed: 'failed',
      cancelled: 'cancelled',
    };
  }

  /**
   * 初始化模型训练管理器
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 创建必要的目录
      await fs.mkdir(this.datasetsPath, { recursive: true });
      await fs.mkdir(this.modelsPath, { recursive: true });
      await fs.mkdir(this.jobsPath, { recursive: true });

      // 初始化提供商配置
      Object.entries(this.defaultProviders).forEach(([providerId, config]) => {
        this.providers.set(providerId, config);
      });

      // 加载配置
      await this.loadConfigurations();

      // 启动训练作业监控器
      this.startJobMonitor();

      this.initialized = true;
      console.log(`✅ 模型训练管理器已初始化，支持 ${this.providers.size} 个训练提供商`);
    } catch (error) {
      console.error('❌ 模型训练管理器初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 创建训练作业
   */
  async createTrainingJob(jobConfig) {
    const jobId = jobConfig.id || this.generateJobId();

    if (this.trainingJobs.has(jobId)) {
      throw new Error(`训练作业 ${jobId} 已存在`);
    }

    // 验证作业配置
    this.validateJobConfig(jobConfig);

    const job = {
      id: jobId,
      name: jobConfig.name,
      description: jobConfig.description,
      userId: jobConfig.userId,
      datasetId: jobConfig.datasetId,
      baseModel: jobConfig.baseModel,
      provider: jobConfig.provider || 'openai',
      status: 'queued',
      progress: 0,

      // 训练配置
      config: {
        epochs: jobConfig.epochs || 3,
        batchSize: jobConfig.batchSize || 16,
        learningRate: jobConfig.learningRate || 0.0001,
        maxTokens: jobConfig.maxTokens || 512,
        validationSplit: jobConfig.validationSplit || 0.1,
        ...jobConfig.config,
      },

      // 资源配置
      resources: {
        gpuType: jobConfig.gpuType || 'auto',
        gpuCount: jobConfig.gpuCount || 1,
        maxHours: jobConfig.maxHours || 24,
        priority: jobConfig.priority || 'normal',
        ...jobConfig.resources,
      },

      // 监控信息
      monitoring: {
        startTime: null,
        endTime: null,
        estimatedCost: 0,
        actualCost: 0,
        logs: [],
        metrics: {},
      },

      // 元数据
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: jobConfig.tags || [],
        customMetadata: jobConfig.metadata || {},
      },
    };

    // 计算预估成本
    job.monitoring.estimatedCost = await this.calculateEstimatedCost(job);

    this.trainingJobs.set(jobId, job);
    await this.saveConfigurations();

    console.log(`✅ 创建训练作业: ${jobId} - ${job.name}`);
    this.emit('jobCreated', job);

    return job;
  }

  /**
   * 上传数据集
   */
  async uploadDataset(datasetConfig, fileStream) {
    const datasetId = datasetConfig.id || this.generateDatasetId();

    if (this.datasets.has(datasetId)) {
      throw new Error(`数据集 ${datasetId} 已存在`);
    }

    // 创建数据集目录
    const datasetDir = path.join(this.datasetsPath, datasetId);
    await fs.mkdir(datasetDir, { recursive: true });

    // 保存文件
    const filePath = path.join(datasetDir, 'data.jsonl');
    const fileHandle = await fs.open(filePath, 'w');
    let totalRecords = 0;
    let totalSize = 0;

    // 处理文件流
    for await (const chunk of fileStream) {
      await fileHandle.write(chunk);
      totalSize += chunk.length;

      // 简单估算记录数 (JSON Lines格式)
      const lines = chunk
        .toString()
        .split('\n')
        .filter(line => line.trim());
      totalRecords += lines.length;
    }

    await fileHandle.close();

    // 验证数据集
    const validation = await this.validateDataset(filePath, datasetConfig.format || 'jsonl');

    const dataset = {
      id: datasetId,
      name: datasetConfig.name,
      description: datasetConfig.description,
      userId: datasetConfig.userId,
      format: datasetConfig.format || 'jsonl',
      size: totalSize,
      recordCount: totalRecords,
      filePath,
      validation,

      // 元数据
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: datasetConfig.tags || [],
        customMetadata: datasetConfig.metadata || {},
      },
    };

    this.datasets.set(datasetId, dataset);
    await this.saveConfigurations();

    console.log(`✅ 上传数据集: ${datasetId} - ${dataset.recordCount} 条记录`);
    this.emit('datasetUploaded', dataset);

    return dataset;
  }

  /**
   * 开始训练作业
   */
  async startTrainingJob(jobId) {
    const job = this.trainingJobs.get(jobId);
    if (!job) {
      throw new Error(`训练作业 ${jobId} 不存在`);
    }

    if (job.status !== 'queued') {
      throw new Error(`作业状态不允许启动: ${job.status}`);
    }

    // 验证数据集存在
    if (!this.datasets.has(job.datasetId)) {
      throw new Error(`数据集 ${job.datasetId} 不存在`);
    }

    // 更新作业状态
    job.status = 'preparing';
    job.monitoring.startTime = new Date().toISOString();
    job.metadata.updatedAt = new Date().toISOString();

    await this.saveConfigurations();

    // 异步启动训练
    this.startTrainingProcess(job).catch(error => {
      console.error(`训练作业启动失败: ${jobId} - ${error.message}`);
      job.status = 'failed';
      job.monitoring.endTime = new Date().toISOString();
      job.metadata.updatedAt = new Date().toISOString();
      this.saveConfigurations();
    });

    console.log(`🚀 启动训练作业: ${jobId}`);
    this.emit('jobStarted', job);

    return job;
  }

  /**
   * 停止训练作业
   */
  async stopTrainingJob(jobId, reason = 'manual') {
    const job = this.trainingJobs.get(jobId);
    if (!job) {
      throw new Error(`训练作业 ${jobId} 不存在`);
    }

    if (!['training', 'preparing', 'queued'].includes(job.status)) {
      throw new Error(`作业状态不允许停止: ${job.status}`);
    }

    job.status = 'cancelled';
    job.monitoring.endTime = new Date().toISOString();
    job.metadata.updatedAt = new Date().toISOString();

    // 如果正在训练，调用提供商API停止训练
    if (job.status === 'training') {
      await this.stopProviderTraining(job);
    }

    await this.saveConfigurations();

    console.log(`🛑 停止训练作业: ${jobId} (${reason})`);
    this.emit('jobStopped', job);

    return job;
  }

  /**
   * 获取训练作业状态
   */
  getTrainingJobStatus(jobId) {
    const job = this.trainingJobs.get(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      status: job.status,
      progress: job.progress,
      startTime: job.monitoring.startTime,
      estimatedEndTime: job.monitoring.startTime
        ? new Date(
            new Date(job.monitoring.startTime).getTime() + job.resources.maxHours * 60 * 60 * 1000
          ).toISOString()
        : null,
      currentEpoch: job.monitoring.metrics.currentEpoch || 0,
      totalEpochs: job.config.epochs,
      loss: job.monitoring.metrics.loss,
      accuracy: job.monitoring.metrics.accuracy,
      estimatedCost: job.monitoring.estimatedCost,
      actualCost: job.monitoring.actualCost,
      error: job.monitoring.error,
      lastUpdated: job.metadata.updatedAt,
    };
  }

  /**
   * 获取训练日志
   */
  getTrainingLogs(jobId, options = {}) {
    const job = this.trainingJobs.get(jobId);
    if (!job) return null;

    const { limit = 100, offset = 0, level } = options;
    let { logs } = job.monitoring;

    if (level) {
      logs = logs.filter(log => log.level === level);
    }

    return {
      jobId,
      totalLogs: logs.length,
      logs: logs.slice(offset, offset + limit).reverse(),
    };
  }

  /**
   * 部署训练完成的模型
   */
  async deployTrainedModel(jobId, deploymentConfig = {}) {
    const job = this.trainingJobs.get(jobId);
    if (!job) {
      throw new Error(`训练作业 ${jobId} 不存在`);
    }

    if (job.status !== 'completed') {
      throw new Error(`作业未完成，无法部署: ${job.status}`);
    }

    const modelId = this.generateModelId();

    const deployedModel = {
      id: modelId,
      jobId,
      name: `${job.name} (微调)`,
      baseModel: job.baseModel,
      provider: job.provider,
      userId: job.userId,
      status: 'deploying',

      // 部署配置
      config: {
        endpoint: deploymentConfig.endpoint,
        scaling: deploymentConfig.scaling || 'auto',
        region: deploymentConfig.region || 'auto',
        ...deploymentConfig,
      },

      // 性能指标
      metrics: {
        deployedAt: new Date().toISOString(),
        requestsServed: 0,
        avgResponseTime: 0,
        uptime: 0,
      },

      // 元数据
      metadata: {
        trainingJob: jobId,
        datasetId: job.datasetId,
        createdAt: new Date().toISOString(),
        tags: [...(job.metadata.tags || []), 'fine-tuned'],
      },
    };

    this.deployedModels.set(modelId, deployedModel);

    // 异步部署模型
    this.deployModelToProvider(deployedModel).catch(error => {
      console.error(`模型部署失败: ${modelId} - ${error.message}`);
      deployedModel.status = 'failed';
      deployedModel.metrics.error = error.message;
      this.saveConfigurations();
    });

    await this.saveConfigurations();

    console.log(`🚀 开始部署模型: ${modelId}`);
    this.emit('modelDeploying', deployedModel);

    return deployedModel;
  }

  /**
   * 获取用户模型列表
   */
  getUserModels(userId) {
    const userModels = [];

    for (const [modelId, model] of this.deployedModels) {
      if (model.userId === userId) {
        userModels.push({
          id: model.id,
          name: model.name,
          baseModel: model.baseModel,
          provider: model.provider,
          status: model.status,
          endpoint: model.config.endpoint,
          deployedAt: model.metrics.deployedAt,
          requestsServed: model.metrics.requestsServed,
          avgResponseTime: model.metrics.avgResponseTime,
        });
      }
    }

    return userModels;
  }

  /**
   * 删除部署的模型
   */
  async deleteDeployedModel(modelId) {
    const model = this.deployedModels.get(modelId);
    if (!model) {
      throw new Error(`模型 ${modelId} 不存在`);
    }

    // 调用提供商API删除模型
    await this.deleteModelFromProvider(model);

    this.deployedModels.delete(modelId);
    await this.saveConfigurations();

    console.log(`🗑️ 删除部署模型: ${modelId}`);
    this.emit('modelDeleted', model);

    return model;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成作业ID
   */
  generateJobId() {
    return `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 生成数据集ID
   */
  generateDatasetId() {
    return `ds_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 生成模型ID
   */
  generateModelId() {
    return `model_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 验证作业配置
   */
  validateJobConfig(config) {
    if (!config.name) throw new Error('作业名称不能为空');
    if (!config.datasetId) throw new Error('数据集ID不能为空');
    if (!config.baseModel) throw new Error('基础模型不能为空');

    // 验证提供商支持
    const provider = this.providers.get(config.provider || 'openai');
    if (!provider) throw new Error(`不支持的提供商: ${config.provider}`);

    if (!provider.supportedModels.includes(config.baseModel)) {
      throw new Error(`提供商 ${config.provider} 不支持模型: ${config.baseModel}`);
    }

    // 验证训练参数
    if (config.epochs && (config.epochs < 1 || config.epochs > 100)) {
      throw new Error('训练轮数必须在1-100之间');
    }

    if (config.batchSize && (config.batchSize < 1 || config.batchSize > 256)) {
      throw new Error('批次大小必须在1-256之间');
    }
  }

  /**
   * 验证数据集
   */
  async validateDataset(filePath, format) {
    const validation = {
      isValid: true,
      recordCount: 0,
      errors: [],
      warnings: [],
    };

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      validation.recordCount = lines.length;

      // 验证格式
      if (format === 'jsonl') {
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
          try {
            JSON.parse(lines[i]);
          } catch (error) {
            validation.errors.push(`第${i + 1}行JSON格式错误: ${error.message}`);
          }
        }
      }

      // 检查数据集大小
      if (validation.recordCount < 10) {
        validation.warnings.push('数据集过小，可能影响训练效果');
      }

      if (validation.recordCount > 100000) {
        validation.warnings.push('数据集较大，训练时间可能较长');
      }

      validation.isValid = validation.errors.length === 0;
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`文件读取失败: ${error.message}`);
    }

    return validation;
  }

  /**
   * 计算预估成本
   */
  async calculateEstimatedCost(job) {
    const provider = this.providers.get(job.provider);
    if (!provider) return 0;

    const dataset = this.datasets.get(job.datasetId);
    if (!dataset) return 0;

    // 简化的成本估算
    const basePrice = provider.pricing[job.baseModel] || 0.01;
    const estimatedTokens = dataset.recordCount * job.config.maxTokens;
    const trainingMultiplier = 2; // 训练通常需要更多计算

    return (estimatedTokens / 1000) * basePrice * trainingMultiplier * job.config.epochs;
  }

  /**
   * 启动训练作业监控器
   */
  startJobMonitor() {
    // 每30秒检查一次作业状态
    setInterval(() => {
      this.checkRunningJobs();
    }, 30000);
  }

  /**
   * 检查运行中的作业
   */
  async checkRunningJobs() {
    for (const [jobId, job] of this.trainingJobs) {
      if (['preparing', 'training', 'validating'].includes(job.status)) {
        try {
          await this.updateJobStatus(job);
        } catch (error) {
          console.error(`作业状态更新失败: ${jobId} - ${error.message}`);
        }
      }
    }
  }

  /**
   * 启动训练过程 (模拟)
   */
  async startTrainingProcess(job) {
    // 模拟训练过程 - 实际实现会调用相应提供商的API
    console.log(`🎯 开始训练作业: ${job.id}`);

    job.status = 'training';
    await this.saveConfigurations();

    // 模拟训练进度
    const totalSteps = job.config.epochs * 100; // 假设每轮100步
    let currentStep = 0;

    const trainingInterval = setInterval(async () => {
      currentStep += Math.random() * 10;
      const progress = Math.min((currentStep / totalSteps) * 100, 100);
      const currentEpoch = Math.floor(currentStep / 100) + 1;

      job.progress = Math.round(progress);
      job.monitoring.metrics = {
        currentEpoch,
        totalEpochs: job.config.epochs,
        loss: 2.5 - (progress / 100) * 2, // 模拟loss下降
        accuracy: 0.1 + (progress / 100) * 0.8, // 模拟准确率提升
        learningRate: job.config.learningRate * (1 - progress / 100),
      };

      // 添加训练日志
      if (Math.random() < 0.1) {
        // 10%概率添加日志
        job.monitoring.logs.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Epoch ${currentEpoch}/${job.config.epochs}, Loss: ${job.monitoring.metrics.loss.toFixed(4)}, Accuracy: ${(job.monitoring.metrics.accuracy * 100).toFixed(2)}%`,
        });
      }

      await this.saveConfigurations();

      // 检查是否完成
      if (progress >= 100) {
        clearInterval(trainingInterval);
        job.status = 'completed';
        job.monitoring.endTime = new Date().toISOString();
        job.monitoring.actualCost = job.monitoring.estimatedCost * (0.8 + Math.random() * 0.4); // 实际成本在80%-120%之间

        await this.saveConfigurations();

        console.log(`✅ 训练作业完成: ${job.id}`);
        this.emit('jobCompleted', job);
      }
    }, 5000); // 每5秒更新一次

    // 设置超时检查
    setTimeout(
      async () => {
        if (job.status === 'training') {
          clearInterval(trainingInterval);
          await this.stopTrainingJob(job.id, 'timeout');
        }
      },
      job.resources.maxHours * 60 * 60 * 1000
    );
  }

  /**
   * 更新作业状态 (模拟)
   */
  async updateJobStatus(job) {
    // 实际实现会调用提供商API获取真实状态
    // 这里只是模拟
    return job;
  }

  /**
   * 部署模型到提供商 (模拟)
   */
  async deployModelToProvider(model) {
    // 模拟部署过程
    setTimeout(async () => {
      model.status = 'deployed';
      model.config.endpoint = `https://api.sira.ai/models/${model.id}`;
      model.metrics.deployedAt = new Date().toISOString();

      await this.saveConfigurations();

      console.log(`✅ 模型部署完成: ${model.id}`);
      this.emit('modelDeployed', model);
    }, 10000); // 10秒后部署完成
  }

  /**
   * 从提供商删除模型 (模拟)
   */
  async deleteModelFromProvider(model) {
    // 实际实现会调用提供商API
    console.log(`删除模型 ${model.id} 从提供商 ${model.provider}`);
  }

  /**
   * 停止提供商训练 (模拟)
   */
  async stopProviderTraining(job) {
    // 实际实现会调用提供商API
    console.log(`停止训练作业 ${job.id} 在提供商 ${job.provider}`);
  }

  /**
   * 加载配置
   */
  async loadConfigurations() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);

      if (config.trainingJobs) {
        for (const [jobId, job] of Object.entries(config.trainingJobs)) {
          this.trainingJobs.set(jobId, job);
        }
      }

      if (config.datasets) {
        for (const [datasetId, dataset] of Object.entries(config.datasets)) {
          this.datasets.set(datasetId, dataset);
        }
      }

      if (config.deployedModels) {
        for (const [modelId, model] of Object.entries(config.deployedModels)) {
          this.deployedModels.set(modelId, model);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载训练配置失败:', error.message);
      }
    }
  }

  /**
   * 保存配置
   */
  async saveConfigurations() {
    const config = {
      trainingJobs: Object.fromEntries(this.trainingJobs),
      datasets: Object.fromEntries(this.datasets),
      deployedModels: Object.fromEntries(this.deployedModels),
    };

    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}

module.exports = { ModelTrainingManager };
