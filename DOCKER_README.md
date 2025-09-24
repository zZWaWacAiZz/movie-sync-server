# 🐳 Docker 部署快速指南

## 📦 已创建的文件
- `Dockerfile` - 基础Docker镜像配置
- `Dockerfile.production` - 生产环境优化版本（推荐）
- `docker-compose.yml` - Docker Compose配置
- `.dockerignore` - 排除不需要的文件
- `deploy.sh` / `deploy.bat` - 自动化部署脚本

## 🚀 快速部署

### ⚙️ 服务器地址配置
你的服务器地址：`https://moviesyncserver1-py2eksxw.b4a.run`

系统已自动配置为你的服务器地址，前端会根据访问域名自动连接正确的服务器。

### 方法1：使用部署脚本（推荐）
```bash
# Linux/Mac
chmod +x deploy.sh
./deploy.sh

# Windows
deploy.bat
```

### 方法2：使用Docker Compose
```bash
docker-compose up -d
```

### 方法3：手动部署
```bash
# 构建镜像
docker build -f Dockerfile.production -t video-sync-app .

# 运行容器
docker run -d -p 3000:3000 --name video-sync-container video-sync-app
```

## 🔍 验证部署
- 应用访问：https://moviesyncserver1-py2eksxw.b4a.run
- 健康检查：https://moviesyncserver1-py2eksxw.b4a.run/health

## 📊 管理命令
```bash
# 查看日志
docker logs -f video-sync-container

# 停止容器
docker stop video-sync-container

# 删除容器
docker rm video-sync-container

# 查看容器状态
docker ps
```

## ⚙️ 配置说明
- 端口：3000（可映射到其他端口）
- 环境：生产环境优化
- 健康检查：每30秒自动检查
- 重启策略：自动重启（除非手动停止）

## 🛠️ 故障排查
1. 检查端口是否被占用
2. 查看容器日志：`docker logs video-sync-container`
3. 验证健康检查端点是否响应
4. 确保Docker服务正在运行

## 📚 详细文档
查看 `DOCKER_DEPLOYMENT_GUIDE.md` 获取完整的部署和配置说明。