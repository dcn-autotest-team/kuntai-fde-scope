@echo off
chcp 65001 >nul
title Kuntai FDE Launch All
echo ===================================================
echo   神州鲲泰 FDE 团队能力边界判定系统 - 一键同时启动
echo ===================================================
echo.
echo 正在分别在独立终端窗口中启动后端与前端服务...
echo.

start "Kuntai FDE - Backend Service" cmd /k "%~dp0start_backend.bat"
timeout /t 2 >nul
start "Kuntai FDE - Frontend Service" cmd /k "%~dp0start_frontend.bat"

echo 前后端服务启动指令已发送！请观察弹出的两个窗口以确认服务日志。
echo.
pause
