#!/usr/bin/env node

/**
 * Sira Test Script
 * Tests the AI routing and caching functionality
 */

const axios = require('axios');

const GATEWAY_URL = 'http://localhost:8080';
const API_KEY = 'test-api-key-123';

// Test data
const testRequests = [
  {
    name: 'OpenAI GPT-3.5 Turbo',
    request: {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say hello in 5 words.' },
      ],
      temperature: 0.7,
      max_tokens: 50,
    },
  },
  {
    name: 'Anthropic Claude',
    request: {
      model: 'claude-3-haiku',
      messages: [{ role: 'user', content: 'Write a haiku about coding.' }],
      temperature: 0.7,
      max_tokens: 100,
    },
  },
  {
    name: 'Cache Test (Repeat Request)',
    request: {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say hello in 5 words.' }],
      temperature: 0.7,
      max_tokens: 50,
    },
  },
];

async function testAIEndpoint(testName, requestData) {
  console.log(`\n🧪 Testing: ${testName}`);

  try {
    const startTime = Date.now();

    const response = await axios.post(`${GATEWAY_URL}/api/v1/ai/chat/completions`, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      timeout: 30000,
    });

    const responseTime = Date.now() - startTime;

    console.log(`✅ Status: ${response.status}`);
    console.log(`⏱️  Response Time: ${responseTime}ms`);

    // Check cache headers
    const cacheStatus = response.headers['x-cache-status'];
    const aiProvider = response.headers['x-ai-provider'];
    const aiModel = response.headers['x-ai-model'];

    console.log(`📦 Cache Status: ${cacheStatus || 'N/A'}`);
    console.log(`🤖 AI Provider: ${aiProvider || 'N/A'}`);
    console.log(`🧠 AI Model: ${aiModel || 'N/A'}`);

    if (response.data.choices && response.data.choices[0]) {
      const content = response.data.choices[0].message?.content || 'No content';
      console.log(`💬 Response: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
    }

    return { success: true, responseTime, cacheStatus };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);

    if (error.response) {
      console.log(`📊 Status Code: ${error.response.status}`);
      console.log('📋 Error Details:', error.response.data);
    }

    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Sira Tests');
  console.log('='.repeat(50));

  // Check if gateway is running
  let gatewayRunning = false;
  try {
    await axios.get(`${GATEWAY_URL}/health`, { timeout: 5000 });
    console.log('✅ Gateway is already running');
    gatewayRunning = true;
  } catch (error) {
    console.log('🔄 Gateway not running, starting it for testing...');

    // Start gateway in background
    const { spawn } = require('child_process');
    const gatewayProcess = spawn('node', ['lib/index.js'], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EG_CONFIG_DIR: 'config' },
    });

    // Wait for gateway to start
    let retries = 0;
    const maxRetries = 30; // 30 seconds

    while (retries < maxRetries) {
      try {
        await axios.get(`${GATEWAY_URL}/health`, { timeout: 2000 });
        console.log('✅ Gateway started successfully');
        gatewayRunning = true;
        break;
      } catch (e) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!gatewayRunning) {
      console.log('❌ Failed to start gateway within timeout');
      gatewayProcess.kill();
      process.exit(1);
    }

    // Store process reference for cleanup
    global.gatewayProcess = gatewayProcess;
  }

  const results = [];

  // Run all tests
  for (const test of testRequests) {
    const result = await testAIEndpoint(test.name, test.request);
    results.push({ name: test.name, ...result });

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');

  const successful = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`✅ Successful: ${successful}/${total}`);

  // Cache performance analysis
  const cacheHits = results.filter(r => r.cacheStatus === 'HIT').length;
  const cacheMisses = results.filter(r => r.cacheStatus === 'MISS').length;

  if (cacheHits + cacheMisses > 0) {
    console.log('📦 Cache Performance:');
    console.log(`   Hits: ${cacheHits}, Misses: ${cacheMisses}`);
    console.log(`   Hit Rate: ${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1)}%`);
  }

  // Response time analysis
  const responseTimes = results.filter(r => r.responseTime).map(r => r.responseTime);
  if (responseTimes.length > 0) {
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    console.log('⏱️  Response Times:');
    console.log(`   Average: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`   Range: ${minResponseTime}ms - ${maxResponseTime}ms`);
  }

  console.log('\n🎉 Tests completed!');

  // Cleanup: kill gateway if we started it
  if (global.gatewayProcess) {
    console.log('🧹 Cleaning up: stopping test gateway...');
    global.gatewayProcess.kill('SIGTERM');

    // Wait a bit for graceful shutdown
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Handle command line arguments
if (process.argv[2] === '--help') {
  console.log(`
Sira Test Script

Usage: node test-ai-gateway.js

This script tests the Sira functionality including:
- AI model routing (OpenAI, Anthropic, Azure)
- Intelligent caching
- Response time monitoring
- Error handling

Make sure the gateway is running before running tests:
  cd ai-gateway && npm start

Environment Variables:
  GATEWAY_URL - Gateway URL (default: http://localhost:8080)
  API_KEY - API key for authentication (default: test-api-key-123)
  `);
  process.exit(0);
}

runTests().catch(console.error);
