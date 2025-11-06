#!/bin/bash

# 文件路径: scripts/run-integration-tests.sh
# 职责: 运行完整的集成测试套件
# 包括服务间通信、数据库集成、API端到端测试

set -e

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

# 环境检查
check_dependencies() {
    log_info "检查依赖..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装或不在 PATH 中"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装或不在 PATH 中"
        exit 1
    fi

    log_success "依赖检查通过"
}

# 清理之前的测试环境
cleanup() {
    log_info "清理之前的测试环境..."

    docker-compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true

    # 清理可能残留的容器
    docker rm -f $(docker ps -aq -f name=tuheg.*test) 2>/dev/null || true

    # 清理测试卷
    docker volume rm $(docker volume ls -q -f name=tuheg.*test) 2>/dev/null || true

    log_success "清理完成"
}

# 启动测试环境
start_test_environment() {
    log_info "启动集成测试环境..."

    # 启动服务
    docker-compose -f docker-compose.test.yml up -d

    # 等待服务启动
    log_info "等待服务启动..."
    local max_attempts=60
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.test.yml ps | grep -q "healthy"; then
            log_success "所有服务已启动并健康"
            break
        fi

        log_info "等待服务启动... (尝试 $attempt/$max_attempts)"
        sleep 5
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "服务启动超时"
        docker-compose -f docker-compose.test.yml logs
        exit 1
    fi
}

# 运行健康检查
run_health_checks() {
    log_info "运行健康检查..."

    # 检查数据库连接
    if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U postgres -d tuheg_test_db; then
        log_success "数据库连接正常"
    else
        log_error "数据库连接失败"
        exit 1
    fi

    # 检查Redis连接
    if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping | grep -q "PONG"; then
        log_success "Redis连接正常"
    else
        log_error "Redis连接失败"
        exit 1
    fi

    # 检查API健康状态
    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:3002/health > /dev/null 2>&1; then
            log_success "后端网关API健康检查通过"
            break
        fi

        log_info "等待API启动... (尝试 $attempt/$max_attempts)"
        sleep 3
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "后端网关API健康检查失败"
        exit 1
    fi
}

# 运行数据库迁移
run_database_migrations() {
    log_info "运行数据库迁移..."

    # 等待数据库完全准备好
    sleep 10

    # 运行迁移脚本
    if [ -f "deployment/database/migrate.sh" ]; then
        bash deployment/database/migrate.sh
        log_success "数据库迁移完成"
    else
        log_warning "未找到迁移脚本，跳过迁移"
    fi
}

# 运行集成测试
run_integration_tests() {
    log_info "运行集成测试..."

    # 创建测试结果目录
    mkdir -p test-results

    # 运行后端集成测试
    log_info "运行后端网关集成测试..."
    if docker-compose -f docker-compose.test.yml exec -T backend-gateway-test npm run test:integration 2>&1; then
        log_success "后端网关集成测试通过"
    else
        log_error "后端网关集成测试失败"
        collect_logs
        exit 1
    fi

    # 运行服务间通信测试
    log_info "运行服务间通信测试..."
    if docker-compose -f docker-compose.test.yml exec -T test-runner npm run test:integration:services 2>&1; then
        log_success "服务间通信测试通过"
    else
        log_error "服务间通信测试失败"
        collect_logs
        exit 1
    fi

    # 运行端到端API测试
    log_info "运行端到端API测试..."
    if docker-compose -f docker-compose.test.yml exec -T test-runner npm run test:e2e 2>&1; then
        log_success "端到端API测试通过"
    else
        log_error "端到端API测试失败"
        collect_logs
        exit 1
    fi
}

# 收集日志用于调试
collect_logs() {
    log_warning "收集测试失败日志..."

    mkdir -p test-results/logs

    docker-compose -f docker-compose.test.yml logs > test-results/logs/docker-compose.log

    # 收集各个服务的日志
    for service in backend-gateway-test creation-agent-test logic-agent-test narrative-agent-test; do
        docker-compose -f docker-compose.test.yml logs $service > test-results/logs/${service}.log 2>&1 || true
    done
}

# 生成测试报告
generate_report() {
    log_info "生成测试报告..."

    cat > test-results/integration-test-report.md << EOF
# 集成测试报告

## 测试执行时间
$(date)

## 测试结果
✅ 环境启动成功
✅ 服务健康检查通过
✅ 数据库连接正常
✅ Redis连接正常
✅ 后端网关集成测试通过
✅ 服务间通信测试通过
✅ 端到端API测试通过

## 测试环境
- Docker Compose: $(docker-compose --version)
- Docker: $(docker --version)

## 服务状态
$(docker-compose -f docker-compose.test.yml ps)

## 日志位置
- 主日志: test-results/logs/docker-compose.log
- 各服务日志: test-results/logs/*.log
EOF

    log_success "测试报告生成完成: test-results/integration-test-report.md"
}

# 主函数
main() {
    log_info "开始集成测试流程..."

    check_dependencies
    cleanup
    start_test_environment
    run_health_checks
    run_database_migrations
    run_integration_tests
    generate_report

    log_success "🎉 所有集成测试通过！"

    # 清理测试环境
    log_info "清理测试环境..."
    docker-compose -f docker-compose.test.yml down -v --remove-orphans
    log_success "测试环境清理完成"
}

# 错误处理
trap 'log_error "集成测试失败，执行清理..."; cleanup; exit 1' ERR

# 参数处理
case "\${1:-}" in
    "cleanup")
        cleanup
        ;;
    "start")
        start_test_environment
        ;;
    "health")
        run_health_checks
        ;;
    "test")
        run_integration_tests
        ;;
    *)
        main
        ;;
esac
