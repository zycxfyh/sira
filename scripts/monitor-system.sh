#!/bin/bash

# Sira AI Gateway - System Monitoring Script
# Comprehensive system and application monitoring with Prometheus/Grafana integration

set -euo pipefail

# Configuration defaults
MONITOR_INTERVAL="${MONITOR_INTERVAL:-60}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-80}"
LOG_FILE="${LOG_FILE:-/tmp/sira-monitor.log}"
METRICS_FILE="${METRICS_FILE:-/tmp/sira-metrics.json}"
CONFIG_FILE="${CONFIG_FILE:-}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:9876}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $*${NC}" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $*${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*${NC}" | tee -a "$LOG_FILE" >&2
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] SUCCESS: $*${NC}" | tee -a "$LOG_FILE"
}

# Load configuration file if specified
load_config() {
    if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
        log_info "Loading configuration from: $CONFIG_FILE"
        source "$CONFIG_FILE"
    fi
}

# Validate configuration
validate_config() {
    if ! [[ "$MONITOR_INTERVAL" =~ ^[0-9]+$ ]] || [[ "$MONITOR_INTERVAL" -lt 5 ]]; then
        log_warn "Invalid MONITOR_INTERVAL: $MONITOR_INTERVAL, using default 60"
        MONITOR_INTERVAL=60
    fi

    if ! [[ "$ALERT_THRESHOLD" =~ ^[0-9]+$ ]] || [[ "$ALERT_THRESHOLD" -gt 100 ]]; then
        log_warn "Invalid ALERT_THRESHOLD: $ALERT_THRESHOLD, using default 80"
        ALERT_THRESHOLD=80
    fi
}

# System resource monitoring functions
get_cpu_usage() {
    # Get CPU usage percentage
    if command -v mpstat &> /dev/null; then
        # Use mpstat for more accurate readings
        mpstat 1 1 | awk '/Average/ {printf "%.1f", 100 - $12}'
    elif [[ -f /proc/stat ]]; then
        # Fallback to /proc/stat
        local prev_idle prev_total
        read -r prev_idle prev_total < <(awk '/^cpu / {print $5, $2+$3+$4+$5+$6+$7+$8+$9+$10}' /proc/stat)
        sleep 1
        local idle total
        read -r idle total < <(awk '/^cpu / {print $5, $2+$3+$4+$5+$6+$7+$8+$9+$10}' /proc/stat)
        local diff_idle=$((idle - prev_idle))
        local diff_total=$((total - prev_total))
        if [[ $diff_total -gt 0 ]]; then
            echo $((100 * (diff_total - diff_idle) / diff_total))
        else
            echo "0"
        fi
    else
        echo "0"
    fi
}

get_memory_info() {
    # Get memory usage in JSON format
    if [[ -f /proc/meminfo ]]; then
        local total_kb used_kb
        total_kb=$(grep '^MemTotal:' /proc/meminfo | awk '{print $2}')
        used_kb=$(grep '^MemAvailable:' /proc/meminfo | awk '{print $2}')
        used_kb=$((total_kb - used_kb))
        local total_mb=$((total_kb / 1024))
        local used_mb=$((used_kb / 1024))
        local usage_percent=$((used_kb * 100 / total_kb))

        echo "{\"total_mb\": $total_mb, \"used_mb\": $used_mb, \"usage_percent\": $usage_percent}"
    else
        echo "{\"total_mb\": 0, \"used_mb\": 0, \"usage_percent\": 0}"
    fi
}

get_disk_usage() {
    # Get disk usage percentage for root filesystem
    if command -v df &> /dev/null; then
        df / | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "0"
    else
        # Windows fallback
        echo "0"
    fi
}

get_load_average() {
    # Get 1-minute load average
    if command -v uptime &> /dev/null; then
        uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | sed 's/ //g' 2>/dev/null || echo "0.0"
    else
        # Windows or systems without uptime command
        echo "0.0"
    fi
}

get_network_stats() {
    # Get network statistics (simplified)
    if command -v ip &> /dev/null; then
        ip -s link | grep -A 1 "eth0\|enp" | tail -1 | awk '{print "{\"rx_bytes\": " $1 ", \"tx_bytes\": " $5 "}"}' 2>/dev/null || echo "{}"
    else
        echo "{}"
    fi
}

# HTTP utility functions
http_get() {
    local url="$1"
    local timeout="${2:-10}"

    if command -v curl &> /dev/null; then
        curl -s --max-time "$timeout" --connect-timeout "$timeout" "$url"
    elif command -v wget &> /dev/null; then
        wget -q -O - --timeout="$timeout" "$url"
    else
        echo ""
        return 1
    fi
}

check_service_health() {
    local service_name="$1"
    local url="$2"
    local expected_status="${3:-200}"

    local response
    local http_code

    if command -v curl &> /dev/null; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time 10 "$url")
        http_code=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
        response=$(echo "$response" | sed -e 's/HTTPSTATUS:.*//g')
    else
        # Fallback - just check if URL is reachable
        if timeout 10 bash -c "echo > /dev/tcp/${url#http://}/80" 2>/dev/null; then
            http_code="200"
            response="OK"
        else
            http_code="000"
            response=""
        fi
    fi

    if [[ "$http_code" == "$expected_status" ]]; then
        echo "healthy"
    else
        echo "unhealthy"
    fi
}

# Application-specific monitoring
check_gateway_health() {
    local health_status=$(check_service_health "Sira Gateway" "${GATEWAY_URL}/health")
    echo "$health_status"
}

check_prometheus_health() {
    if [[ -n "$PROMETHEUS_URL" ]]; then
        local health_status=$(check_service_health "Prometheus" "${PROMETHEUS_URL}/-/ready")
        echo "$health_status"
    else
        echo "not_configured"
    fi
}

check_grafana_health() {
    if [[ -n "$GRAFANA_URL" ]]; then
        local health_status=$(check_service_health "Grafana" "${GRAFANA_URL}/api/health")
        echo "$health_status"
    else
        echo "not_configured"
    fi
}

# Metrics collection
collect_system_metrics() {
    local cpu_usage=$(get_cpu_usage)
    local memory_info=$(get_memory_info)
    local disk_usage=$(get_disk_usage)
    local load_avg=$(get_load_average)
    local network_stats=$(get_network_stats)

    local timestamp=$(date '+%s')

    cat << EOF > "$METRICS_FILE"
{
  "timestamp": $timestamp,
  "system": {
    "cpu_usage_percent": $cpu_usage,
    "memory": $memory_info,
    "disk_usage_percent": $disk_usage,
    "load_average": $load_avg,
    "network": $network_stats
  },
  "services": {
    "gateway": "$(check_gateway_health)",
    "prometheus": "$(check_prometheus_health)",
    "grafana": "$(check_grafana_health)"
  },
  "alerts": $(check_alerts)
}
EOF
}

# Alert checking
check_alerts() {
    local alerts="[]"
    local cpu_usage=$(get_cpu_usage)
    local disk_usage=$(get_disk_usage)

    if [[ $cpu_usage -gt $ALERT_THRESHOLD ]]; then
        alerts=$(echo "$alerts" | jq -c ". + [{\"type\": \"cpu\", \"level\": \"warning\", \"value\": $cpu_usage, \"threshold\": $ALERT_THRESHOLD}]" 2>/dev/null || echo "$alerts")
    fi

    if [[ $disk_usage -gt $ALERT_THRESHOLD ]]; then
        alerts=$(echo "$alerts" | jq -c ". + [{\"type\": \"disk\", \"level\": \"warning\", \"value\": $disk_usage, \"threshold\": $ALERT_THRESHOLD}]" 2>/dev/null || echo "$alerts")
    fi

    echo "$alerts"
}

# Report generation
generate_report() {
    local report_file="${1:-reports/monitoring/$(date '+%Y-%m-%d_%H-%M-%S').json}"

    # Ensure report directory exists
    mkdir -p "$(dirname "$report_file")"

    if [[ -f "$METRICS_FILE" ]]; then
        cp "$METRICS_FILE" "$report_file"
        log_success "Report generated: $report_file"
    else
        log_error "Metrics file not found: $METRICS_FILE"
        return 1
    fi
}

# Main monitoring function
perform_check() {
    log_info "Starting system monitoring check..."

    # Collect metrics
    collect_system_metrics

    # Display results if verbose
    if [[ "$VERBOSE" == "true" ]]; then
        echo "System Health:"
        echo "=============="
        echo "CPU Usage: $(get_cpu_usage)%"
        echo "Memory: $(get_memory_info)"
        echo "Disk Usage: $(get_disk_usage)%"
        echo "Load Average: $(get_load_average)"
        echo ""
        echo "Application Health:"
        echo "==================="
        echo "Gateway: $(check_gateway_health)"
        echo "Prometheus: $(check_prometheus_health)"
        echo "Grafana: $(check_grafana_health)"
        echo ""
        echo "Metrics saved to: $METRICS_FILE"
        echo "Logs saved to: $LOG_FILE"
    fi

    log_success "Monitoring check completed"
}

# Continuous monitoring mode
monitor_continuous() {
    log_info "Starting continuous monitoring (interval: ${MONITOR_INTERVAL}s)..."
    log_info "Press Ctrl+C to stop"

    while true; do
        perform_check
        sleep "$MONITOR_INTERVAL"
    done
}

# Audit mode - comprehensive system analysis
audit_system() {
    log_info "Starting system audit..."

    echo "System Audit Report"
    echo "==================="
    echo "Timestamp: $(date)"
    echo ""

    echo "System Information:"
    echo "==================="
    echo "OS: $(uname -s) $(uname -r)"
    echo "Hostname: $(hostname)"
    echo "Uptime: $(uptime -p)"
    echo ""

    echo "Resource Usage:"
    echo "==============="
    echo "CPU Usage: $(get_cpu_usage)%"
    echo "Memory: $(get_memory_info)"
    echo "Disk Usage: $(get_disk_usage)%"
    echo "Load Average: $(get_load_average)"
    echo ""

    echo "Network Information:"
    echo "===================="
    echo "Network Stats: $(get_network_stats)"
    echo ""

    echo "Service Health:"
    echo "==============="
    echo "Gateway: $(check_gateway_health)"
    echo "Prometheus: $(check_prometheus_health)"
    echo "Grafana: $(check_grafana_health)"
    echo ""

    echo "Configuration:"
    echo "=============="
    echo "Monitor Interval: ${MONITOR_INTERVAL}s"
    echo "Alert Threshold: ${ALERT_THRESHOLD}%"
    echo "Log File: $LOG_FILE"
    echo "Metrics File: $METRICS_FILE"
    echo ""

    log_success "System audit completed"
}

# Help function
show_help() {
    cat << EOF
Sira AI Gateway - System Monitoring Script

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    check           Perform a single monitoring check
    monitor         Start continuous monitoring
    audit           Perform comprehensive system audit
    help            Show this help message

Options:
    -c, --config FILE     Load configuration from FILE
    -i, --interval SEC    Set monitoring interval (default: 60)
    -t, --threshold PCT   Set alert threshold percentage (default: 80)
    -l, --log FILE        Set log file (default: /tmp/sira-monitor.log)
    -m, --metrics FILE    Set metrics file (default: /tmp/sira-metrics.json)
    -g, --gateway URL     Gateway URL (default: http://localhost:9876)
    -p, --prometheus URL  Prometheus URL (default: http://localhost:9090)
    -G, --grafana URL     Grafana URL (default: http://localhost:3000)
    -v, --verbose         Enable verbose output
    -h, --help           Show this help message

Environment Variables:
    MONITOR_INTERVAL    Monitoring interval in seconds
    ALERT_THRESHOLD     Alert threshold percentage
    LOG_FILE           Log file path
    METRICS_FILE       Metrics file path
    GATEWAY_URL        Gateway service URL
    PROMETHEUS_URL     Prometheus service URL
    GRAFANA_URL        Grafana service URL
    VERBOSE            Enable verbose output (true/false)

Examples:
    $0 check                           # Single check
    $0 monitor -i 30                   # Monitor every 30 seconds
    $0 audit -v                        # Comprehensive audit with verbose output
    $0 check -c config/monitor.conf    # Load custom configuration

EOF
}

# Command line argument parsing
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--config)
                CONFIG_FILE="$2"
                shift 2
                ;;
            -i|--interval)
                MONITOR_INTERVAL="$2"
                shift 2
                ;;
            -t|--threshold)
                ALERT_THRESHOLD="$2"
                shift 2
                ;;
            -l|--log)
                LOG_FILE="$2"
                shift 2
                ;;
            -m|--metrics)
                METRICS_FILE="$2"
                shift 2
                ;;
            -g|--gateway)
                GATEWAY_URL="$2"
                shift 2
                ;;
            -p|--prometheus)
                PROMETHEUS_URL="$2"
                shift 2
                ;;
            -G|--grafana)
                GRAFANA_URL="$2"
                shift 2
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            check|monitor|audit|help)
                COMMAND="$1"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main function
main() {
    local COMMAND="${1:-check}"

    # Load configuration
    load_config

    # Parse command line arguments
    parse_args "$@"

    # Validate configuration
    validate_config

    # Create log directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$(dirname "$METRICS_FILE")"

    # Execute command
    case "$COMMAND" in
        check)
            perform_check
            ;;
        monitor)
            monitor_continuous
            ;;
        audit)
            audit_system
            ;;
        help)
            show_help
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
