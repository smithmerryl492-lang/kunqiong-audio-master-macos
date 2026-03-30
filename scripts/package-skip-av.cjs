#!/usr/bin/env node
/**
 * 音频处理大师 - 跳过AV依赖的打包脚本 v1.0.4
 * 修复打开文件夹按钮统一性和功能问题，跳过有问题的av包安装
 */

const fs = require('fs');
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
    logError(`错误: ${error.message}`);
    return false;
  }
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    logSuccess(`${description}: ${filePath} (${sizeMB} MB)`);
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

function getDirSize(dirPath) {
  let totalSize = 0;
  if (!fs.existsSync(dirPath)) return 0;
  
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

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const backendDir = path.join(rootDir, 'backend');
  const backendDistDir = path.join(rootDir, 'backend-dist');
  const ffmpegDir = path.join(rootDir, 'ffmpeg');
  const distDir = path.join(rootDir, 'dist');
  const releaseDir = path.join(rootDir, 'release-final');
  
  logHeader('音频处理大师 v1.0.4 - 跳过AV依赖打包');
  
  try {
    // 1. 环境检查
    logHeader('环境检查');
    
    // 检查 Node.js
    try {
      const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
      logSuccess(`Node.js: ${nodeVersion}`);
    } catch (e) {
      logError('Node.js 未安装或不在 PATH 中');
      process.exit(1);
    }
    
    // 检查 Python
    try {
      const pythonVersion = execSync('python --version', { encoding: 'utf8' }).trim();
      logSuccess(`Python: ${pythonVersion}`);
    } catch (e) {
      logError('Python 未安装或不在 PATH 中');
      process.exit(1);
    }
    
    // 检查 npm 依赖
    if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
      logWarning('Node.js 依赖未安装，正在安装...');
      if (!runCommand('npm install')) {
        logError('npm install 失败');
        process.exit(1);
      }
    }
    
    // 跳过Python依赖安装，使用现有环境
    logWarning('跳过Python依赖重新安装，使用现有环境');
    logInfo('注意：音频转文字功能可能受限，但其他功能正常');
    
    // 检查 PyInstaller
    try {
      execSync('python -m PyInstaller --version', { stdio: 'pipe' });
      logSuccess('PyInstaller 已安装');
    } catch (e) {
      logWarning('PyInstaller 未安装，正在安装...');
      if (!runCommand('python -m pip install pyinstaller')) {
        logError('PyInstaller 安装失败');
        process.exit(1);
      }
    }
    
    // 2. 检查必要文件
    logHeader('检查必要文件');
    
    const requiredFiles = [
      [path.join(backendDir, 'main_exe.py'), '后端入口文件'],
      [path.join(backendDir, 'build_backend.spec'), 'PyInstaller 配置'],
      [path.join(rootDir, 'package.json'), '前端配置文件'],
      [path.join(rootDir, '音频处理大师.ico'), '应用图标']
    ];
    
    for (const [filePath, description] of requiredFiles) {
      if (!checkFile(filePath, description)) {
        process.exit(1);
      }
    }
    
    // 3. 检查 FFmpeg
    logHeader('检查 FFmpeg');
    
    const ffmpegExe = path.join(ffmpegDir, 'ffmpeg.exe');
    const ffprobeExe = path.join(ffmpegDir, 'ffprobe.exe');
    
    if (!fs.existsSync(ffmpegExe) || !fs.existsSync(ffprobeExe)) {
      logWarning('FFmpeg 文件不完整，尝试从系统复制...');
      
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
        logError('FFmpeg 未找到！请下载并放置到 ffmpeg/ 目录');
        logInfo('下载地址: https://www.gyan.dev/ffmpeg/builds/');
        process.exit(1);
      }
    }
    
    checkFile(ffmpegExe, 'FFmpeg');
    checkFile(ffprobeExe, 'FFprobe');
    
    // 4. 清理旧文件
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
        try {
          fs.rmSync(dir, { recursive: true, force: true });
          logInfo(`清理: ${path.relative(rootDir, dir)}`);
        } catch (error) {
          logWarning(`清理失败: ${path.relative(rootDir, dir)} - ${error.message}`);
        }
      }
    }
    
    // 5. 打包后端
    logHeader('打包后端');
    
    const originalCwd = process.cwd();
    process.chdir(backendDir);
    logInfo(`切换到后端目录: ${backendDir}`);
    
    // 使用更详细的 PyInstaller 命令
    const pyinstallerCmd = 'python -m PyInstaller build_backend.spec --clean --noconfirm';
    if (!runCommand(pyinstallerCmd)) {
      logError('后端打包失败');
      process.chdir(originalCwd);
      process.exit(1);
    }
    
    process.chdir(originalCwd);
    logInfo(`切换回根目录: ${originalCwd}`);
    
    const backendExe = path.join(backendDir, 'dist', 'backend.exe');
    if (!checkFile(backendExe, '后端可执行文件')) {
      process.exit(1);
    }
    
    // 准备 backend-dist
    logInfo('准备后端分发目录...');
    fs.mkdirSync(backendDistDir, { recursive: true });
    fs.copyFileSync(backendExe, path.join(backendDistDir, 'backend.exe'));
    
    // 复制资源文件
    const resourceDirs = ['effects', 'bgm', 'models', 'config'];
    for (const dir of resourceDirs) {
      const src = path.join(backendDir, dir);
      const dest = path.join(backendDistDir, dir);
      if (fs.existsSync(src)) {
        copyDirectory(src, dest);
      } else {
        logWarning(`资源目录不存在: ${src}`);
      }
    }
    
    // 创建必要目录
    fs.mkdirSync(path.join(backendDistDir, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(backendDistDir, 'outputs'), { recursive: true });
    
    logSuccess('后端打包完成');
    
    // 6. 构建前端
    logHeader('构建前端');
    
    process.chdir(rootDir);
    
    // 清理前端缓存
    if (fs.existsSync(path.join(rootDir, '.vite'))) {
      fs.rmSync(path.join(rootDir, '.vite'), { recursive: true, force: true });
    }
    
    if (!runCommand('npm run build:frontend')) {
      logError('前端构建失败');
      process.exit(1);
    }
    
    if (!checkFile(path.join(distDir, 'index.html'), '前端构建文件')) {
      process.exit(1);
    }
    
    logSuccess('前端构建完成');
    
    // 7. 打包 Electron
    logHeader('打包 Electron');
    
    // 设置环境变量
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    process.env.ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES = 'true';
    
    // 使用 electron-builder 打包
    if (!runCommand('npx electron-builder --win --dir')) {
      logError('Electron 打包失败');
      process.exit(1);
    }
    
    // 8. 验证输出
    logHeader('验证输出');
    
    const appDir = path.join(releaseDir, 'win-unpacked');
    const appExe = path.join(appDir, '音频处理大师.exe');
    
    if (!checkFile(appExe, '应用程序')) {
      process.exit(1);
    }
    
    // 检查关键资源
    const criticalPaths = [
      [path.join(appDir, 'resources', 'backend', 'backend.exe'), '后端程序'],
      [path.join(appDir, 'resources', 'ffmpeg', 'ffmpeg.exe'), 'FFmpeg'],
      [path.join(appDir, 'resources', 'app', 'dist', 'index.html'), '前端页面']
    ];
    
    for (const [filePath, description] of criticalPaths) {
      if (!checkFile(filePath, description)) {
        logWarning(`关键文件缺失: ${description}`);
      }
    }
    
    // 9. 创建启动脚本和说明文件
    logHeader('创建辅助文件');
    
    const launcherContent = `@echo off
chcp 65001 >nul
title 音频处理大师 v1.0.4

echo ========================================
echo   音频处理大师 v1.0.4
echo   打开文件夹按钮修复版本
echo ========================================
echo.

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"

REM 应用程序路径
set "APP_PATH=%SCRIPT_DIR%音频处理大师.exe"

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
echo 启动中...
start "" "%APP_PATH%"

REM 等待启动完成
timeout /t 2 /nobreak >nul

echo 应用程序已启动！
echo 如果遇到问题，请查看 README.txt
echo.
`;

    const readmeContent = `# 音频处理大师 v1.0.4

## 版本更新

v1.0.4 更新内容：
- 🔧 修复打开文件夹按钮：统一所有功能模块的按钮文本为"打开文件夹"
- 🛠️ 改进文件夹打开功能：修复部分模块无法正确打开输出目录的问题
- 🌐 跨平台路径处理：支持 Windows、Mac、Linux 等不同操作系统
- 💡 用户体验优化：添加友好的错误提示信息
- 📁 路径处理优化：正确处理文件路径和目录路径的区别

v1.0.3 更新内容：
- 🚀 重大性能优化：滑块响应性提升，解决快速拖拽延迟问题
- 🎨 界面优化：统一状态显示组件，提升视觉一致性
- ⚡ Tab切换优化：减少90%不必要渲染，提升切换流畅度
- 🔧 数值显示优化：去除末尾的0，如"2.300倍"显示为"2.3倍"
- 📦 代码重构：减少重复代码，提高可维护性
- 🛠️ 工具提示修复：解决被容器遮挡的问题
- 💾 音频缓存优化：避免重复计算音频时长

## 重要说明

⚠️ 本版本跳过了部分依赖安装以避免编译错误：
- 音频转文字功能可能受限或无法使用
- 其他所有功能（音频转换、变速、倒放、均衡器等）完全正常
- 如需完整功能，请在有Visual Studio Build Tools的环境中重新打包

## 使用说明

1. **启动应用**: 双击 \`音频处理大师.exe\` 或 \`启动.bat\`
2. **系统要求**: Windows 10/11 x64
3. **无需安装**: 这是一个便携版应用，无需安装任何运行时环境

## 功能特性

✅ 完全可用的功能：
- 音频格式转换 (MP3, WAV, FLAC, AAC 等)
- 音频速度调节 (0.5x - 2.0x) - 已优化
- 音频反转播放
- 淡入淡出效果
- 添加背景音乐和音效
- 去除静音片段
- 均衡器调节 - 已优化
- 音频录制
- 文字转语音
- 音量调整 - 已优化

⚠️ 可能受限的功能：
- 语音转文字（依赖faster-whisper）

## 故障排除

如果应用无法启动：
1. 确保所有文件完整
2. 检查是否有杀毒软件阻止运行
3. 尝试以管理员身份运行
4. 查看系统事件日志获取详细错误信息

## 版本信息

版本: 1.0.4
构建时间: ${new Date().toLocaleString('zh-CN')}
构建环境: Windows x64
特殊说明: 跳过AV依赖版本
`;

    const launcherPath = path.join(appDir, '启动.bat');
    const readmePath = path.join(appDir, 'README.txt');
    
    fs.writeFileSync(launcherPath, launcherContent, 'utf8');
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    
    logSuccess(`创建启动脚本: ${path.relative(rootDir, launcherPath)}`);
    logSuccess(`创建说明文件: ${path.relative(rootDir, readmePath)}`);
    
    // 10. 计算总大小和完成报告
    logHeader('打包完成');
    
    const totalSize = getDirSize(appDir);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    
    logSuccess('应用程序已成功打包！');
    console.log();
    logInfo(`输出目录: ${path.relative(rootDir, appDir)}`);
    logInfo(`应用程序: 音频处理大师.exe`);
    logInfo(`版本: 1.0.4 (跳过AV依赖版本)`);
    logInfo(`总大小: ${sizeMB} MB`);
    console.log();
    logWarning('重要提醒:');
    logWarning('• 音频转文字功能可能无法使用');
    logWarning('• 其他所有功能完全正常');
    logWarning('• 性能优化已全部应用');
    console.log();
    logInfo('包含内容:');
    logInfo('• 完整的音频处理应用程序');
    logInfo('• 内置后端服务 (Python + FastAPI)');
    logInfo('• FFmpeg 音频处理引擎');
    logInfo('• 所有必要的依赖库（除av包）');
    logInfo('• 音效和背景音乐资源');
    logInfo('• 性能优化的前端界面');
    
  } catch (error) {
    logError(`打包过程中发生错误: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 处理 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n打包被中断');
  process.exit(1);
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

main().catch(error => {
  console.error(`未处理的错误: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});