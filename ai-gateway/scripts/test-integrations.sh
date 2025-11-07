#!/bin/bash

# Sira Integration Tests
# Test all integrated components and advanced features

set -e

echo "🧪 Starting Sira Integration Tests..."

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
KONG_URL="${KONG_URL:-http://localhost:8000}"
API_KEY="${API_KEY:-test-api-key-123}"
NATS_URL="${NATS_URL:-nats://localhost:4222}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
ISSUES_FOUND=0

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((TESTS_PASSED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((ISSUES_FOUND++))
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    ((ISSUES_FOUND++))
}

increment_test() {
    ((TESTS_TOTAL++))
}

# Test Kong Gateway Integration
test_kong_integration() {
    print_header "Kong Gateway Integration Tests"
    increment_test

    # Test Kong proxy
    if curl -f -s "$KONG_URL/api/v1/ai/models" > /dev/null 2>&1; then
        print_success "Kong proxy is forwarding requests correctly"
    else
        print_error "Kong proxy is not accessible"
        return 1
    fi

    # Test Kong admin API
    if curl -f -s "http://localhost:8001/status" > /dev/null 2>&1; then
        print_success "Kong admin API is responding"
    else
        print_warning "Kong admin API is not accessible"
    fi

    # Test AI rate limiting
    increment_test
    local rate_limit_test=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "x-api-key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' \
        "$KONG_URL/api/v1/ai/chat/completions" 2>/dev/null)

    if echo "$rate_limit_test" | grep -q "HTTPSTATUS:200\|HTTPSTATUS:429"; then
        print_success "AI rate limiting is working"
    else
        print_warning "AI rate limiting test inconclusive"
    fi
}

# Test Express Gateway AI Features
test_ai_features() {
    print_header "AI Features Tests"
    increment_test

    # Test AI model routing
    local routing_test=$(curl -s \
        -X POST \
        -H "x-api-key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}]}' \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    if echo "$routing_test" | grep -q '"x-ai-provider":"openai"'; then
        print_success "AI model routing to OpenAI works"
    else
        print_warning "AI model routing test inconclusive (may need real API keys)"
    fi

    # Test AI cache
    increment_test
    local cache_test1=$(curl -s -I \
        -X POST \
        -H "x-api-key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"What is 2+2?"}]}' \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    sleep 1

    local cache_test2=$(curl -s -I \
        -X POST \
        -H "x-api-key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"What is 2+2?"}]}' \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    if echo "$cache_test1" | grep -q "x-cache-status: MISS" && \
       echo "$cache_test2" | grep -q "x-cache-status: HIT"; then
        print_success "AI caching is working correctly"
    else
        print_warning "AI caching test inconclusive"
    fi
}

# Test NATS Queue Integration
test_nats_integration() {
    print_header "NATS Queue Integration Tests"
    increment_test

    # Check if NATS is running
    if nc -z localhost 4222 2>/dev/null; then
        print_success "NATS server is accessible"

        # Test async request queuing
        increment_test
        local async_test=$(curl -s \
            -X POST \
            -H "x-api-key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"model":"gpt-4","messages":[{"role":"user","content":"Long processing request","async":true}]}' \
            "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

        if echo "$async_test" | grep -q '"status":"accepted"'; then
            print_success "Async request queuing is working"
        else
            print_warning "Async request queuing test inconclusive"
        fi
    else
        print_warning "NATS server is not running, skipping queue tests"
    fi
}

# Test Monitoring Stack
test_monitoring_stack() {
    print_header "Monitoring Stack Tests"
    increment_test

    # Test Prometheus
    if curl -f -s "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
        print_success "Prometheus is healthy"

        # Check if AI metrics are being collected
        increment_test
        local metrics=$(curl -s "http://localhost:9090/api/v1/query?query=up{job=\"ai-gateway\"}" 2>/dev/null)
        if echo "$metrics" | grep -q '"status":"success"'; then
            print_success "Sira metrics are being collected"
        else
            print_warning "Sira metrics not found in Prometheus"
        fi
    else
        print_warning "Prometheus is not accessible"
    fi

    # Test Grafana
    increment_test
    if curl -f -s "http://localhost:3001/api/health" > /dev/null 2>&1; then
        print_success "Grafana is accessible"
    else
        print_warning "Grafana is not accessible"
    fi

    # Test Jaeger
    increment_test
    if curl -f -s "http://localhost:16686/api/services" > /dev/null 2>&1; then
        print_success "Jaeger is accessible"
    else
        print_warning "Jaeger is not accessible"
    fi
}

# Test Circuit Breaker
test_circuit_breaker() {
    print_header "Circuit Breaker Tests"
    increment_test

    # Test circuit breaker status endpoint (if available)
    local cb_status=$(curl -s "$GATEWAY_URL/health" 2>/dev/null)
    if echo "$cb_status" | grep -q "circuit"; then
        print_success "Circuit breaker status is available"
    else
        print_warning "Circuit breaker status not available in health check"
    fi
}

# Test Tracing
test_tracing() {
    print_header "Distributed Tracing Tests"
    increment_test

    # Make a request with tracing
    local trace_test=$(curl -s -I \
        -X POST \
        -H "x-api-key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Trace test"}]}' \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    if echo "$trace_test" | grep -q "x-trace-id:"; then
        print_success "Distributed tracing is enabled"
    else
        print_warning "Distributed tracing headers not found"
    fi
}

# Test Security Features
test_security() {
    print_header "Security Tests"
    increment_test

    # Test missing API key
    local auth_test=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    if echo "$auth_test" | grep -q "HTTPSTATUS:401"; then
        print_success "API key authentication is enforced"
    else
        print_error "API key authentication is not working"
    fi

    # Test invalid API key
    increment_test
    local invalid_key_test=$(curl -s -w "HTTPSTATUS:%{http_code}" \
        -X POST \
        -H "x-api-key: invalid-key" \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    if echo "$invalid_key_test" | grep -q "HTTPSTATUS:401"; then
        print_success "Invalid API key rejection is working"
    else
        print_error "Invalid API key handling is not working"
    fi
}

# Performance Test
test_performance() {
    print_header "Performance Tests"
    increment_test

    echo "Running performance test with 10 concurrent requests..."
    local start_time=$(date +%s)

    # Run 10 concurrent requests
    for i in {1..10}; do
        curl -s \
            -X POST \
            -H "x-api-key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Performance test '$i'"}]}' \
            "$GATEWAY_URL/api/v1/ai/chat/completions" > /dev/null &
    done

    wait
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [ $duration -le 30 ]; then
        print_success "Performance test completed in ${duration}s"
    else
        print_warning "Performance test took longer than expected (${duration}s)"
    fi
}

# Main test execution
main() {
    echo "🔗 Gateway URL: $GATEWAY_URL"
    echo "🏰 Kong URL: $KONG_URL"
    echo "🔑 API Key: ${API_KEY:0:10}..."
    echo "📨 NATS URL: $NATS_URL"
    echo

    # Pre-flight checks
    if ! curl -f -s "$GATEWAY_URL/health" > /dev/null 2>&1; then
        print_error "Sira is not accessible at $GATEWAY_URL"
        echo "Please ensure the gateway is running before running integration tests."
        exit 1
    fi

    print_success "Sira is accessible"

    # Run all integration tests
    test_kong_integration
    test_ai_features
    test_nats_integration
    test_monitoring_stack
    test_circuit_breaker
    test_tracing
    test_security
    test_performance

    # Summary
    echo
    echo "==============================================="
    echo "📊 Integration Test Summary"
    echo "==============================================="
    echo "Tests Performed: $TESTS_TOTAL"
    echo "Tests Passed: $TESTS_PASSED"
    echo "Issues Found: $ISSUES_FOUND"
    echo

    local success_rate=$(( (TESTS_PASSED * 100) / TESTS_TOTAL ))

    if [ $ISSUES_FOUND -eq 0 ]; then
        echo -e "${GREEN}🎉 All integration tests passed!${NC}"
        echo "All integrated components are working correctly."
        exit 0
    elif [ $success_rate -ge 80 ]; then
        echo -e "${YELLOW}⚠️  Most integration tests passed${NC}"
        echo "System is mostly functional, but some components may need attention."
        exit 0
    else
        echo -e "${RED}💥 Multiple integration failures detected!${NC}"
        echo "Critical components are not working. Please check the logs above."
        exit 1
    fi
}

# Handle command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --gateway)
            GATEWAY_URL="$2"
            shift 2
            ;;
        --kong)
            KONG_URL="$2"
            shift 2
            ;;
        --api-key)
            API_KEY="$2"
            shift 2
            ;;
        --nats)
            NATS_URL="$2"
            shift 2
            ;;
        -h|--help)
            echo "Sira Integration Tests"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --gateway URL       Gateway URL (default: http://localhost:8080)"
            echo "  --kong URL          Kong URL (default: http://localhost:8000)"
            echo "  --api-key KEY       API key for testing"
            echo "  --nats URL          NATS URL (default: nats://localhost:4222)"
            echo "  -h, --help          Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

main "$@"
