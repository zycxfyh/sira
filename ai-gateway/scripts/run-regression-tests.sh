#!/bin/bash

# Sira Regression Test Suite
# Comprehensive testing to ensure no regressions in functionality

set -e

echo "🧪 Starting Sira Regression Tests..."

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
API_KEY="${API_KEY:-test-api-key-123}"
TEST_TIMEOUT=30

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
PASSED=0
FAILED=0
TOTAL=0

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

print_failure() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to make API request
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=${4:-200}

    ((TOTAL++))

    local response
    local status_code

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X GET \
            -H "x-api-key: $API_KEY" \
            --max-time $TEST_TIMEOUT \
            "$GATEWAY_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -d "$data" \
            --max-time $TEST_TIMEOUT \
            "$GATEWAY_URL$endpoint")
    fi

    status_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    body=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')

    if [ "$status_code" = "$expected_status" ]; then
        return 0
    else
        echo "Expected status $expected_status, got $status_code. Response: $body" >&2
        return 1
    fi
}

# Health Check Tests
run_health_tests() {
    print_header "Health Check Tests"

    # Test health endpoint
    if make_request "GET" "/health" "" 200; then
        print_success "Health endpoint responds correctly"
    else
        print_failure "Health endpoint failed"
    fi

    # Test metrics endpoint
    if make_request "GET" "/metrics" "" 200; then
        print_success "Metrics endpoint responds correctly"
    else
        print_failure "Metrics endpoint failed"
    fi
}

# Authentication Tests
run_auth_tests() {
    print_header "Authentication Tests"

    # Test missing API key
    if curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}' \
        --max-time 10 \
        "$GATEWAY_URL/api/v1/ai/chat/completions" | grep -q "401"; then
        print_success "Missing API key properly rejected"
    else
        print_failure "Missing API key not rejected"
    fi

    # Test invalid API key
    if curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-api-key: invalid-key" \
        -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}' \
        --max-time 10 \
        "$GATEWAY_URL/api/v1/ai/chat/completions" | grep -q "401"; then
        print_success "Invalid API key properly rejected"
    else
        print_failure "Invalid API key not rejected"
    fi
}

# AI Provider Routing Tests
run_routing_tests() {
    print_header "AI Provider Routing Tests"

    local test_cases=(
        'gpt-3.5-turbo:openai'
        'gpt-4:openai'
        'claude-3-haiku:anthropic'
        'claude-3-opus:anthropic'
    )

    for test_case in "${test_cases[@]}"; do
        local model=$(echo "$test_case" | cut -d: -f1)
        local expected_provider=$(echo "$test_case" | cut -d: -f2)

        local response=$(curl -s \
            -X POST \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"Say hello in 3 words.\"}]}" \
            --max-time $TEST_TIMEOUT \
            "$GATEWAY_URL/api/v1/ai/chat/completions")

        local provider=$(echo "$response" | grep -o '"x-ai-provider":[^,]*' | cut -d: -f2 | tr -d '"' || echo "unknown")

        if [ "$provider" = "$expected_provider" ]; then
            print_success "Model $model correctly routed to $expected_provider"
        else
            print_failure "Model $model routing failed (expected: $expected_provider, got: $provider)"
        fi
    done
}

# Caching Tests
run_cache_tests() {
    print_header "Caching Tests"

    local test_data='{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"What is 2+2?"}]}'

    # First request (should be cache miss)
    local response1=$(curl -s -D - \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d "$test_data" \
        --max-time $TEST_TIMEOUT \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    local cache_status1=$(echo "$response1" | grep -i "x-cache-status" | cut -d: -f2 | tr -d ' ' | tr -d '\r' || echo "unknown")

    # Second request (should be cache hit)
    local response2=$(curl -s -D - \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d "$test_data" \
        --max-time $TEST_TIMEOUT \
        "$GATEWAY_URL/api/v1/ai/chat/completions" 2>/dev/null)

    local cache_status2=$(echo "$response2" | grep -i "x-cache-status" | cut -d: -f2 | tr -d ' ' | tr -d '\r' || echo "unknown")

    if [ "$cache_status1" = "MISS" ] && [ "$cache_status2" = "HIT" ]; then
        print_success "Caching works correctly (miss -> hit)"
    elif [ "$cache_status1" = "HIT" ]; then
        print_success "Request served from cache (pre-existing)"
    else
        print_warning "Cache behavior unclear (first: $cache_status1, second: $cache_status2)"
    fi
}

# Error Handling Tests
run_error_tests() {
    print_header "Error Handling Tests"

    # Test invalid model
    if make_request "POST" "/api/v1/ai/chat/completions" \
        '{"model":"invalid-model","messages":[{"role":"user","content":"Hello"}]}' 400; then
        print_success "Invalid model properly rejected"
    else
        print_failure "Invalid model not rejected"
    fi

    # Test missing messages
    if make_request "POST" "/api/v1/ai/chat/completions" \
        '{"model":"gpt-3.5-turbo"}' 400; then
        print_success "Missing messages properly rejected"
    else
        print_failure "Missing messages not rejected"
    fi

    # Test invalid JSON
    if curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -H "x-api-key: $API_KEY" \
        -d '{"invalid": json content}' \
        --max-time 10 \
        "$GATEWAY_URL/api/v1/ai/chat/completions" | grep -q "400"; then
        print_success "Invalid JSON properly rejected"
    else
        print_failure "Invalid JSON not handled properly"
    fi
}

# Performance Tests
run_performance_tests() {
    print_header "Performance Tests"

    local start_time=$(date +%s%N)
    local request_count=5
    local success_count=0

    for i in $(seq 1 $request_count); do
        if make_request "POST" "/api/v1/ai/chat/completions" \
            '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Say hello"}]}'; then
            ((success_count++))
        fi
    done

    local end_time=$(date +%s%N)
    local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    local avg_response_time=$(( duration / request_count ))

    if [ $success_count -eq $request_count ]; then
        print_success "Performance test passed ($success_count/$request_count requests)"
        print_success "Average response time: ${avg_response_time}ms"

        # Check if response time is reasonable (< 5000ms)
        if [ $avg_response_time -lt 5000 ]; then
            print_success "Response time within acceptable limits"
        else
            print_warning "Response time higher than expected: ${avg_response_time}ms"
        fi
    else
        print_failure "Performance test failed ($success_count/$request_count requests successful)"
    fi
}

# Load Test (light version)
run_load_tests() {
    print_header "Load Tests"

    local concurrent_requests=3
    local pids=()

    # Start concurrent requests
    for i in $(seq 1 $concurrent_requests); do
        curl -s \
            -X POST \
            -H "Content-Type: application/json" \
            -H "x-api-key: $API_KEY" \
            -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}' \
            --max-time $TEST_TIMEOUT \
            "$GATEWAY_URL/api/v1/ai/chat/completions" > /dev/null &
        pids+=($!)
    done

    # Wait for all requests to complete
    local failed=0
    for pid in "${pids[@]}"; do
        if ! wait "$pid" 2>/dev/null; then
            ((failed++))
        fi
    done

    if [ $failed -eq 0 ]; then
        print_success "Load test passed (concurrent requests handled)"
    else
        print_failure "Load test failed ($failed requests failed)"
    fi
}

# Main test execution
main() {
    echo "🔗 Gateway URL: $GATEWAY_URL"
    echo "🔑 API Key: ${API_KEY:0:10}..."
    echo "⏰ Test Timeout: ${TEST_TIMEOUT}s"
    echo

    # Pre-flight check
    if ! curl -s --max-time 10 "$GATEWAY_URL/health" > /dev/null; then
        print_failure "Gateway is not accessible at $GATEWAY_URL"
        echo "Please ensure the gateway is running before running regression tests."
        exit 1
    fi

    print_success "Gateway is accessible"

    # Run all test suites
    run_health_tests
    run_auth_tests
    run_routing_tests
    run_cache_tests
    run_error_tests
    run_performance_tests
    run_load_tests

    # Summary
    echo
    echo "==============================================="
    echo "📊 Regression Test Summary"
    echo "==============================================="
    echo "Total Tests: $TOTAL"
    echo "Passed: $PASSED"
    echo "Failed: $FAILED"
    echo "Success Rate: $(( (PASSED * 100) / TOTAL ))%"

    if [ $FAILED -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All regression tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}💥 $FAILED regression test(s) failed!${NC}"
        exit 1
    fi
}

# Run main function
main "$@"
