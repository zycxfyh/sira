const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config/default');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const cache = require('./services/cache');
const router = require('./services/router');
const proxy = require('./services/proxy');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.gateway.rateLimit.windowMs,
  max: config.gateway.rateLimit.max,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Authentication middleware
app.use('/api/*', (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey || apiKey !== config.gateway.apiKey) {
    logger.warn('Unauthorized access attempt', { ip: req.ip, apiKey: apiKey ? 'provided' : 'missing' });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  try {
    const metricsData = await metrics.getMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(metricsData);
  } catch (error) {
    logger.error('Metrics collection error', error);
    res.status(500).send('Metrics collection failed');
  }
});

// Main API proxy endpoint
app.post('/api/chat/completions', async (req, res) => {
  const startTime = Date.now();

  try {
    // Generate cache key
    const cacheKey = cache.generateKey(req.body);

    // Check cache first
    const cachedResponse = await cache.get(cacheKey);
    if (cachedResponse) {
      metrics.incrementCacheHit();
      logger.info('Cache hit', { cacheKey, responseTime: Date.now() - startTime });
      return res.json(cachedResponse);
    }

    metrics.incrementCacheMiss();

    // Choose vendor based on routing logic
    const vendor = await router.selectVendor(req.body);

    // Make API call
    const response = await proxy.callVendor(vendor, req.body);

    // Cache the response
    await cache.set(cacheKey, response, config.redis.ttl.default);

    // Record metrics
    metrics.recordRequest(req.body, response, vendor, Date.now() - startTime);

    logger.info('Request processed', {
      vendor,
      model: req.body.model,
      responseTime: Date.now() - startTime,
      cached: false
    });

    res.json(response);

  } catch (error) {
    metrics.recordError(error);
    logger.error('Request processing error', {
      error: error.message,
      stack: error.stack,
      responseTime: Date.now() - startTime
    });

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`API Gateway started on port ${config.server.port}`);
  logger.info(`Environment: ${config.server.env}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

module.exports = app;
