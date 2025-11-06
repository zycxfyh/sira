#!/bin/bash

# 数据库迁移测试脚本
# 使用方法: ./test-migration.sh [environment]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SCRIPT="$SCRIPT_DIR/migrate.sh"

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

# 设置测试环境
setup_test_environment() {
    log_info "设置测试环境..."

    # 创建测试数据库
    export DB_NAME="tuheg_test_$(date +%s)"
    export DB_HOST=${DB_HOST:-localhost}
    export DB_PORT=${DB_PORT:-5432}
    export DB_USER=${DB_USER:-postgres}
    export DB_PASSWORD=${DB_PASSWORD:-password}

    # 创建测试数据库
    if PGPASSWORD="$DB_PASSWORD" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null; then
        log_success "测试数据库创建成功: $DB_NAME"
    else
        log_error "测试数据库创建失败"
        return 1
    fi

    # 启用pgvector扩展 (如果可用)
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
}

# 清理测试环境
cleanup_test_environment() {
    log_info "清理测试环境..."

    if [ -n "$DB_NAME" ] && [[ "$DB_NAME" == tuheg_test_* ]]; then
        PGPASSWORD="$DB_PASSWORD" dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
        log_success "测试数据库清理完成: $DB_NAME"
    fi
}

# 测试迁移执行
test_migration_execution() {
    log_info "测试迁移执行..."

    # 执行迁移
    if "$MIGRATE_SCRIPT" up; then
        log_success "迁移执行测试通过"
        return 0
    else
        log_error "迁移执行测试失败"
        return 1
    fi
}

# 测试回滚执行
test_rollback_execution() {
    log_info "测试回滚执行..."

    # 回滚所有迁移
    if "$MIGRATE_SCRIPT" down 001; then
        log_success "回滚执行测试通过"
        return 0
    else
        log_error "回滚执行测试失败"
        return 1
    fi
}

# 测试数据完整性
test_data_integrity() {
    log_info "测试数据完整性..."

    # 重新执行迁移
    "$MIGRATE_SCRIPT" up >/dev/null 2>&1

    # 验证完整性
    if "$MIGRATE_SCRIPT" verify; then
        log_success "数据完整性测试通过"
        return 0
    else
        log_error "数据完整性测试失败"
        return 1
    fi
}

# 测试重复执行 (幂等性)
test_idempotency() {
    log_info "测试迁移幂等性..."

    # 记录初始状态
    local initial_migrations
    initial_migrations=$("$MIGRATE_SCRIPT" status | grep -c "001")

    # 再次执行迁移
    if "$MIGRATE_SCRIPT" up >/dev/null 2>&1; then
        local final_migrations
        final_migrations=$("$MIGRATE_SCRIPT" status | grep -c "001")

        if [ "$initial_migrations" -eq "$final_migrations" ]; then
            log_success "迁移幂等性测试通过"
            return 0
        else
            log_error "迁移幂等性测试失败: 重复执行导致状态变化"
            return 1
        fi
    else
        log_error "迁移幂等性测试失败: 重复执行出错"
        return 1
    fi
}

# 测试并发执行 (如果需要)
test_concurrent_execution() {
    log_info "测试并发迁移执行..."

    # 注意: 这个测试在实际环境中可能需要更复杂的设置
    # 这里只是模拟并发检查

    log_success "并发迁移测试跳过 (需要实际数据库环境)"
    return 0
}

# 测试大数据量迁移
test_large_dataset() {
    log_info "测试大数据量迁移..."

    # 在测试数据库中插入大量测试数据
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF' >/dev/null 2>&1
        -- 插入测试用户
        INSERT INTO users (id, email, first_name, last_name)
        SELECT
            'user_' || i,
            'user' || i || '@example.com',
            'First' || i,
            'Last' || i
        FROM generate_series(1, 1000) AS i;

        -- 插入测试游戏
        INSERT INTO games (title, description, creator_id, status)
        SELECT
            'Test Game ' || i,
            'Description for test game ' || i,
            'user_' || ((i % 1000) + 1),
            CASE WHEN i % 3 = 0 THEN 'published' ELSE 'draft' END
        FROM generate_series(1, 5000) AS i;

        -- 插入测试记忆
        INSERT INTO memory (game_id, content)
        SELECT
            (i % 5000) + 1,
            'Test memory content ' || i || ' with some additional text to make it longer and more realistic for testing purposes.'
        FROM generate_series(1, 10000) AS i;
EOF

    if [ $? -eq 0 ]; then
        log_success "大数据量插入测试通过"

        # 验证数据完整性
        local user_count game_count memory_count
        user_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
        game_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM games;" | tr -d ' ')
        memory_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM memory;" | tr -d ' ')

        log_info "数据统计: 用户=$user_count, 游戏=$game_count, 记忆=$memory_count"

        if [ "$user_count" -eq 1000 ] && [ "$game_count" -eq 5000 ] && [ "$memory_count" -eq 10000 ]; then
            log_success "大数据量验证测试通过"
            return 0
        else
            log_error "大数据量验证测试失败: 数据数量不匹配"
            return 1
        fi
    else
        log_error "大数据量插入测试失败"
        return 1
    fi
}

# 生成测试报告
generate_test_report() {
    local success=$1
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)

    local report_file="migration_test_report_$timestamp.md"

    cat > "$report_file" << EOF
# 数据库迁移测试报告

## 测试时间
$(date)

## 测试环境
- 数据库: $DB_NAME
- 主机: $DB_HOST:$DB_PORT
- 测试类型: 完整迁移测试

## 测试结果
$(if [ "$success" = true ]; then
    echo "**✅ 所有测试通过**"
else
    echo "**❌ 部分测试失败**"
fi)

## 测试项目详情

### ✅ 迁移执行测试
- 状态: $([ "$MIGRATION_EXECUTION_TEST" = true ] && echo "通过" || echo "失败")
- 描述: 验证迁移脚本能正常执行

### ✅ 回滚执行测试
- 状态: $([ "$ROLLBACK_EXECUTION_TEST" = true ] && echo "通过" || echo "失败")
- 描述: 验证回滚脚本能正常执行

### ✅ 数据完整性测试
- 状态: $([ "$DATA_INTEGRITY_TEST" = true ] && echo "通过" || echo "失败")
- 描述: 验证迁移后的数据完整性

### ✅ 迁移幂等性测试
- 状态: $([ "$IDEMPOTENCY_TEST" = true ] && echo "通过" || echo "失败")
- 描述: 验证重复执行迁移的安全性

### ✅ 大数据量测试
- 状态: $([ "$LARGE_DATASET_TEST" = true ] && echo "通过" || echo "失败")
- 描述: 验证大数据量下的迁移性能

## 测试数据统计
- 测试用户数: 1000
- 测试游戏数: 5000
- 测试记忆数: 10000
- 总测试数据量: ~15,000 条记录

## 性能指标
- 迁移执行时间: TBD
- 数据插入时间: TBD
- 验证时间: TBD

## 结论
$(if [ "$success" = true ]; then
    echo "数据库迁移策略验证通过，所有测试项目均正常。迁移脚本可以安全用于生产环境部署。"
else
    echo "数据库迁移策略验证失败，存在问题需要修复后再进行生产部署。"
fi)

## 建议
$(if [ "$success" = true ]; then
    echo "- 可以继续进行生产环境部署"
    echo "- 建议在部署前进行一次完整的演练"
else
    echo "- 修复发现的问题"
    echo "- 重新运行测试验证"
    echo "- 检查迁移脚本的逻辑正确性"
fi)

---
*报告生成于: $(date)*
EOF

    log_info "测试报告已生成: $report_file"
}

# 主测试流程
main() {
    local environment=${1:-test}
    local success=true

    log_info "开始数据库迁移测试 ($environment)"

    # 陷阱函数：确保清理
    trap cleanup_test_environment EXIT

    # 设置测试环境
    if ! setup_test_environment; then
        exit 1
    fi

    # 执行各项测试
    log_info "执行测试项目..."

    if test_migration_execution; then
        MIGRATION_EXECUTION_TEST=true
    else
        success=false
    fi

    if test_rollback_execution; then
        ROLLBACK_EXECUTION_TEST=true
    else
        success=false
    fi

    if test_data_integrity; then
        DATA_INTEGRITY_TEST=true
    else
        success=false
    fi

    if test_idempotency; then
        IDEMPOTENCY_TEST=true
    else
        success=false
    fi

    if test_large_dataset; then
        LARGE_DATASET_TEST=true
    else
        success=false
    fi

    # 生成测试报告
    generate_test_report "$success"

    if [ "$success" = true ]; then
        log_success "🎉 数据库迁移测试全部通过！"
        exit 0
    else
        log_error "❌ 数据库迁移测试失败，请检查测试结果"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
数据库迁移测试脚本

使用方法:
  $0 [environment]

参数:
  environment   测试环境 (默认: test)

功能:
  - 创建独立的测试数据库
  - 执行迁移和回滚测试
  - 验证数据完整性
  - 测试大数据量场景
  - 生成详细测试报告

测试项目:
  - 迁移执行测试
  - 回滚执行测试
  - 数据完整性验证
  - 迁移幂等性检查
  - 大数据量性能测试

示例:
  $0 test        # 在测试环境运行
  $0 staging     # 在staging环境运行

EOF
}

case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
