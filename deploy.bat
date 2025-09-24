@echo off
REM Video Sync App Docker 部署脚本 (Windows版本)

setlocal enabledelayedexpansion

echo 🚀 开始部署 Video Sync App...

REM 检查Docker是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: Docker 未安装，请先安装 Docker
    exit /b 1
)

REM 检查Docker Compose是否安装
docker-compose --version >nul 2>&1
if %errorlevel% equ 0 (
    set USE_COMPOSE=true
) else (
    echo ⚠️  Docker Compose 未安装，将使用普通 Docker 命令
    set USE_COMPOSE=false
)

REM 停止并删除旧容器
echo 🛑 停止旧容器...
docker stop video-sync-container 2>nul
docker rm video-sync-container 2>nul

REM 构建镜像
echo 🔨 构建 Docker 镜像...
if "%USE_COMPOSE%"=="true" (
    docker-compose build
) else (
    docker build -f Dockerfile.production -t video-sync-app .
)

REM 运行容器
echo 🏃 启动新容器...
if "%USE_COMPOSE%"=="true" (
    docker-compose up -d
) else (
    docker run -d ^
        --name video-sync-container ^
        -p 3000:3000 ^
        -e NODE_ENV=production ^
        --restart unless-stopped ^
        video-sync-app
)

REM 等待应用启动
echo ⏳ 等待应用启动...
timeout /t 10 /nobreak >nul

REM 健康检查
echo 🏥 检查应用健康状态...
set HEALTH_CHECK_PASSED=false
for /l %%i in (1,1,30) do (
    curl -f http://localhost:3000/health >nul 2>&1
    if !errorlevel! equ 0 (
        echo ✅ 应用已成功启动并运行正常！
        set HEALTH_CHECK_PASSED=true
        goto :health_check_done
    )
    timeout /t 2 /nobreak >nul
)

:health_check_done
if "%HEALTH_CHECK_PASSED%"=="false" (
    echo ❌ 错误: 应用启动超时，请检查日志
    exit /b 1
)

REM 输出信息
echo.
echo 📋 部署信息：
echo 应用地址: http://localhost:3000
echo 健康检查: http://localhost:3000/health
echo.
echo 📊 查看日志:
if "%USE_COMPOSE%"=="true" (
    echo docker-compose logs -f
) else (
    echo docker logs -f video-sync-container
)

echo.
echo 🎉 部署完成！

REM 可选：显示容器状态
echo.
echo 📊 容器状态：
docker ps | findstr video-sync

pause