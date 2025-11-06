#!/bin/bash

# 数据库迁移管理脚本
# 使用方法: ./migrate.sh [up|down|status] [version]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# 数据库连接信息 (从环境变量获取)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-tuheg}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-password}

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

# 构建PostgreSQL连接字符串
get_connection_string() {
    echo "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
}

# 测试数据库连接
test_connection() {
    log_info "测试数据库连接..."

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "数据库连接正常"
        return 0
    else
        log_error "数据库连接失败"
        return 1
    fi
}

# 执行迁移
run_migration() {
    local migration_file=$1
    local action=$2

    if [ ! -f "$migration_file" ]; then
        log_error "迁移文件不存在: $migration_file"
        return 1
    fi

    log_info "执行迁移: $(basename "$migration_file")"

    # 创建备份 (仅对up操作)
    if [ "$action" = "up" ]; then
        create_backup
    fi

    # 执行迁移
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file"; then
        log_success "迁移执行成功"
        return 0
    else
        log_error "迁移执行失败"
        return 1
    fi
}

# 创建数据库备份
create_backup() {
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_pre_migration_$timestamp.sql"

    log_info "创建数据库备份: $backup_file"

    if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$backup_file"; then
        log_success "备份创建成功: $backup_file"
    else
        log_error "备份创建失败"
        return 1
    fi
}

# 获取已执行的迁移
get_applied_migrations() {
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT version, description, executed_at
        FROM schema_migrations
        ORDER BY executed_at;
    " 2>/dev/null || echo ""
}

# 获取可用的迁移文件
get_available_migrations() {
    find "$MIGRATIONS_DIR" -name "migration_*.sql" -type f | sort
}

# 迁移状态
show_status() {
    log_info "数据库迁移状态"

    echo "已应用的迁移:"
    echo "版本 | 描述 | 执行时间"
    echo "------|------|----------"
    get_applied_migrations | while read -r line; do
        if [ -n "$line" ]; then
            echo "$line"
        fi
    done

    echo ""
    echo "可用的迁移文件:"
    get_available_migrations | while read -r file; do
        local version
        version=$(basename "$file" | sed 's/migration_\(.*\)\.sql/\1/')
        echo "  - $version ($(basename "$file"))"
    done
}

# 执行所有待应用的迁移
migrate_up() {
    log_info "开始迁移 (up)..."

    local applied_versions
    applied_versions=$(get_applied_migrations | awk '{print $1}' | tr '\n' ' ')

    get_available_migrations | while read -r file; do
        local version
        version=$(basename "$file" | sed 's/migration_\(.*\)\.sql/\1/')

        if [[ "$applied_versions" != *"$version"* ]]; then
            log_info "发现未应用的迁移: $version"
            if run_migration "$file" "up"; then
                log_success "迁移 $version 应用成功"
            else
                log_error "迁移 $version 应用失败"
                exit 1
            fi
        else
            log_info "迁移 $version 已应用，跳过"
        fi
    done

    log_success "所有迁移应用完成"
}

# 回滚指定版本的迁移
migrate_down() {
    local target_version=$1

    if [ -z "$target_version" ]; then
        log_error "请指定要回滚的版本"
        echo "使用方法: $0 down <version>"
        exit 1
    fi

    local rollback_file="$MIGRATIONS_DIR/rollback_${target_version}.sql"

    if [ ! -f "$rollback_file" ]; then
        log_error "回滚文件不存在: $rollback_file"
        exit 1
    fi

    log_warning "开始回滚迁移: $target_version"

    if run_migration "$rollback_file" "down"; then
        log_success "迁移 $target_version 回滚成功"
    else
        log_error "迁移 $target_version 回滚失败"
        exit 1
    fi
}

# 验证数据完整性
verify_integrity() {
    log_info "验证数据库完整性..."

    # 检查表结构
    local required_tables=("users" "games" "game_sessions" "memory" "ai_settings" "schema_migrations")

    for table in "${required_tables[@]}"; do
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1 FROM $table LIMIT 1;" >/dev/null 2>&1; then
            log_error "表 $table 不存在或无法访问"
            return 1
        fi
    done

    # 检查外键约束
    local constraint_violations
    constraint_violations=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM (
            SELECT 1 FROM games g LEFT JOIN users u ON g.creator_id = u.id WHERE u.id IS NULL
            UNION ALL
            SELECT 1 FROM game_sessions gs LEFT JOIN games g ON gs.game_id = g.id WHERE g.id IS NULL
            UNION ALL
            SELECT 1 FROM game_sessions gs LEFT JOIN users u ON gs.user_id = u.id WHERE u.id IS NULL
            UNION ALL
            SELECT 1 FROM memory m LEFT JOIN games g ON m.game_id = g.id WHERE g.id IS NULL
            UNION ALL
            SELECT 1 FROM ai_settings a LEFT JOIN users u ON a.user_id = u.id WHERE u.id IS NULL
        ) violations;
    " 2>/dev/null | tr -d ' ')

    if [ "$constraint_violations" -gt 0 ]; then
        log_error "发现 $constraint_violations 条外键约束违规"
        return 1
    fi

    log_success "数据库完整性验证通过"
    return 0
}

# 主函数
main() {
    local command=${1:-status}
    local version=$2

    # 检查依赖
    if ! command -v psql >/dev/null 2>&1; then
        log_error "需要安装 PostgreSQL 客户端 (psql)"
        exit 1
    fi

    if ! command -v pg_dump >/dev/null 2>&1; then
        log_error "需要安装 PostgreSQL 客户端 (pg_dump)"
        exit 1
    fi

    # 测试连接
    if ! test_connection; then
        exit 1
    fi

    case "$command" in
        up)
            migrate_up
            verify_integrity
            ;;
        down)
            migrate_down "$version"
            verify_integrity
            ;;
        status)
            show_status
            ;;
        verify)
            verify_integrity
            ;;
        *)
            echo "使用方法: $0 [up|down|status|verify] [version]"
            echo ""
            echo "命令:"
            echo "  up          执行所有待应用的迁移"
            echo "  down <ver>  回滚指定版本的迁移"
            echo "  status      显示迁移状态"
            echo "  verify      验证数据库完整性"
            echo ""
            echo "示例:"
            echo "  $0 up"
            echo "  $0 down 001"
            echo "  $0 status"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
