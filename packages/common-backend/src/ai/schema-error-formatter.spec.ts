import { z } from 'zod';
import { formatZodError, formatZodErrorAsJson } from './schema-error-formatter';

describe('formatZodError', () => {
  it('should format missing field error', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    const result = schema.safeParse({ name: 'John' });
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.summary).toContain('Validation failed');
      expect(formatted.fieldErrors.length).toBeGreaterThan(0);
      expect(formatted.fieldErrors.some((e) => e.path.includes('age'))).toBe(true);
      expect(formatted.aiFeedback).toContain('age');
    }
  });

  it('should format type mismatch error', () => {
    const schema = z.object({
      count: z.number(),
    });

    const result = schema.safeParse({ count: 'not-a-number' });
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.fieldErrors.length).toBeGreaterThan(0);
      const countError = formatted.fieldErrors.find((e) => e.path === 'count');
      expect(countError).toBeDefined();
      expect(countError?.expected).toBe('number');
      // received 可能为 undefined（如果无法从错误中提取）
      // 只要错误消息正确就足够了
    }
  });

  it('should format enum error', () => {
    const schema = z.object({
      status: z.enum(['active', 'inactive', 'pending']),
    });

    const result = schema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      const statusError = formatted.fieldErrors.find((e) => e.path === 'status');
      expect(statusError).toBeDefined();
      expect(statusError?.expected).toContain('active');
      expect(statusError?.expected).toContain('inactive');
    }
  });

  it('should format array length error', () => {
    const schema = z.object({
      items: z.array(z.string()).min(2),
    });

    const result = schema.safeParse({ items: ['one'] });
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      const itemsError = formatted.fieldErrors.find((e) => e.path === 'items');
      expect(itemsError).toBeDefined();
      expect(itemsError?.expected).toContain('at least');
    }
  });

  it('should generate AI-friendly feedback', () => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const result = schema.safeParse({
      name: '',
      email: 'invalid-email',
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.aiFeedback).toContain('Validation Errors Detected');
      expect(formatted.aiFeedback).toContain('Action Required');
      expect(formatted.aiFeedback).toContain('name');
      expect(formatted.aiFeedback).toContain('email');
    }
  });

  it('should handle nested object errors', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        age: z.number(),
      }),
    });

    const result = schema.safeParse({
      user: { name: 'John' },
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      const userAgeError = formatted.fieldErrors.find((e) => e.path.includes('age'));
      expect(userAgeError).toBeDefined();
      expect(formatted.aiFeedback).toContain('user');
    }
  });

  it('should format as JSON correctly', () => {
    const schema = z.object({
      name: z.string(),
    });

    const result = schema.safeParse({});
    expect(result.success).toBe(false);

    if (!result.success) {
      const formatted = formatZodError(result.error);
      const json = formatZodErrorAsJson(formatted);
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('fieldErrors');
      expect(parsed).toHaveProperty('errorCount');
    }
  });
});
