@echo off
chcp 65001 >nul
title Kuntai FDE Backend Service
echo ===================================================
echo   神州鲲泰 FDE 团队能力边界判定系统 - 后端服务启动
echo ===================================================

cd /d "%~dp0backend"

if exist ".venv\Scripts\python.exe" (
    echo [信息] 检测到虚拟环境 .venv，正在使用虚拟环境 Python...
    ".venv\Scripts\python.exe" run.py
) else (
    echo [警告] 未检测到 .venv 虚拟环境，尝试使用系统 Python...
    python run.py
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] 后端服务异常退出，错误码: %ERRORLEVEL%
    pause
)
