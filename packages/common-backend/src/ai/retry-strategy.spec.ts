import { z } from 'zod';
import {
  calculateRetryDelay,
  classifyError,
  DEFAULT_RETRY_CONFIG,
  delay,
  ErrorCategory,
  getRecommendedDelay,
} from './retry-strategy';

describe('retry-strategy', () => {
  describe('classifyError', () => {
    it('should classify network errors as retryable', () => {
      const error = new Error('ECONNREFUSED');
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.NETWORK);
      expect(classification.shouldRetry).toBe(true);
    });

    it('should classify timeout errors as retryable', () => {
      const error = new Error('ETIMEDOUT');
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.NETWORK);
      expect(classification.shouldRetry).toBe(true);
    });

    it('should classify 429 rate limit errors as retryable', () => {
      const error = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
      });
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.TEMPORARY_API_ERROR);
      expect(classification.shouldRetry).toBe(true);
    });

    it('should classify 503 errors as retryable', () => {
      const error = Object.assign(new Error('Service unavailable'), {
        statusCode: 503,
      });
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.TEMPORARY_API_ERROR);
      expect(classification.shouldRetry).toBe(true);
    });

    it('should classify 401/403 errors as non-retryable', () => {
      const error401 = Object.assign(new Error('Unauthorized'), {
        status: 401,
      });
      const classification401 = classifyError(error401);
      expect(classification401.category).toBe(ErrorCategory.AUTHENTICATION_ERROR);
      expect(classification401.shouldRetry).toBe(false);

      const error403 = Object.assign(new Error('Forbidden'), { status: 403 });
      const classification403 = classifyError(error403);
      expect(classification403.category).toBe(ErrorCategory.AUTHENTICATION_ERROR);
      expect(classification403.shouldRetry).toBe(false);
    });

    it('should classify 400 errors as non-retryable', () => {
      const error = Object.assign(new Error('Bad request'), { status: 400 });
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.INVALID_REQUEST);
      expect(classification.shouldRetry).toBe(false);
    });

    it('should classify Zod validation errors as retryable with feedback', () => {
      const schema = z.object({ name: z.string() });
      const result = schema.safeParse({});
      expect(result.success).toBe(false);

      if (!result.success) {
        const classification = classifyError(result.error, 'Field name is required');
        expect(classification.category).toBe(ErrorCategory.VALIDATION_ERROR);
        expect(classification.shouldRetry).toBe(true);
        expect(classification.hasFeedback).toBe(true);
        expect(classification.feedback).toBeDefined();
      }
    });

    it('should classify JSON parse errors as retryable', () => {
      const error = new SyntaxError('Unexpected token in JSON');
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.JSON_PARSE_ERROR);
      expect(classification.shouldRetry).toBe(true);
    });

    it('should classify unknown errors as retryable (conservative)', () => {
      const error = new Error('Some unknown error');
      const classification = classifyError(error);
      expect(classification.category).toBe(ErrorCategory.UNKNOWN);
      expect(classification.shouldRetry).toBe(true);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, enableJitter: false };

      expect(calculateRetryDelay(0, config)).toBe(500); // 500 * 2^0
      expect(calculateRetryDelay(1, config)).toBe(1000); // 500 * 2^1
      expect(calculateRetryDelay(2, config)).toBe(2000); // 500 * 2^2
      expect(calculateRetryDelay(3, config)).toBe(4000); // 500 * 2^3
    });

    it('should cap delay at maxDelayMs', () => {
      const config = {
        ...DEFAULT_RETRY_CONFIG,
        maxDelayMs: 1000,
        enableJitter: false,
      };

      expect(calculateRetryDelay(0, config)).toBe(500);
      expect(calculateRetryDelay(1, config)).toBe(1000);
      expect(calculateRetryDelay(10, config)).toBe(1000); // Capped
    });

    it('should apply jitter when enabled', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, enableJitter: true };
      const delayMs = calculateRetryDelay(1, config);

      // Jitter should add randomness (though exact values are random)
      expect(delayMs).toBeGreaterThan(0);
      expect(delayMs).toBeLessThanOrEqual(1200); // 1000 * 1.2 (max with 20% jitter)

      // Verify multiple calls produce different values (due to jitter)
      const delays = Array.from({ length: 5 }, () => calculateRetryDelay(1, config));
      const uniqueDelays = new Set(delays);
      // At least some values should be different (jitter adds randomness)
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should never return negative delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, enableJitter: true };

      for (let i = 0; i < 10; i++) {
        const delayMs = calculateRetryDelay(i, config);
        expect(delayMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getRecommendedDelay', () => {
    it('should use longer delay for rate limit errors', () => {
      const rateLimitDelay = getRecommendedDelay(
        ErrorCategory.TEMPORARY_API_ERROR,
        0,
        DEFAULT_RETRY_CONFIG,
      );
      const networkDelay = getRecommendedDelay(ErrorCategory.NETWORK, 0, DEFAULT_RETRY_CONFIG);

      // Rate limit should have longer initial delay (2000 vs 500)
      expect(rateLimitDelay).toBeGreaterThan(networkDelay);
    });

    it('should use shorter delay for validation errors', () => {
      const validationDelay = getRecommendedDelay(
        ErrorCategory.VALIDATION_ERROR,
        0,
        DEFAULT_RETRY_CONFIG,
      );
      const networkDelay = getRecommendedDelay(ErrorCategory.NETWORK, 0, DEFAULT_RETRY_CONFIG);

      // Validation errors should have shorter delay (200 vs 500)
      expect(validationDelay).toBeLessThan(networkDelay);
    });

    it('should use standard delay for network errors', () => {
      const delayMs = getRecommendedDelay(ErrorCategory.NETWORK, 0, DEFAULT_RETRY_CONFIG);

      // With jitter enabled, delay can range from 400ms to 600ms (±20% of 500ms)
      expect(delayMs).toBeGreaterThanOrEqual(400);
      expect(delayMs).toBeLessThanOrEqual(600);
    });
  });

  describe('delay', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await delay(100);
      const elapsed = Date.now() - start;

      // Should be at least 100ms (may be slightly more due to scheduling)
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(150); // Allow some overhead
    });
  });
});
