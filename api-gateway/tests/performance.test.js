const { performance } = require('perf_hooks');

/**
 * Performance Test Suite for API Gateway
 * Run with: node tests/performance.test.js
 */

class PerformanceTest {
  constructor(baseUrl = 'http://localhost:3000', apiKey = 'test-key') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      throughput: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0
    };
  }

  async makeRequest(model = 'gpt-3.5-turbo', message = 'Hello, world!') {
    const startTime = performance.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: message }],
          temperature: 0.7,
          max_tokens: 100
        })
      });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.totalRequests++;
      this.results.responseTimes.push(responseTime);

      if (response.ok) {
        this.results.successfulRequests++;
        return { success: true, responseTime, status: response.status };
      } else {
        this.results.failedRequests++;
        const errorText = await response.text();
        this.results.errors.push({
          status: response.status,
          message: errorText,
          responseTime
        });
        return { success: false, responseTime, status: response.status, error: errorText };
      }
    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      this.results.totalRequests++;
      this.results.failedRequests++;
      this.results.responseTimes.push(responseTime);
      this.results.errors.push({
        error: error.message,
        responseTime
      });

      return { success: false, responseTime, error: error.message };
    }
  }

  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  generateReport() {
    const totalTime = this.results.responseTimes.reduce((a, b) => a + b, 0);
    const avgResponseTime = totalTime / this.results.responseTimes.length;

    this.results.averageResponseTime = avgResponseTime;
    this.results.p95ResponseTime = this.calculatePercentile(this.results.responseTimes, 95);
    this.results.p99ResponseTime = this.calculatePercentile(this.results.responseTimes, 99);
    this.results.errorRate = (this.results.failedRequests / this.results.totalRequests) * 100;

    return this.results;
  }

  printReport() {
    const report = this.generateReport();

    console.log('\n=== API Gateway Performance Test Report ===');
    console.log(`Total Requests: ${report.totalRequests}`);
    console.log(`Successful Requests: ${report.successfulRequests}`);
    console.log(`Failed Requests: ${report.failedRequests}`);
    console.log(`Error Rate: ${report.errorRate.toFixed(2)}%`);
    console.log(`Average Response Time: ${report.averageResponseTime.toFixed(2)}ms`);
    console.log(`P95 Response Time: ${report.p95ResponseTime.toFixed(2)}ms`);
    console.log(`P99 Response Time: ${report.p99ResponseTime.toFixed(2)}ms`);

    if (report.errors.length > 0) {
      console.log('\n=== Error Summary ===');
      const errorGroups = report.errors.reduce((acc, error) => {
        const key = error.status || error.error;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      Object.entries(errorGroups).forEach(([error, count]) => {
        console.log(`${error}: ${count} times`);
      });
    }
  }

  async runLoadTest(concurrentUsers = 10, requestsPerUser = 10, delayBetweenRequests = 100) {
    console.log(`Starting load test: ${concurrentUsers} users, ${requestsPerUser} requests each`);

    const startTime = performance.now();
    const promises = [];

    for (let user = 0; user < concurrentUsers; user++) {
      promises.push(this.runUserSimulation(user, requestsPerUser, delayBetweenRequests));
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const totalTimeSeconds = (endTime - startTime) / 1000;
    this.results.throughput = this.results.totalRequests / totalTimeSeconds;

    console.log(`\nLoad test completed in ${totalTimeSeconds.toFixed(2)} seconds`);
    console.log(`Throughput: ${this.results.throughput.toFixed(2)} requests/second`);
  }

  async runUserSimulation(userId, requestCount, delay) {
    for (let i = 0; i < requestCount; i++) {
      await this.makeRequest('gpt-3.5-turbo', `User ${userId} - Request ${i}`);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async runCacheTest() {
    console.log('Running cache performance test...');

    // First request (cache miss)
    console.log('First request (should be cache miss):');
    await this.makeRequest('gpt-3.5-turbo', 'Cache test message');

    // Wait a bit for cache to be set
    await new Promise(resolve => setTimeout(resolve, 100));

    // Second request with same message (should be cache hit)
    console.log('Second request (should be cache hit):');
    await this.makeRequest('gpt-3.5-turbo', 'Cache test message');

    // Third request with different message (should be cache miss)
    console.log('Third request with different message (should be cache miss):');
    await this.makeRequest('gpt-3.5-turbo', 'Different cache test message');
  }

  async runStressTest(maxConcurrent = 50, durationSeconds = 60) {
    console.log(`Starting stress test: max ${maxConcurrent} concurrent requests for ${durationSeconds} seconds`);

    const startTime = performance.now();
    const endTime = startTime + (durationSeconds * 1000);

    const activeRequests = new Set();
    let requestCount = 0;

    while (performance.now() < endTime) {
      // Clean up completed requests
      for (const promise of activeRequests) {
        if (promise.isCompleted) {
          activeRequests.delete(promise);
        }
      }

      // Add new requests if under concurrency limit
      while (activeRequests.size < maxConcurrent && performance.now() < endTime) {
        const requestPromise = this.makeRequest('gpt-3.5-turbo', `Stress test ${requestCount++}`);
        requestPromise.isCompleted = false;
        requestPromise.finally(() => {
          requestPromise.isCompleted = true;
        });
        activeRequests.add(requestPromise);
      }

      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for remaining requests to complete
    await Promise.all(activeRequests);

    console.log(`Stress test completed. Total requests: ${this.results.totalRequests}`);
  }
}

// Main test execution
async function runPerformanceTests() {
  const tester = new PerformanceTest();

  try {
    console.log('🚀 Starting API Gateway Performance Tests...\n');

    // Basic connectivity test
    console.log('1. Connectivity Test');
    await tester.makeRequest();
    console.log('✓ API Gateway is responding\n');

    // Cache performance test
    console.log('2. Cache Performance Test');
    await tester.runCacheTest();
    tester.printReport();

    // Reset results for load test
    Object.assign(tester.results, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      responseTimes: [],
      errors: [],
      throughput: 0
    });

    // Load test
    console.log('\n3. Load Test (10 users, 5 requests each)');
    await tester.runLoadTest(10, 5, 200);
    tester.printReport();

    // Stress test (light version to avoid overwhelming)
    console.log('\n4. Light Stress Test (20 concurrent, 10 seconds)');
    await tester.runStressTest(20, 10);
    tester.printReport();

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    process.exit(1);
  }
}

// Export for use in other test files
module.exports = PerformanceTest;

// Run tests if this file is executed directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}
