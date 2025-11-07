const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const batchProcessor = require('../services/batchProcessor');
const cache = require('../services/cache');
const routerService = require('../services/router');
const proxy = require('../services/proxy');
const metrics = require('../utils/metrics');
const logger = require('../utils/logger');

// Validation rules
const chatCompletionValidation = [
  body('model').isString().notEmpty().withMessage('Model is required'),
  body('messages').isArray().notEmpty().withMessage('Messages array is required'),
  body('messages.*.role').isIn(['system', 'user', 'assistant']).withMessage('Invalid message role'),
  body('messages.*.content').isString().notEmpty().withMessage('Message content is required'),
  body('temperature').optional().isFloat({ min: 0, max: 2 }).withMessage('Temperature must be between 0 and 2'),
  body('max_tokens').optional().isInt({ min: 1, max: 4000 }).withMessage('Max tokens must be between 1 and 4000'),
  body('stream').optional().isBoolean().withMessage('Stream must be boolean')
];

/**
 * POST /api/v2/chat/completions
 * Create chat completion with batch processing support
 */
router.post('/chat/completions', [
  ...chatCompletionValidation,
  auth.checkQuota
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array()
    });
  }

  const startTime = Date.now();

  try {
    // Check if batch processing is enabled and applicable
    const shouldBatch = req.headers['x-enable-batch'] === 'true' &&
                        batchProcessor.isRunning &&
                        req.body.stream !== true; // Don't batch streaming requests

    let response;

    if (shouldBatch) {
      // Add to batch processing
      logger.debug('Adding request to batch processing', { userId: req.user._id });
      response = await batchProcessor.addToBatch(req.body, req.user);
    } else {
      // Process immediately
      response = await processIndividualRequest(req.body, req.user);
    }

    const processingTime = Date.now() - startTime;

    // Update usage (simplified - in real implementation, calculate actual tokens and cost)
    const tokens = estimateTokens(req.body);
    const cost = estimateCost(req.body.model, tokens);

    // Use auth middleware to update usage
    await auth.updateUsage(tokens, cost)(req, res, () => {});

    // Record metrics
    metrics.recordRequest(req.body, response, 'batched', processingTime);

    logger.info('Chat completion processed', {
      userId: req.user._id,
      model: req.body.model,
      batched: shouldBatch,
      processingTime,
      tokens,
      cost
    });

    res.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;

    metrics.recordError(error);
    logger.error('Chat completion error', {
      userId: req.user._id,
      error: error.message,
      processingTime
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/v2/embeddings
 * Create embeddings with batch processing support
 */
router.post('/embeddings', [
  body('model').isString().notEmpty().withMessage('Model is required'),
  body('input').isString().withMessage('Input is required'),
  auth.checkQuota
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors.array()
    });
  }

  const startTime = Date.now();

  try {
    // For embeddings, we can batch multiple inputs
    const shouldBatch = req.headers['x-enable-batch'] === 'true' && batchProcessor.isRunning;

    let response;

    if (shouldBatch && Array.isArray(req.body.input)) {
      // Create multiple requests for batch processing
      const requests = req.body.input.map(text => ({
        model: req.body.model,
        input: text,
        encoding_format: req.body.encoding_format || 'float'
      }));

      // Process as batch
      const promises = requests.map(request => batchProcessor.addToBatch(request, req.user));
      const results = await Promise.all(promises);

      response = {
        object: 'list',
        data: results.map((result, index) => ({
          object: 'embedding',
          embedding: result.data[0].embedding,
          index
        })),
        model: req.body.model,
        usage: {
          prompt_tokens: results.reduce((sum, r) => sum + (r.usage?.prompt_tokens || 0), 0),
          total_tokens: results.reduce((sum, r) => sum + (r.usage?.total_tokens || 0), 0)
        }
      };
    } else {
      // Process single embedding
      response = await processIndividualRequest(req.body, req.user);
    }

    const processingTime = Date.now() - startTime;

    // Update usage
    const tokens = response.usage?.total_tokens || estimateTokens(req.body);
    const cost = estimateCost(req.body.model, tokens);
    await auth.updateUsage(tokens, cost)(req, res, () => {});

    metrics.recordRequest(req.body, response, 'embeddings', processingTime);

    logger.info('Embeddings processed', {
      userId: req.user._id,
      model: req.body.model,
      inputCount: Array.isArray(req.body.input) ? req.body.input.length : 1,
      batched: shouldBatch,
      processingTime
    });

    res.json(response);

  } catch (error) {
    metrics.recordError(error);
    logger.error('Embeddings error', {
      userId: req.user._id,
      error: error.message
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/v2/models
 * List available models
 */
router.get('/models', async (req, res) => {
  try {
    const models = [
      {
        id: 'gpt-4',
        object: 'model',
        created: 1687882411,
        owned_by: 'openai'
      },
      {
        id: 'gpt-4-turbo',
        object: 'model',
        created: 1698982308,
        owned_by: 'openai'
      },
      {
        id: 'gpt-3.5-turbo',
        object: 'model',
        created: 1677610602,
        owned_by: 'openai'
      },
      {
        id: 'claude-3-opus',
        object: 'model',
        created: 1698982308,
        owned_by: 'anthropic'
      },
      {
        id: 'claude-3-sonnet',
        object: 'model',
        created: 1698982308,
        owned_by: 'anthropic'
      },
      {
        id: 'text-embedding-ada-002',
        object: 'model',
        created: 1671217299,
        owned_by: 'openai'
      }
    ];

    res.json({
      object: 'list',
      data: models
    });

  } catch (error) {
    logger.error('Models list error', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

/**
 * Process individual request (helper function)
 */
async function processIndividualRequest(requestBody, user) {
  // Check cache first
  const cacheKey = cache.generateKey(requestBody);
  const cachedResponse = await cache.get(cacheKey);

  if (cachedResponse) {
    metrics.incrementCacheHit();
    return cachedResponse;
  }

  metrics.incrementCacheMiss();

  // Select vendor and process
  const vendor = await routerService.selectVendor(requestBody);
  const response = await proxy.callVendor(vendor, requestBody);

  // Cache the response
  const cache = require('../services/cache');
  await cache.set(cacheKey, response);

  return response;
}

/**
 * Estimate token count (simplified)
 */
function estimateTokens(requestBody) {
  // Very rough estimation - in production, use proper tokenization
  const text = JSON.stringify(requestBody.messages || requestBody.input || '');
  return Math.ceil(text.length / 4); // Rough approximation
}

/**
 * Estimate cost (simplified)
 */
function estimateCost(model, tokens) {
  const rates = {
    'gpt-4': 0.03,
    'gpt-4-turbo': 0.01,
    'gpt-3.5-turbo': 0.002,
    'claude-3-opus': 0.015,
    'claude-3-sonnet': 0.003,
    'text-embedding-ada-002': 0.0001
  };

  const rate = rates[model] || 0.002;
  return (tokens / 1000) * rate;
}

module.exports = router;
