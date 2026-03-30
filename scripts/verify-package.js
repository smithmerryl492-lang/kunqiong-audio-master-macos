#!/usr/bin/env node
/**
 * 验证打包结果
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`✓ ${description}: ${filePath} (${sizeMB} MB)`);
    return true;
  } else {
    console.log(`✗ ${description}不存在: ${filePath}`);
    return false;
  }
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const releaseDir = path.join(rootDir, 'release-standalone');
  
  console.log('\n验证打包结果...\n');
  
  if (!fs.existsSync(releaseDir)) {
    console.log('✗ 发布目录不存在');
    process.exit(1);
  }
  
  const requiredFiles = [
    { path: path.join(releaseDir, '音频处理大师.exe'), desc: '主程序' },
    { path: path.join(releaseDir, '启动.bat'), desc: '启动脚本' },
    { path: path.join(releaseDir, 'README.txt'), desc: '说明文件' },
    { path: path.join(releaseDir, 'resources', 'backend', 'backend.exe'), desc: '后端程序' },
    { path: path.join(releaseDir, 'resources', 'ffmpeg', 'ffmpeg.exe'), desc: 'FFmpeg' },
  ];
  
  let allValid = true;
  
  for (const file of requiredFiles) {
    if (!checkFile(file.path, file.desc)) {
      allValid = false;
    }
  }
  
  if (allValid) {
    console.log('\n✓ 所有必要文件都存在');
    console.log('\n打包成功！可以将 release-standalone 文件夹分发给用户。');
  } else {
    console.log('\n✗ 打包验证失败');
    process.exit(1);
  }
}

main();