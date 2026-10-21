@echo off
rem 双击启动寻味小站（含 AI 助手服务），浏览器访问 http://localhost:8123
cd /d "%~dp0"
start "" http://localhost:8123
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
