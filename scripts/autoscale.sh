#!/bin/bash

# Sira AI Gateway 弹性伸缩脚本

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_MODE="${1:-docker}"

# 伸缩配置
MIN_REPLICAS=1
MAX_REPLICAS=10
CPU_THRESHOLD_HIGH=70
CPU_THRESHOLD_LOW=30
MEMORY_THRESHOLD_HIGH=75
MEMORY_THRESHOLD_LOW=40
REQUESTS_PER_SECOND_THRESHOLD=100

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

# 获取当前副本数
get_current_replicas() {
    case $DEPLOY_MODE in
        docker)
            docker-compose ps | grep -c "sira-gateway" || echo "1"
            ;;
        kubernetes)
            kubectl get deployment sira-gateway -n sira-gateway -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1"
            ;;
        *)
            echo "1"
            ;;
    esac
}

# 设置副本数
set_replicas() {
    local replicas=$1

    # 确保在有效范围内
    if [ "$replicas" -lt "$MIN_REPLICAS" ]; then
        replicas=$MIN_REPLICAS
    fi
    if [ "$replicas" -gt "$MAX_REPLICAS" ]; then
        replicas=$MAX_REPLICAS
    fi

    log_info "设置副本数为: $replicas"

    case $DEPLOY_MODE in
        docker)
            # Docker Compose 伸缩
            docker-compose up -d --scale sira-gateway=$replicas
            ;;
        kubernetes)
            # Kubernetes 伸缩
            kubectl scale deployment sira-gateway --replicas=$replicas -n sira-gateway
            ;;
    esac

    log_success "副本数已设置为: $replicas"
}

# 获取CPU使用率
get_cpu_usage() {
    case $DEPLOY_MODE in
        docker)
            # 获取所有 sira-gateway 容器的平均CPU使用率
            docker stats --no-stream --format "{{.CPUPerc}}" $(docker ps --filter "name=sira-gateway" --format "{{.Names}}") 2>/dev/null | \
            sed 's/%//' | awk '{sum+=$1} END {if(NR>0) print sum/NR; else print 0}'
            ;;
        kubernetes)
            # 获取 Kubernetes pod 的CPU使用率
            kubectl top pods -n sira-gateway --containers=true 2>/dev/null | \
            grep sira-gateway | awk '{print $3}' | sed 's/%//' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}'
            ;;
        *)
            echo "0"
            ;;
    esac
}

# 获取内存使用率
get_memory_usage() {
    case $DEPLOY_MODE in
        docker)
            # 获取所有 sira-gateway 容器的平均内存使用率
            docker stats --no-stream --format "{{.MemPerc}}" $(docker ps --filter "name=sira-gateway" --format "{{.Names}}") 2>/dev/null | \
            sed 's/%//' | awk '{sum+=$1} END {if(NR>0) print sum/NR; else print 0}'
            ;;
        kubernetes)
            # 获取 Kubernetes pod 的内存使用率
            kubectl top pods -n sira-gateway --containers=true 2>/dev/null | \
            grep sira-gateway | awk '{print $4}' | sed 's/%//' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}'
            ;;
        *)
            echo "0"
            ;;
    esac
}

# 获取请求率
get_request_rate() {
    # 从Prometheus或应用指标获取请求率
    # 这里简化实现，实际应该从监控系统获取
    curl -s http://localhost:9090/api/v1/query?query=http_requests_total%5B5m%5D 2>/dev/null | \
    jq -r '.data.result[0].value[1]' 2>/dev/null || echo "0"
}

# CPU 基础伸缩
scale_on_cpu() {
    local cpu_usage=$(get_cpu_usage)
    local current_replicas=$(get_current_replicas)

    log_info "当前CPU使用率: ${cpu_usage}%"
    log_info "当前副本数: $current_replicas"

    if (( $(echo "$cpu_usage > $CPU_THRESHOLD_HIGH" | bc -l 2>/dev/null || echo 0) )); then
        local new_replicas=$((current_replicas + 1))
        log_warning "CPU使用率过高 (${cpu_usage}%)，增加副本数到 $new_replicas"
        set_replicas $new_replicas

    elif (( $(echo "$cpu_usage < $CPU_THRESHOLD_LOW" | bc -l 2>/dev/null || echo 0) )) && [ "$current_replicas" -gt "$MIN_REPLICAS" ]; then
        local new_replicas=$((current_replicas - 1))
        log_info "CPU使用率较低 (${cpu_usage}%)，减少副本数到 $new_replicas"
        set_replicas $new_replicas

    else
        log_info "CPU使用率正常，无需伸缩"
    fi
}

# 内存基础伸缩
scale_on_memory() {
    local memory_usage=$(get_memory_usage)
    local current_replicas=$(get_current_replicas)

    log_info "当前内存使用率: ${memory_usage}%"
    log_info "当前副本数: $current_replicas"

    if (( $(echo "$memory_usage > $MEMORY_THRESHOLD_HIGH" | bc -l 2>/dev/null || echo 0) )); then
        local new_replicas=$((current_replicas + 1))
        log_warning "内存使用率过高 (${memory_usage}%)，增加副本数到 $new_replicas"
        set_replicas $new_replicas

    elif (( $(echo "$memory_usage < $MEMORY_THRESHOLD_LOW" | bc -l 2>/dev/null || echo 0) )) && [ "$current_replicas" -gt "$MIN_REPLICAS" ]; then
        local new_replicas=$((current_replicas - 1))
        log_info "内存使用率较低 (${memory_usage}%)，减少副本数到 $new_replicas"
        set_replicas $new_replicas

    else
        log_info "内存使用率正常，无需伸缩"
    fi
}

# 请求率基础伸缩
scale_on_requests() {
    local request_rate=$(get_request_rate)
    local current_replicas=$(get_current_replicas)

    log_info "当前请求率: ${request_rate} req/s"
    log_info "当前副本数: $current_replicas"

    # 计算目标副本数
    local target_replicas=1
    if (( $(echo "$request_rate > 0" | bc -l 2>/dev/null || echo 0) )); then
        target_replicas=$(( (request_rate / REQUESTS_PER_SECOND_THRESHOLD) + 1 ))
        target_replicas=$(( target_replicas > MAX_REPLICAS ? MAX_REPLICAS : target_replicas ))
        target_replicas=$(( target_replicas < MIN_REPLICAS ? MIN_REPLICAS : target_replicas ))
    fi

    if [ "$target_replicas" -ne "$current_replicas" ]; then
        log_info "根据请求率调整副本数从 $current_replicas 到 $target_replicas"
        set_replicas $target_replicas
    else
        log_info "请求率正常，副本数无需调整"
    fi
}

# 智能伸缩（结合多种指标）
scale_intelligent() {
    local cpu_usage=$(get_cpu_usage)
    local memory_usage=$(get_memory_usage)
    local request_rate=$(get_request_rate)
    local current_replicas=$(get_current_replicas)

    log_info "智能伸缩分析:"
    log_info "  CPU使用率: ${cpu_usage}%"
    log_info "  内存使用率: ${memory_usage}%"
    log_info "  请求率: ${request_rate} req/s"
    log_info "  当前副本数: $current_replicas"

    # 计算伸缩分数 (0-100, 越高表示越需要伸缩)
    local scale_score=0

    # CPU 贡献
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD_HIGH" | bc -l 2>/dev/null || echo 0) )); then
        scale_score=$((scale_score + 40))
    elif (( $(echo "$cpu_usage < $CPU_THRESHOLD_LOW" | bc -l 2>/dev/null || echo 0) )); then
        scale_score=$((scale_score - 20))
    fi

    # 内存贡献
    if (( $(echo "$memory_usage > $MEMORY_THRESHOLD_HIGH" | bc -l 2>/dev/null || echo 0) )); then
        scale_score=$((scale_score + 30))
    elif (( $(echo "$memory_usage < $MEMORY_THRESHOLD_LOW" | bc -l 2>/dev/null || echo 0) )); then
        scale_score=$((scale_score - 15))
    fi

    # 请求率贡献
    local requests_factor=$((request_rate / REQUESTS_PER_SECOND_THRESHOLD * 30))
    scale_score=$((scale_score + requests_factor))

    # 根据分数决定伸缩
    local new_replicas=$current_replicas

    if [ $scale_score -gt 50 ]; then
        new_replicas=$((current_replicas + 1))
        log_warning "伸缩分数过高 ($scale_score)，增加副本数到 $new_replicas"
    elif [ $scale_score -lt -20 ] && [ $current_replicas -gt $MIN_REPLICAS ]; then
        new_replicas=$((current_replicas - 1))
        log_info "伸缩分数较低 ($scale_score)，减少副本数到 $new_replicas"
    else
        log_info "伸缩分数正常 ($scale_score)，无需调整"
        return
    fi

    set_replicas $new_replicas
}

# 计划伸缩（基于时间模式）
scale_scheduled() {
    local hour=$(date +%H)
    local day=$(date +%w)  # 0=Sunday, 6=Saturday

    # 工作日模式
    if [ "$day" -ge 1 ] && [ "$day" -le 5 ]; then
        case $hour in
            09|10|11) set_replicas 3 ;;  # 上午高峰
            12|13) set_replicas 2 ;;     # 中午
            14|15|16|17) set_replicas 4 ;; # 下午高峰
            18|19) set_replicas 3 ;;     # 晚高峰
            *) set_replicas 1 ;;         # 其他时间
        esac
    # 周末模式
    else
        case $hour in
            10|11|12|13|14|15|16) set_replicas 2 ;; # 白天
            *) set_replicas 1 ;;                    # 其他时间
        esac
    fi

    log_info "计划伸缩已执行 (工作日: ${day}, 小时: ${hour})"
}

# 手动伸缩
scale_manual() {
    local replicas=$1

    if [ -z "$replicas" ]; then
        log_error "请指定副本数"
        echo "用法: $0 manual <副本数>"
        exit 1
    fi

    if ! [[ "$replicas" =~ ^[0-9]+$ ]]; then
        log_error "副本数必须是正整数"
        exit 1
    fi

    log_info "手动设置副本数为: $replicas"
    set_replicas $replicas
}

# 显示状态
show_status() {
    local current_replicas=$(get_current_replicas)
    local cpu_usage=$(get_cpu_usage)
    local memory_usage=$(get_memory_usage)
    local request_rate=$(get_request_rate)

    echo "=== Sira AI Gateway 伸缩状态 ==="
    echo "部署模式: $DEPLOY_MODE"
    echo "当前副本数: $current_replicas"
    echo "CPU 使用率: ${cpu_usage}%"
    echo "内存使用率: ${memory_usage}%"
    echo "请求率: ${request_rate} req/s"
    echo "副本数范围: $MIN_REPLICAS - $MAX_REPLICAS"
    echo "CPU 阈值: 高于 ${CPU_THRESHOLD_HIGH}% 扩展, 低于 ${CPU_THRESHOLD_LOW}% 收缩"
    echo "内存阈值: 高于 ${MEMORY_THRESHOLD_HIGH}% 扩展, 低于 ${MEMORY_THRESHOLD_LOW}% 收缩"
}

# 显示帮助
show_help() {
    cat << EOF
Sira AI Gateway 弹性伸缩脚本

用法: $0 [模式] [命令]

模式:
  docker         Docker 部署伸缩 (默认)
  kubernetes     Kubernetes 部署伸缩

命令:
  cpu            基于CPU使用率的伸缩
  memory         基于内存使用率的伸缩
  requests       基于请求率的伸缩
  intelligent    智能伸缩 (结合多种指标)
  scheduled      计划伸缩 (基于时间模式)
  manual <num>   手动设置副本数
  status         显示当前伸缩状态

示例:
  $0 docker cpu              # Docker 环境基于CPU伸缩
  $0 kubernetes intelligent  # Kubernetes 环境智能伸缩
  $0 manual 3                # 手动设置为3个副本
  $0 status                  # 显示伸缩状态

EOF
}

# 主函数
main() {
    local command="${2:-status}"

    case $command in
        cpu)
            scale_on_cpu
            ;;
        memory)
            scale_on_memory
            ;;
        requests)
            scale_on_requests
            ;;
        intelligent)
            scale_intelligent
            ;;
        scheduled)
            scale_scheduled
            ;;
        manual)
            scale_manual "$3"
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 检查依赖
check_dependencies() {
    if ! command -v bc &> /dev/null; then
        log_error "bc 命令不可用，请安装 bc"
        exit 1
    fi

    case $DEPLOY_MODE in
        docker)
            if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
                log_error "Docker 或 Docker Compose 不可用"
                exit 1
            fi
            ;;
        kubernetes)
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl 不可用"
                exit 1
            fi
            ;;
    esac
}

# 执行依赖检查
check_dependencies

# 执行主函数
main "$@"
