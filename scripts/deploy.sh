#!/bin/bash

# Sira AI Gateway 部署脚本
# 支持Docker和Kubernetes部署

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-development}"
DEPLOY_MODE="${2:-docker}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."

    case $DEPLOY_MODE in
        docker)
            if ! command -v docker &> /dev/null; then
                log_error "Docker 未安装或不在 PATH 中"
                exit 1
            fi
            if ! command -v docker-compose &> /dev/null; then
                log_error "Docker Compose 未安装或不在 PATH 中"
                exit 1
            fi
            ;;
        kubernetes)
            if ! command -v kubectl &> /dev/null; then
                log_error "kubectl 未安装或不在 PATH 中"
                exit 1
            fi
            ;;
    esac

    log_success "依赖检查通过"
}

# 环境配置
setup_environment() {
    log_info "设置环境配置..."

    # 创建必要的目录
    mkdir -p "$PROJECT_ROOT/config"
    mkdir -p "$PROJECT_ROOT/data"
    mkdir -p "$PROJECT_ROOT/logs"

    # 复制环境配置文件
    if [ -f "$PROJECT_ROOT/.env.example" ]; then
        if [ ! -f "$PROJECT_ROOT/.env" ]; then
            cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env"
            log_warning "已创建 .env 文件，请根据需要修改配置"
        fi
    fi

    # 设置环境变量
    export COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
    if [ "$ENVIRONMENT" = "development" ]; then
        export COMPOSE_FILE="$COMPOSE_FILE:$PROJECT_ROOT/docker-compose.dev.yml"
    fi

    log_success "环境配置完成"
}

# Docker 部署
deploy_docker() {
    log_info "开始 Docker 部署..."

    cd "$PROJECT_ROOT"

    case $ENVIRONMENT in
        development)
            log_info "启动开发环境..."
            docker-compose up -d
            ;;
        staging)
            log_info "构建和启动 staging 环境..."
            docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d --build
            ;;
        production)
            log_info "构建和启动生产环境..."
            docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
            ;;
        *)
            log_error "未知的环境: $ENVIRONMENT"
            exit 1
            ;;
    esac

    log_success "Docker 部署完成"

    # 显示服务状态
    show_services_status
}

# Kubernetes 部署
deploy_kubernetes() {
    log_info "开始 Kubernetes 部署..."

    cd "$PROJECT_ROOT"

    # 检查集群连接
    if ! kubectl cluster-info &> /dev/null; then
        log_error "无法连接到 Kubernetes 集群"
        exit 1
    fi

    # 创建命名空间
    kubectl create namespace sira-gateway --dry-run=client -o yaml | kubectl apply -f -

    # 应用配置
    log_info "应用 Kubernetes 配置..."
    kubectl apply -f k8s/config.yml
    kubectl apply -f k8s/deployment.yml
    kubectl apply -f k8s/hpa.yml

    # 等待部署完成
    log_info "等待部署完成..."
    kubectl wait --for=condition=available --timeout=300s deployment/sira-gateway -n sira-gateway

    # 显示状态
    kubectl get pods -n sira-gateway
    kubectl get services -n sira-gateway

    log_success "Kubernetes 部署完成"
}

# 显示服务状态
show_services_status() {
    log_info "服务状态:"

    case $DEPLOY_MODE in
        docker)
            docker-compose ps
            ;;
        kubernetes)
            kubectl get pods -n sira-gateway
            kubectl get services -n sira-gateway
            ;;
    esac
}

# 停止服务
stop_services() {
    log_info "停止服务..."

    cd "$PROJECT_ROOT"

    case $DEPLOY_MODE in
        docker)
            docker-compose down
            ;;
        kubernetes)
            kubectl delete namespace sira-gateway --ignore-not-found=true
            ;;
    esac

    log_success "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启服务..."

    stop_services
    sleep 5

    case $DEPLOY_MODE in
        docker)
            deploy_docker
            ;;
        kubernetes)
            deploy_kubernetes
            ;;
    esac

    log_success "服务已重启"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."

    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "健康检查尝试 $attempt/$max_attempts..."

        case $DEPLOY_MODE in
            docker)
                if curl -f http://localhost:8080/health &> /dev/null; then
                    log_success "健康检查通过"
                    return 0
                fi
                ;;
            kubernetes)
                if kubectl exec -n sira-gateway deployment/sira-gateway -- curl -f http://localhost:8080/health &> /dev/null; then
                    log_success "健康检查通过"
                    return 0
                fi
                ;;
        esac

        sleep 10
        ((attempt++))
    done

    log_error "健康检查失败"
    return 1
}

# 显示帮助
show_help() {
    cat << EOF
Sira AI Gateway 部署脚本

用法: $0 [环境] [模式] [命令]

环境:
  development    开发环境 (默认)
  staging        预发布环境
  production     生产环境

模式:
  docker         Docker 部署 (默认)
  kubernetes     Kubernetes 部署

命令:
  start          启动服务 (默认)
  stop           停止服务
  restart        重启服务
  status         显示服务状态
  health         执行健康检查
  logs           显示服务日志

示例:
  $0 development docker start    # 启动开发环境的 Docker 服务
  $0 production kubernetes start # 启动生产环境的 Kubernetes 服务
  $0 status                      # 显示服务状态
  $0 logs                        # 显示服务日志

EOF
}

# 显示日志
show_logs() {
    log_info "显示服务日志..."

    case $DEPLOY_MODE in
        docker)
            docker-compose logs -f --tail=100
            ;;
        kubernetes)
            kubectl logs -f -n sira-gateway deployment/sira-gateway
            ;;
    esac
}

# 主函数
main() {
    local command="${3:-start}"

    case $command in
        start)
            check_dependencies
            setup_environment
            case $DEPLOY_MODE in
                docker)
                    deploy_docker
                    ;;
                kubernetes)
                    deploy_kubernetes
                    ;;
                *)
                    log_error "未知的部署模式: $DEPLOY_MODE"
                    exit 1
                    ;;
            esac
            health_check
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            show_services_status
            ;;
        health)
            health_check
            ;;
        logs)
            show_logs
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

# 执行主函数
main "$@"
