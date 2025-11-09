#!/bin/bash

# Sira AI Gateway 生产环境部署脚本
# 学习项目 - 第四次测试

set -e

echo "🚀 开始生产环境部署..."

# 检查Docker环境
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 创建必要的目录
echo "📁 创建生产环境目录..."
mkdir -p logs/production
mkdir -p config/production

# 停止现有的生产容器（如果存在）
echo "🛑 停止现有生产容器..."
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

# 清理旧镜像（可选）
echo "🧹 清理旧镜像..."
docker image prune -f || true

# 构建生产镜像
echo "🏗️ 构建生产镜像..."
docker build -f Dockerfile.simple -t sira-ai-gateway:production .

# 启动生产环境
echo "🚀 启动生产环境..."
docker-compose -f docker-compose.production.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 验证部署
echo "🔍 验证生产环境部署..."

# 检查容器状态
if ! docker-compose -f docker-compose.production.yml ps | grep -q "Up"; then
    echo "❌ 生产环境启动失败"
    echo "📋 容器状态:"
    docker-compose -f docker-compose.production.yml ps
    exit 1
fi

# 测试健康检查
echo "🏥 测试健康检查..."
if ! curl -f -s http://localhost:8083/health > /dev/null; then
    echo "❌ 健康检查失败"
    echo "📋 容器日志:"
    docker-compose -f docker-compose.production.yml logs ai-gateway-prod
    exit 1
fi

# 测试API端点
echo "🤖 测试AI API..."
if ! curl -f -s http://localhost:8083/api/ai/providers > /dev/null; then
    echo "❌ AI API测试失败"
    exit 1
fi

echo "✅ 生产环境部署成功！"
echo ""
echo "📊 部署信息:"
echo "   🌐 健康检查: http://localhost:8083/health"
echo "   🤖 AI聊天API: http://localhost:8083/api/ai/chat"
echo "   📊 AI提供商状态: http://localhost:8083/api/ai/providers"
echo ""
echo "📋 查看日志: docker-compose -f docker-compose.production.yml logs -f"
echo "🛑 停止服务: docker-compose -f docker-compose.production.yml down"

echo ""
echo "🎉 生产部署完成！"
