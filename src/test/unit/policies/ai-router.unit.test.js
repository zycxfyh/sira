/**
 * AI路由器策略 - 基础配置测试
 * 只测试配置验证和基本初始化，避免复杂的运行时逻辑
 */

const { expect } = require('@jest/globals');
const { policy: aiRouter } = require('../../../core/policies/ai-router');

describe('AI Router Policy - Configuration Tests', () => {
  afterAll(() => {
    // 清理全局资源，避免测试结束后仍有未关闭的异步操作
    if (global.usageAnalytics && global.usageAnalytics.cleanup) {
      global.usageAnalytics.cleanup();
    }
    if (global.parameterManager && global.parameterManager.cleanup) {
      global.parameterManager.cleanup();
    }
    if (global.apiKeyManager && global.apiKeyManager.cleanup) {
      global.apiKeyManager.cleanup();
    }
  });

  test('AI Router should be a function', () => {
    expect(typeof aiRouter).toBe('function');
  });

  test('AI Router should validate missing serviceEndpoints', () => {
    expect(() => aiRouter({}, {})).toThrow('AI路由器配置缺少必需属性: serviceEndpoints');
  });

  test('AI Router should validate empty config', () => {
    expect(() => aiRouter({}, null)).toThrow('AI路由器需要配置对象');
  });

  test('AI Router should validate empty params', () => {
    const config = {
      logger: console,
      serviceEndpoints: {
        openai: { url: 'https://api.openai.com/v1' },
      },
    };
    expect(() => aiRouter(null, config)).toThrow('AI路由器需要配置参数');
  });

  test('AI Router should return a function with valid config', () => {
    const config = {
      logger: console,
      serviceEndpoints: {
        openai: { url: 'https://api.openai.com/v1' },
      },
    };
    const policy = aiRouter({}, config);
    expect(typeof policy).toBe('function');
  });

  test('Returned policy function should be async', () => {
    const config = {
      logger: console,
      serviceEndpoints: {
        openai: { url: 'https://api.openai.com/v1' },
      },
    };
    const policy = aiRouter({}, config);
    expect(policy.constructor.name).toBe('AsyncFunction');
  });
});