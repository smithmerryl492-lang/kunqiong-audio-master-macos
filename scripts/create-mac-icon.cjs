#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

if (process.platform !== 'darwin') {
  console.log('[icon] Skipping macOS icon generation on non-macOS platform')
  process.exit(0)
}

const ROOT_DIR = path.resolve(__dirname, '..')
const BUILD_DIR = path.join(ROOT_DIR, 'build')
const ICON_SOURCE = [
  path.join(ROOT_DIR, 'public', 'app-icon.png'),
  path.join(ROOT_DIR, 'app-icon.png'),
  path.join(ROOT_DIR, 'public', '音频处理大师.png'),
].find((candidate) => fs.existsSync(candidate))

if (!ICON_SOURCE) {
  console.error('[icon] No PNG source found for macOS icon generation')
  process.exit(1)
}

const ICONSET_DIR = path.join(BUILD_DIR, 'icon.iconset')
const ICNS_PATH = path.join(BUILD_DIR, 'icon.icns')
const PNG_PATH = path.join(BUILD_DIR, 'icon.png')

fs.rmSync(ICONSET_DIR, { recursive: true, force: true })
fs.mkdirSync(ICONSET_DIR, { recursive: true })
fs.copyFileSync(ICON_SOURCE, PNG_PATH)

const sizes = [16, 32, 128, 256, 512]
for (const size of sizes) {
  const normalTarget = path.join(ICONSET_DIR, `icon_${size}x${size}.png`)
  const retinaTarget = path.join(ICONSET_DIR, `icon_${size}x${size}@2x.png`)
  let result = spawnSync('sips', ['-z', String(size), String(size), ICON_SOURCE, '--out', normalTarget], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
  result = spawnSync('sips', ['-z', String(size * 2), String(size * 2), ICON_SOURCE, '--out', retinaTarget], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

const result = spawnSync('iconutil', ['-c', 'icns', ICONSET_DIR, '-o', ICNS_PATH], { stdio: 'inherit' })
if (result.status !== 0) {
  process.exit(result.status || 1)
}

console.log(`[icon] Generated ${ICNS_PATH}`)
