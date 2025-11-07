const Queue = require('bull');
const config = require('../../config/database');
const logger = require('../utils/logger');
const metrics = require('../utils/metrics');
const cache = require('./cache');
const router = require('./router');
const proxy = require('./proxy');

class BatchProcessor {
  constructor() {
    this.batchQueue = null;
    this.isRunning = false;
    this.batchWindows = new Map(); // Store pending batches by key
    this.maxBatchSize = parseInt(process.env.MAX_BATCH_SIZE) || 10;
    this.batchWindowMs = parseInt(process.env.BATCH_WINDOW_MS) || 200; // 200ms window
  }

  initialize() {
    this.batchQueue = new Queue('batch-processing', config.queue.redis);

    this.batchQueue.process('process-batch', async (job) => {
      return await this.processBatch(job.data);
    });

    this.batchQueue.on('completed', (job, result) => {
      logger.info('Batch job completed', { jobId: job.id, batchId: result.batchId });
      metrics.recordBatchCompleted(result);
    });

    this.batchQueue.on('failed', (job, err) => {
      logger.error('Batch job failed', { jobId: job.id, error: err.message });
      metrics.recordBatchFailed(job.data, err);
    });

    logger.info('Batch processor initialized');
  }

  /**
   * Add request to batch processing
   * @param {Object} request - API request
   * @param {Object} user - User object
   * @returns {Promise<Object>} - Batch result promise
   */
  async addToBatch(request, user) {
    const batchKey = this.generateBatchKey(request);

    // Check if we have a pending batch for this key
    let batchWindow = this.batchWindows.get(batchKey);

    if (!batchWindow) {
      // Create new batch window
      batchWindow = {
        id: this.generateBatchId(),
        key: batchKey,
        requests: [],
        createdAt: Date.now(),
        timeoutId: null
      };

      this.batchWindows.set(batchKey, batchWindow);

      // Set timeout to process batch
      batchWindow.timeoutId = setTimeout(() => {
        this.processBatchWindow(batchKey);
      }, this.batchWindowMs);
    }

    // Add request to batch
    const requestId = this.generateRequestId();
    const batchPromise = new Promise((resolve, reject) => {
      batchWindow.requests.push({
        id: requestId,
        request,
        user,
        resolve,
        reject,
        addedAt: Date.now()
      });
    });

    // Check if batch is full
    if (batchWindow.requests.length >= this.maxBatchSize) {
      clearTimeout(batchWindow.timeoutId);
      await this.processBatchWindow(batchKey);
    }

    return batchPromise;
  }

  /**
   * Process a batch window
   * @param {string} batchKey - Batch key
   */
  async processBatchWindow(batchKey) {
    const batchWindow = this.batchWindows.get(batchKey);
    if (!batchWindow) return;

    // Remove from pending batches
    this.batchWindows.delete(batchKey);
    clearTimeout(batchWindow.timeoutId);

    // Create batch job
    await this.batchQueue.add('process-batch', {
      batchId: batchWindow.id,
      batchKey,
      requests: batchWindow.requests.map(r => ({
        id: r.id,
        request: r.request,
        userId: r.user._id
      })),
      createdAt: batchWindow.createdAt
    });

    logger.debug('Batch window queued for processing', {
      batchId: batchWindow.id,
      requestCount: batchWindow.requests.length
    });
  }

  /**
   * Process a batch job
   * @param {Object} batchData - Batch data
   * @returns {Object} - Processing result
   */
  async processBatch(batchData) {
    const { batchId, requests } = batchData;
    const startTime = Date.now();

    logger.info('Processing batch', { batchId, requestCount: requests.length });

    try {
      // Group requests by model/vendor for efficient processing
      const groupedRequests = this.groupRequestsByModel(requests);

      const results = [];

      // Process each group
      for (const [model, groupRequests] of Object.entries(groupedRequests)) {
        const groupResults = await this.processModelGroup(model, groupRequests);
        results.push(...groupResults);
      }

      // Resolve/reject individual promises
      await this.resolveBatchPromises(requests, results);

      const processingTime = Date.now() - startTime;
      logger.info('Batch processed successfully', {
        batchId,
        requestCount: requests.length,
        processingTime
      });

      metrics.recordBatchMetrics(batchData, results, processingTime);

      return {
        batchId,
        success: true,
        requestCount: requests.length,
        processingTime
      };

    } catch (error) {
      logger.error('Batch processing failed', { batchId, error: error.message });

      // Reject all promises in batch
      await this.rejectBatchPromises(requests, error);

      throw error;
    }
  }

  /**
   * Group requests by model for batch processing
   * @param {Array} requests - Array of requests
   * @returns {Object} - Grouped requests
   */
  groupRequestsByModel(requests) {
    const groups = {};

    requests.forEach(req => {
      const model = req.request.model || 'gpt-3.5-turbo';
      if (!groups[model]) {
        groups[model] = [];
      }
      groups[model].push(req);
    });

    return groups;
  }

  /**
   * Process a group of requests for the same model
   * @param {string} model - Model name
   * @param {Array} requests - Requests for this model
   * @returns {Array} - Results
   */
  async processModelGroup(model, requests) {
    const results = [];

    // For models that support batch processing (like some embedding models)
    if (this.supportsBatchProcessing(model)) {
      const batchResult = await this.processAsBatch(model, requests);
      results.push(...batchResult);
    } else {
      // Process individually but in parallel
      const promises = requests.map(req => this.processIndividualRequest(req));
      const individualResults = await Promise.allSettled(promises);

      individualResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            requestId: requests[index].id,
            success: false,
            error: result.reason.message
          });
        }
      });
    }

    return results;
  }

  /**
   * Check if model supports batch processing
   * @param {string} model - Model name
   * @returns {boolean} - Whether batch processing is supported
   */
  supportsBatchProcessing(model) {
    // Models that support batch processing
    const batchSupportedModels = [
      'text-embedding-ada-002',
      'text-embedding-3-small',
      'text-embedding-3-large'
    ];

    return batchSupportedModels.includes(model);
  }

  /**
   * Process requests as a batch (for embedding models)
   * @param {string} model - Model name
   * @param {Array} requests - Batch requests
   * @returns {Array} - Results
   */
  async processAsBatch(model, requests) {
    try {
      // Combine all texts into a single batch request
      const texts = requests.map(req => req.request.messages[0].content);
      const batchRequest = {
        model,
        input: texts,
        encoding_format: requests[0].request.encoding_format || 'float'
      };

      // Select vendor and make request
      const vendor = await router.selectVendor(batchRequest);
      const response = await proxy.callVendor(vendor, batchRequest);

      // Split results back to individual requests
      const results = [];
      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((item, index) => {
          results.push({
            requestId: requests[index].id,
            success: true,
            data: {
              object: 'embedding',
              data: [item],
              model,
              usage: {
                prompt_tokens: item.length || 0,
                total_tokens: item.length || 0
              }
            }
          });
        });
      }

      return results;

    } catch (error) {
      // If batch processing fails, fall back to individual processing
      logger.warn('Batch processing failed, falling back to individual', {
        model,
        error: error.message
      });

      const promises = requests.map(req => this.processIndividualRequest(req));
      return await Promise.all(promises);
    }
  }

  /**
   * Process individual request
   * @param {Object} requestData - Request data
   * @returns {Object} - Result
   */
  async processIndividualRequest(requestData) {
    const { id: requestId, request, userId } = requestData;

    try {
      // Check cache first
      const cacheKey = cache.generateKey(request);
      const cachedResponse = await cache.get(cacheKey);

      if (cachedResponse) {
        metrics.incrementCacheHit();
        return {
          requestId,
          success: true,
          data: cachedResponse,
          cached: true
        };
      }

      metrics.incrementCacheMiss();

      // Select vendor and process
      const vendor = await router.selectVendor(request);
      const response = await proxy.callVendor(vendor, request);

      // Cache the response
      await cache.set(cacheKey, response, config.redis.ttl.default);

      // Record metrics
      metrics.recordRequest(request, response, vendor, Date.now() - Date.now());

      return {
        requestId,
        success: true,
        data: response,
        cached: false,
        vendor
      };

    } catch (error) {
      logger.error('Individual request failed', {
        requestId,
        error: error.message
      });

      return {
        requestId,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Resolve batch promises
   * @param {Array} requests - Original requests
   * @param {Array} results - Processing results
   */
  async resolveBatchPromises(requests, results) {
    const resultMap = new Map(results.map(r => [r.requestId, r]));

    for (const request of requests) {
      const result = resultMap.get(request.id);
      if (result && result.success) {
        request.resolve(result.data);
      } else {
        request.reject(new Error(result?.error || 'Batch processing failed'));
      }
    }
  }

  /**
   * Reject batch promises
   * @param {Array} requests - Original requests
   * @param {Error} error - Error
   */
  async rejectBatchPromises(requests, error) {
    for (const request of requests) {
      request.reject(error);
    }
  }

  /**
   * Generate batch key for grouping similar requests
   * @param {Object} request - API request
   * @returns {string} - Batch key
   */
  generateBatchKey(request) {
    const { model, temperature, max_tokens } = request;
    return `${model}_${temperature || 1}_${max_tokens || 1000}`;
  }

  /**
   * Generate unique batch ID
   * @returns {string} - Batch ID
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique request ID
   * @returns {string} - Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start the batch processor
   */
  start() {
    this.isRunning = true;
    logger.info('Batch processor started');

    // Clean up old batch windows periodically
    setInterval(() => {
      this.cleanupOldBatchWindows();
    }, 60000); // Every minute
  }

  /**
   * Stop the batch processor
   */
  async stop() {
    this.isRunning = false;

    // Clear all pending timeouts
    for (const batchWindow of this.batchWindows.values()) {
      if (batchWindow.timeoutId) {
        clearTimeout(batchWindow.timeoutId);
      }
    }

    this.batchWindows.clear();

    // Close queue
    if (this.batchQueue) {
      await this.batchQueue.close();
    }

    logger.info('Batch processor stopped');
  }

  /**
   * Clean up old batch windows
   */
  cleanupOldBatchWindows() {
    const now = Date.now();
    const timeoutMs = this.batchWindowMs * 2; // Allow some buffer

    for (const [key, batchWindow] of this.batchWindows.entries()) {
      if (now - batchWindow.createdAt > timeoutMs) {
        logger.warn('Cleaning up stale batch window', { batchKey: key });
        clearTimeout(batchWindow.timeoutId);
        this.batchWindows.delete(key);
      }
    }
  }

  /**
   * Get batch processor statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      pendingBatches: this.batchWindows.size,
      queueStats: this.batchQueue ? {
        waiting: this.batchQueue.waiting,
        active: this.batchQueue.active,
        completed: this.batchQueue.completed,
        failed: this.batchQueue.failed
      } : null
    };
  }
}

// Create singleton instance
const batchProcessor = new BatchProcessor();

module.exports = batchProcessor;
