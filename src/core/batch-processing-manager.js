const { EventEmitter } = require('events');
const crypto = require('crypto');

/**
 * 批量处理管理器
 * 借鉴AWS Batch、Google Cloud Batch和分布式计算平台的优秀设计理念
 * 提供高性能的批量AI请求处理服务，支持并发控制、负载均衡和智能调度
 */
class BatchProcessingManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.configPath =
      options.configPath || require('path').join(__dirname, '../config/batch-processing.json');

    // 批量处理配置
    this.maxBatchSize = options.maxBatchSize || 100; // 最大批量大小
    this.maxConcurrency = options.maxConcurrency || 10; // 最大并发数
    this.defaultTimeout = options.defaultTimeout || 300000; // 默认超时时间 (5分钟)
    this.retryAttempts = options.retryAttempts || 3; // 重试次数
    this.retryDelay = options.retryDelay || 1000; // 重试延迟 (毫秒)

    // 队列管理
    this.processingQueue = []; // 处理队列
    this.activeBatches = new Map(); // 活跃的批量任务
    this.completedBatches = new Map(); // 完成的批量任务

    // 性能监控
    this.performanceStats = {
      totalBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      avgProcessingTime: 0,
      avgThroughput: 0, // 请求/秒
      peakConcurrency: 0,
      lastUpdated: new Date().toISOString(),
    };

    // 并发控制
    this.activeWorkers = 0;
    this.workerSemaphore = this.createSemaphore(this.maxConcurrency);

    // 智能调度
    this.scheduler = {
      priorityQueue: [], // 优先级队列
      normalQueue: [], // 普通队列
      lowPriorityQueue: [], // 低优先级队列
    };

    // 结果缓存
    this.resultCache = new Map();
    this.cacheTTL = options.cacheTTL || 3600000; // 1小时缓存

    // 初始化
    this.initialize();
  }

  /**
   * 初始化批量处理管理器
   */
  async initialize() {
    try {
      // 加载配置
      await this.loadConfiguration();

      // 启动处理调度器
      this.startBatchScheduler();

      // 启动性能监控
      this.startPerformanceMonitoring();

      // 启动缓存清理
      this.startCacheCleanup();

      console.log(`✅ 批量处理管理器已初始化，最大并发数: ${this.maxConcurrency}`);
    } catch (error) {
      console.error('❌ 批量处理管理器初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 提交批量处理请求
   */
  async submitBatch(batchRequest, context = {}) {
    const batchId = batchRequest.id || this.generateBatchId();

    if (this.activeBatches.has(batchId)) {
      throw new Error(`批量任务 ${batchId} 已存在`);
    }

    // 验证批量请求
    this.validateBatchRequest(batchRequest);

    // 创建批量任务
    const batch = {
      id: batchId,
      name: batchRequest.name || `Batch ${batchId}`,
      description: batchRequest.description,
      userId: batchRequest.userId || context.userId || 'anonymous',
      requests: batchRequest.requests || [],
      totalRequests: batchRequest.requests?.length || 0,

      // 配置
      config: {
        priority: batchRequest.priority || 'normal',
        timeout: batchRequest.timeout || this.defaultTimeout,
        maxConcurrency: batchRequest.maxConcurrency || Math.min(5, this.maxConcurrency),
        continueOnError: batchRequest.continueOnError !== false,
        collectMetrics: batchRequest.collectMetrics !== false,
        ...batchRequest.config,
      },

      // 执行状态
      status: 'queued',
      progress: {
        completed: 0,
        failed: 0,
        total: batchRequest.requests?.length || 0,
        successRate: 0,
      },

      // 结果
      results: [],
      errors: [],

      // 监控信息
      monitoring: {
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        duration: 0,
        avgResponseTime: 0,
        totalTokens: 0,
        totalCost: 0,
      },

      // 元数据
      metadata: {
        source: batchRequest.source || 'api',
        tags: batchRequest.tags || [],
        customMetadata: batchRequest.metadata || {},
      },
    };

    // 添加到队列
    this.addToQueue(batch);

    // 保存配置
    await this.saveConfiguration();

    console.log(`📦 批量任务已提交: ${batchId} (${batch.totalRequests} 个请求)`);

    this.emit('batchSubmitted', batch);

    return batch;
  }

  /**
   * 获取批量处理状态
   */
  getBatchStatus(batchId) {
    // 检查活跃任务
    if (this.activeBatches.has(batchId)) {
      return this.activeBatches.get(batchId);
    }

    // 检查完成的任务
    if (this.completedBatches.has(batchId)) {
      return this.completedBatches.get(batchId);
    }

    return null;
  }

  /**
   * 取消批量处理
   */
  async cancelBatch(batchId, reason = 'user_cancelled') {
    const batch = this.activeBatches.get(batchId);

    if (!batch) {
      throw new Error(`批量任务 ${batchId} 不存在或已完成`);
    }

    if (batch.status === 'completed' || batch.status === 'failed') {
      throw new Error(`批量任务 ${batchId} 已经完成`);
    }

    // 更新状态
    batch.status = 'cancelled';
    batch.monitoring.completedAt = new Date().toISOString();
    batch.monitoring.cancelReason = reason;

    // 从活跃任务中移除
    this.activeBatches.delete(batchId);

    // 添加到完成任务
    this.completedBatches.set(batchId, batch);

    // 保存配置
    await this.saveConfiguration();

    console.log(`🛑 批量任务已取消: ${batchId} (${reason})`);

    this.emit('batchCancelled', batch);

    return batch;
  }

  /**
   * 获取批量处理结果
   */
  getBatchResults(batchId, options = {}) {
    const batch = this.getBatchStatus(batchId);

    if (!batch) {
      return null;
    }

    const { limit = 50, offset = 0, includeErrors = true } = options;

    const results = {
      batchId: batch.id,
      status: batch.status,
      progress: batch.progress,
      totalResults: batch.results.length,
      results: batch.results.slice(offset, offset + limit),
      monitoring: batch.monitoring,
    };

    if (includeErrors && batch.errors.length > 0) {
      results.errors = batch.errors.slice(0, Math.min(limit, 10)); // 限制错误数量
    }

    return results;
  }

  /**
   * 获取用户批量任务列表
   */
  getUserBatches(userId, options = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const allBatches = [
      ...Array.from(this.activeBatches.values()),
      ...Array.from(this.completedBatches.values()),
    ].filter(batch => batch.userId === userId);

    // 按创建时间倒序排序
    allBatches.sort((a, b) => new Date(b.monitoring.createdAt) - new Date(a.monitoring.createdAt));

    // 过滤状态
    let filteredBatches = allBatches;
    if (status) {
      const statusList = Array.isArray(status) ? status : [status];
      filteredBatches = allBatches.filter(batch => statusList.includes(batch.status));
    }

    // 分页
    const total = filteredBatches.length;
    const batches = filteredBatches.slice(offset, offset + limit);

    return {
      userId,
      batches: batches.map(batch => ({
        id: batch.id,
        name: batch.name,
        status: batch.status,
        progress: batch.progress,
        createdAt: batch.monitoring.createdAt,
        completedAt: batch.monitoring.completedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 验证批量请求
   */
  validateBatchRequest(batchRequest) {
    if (!batchRequest.requests || !Array.isArray(batchRequest.requests)) {
      throw new Error('批量请求必须包含requests数组');
    }

    if (batchRequest.requests.length === 0) {
      throw new Error('批量请求不能为空');
    }

    if (batchRequest.requests.length > this.maxBatchSize) {
      throw new Error(`批量请求数量不能超过 ${this.maxBatchSize} 个`);
    }

    // 验证每个请求
    for (let i = 0; i < batchRequest.requests.length; i++) {
      const request = batchRequest.requests[i];

      if (!request || typeof request !== 'object') {
        throw new Error(`请求 ${i} 格式无效`);
      }

      // 基本验证：至少要有messages或prompt
      if (!request.messages && !request.prompt && !request.text) {
        throw new Error(`请求 ${i} 缺少内容 (messages/prompt/text)`);
      }
    }
  }

  /**
   * 添加到队列
   */
  addToQueue(batch) {
    // 根据优先级添加到不同队列
    switch (batch.config.priority) {
      case 'high':
        this.scheduler.priorityQueue.push(batch);
        break;
      case 'low':
        this.scheduler.lowPriorityQueue.push(batch);
        break;
      default:
        this.scheduler.normalQueue.push(batch);
    }
  }

  /**
   * 启动批量调度器
   */
  startBatchScheduler() {
    // 每秒检查一次队列
    setInterval(() => {
      this.processQueue();
    }, 1000);
  }

  /**
   * 处理队列
   */
  async processQueue() {
    // 优先处理高优先级队列
    const queues = [
      this.scheduler.priorityQueue,
      this.scheduler.normalQueue,
      this.scheduler.lowPriorityQueue,
    ];

    for (const queue of queues) {
      if (queue.length === 0) continue;

      // 检查是否有可用的worker
      if (this.activeWorkers >= this.maxConcurrency) break;

      const batch = queue.shift();
      this.startBatchProcessing(batch);
    }
  }

  /**
   * 开始批量处理
   */
  async startBatchProcessing(batch) {
    try {
      this.activeWorkers++;
      this.activeBatches.set(batch.id, batch);

      batch.status = 'processing';
      batch.monitoring.startedAt = new Date().toISOString();

      console.log(`🚀 开始处理批量任务: ${batch.id} (${batch.totalRequests} 个请求)`);

      this.emit('batchStarted', batch);

      // 执行批量处理
      await this.executeBatch(batch);

      // 处理完成
      batch.status = 'completed';
      batch.monitoring.completedAt = new Date().toISOString();
      batch.monitoring.duration =
        new Date(batch.monitoring.completedAt) - new Date(batch.monitoring.startedAt);

      // 计算统计信息
      this.calculateBatchStatistics(batch);

      // 从活跃任务移到完成任务
      this.activeBatches.delete(batch.id);
      this.completedBatches.set(batch.id, batch);

      // 更新性能统计
      this.updatePerformanceStats(batch);

      console.log(
        `✅ 批量任务完成: ${batch.id} (${batch.progress.completed}/${batch.totalRequests})`
      );

      this.emit('batchCompleted', batch);
    } catch (error) {
      console.error(`批量任务失败: ${batch.id} - ${error.message}`);

      batch.status = 'failed';
      batch.monitoring.completedAt = new Date().toISOString();
      batch.monitoring.error = error.message;

      // 从活跃任务移到完成任务
      this.activeBatches.delete(batch.id);
      this.completedBatches.set(batch.id, batch);

      this.emit('batchFailed', { batch, error });
    } finally {
      this.activeWorkers--;
    }

    // 保存配置
    await this.saveConfiguration();
  }

  /**
   * 执行批量处理
   */
  async executeBatch(batch) {
    const { requests, config } = batch;
    const semaphore = this.createSemaphore(config.maxConcurrency);

    // 创建处理任务
    const tasks = requests.map((request, index) =>
      this.processSingleRequest(batch, request, index, semaphore)
    );

    // 并发执行所有任务
    const results = await Promise.allSettled(tasks);

    // 处理结果
    for (let i = 0; i < results.length; i++) {
      const result = results[i];

      if (result.status === 'fulfilled') {
        batch.results.push(result.value);
        batch.progress.completed++;
      } else {
        const error = result.reason;
        batch.errors.push({
          index: i,
          request: requests[i],
          error: error.message,
          timestamp: new Date().toISOString(),
        });
        batch.progress.failed++;

        // 如果不继续出错，抛出错误
        if (!config.continueOnError) {
          throw error;
        }
      }
    }

    // 计算成功率
    batch.progress.successRate =
      batch.totalRequests > 0 ? batch.progress.completed / batch.totalRequests : 0;
  }

  /**
   * 处理单个请求
   */
  async processSingleRequest(batch, request, index, semaphore) {
    // 获取信号量
    await semaphore.acquire();

    try {
      const startTime = Date.now();

      // 检查缓存
      const cacheKey = this.generateRequestCacheKey(request);
      const cachedResult = this.resultCache.get(cacheKey);

      if (cachedResult && Date.now() - cachedResult.timestamp < this.cacheTTL) {
        return {
          index,
          request,
          result: cachedResult.result,
          cached: true,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        };
      }

      // 执行AI请求（这里需要集成实际的AI路由器）
      const result = await this.executeAIRequest(request, {
        userId: batch.userId,
        batchId: batch.id,
        timeout: batch.config.timeout,
      });

      const processingTime = Date.now() - startTime;

      // 更新批量统计
      batch.monitoring.avgResponseTime =
        (batch.monitoring.avgResponseTime * batch.progress.completed + processingTime) /
        (batch.progress.completed + 1);

      if (result.usage) {
        batch.monitoring.totalTokens += result.usage.total_tokens || 0;
      }

      // 缓存结果
      this.resultCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return {
        index,
        request,
        result,
        cached: false,
        processingTime,
        timestamp: new Date().toISOString(),
      };
    } finally {
      semaphore.release();
    }
  }

  /**
   * 执行AI请求（需要集成实际的路由器）
   */
  async executeAIRequest(request, context) {
    // 这里应该集成ai-router来执行实际的AI请求
    // 暂时使用模拟实现
    return new Promise((resolve, reject) => {
      setTimeout(
        () => {
          // 模拟AI响应
          resolve({
            id: `response_${Date.now()}`,
            object: 'text_completion',
            created: Date.now(),
            model: request.model || 'gpt-3.5-turbo',
            choices: [
              {
                text: `这是对 "${request.prompt || request.messages?.[0]?.content || '请求'}" 的模拟响应`,
                index: 0,
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          });
        },
        Math.random() * 1000 + 500
      ); // 500-1500ms随机延迟
    });
  }

  /**
   * 计算批量统计信息
   */
  calculateBatchStatistics(batch) {
    if (batch.results.length === 0) return;

    const totalProcessingTime = batch.results.reduce((sum, r) => sum + r.processingTime, 0);
    batch.monitoring.avgResponseTime = totalProcessingTime / batch.results.length;

    const totalTokens = batch.results.reduce((sum, r) => {
      return sum + (r.result.usage?.total_tokens || 0);
    }, 0);
    batch.monitoring.totalTokens = totalTokens;

    // 估算成本 (简化计算)
    batch.monitoring.totalCost = totalTokens * 0.00002; // 假设每token $0.00002
  }

  /**
   * 更新性能统计
   */
  updatePerformanceStats(batch) {
    this.performanceStats.totalBatches++;

    if (batch.status === 'completed') {
      this.performanceStats.completedBatches++;
    } else {
      this.performanceStats.failedBatches++;
    }

    // 更新平均处理时间
    const alpha = 0.1; // 指数移动平均
    this.performanceStats.avgProcessingTime =
      this.performanceStats.avgProcessingTime * (1 - alpha) + batch.monitoring.duration * alpha;

    // 更新吞吐量
    const throughput = batch.totalRequests / (batch.monitoring.duration / 1000);
    this.performanceStats.avgThroughput =
      this.performanceStats.avgThroughput * (1 - alpha) + throughput * alpha;

    // 更新峰值并发
    if (batch.config.maxConcurrency > this.performanceStats.peakConcurrency) {
      this.performanceStats.peakConcurrency = batch.config.maxConcurrency;
    }

    this.performanceStats.lastUpdated = new Date().toISOString();
  }

  /**
   * 生成批量ID
   */
  generateBatchId() {
    return `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * 生成请求缓存键
   */
  generateRequestCacheKey(request) {
    const keyData = {
      model: request.model,
      messages: request.messages,
      prompt: request.prompt,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
    };

    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(keyData));
    return hash.digest('hex');
  }

  /**
   * 创建信号量
   */
  createSemaphore(maxConcurrent) {
    let permits = maxConcurrent;
    const waitQueue = [];

    return {
      acquire: () => {
        return new Promise(resolve => {
          if (permits > 0) {
            permits--;
            resolve();
          } else {
            waitQueue.push(resolve);
          }
        });
      },

      release: () => {
        permits++;
        if (waitQueue.length > 0) {
          const resolve = waitQueue.shift();
          permits--;
          resolve();
        }
      },
    };
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring() {
    // 每分钟记录性能统计
    setInterval(() => {
      this.emit('performanceStats', this.performanceStats);
    }, 60000);
  }

  /**
   * 启动缓存清理
   */
  startCacheCleanup() {
    // 每30分钟清理过期缓存
    setInterval(
      () => {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.resultCache.entries()) {
          if (now - cached.timestamp > this.cacheTTL) {
            this.resultCache.delete(key);
            cleaned++;
          }
        }

        if (cleaned > 0) {
          console.log(`🧹 清理过期缓存: ${cleaned} 条`);
        }
      },
      30 * 60 * 1000
    );
  }

  /**
   * 加载配置
   */
  async loadConfiguration() {
    try {
      const fs = require('fs').promises;
      const data = await fs.readFile(this.configPath, 'utf8');
      const config = JSON.parse(data);

      if (config.activeBatches) {
        for (const [batchId, batch] of Object.entries(config.activeBatches)) {
          this.activeBatches.set(batchId, batch);
        }
      }

      if (config.completedBatches) {
        for (const [batchId, batch] of Object.entries(config.completedBatches)) {
          this.completedBatches.set(batchId, batch);
        }
      }

      if (config.performanceStats) {
        this.performanceStats = { ...this.performanceStats, ...config.performanceStats };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('加载批量处理配置失败:', error.message);
      }
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration() {
    try {
      const fs = require('fs').promises;
      const config = {
        activeBatches: Object.fromEntries(this.activeBatches),
        completedBatches: Object.fromEntries(
          Array.from(this.completedBatches.entries()).slice(-100) // 只保存最近100个
        ),
        performanceStats: this.performanceStats,
        lastUpdated: new Date().toISOString(),
      };

      await fs.mkdir(require('path').dirname(this.configPath), { recursive: true });
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('保存批量处理配置失败:', error.message);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStatistics() {
    return {
      ...this.performanceStats,
      activeWorkers: this.activeWorkers,
      queueLengths: {
        priority: this.scheduler.priorityQueue.length,
        normal: this.scheduler.normalQueue.length,
        lowPriority: this.scheduler.lowPriorityQueue.length,
      },
      cacheSize: this.resultCache.size,
      activeBatches: this.activeBatches.size,
    };
  }
}

module.exports = { BatchProcessingManager };
