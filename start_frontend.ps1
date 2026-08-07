# PowerShell 前端一键启动脚本
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptPath\frontend"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  神州鲲泰 FDE 团队能力边界判定系统 - 前端服务启动" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

if (-not (Test-Path ".\node_modules")) {
    Write-Host "[提示] 尚未安装前端依赖包，正在自动执行 npm install..." -ForegroundColor Yellow
    npm install
}

Write-Host "[信息] 正在启动前端开发服务器 (npm run dev)..." -ForegroundColor Green
npm run dev
