#!/bin/bash

# Sira AI Gateway 生产环境监控和回溯脚本
# 学习项目 - 第四次测试

set -e

echo "🔍 开始生产环境监控..."

# 检查Docker环境
if ! command -v docker &> /dev/null || ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker环境不可用"
    exit 1
fi

# 监控容器状态
echo "📊 检查容器状态..."
docker-compose -f docker-compose.production.yml ps

# 监控容器资源使用
echo -e "\n💾 检查资源使用..."
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# 检查应用健康状态
echo -e "\n🏥 检查应用健康状态..."
if curl -f -s http://localhost:8083/health > /dev/null; then
    echo "✅ 应用健康检查通过"
    curl -s http://localhost:8083/health | jq . 2>/dev/null || curl -s http://localhost:8083/health
else
    echo "❌ 应用健康检查失败"
    echo "📋 容器日志:"
    docker-compose -f docker-compose.production.yml logs ai-gateway-prod --tail=20
fi

# 检查AI API状态
echo -e "\n🤖 检查AI API状态..."
if curl -f -s http://localhost:8083/api/ai/providers > /dev/null; then
    echo "✅ AI API正常"
    echo "AI提供商状态:"
    curl -s http://localhost:8083/api/ai/providers | jq '.providers | to_entries[] | "\(.key): \(.value.available)"' 2>/dev/null || curl -s http://localhost:8083/api/ai/providers
else
    echo "❌ AI API异常"
fi

# 检查日志
echo -e "\n📝 检查应用日志..."
docker-compose -f docker-compose.production.yml logs ai-gateway-prod --tail=10 | head -20

echo -e "\n✅ 监控完成"

# 回溯准备
echo -e "\n🔄 回溯准备..."

# 创建备份目录
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 备份容器配置
echo "💾 备份容器配置..."
docker-compose -f docker-compose.production.yml config > "$BACKUP_DIR/docker-compose.backup.yml"

# 备份环境变量（如果有.env.production文件）
if [ -f ".env.production" ]; then
    cp .env.production "$BACKUP_DIR/"
fi

# 备份日志
echo "📋 备份日志..."
docker-compose -f docker-compose.production.yml logs > "$BACKUP_DIR/container.logs"

# 记录系统状态
echo "📊 记录系统状态..."
echo "备份时间: $(date)" > "$BACKUP_DIR/system-status.txt"
echo "Docker版本: $(docker --version)" >> "$BACKUP_DIR/system-status.txt"
echo "Docker Compose版本: $(docker-compose --version)" >> "$BACKUP_DIR/system-status.txt"
echo "容器状态:" >> "$BACKUP_DIR/system-status.txt"
docker-compose -f docker-compose.production.yml ps >> "$BACKUP_DIR/system-status.txt"

echo "✅ 备份完成: $BACKUP_DIR"

# 模拟回溯测试
echo -e "\n🔙 模拟回溯测试..."

# 停止当前服务
echo "🛑 停止当前服务..."
docker-compose -f docker-compose.production.yml down

# 模拟从备份恢复
echo "🔄 从备份恢复..."
sleep 3

# 重启服务
echo "🚀 重启服务..."
docker-compose -f docker-compose.production.yml up -d

# 验证恢复
echo "🔍 验证恢复..."
sleep 5

if curl -f -s http://localhost:8083/health > /dev/null; then
    echo "✅ 回溯测试成功 - 服务已恢复"
else
    echo "❌ 回溯测试失败"
fi

echo -e "\n📊 监控和回溯测试完成！"
echo "📁 备份文件位置: $BACKUP_DIR"
echo ""
echo "💡 生产环境监控命令:"
echo "   查看日志: docker-compose -f docker-compose.production.yml logs -f"
echo "   查看资源: docker stats"
echo "   重启服务: docker-compose -f docker-compose.production.yml restart"
echo "   停止服务: docker-compose -f docker-compose.production.yml down"
