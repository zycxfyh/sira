#!/usr/bin/env node

/**
 * Smoke Test Script for API Gateway V2
 * Runs basic functionality tests to ensure the service is working
 */

const axios = require('axios');

const BASE_URL = process.env.SMOKE_TEST_URL || 'http://localhost:3000';
const API_KEY = process.env.SMOKE_API_KEY || 'test-api-key';

class SmokeTester {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.results = {
      tests: [],
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  async runAllTests() {
    console.log('🚀 Starting API Gateway V2 Smoke Tests...\n');
    console.log(`📍 Base URL: ${this.baseUrl}`);
    console.log(`🔑 API Key: ${this.apiKey ? '***' + this.apiKey.slice(-4) : 'Not set'}\n`);

    const tests = [
      this.testHealthEndpoint.bind(this),
      this.testMetricsEndpoint.bind(this),
      this.testInvalidApiKey.bind(this),
      this.testChatCompletion.bind(this),
      this.testModelsEndpoint.bind(this)
    ];

    for (const test of tests) {
      await test();
    }

    this.printSummary();
    return this.results.failed === 0;
  }

  async testHealthEndpoint() {
    await this.runTest('Health Check', async () => {
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!response.data.status || response.data.status !== 'healthy') {
        throw new Error('Service is not healthy');
      }

      return response.data;
    });
  }

  async testMetricsEndpoint() {
    await this.runTest('Metrics Endpoint', async () => {
      const response = await axios.get(`${this.baseUrl}/metrics`, {
        timeout: 5000
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!response.data.includes('api_gateway_requests_total')) {
        throw new Error('Metrics endpoint not returning expected data');
      }

      return { metricsLength: response.data.length };
    });
  }

  async testInvalidApiKey() {
    await this.runTest('Invalid API Key Handling', async () => {
      try {
        await axios.post(`${this.baseUrl}/api/v2/chat/completions`, {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Hello' }]
        }, {
          headers: { 'x-api-key': 'invalid-key' },
          timeout: 5000
        });

        throw new Error('Request should have been rejected');
      } catch (error) {
        if (error.response?.status !== 401) {
          throw new Error(`Expected status 401, got ${error.response?.status || 'no response'}`);
        }
      }
    });
  }

  async testChatCompletion() {
    if (!this.apiKey || this.apiKey === 'test-api-key') {
      console.log('⚠️  Skipping chat completion test - no valid API key provided');
      return;
    }

    await this.runTest('Chat Completion', async () => {
      const response = await axios.post(`${this.baseUrl}/api/v2/chat/completions`, {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "Hello, World!" in exactly 2 words.' }],
        temperature: 0,
        max_tokens: 10
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        timeout: 30000
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!response.data.choices || !response.data.choices[0]?.message?.content) {
        throw new Error('Invalid response structure');
      }

      return {
        model: response.data.model,
        tokens: response.data.usage?.total_tokens || 0
      };
    });
  }

  async testModelsEndpoint() {
    await this.runTest('Models Endpoint', async () => {
      const response = await axios.get(`${this.baseUrl}/api/v2/models`, {
        headers: { 'x-api-key': this.apiKey },
        timeout: 5000
      });

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!response.data.data || !Array.isArray(response.data.data)) {
        throw new Error('Invalid models response structure');
      }

      return { modelCount: response.data.data.length };
    });
  }

  async runTest(name, testFunction) {
    this.results.total++;
    const startTime = Date.now();

    try {
      console.log(`🧪 Running: ${name}...`);
      const result = await testFunction();
      const duration = Date.now() - startTime;

      this.results.passed++;
      this.results.tests.push({
        name,
        status: 'PASS',
        duration,
        result
      });

      console.log(`✅ ${name} - PASSED (${duration}ms)`);

    } catch (error) {
      const duration = Date.now() - startTime;

      this.results.failed++;
      this.results.tests.push({
        name,
        status: 'FAIL',
        duration,
        error: error.message
      });

      console.log(`❌ ${name} - FAILED (${duration}ms): ${error.message}`);
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('🧪 SMOKE TEST SUMMARY');
    console.log('='.repeat(50));

    this.results.tests.forEach(test => {
      const status = test.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${test.name} (${test.duration}ms)`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    });

    console.log('\n📊 RESULTS:');
    console.log(`   Total: ${this.results.total}`);
    console.log(`   Passed: ${this.results.passed}`);
    console.log(`   Failed: ${this.results.failed}`);
    console.log(`   Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.failed === 0) {
      console.log('\n🎉 All smoke tests passed! The service appears to be working correctly.');
    } else {
      console.log(`\n⚠️  ${this.results.failed} smoke test(s) failed. Please check the service configuration.`);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const tester = new SmokeTester(BASE_URL, API_KEY);

  try {
    const success = await tester.runAllTests();

    if (!success) {
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Smoke test execution failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SmokeTester;
