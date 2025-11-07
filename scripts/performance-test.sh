#!/bin/bash

# 文件路径: scripts/performance-test.sh
# 职责: 工业级性能测试套件
# 包括响应时间、内存使用、CPU使用率测试

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
TEST_DURATION=30  # 30秒测试
CONCURRENT_REQUESTS=5  # 并发请求数
WARMUP_REQUESTS=10  # 预热请求数
RESULTS_DIR="performance-test-results/$(date +%Y%m%d_%H%M%S)"
TARGET_URL="http://localhost:3000/health"  # 测试端点

# 创建结果目录
mkdir -p "$RESULTS_DIR"

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local formatted_message="[$timestamp] [$level] $message"

    echo -e "$formatted_message" | tee -a "$RESULTS_DIR/performance.log"

    case "$level" in
        "INFO") echo -e "${BLUE}$formatted_message${NC}" ;;
        "SUCCESS") echo -e "${GREEN}$formatted_message${NC}" ;;
        "WARNING") echo -e "${YELLOW}$formatted_message${NC}" ;;
        "ERROR") echo -e "${RED}$formatted_message${NC}" ;;
        "CRITICAL") echo -e "${PURPLE}$formatted_message${NC}" ;;
        "PERF") echo -e "${CYAN}$formatted_message${NC}" ;;
    esac
}

# 检查依赖
check_dependencies() {
    log "INFO" "🔍 检查性能测试依赖..."

    if ! command -v curl &> /dev/null; then
        log "ERROR" "curl 未安装"
        exit 1
    fi

    # bc 不再需要，使用 bash 内置数学运算

    log "SUCCESS" "✅ 依赖检查通过"
}

# 预热服务
warmup_service() {
    log "INFO" "🔥 预热服务..."

    for i in $(seq 1 $WARMUP_REQUESTS); do
        if curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL" | grep -q "200"; then
            log "INFO" "预热请求 $i/$WARMUP_REQUESTS 成功"
        else
            log "WARNING" "预热请求 $i/$WARMUP_REQUESTS 失败"
        fi
        sleep 0.1
    done

    log "SUCCESS" "✅ 服务预热完成"
}

# 单次请求性能测试
single_request_test() {
    log "INFO" "⚡ 执行单次请求性能测试..."

    local results_file="$RESULTS_DIR/single_requests.csv"
    echo "request_id,timestamp,total_time,connect_time,start_transfer_time,http_code,size" > "$results_file"

    for i in $(seq 1 100); do
        local timestamp=$(date +%s%N)
        local result=$(curl -s -w "@curl-format.txt" -o /dev/null "$TARGET_URL" 2>/dev/null || echo "0.000000 0.000000 0.000000 000 0")

        echo "$i,$timestamp,$result" >> "$results_file"

        if (( i % 10 == 0 )); then
            log "INFO" "已完成 $i/100 个单次请求"
        fi
    done

    log "SUCCESS" "✅ 单次请求测试完成，结果保存至: $results_file"
}

# 并发请求测试
concurrent_requests_test() {
    log "INFO" "🔄 执行并发请求性能测试..."

    local start_time=$(date +%s)
    local end_time=$((start_time + TEST_DURATION))
    local request_count=0
    local success_count=0
    local total_response_time=0

    log "PERF" "开始 $TEST_DURATION 秒并发测试 (并发数: $CONCURRENT_REQUESTS)"

    # 启动后台进程进行并发请求
    for ((i=1; i<=CONCURRENT_REQUESTS; i++)); do
        (
            while (( $(date +%s) < end_time )); do
                local request_start=$(date +%N)
                if curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL" | grep -q "200"; then
                    local request_end=$(date +%N)
                    local response_time=$(( (request_end - request_start) / 1000000 ))  # 转换为毫秒

                    # 线程安全地更新计数器
                    echo "$response_time" >> "$RESULTS_DIR/concurrent_responses.tmp"
                    ((success_count++))
                fi
                ((request_count++))
            done
        ) &
    done

    # 等待所有后台进程完成
    wait

    # 计算结果
    if [ -f "$RESULTS_DIR/concurrent_responses.tmp" ]; then
        local response_times=$(cat "$RESULTS_DIR/concurrent_responses.tmp")
        local avg_response_time=$(echo "$response_times" | awk '{sum+=$1} END {print sum/NR}')
        local min_response_time=$(echo "$response_times" | sort -n | head -1)
        local max_response_time=$(echo "$response_times" | sort -n | tail -1)
        local p95_response_time=$(echo "$response_times" | sort -n | awk 'BEGIN{c=0} {a[c++]=$1} END{p=int((c-1)*0.95); print a[p]}')

        local qps=$(( success_count / TEST_DURATION ))

        log "PERF" "并发测试结果:"
        log "PERF" "  - 总请求数: $request_count"
        log "PERF" "  - 成功请求数: $success_count"
        log "PERF" "  - QPS (每秒查询数): $qps"
        log "PERF" "  - 平均响应时间: ${avg_response_time}ms"
        log "PERF" "  - 最快响应时间: ${min_response_time}ms"
        log "PERF" "  - 最慢响应时间: ${max_response_time}ms"
        log "PERF" "  - P95响应时间: ${p95_response_time}ms"

        # 保存详细结果
        echo "metric,value" > "$RESULTS_DIR/concurrent_metrics.csv"
        echo "total_requests,$request_count" >> "$RESULTS_DIR/concurrent_metrics.csv"
        echo "successful_requests,$success_count" >> "$RESULTS_DIR/concurrent_metrics.csv"
        echo "qps,$qps" >> "$RESULTS_DIR/concurrent_metrics.csv"
        echo "avg_response_time_ms,$avg_response_time" >> "$RESULTS_DIR/concurrent_metrics.csv"
        echo "min_response_time_ms,$min_response_time" >> "$RESULTS_DIR/concurrent_metrics.csv"
        echo "max_response_time_ms,$max_response_time" >> "$RESULTS_DIR/concurrent_metrics.csv"
        echo "p95_response_time_ms,$p95_response_time" >> "$RESULTS_DIR/concurrent_metrics.csv"
    else
        log "ERROR" "并发测试未能收集到响应时间数据"
    fi

    log "SUCCESS" "✅ 并发请求测试完成"
}

# 内存和CPU使用率监控
resource_monitoring() {
    log "INFO" "📊 执行资源使用率监控..."

    # 检查是否有PID文件（假设服务正在运行）
    local pid_file=""
    if [ -f "apps/backend-gateway/backend-gateway.pid" ]; then
        pid_file="apps/backend-gateway/backend-gateway.pid"
    fi

    if [ -n "$pid_file" ] && [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        log "INFO" "监控进程 PID: $pid"

        # 使用ps命令监控资源使用率
        if command -v ps &> /dev/null; then
            local cpu_usage=$(ps -p "$pid" -o pcpu= | tr -d ' ')
            local mem_usage=$(ps -p "$pid" -o pmem= | tr -d ' ')

            log "PERF" "资源使用率监控:"
            log "PERF" "  - CPU使用率: ${cpu_usage}%"
            log "PERF" "  - 内存使用率: ${mem_usage}%"

            echo "cpu_usage_percent,$cpu_usage" > "$RESULTS_DIR/resource_usage.csv"
            echo "memory_usage_percent,$mem_usage" >> "$RESULTS_DIR/resource_usage.csv"
        else
            log "WARNING" "ps命令不可用，跳过资源监控"
        fi
    else
        log "WARNING" "未找到运行中的服务进程，跳过资源监控"
        echo "cpu_usage_percent,N/A" > "$RESULTS_DIR/resource_usage.csv"
        echo "memory_usage_percent,N/A" >> "$RESULTS_DIR/resource_usage.csv"
    fi

    log "SUCCESS" "✅ 资源监控完成"
}

# 生成性能报告
generate_report() {
    log "INFO" "📋 生成性能测试报告..."

    local report_file="$RESULTS_DIR/performance-report.md"

    cat > "$report_file" << EOF
# 🚀 性能测试报告

生成时间: $(date '+%Y-%m-%d %H:%M:%S')
测试持续时间: ${TEST_DURATION}秒
并发请求数: ${CONCURRENT_REQUESTS}

## 📊 测试配置

- **目标URL**: $TARGET_URL
- **测试时长**: ${TEST_DURATION}秒
- **并发数**: $CONCURRENT_REQUESTS
- **预热请求**: $WARMUP_REQUESTS

## 📈 性能指标

EOF

    # 添加并发测试结果
    if [ -f "$RESULTS_DIR/concurrent_metrics.csv" ]; then
        echo "### 并发性能测试" >> "$report_file"
        echo "" >> "$report_file"

        while IFS=',' read -r metric value; do
            case "$metric" in
                "total_requests") echo "- **总请求数**: $value" >> "$report_file" ;;
                "successful_requests") echo "- **成功请求数**: $value" >> "$report_file" ;;
                "qps") echo "- **QPS (每秒查询数)**: $value" >> "$report_file" ;;
                "avg_response_time_ms") echo "- **平均响应时间**: ${value}ms" >> "$report_file" ;;
                "min_response_time_ms") echo "- **最快响应时间**: ${value}ms" >> "$report_file" ;;
                "max_response_time_ms") echo "- **最慢响应时间**: ${value}ms" >> "$report_file" ;;
                "p95_response_time_ms") echo "- **P95响应时间**: ${value}ms" >> "$report_file" ;;
            esac
        done < "$RESULTS_DIR/concurrent_metrics.csv"
    fi

    # 添加资源使用率
    if [ -f "$RESULTS_DIR/resource_usage.csv" ]; then
        echo "" >> "$report_file"
        echo "### 资源使用率" >> "$report_file"
        echo "" >> "$report_file"

        while IFS=',' read -r metric value; do
            case "$metric" in
                "cpu_usage_percent") echo "- **CPU使用率**: ${value}%" >> "$report_file" ;;
                "memory_usage_percent") echo "- **内存使用率**: ${value}%" >> "$report_file" ;;
            esac
        done < "$RESULTS_DIR/resource_usage.csv"
    fi

    # 性能评估
    echo "" >> "$report_file"
    echo "## 🎯 性能评估" >> "$report_file"
    echo "" >> "$report_file"

    # 从结果中提取QPS进行评估
    if [ -f "$RESULTS_DIR/concurrent_metrics.csv" ]; then
        local qps=$(grep "qps," "$RESULTS_DIR/concurrent_metrics.csv" | cut -d',' -f2)
        local avg_response=$(grep "avg_response_time_ms," "$RESULTS_DIR/concurrent_metrics.csv" | cut -d',' -f2)

        if (( qps >= 100 )) && (( avg_response <= 200 )); then
            echo "✅ **性能表现优秀**" >> "$report_file"
            echo "- QPS ≥ 100, 平均响应时间 ≤ 200ms" >> "$report_file"
        elif (( qps >= 50 )) && (( avg_response <= 500 )); then
            echo "⚠️ **性能表现良好**" >> "$report_file"
            echo "- QPS ≥ 50, 平均响应时间 ≤ 500ms" >> "$report_file"
        else
            echo "❌ **性能需要优化**" >> "$report_file"
            echo "- QPS < 50 或 平均响应时间 > 500ms" >> "$report_file"
        fi
    fi

    echo "" >> "$report_file"
    echo "## 📁 测试数据文件" >> "$report_file"
    echo "" >> "$report_file"
    echo "- \`performance.log\` - 测试日志" >> "$report_file"
    echo "- \`single_requests.csv\` - 单次请求详细数据" >> "$report_file"
    echo "- \`concurrent_metrics.csv\` - 并发测试汇总指标" >> "$report_file"
    echo "- \`resource_usage.csv\` - 资源使用率数据" >> "$report_file"

    log "SUCCESS" "✅ 性能报告生成完成: $report_file"
}

# 主函数
main() {
    log "INFO" "🚀 开始工业级性能测试流程"
    log "INFO" "结果目录: $RESULTS_DIR"

    # 执行测试阶段
    check_dependencies
    warmup_service
    single_request_test
    concurrent_requests_test
    resource_monitoring

    # 生成报告
    generate_report

    local total_duration=$(( $(date +%s) - $(date +%s - $TEST_DURATION) ))
    log "SUCCESS" "🎉 性能测试完成！"
    log "SUCCESS" "总耗时: ${total_duration}s"
    log "SUCCESS" "完整报告: $RESULTS_DIR/performance-report.md"
}

# 参数处理
case "${1:-}" in
    "check")
        check_dependencies
        ;;
    "warmup")
        warmup_service
        ;;
    "single")
        single_request_test
        ;;
    "concurrent")
        concurrent_requests_test
        ;;
    "resources")
        resource_monitoring
        ;;
    "report")
        generate_report
        ;;
    *)
        main
        ;;
esac
