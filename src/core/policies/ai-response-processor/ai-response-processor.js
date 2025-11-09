// AI Response Processor Policy
// 处理AI路由后的响应，统计使用情况、转换响应格式

module.exports = (_params, config) => {
  const logger = config.logger || console;

  // Provider-specific response transformers
  const responseTransformers = {
    openai: (data) => data,
    anthropic: (data) => data,
    google: (data) => data,
    azure: (data) => data,
  };

  // Token usage extractors
  const tokenExtractors = {
    openai: (data) => ({
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    }),
    anthropic: (data) => ({
      prompt: data.usage?.input_tokens || 0,
      completion: data.usage?.output_tokens || 0,
      total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    }),
    google: (data) => ({
      prompt: data.usageMetadata?.promptTokenCount || 0,
      completion: data.usageMetadata?.candidatesTokenCount || 0,
      total: data.usageMetadata?.totalTokenCount || 0,
    }),
    azure: (data) => ({
      prompt: data.usage?.prompt_tokens || 0,
      completion: data.usage?.completion_tokens || 0,
      total: data.usage?.total_tokens || 0,
    }),
  };

  // Cost calculators
  const costCalculators = {
    openai: (model, tokens) => {
      // Simplified pricing (update with actual rates)
      const rates = {
        "gpt-4": { prompt: 0.03, completion: 0.06 },
        "gpt-3.5-turbo": { prompt: 0.0015, completion: 0.002 },
      };
      const rate = rates[model] || rates["gpt-3.5-turbo"];
      return (
        (tokens.prompt * rate.prompt + tokens.completion * rate.completion) /
        1000
      );
    },
    anthropic: (model, tokens) => {
      const rates = {
        "claude-3-opus": { prompt: 15, completion: 75 },
        "claude-3-sonnet": { prompt: 3, completion: 15 },
      };
      const rate = rates[model] || rates["claude-3-sonnet"];
      return (
        (tokens.prompt * rate.prompt + tokens.completion * rate.completion) /
        1000000
      );
    },
    google: (model, tokens) => {
      const rates = {
        "gemini-pro": { prompt: 0.5, completion: 1.5 },
      };
      const rate = rates[model] || rates["gemini-pro"];
      return (
        (tokens.prompt * rate.prompt + tokens.completion * rate.completion) /
        1000
      );
    },
    azure: (model, tokens) => {
      return costCalculators.openai(model, tokens); // Similar to OpenAI
    },
  };

  return function aiResponseProcessor(req, res, next) {
    // Check if this is an AI routing request
    if (!req.egContext?.aiRouting) {
      return next();
    }

    const routingData = req.egContext.aiRouting;
    const { startTime } = routingData;

    // Intercept the response
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    let responseData = null;
    let statusCode = 200;

    // Override response methods to capture data
    res.json = function (data) {
      responseData = data;
      statusCode = res.statusCode || 200;
      return originalJson.call(this, data);
    };

    res.send = function (data) {
      if (typeof data === "object") {
        responseData = data;
      }
      statusCode = res.statusCode || 200;
      return originalSend.call(this, data);
    };

    res.end = function (data) {
      const responseTime = Date.now() - startTime;

      // Process response if we have data
      if (responseData !== null) {
        processResponse(responseData, statusCode, responseTime, routingData);
      }

      return originalEnd.call(this, data);
    };

    // Continue to proxy
    next();
  };

  function processResponse(data, statusCode, responseTime, routingData) {
    const {
      selectedProvider,
      model,
      userId,
      requestId,
      keyId,
      abTestAllocation,
    } = routingData;

    try {
      // Transform response if needed
      const transformer = responseTransformers[selectedProvider] || ((d) => d);
      const transformedResponse = transformer(data);

      // Extract token usage
      const tokenExtractor =
        tokenExtractors[selectedProvider] ||
        (() => ({ prompt: 0, completion: 0, total: 0 }));
      const tokens = tokenExtractor(transformedResponse);

      // Calculate cost
      const costCalculator = costCalculators[selectedProvider] || (() => 0);
      const cost = costCalculator(model, tokens);

      // Record provider performance
      recordProviderPerformance(
        selectedProvider,
        statusCode < 400,
        responseTime,
      );

      // Record API key usage
      if (apiKeyManager && keyId) {
        apiKeyManager.recordKeyUsage(keyId, {
          tokens: tokens.total || 0,
          cost: cost || 0,
          responseTime,
          statusCode,
          timestamp: new Date(),
        });
      }

      // Record usage analytics
      if (usageAnalytics) {
        usageAnalytics.recordRequest({
          userId,
          requestId,
          provider: selectedProvider,
          model,
          tokens: tokens.total || 0,
          cost: cost || 0,
          responseTime,
          statusCode,
          timestamp: new Date(),
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }

      // Record A/B test results
      if (abTestAllocation && abTestManager) {
        const metrics = {
          response_time: responseTime,
          cost: cost || 0,
          quality_score: calculateQualityScore(transformedResponse, model),
          error_count: statusCode >= 400 ? 1 : 0,
        };

        abTestManager
          .recordResult(
            abTestAllocation.testId,
            abTestAllocation.variantId,
            userId,
            metrics,
          )
          .catch((error) => {
            logger.warn("A/B测试结果记录失败", {
              userId,
              requestId,
              testId: abTestAllocation.testId,
              error: error.message,
            });
          });
      }

      // Add custom headers
      res.set({
        "x-ai-provider": selectedProvider,
        "x-ai-model": model,
        "x-response-time": responseTime,
        "x-tokens-used": tokens.total || 0,
        "x-cost": cost || 0,
        "x-request-id": requestId,
      });

      logger.info("AI request processed", {
        requestId,
        userId,
        model,
        provider: selectedProvider,
        responseTime,
        statusCode,
        tokens: tokens.total,
        cost,
      });
    } catch (error) {
      logger.error("Response processing error", {
        requestId,
        userId,
        provider: selectedProvider,
        error: error.message,
      });
    }
  }

  // Helper functions
  function recordProviderPerformance(provider, success, responseTime) {
    // This would integrate with a performance monitoring system
    logger.debug(`Provider performance: ${provider}`, {
      success,
      responseTime,
    });
  }

  function calculateQualityScore(response, _model) {
    // Simple quality scoring based on response characteristics
    if (!response) return 0;

    let score = 0.5; // Base score

    // Check for error responses
    if (response.error) {
      score -= 0.3;
    }

    // Check response length (reasonable responses are usually substantial)
    if (typeof response === "string" && response.length > 10) {
      score += 0.2;
    }

    // Model-specific scoring could be added here

    return Math.max(0, Math.min(1, score));
  }
};
