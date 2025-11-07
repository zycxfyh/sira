const promClient = require('prom-client');
const config = require('../../config/default');
const logger = require('./logger');

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'api-gateway'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const requestTotal = new promClient.Counter({
  name: 'api_gateway_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'endpoint', 'status', 'vendor', 'model'],
  registers: [register]
});

const requestDuration = new promClient.Histogram({
  name: 'api_gateway_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['method', 'endpoint', 'vendor', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const cacheHits = new promClient.Counter({
  name: 'api_gateway_cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register]
});

const cacheMisses = new promClient.Counter({
  name: 'api_gateway_cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register]
});

const vendorRequests = new promClient.Counter({
  name: 'api_gateway_vendor_requests_total',
  help: 'Total number of requests to each vendor',
  labelNames: ['vendor', 'status'],
  registers: [register]
});

const vendorErrors = new promClient.Counter({
  name: 'api_gateway_vendor_errors_total',
  help: 'Total number of errors from each vendor',
  labelNames: ['vendor', 'error_type'],
  registers: [register]
});

const costTotal = new promClient.Counter({
  name: 'api_gateway_cost_total',
  help: 'Total cost incurred by the gateway',
  labelNames: ['vendor', 'model', 'currency'],
  registers: [register]
});

const activeConnections = new promClient.Gauge({
  name: 'api_gateway_active_connections',
  help: 'Number of active connections',
  registers: [register]
});

class MetricsService {
  /**
   * Record a completed request
   * @param {Object} requestBody - Request body
   * @param {Object} response - API response
   * @param {string} vendor - Vendor name
   * @param {number} duration - Request duration in milliseconds
   */
  recordRequest(requestBody, response, vendor, duration) {
    const method = 'POST';
    const endpoint = '/api/chat/completions';
    const status = '200'; // Assuming success if we reach here
    const model = requestBody.model || 'unknown';

    // Record request metrics
    requestTotal.inc({
      method,
      endpoint,
      status,
      vendor,
      model
    }, 1);

    requestDuration.observe({
      method,
      endpoint,
      vendor,
      model
    }, duration / 1000); // Convert to seconds

    // Record vendor metrics
    vendorRequests.inc({
      vendor,
      status
    }, 1);

    // Record cost (simplified calculation)
    const cost = this.calculateCost(vendor, model, response);
    if (cost > 0) {
      costTotal.inc({
        vendor,
        model,
        currency: 'CNY'
      }, cost);
    }

    logger.debug('Metrics recorded', {
      vendor,
      model,
      duration: duration / 1000,
      cost
    });
  }

  /**
   * Record cache hit
   */
  incrementCacheHit() {
    cacheHits.inc(1);
  }

  /**
   * Record cache miss
   */
  incrementCacheMiss() {
    cacheMisses.inc(1);
  }

  /**
   * Record error
   * @param {Error} error - Error object
   * @param {string} vendor - Vendor name (optional)
   */
  recordError(error, vendor = 'unknown') {
    vendorErrors.inc({
      vendor,
      error_type: this.categorizeError(error)
    }, 1);
  }

  /**
   * Update active connections
   * @param {number} count - Number of active connections
   */
  updateActiveConnections(count) {
    activeConnections.set(count);
  }

  /**
   * Calculate cost for a request (simplified)
   * @param {string} vendor - Vendor name
   * @param {string} model - Model name
   * @param {Object} response - API response
   * @returns {number} - Cost in CNY
   */
  calculateCost(vendor, model, response) {
    // Simplified cost calculation based on token usage
    const usage = response.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || (inputTokens + outputTokens);

    // Cost per 1000 tokens (simplified rates in CNY)
    const rates = {
      openai: {
        'gpt-4': { input: 0.03, output: 0.06 },      // ~$0.01/1K input, $0.02/1K output
        'gpt-4-turbo': { input: 0.01, output: 0.03 }, // ~$0.003/1K input, $0.006/1K output
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 } // ~$0.0005/1K input, $0.0005/1K output
      },
      anthropic: {
        'claude-3-opus': { input: 0.015, output: 0.075 },    // ~$0.005/1K input, $0.025/1K output
        'claude-3-sonnet': { input: 0.003, output: 0.015 },  // ~$0.001/1K input, $0.005/1K output
        'claude-3-haiku': { input: 0.00025, output: 0.00125 } // ~$0.00008/1K input, $0.0004/1K output
      },
      azure: {
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
      }
    };

    const vendorRates = rates[vendor];
    if (!vendorRates) return 0;

    const modelRates = vendorRates[model] || vendorRates['gpt-3.5-turbo']; // fallback

    const inputCost = (inputTokens / 1000) * modelRates.input;
    const outputCost = (outputTokens / 1000) * modelRates.output;

    return inputCost + outputCost;
  }

  /**
   * Categorize error type
   * @param {Error} error - Error object
   * @returns {string} - Error category
   */
  categorizeError(error) {
    if (error.message.includes('timeout')) {
      return 'timeout';
    } else if (error.message.includes('rate limit')) {
      return 'rate_limit';
    } else if (error.message.includes('authentication')) {
      return 'auth';
    } else if (error.message.includes('network')) {
      return 'network';
    } else {
      return 'other';
    }
  }

  /**
   * Get metrics in Prometheus format
   * @returns {string} - Metrics string
   */
  async getMetrics() {
    try {
      return await register.metrics();
    } catch (error) {
      logger.error('Error getting metrics', error);
      return '# Error collecting metrics\n';
    }
  }

  /**
   * Get metrics summary for dashboard
   * @returns {Object} - Metrics summary
   */
  async getMetricsSummary() {
    try {
      const metrics = await register.getMetricsAsJSON();

      const summary = {
        totalRequests: 0,
        cacheHitRate: 0,
        avgResponseTime: 0,
        totalCost: 0,
        vendorStats: {},
        timestamp: new Date().toISOString()
      };

      metrics.forEach(metric => {
        switch (metric.name) {
          case 'api_gateway_requests_total':
            metric.values.forEach(value => {
              summary.totalRequests += value.value;
            });
            break;

          case 'api_gateway_cache_hits_total':
            const cacheHits = metric.values[0]?.value || 0;
            const cacheMissesMetric = metrics.find(m => m.name === 'api_gateway_cache_misses_total');
            const cacheMisses = cacheMissesMetric?.values[0]?.value || 0;
            const totalCacheRequests = cacheHits + cacheMisses;
            summary.cacheHitRate = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests * 100).toFixed(2) : 0;
            break;

          case 'api_gateway_request_duration_seconds':
            // Calculate average response time
            let totalTime = 0;
            let totalCount = 0;
            metric.values.forEach(value => {
              if (value.metricName === 'api_gateway_request_duration_seconds_sum') {
                totalTime += value.value;
              }
              if (value.metricName === 'api_gateway_request_duration_seconds_count') {
                totalCount += value.value;
              }
            });
            summary.avgResponseTime = totalCount > 0 ? (totalTime / totalCount * 1000).toFixed(2) : 0; // Convert to ms
            break;

          case 'api_gateway_cost_total':
            metric.values.forEach(value => {
              summary.totalCost += value.value;
            });
            break;

          case 'api_gateway_vendor_requests_total':
            metric.values.forEach(value => {
              const vendor = value.labels.vendor;
              const status = value.labels.status;
              if (!summary.vendorStats[vendor]) {
                summary.vendorStats[vendor] = { total: 0, success: 0, errors: 0 };
              }
              summary.vendorStats[vendor].total += value.value;
              if (status === '200') {
                summary.vendorStats[vendor].success += value.value;
              } else {
                summary.vendorStats[vendor].errors += value.value;
              }
            });
            break;
        }
      });

      // Calculate success rates
      Object.keys(summary.vendorStats).forEach(vendor => {
        const stats = summary.vendorStats[vendor];
        stats.successRate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(2) : 0;
      });

      return summary;
    } catch (error) {
      logger.error('Error getting metrics summary', error);
      return { error: error.message };
    }
  }
}

// Create singleton instance
const metricsService = new MetricsService();

module.exports = metricsService;
