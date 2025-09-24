# Video Sync App - Docker 部署指南

## 项目概述
这是一个基于Node.js的视频同步应用，使用Express.js和Socket.io实现多用户视频同步观看功能。

## Dockerfile 说明

已创建的 `Dockerfile` 包含以下配置：

- **基础镜像**: Node.js 18 Alpine（轻量级Linux发行版）
- **工作目录**: `/app`
- **依赖安装**: 使用 `npm ci --only=production` 只安装生产依赖
- **健康检查**: 每30秒检查 `/health` 端点
- **暴露端口**: 3000
- **启动命令**: `npm start`

## 构建和运行步骤

### 1. 本地构建和测试
```bash
# 构建Docker镜像
docker build -t video-sync-app .

# 运行容器
docker run -d -p 3000:3000 --name video-sync-container video-sync-app

# 查看日志
docker logs video-sync-container

# 访问应用
# 打开浏览器访问 http://localhost:3000
```

### 2. 部署到远程服务器
```bash
# 保存镜像为tar文件
docker save video-sync-app > video-sync-app.tar

# 在目标服务器上加载镜像
docker load < video-sync-app.tar

# 运行容器
docker run -d -p 80:3000 --name video-sync-container video-sync-app
```

### 3. 使用Docker Compose（推荐）
创建 `docker-compose.yml` 文件：

```yaml
version: '3.8'
services:
  video-sync-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
```

运行：
```bash
docker-compose up -d
```

## 环境变量配置

你可以在运行时通过环境变量配置应用：

```bash
docker run -d -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  --name video-sync-container \
  video-sync-app
```

## 健康检查

应用包含 `/health` 端点，返回：
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "memory": { "rss": 52428800, "heapTotal": 19267584, "heapUsed": 8974312 }
}
```

## 常见问题排查

1. **端口冲突**: 确保3000端口未被占用
2. **内存不足**: 使用 `docker stats` 监控容器资源使用
3. **网络问题**: 检查防火墙设置，确保端口开放
4. **日志查看**: 使用 `docker logs -f container-name` 实时查看日志

## 性能优化建议

1. 使用多阶段构建减小镜像体积
2. 配置适当的内存限制
3. 使用反向代理（如Nginx）处理静态文件
4. 启用Gzip压缩
5. 配置适当的缓存策略

## 安全建议

1. 使用非root用户运行应用
2. 定期更新基础镜像
3. 扫描镜像漏洞
4. 配置适当的网络策略
5. 使用 secrets 管理敏感信息

## 备份和恢复

```bash
# 备份数据卷（如果有持久化数据）
docker run --rm -v video-sync-data:/data -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz /data

# 恢复数据
docker run --rm -v video-sync-data:/data -v $(pwd):/backup alpine tar xzf /backup/backup.tar.gz -C /
```