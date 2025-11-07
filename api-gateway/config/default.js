// Default configuration for API Gateway

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    ttl: {
      default: parseInt(process.env.CACHE_TTL_DEFAULT) || 300,
      long: parseInt(process.env.CACHE_TTL_LONG) || 3600
    }
  },

  vendors: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      cost: parseFloat(process.env.COST_OPENAI_GPT4) || 0.03
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com/v1',
      cost: parseFloat(process.env.COST_CLAUDE) || 0.015
    },
    azure: {
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      cost: parseFloat(process.env.COST_AZURE_GPT4) || 0.03
    }
  },

  gateway: {
    apiKey: process.env.GATEWAY_API_KEY || 'gateway-key-123',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    }
  },

  monitoring: {
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT) || 9090
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};
