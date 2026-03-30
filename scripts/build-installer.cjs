#!/usr/bin/env node
/**
 * 音频处理大师 - 安装版打包脚本
 * 生成支持静默安装的 NSIS 安装程序
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
    try {
      fs.rmSync(dest, { recursive: true, force: true });
    } catch (error) {
      logWarning(`无法删除目标目录: ${dest}`);
    }
  }
  
  fs.mkdirSync(dest, { recursive: true });
  
  const items = fs.readdirSync(src);
  for (const item of items) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    try {
      if (fs.statSync(srcPath).isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (error) {
      logWarning(`复制失败: ${srcPath} -> ${destPath}`);
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
  const releaseFinalDir = path.join(rootDir, 'release-final');
  
  logHeader('音频处理大师 - 安装版打包脚本');
  
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
    
    // 2. 清理旧文件
    logHeader('清理旧文件');
    
    const cleanDirs = [distDir, backendDistDir, releaseFinalDir];
    for (const dir of cleanDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        logInfo(`清理目录: ${dir}`);
      }
    }
    
    // 清理后端构建文件
    const backendBuildDirs = [
      path.join(backendDir, 'dist'),
      path.join(backendDir, 'build')
    ];
    for (const dir of backendBuildDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        logInfo(`清理后端构建目录: ${dir}`);
      }
    }
    
    logSuccess('清理完成');
    
    // 3. 检查 FFmpeg
    logHeader('检查 FFmpeg');
    
    const ffmpegExe = path.join(ffmpegDir, 'ffmpeg.exe');
    const ffprobeExe = path.join(ffmpegDir, 'ffprobe.exe');
    
    if (!checkFile(ffmpegExe, 'FFmpeg')) process.exit(1);
    if (!checkFile(ffprobeExe, 'FFprobe')) process.exit(1);
    
    // 4. 打包后端
    logHeader('打包后端');
    
    // 检查后端文件
    const mainExePath = path.join(backendDir, 'main_exe.py');
    const specPath = path.join(backendDir, 'build_backend.spec');
    
    if (!checkFile(mainExePath, '后端入口文件')) process.exit(1);
    if (!checkFile(specPath, 'PyInstaller 配置文件')) process.exit(1);
    
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
    if (!checkFile(backendExe, '后端可执行文件')) process.exit(1);
    
    // 准备 backend-dist
    fs.mkdirSync(backendDistDir, { recursive: true });
    fs.copyFileSync(backendExe, path.join(backendDistDir, 'backend.exe'));
    logSuccess('复制后端可执行文件');
    
    // 复制资源文件
    const resourceDirs = ['effects', 'bgm', 'models'];
    for (const dir of resourceDirs) {
      const src = path.join(backendDir, dir);
      const dest = path.join(backendDistDir, dir);
      if (fs.existsSync(src)) {
        logInfo(`复制资源目录: ${dir}`);
        copyDirectory(src, dest);
      } else {
        logWarning(`资源目录不存在: ${src}`);
      }
    }
    
    // 创建必要目录
    fs.mkdirSync(path.join(backendDistDir, 'uploads'), { recursive: true });
    fs.mkdirSync(path.join(backendDistDir, 'outputs'), { recursive: true });
    
    logSuccess('后端打包完成');
    
    // 5. 构建前端
    logHeader('构建前端');
    
    if (!runCommand('npm run build:frontend')) {
      logError('前端构建失败');
      process.exit(1);
    }
    
    if (!checkFile(path.join(distDir, 'index.html'), '前端构建文件')) {
      process.exit(1);
    }
    
    logSuccess('前端构建完成');
    
    // 6. 打包 Electron (NSIS 安装程序)
    logHeader('打包 Electron 安装程序');
    
    // 设置环境变量禁用代码签名
    process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
    
    // 只构建 NSIS 安装程序
    if (!runCommand('npx electron-builder --win nsis')) {
      logError('Electron 安装程序打包失败');
      process.exit(1);
    }
    
    // 7. 验证输出
    logHeader('验证输出');
    
    const setupExe = path.join(releaseFinalDir, '音频处理大师 Setup 1.0.0.exe');
    if (!checkFile(setupExe, '安装程序')) {
      // 尝试查找其他可能的文件名
      const files = fs.readdirSync(releaseFinalDir).filter(f => f.endsWith('.exe'));
      if (files.length > 0) {
        logSuccess(`找到安装程序: ${files[0]}`);
      } else {
        logError('未找到安装程序文件');
        process.exit(1);
      }
    }
    
    // 8. 创建使用说明
    logHeader('创建使用说明');
    
    const usageContent = `# 音频处理大师 - 安装程序使用说明

## 安装方式

### 1. 普通安装
双击安装程序，按照向导进行安装：
\`\`\`
音频处理大师 Setup 1.0.0.exe
\`\`\`

### 2. 静默安装
使用命令行进行静默安装（无界面）：
\`\`\`
音频处理大师 Setup 1.0.0.exe /S
\`\`\`

### 3. 静默安装到指定目录
\`\`\`
音频处理大师 Setup 1.0.0.exe /S /D=C:\\MyPrograms\\音频处理大师
\`\`\`

## 安装参数说明

- \`/S\` - 静默安装（无用户界面）
- \`/D=路径\` - 指定安装目录
- 静默安装时会自动创建桌面快捷方式

## 卸载方式

### 1. 通过控制面板
设置 → 应用 → 音频处理大师 → 卸载

### 2. 通过开始菜单
开始菜单 → 音频处理大师 → 卸载音频处理大师

### 3. 静默卸载
\`\`\`
"C:\\Program Files\\音频处理大师\\Uninstall 音频处理大师.exe" /S
\`\`\`

## 功能特性

- 音频格式转换
- 音频速度调节  
- 音频反转
- 淡入淡出效果
- 添加音效
- 去除静音
- 均衡器调节

## 系统要求

- Windows 10/11 x64
- 至少 500MB 可用磁盘空间

## 版本信息

版本: 1.0.0
构建时间: ${new Date().toLocaleString('zh-CN')}
`;

    const usagePath = path.join(releaseFinalDir, '安装说明.txt');
    fs.writeFileSync(usagePath, usageContent, 'utf8');
    logSuccess('创建安装说明文件');
    
    // 9. 完成
    logHeader('打包完成');
    
    logSuccess('安装程序已成功创建！');
    console.log();
    logInfo(`输出目录: release-final`);
    logInfo(`安装程序: 音频处理大师 Setup 1.0.0.exe`);
    console.log();
    logInfo('使用方法:');
    logInfo('• 普通安装: 双击安装程序');
    logInfo('• 静默安装: 音频处理大师 Setup 1.0.0.exe /S');
    logInfo('• 指定目录: 音频处理大师 Setup 1.0.0.exe /S /D=C:\\MyPath');
    console.log();
    logInfo('特性:');
    logInfo('• 支持静默安装');
    logInfo('• 静默安装时自动创建桌面快捷方式');
    logInfo('• 支持自定义安装目录');
    logInfo('• 支持静默卸载');
    
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