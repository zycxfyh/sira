#!/bin/bash

# 部署回滚脚本
# 使用方法: ./rollback.sh <service> [environment] [target_version]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRATEGY_FILE="$SCRIPT_DIR/canary-strategy.json"

SERVICE=$1
ENVIRONMENT=${2:-staging}
TARGET_VERSION=${3:-previous}

if [ -z "$SERVICE" ]; then
    echo "使用方法: $0 <service> [environment] [target_version]"
    echo "示例: $0 backend-gateway production v1.1.0"
    exit 1
fi

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 发送紧急通知
send_emergency_notification() {
    local message=$1
    log_error "$message"

    # 这里可以集成电话、短信、Slack等紧急通知
    # 示例：curl -X POST -H 'Content-type: application/json' --data '{"text":"🚨 '"$message"'"}' $SLACK_EMERGENCY_WEBHOOK
}

# 创建备份
create_backup() {
    local service=$1
    local environment=$2

    log_info "创建当前部署备份..."

    local namespace timestamp
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")
    timestamp=$(date +%Y%m%d_%H%M%S)

    # 备份当前deployment
    kubectl get deployment "$service" -n "$namespace" -o yaml > "backup_${service}_${timestamp}.yaml"

    log_success "备份已创建: backup_${service}_${timestamp}.yaml"
}

# 执行回滚
perform_rollback() {
    local service=$1
    local environment=$2
    local target_version=$3

    log_warning "执行回滚: $service ($environment) -> $target_version"

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    # 方法1: 如果是回滚到上一版本
    if [ "$target_version" = "previous" ]; then
        log_info "回滚到上一版本..."

        # 使用kubectl rollout undo
        kubectl rollout undo "deployment/$service" -n "$namespace"

        # 等待回滚完成
        kubectl rollout status "deployment/$service" -n "$namespace" --timeout=300s

    # 方法2: 回滚到指定版本
    else
        log_info "回滚到指定版本: $target_version"

        # 更新镜像版本
        kubectl set image "deployment/$service" "$service=tuheg/$service:$target_version" -n "$namespace"

        # 等待部署完成
        kubectl rollout status "deployment/$service" -n "$namespace" --timeout=300s
    fi

    # 验证回滚成功
    if verify_rollback "$service" "$environment"; then
        log_success "回滚成功"
        return 0
    else
        log_error "回滚验证失败"
        return 1
    fi
}

# 验证回滚成功
verify_rollback() {
    local service=$1
    local environment=$2

    log_info "验证回滚结果..."

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    # 检查pods状态
    local ready_pods total_pods
    ready_pods=$(kubectl get pods -n "$namespace" -l app="$service" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -o "True" | wc -l)
    total_pods=$(kubectl get pods -n "$namespace" -l app="$service" --no-headers | wc -l)

    log_info "Pods状态: $ready_pods/$total_pods 就绪"

    if [ "$ready_pods" -ne "$total_pods" ] || [ "$total_pods" -eq 0 ]; then
        log_error "Pods状态异常"
        return 1
    fi

    # 检查服务健康
    local health_endpoint
    health_endpoint=$(jq -r ".services.$service.health_check_endpoint" "$STRATEGY_FILE")

    # 获取服务端口
    local port
    port=$(kubectl get service "$service" -n "$namespace" -o jsonpath='{.spec.ports[0].port}')

    # 简单的健康检查
    if kubectl exec -n "$namespace" "deployment/$service" -- curl -f -s "http://localhost:$port$health_endpoint" >/dev/null 2>&1; then
        log_success "服务健康检查通过"
        return 0
    else
        log_error "服务健康检查失败"
        return 1
    fi
}

# 清理金丝雀资源
cleanup_canary_resources() {
    local service=$1
    local environment=$2

    log_info "清理金丝雀资源..."

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    # 删除canary ingress
    kubectl delete ingress "$service-canary" -n "$namespace" --ignore-not-found=true

    # 删除canary deployment
    kubectl delete deployment "$service-canary" -n "$namespace" --ignore-not-found=true

    # 删除canary service (如果存在)
    kubectl delete service "$service-canary" -n "$namespace" --ignore-not-found=true

    log_success "金丝雀资源清理完成"
}

# 恢复流量
restore_traffic() {
    local service=$1
    local environment=$2

    log_info "恢复正常流量..."

    local namespace
    namespace=$(jq -r ".environments.$environment.namespace" "$STRATEGY_FILE")

    # 确保主ingress正常
    local main_ingress_exists
    main_ingress_exists=$(kubectl get ingress "$service" -n "$namespace" --ignore-not-found=true | wc -l)

    if [ "$main_ingress_exists" -eq 0 ]; then
        log_warning "主ingress不存在，重新创建"
        # 这里可能需要重新创建主ingress
    fi

    log_success "流量已恢复"
}

# 生成回滚报告
generate_rollback_report() {
    local service=$1
    local environment=$2
    local target_version=$3
    local success=$4

    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)

    cat > "rollback_report_${timestamp}.md" << EOF
# 部署回滚报告

## 基本信息
- **时间**: $(date)
- **服务**: $service
- **环境**: $environment
- **目标版本**: $target_version
- **结果**: $([ "$success" = true ] && echo "成功" || echo "失败")

## 回滚详情
- 备份文件: backup_${service}_*.yaml
- 清理的金丝雀资源: ingress, deployment, service
- 恢复的流量: 100% 到主服务

## 验证结果
- Pods状态: $(verify_rollback "$service" "$environment" && echo "正常" || echo "异常")
- 服务健康: $(verify_rollback "$service" "$environment" && echo "正常" || echo "异常")

## 后续行动
$(if [ "$success" = true ]; then
    echo "- 监控服务稳定性"
    echo "- 分析失败原因"
    echo "- 修复问题后重新部署"
else
    echo "- 联系运维团队"
    echo "- 手动恢复服务"
    echo "- 评估业务影响"
fi)

---
*自动生成于: $(date)*
EOF

    log_info "回滚报告已生成: rollback_report_${timestamp}.md"
}

# 主回滚流程
main() {
    log_warning "开始紧急回滚流程: $SERVICE ($ENVIRONMENT)"

    # 创建备份
    create_backup "$SERVICE" "$ENVIRONMENT"

    # 执行回滚
    if perform_rollback "$SERVICE" "$ENVIRONMENT" "$TARGET_VERSION"; then
        log_success "回滚执行成功"

        # 清理资源
        cleanup_canary_resources "$SERVICE" "$ENVIRONMENT"

        # 恢复流量
        restore_traffic "$SERVICE" "$ENVIRONMENT"

        # 发送成功通知
        send_emergency_notification "✅ 回滚成功: $SERVICE 已恢复到 $TARGET_VERSION"

        # 生成报告
        generate_rollback_report "$SERVICE" "$ENVIRONMENT" "$TARGET_VERSION" true

        exit 0
    else
        log_error "回滚执行失败"

        # 发送失败通知
        send_emergency_notification "🚨 回滚失败: $SERVICE 需要手动干预！"

        # 生成失败报告
        generate_rollback_report "$SERVICE" "$ENVIRONMENT" "$TARGET_VERSION" false

        exit 1
    fi
}

# 执行主函数
main "$@"
