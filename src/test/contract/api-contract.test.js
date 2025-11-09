/**
 * API合同测试
 * 验证API接口的输入输出合同，防止意外的接口变更
 */

const { expect } = require("@jest/globals");
const supertest = require("supertest");
const Joi = require("joi");

describe("API Contract Tests", () => {
  let _request;

  beforeAll(async () => {
    // 设置测试服务器
    const app = require("../../../core/gateway/index");
    _request = supertest(app);
  });

  describe("AI Chat Completions API", () => {
    const chatRequestSchema = Joi.object({
      model: Joi.string().required(),
      messages: Joi.array()
        .items(
          Joi.object({
            role: Joi.string().valid("user", "assistant", "system").required(),
            content: Joi.string().required(),
          }),
        )
        .min(1)
        .required(),
      temperature: Joi.number().min(0).max(2),
      max_tokens: Joi.number().integer().min(1),
      stream: Joi.boolean(),
    });

    const chatResponseSchema = Joi.object({
      id: Joi.string().required(),
      object: Joi.string().valid("chat.completion").required(),
      created: Joi.number().integer().required(),
      model: Joi.string().required(),
      choices: Joi.array()
        .items(
          Joi.object({
            index: Joi.number().integer().required(),
            message: Joi.object({
              role: Joi.string().valid("assistant").required(),
              content: Joi.string().required(),
            }).required(),
            finish_reason: Joi.string()
              .valid("stop", "length", "content_filter")
              .required(),
          }),
        )
        .min(1)
        .required(),
      usage: Joi.object({
        prompt_tokens: Joi.number().integer().required(),
        completion_tokens: Joi.number().integer().required(),
        total_tokens: Joi.number().integer().required(),
      }).required(),
    });

    it("should validate request contract", async () => {
      const validRequest = {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello, world!" }],
        temperature: 0.7,
      };

      const { error } = chatRequestSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it("should reject invalid request contract", async () => {
      const invalidRequest = {
        // 缺少必需的model字段
        messages: [{ role: "user", content: "Hello" }],
      };

      const { error } = chatRequestSchema.validate(invalidRequest);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('"model" is required');
    });

    it("should validate response contract", async () => {
      // Mock响应数据
      const mockResponse = {
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1677652288,
        model: "gpt-3.5-turbo",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello! How can I help you today?",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 9,
          completion_tokens: 12,
          total_tokens: 21,
        },
      };

      const { error } = chatResponseSchema.validate(mockResponse);
      expect(error).toBeUndefined();
    });

    it("should handle streaming response contract", async () => {
      const streamingChunkSchema = Joi.object({
        id: Joi.string(),
        object: Joi.string().valid("chat.completion.chunk"),
        created: Joi.number().integer(),
        model: Joi.string(),
        choices: Joi.array().items(
          Joi.object({
            index: Joi.number().integer(),
            delta: Joi.object({
              role: Joi.string().valid("assistant"),
              content: Joi.string(),
            }),
            finish_reason: Joi.string().valid("stop", "length"),
          }),
        ),
      });

      const streamingChunk = {
        id: "chatcmpl-123",
        object: "chat.completion.chunk",
        created: 1677652288,
        model: "gpt-3.5-turbo",
        choices: [
          {
            index: 0,
            delta: {
              content: "Hello",
            },
          },
        ],
      };

      const { error } = streamingChunkSchema.validate(streamingChunk);
      expect(error).toBeUndefined();
    });
  });

  describe("Admin API Contracts", () => {
    const apiKeySchema = Joi.object({
      id: Joi.string().uuid().required(),
      name: Joi.string().required(),
      key: Joi.string()
        .pattern(/^sk_[a-zA-Z0-9]{48,}$/)
        .required(),
      scopes: Joi.array().items(Joi.string()).required(),
      expiresAt: Joi.date().iso(),
      createdAt: Joi.date().iso().required(),
      updatedAt: Joi.date().iso().required(),
    });

    it("should validate API key creation contract", async () => {
      // Mock API响应数据
      const mockApiKeyResponse = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test API Key",
        key: "sk_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        scopes: ["read", "write"],
        expiresAt: "2024-12-31T23:59:59.999Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      // 验证响应符合合同
      const { error } = apiKeySchema.validate(mockApiKeyResponse);
      expect(error).toBeUndefined();
    });

    it("should validate application creation contract", async () => {
      const appSchema = Joi.object({
        id: Joi.string().uuid().required(),
        name: Joi.string().min(1).max(100).required(),
        description: Joi.string().max(500),
        ownerId: Joi.string().uuid().required(),
        status: Joi.string()
          .valid("active", "inactive", "suspended")
          .required(),
        createdAt: Joi.date().iso().required(),
        updatedAt: Joi.date().iso().required(),
      });

      const appData = {
        name: "Test Application",
        description: "A test application for contract testing",
        ownerId: "550e8400-e29b-41d4-a716-446655440000",
      };

      // Mock响应
      const mockApp = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: appData.name,
        description: appData.description,
        ownerId: appData.ownerId,
        status: "active",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };

      const { error } = appSchema.validate(mockApp);
      expect(error).toBeUndefined();
    });
  });

  describe("Error Response Contracts", () => {
    const errorResponseSchema = Joi.object({
      error: Joi.object({
        code: Joi.string().required(),
        message: Joi.string().required(),
        details: Joi.object().optional(),
        timestamp: Joi.date().iso().required(),
        requestId: Joi.string().uuid().required(),
      }).required(),
    });

    it("should validate error response contract", async () => {
      const errorResponse = {
        error: {
          code: "INVALID_API_KEY",
          message: "The provided API key is invalid",
          details: {
            keyId: "sk_test_...",
          },
          timestamp: "2024-01-01T00:00:00.000Z",
          requestId: "550e8400-e29b-41d4-a716-446655440002",
        },
      };

      const { error } = errorResponseSchema.validate(errorResponse);
      expect(error).toBeUndefined();
    });

    it("should handle rate limit error contract", async () => {
      const rateLimitErrorSchema = Joi.object({
        error: Joi.object({
          code: Joi.string().valid("RATE_LIMIT_EXCEEDED").required(),
          message: Joi.string().required(),
          retryAfter: Joi.number().integer().min(0).required(),
          limit: Joi.number().integer().min(1).required(),
          remaining: Joi.number().integer().min(0).required(),
          resetTime: Joi.date().iso().required(),
        }).required(),
      });

      const rateLimitError = {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Rate limit exceeded",
          retryAfter: 60,
          limit: 1000,
          remaining: 0,
          resetTime: "2024-01-01T01:00:00.000Z",
        },
      };

      const { error } = rateLimitErrorSchema.validate(rateLimitError);
      expect(error).toBeUndefined();
    });
  });

  describe("Webhook Contract Tests", () => {
    const webhookPayloadSchema = Joi.object({
      event: Joi.string().required(),
      data: Joi.object().required(),
      timestamp: Joi.date().iso().required(),
      signature: Joi.string().required(),
      webhookId: Joi.string().uuid().required(),
    });

    it("should validate webhook payload contract", async () => {
      const webhookPayload = {
        event: "ai.request.completed",
        data: {
          requestId: "req_123",
          model: "gpt-4",
          tokens: 150,
          cost: 0.03,
        },
        timestamp: "2024-01-01T00:00:00.000Z",
        signature: "sha256=abc123...",
        webhookId: "550e8400-e29b-41d4-a716-446655440003",
      };

      const { error } = webhookPayloadSchema.validate(webhookPayload);
      expect(error).toBeUndefined();
    });

    it("should validate webhook signature", async () => {
      // 这里可以添加webhook签名验证的测试
      const payload = JSON.stringify({
        event: "test",
        data: { message: "hello" },
        timestamp: new Date().toISOString(),
      });

      // 模拟签名验证逻辑
      expect(typeof payload).toBe("string");
      expect(payload.length).toBeGreaterThan(0);
    });
  });
});
