# 📜 Scripts 脚本工具模块

## 📋 概述

Scripts模块提供了全面的运维脚本工具集，支持性能测试、部署管理、系统监控和维护操作。该模块采用Shell脚本和Node.js脚本相结合的方式，实现了从开发到生产的完整生命周期管理。

## 🏗️ 架构组成

```
scripts/
├── benchmark-performance.sh    # 性能基准测试
├── deploy-production.sh        # 生产环境部署
├── deploy-staging.sh          # Staging环境部署
├── monitor-system.sh          # 系统监控脚本 (451行)
├── run-regression-tests.sh    # 回归测试执行
├── test-integrations.sh       # 集成测试脚本
└── ai-gateway/                # AI网关专用脚本目录
    ├── benchmark-performance.sh
    ├── deploy-production.sh
    ├── deploy-staging.sh
    ├── monitor-system.sh
    ├── run-regression-tests.sh
    └── test-integrations.sh
```

## 🚀 核心脚本详解

### 1. 系统监控脚本 (monitor-system.sh)

**功能特性**:
- 🔍 实时系统资源监控
- 📊 性能指标收集
- 🚨 异常告警检测
- 📈 趋势分析报告
- 💾 日志轮转管理

**监控指标**:
```bash
#!/bin/bash

# CPU使用率监控
monitor_cpu() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    echo "CPU Usage: ${cpu_usage}%"

    if (( $(echo "$cpu_usage > 90" | bc -l) )); then
        alert "HIGH CPU USAGE" "CPU usage is ${cpu_usage}%"
    fi
}

# 内存使用监控
monitor_memory() {
    local mem_info=$(free | grep Mem)
    local total=$(echo $mem_info | awk '{print $2}')
    local used=$(echo $mem_info | awk '{print $3}')
    local usage_percent=$(( used * 100 / total ))

    echo "Memory Usage: ${usage_percent}% (${used}KB/${total}KB)"

    if [ $usage_percent -gt 90 ]; then
        alert "HIGH MEMORY USAGE" "Memory usage is ${usage_percent}%"
    fi
}

# 磁盘使用监控
monitor_disk() {
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

    if [ $disk_usage -gt 90 ]; then
        alert "HIGH DISK USAGE" "Disk usage is ${disk_usage}%"
    fi
}

# 网络连接监控
monitor_network() {
    local connections=$(netstat -tun | grep ESTABLISHED | wc -l)
    echo "Active connections: $connections"

    if [ $connections -gt 1000 ]; then
        alert "HIGH NETWORK CONNECTIONS" "$connections active connections"
    fi
}

# 服务健康检查
monitor_services() {
    local services=("ai-gateway" "kong" "redis" "nats" "prometheus")

    for service in "${services[@]}"; do
        if docker-compose ps $service | grep -q "Up"; then
            echo "✅ $service is running"
        else
            alert "SERVICE DOWN" "$service is not running"
        fi
    done
}

# AI网关特定监控
monitor_ai_gateway() {
    # API响应时间监控
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" http://localhost:8080/health)
    echo "Sira response time: ${response_time}s"

    if (( $(echo "$response_time > 5.0" | bc -l) )); then
        alert "SLOW RESPONSE" "Sira response time: ${response_time}s"
    fi

    # 缓存命中率监控
    local cache_stats=$(curl -s http://localhost:8080/cache/stats)
    local hit_ratio=$(echo $cache_stats | jq '.hit_ratio')

    if (( $(echo "$hit_ratio < 0.8" | bc -l) )); then
        alert "LOW CACHE HIT RATIO" "Cache hit ratio: $hit_ratio"
    fi
}

# Prometheus指标收集
collect_metrics() {
    local timestamp=$(date +%s)

    # 系统指标
    echo "system_cpu_usage $cpu_usage $timestamp" >> metrics.txt
    echo "system_memory_usage $usage_percent $timestamp" >> metrics.txt

    # 应用指标
    echo "ai_gateway_response_time $response_time $timestamp" >> metrics.txt
    echo "ai_gateway_cache_hit_ratio $hit_ratio $timestamp" >> metrics.txt
}

# 告警函数
alert() {
    local subject="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[$timestamp] ALERT: $subject - $message" >> alerts.log

    # 发送邮件告警 (可选)
    if [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "Sira Alert: $subject" "$ALERT_EMAIL"
    fi

    # 发送Slack告警 (可选)
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"Sira Alert: $subject - $message\"}" \
             "$SLACK_WEBHOOK"
    fi
}

# 主监控循环
main() {
    echo "Starting Sira monitoring system..."
    echo "Press Ctrl+C to stop"

    while true; do
        echo "=== $(date) ==="

        monitor_cpu
        monitor_memory
        monitor_disk
        monitor_network
        monitor_services
        monitor_ai_gateway

        collect_metrics

        echo "Monitoring cycle completed. Sleeping for 60 seconds..."
        sleep 60
    done
}

# 参数处理
case "$1" in
    "cpu") monitor_cpu ;;
    "memory") monitor_memory ;;
    "disk") monitor_disk ;;
    "network") monitor_network ;;
    "services") monitor_services ;;
    "ai-gateway") monitor_ai_gateway ;;
    *) main ;;
esac
```

### 2. 部署脚本

#### 生产环境部署 (deploy-production.sh)

**部署流程**:
```bash
#!/bin/bash

# 部署前置检查
pre_deploy_check() {
    echo "🔍 执行部署前置检查..."

    # 检查Docker状态
    if ! docker info > /dev/null 2>&1; then
        echo "❌ Docker未运行"
        exit 1
    fi

    # 检查环境变量
    if [ -z "$OPENAI_API_KEY" ]; then
        echo "❌ OPENAI_API_KEY环境变量未设置"
        exit 1
    fi

    # 检查配置文件
    if [ ! -f "docker/production/docker-compose.yml" ]; then
        echo "❌ 生产环境配置文件不存在"
        exit 1
    fi

    echo "✅ 前置检查通过"
}

# 备份当前部署
backup_current_deployment() {
    echo "💾 备份当前部署..."

    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    # 备份配置文件
    cp docker/production/docker-compose.yml "$backup_dir/"

    # 备份环境变量
    cp .env "$backup_dir/" 2>/dev/null || true

    # 备份数据卷 (如果需要)
    docker run --rm -v ai-gateway_prometheus_data:/data \
           -v "$backup_dir":/backup alpine \
           tar czf /backup/prometheus-backup.tar.gz -C /data .

    echo "✅ 备份完成: $backup_dir"
}

# 部署新版本
deploy_new_version() {
    echo "🚀 部署新版本..."

    # 拉取最新镜像
    docker-compose -f docker/production/docker-compose.yml pull

    # 滚动更新服务
    docker-compose -f docker/production/docker-compose.yml up -d \
                   --scale ai-gateway=2 \
                   --no-deps ai-gateway

    # 等待健康检查
    echo "⏳ 等待服务就绪..."
    sleep 30

    # 验证部署
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ 部署成功"

        # 缩放到正常实例数
        docker-compose -f docker/production/docker-compose.yml up -d \
                       --scale ai-gateway=1
    else
        echo "❌ 部署失败，执行回滚..."
        rollback_deployment
        exit 1
    fi
}

# 回滚部署
rollback_deployment() {
    echo "🔄 执行回滚..."

    # 停止当前服务
    docker-compose -f docker/production/docker-compose.yml down

    # 恢复备份
    if [ -d "backups/latest" ]; then
        cp backups/latest/docker-compose.yml docker/production/
        cp backups/latest/.env .env 2>/dev/null || true
    fi

    # 重启服务
    docker-compose -f docker/production/docker-compose.yml up -d

    echo "✅ 回滚完成"
}

# 部署后验证
post_deploy_verification() {
    echo "🔍 执行部署后验证..."

    # 健康检查
    if ! curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo "❌ 健康检查失败"
        return 1
    fi

    # API功能测试
    local test_response=$(curl -s -X POST http://localhost:8080/api/v1/ai/chat/completions \
                         -H "Content-Type: application/json" \
                         -H "x-api-key: test-key" \
                         -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}')

    if echo "$test_response" | jq -e '.error' > /dev/null 2>&1; then
        echo "❌ API功能测试失败"
        return 1
    fi

    # 监控服务检查
    if ! curl -f http://localhost:9090/-/healthy > /dev/null 2>&1; then
        echo "❌ Prometheus健康检查失败"
        return 1
    fi

    echo "✅ 部署后验证通过"
}

# 主部署流程
main() {
    echo "🏗️  开始Sira生产环境部署"

    pre_deploy_check
    backup_current_deployment
    deploy_new_version

    if post_deploy_verification; then
        echo "🎉 部署成功完成"
        update_latest_backup
    else
        echo "💥 部署验证失败"
        exit 1
    fi
}

# 参数处理
case "$1" in
    "check") pre_deploy_check ;;
    "backup") backup_current_deployment ;;
    "rollback") rollback_deployment ;;
    "verify") post_deploy_verification ;;
    *) main ;;
esac
```

#### Staging环境部署 (deploy-staging.sh)

**轻量级部署**:
```bash
#!/bin/bash

# Staging环境快速部署
deploy_staging() {
    echo "🚀 部署到Staging环境..."

    cd docker/staging

    # 构建镜像
    docker-compose build --no-cache

    # 部署服务
    docker-compose up -d

    # 运行集成测试
    docker-compose exec ai-gateway npm run test:integration

    echo "✅ Staging部署完成"
}
```

### 3. 性能测试脚本 (benchmark-performance.sh)

**综合性能评估**:
```bash
#!/bin/bash

# 性能基准测试配置
TEST_DURATION=300          # 测试时长(秒)
CONCURRENT_USERS=50        # 并发用户数
RAMP_UP_TIME=30           # 爬坡时间(秒)
API_ENDPOINT="http://localhost:8080/api/v1/ai/chat/completions"

# 测试场景
TEST_SCENARIOS=(
    "light:10:5"          # 轻负载: 10并发, 5秒持续
    "medium:50:30"        # 中负载: 50并发, 30秒持续
    "heavy:100:60"        # 重负载: 100并发, 60秒持续
    "spike:200:10"        # 峰值负载: 200并发, 10秒持续
)

# AI请求负载
AI_REQUESTS=(
    '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
    '{"model":"gpt-4","messages":[{"role":"user","content":"Explain quantum computing"}]}'
    '{"model":"claude-3-haiku","messages":[{"role":"user","content":"Write a short story"}]}'
)

# 运行性能测试
run_performance_test() {
    local scenario=$1
    local concurrency=$2
    local duration=$3

    echo "🏃 运行性能测试场景: $scenario"
    echo "并发数: $concurrency, 持续时间: ${duration}秒"

    # 使用Apache Bench进行测试
    ab -n $((concurrency * duration)) \
       -c $concurrency \
       -T "application/json" \
       -H "x-api-key: benchmark-key" \
       -p ai_request.json \
       "$API_ENDPOINT" \
       > "results/${scenario}.txt"

    # 分析结果
    analyze_results "results/${scenario}.txt"
}

# 分析测试结果
analyze_results() {
    local result_file=$1

    echo "📊 分析测试结果: $result_file"

    # 提取关键指标
    local requests_per_sec=$(grep "Requests per second" "$result_file" | awk '{print $4}')
    local time_per_request=$(grep "Time per request.*mean" "$result_file" | awk '{print $4}')
    local transfer_rate=$(grep "Transfer rate" "$result_file" | awk '{print $3}')

    echo "请求/秒: $requests_per_sec"
    echo "平均响应时间: ${time_per_request}ms"
    echo "传输速率: ${transfer_rate}KB/s"

    # 性能评估
    if (( $(echo "$time_per_request > 2000" | bc -l) )); then
        echo "⚠️  响应时间过长 (>2秒)"
    fi

    if (( $(echo "$requests_per_sec < 10" | bc -l) )); then
        echo "⚠️  吞吐量较低 (<10 req/s)"
    fi
}

# 系统资源监控
monitor_resources() {
    echo "🔍 监控系统资源使用情况..."

    # CPU使用率
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')

    # 内存使用率
    local mem_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')

    # 磁盘I/O
    local disk_io=$(iostat -d 1 1 | grep sda | awk '{print $2}')

    echo "CPU使用率: ${cpu_usage}%"
    echo "内存使用率: ${mem_usage}%"
    echo "磁盘I/O: ${disk_io} KB/s"
}

# 生成性能报告
generate_report() {
    echo "📋 生成性能测试报告..."

    cat > performance-report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Sira性能测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { background: #f5f5f5; padding: 10px; margin: 10px 0; }
        .warning { color: #ff6b35; }
        .success { color: #4caf50; }
    </style>
</head>
<body>
    <h1>Sira性能测试报告</h1>
    <p>测试时间: $(date)</p>

    <h2>测试结果摘要</h2>
    $(for result in results/*.txt; do
        echo "<div class='metric'>"
        echo "<h3>$(basename "$result" .txt)</h3>"
        grep -E "(Requests per second|Time per request|Transfer rate)" "$result" | \
        sed 's/^/    /'
        echo "</div>"
    done)

    <h2>系统资源</h2>
    <div class='metric'>
        <p>CPU使用率: ${cpu_usage}%</p>
        <p>内存使用率: ${mem_usage}%</p>
        <p>磁盘I/O: ${disk_io} KB/s</p>
    </div>
</body>
</html>
EOF

    echo "✅ 报告生成完成: performance-report.html"
}

# 主测试流程
main() {
    echo "🧪 开始Sira性能测试"

    mkdir -p results

    # 准备测试数据
    echo "$AI_REQUESTS" | jq -r '.[0]' > ai_request.json

    # 运行所有测试场景
    for scenario in "${TEST_SCENARIOS[@]}"; do
        IFS=':' read -r name concurrency duration <<< "$scenario"
        run_performance_test "$name" "$concurrency" "$duration"
        sleep 10  # 场景间休息
    done

    # 监控资源使用
    monitor_resources

    # 生成报告
    generate_report

    echo "🎯 性能测试完成"
}

# 参数处理
case "$1" in
    "light") run_performance_test "light" 10 5 ;;
    "medium") run_performance_test "medium" 50 30 ;;
    "heavy") run_performance_test "heavy" 100 60 ;;
    "monitor") monitor_resources ;;
    "report") generate_report ;;
    *) main ;;
esac
```

### 4. 回归测试脚本 (run-regression-tests.sh)

**自动化回归测试**:
```bash
#!/bin/bash

# 回归测试配置
TEST_CATEGORIES=(
    "unit:单元测试"
    "integration:集成测试"
    "e2e:端到端测试"
    "performance:性能测试"
    "security:安全测试"
)

# 历史基准数据
BASELINE_FILE="regression-baseline.json"

# 运行回归测试
run_regression_tests() {
    echo "🔄 执行回归测试..."

    local results=()
    local failed_categories=()

    for category in "${TEST_CATEGORIES[@]}"; do
        IFS=':' read -r test_type display_name <<< "$category"

        echo "测试类别: $display_name"

        case $test_type in
            "unit")
                npm run test:unit > "results/unit.log" 2>&1
                ;;
            "integration")
                npm run test:integration > "results/integration.log" 2>&1
                ;;
            "e2e")
                npm run test:e2e > "results/e2e.log" 2>&1
                ;;
            "performance")
                ./scripts/benchmark-performance.sh medium > "results/performance.log" 2>&1
                ;;
            "security")
                npm run test:security > "results/security.log" 2>&1
                ;;
        esac

        local exit_code=$?
        results+=("$test_type:$exit_code")

        if [ $exit_code -ne 0 ]; then
            failed_categories+=("$display_name")
            echo "❌ $display_name 失败"
        else
            echo "✅ $display_name 通过"
        fi
    done

    # 保存结果
    echo "${results[@]}" > regression-results.txt

    # 报告失败的类别
    if [ ${#failed_categories[@]} -ne 0 ]; then
        echo "💥 以下测试类别失败:"
        printf '%s\n' "${failed_categories[@]}"
        return 1
    fi

    echo "✅ 所有回归测试通过"
}

# 与基准比较
compare_with_baseline() {
    echo "📊 与基准比较..."

    if [ ! -f "$BASELINE_FILE" ]; then
        echo "⚠️  基准文件不存在，创建新的基准"
        cp regression-results.txt "$BASELINE_FILE"
        return 0
    fi

    local baseline_results=($(cat "$BASELINE_FILE"))
    local current_results=($(cat regression-results.txt))

    local regressions=()

    for i in "${!current_results[@]}"; do
        IFS=':' read -r test_type current_code <<< "${current_results[$i]}"
        IFS=':' read -r baseline_type baseline_code <<< "${baseline_results[$i]}"

        if [ "$current_code" != "$baseline_code" ] && [ "$baseline_code" == "0" ]; then
            regressions+=("$test_type 从通过变为失败")
        fi
    done

    if [ ${#regressions[@]} -ne 0 ]; then
        echo "⚠️  发现回归:"
        printf '%s\n' "${regressions[@]}"
        return 1
    fi

    echo "✅ 无性能回归"
}

# 生成回归报告
generate_regression_report() {
    echo "📋 生成回归测试报告..."

    cat > regression-report.md << EOF
# Sira回归测试报告

**测试时间**: $(date)
**测试环境**: $(hostname)

## 测试结果

| 测试类别 | 状态 | 详情 |
|----------|------|------|
EOF

    local current_results=($(cat regression-results.txt))

    for result in "${current_results[@]}"; do
        IFS=':' read -r test_type exit_code <<< "$result"

        local status="✅ 通过"
        if [ "$exit_code" != "0" ]; then
            status="❌ 失败"
        fi

        local display_name=""
        for category in "${TEST_CATEGORIES[@]}"; do
            IFS=':' read -r cat_type cat_name <<< "$category"
            if [ "$cat_type" == "$test_type" ]; then
                display_name="$cat_name"
                break
            fi
        done

        echo "| $display_name | $status | [查看日志](results/${test_type}.log) |" >> regression-report.md
    done

    echo "" >> regression-report.md
    echo "## 回归分析" >> regression-report.md

    if compare_with_baseline 2>/dev/null; then
        echo "✅ 与基准相比无显著回归" >> regression-report.md
    else
        echo "⚠️  发现性能回归，请检查上述失败的测试" >> regression-report.md
    fi

    echo "✅ 回归报告生成完成: regression-report.md"
}

# 主回归测试流程
main() {
    echo "🔄 开始Sira回归测试"

    mkdir -p results

    if run_regression_tests; then
        compare_with_baseline
        generate_regression_report
        echo "🎉 回归测试完成"
    else
        echo "💥 回归测试失败"
        exit 1
    fi
}

# 参数处理
case "$1" in
    "unit") npm run test:unit ;;
    "integration") npm run test:integration ;;
    "e2e") npm run test:e2e ;;
    "performance") ./scripts/benchmark-performance.sh medium ;;
    "security") npm run test:security ;;
    "compare") compare_with_baseline ;;
    "report") generate_regression_report ;;
    *) main ;;
esac
```

## 📊 脚本统计信息

| 脚本名称 | 代码行数 | 功能描述 | 执行频率 |
|----------|----------|----------|----------|
| monitor-system.sh | 451行 | 全面系统监控 | 持续运行 |
| deploy-production.sh | 180行 | 生产环境部署 | 按需执行 |
| benchmark-performance.sh | 220行 | 性能基准测试 | 定期执行 |
| run-regression-tests.sh | 160行 | 回归测试执行 | CI/CD集成 |
| test-integrations.sh | 120行 | 集成测试脚本 | CI/CD集成 |
| deploy-staging.sh | 80行 | Staging部署 | 开发流程 |

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[部署指南](../DEPLOYMENT-GUIDE.md)** - 详细部署说明
- **[监控配置](../README-AI.md#监控)** - 可观测性配置
- **[测试运行](../README-AI.md#测试)** - 测试执行指南

## 🤝 使用指南

### 1. 监控系统启动
```bash
# 后台运行监控
nohup ./scripts/monitor-system.sh > monitor.log 2>&1 &

# 查看监控状态
tail -f monitor.log
```

### 2. 自动化部署
```bash
# 生产环境部署
./scripts/deploy-production.sh

# 仅执行部署验证
./scripts/deploy-production.sh verify
```

### 3. 性能评估
```bash
# 完整性能测试套件
./scripts/benchmark-performance.sh

# 特定负载测试
./scripts/benchmark-performance.sh heavy
```

### 4. 回归测试
```bash
# 完整回归测试
./scripts/run-regression-tests.sh

# 生成测试报告
./scripts/run-regression-tests.sh report
```

---

*最后更新: 2025年11月7日* | 🔙 [返回模块列表](../README.md#模块导航)
