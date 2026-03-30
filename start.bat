@echo off
chcp 65001 >nul
echo ========================================
echo   音频处理大师 - 一键启动工具 (开发模式)
echo ========================================
echo.
echo 正在启动前端、后端和 Electron 界面...
echo 请稍等...
echo.

npm run dev:all

pause
