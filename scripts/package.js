#!/usr/bin/env node
/**
 * 音频处理大师 - 完整打包脚本
 * 一键打包前后端，生成独立运行的应用程序
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('\n' + '='.repeat(60));
  log(message.padStart((60 + message.length) / 2), 'bright');
  console.log('='.repeat(60) + '\n');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

function runCommand(command, options = {}) {
  logInfo(`执行: ${command}`);
  try {
    const result = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options
    });
    return true;
  } catch (error) {
    logError(`命令执行失败: ${command}`);
    return false;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    logSuccess(`${description}: ${filePath}`);
    return true;
  } else {
    logError(`${description}不存在: ${filePath}`);
    return false;
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    logWarning(`源目录不存在: ${src}`);
    return false;
  }
  
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  
  logSuccess(`复制目录: ${src} -> ${dest}`);
  return true;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const backendDir = path.join(rootDir, 'backend');
  const backendDistDir = path.join(rootDir, 'backend-dist');
  const ffmpegDir = path.join(rootDir, 'ffmpeg');
  const distDir = path.join(rootDir, 'dist');
  const releaseDir = path.join(rootDir, 'release');
  
  logHeader('音频处理大师 - 完整打包脚本');
  
  try {
    // 1. 环境检查
    logHeader('检查环境');
    
    logInfo('检查 Node.js...');
    if (!runCommand('node --version', { stdio: 'pipe' })) {
      logError('Node.js 未安装');
      process.exit(1);
    }
    
    logInfo('检查 Python...');
    if (!runCommand('python --version', { stdio: 'pipe' })) {
      logError('Python 未安装');
      process.exit(1);
    }
    
    logInfo('检查 PyInstaller...');
    if (!runCommand('python -m pip show pyinstaller', { stdio: 'pipe' })) {
      logWarning('PyInstaller 未安装，正在安装...');
      if (!runCommand('python -m pip install pyinstaller')) {
        logError('PyInstaller 安装失败');
        process.exit(1);
      }
    }
    
    logSuccess('环境检查完成');
    
    // 2. 检查 FFmpeg
    logHeader('检查 FFmpeg');
    
    const ffmpegExe = path.join(ffmpegDir, 'ffmpeg.exe');
    const ffprobeExe = path.join(ffmpegDir, 'ffprobe.exe');
    
    if (!fs.existsSync(ffmpegExe) || !fs.existsSync(ffprobeExe)) {
      logWarning('FFmpeg 文件不完整');
      logInfo('尝试从系统 PATH 复制...');
      
      try {
        const whereResult = execSync('where ffmpeg', { encoding: 'utf8' });
        const systemFFmpeg = whereResult.trim().split('\n')[0];
        const systemDir = path.dirname(systemFFmpeg);
        
        if (!fs.existsSync(ffmpegDir)) {
          fs.mkdirSync(ffmpegDir, { recursive: true });
        }
        
        const filesToCopy = ['ffmpeg.exe', 'ffprobe.exe'];
        for (const file of filesToCopy) {
          const src = path.join(systemDir, file);
          const dest = path.join(ffmpegDir, file);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            logSuccess(`复制: ${file}`);
          }
        }
      } catch (error) {
        logError('FFmpeg 未找到！');
        logInfo('请下载 FFmpeg 并放置到 ffmpeg/ 目录');
        logInfo('下载地址: https://www.gyan.dev/ffmpeg/builds/');
        process.exit(1);
      }
    }
    
    checkFile(ffmpegExe, 'FFmpeg');
    checkFile(ffprobeExe, 'FFprobe');
    
    // 3. 清理旧文件
    logHeader('清理旧文件');
    
    const dirsToClean = [
      path.join(backendDir, 'build'),
      path.join(backendDir, 'dist'),
      backendDistDir,
      distDir,
      releaseDir
    ];
    
    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        logInfo(`清理: ${path.relative(rootDir, dir)}`);
      }
    }
    
    // 4. 打包后端
    logHeader('打包后端');
    
    process.chdir(backendDir);
    if (!runCommand('python -m PyInstaller build_backend.spec --clean')) {
      logError('后端打包失败');
      process.exit(1);
    }
    
    const backendExe = path.join(backendDir, 'dist', 'backend.exe');
    if (!checkFile(backendExe, '后端可执行文件')) {
      process.exit(1);
    }
    
    // 准备 backend-dist
    fs.mkdirSync(backendDistDir, { recursive: true });
    fs.copyFileSync(backendExe, path.join(backendDistDir, 'backend.exe'));
    
    // 复制资源文件
    const resourceDirs = ['effects', 'bgm', 'models'];
    for (const dir of resourceDirs) {
      const src = path.join(backendDir, dir);
      const dest = path.join(backendDistDir, dir);
      if (fs.existsSync(src)) {
        copyDirectory(src, dest);
      }
    }
    
    // 创建必要目录
    fs.mkdirSync(path.join(backendDistDir, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(backendDistDir, 'outputs'), { recursive: true });
    
    logSuccess('后端打包完成');
    
    // 5. 构建前端
    logHeader('构建前端');
    
    process.chdir(rootDir);
    if (!runCommand('npm run build:frontend')) {
      logError('前端构建失败');
      process.exit(1);
    }
    
    if (!checkFile(path.join(distDir, 'index.html'), '前端构建文件')) {
      process.exit(1);
    }
    
    logSuccess('前端构建完成');
    
    // 6. 打包 Electron
    logHeader('打包 Electron');
    
    // 设置环境变量禁用代码签名
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    
    if (!runCommand('npx electron-builder --win --dir')) {
      logError('Electron 打包失败');
      process.exit(1);
    }
    
    // 7. 验证输出
    logHeader('验证输出');
    
    const appDir = path.join(releaseDir, 'win-unpacked');
    const appExe = path.join(appDir, '音频处理大师.exe');
    
    if (!checkFile(appExe, '应用程序')) {
      process.exit(1);
    }
    
    // 8. 创建独立文件夹
    logHeader('创建独立发布包');
    
    const finalDir = path.join(rootDir, 'release-standalone');
    if (fs.existsSync(finalDir)) {
      fs.rmSync(finalDir, { recursive: true, force: true });
    }
    
    copyDirectory(appDir, finalDir);
    
    // 创建启动脚本和说明文件
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

    const launcherPath = path.join(finalDir, '启动.bat');
    const readmePath = path.join(finalDir, 'README.txt');
    
    fs.writeFileSync(launcherPath, launcherContent, 'utf8');
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    
    logSuccess(`创建启动脚本: ${path.relative(rootDir, launcherPath)}`);
    logSuccess(`创建说明文件: ${path.relative(rootDir, readmePath)}`);
    
    // 计算总大小
    function getDirSize(dirPath) {
      let totalSize = 0;
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        if (stats.isDirectory()) {
          totalSize += getDirSize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
      return totalSize;
    }
    
    const totalSize = getDirSize(finalDir);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    
    // 9. 完成
    logHeader('打包完成');
    
    logSuccess('应用程序已成功打包！');
    console.log();
    logInfo(`输出目录: ${path.relative(rootDir, finalDir)}`);
    logInfo(`应用程序: 音频处理大师.exe`);
    logInfo(`总大小: ${sizeMB} MB`);
    console.log();
    logInfo('说明:');
    logInfo('• 这是一个完全独立的应用程序');
    logInfo('• 无需安装任何运行时环境');
    logInfo('• 可以直接复制到其他 Windows 机器运行');
    logInfo('• 包含所有必要的依赖和资源文件');
    
  } catch (error) {
    logError(`打包过程中发生错误: ${error.message}`);
    process.exit(1);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  logWarning('\n打包被中断');
  process.exit(1);
});

main().catch(error => {
  logError(`未处理的错误: ${error.message}`);
  process.exit(1);
});