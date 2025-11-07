const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const config = require('../config/default');
const logger = require('./utils/logger');
const metrics = require('./utils/metrics');
const { connectDB } = require('./database');
const cache = require('./services/cache');
const queue = require('./services/queue');
const auth = require('./middleware/auth');
const rateLimit = require('./middleware/rateLimit');
const batchProcessor = require('./services/batchProcessor');

// Routes
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const batchRoutes = require('./routes/batch');

const app = express();

// Connect to database
connectDB();

// Initialize services
cache.connect();
queue.initialize();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  abortOnLimit: true
}));

// Rate limiting
app.use('/api/', rateLimit.apiLimiter);

// Health check (no auth required)
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: {
      database: 'unknown',
      redis: cache.isConnected ? 'healthy' : 'unhealthy',
      queue: queue.isReady ? 'healthy' : 'unhealthy'
    }
  };

  // Check database connection
  try {
    const mongoose = require('mongoose');
    await mongoose.connection.db.admin().ping();
    health.services.database = 'healthy';
  } catch (error) {
    health.services.database = 'unhealthy';
  }

  const statusCode = Object.values(health.services).includes('unhealthy') ? 503 : 200;
  res.status(statusCode).json(health);
});

// Metrics endpoint
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

// API routes (require authentication)
app.use('/api/v2', auth.authenticate, apiRoutes);
app.use('/api/admin', auth.authenticate, auth.requireAdmin, adminRoutes);
app.use('/api/user', auth.authenticate, userRoutes);
app.use('/api/batch', auth.authenticate, batchRoutes);

// Legacy API compatibility (redirect to v2)
app.use('/api/chat/completions', auth.authenticate, (req, res) => {
  req.url = '/api/v2/chat/completions';
  app.handle(req, res);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.errors
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'CSRF Error',
      message: 'Invalid CSRF token'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, starting graceful shutdown...');

  try {
    // Close queue
    await queue.close();

    // Close cache connection
    await cache.disconnect();

    // Close database connection
    const mongoose = require('mongoose');
    await mongoose.connection.close();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`🚀 API Gateway V2 started on port ${config.server.port}`);
  logger.info(`📊 Environment: ${config.server.env}`);
  logger.info(`🔗 Health check: http://localhost:${config.server.port}/health`);
  logger.info(`📈 Metrics: http://localhost:${config.server.port}/metrics`);

  // Start batch processor
  batchProcessor.start();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
