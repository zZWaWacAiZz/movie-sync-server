#!/bin/bash

# Video Sync App Docker 部署脚本

set -e

echo "🚀 开始部署 Video Sync App..."

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 函数：输出错误信息并退出
error_exit() {
    echo -e "${RED}❌ 错误: $1${NC}" >&2
    exit 1
}

# 函数：输出成功信息
success_msg() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 函数：输出警告信息
warning_msg() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    error_exit "Docker 未安装，请先安装 Docker"
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    warning_msg "Docker Compose 未安装，将使用普通 Docker 命令"
    USE_COMPOSE=false
else
    USE_COMPOSE=true
fi

# 停止并删除旧容器
echo "🛑 停止旧容器..."
docker stop video-sync-container 2>/dev/null || true
docker rm video-sync-container 2>/dev/null || true

# 构建镜像
echo "🔨 构建 Docker 镜像..."
if [ "$USE_COMPOSE" = true ]; then
    docker-compose build
else
    docker build -f Dockerfile.production -t video-sync-app .
fi

# 运行容器
echo "🏃 启动新容器..."
if [ "$USE_COMPOSE" = true ]; then
    docker-compose up -d
else
    docker run -d \
        --name video-sync-container \
        -p 3000:3000 \
        -e NODE_ENV=production \
        --restart unless-stopped \
        video-sync-app
fi

# 等待应用启动
echo "⏳ 等待应用启动..."
sleep 10

# 健康检查
echo "🏥 检查应用健康状态..."
for i in {1..30}; do
    if curl -f http://localhost:3000/health &>/dev/null; then
        success_msg "应用已成功启动并运行正常！"
        break
    fi
    if [ $i -eq 30 ]; then
        error_exit "应用启动超时，请检查日志"
    fi
    sleep 2
done

# 输出信息
echo ""
echo "📋 部署信息："
echo "应用地址: http://localhost:3000"
echo "健康检查: http://localhost:3000/health"
echo ""
echo "📊 查看日志:"
if [ "$USE_COMPOSE" = true ]; then
    echo "docker-compose logs -f"
else
    echo "docker logs -f video-sync-container"
fi

echo ""
success_msg "🎉 部署完成！"

# 可选：显示容器状态
echo ""
echo "📊 容器状态："
docker ps | grep video-sync || true