#!/usr/bin/env node

/**
 * Mock AI Server for Testing
 * Simulates OpenAI, Anthropic, and Azure AI responses
 */

const express = require("express");
const app = express();
const PORT = 3002;

app.use(express.json());

// Mock OpenAI API
app.post("/v1/chat/completions", (req, res) => {
  const { model, messages, temperature, max_tokens } = req.body;

  // Simulate processing delay
  setTimeout(
    () => {
      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model || "gpt-3.5-turbo",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: `Mock response from ${model}: "${messages[messages.length - 1].content}"`,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 30,
          total_tokens: 50,
        },
      };

      res.json(response);
    },
    Math.random() * 500 + 100,
  ); // Random delay 100-600ms
});

// Mock Anthropic API
app.post("/v1/messages", (req, res) => {
  const { model, messages, temperature, max_tokens } = req.body;

  setTimeout(
    () => {
      const response = {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        content: [
          {
            type: "text",
            text: `Mock response from ${model}: "${messages[messages.length - 1].content}"`,
          },
        ],
        model: model || "claude-3-haiku-20240307",
        usage: {
          input_tokens: 15,
          output_tokens: 25,
        },
      };

      res.json(response);
    },
    Math.random() * 300 + 150,
  ); // Random delay 150-450ms
});

// Mock Azure OpenAI API
app.post("/openai/deployments/:deployment/chat/completions", (req, res) => {
  const { messages, temperature, max_tokens } = req.body;
  const { deployment } = req.params;

  setTimeout(
    () => {
      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: deployment,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: `Mock Azure response from ${deployment}: "${messages[messages.length - 1].content}"`,
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 18,
          completion_tokens: 28,
          total_tokens: 46,
        },
      };

      res.json(response);
    },
    Math.random() * 400 + 200,
  ); // Random delay 200-600ms
});

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "mock-ai-server",
    timestamp: new Date().toISOString(),
  });
});

// Error simulation endpoint (for testing circuit breaker)
app.post("/error/:type", (req, res) => {
  const errorType = req.params.type;

  switch (errorType) {
    case "timeout":
      // Simulate timeout
      setTimeout(() => {
        res.status(200).json({ error: "timeout simulation" });
      }, 35000); // 35 seconds
      break;
    case "rate-limit":
      res.status(429).json({
        error: {
          message: "Rate limit exceeded",
          type: "rate_limit_error",
        },
      });
      break;
    case "server-error":
      res.status(500).json({
        error: {
          message: "Internal server error",
          type: "server_error",
        },
      });
      break;
    default:
      res.status(400).json({
        error: {
          message: "Unknown error type",
          type: "invalid_request",
        },
      });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Mock AI Server running on http://localhost:${PORT}`);
  console.log("📋 Available endpoints:");
  console.log("   POST /v1/chat/completions - OpenAI API");
  console.log("   POST /v1/messages - Anthropic API");
  console.log(
    "   POST /openai/deployments/:deployment/chat/completions - Azure OpenAI API",
  );
  console.log("   GET /health - Health check");
  console.log("   POST /error/:type - Error simulation");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 Mock AI Server shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Mock AI Server shutting down...");
  process.exit(0);
});
