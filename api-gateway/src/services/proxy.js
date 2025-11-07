const axios = require('axios');
const config = require('../../config/default');
const logger = require('../utils/logger');
const router = require('./router');

class ProxyService {
  constructor() {
    this.httpClient = axios.create({
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Call vendor API
   * @param {string} vendor - Vendor name
   * @param {Object} requestBody - Request body
   * @returns {Object} - API response
   */
  async callVendor(vendor, requestBody) {
    const startTime = Date.now();
    let success = false;

    try {
      const vendorConfig = config.vendors[vendor];
      if (!vendorConfig) {
        throw new Error(`Unknown vendor: ${vendor}`);
      }

      const requestConfig = this.buildRequestConfig(vendor, vendorConfig, requestBody);
      logger.debug('Making API call', { vendor, url: requestConfig.url, model: requestBody.model });

      const response = await this.httpClient.request(requestConfig);

      success = true;
      const responseTime = Date.now() - startTime;

      logger.info('API call successful', {
        vendor,
        model: requestBody.model,
        responseTime,
        statusCode: response.status
      });

      // Record vendor performance
      router.recordVendorPerformance(vendor, true, responseTime);

      return response.data;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error('API call failed', {
        vendor,
        model: requestBody.model,
        responseTime,
        error: error.message,
        statusCode: error.response?.status,
        responseData: error.response?.data
      });

      // Record vendor performance
      router.recordVendorPerformance(vendor, false, responseTime);

      // Throw a more user-friendly error
      throw this.handleApiError(error, vendor);
    }
  }

  /**
   * Build request configuration for different vendors
   * @param {string} vendor - Vendor name
   * @param {Object} vendorConfig - Vendor configuration
   * @param {Object} requestBody - Request body
   * @returns {Object} - Axios request configuration
   */
  buildRequestConfig(vendor, vendorConfig, requestBody) {
    const baseConfig = {
      method: 'POST',
      data: requestBody,
    };

    switch (vendor) {
      case 'openai':
        return {
          ...baseConfig,
          url: `${vendorConfig.baseUrl}/chat/completions`,
          headers: {
            'Authorization': `Bearer ${vendorConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        };

      case 'anthropic':
        return {
          ...baseConfig,
          url: `${vendorConfig.baseUrl}/messages`,
          headers: {
            'x-api-key': vendorConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          data: this.transformAnthropicRequest(requestBody),
        };

      case 'azure':
        const deploymentName = this.getAzureDeploymentName(requestBody.model);
        return {
          ...baseConfig,
          url: `${vendorConfig.endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2023-12-01`,
          headers: {
            'api-key': vendorConfig.apiKey,
            'Content-Type': 'application/json',
          },
        };

      default:
        throw new Error(`Unsupported vendor: ${vendor}`);
    }
  }

  /**
   * Transform OpenAI format to Anthropic format
   * @param {Object} requestBody - OpenAI format request
   * @returns {Object} - Anthropic format request
   */
  transformAnthropicRequest(requestBody) {
    // Convert OpenAI chat format to Anthropic messages format
    const messages = requestBody.messages || [];

    // For Anthropic, we need to separate system message from user messages
    let systemMessage = '';
    const chatMessages = [];

    messages.forEach(message => {
      if (message.role === 'system') {
        systemMessage = message.content;
      } else {
        chatMessages.push({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.content
        });
      }
    });

    return {
      model: this.mapAnthropicModel(requestBody.model),
      max_tokens: requestBody.max_tokens || 4096,
      system: systemMessage,
      messages: chatMessages,
      temperature: requestBody.temperature,
      top_p: requestBody.top_p,
      stream: requestBody.stream || false
    };
  }

  /**
   * Transform Anthropic response to OpenAI format
   * @param {Object} anthropicResponse - Anthropic response
   * @returns {Object} - OpenAI format response
   */
  transformAnthropicResponse(anthropicResponse) {
    return {
      id: anthropicResponse.id || `anthropic-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: anthropicResponse.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: anthropicResponse.content?.[0]?.text || ''
        },
        finish_reason: anthropicResponse.stop_reason || 'stop'
      }],
      usage: {
        prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
        completion_tokens: anthropicResponse.usage?.output_tokens || 0,
        total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * Map model names to Anthropic equivalents
   * @param {string} model - Model name
   * @returns {string} - Anthropic model name
   */
  mapAnthropicModel(model) {
    const modelMap = {
      'claude-3-opus': 'claude-3-opus-20240229',
      'claude-3-sonnet': 'claude-3-sonnet-20240229',
      'claude-3-haiku': 'claude-3-haiku-20240307',
      'claude-2': 'claude-2.1',
      'claude-instant-1': 'claude-instant-1.2'
    };

    return modelMap[model] || model;
  }

  /**
   * Get Azure deployment name from model
   * @param {string} model - Model name
   * @returns {string} - Azure deployment name
   */
  getAzureDeploymentName(model) {
    // In Azure OpenAI, deployment names are customizable
    // This is a simplified mapping
    const deploymentMap = {
      'gpt-4': 'gpt-4',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt-4-turbo-preview': 'gpt-4-turbo-preview',
      'gpt-3.5-turbo': 'gpt-35-turbo',
      'gpt-3.5-turbo-16k': 'gpt-35-turbo-16k'
    };

    return deploymentMap[model] || model.replace(/\./g, '-');
  }

  /**
   * Handle and transform API errors
   * @param {Error} error - Axios error
   * @param {string} vendor - Vendor name
   * @returns {Error} - Transformed error
   */
  handleApiError(error, vendor) {
    if (error.response) {
      // API returned an error response
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          return new Error(`Authentication failed for ${vendor}: Invalid API key`);
        case 403:
          return new Error(`Access forbidden for ${vendor}: Check API key permissions`);
        case 429:
          return new Error(`Rate limit exceeded for ${vendor}: Please retry later`);
        case 500:
        case 502:
        case 503:
          return new Error(`Server error from ${vendor}: ${data?.error?.message || 'Internal server error'}`);
        default:
          return new Error(`API error from ${vendor} (${status}): ${data?.error?.message || error.message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      return new Error(`Timeout error from ${vendor}: Request took too long`);
    } else {
      return new Error(`Network error connecting to ${vendor}: ${error.message}`);
    }
  }

  /**
   * Transform response if needed (for Anthropic)
   * @param {string} vendor - Vendor name
   * @param {Object} response - Raw response
   * @returns {Object} - Transformed response
   */
  transformResponse(vendor, response) {
    if (vendor === 'anthropic') {
      return this.transformAnthropicResponse(response);
    }
    return response;
  }
}

// Create singleton instance
const proxyService = new ProxyService();

module.exports = proxyService;
