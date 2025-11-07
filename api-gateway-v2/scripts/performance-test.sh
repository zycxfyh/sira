#!/bin/bash

# API Gateway V2 Performance Test Script
# This script runs comprehensive performance tests using Artillery

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
API_KEY=${API_KEY:-"test-api-key"}
TEST_DURATION=${TEST_DURATION:-300}  # 5 minutes
CONCURRENT_USERS=${CONCURRENT_USERS:-50}
REPORT_DIR=${REPORT_DIR:-"./performance-reports"}

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check if Artillery is installed
    if ! command -v artillery &> /dev/null; then
        log_info "Installing Artillery..."
        npm install -g artillery
    fi

    # Check if API Gateway is running
    if ! curl -f -H "x-api-key: $API_KEY" $API_URL/health &>/dev/null; then
        log_error "API Gateway is not running at $API_URL"
        log_error "Please start the API Gateway first:"
        log_error "  docker-compose up -d"
        exit 1
    fi

    log_success "Prerequisites check passed"
}

# Create test configuration
create_test_config() {
    local config_file="$1"
    local target_url="$2"
    local test_type="$3"

    cat > "$config_file" << EOF
config:
  target: '$target_url'
  phases:
EOF

    case $test_type in
        "load")
            cat >> "$config_file" << EOF
    - duration: 60
      arrivalRate: 5
      name: "Warm-up"
    - duration: 240
      arrivalRate: 5
      rampTo: 20
      name: "Ramp-up"
    - duration: $TEST_DURATION
      arrivalRate: 20
      name: "Sustained load"
EOF
            ;;
        "stress")
            cat >> "$config_file" << EOF
    - duration: 30
      arrivalRate: 10
      name: "Warm-up"
    - duration: 60
      arrivalRate: 10
      rampTo: $CONCURRENT_USERS
      name: "Ramp-up"
    - duration: 120
      arrivalRate: $CONCURRENT_USERS
      name: "Stress test"
EOF
            ;;
        "spike")
            cat >> "$config_file" << EOF
    - duration: 60
      arrivalRate: 10
      name: "Baseline"
    - duration: 30
      arrivalRate: 10
      rampTo: $CONCURRENT_USERS
      name: "Spike up"
    - duration: 60
      arrivalRate: $CONCURRENT_USERS
      name: "Spike load"
    - duration: 30
      arrivalRate: $CONCURRENT_USERS
      rampTo: 10
      name: "Spike down"
EOF
            ;;
    esac

    cat >> "$config_file" << EOF
  defaults:
    headers:
      x-api-key: '$API_KEY'
      Content-Type: 'application/json'
  processor: "./tests/processor.js"

scenarios:
  - name: "Chat completions"
    weight: 60
    flow:
      - post:
          url: "/api/v2/chat/completions"
          json:
            model: "gpt-3.5-turbo"
            messages:
              - role: "user"
                content: "Say hello in exactly 3 words"
            temperature: 0.7
            max_tokens: 50

  - name: "Embeddings"
    weight: 30
    flow:
      - post:
          url: "/api/v2/embeddings"
          json:
            model: "text-embedding-ada-002"
            input: ["Hello world", "How are you"]

  - name: "Health check"
    weight: 10
    flow:
      - get:
          url: "/health"
EOF
}

# Run performance test
run_performance_test() {
    local test_type="$1"
    local config_file="/tmp/artillery-${test_type}-config.yml"
    local report_file="$REPORT_DIR/${test_type}-test-$(date +%Y%m%d-%H%M%S).json"

    log_info "Running $test_type performance test..."

    # Create test configuration
    create_test_config "$config_file" "$API_URL" "$test_type"

    # Create report directory
    mkdir -p "$REPORT_DIR"

    # Run Artillery test
    artillery run \
        --config "$config_file" \
        --output "$report_file" \
        --quiet

    log_success "$test_type test completed. Report saved to: $report_file"

    # Clean up config file
    rm -f "$config_file"

    echo "$report_file"
}

# Generate HTML report
generate_html_report() {
    local json_report="$1"
    local html_report="${json_report%.json}.html"

    log_info "Generating HTML report..."

    # Simple HTML report generation
    cat > "$html_report" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>API Gateway Performance Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .metric h3 { margin-top: 0; color: #333; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007acc; }
        .chart { width: 100%; height: 300px; background: #f9f9f9; border: 1px solid #ddd; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>API Gateway V2 Performance Test Report</h1>
    <p><strong>Generated:</strong> <span id="timestamp"></span></p>
    <p><strong>Test Type:</strong> <span id="test-type"></span></p>

    <div id="metrics"></div>

    <div class="chart">
        <h3>Response Time Distribution</h3>
        <canvas id="responseTimeChart"></canvas>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        // Load test data
        fetch(window.location.href.replace('.html', '.json'))
            .then(response => response.json())
            .then(data => {
                document.getElementById('timestamp').textContent = new Date(data.aggregate.timestamp).toLocaleString();
                document.getElementById('test-type').textContent = data.config.phases[0].name || 'Performance Test';

                const metricsDiv = document.getElementById('metrics');

                // Display key metrics
                const metrics = [
                    { name: 'Total Requests', value: data.aggregate.counters['http.requests'] || 0 },
                    { name: 'Successful Requests', value: data.aggregate.counters['successful_requests'] || 0 },
                    { name: 'Failed Requests', value: data.aggregate.counters['failed_requests'] || 0 },
                    { name: 'Average Response Time', value: Math.round(data.aggregate.summaries['http.response_time'].mean || 0) + 'ms' },
                    { name: 'P95 Response Time', value: Math.round(data.aggregate.summaries['http.response_time'].p95 || 0) + 'ms' },
                    { name: 'Requests/Second', value: Math.round((data.aggregate.rates['http.requests'] || 0) * 100) / 100 }
                ];

                metrics.forEach(metric => {
                    metricsDiv.innerHTML += `
                        <div class="metric">
                            <h3>${metric.name}</h3>
                            <div class="metric-value">${metric.value}</div>
                        </div>
                    `;
                });

                // Create response time chart
                const ctx = document.getElementById('responseTimeChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: ['Min', 'Mean', 'Median', 'P95', 'P99', 'Max'],
                        datasets: [{
                            label: 'Response Time (ms)',
                            data: [
                                data.aggregate.summaries['http.response_time'].min || 0,
                                data.aggregate.summaries['http.response_time'].mean || 0,
                                data.aggregate.summaries['http.response_time'].median || 0,
                                data.aggregate.summaries['http.response_time'].p95 || 0,
                                data.aggregate.summaries['http.response_time'].p99 || 0,
                                data.aggregate.summaries['http.response_time'].max || 0
                            ],
                            borderColor: '#007acc',
                            backgroundColor: 'rgba(0, 122, 204, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true
                            }
                        }
                    }
                });
            })
            .catch(error => {
                console.error('Error loading test data:', error);
                document.getElementById('metrics').innerHTML = '<p>Error loading test data</p>';
            });
    </script>
</body>
</html>
EOF

    log_success "HTML report generated: $html_report"
}

# Compare test results
compare_results() {
    local baseline_file="$1"
    local current_file="$2"

    if [ ! -f "$baseline_file" ]; then
        log_warning "Baseline file not found: $baseline_file"
        return
    fi

    log_info "Comparing results with baseline..."

    # Simple comparison (you can enhance this)
    local baseline_avg=$(jq '.aggregate.summaries["http.response_time"].mean' "$baseline_file" 2>/dev/null || echo "0")
    local current_avg=$(jq '.aggregate.summaries["http.response_time"].mean' "$current_file" 2>/dev/null || echo "0")

    local baseline_p95=$(jq '.aggregate.summaries["http.response_time"].p95' "$baseline_file" 2>/dev/null || echo "0")
    local current_p95=$(jq '.aggregate.summaries["http.response_time"].p95' "$current_file" 2>/dev/null || echo "0")

    echo ""
    echo "=== Performance Comparison ==="
    echo "Metric              | Baseline | Current  | Change"
    echo "-------------------|----------|----------|--------"
    printf "Avg Response Time | %8.0f | %8.0f | %6.1f%%\n" "$baseline_avg" "$current_avg" "$(( (current_avg - baseline_avg) * 100 / baseline_avg ))"
    printf "P95 Response Time | %8.0f | %8.0f | %6.1f%%\n" "$baseline_p95" "$current_p95" "$(( (current_p95 - baseline_p95) * 100 / baseline_p95 ))"
}

# Main function
main() {
    local test_type=${1:-"load"}
    local baseline_file=${2:-""}

    log_info "Starting API Gateway V2 Performance Tests"
    log_info "API URL: $API_URL"
    log_info "Test Type: $test_type"
    log_info "Duration: $TEST_DURATION seconds"
    log_info "Concurrent Users: $CONCURRENT_USERS"

    check_prerequisites

    # Run performance test
    local report_file
    case $test_type in
        "load")
            report_file=$(run_performance_test "load")
            ;;
        "stress")
            report_file=$(run_performance_test "stress")
            ;;
        "spike")
            report_file=$(run_performance_test "spike")
            ;;
        "all")
            run_performance_test "load"
            run_performance_test "stress"
            run_performance_test "spike"
            log_success "All performance tests completed"
            return
            ;;
        *)
            log_error "Unknown test type: $test_type"
            echo "Usage: $0 [load|stress|spike|all] [baseline_file]"
            exit 1
            ;;
    esac

    # Generate HTML report
    generate_html_report "$report_file"

    # Compare with baseline if provided
    if [ ! -z "$baseline_file" ]; then
        compare_results "$baseline_file" "$report_file"
    fi

    log_success "Performance testing completed!"
    log_info "Reports saved in: $REPORT_DIR"
}

# Show usage if requested
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "API Gateway V2 Performance Test Script"
    echo ""
    echo "Usage: $0 [test_type] [baseline_file]"
    echo ""
    echo "Test Types:"
    echo "  load     - Standard load testing (default)"
    echo "  stress   - Stress testing with high concurrency"
    echo "  spike    - Spike testing with sudden load changes"
    echo "  all      - Run all test types"
    echo ""
    echo "Environment Variables:"
    echo "  API_URL              - API Gateway URL (default: http://localhost:3000)"
    echo "  API_KEY              - API Key for authentication"
    echo "  TEST_DURATION        - Test duration in seconds (default: 300)"
    echo "  CONCURRENT_USERS     - Maximum concurrent users (default: 50)"
    echo "  REPORT_DIR           - Report output directory (default: ./performance-reports)"
    echo ""
    echo "Examples:"
    echo "  $0 load"
    echo "  $0 stress"
    echo "  API_URL=http://prod-api.example.com $0 load baseline.json"
    exit 0
fi

# Run main function
main "$@"
