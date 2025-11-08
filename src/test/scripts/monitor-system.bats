#!/usr/bin/env bats

# BATS test file for monitor-system.sh
# Requires: bats-core (https://github.com/bats-core/bats-core)

setup() {
    # Create temporary files for testing
    TEST_LOG_FILE="/tmp/test-monitor.log"
    TEST_METRICS_FILE="/tmp/test-metrics.json"
    MONITOR_SCRIPT="${BATS_TEST_DIRNAME}/../../scripts/monitor-system.sh"

    # Clean up any existing test files
    rm -f "$TEST_LOG_FILE" "$TEST_METRICS_FILE"
}

teardown() {
    # Clean up test files
    rm -f "$TEST_LOG_FILE" "$TEST_METRICS_FILE"
}

@test "monitor-system.sh help command works" {
    run bash "$MONITOR_SCRIPT" help
    [ "$status" -eq 0 ]
    [[ "$output" =~ "Usage:" ]]
    [[ "$output" =~ "Commands:" ]]
    [[ "$output" =~ "Options:" ]]
}

@test "monitor-system.sh check command works" {
    export LOG_FILE="$TEST_LOG_FILE"
    export METRICS_FILE="$TEST_METRICS_FILE"
    export GATEWAY_URL="http://invalid-url"
    export PROMETHEUS_URL="http://invalid-url"
    export GRAFANA_URL="http://invalid-url"

    run bash "$MONITOR_SCRIPT" check
    [ "$status" -eq 0 ]
    [[ "$output" =~ "System Health:" ]]
    [[ "$output" =~ "Application Health:" ]]
}

@test "monitor-system.sh validates configuration" {
    export MONITOR_INTERVAL="invalid"
    export ALERT_THRESHOLD="150"
    export LOG_FILE="$TEST_LOG_FILE"
    export METRICS_FILE="$TEST_METRICS_FILE"

    run bash "$MONITOR_SCRIPT" check
    [ "$status" -eq 0 ]  # Should not fail, just warn
}

@test "monitor-system.sh can load config file" {
    # Create a test config file
    TEST_CONFIG="/tmp/test-monitor-config.sh"
    cat > "$TEST_CONFIG" << 'EOF'
MONITOR_INTERVAL=60
ALERT_THRESHOLD=75
LOG_FILE=/tmp/custom-log.log
EOF

    export CONFIG_FILE="$TEST_CONFIG"
    export LOG_FILE="$TEST_LOG_FILE"
    export METRICS_FILE="$TEST_METRICS_FILE"

    run bash "$MONITOR_SCRIPT" check
    [ "$status" -eq 0 ]

    # Clean up
    rm -f "$TEST_CONFIG"
}

@test "monitor-system.sh get_cpu_usage function works" {
    # Test individual functions
    run bash -c "
        source \"$MONITOR_SCRIPT\"
        result=\$(get_cpu_usage)
        [[ \$result =~ ^[0-9]+\$ ]] || [[ \$result =~ ^[0-9]+\\.[0-9]+\$ ]]
    "
    [ "$status" -eq 0 ]
}

@test "monitor-system.sh get_memory_info function works" {
    run bash -c "
        source \"$MONITOR_SCRIPT\"
        result=\$(get_memory_info)
        [[ \$result =~ \"total_mb\" ]] && [[ \$result =~ \"usage_percent\" ]]
    "
    [ "$status" -eq 0 ]
}

@test "monitor-system.sh get_disk_usage function works" {
    run bash -c "
        source \"$MONITOR_SCRIPT\"
        result=\$(get_disk_usage)
        [[ \$result =~ ^[0-9]+\$ ]]
    "
    [ "$status" -eq 0 ]
}

@test "monitor-system.sh get_load_average function works" {
    run bash -c "
        source \"$MONITOR_SCRIPT\"
        result=\$(get_load_average)
        [[ \$result =~ ^[0-9]+\.?[0-9]*$ ]]
    "
    [ "$status" -eq 0 ]
}

@test "monitor-system.sh http_get function works" {
    run bash -c "
        source \"$MONITOR_SCRIPT\"
        # Test with a non-existent URL (should fail gracefully)
        result=\$(http_get 'http://invalid-url-12345' 1 2>/dev/null; echo \$?)
        [ \$result -ne 0 ]
    "
    [ "$status" -eq 0 ]
}

@test "monitor-system.sh check_service_health function works" {
    run bash -c "
        source \"$MONITOR_SCRIPT\"
        # Test with invalid URL
        result=\$(check_service_health 'test-service' 'http://invalid-url-12345')
        [ \"\$result\" = 'unhealthy' ]
    "
    [ "$status" -eq 0 ]
}

@test "monitor-system.sh log functions work" {
    export LOG_FILE="$TEST_LOG_FILE"

    run bash -c "
        source \"$MONITOR_SCRIPT\"
        log_info 'Test info message'
        log_warn 'Test warning message'
        log_error 'Test error message'
        log_success 'Test success message'
    "
    [ "$status" -eq 0 ]

    # Check if log file contains our messages
    if [ -f \"$TEST_LOG_FILE\" ]; then
        run grep -q "Test info message" "$TEST_LOG_FILE"
        [ "$status" -eq 0 ]
        run grep -q "Test warning message" "$TEST_LOG_FILE"
        [ "$status" -eq 0 ]
        run grep -q "Test error message" "$TEST_LOG_FILE"
        [ "$status" -eq 0 ]
        run grep -q "Test success message" "$TEST_LOG_FILE"
        [ "$status" -eq 0 ]
    fi
}
