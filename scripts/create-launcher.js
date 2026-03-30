#!/usr/bin/env node
/**
 * 创建启动脚本
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const launcherContent = `@echo off
REM 音频处理大师 - 启动脚本
REM 自动生成，请勿手动修改

setlocal enabledelayedexpansion

REM 获取脚本所在目录
set SCRIPT_DIR=%~dp0

REM 应用程序路径
set APP_PATH=%SCRIPT_DIR%音频处理大师.exe

REM 检查应用程序是否存在
if not exist "%APP_PATH%" (
    echo 错误: 找不到应用程序
    echo 预期位置: %APP_PATH%
    echo.
    echo 请确保文件完整
    pause
    exit /b 1
)

REM 启动应用程序
echo 启动音频处理大师...
start "" "%APP_PATH%"

REM 等待一秒后退出脚本
timeout /t 1 /nobreak >nul
`;

const readmeContent = `# 音频处理大师

## 使用说明

1. **启动应用**: 双击 \`音频处理大师.exe\` 或 \`启动.bat\`
2. **系统要求**: Windows 10/11 x64
3. **无需安装**: 这是一个便携版应用，无需安装任何运行时环境

## 功能特性

- 音频格式转换
- 音频速度调节
- 音频反转
- 淡入淡出效果
- 添加音效
- 去除静音
- 均衡器调节

## 技术支持

如有问题，请联系技术支持。

## 版本信息

版本: 1.0.0
构建时间: ${new Date().toLocaleString('zh-CN')}
`;

export const createLauncher = (targetDir) => {
  const launcherPath = path.join(targetDir, '启动.bat');
  const readmePath = path.join(targetDir, 'README.txt');
  
  fs.writeFileSync(launcherPath, launcherContent, 'utf8');
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  
  console.log(`✓ 创建启动脚本: ${launcherPath}`);
  console.log(`✓ 创建说明文件: ${readmePath}`);
};

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const targetDir = process.argv[2] || path.join(__dirname, '..', 'release-standalone');
  createLauncher(targetDir);
}