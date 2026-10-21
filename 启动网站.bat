@echo off
chcp 65001 >nul
rem 双击本文件启动寻味小站：自动开服并打开浏览器，AI 助手开箱即用
cd /d "%~dp0"
title 寻味小站 - 服务运行中（关闭本窗口即停止网站）

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败，请把上面的报错信息发给开发者。
  pause
)
