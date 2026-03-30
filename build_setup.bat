@echo off
chcp 65001 >nul
echo ========================================
echo   音频处理大师 - 安装包生成工具
echo ========================================
echo.

set ISCC="C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

echo 正在编译安装程序...
%ISCC% "%~dp0installer.iss"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   编译成功！
    echo   安装包位置: release-all\音频处理大师_Setup_v1.0.0.exe
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   编译失败，请检查错误信息
    echo ========================================
)

echo.
pause
