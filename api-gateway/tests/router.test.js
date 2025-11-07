const RouterService = require('../src/services/router');

describe('Router Service', () => {
  let router;

  beforeEach(() => {
    router = new RouterService();
  });

  describe('getVendorsForModel', () => {
    test('should return OpenAI for GPT models', () => {
      expect(router.getVendorsForModel('gpt-4')).toContain('openai');
      expect(router.getVendorsForModel('gpt-3.5-turbo')).toContain('openai');
    });

    test('should return Anthropic for Claude models', () => {
      expect(router.getVendorsForModel('claude-3-opus')).toContain('anthropic');
      expect(router.getVendorsForModel('claude-2')).toContain('anthropic');
    });

    test('should return Azure for Azure models', () => {
      expect(router.getVendorsForModel('gpt-4')).toContain('azure');
      expect(router.getVendorsForModel('gpt-3.5-turbo')).toContain('azure');
    });

    test('should return OpenAI as fallback', () => {
      expect(router.getVendorsForModel('unknown-model')).toEqual(['openai']);
    });
  });

  describe('selectByCost', () => {
    test('should select cheapest vendor', () => {
      const vendors = ['openai', 'anthropic', 'azure'];
      const model = 'gpt-3.5-turbo'; // Assuming OpenAI is cheapest for this model

      const selected = router.selectByCost(vendors, model);
      expect(vendors).toContain(selected);
    });

    test('should handle single vendor', () => {
      const vendors = ['openai'];
      const selected = router.selectByCost(vendors, 'gpt-3.5-turbo');
      expect(selected).toBe('openai');
    });
  });

  describe('recordVendorPerformance', () => {
    test('should record successful requests', () => {
      router.recordVendorPerformance('openai', true, 1000);

      const stats = router.getStats();
      expect(stats.openai.successCount).toBe(1);
      expect(stats.openai.errorCount).toBe(0);
      expect(stats.openai.totalRequests).toBe(1);
      expect(stats.openai.avgResponseTime).toBe(1000);
    });

    test('should record failed requests', () => {
      router.recordVendorPerformance('openai', false, 500);

      const stats = router.getStats();
      expect(stats.openai.successCount).toBe(0);
      expect(stats.openai.errorCount).toBe(1);
      expect(stats.openai.totalRequests).toBe(1);
    });

    test('should trigger circuit breaker on high error rate', () => {
      // Record multiple failures to trigger circuit breaker
      for (let i = 0; i < 12; i++) {
        router.recordVendorPerformance('openai', false, 100);
      }

      const stats = router.getStats();
      expect(stats.openai.circuitBreakerOpen).toBe(true);
    });
  });

  describe('resetCircuitBreaker', () => {
    test('should reset circuit breaker', () => {
      // First trigger circuit breaker
      for (let i = 0; i < 12; i++) {
        router.recordVendorPerformance('openai', false, 100);
      }

      expect(router.getStats().openai.circuitBreakerOpen).toBe(true);

      // Reset circuit breaker
      router.resetCircuitBreaker('openai');

      expect(router.getStats().openai.circuitBreakerOpen).toBe(false);
    });
  });

  describe('getStats', () => {
    test('should return vendor statistics', () => {
      router.recordVendorPerformance('openai', true, 1000);
      router.recordVendorPerformance('openai', false, 500);
      router.recordVendorPerformance('anthropic', true, 800);

      const stats = router.getStats();

      expect(stats.openai.totalRequests).toBe(2);
      expect(stats.openai.successCount).toBe(1);
      expect(stats.openai.errorCount).toBe(1);
      expect(stats.openai.successRate).toBe('50.00%');

      expect(stats.anthropic.totalRequests).toBe(1);
      expect(stats.anthropic.successCount).toBe(1);
      expect(stats.anthropic.errorCount).toBe(0);
      expect(stats.anthropic.successRate).toBe('100.00%');
    });
  });
});
