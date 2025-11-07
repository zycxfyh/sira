#!/bin/bash

# Sira Performance Benchmark Script
# Tests gateway performance under various loads

set -e

# Configuration
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
CONCURRENT_USERS="${CONCURRENT_USERS:-10}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-1000}"
TEST_DURATION="${TEST_DURATION:-60}"
WARMUP_TIME="${WARMUP_TIME:-10}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gateway is accessible
check_gateway() {
    log_info "Checking gateway accessibility at $GATEWAY_URL..."

    if ! curl -f -s "$GATEWAY_URL/health" > /dev/null 2>&1; then
        log_error "Gateway is not accessible at $GATEWAY_URL"
        log_error "Please ensure the gateway is running before running benchmarks"
        exit 1
    fi

    log_success "Gateway is accessible"
}

# Warm up the system
warmup_system() {
    log_info "Warming up system for $WARMUP_TIME seconds..."

    local end_time=$((SECONDS + WARMUP_TIME))
    while [ $SECONDS -lt $end_time ]; do
        curl -s -X POST "$GATEWAY_URL/api/v1/ai/chat/completions" \
             -H "Content-Type: application/json" \
             -H "x-api-key: benchmark-key" \
             -d '{
               "model": "gpt-3.5-turbo",
               "messages": [{"role": "user", "content": "Hello"}],
               "max_tokens": 10
             }' > /dev/null &
    done

    wait
    log_success "Warmup completed"
}

# Run Apache Bench test
run_ab_test() {
    local name="$1"
    local url="$2"
    local headers="$3"
    local data="$4"
    local concurrent="$5"
    local total="$6"

    log_info "Running $name test..."

    # Create temporary file for headers
    local header_file=$(mktemp)
    echo "$headers" > "$header_file"

    # Run Apache Bench
    local result_file=$(mktemp)
    ab -n "$total" -c "$concurrent" -T "application/json" -p <(echo "$data") -H @"$header_file" "$url" > "$result_file" 2>&1

    # Parse results
    local requests_per_sec=$(grep "Requests per second" "$result_file" | awk '{print $4}')
    local time_per_request=$(grep "Time per request.*mean" "$result_file" | head -1 | awk '{print $4}')
    local failed_requests=$(grep "Failed requests" "$result_file" | awk '{print $3}')
    local transfer_rate=$(grep "Transfer rate" "$result_file" | awk '{print $3}')

    # Display results
    echo "========================================"
    echo "$name Performance Results:"
    echo "========================================"
    echo "Requests per second:    $requests_per_sec [#/sec]"
    echo "Time per request:       $time_per_request [ms]"
    echo "Failed requests:        $failed_requests"
    echo "Transfer rate:          $transfer_rate [Kbytes/sec]"
    echo ""

    # Cleanup
    rm -f "$header_file" "$result_file"
}

# Run memory and CPU monitoring
monitor_resources() {
    local duration="$1"
    local interval="${2:-5}"

    log_info "Monitoring system resources for $duration seconds..."

    local end_time=$((SECONDS + duration))
    local samples=0
    local total_cpu=0
    local total_mem=0
    local max_cpu=0
    local max_mem=0

    while [ $SECONDS -lt $end_time ]; do
        # Get CPU and memory usage (simplified - in production use proper monitoring)
        local cpu_usage=$(ps aux --no-headers -o pcpu | awk '{sum+=$1} END {print sum}')
        local mem_usage=$(ps aux --no-headers -o pmem | awk '{sum+=$1} END {print sum}')

        total_cpu=$(echo "$total_cpu + $cpu_usage" | bc -l 2>/dev/null || echo "0")
        total_mem=$(echo "$total_mem + $mem_usage" | bc -l 2>/dev/null || echo "0")

        if (( $(echo "$cpu_usage > $max_cpu" | bc -l 2>/dev/null) )); then
            max_cpu=$cpu_usage
        fi

        if (( $(echo "$mem_usage > $max_mem" | bc -l 2>/dev/null) )); then
            max_mem=$mem_usage
        fi

        samples=$((samples + 1))
        sleep "$interval"
    done

    local avg_cpu=$(echo "scale=2; $total_cpu / $samples" | bc -l 2>/dev/null || echo "0")
    local avg_mem=$(echo "scale=2; $total_mem / $samples" | bc -l 2>/dev/null || echo "0")

    echo "========================================"
    echo "Resource Usage Summary:"
    echo "========================================"
    echo "Average CPU usage:      $avg_cpu%"
    echo "Maximum CPU usage:      $max_cpu%"
    echo "Average memory usage:   $avg_mem%"
    echo "Maximum memory usage:   $max_mem%"
    echo ""
}

# Run AI-specific benchmarks
run_ai_benchmarks() {
    log_info "Running AI-specific benchmarks..."

    # Test different AI models
    local models=("gpt-3.5-turbo" "gpt-4" "claude-3-haiku")
    for model in "${models[@]}"; do
        log_info "Benchmarking $model..."

        run_ab_test \
            "$model Chat Completion" \
            "$GATEWAY_URL/api/v1/ai/chat/completions" \
            "x-api-key: benchmark-key" \
            "{\"model\": \"$model\", \"messages\": [{\"role\": \"user\", \"content\": \"Write a haiku about coding\"}], \"max_tokens\": 50}" \
            "$CONCURRENT_USERS" \
            "$TOTAL_REQUESTS"
    done

    # Test caching performance
    log_info "Testing cache performance..."
    run_ab_test \
        "Cached Request" \
        "$GATEWAY_URL/api/v1/ai/chat/completions" \
        "x-api-key: benchmark-key" \
        "{\"model\": \"gpt-3.5-turbo\", \"messages\": [{\"role\": \"user\", \"content\": \"Say hello\"}], \"max_tokens\": 10}" \
        "$CONCURRENT_USERS" \
        "$((TOTAL_REQUESTS * 2))"

    # Test rate limiting
    log_info "Testing rate limiting..."
    run_ab_test \
        "Rate Limited Request" \
        "$GATEWAY_URL/api/v1/ai/chat/completions" \
        "x-api-key: benchmark-key" \
        "{\"model\": \"gpt-3.5-turbo\", \"messages\": [{\"role\": \"user\", \"content\": \"Test\"}], \"max_tokens\": 5}" \
        "$((CONCURRENT_USERS * 2))" \
        "$TOTAL_REQUESTS"
}

# Generate performance report
generate_report() {
    local report_file="performance-report-$(date +%Y%m%d-%H%M%S).txt"

    log_info "Generating performance report..."

    {
        echo "Sira Performance Benchmark Report"
        echo "=================================="
        echo "Date: $(date)"
        echo "Gateway URL: $GATEWAY_URL"
        echo "Concurrent Users: $CONCURRENT_USERS"
        echo "Total Requests: $TOTAL_REQUESTS"
        echo "Test Duration: $TEST_DURATION seconds"
        echo ""
        echo "System Information:"
        echo "==================="
        uname -a
        echo ""
        echo "Node.js Version: $(node --version)"
        echo "NPM Version: $(npm --version)"
        echo ""
        echo "Memory Information:"
        free -h
        echo ""
        echo "Disk Usage:"
        df -h
        echo ""
    } > "$report_file"

    log_success "Performance report saved to $report_file"
}

# Main execution
main() {
    log_info "Starting Sira Performance Benchmark"
    log_info "===================================="

    # Pre-flight checks
    check_gateway

    # Warmup phase
    warmup_system

    # Start resource monitoring in background
    monitor_resources "$TEST_DURATION" &
    local monitor_pid=$!

    # Run benchmarks
    run_ai_benchmarks

    # Wait for monitoring to complete
    wait $monitor_pid

    # Generate report
    generate_report

    log_success "Performance benchmark completed!"
    log_info "Check the generated report for detailed results."
}

# Handle command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            GATEWAY_URL="$2"
            shift 2
            ;;
        -c|--concurrent)
            CONCURRENT_USERS="$2"
            shift 2
            ;;
        -n|--requests)
            TOTAL_REQUESTS="$2"
            shift 2
            ;;
        -d|--duration)
            TEST_DURATION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -u, --url URL           Gateway URL (default: http://localhost:8080)"
            echo "  -c, --concurrent NUM    Number of concurrent users (default: 10)"
            echo "  -n, --requests NUM      Total number of requests (default: 1000)"
            echo "  -d, --duration SEC      Test duration in seconds (default: 60)"
            echo "  -h, --help              Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

# Check for required tools
command -v ab >/dev/null 2>&1 || { log_error "Apache Bench (ab) is required but not installed."; exit 1; }
command -v curl >/dev/null 2>&1 || { log_error "curl is required but not installed."; exit 1; }
command -v bc >/dev/null 2>&1 || { log_error "bc is required but not installed."; exit 1; }

# Run main function
main "$@"