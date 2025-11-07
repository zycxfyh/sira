const config = require('../../config/default');
const logger = require('../utils/logger');

class RouterService {
  constructor() {
    this.vendorStats = new Map(); // Track vendor performance
    this.initializeVendorStats();
  }

  initializeVendorStats() {
    // Initialize with default stats
    Object.keys(config.vendors).forEach(vendor => {
      this.vendorStats.set(vendor, {
        successCount: 0,
        errorCount: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        lastFailureTime: null,
        isCircuitBreakerOpen: false
      });
    });
  }

  /**
   * Select the best vendor for a given request
   * @param {Object} requestBody - The request body
   * @returns {string} - Selected vendor name
   */
  async selectVendor(requestBody) {
    const model = requestBody.model;
    const availableVendors = this.getVendorsForModel(model);

    if (availableVendors.length === 0) {
      throw new Error(`No vendors available for model: ${model}`);
    }

    // Filter out vendors with circuit breaker open
    const healthyVendors = availableVendors.filter(vendor => {
      const stats = this.vendorStats.get(vendor);
      return !stats.isCircuitBreakerOpen;
    });

    if (healthyVendors.length === 0) {
      logger.warn('All vendors have circuit breaker open, using fallback');
      // Reset circuit breaker for the vendor with oldest failure
      const oldestFailure = availableVendors.reduce((oldest, vendor) => {
        const stats = this.vendorStats.get(vendor);
        if (!oldest || (stats.lastFailureTime && stats.lastFailureTime < oldest.lastFailureTime)) {
          return { vendor, lastFailureTime: stats.lastFailureTime };
        }
        return oldest;
      }, null);

      if (oldestFailure) {
        this.resetCircuitBreaker(oldestFailure.vendor);
        return oldestFailure.vendor;
      }

      // Fallback to first available vendor
      return availableVendors[0];
    }

    // For now, use a simple cost-based routing
    // TODO: Implement more sophisticated routing based on cost, latency, quality
    const selectedVendor = this.selectByCost(healthyVendors, model);

    logger.debug('Vendor selected', { model, selectedVendor, availableVendors: healthyVendors });

    return selectedVendor;
  }

  /**
   * Get vendors that support a specific model
   * @param {string} model - Model name
   * @returns {Array<string>} - Array of vendor names
   */
  getVendorsForModel(model) {
    const modelMappings = {
      // GPT models
      'gpt-4': ['openai', 'azure'],
      'gpt-4-turbo': ['openai', 'azure'],
      'gpt-4-turbo-preview': ['openai', 'azure'],
      'gpt-3.5-turbo': ['openai', 'azure'],
      'gpt-3.5-turbo-16k': ['openai', 'azure'],

      // Claude models
      'claude-3-opus': ['anthropic'],
      'claude-3-sonnet': ['anthropic'],
      'claude-3-haiku': ['anthropic'],
      'claude-2': ['anthropic'],
      'claude-instant-1': ['anthropic']
    };

    return modelMappings[model] || ['openai']; // Default fallback
  }

  /**
   * Select vendor based on cost (cheapest first)
   * @param {Array<string>} vendors - Available vendors
   * @param {string} model - Model name
   * @returns {string} - Selected vendor
   */
  selectByCost(vendors, model) {
    const costs = {
      openai: this.getModelCost('openai', model),
      anthropic: this.getModelCost('anthropic', model),
      azure: this.getModelCost('azure', model)
    };

    let cheapestVendor = vendors[0];
    let lowestCost = costs[cheapestVendor];

    for (const vendor of vendors) {
      if (costs[vendor] < lowestCost) {
        lowestCost = costs[vendor];
        cheapestVendor = vendor;
      }
    }

    return cheapestVendor;
  }

  /**
   * Get cost for a specific model from a vendor
   * @param {string} vendor - Vendor name
   * @param {string} model - Model name
   * @returns {number} - Cost per request
   */
  getModelCost(vendor, model) {
    // Simplified cost calculation
    // In production, this should be more sophisticated
    const vendorConfig = config.vendors[vendor];
    if (!vendorConfig) return Infinity;

    // Model-specific costs
    const modelCosts = {
      openai: {
        'gpt-4': 0.03,
        'gpt-4-turbo': 0.01,
        'gpt-3.5-turbo': 0.002,
        default: 0.002
      },
      anthropic: {
        'claude-3-opus': 0.015,
        'claude-3-sonnet': 0.003,
        'claude-3-haiku': 0.00025,
        default: 0.015
      },
      azure: {
        'gpt-4': 0.03,
        'gpt-4-turbo': 0.01,
        'gpt-3.5-turbo': 0.002,
        default: 0.002
      }
    };

    return modelCosts[vendor]?.[model] || modelCosts[vendor]?.default || vendorConfig.cost;
  }

  /**
   * Record vendor performance metrics
   * @param {string} vendor - Vendor name
   * @param {boolean} success - Whether the request was successful
   * @param {number} responseTime - Response time in milliseconds
   */
  recordVendorPerformance(vendor, success, responseTime) {
    const stats = this.vendorStats.get(vendor) || {
      successCount: 0,
      errorCount: 0,
      totalRequests: 0,
      avgResponseTime: 0,
      lastFailureTime: null,
      isCircuitBreakerOpen: false
    };

    stats.totalRequests++;

    if (success) {
      stats.successCount++;
      // Update average response time
      stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
    } else {
      stats.errorCount++;
      stats.lastFailureTime = Date.now();

      // Circuit breaker logic
      const errorRate = stats.errorCount / stats.totalRequests;
      if (errorRate > 0.5 && stats.totalRequests > 10) {
        stats.isCircuitBreakerOpen = true;
        logger.warn(`Circuit breaker opened for vendor: ${vendor}`, { errorRate, totalRequests: stats.totalRequests });
      }
    }

    this.vendorStats.set(vendor, stats);
  }

  /**
   * Reset circuit breaker for a vendor
   * @param {string} vendor - Vendor name
   */
  resetCircuitBreaker(vendor) {
    const stats = this.vendorStats.get(vendor);
    if (stats) {
      stats.isCircuitBreakerOpen = false;
      stats.errorCount = Math.floor(stats.errorCount * 0.5); // Reduce error count
      logger.info(`Circuit breaker reset for vendor: ${vendor}`);
    }
  }

  /**
   * Get routing statistics
   * @returns {Object} - Routing statistics
   */
  getStats() {
    const stats = {};
    for (const [vendor, vendorStats] of this.vendorStats) {
      stats[vendor] = {
        successCount: vendorStats.successCount,
        errorCount: vendorStats.errorCount,
        totalRequests: vendorStats.totalRequests,
        avgResponseTime: Math.round(vendorStats.avgResponseTime),
        successRate: vendorStats.totalRequests > 0 ?
          (vendorStats.successCount / vendorStats.totalRequests * 100).toFixed(2) + '%' : '0%',
        circuitBreakerOpen: vendorStats.isCircuitBreakerOpen
      };
    }
    return stats;
  }
}

// Create singleton instance
const routerService = new RouterService();

module.exports = routerService;
