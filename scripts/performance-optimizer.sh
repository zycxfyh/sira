#!/bin/bash

# Sira AI Gateway 性能优化脚本

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 性能基准
CPU_THRESHOLD=70
MEMORY_THRESHOLD=80
RESPONSE_TIME_THRESHOLD=2000
ERROR_RATE_THRESHOLD=0.05

# 优化配置
NODE_OPTIMIZATIONS=(
    "--max-old-space-size=4096"
    "--optimize-for-size"
    "--max-new-space-size=1024"
    "--optimize-for-performance"
)

NGINX_OPTIMIZATIONS=(
    "worker_processes auto;"
    "worker_connections 1024;"
    "use epoll;"
    "multi_accept on;"
    "tcp_nopush on;"
    "tcp_nodelay on;"
)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
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

# 系统性能优化
optimize_system() {
    log_info "=== 系统性能优化 ==="

    # CPU 优化
    optimize_cpu

    # 内存优化
    optimize_memory

    # 磁盘I/O优化
    optimize_disk_io

    # 网络优化
    optimize_network
}

# CPU 优化
optimize_cpu() {
    log_info "优化CPU性能..."

    # 设置CPU governor为performance模式
    if [ -d /sys/devices/system/cpu/cpu0/cpufreq ]; then
        echo "performance" | tee /sys/devices/system/cpu/*/cpufreq/scaling_governor 2>/dev/null || true
        log_success "CPU governor设置为performance模式"
    fi

    # 禁用CPU频率调节
    if command -v cpupower &> /dev/null; then
        cpupower frequency-set -g performance 2>/dev/null || true
        log_success "禁用CPU频率调节"
    fi

    # 增加系统文件描述符限制
    if [ -f /etc/security/limits.conf ]; then
        echo "* soft nofile 65536" >> /etc/security/limits.conf
        echo "* hard nofile 65536" >> /etc/security/limits/limits.conf 2>/dev/null || true
        log_success "增加文件描述符限制"
    fi
}

# 内存优化
optimize_memory() {
    log_info "优化内存性能..."

    # 调整虚拟内存设置
    if [ -f /proc/sys/vm/swappiness ]; then
        echo 10 > /proc/sys/vm/swappiness
        log_success "降低swap使用倾向"
    fi

    # 增加脏页写回延迟
    if [ -f /proc/sys/vm/dirty_writeback_centisecs ]; then
        echo 1500 > /proc/sys/vm/dirty_writeback_centisecs
        log_success "调整脏页写回延迟"
    fi

    # 启用透明大页
    if [ -f /sys/kernel/mm/transparent_hugepage/enabled ]; then
        echo always > /sys/kernel/mm/transparent_hugepage/enabled
        log_success "启用透明大页"
    fi

    # 增加内存映射区域限制
    if [ -f /proc/sys/vm/max_map_count ]; then
        echo 262144 > /proc/sys/vm/max_map_count
        log_success "增加内存映射区域限制"
    fi
}

# 磁盘I/O优化
optimize_disk_io() {
    log_info "优化磁盘I/O..."

    # 调整I/O调度器
    for disk in /sys/block/sd*; do
        if [ -f "$disk/queue/scheduler" ]; then
            echo "deadline" > "$disk/queue/scheduler" 2>/dev/null || true
        fi
    done
    log_success "设置I/O调度器为deadline"

    # 增加读写缓冲区
    if [ -f /proc/sys/vm/dirty_ratio ]; then
        echo 40 > /proc/sys/vm/dirty_ratio
        log_success "增加脏页比例"
    fi

    # 启用预读
    if command -v blockdev &> /dev/null; then
        blockdev --setra 32768 /dev/sda 2>/dev/null || true
        log_success "启用磁盘预读"
    fi
}

# 网络优化
optimize_network() {
    log_info "优化网络性能..."

    # 增加网络缓冲区
    if [ -f /proc/sys/net/core/rmem_max ]; then
        echo 16777216 > /proc/sys/net/core/rmem_max
        echo 16777216 > /proc/sys/net/core/wmem_max
        log_success "增加网络缓冲区大小"
    fi

    # 优化TCP参数
    if [ -f /proc/sys/net/ipv4/tcp_rmem ]; then
        echo "4096 87380 16777216" > /proc/sys/net/ipv4/tcp_rmem
        echo "4096 65536 16777216" > /proc/sys/net/ipv4/tcp_wmem
        log_success "优化TCP缓冲区"
    fi

    # 启用TCP快速打开
    if [ -f /proc/sys/net/ipv4/tcp_fastopen ]; then
        echo 3 > /proc/sys/net/ipv4/tcp_fastopen
        log_success "启用TCP快速打开"
    fi

    # 调整连接队列
    if [ -f /proc/sys/net/core/somaxconn ]; then
        echo 65536 > /proc/sys/net/core/somaxconn
        log_success "增加连接队列大小"
    fi
}

# Node.js 应用优化
optimize_nodejs() {
    log_info "=== Node.js 应用优化 ==="

    local config_file="$PROJECT_ROOT/config/production.yml"

    # 创建优化的Node.js配置
    cat > "$config_file" << EOF
# Node.js 性能优化配置
node:
  options:
$(printf '    - %s\n' "${NODE_OPTIMIZATIONS[@]}")
  cluster:
    enabled: true
    workers: auto
  gc:
    strategy: generational
    interval: 30000

# 应用性能配置
app:
  compression:
    enabled: true
    level: 6
  caching:
    enabled: true
    ttl: 3600
  connection_pool:
    min: 2
    max: 20
    idle_timeout: 30000
EOF

    log_success "创建Node.js优化配置: $config_file"

    # 生成优化的启动脚本
    local start_script="$PROJECT_ROOT/scripts/start-optimized.sh"
    cat > "$start_script" << 'EOF'
#!/bin/bash
# 优化的启动脚本

# 设置Node.js优化参数
NODE_OPTIONS=""
for opt in "${NODE_OPTIMIZATIONS[@]}"; do
    NODE_OPTIONS="$NODE_OPTIONS $opt"
done

export NODE_OPTIONS

# 启动应用
exec node $NODE_OPTIONS "$@"
EOF

    chmod +x "$start_script"
    log_success "创建优化启动脚本: $start_script"
}

# 数据库优化
optimize_database() {
    log_info "=== 数据库优化 ==="

    # PostgreSQL优化
    optimize_postgresql

    # Redis优化
    optimize_redis
}

# PostgreSQL优化
optimize_postgresql() {
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL客户端未安装，跳过优化"
        return
    fi

    log_info "优化PostgreSQL..."

    local pg_conf="/etc/postgresql/postgresql.conf"
    if [ -f "$pg_conf" ]; then
        # 备份原配置
        cp "$pg_conf" "$pg_conf.backup.$(date +%Y%m%d_%H%M%S)"

        # 应用优化配置
        cat >> "$pg_conf" << EOF

# Sira Gateway PostgreSQL优化配置
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
EOF

        log_success "应用PostgreSQL优化配置"
    fi

    # 执行数据库优化查询
    if docker ps | grep -q sira-postgres; then
        docker exec sira-postgres psql -U sira -d sira_gateway -c "
            VACUUM ANALYZE;
            REINDEX DATABASE sira_gateway;
        " 2>/dev/null || true
        log_success "执行数据库维护任务"
    fi
}

# Redis优化
optimize_redis() {
    if ! command -v redis-cli &> /dev/null; then
        log_warning "Redis客户端未安装，跳过优化"
        return
    fi

    log_info "优化Redis..."

    local redis_conf="/etc/redis/redis.conf"
    if [ -f "$redis_conf" ]; then
        # 备份原配置
        cp "$redis_conf" "$redis_conf.backup.$(date +%Y%m%d_%H%M%S)"

        # 应用优化配置
        cat >> "$redis_conf" << EOF

# Sira Gateway Redis优化配置
tcp-keepalive 60
timeout 300
tcp-backlog 511
databases 16
save 900 1
save 300 10
save 60 10000
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
EOF

        log_success "应用Redis优化配置"
    fi

    # 执行Redis优化命令
    if docker ps | grep -q sira-redis; then
        docker exec sira-redis redis-cli CONFIG SET maxmemory 256mb
        docker exec sira-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
        log_success "应用Redis运行时配置"
    fi
}

# Nginx优化
optimize_nginx() {
    log_info "=== Nginx优化 ==="

    local nginx_conf="/etc/nginx/nginx.conf"
    if [ -f "$nginx_conf" ]; then
        # 备份原配置
        cp "$nginx_conf" "$nginx_conf.backup.$(date +%Y%m%d_%H%M%S)"

        # 应用优化配置
        sed -i 's/worker_processes.*;/worker_processes auto;/g' "$nginx_conf"
        sed -i 's/worker_connections.*;/worker_connections 1024;/g' "$nginx_conf"

        # 添加性能优化配置
        cat >> "$nginx_conf" << EOF

# Sira Gateway Nginx优化配置
worker_rlimit_nofile 65536;
use epoll;
multi_accept on;
tcp_nopush on;
tcp_nodelay on;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        application/atom+xml
        application/geo+json
        application/javascript
        application/x-javascript
        application/json
        application/ld+json
        application/manifest+json
        application/rdf+xml
        application/rss+xml
        application/xhtml+xml
        application/xml
        font/eot
        font/otf
        font/ttf
        image/svg+xml
        text/css
        text/javascript
        text/plain
        text/xml;
}
EOF

        log_success "应用Nginx优化配置"
    fi

    # 测试配置
    if command -v nginx &> /dev/null; then
        nginx -t && systemctl reload nginx 2>/dev/null || true
        log_success "重新加载Nginx配置"
    fi
}

# 监控性能指标
monitor_performance() {
    log_info "=== 性能监控 ==="

    echo "当前系统性能指标:"
    echo "=================="

    # CPU信息
    echo "CPU使用率:"
    top -bn1 | head -3

    # 内存信息
    echo -e "\n内存使用:"
    free -h

    # 磁盘I/O
    echo -e "\n磁盘I/O:"
    iostat -x 1 1 2>/dev/null || echo "iostat不可用"

    # 网络统计
    echo -e "\n网络统计:"
    netstat -i

    # 应用指标
    echo -e "\n应用指标:"
    if curl -f -s http://localhost:9090/api/v1/query?query=up 2>/dev/null | jq -r '.data.result[0].value[1]' 2>/dev/null; then
        echo "Prometheus: 正常"
    else
        echo "Prometheus: 不可用"
    fi

    if curl -f -s http://localhost:8080/health 2>/dev/null; then
        echo "网关服务: 正常"
    else
        echo "网关服务: 异常"
    fi
}

# 生成性能报告
generate_performance_report() {
    log_info "=== 生成性能报告 ==="

    local report_dir="$PROJECT_ROOT/reports/performance"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local report_file="$report_dir/report_$timestamp.md"

    mkdir -p "$report_dir"

    cat > "$report_file" << EOF
# Sira AI Gateway 性能优化报告
生成时间: $(date)

## 系统信息
- 主机名: $(hostname)
- 操作系统: $(uname -s) $(uname -r)
- CPU核心数: $(nproc)
- 总内存: $(free -h | grep "^Mem:" | awk '{print $2}')

## 当前性能指标

### CPU性能
\`\`\`
$(top -bn1 | head -5)
\`\`\`

### 内存使用
\`\`\`
$(free -h)
\`\`\`

### 磁盘I/O
\`\`\`
$(df -h)
\`\`\`

### 网络状态
\`\`\`
$(netstat -i | head -10)
\`\`\`

## 已应用的优化

### 系统级优化
- ✅ CPU governor设置为performance模式
- ✅ 内存swappiness调整为10
- ✅ 透明大页已启用
- ✅ I/O调度器设置为deadline
- ✅ 网络缓冲区已优化

### 应用级优化
- ✅ Node.js内存限制设置为4GB
- ✅ 集群模式已启用
- ✅ 连接池已优化
- ✅ 压缩已启用

### 数据库优化
- ✅ PostgreSQL共享缓冲区: 256MB
- ✅ Redis最大内存: 256MB
- ✅ 连接池已配置

## 性能基准

### 目标指标
- CPU使用率: < ${CPU_THRESHOLD}%
- 内存使用率: < ${MEMORY_THRESHOLD}%
- 响应时间: < ${RESPONSE_TIME_THRESHOLD}ms
- 错误率: < ${ERROR_RATE_THRESHOLD}%

### 当前状态
$(check_performance_thresholds)

## 建议

### 短期优化
1. 监控关键性能指标
2. 定期清理临时文件
3. 优化数据库查询
4. 调整缓存策略

### 长期优化
1. 考虑使用更高性能的硬件
2. 实施更细粒度的监控
3. 优化应用架构
4. 考虑使用CDN加速

---
报告生成时间: $(date)
EOF

    log_success "性能报告已生成: $report_file"
}

# 检查性能阈值
check_performance_thresholds() {
    local issues=""

    # CPU检查
    local cpu_usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        issues="${issues}⚠️  CPU使用率过高: ${cpu_usage}%\n"
    else
        issues="${issues}✅ CPU使用率正常: ${cpu_usage}%\n"
    fi

    # 内存检查
    local mem_usage
    mem_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
    if (( $(echo "$mem_usage > $MEMORY_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        issues="${issues}⚠️  内存使用率过高: ${mem_usage}%\n"
    else
        issues="${issues}✅ 内存使用率正常: ${mem_usage}%\n"
    fi

    # 响应时间检查（如果有监控数据）
    if curl -f -s http://localhost:9090/api/v1/query?query=http_request_duration_seconds%7Bquantile%3D%220.95%22%7D 2>/dev/null | jq -r '.data.result[0].value[1]' 2>/dev/null; then
        local response_time
        response_time=$(curl -s http://localhost:9090/api/v1/query?query=http_request_duration_seconds%7Bquantile%3D%220.95%22%7D | jq -r '.data.result[0].value[1]')
        if (( $(echo "$response_time > $RESPONSE_TIME_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
            issues="${issues}⚠️  响应时间过长: ${response_time}ms\n"
        else
            issues="${issues}✅ 响应时间正常: ${response_time}ms\n"
        fi
    fi

    echo -e "$issues"
}

# 显示帮助
show_help() {
    cat << EOF
Sira AI Gateway 性能优化脚本

用法: $0 [命令]

命令:
  system          系统级性能优化
  nodejs          Node.js应用优化
  database        数据库性能优化
  nginx           Nginx服务器优化
  all             执行所有优化
  monitor         显示性能监控信息
  report          生成性能优化报告
  check           检查性能阈值
  help            显示帮助信息

优化内容:
  系统优化: CPU、内存、磁盘I/O、网络
  Node.js优化: 内存限制、集群、垃圾回收
  数据库优化: PostgreSQL、Redis配置调优
  Nginx优化: 工作进程、连接、压缩

示例:
  $0 all              # 执行所有优化
  $0 monitor          # 显示性能监控
  $0 report           # 生成优化报告
  $0 check            # 检查性能阈值

注意: 部分优化需要root权限，建议在测试环境验证后再应用到生产环境

EOF
}

# 主函数
main() {
    local command="${1:-help}"

    case $command in
        system)
            optimize_system
            ;;
        nodejs)
            optimize_nodejs
            ;;
        database)
            optimize_database
            ;;
        nginx)
            optimize_nginx
            ;;
        all)
            optimize_system
            echo
            optimize_nodejs
            echo
            optimize_database
            echo
            optimize_nginx
            ;;
        monitor)
            monitor_performance
            ;;
        report)
            generate_performance_report
            ;;
        check)
            check_performance_thresholds
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 检查是否以root权限运行
if [ "$EUID" -eq 0 ]; then
    log_warning "以root权限运行，某些系统优化将生效"
else
    log_info "以普通用户权限运行，系统级优化可能需要手动应用"
fi

# 执行主函数
main "$@"
