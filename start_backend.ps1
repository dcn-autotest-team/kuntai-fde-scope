# PowerShell 后端一键启动脚本
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$scriptPath\backend"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  神州鲲泰 FDE 团队能力边界判定系统 - 后端服务启动" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

if (Test-Path ".\.venv\Scripts\python.exe") {
    Write-Host "[信息] 检测到虚拟环境 .venv，正在使用虚拟环境 Python..." -ForegroundColor Green
    & ".\.venv\Scripts\python.exe" run.py
} else {
    Write-Host "[警告] 未检测到 .venv 虚拟环境，尝试使用系统 Python..." -ForegroundColor Yellow
    python run.py
}
