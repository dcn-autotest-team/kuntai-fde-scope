@echo off
chcp 65001 >nul
title Kuntai FDE Frontend Service
echo ===================================================
echo   神州鲲泰 FDE 团队能力边界判定系统 - 前端服务启动
echo ===================================================

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo [提示] 尚未安装前端依赖包，正在自动执行 npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [错误] npm install 失败，请检查网络或 npm 配置。
        pause
        exit /b %ERRORLEVEL%
    )
)

echo [信息] 正在启动前端开发服务器 (npm run dev)...
call npm run dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] 前端服务异常退出，错误码: %ERRORLEVEL%
    pause
)
