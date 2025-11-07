// Database configuration for API Gateway V2

module.exports = {
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/api-gateway-v2',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    }
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0,
    keyPrefix: 'agv2:', // API Gateway V2 prefix
    ttl: {
      default: parseInt(process.env.CACHE_TTL_DEFAULT) || 300,
      long: parseInt(process.env.CACHE_TTL_LONG) || 3600,
      session: parseInt(process.env.SESSION_TTL) || 86400, // 24 hours
      user: parseInt(process.env.USER_CACHE_TTL) || 1800, // 30 minutes
    }
  },

  queue: {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || null,
      db: process.env.QUEUE_REDIS_DB || 1,
    },
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  }
};
