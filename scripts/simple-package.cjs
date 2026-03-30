#!/usr/bin/env node
/**
 * 音频处理大师 - 简化打包脚本
 * 跳过清理步骤，直接打包
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

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
  
  try {
    fs.copySync(src, dest, { overwrite: true });
    logSuccess(`复制目录: ${src} -> ${dest}`);
    return true;
  } catch (error) {
    logError(`复制目录失败: ${error.message}`);
    return false;
  }
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const backendDir = path.join(rootDir, 'backend');
  const backendDistDir = path.join(rootDir, 'backend-dist');
  const ffmpegDir = path.join(rootDir, 'ffmpeg');
  const distDir = path.join(rootDir, 'dist');
  const releaseDir = path.join(rootDir, 'release-final');
  
  logHeader('音频处理大师 - 简化打包脚本');
  
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
    
    logSuccess('环境检查完成');
    
    // 2. 检查 FFmpeg
    logHeader('检查 FFmpeg');
    
    const ffmpegExe = path.join(ffmpegDir, 'ffmpeg.exe');
    const ffprobeExe = path.join(ffmpegDir, 'ffprobe.exe');
    
    checkFile(ffmpegExe, 'FFmpeg');
    checkFile(ffprobeExe, 'FFprobe');
    
    // 3. 打包后端
    logHeader('打包后端');
    
    // 检查后端文件
    const mainExePath = path.join(backendDir, 'main_exe.py');
    const specPath = path.join(backendDir, 'build_backend.spec');
    
    if (!checkFile(mainExePath, '后端入口文件')) {
      process.exit(1);
    }
    
    if (!checkFile(specPath, 'PyInstaller 配置文件')) {
      process.exit(1);
    }
    
    // 切换到后端目录并打包
    const originalCwd = process.cwd();
    process.chdir(backendDir);
    logInfo(`切换到后端目录: ${backendDir}`);
    
    if (!runCommand('python -m PyInstaller build_backend.spec --clean --noconfirm')) {
      logError('后端打包失败');
      process.chdir(originalCwd);
      process.exit(1);
    }
    
    process.chdir(originalCwd);
    logInfo(`切换回根目录: ${originalCwd}`);
    
    // 检查后端打包结果
    const backendExe = path.join(backendDir, 'dist', 'backend.exe');
    if (!checkFile(backendExe, '后端可执行文件')) {
      process.exit(1);
    }
    
    // 准备 backend-dist
    if (!fs.existsSync(backendDistDir)) {
      fs.mkdirSync(backendDistDir, { recursive: true });
    }
    
    fs.copyFileSync(backendExe, path.join(backendDistDir, 'backend.exe'));
    logSuccess('复制后端可执行文件');
    
    // 复制资源文件
    const resourceDirs = ['effects', 'bgm', 'models'];
    for (const dir of resourceDirs) {
      const src = path.join(backendDir, dir);
      const dest = path.join(backendDistDir, dir);
      if (fs.existsSync(src)) {
        logInfo(`复制资源目录: ${dir}`);
        if (!copyDirectory(src, dest)) {
          logWarning(`资源目录复制失败: ${dir}`);
        }
      } else {
        logWarning(`资源目录不存在: ${src}`);
      }
    }
    
    // 创建必要目录
    fs.mkdirSync(path.join(backendDistDir, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(backendDistDir, 'outputs'), { recursive: true });
    
    logSuccess('后端打包完成');
    
    // 4. 构建前端
    logHeader('构建前端');
    
    if (fs.existsSync(path.join(distDir, 'index.html'))) {
      logInfo('前端构建文件已存在，跳过构建 (如需重新构建请先运行 npm run clean)');
    } else {
      logInfo('前端构建文件不存在，开始构建...');
      if (!runCommand('npm run build:frontend')) {
        logError('前端构建失败');
        process.exit(1);
      }
    }
    
    if (!checkFile(path.join(distDir, 'index.html'), '前端构建文件')) {
      process.exit(1);
    }
    
    logSuccess('前端构建完成');
    
    // 5. 打包 Electron
    logHeader('打包 Electron');
    
    // 设置环境变量禁用代码签名
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    
    if (!runCommand('npx electron-builder --win --dir')) {
      logError('Electron 打包失败');
      process.exit(1);
    }
    
    // 6. 验证输出
    logHeader('验证输出');
    
    const appDir = path.join(releaseDir, 'win-unpacked');
    const appExe = path.join(appDir, '音频处理大师.exe');
    
    if (!checkFile(appExe, '应用程序')) {
      process.exit(1);
    }
    
    // 7. 创建独立文件夹
    logHeader('创建独立发布包');
    
    const finalDir = path.join(rootDir, 'release-standalone');
    
    copyDirectory(appDir, finalDir);
    
    // 创建启动脚本和说明文件
    const launcherContent = `@echo off
REM 音频处理大师 - 启动脚本

setlocal enabledelayedexpansion

REM 获取脚本所在目录
set SCRIPT_DIR=%~dp0

REM 应用程序路径
set APP_PATH=%SCRIPT_DIR%音频处理大师.exe

REM 检查应用程序是否存在
if not exist "%APP_PATH%" (
    echo 错误: 找不到应用程序
    echo 预期位置: %APP_PATH%
    pause
    exit /b 1
)

REM 启动应用程序
echo 启动音频处理大师...
start "" "%APP_PATH%"

timeout /t 1 /nobreak >nul
`;

    // 读取 package.json 获取版本号
    const packageJson = require(path.join(rootDir, 'package.json'));
    const version = packageJson.version;

    const readmeContent = `# 音频处理大师

## 使用说明

1. **启动应用**: 双击 音频处理大师.exe 或 启动.bat
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

## 版本信息

版本: ${version}
构建时间: ${new Date().toLocaleString('zh-CN')}
`;

    const launcherPath = path.join(finalDir, '启动.bat');
    const readmePath = path.join(finalDir, 'README.txt');
    
    fs.writeFileSync(launcherPath, launcherContent, 'utf8');
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    
    logSuccess(`创建启动脚本: 启动.bat`);
    logSuccess(`创建说明文件: README.txt`);
    
    // 8. 完成
    logHeader('打包完成');
    
    logSuccess('应用程序已成功打包！');
    console.log();
    logInfo(`输出目录: release-standalone`);
    logInfo(`应用程序: 音频处理大师.exe`);
    console.log();
    logInfo('说明:');
    logInfo('• 这是一个完全独立的应用程序');
    logInfo('• 无需安装任何运行时环境');
    logInfo('• 可以直接复制到其他 Windows 机器运行');
    logInfo('• 包含所有必要的依赖和资源文件');
    
  } catch (error) {
    logError(`打包过程中发生错误: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n打包被中断');
  process.exit(1);
});

main().catch(error => {
  console.error(`未处理的错误: ${error.message}`);
  console.error(error);
  process.exit(1);
});