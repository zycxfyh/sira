#!/bin/bash

# AI Gateway Performance Benchmark Script
# 用于测试AI网关的性能表现

set -e

echo "🚀 AI Gateway Performance Benchmark"
echo "=================================="

# 配置参数
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
API_KEY="${API_KEY:-test-api-key-123}"
CONCURRENT_REQUESTS="${CONCURRENT_REQUESTS:-10}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-100}"
TEST_DURATION="${TEST_DURATION:-60}"

echo "📋 Test Configuration:"
echo "  Gateway URL: $GATEWAY_URL"
echo "  Concurrent Requests: $CONCURRENT_REQUESTS"
echo "  Total Requests: $TOTAL_REQUESTS"
echo "  Duration: ${TEST_DURATION}s"
echo ""

# 检查网关是否可访问
echo "🔍 Checking Gateway Health..."
if ! curl -s "$GATEWAY_URL/health" > /dev/null; then
    echo "❌ Gateway is not accessible at $GATEWAY_URL"
    echo "   Please start the gateway first:"
    echo "   cd docker/production && docker-compose up -d"
    exit 1
fi
echo "✅ Gateway is healthy"

# 创建测试数据
TEST_PAYLOAD='{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Say hello in exactly 3 words."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 50
}'

# 基础性能测试
echo ""
echo "📊 Running Basic Performance Test..."

# 使用ab (Apache Bench) 进行压力测试
echo "Running load test with $CONCURRENT_REQUESTS concurrent requests..."
ab -n $TOTAL_REQUESTS \
   -c $CONCURRENT_REQUESTS \
   -T 'application/json' \
   -H "x-api-key: $API_KEY" \
   -p <(echo "$TEST_PAYLOAD") \
   "$GATEWAY_URL/api/v1/ai/chat/completions" \
   > benchmark_results.txt 2>&1

# 解析结果
echo ""
echo "📈 Performance Results:"
echo "======================"

# 提取关键指标
if command -v jq &> /dev/null; then
    # 如果有jq工具，可以更好地解析结果
    echo "Detailed metrics with jq:"
    cat benchmark_results.txt | grep -E "(requests|Rate|Time|failed)" | head -10
else
    # 基础解析
    echo "Basic metrics:"
    grep -E "(requests per second|Time per request|failed requests)" benchmark_results.txt || echo "Results parsing failed"
fi

# 缓存性能测试
echo ""
echo "🔄 Testing Cache Performance..."
echo "=============================="

# 发送相同请求多次测试缓存
CACHE_TEST_REQUESTS=20

echo "Testing cache with $CACHE_TEST_REQUESTS identical requests..."
for i in $(seq 1 $CACHE_TEST_REQUESTS); do
    curl -s -w "Request $i: %{time_total}s\n" \
         -H "Content-Type: application/json" \
         -H "x-api-key: $API_KEY" \
         -d "$TEST_PAYLOAD" \
         "$GATEWAY_URL/api/v1/ai/chat/completions" > /dev/null &
done

wait
echo "Cache test completed"

# 内存和CPU监控
echo ""
echo "🖥️  System Resource Monitoring..."
echo "==============================="

if command -v docker &> /dev/null && docker ps | grep -q ai-gateway; then
    echo "Docker container stats:"
    docker stats --no-stream ai-gateway 2>/dev/null | tail -1 || echo "Could not get container stats"
else
    echo "System memory usage:"
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        free -h | grep "^Mem:" || echo "Memory info not available"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        vm_stat | grep "Pages free" || echo "Memory info not available"
    else
        echo "System memory monitoring not supported on this OS"
    fi
fi

# 生成报告
echo ""
echo "📋 Benchmark Report Generated"
echo "============================"
echo "Results saved to: benchmark_results.txt"
echo ""
echo "Key Metrics to Check:"
echo "- Requests per second"
echo "- Time per request (mean)"
echo "- Transfer rate"
echo "- Failed requests"
echo ""
echo "For cache performance analysis:"
echo "- Check response headers for 'x-cache-status'"
echo "- Monitor cache hit ratio in Grafana"

# 清理
echo ""
echo "🧹 Cleaning up..."
rm -f benchmark_results.txt 2>/dev/null || true

echo ""
echo "✅ Benchmark completed!"
echo "📊 Check Grafana dashboard for detailed metrics"
echo "🔍 Review logs for any errors during testing"
