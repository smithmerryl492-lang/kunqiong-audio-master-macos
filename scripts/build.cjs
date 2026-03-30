#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const BACKEND_DIR = path.join(ROOT_DIR, 'backend')
const BACKEND_DIST_DIR = path.join(ROOT_DIR, 'backend-dist')
const FRONTEND_DIST_DIR = path.join(ROOT_DIR, 'dist')
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json')

const PLATFORM = process.platform
const IS_WINDOWS = PLATFORM === 'win32'
const IS_MAC = PLATFORM === 'darwin'

if (!IS_WINDOWS && !IS_MAC) {
  console.error(`Unsupported platform: ${PLATFORM}`)
  process.exit(1)
}

const BUILD_MODES = IS_WINDOWS
  ? {
      dir: { target: ['dir'], output: 'release-dir', description: 'Windows directory build' },
      installer: { target: ['nsis'], output: 'release-installer', description: 'Windows installer' },
      portable: { target: ['portable'], output: 'release-portable', description: 'Windows portable build' },
      all: { target: ['nsis', 'portable', 'dir'], output: 'release-all', description: 'All Windows artifacts' },
    }
  : {
      dir: { target: ['dir'], output: 'release-macos-dir', description: 'macOS app bundle' },
      installer: { target: ['dmg'], output: 'release-macos-installer', description: 'macOS DMG installer' },
      portable: { target: ['zip'], output: 'release-macos-portable', description: 'macOS portable ZIP' },
      all: { target: ['dmg', 'zip', 'dir'], output: 'release-macos', description: 'All macOS artifacts' },
    }

function runCommand(command, options = {}) {
  const { cwd = ROOT_DIR, env, showOutput = true } = options
  try {
    const output = execSync(command, {
      cwd,
      env: { ...process.env, ...env },
      stdio: showOutput ? 'inherit' : 'pipe',
      encoding: 'utf8',
    })
    return { success: true, output }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || '',
      exitCode: error.status || error.exitCode || 1,
    }
  }
}

function backendBinaryName() {
  return IS_WINDOWS ? 'backend.exe' : 'backend'
}

function packagePlatformKey() {
  return IS_WINDOWS ? 'win' : 'mac'
}

function builderFlag() {
  return IS_WINDOWS ? '--win' : '--mac'
}

function ffmpegBinaryName() {
  return IS_WINDOWS ? 'ffmpeg.exe' : 'ffmpeg'
}

function ffprobeBinaryName() {
  return IS_WINDOWS ? 'ffprobe.exe' : 'ffprobe'
}

function checkDependencies() {
  const ffmpegPath = path.join(ROOT_DIR, 'ffmpeg', ffmpegBinaryName())
  const ffprobePath = path.join(ROOT_DIR, 'ffmpeg', ffprobeBinaryName())

  const commands = [
    ['node --version', 'Node.js'],
    ['npm --version', 'npm'],
    ['python --version', 'Python'],
    ['python -m PyInstaller --version', 'PyInstaller'],
  ]

  for (const [command, label] of commands) {
    const result = runCommand(command, { showOutput: false })
    if (!result.success) {
      console.error(`Missing dependency: ${label}`)
      return false
    }
  }

  if (!fs.existsSync(ffmpegPath) || !fs.existsSync(ffprobePath)) {
    console.error('FFmpeg binaries are missing. Run `npm run ffmpeg:download` first.')
    return false
  }

  return true
}

function cleanOutputs() {
  const directories = [
    'release-dir',
    'release-installer',
    'release-portable',
    'release-all',
    'release-macos',
    'release-macos-dir',
    'release-macos-installer',
    'release-macos-portable',
    'backend/dist',
    'backend/build',
    'backend-dist',
  ]

  for (const relativePath of directories) {
    const fullPath = path.join(ROOT_DIR, relativePath)
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true })
    }
  }
}

function buildBackend() {
  const result = runCommand('python -m PyInstaller build_backend.spec --clean --noconfirm', {
    cwd: BACKEND_DIR,
  })
  if (!result.success) {
    console.error('Backend build failed')
    return false
  }

  const backendBinaryPath = path.join(BACKEND_DIR, 'dist', backendBinaryName())
  if (!fs.existsSync(backendBinaryPath)) {
    console.error(`Backend output not found: ${backendBinaryPath}`)
    return false
  }

  fs.rmSync(BACKEND_DIST_DIR, { recursive: true, force: true })
  fs.mkdirSync(BACKEND_DIST_DIR, { recursive: true })
  fs.copyFileSync(backendBinaryPath, path.join(BACKEND_DIST_DIR, backendBinaryName()))

  const resourceDirs = ['effects', 'bgm', 'models', 'config']
  for (const dirName of resourceDirs) {
    const sourceDir = path.join(BACKEND_DIR, dirName)
    const targetDir = path.join(BACKEND_DIST_DIR, dirName)
    if (fs.existsSync(sourceDir)) {
      fs.cpSync(sourceDir, targetDir, { recursive: true })
    }
  }

  fs.mkdirSync(path.join(BACKEND_DIST_DIR, 'uploads'), { recursive: true })
  fs.mkdirSync(path.join(BACKEND_DIST_DIR, 'outputs'), { recursive: true })
  return true
}

function buildFrontend() {
  const result = runCommand('npm run build:frontend')
  if (!result.success) {
    console.error('Frontend build failed')
    return false
  }
  return fs.existsSync(path.join(FRONTEND_DIST_DIR, 'index.html'))
}

function withTemporaryPackageJson(mutator, callback) {
  const original = fs.readFileSync(PACKAGE_JSON_PATH, 'utf8')
  const parsed = JSON.parse(original)
  mutator(parsed)
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(parsed, null, 2), 'utf8')
  try {
    return callback(parsed)
  } finally {
    fs.writeFileSync(PACKAGE_JSON_PATH, original, 'utf8')
  }
}

function buildElectron(mode) {
  const modeConfig = BUILD_MODES[mode]
  if (!modeConfig) {
    console.error(`Unsupported build mode: ${mode}`)
    return false
  }

  return withTemporaryPackageJson((packageJson) => {
    packageJson.build.directories.output = modeConfig.output
    packageJson.build[packagePlatformKey()].target = modeConfig.target
    if (IS_MAC) {
      packageJson.build.extraResources = (packageJson.build.extraResources || []).filter((entry) => entry.from !== 'updater.exe')
    }
  }, () => {
    const result = runCommand(`npx electron-builder ${builderFlag()}`, {
      env: { CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    })
    return result.success
  })
}

function verifyOutput(mode) {
  const outputDir = path.join(ROOT_DIR, BUILD_MODES[mode].output)
  if (!fs.existsSync(outputDir)) {
    console.error(`Output directory not found: ${outputDir}`)
    return false
  }

  const files = fs.readdirSync(outputDir)
  if (IS_WINDOWS) {
    if (mode === 'dir' || mode === 'all') {
      const dirApp = path.join(outputDir, 'win-unpacked')
      if (!fs.existsSync(dirApp)) return false
    }
    if (mode === 'installer' || mode === 'all') {
      if (!files.some((name) => name.endsWith('.exe') && name.toLowerCase().includes('setup'))) return false
    }
    if (mode === 'portable' || mode === 'all') {
      if (!files.some((name) => name.endsWith('.exe') && name.toLowerCase().includes('portable'))) return false
    }
    return true
  }

  if (mode === 'dir' || mode === 'all') {
    const appExists = files.some((name) => name.endsWith('.app'))
    const unpackedDirExists = files.some((name) => {
      const fullPath = path.join(outputDir, name)
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory() && name.startsWith('mac')
    })
    if (!appExists && !unpackedDirExists) return false
  }
  if (mode === 'installer' || mode === 'all') {
    if (!files.some((name) => name.endsWith('.dmg'))) return false
  }
  if (mode === 'portable' || mode === 'all') {
    if (!files.some((name) => name.endsWith('.zip'))) return false
  }
  return true
}

function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || 'dir'
  const clean = args.includes('--clean') || args.includes('-c')

  if (!BUILD_MODES[mode]) {
    console.error(`Unknown mode: ${mode}`)
    process.exit(1)
  }

  if (clean) {
    cleanOutputs()
  }

  if (!checkDependencies()) {
    process.exit(1)
  }

  if (IS_MAC) {
    const iconResult = runCommand('node scripts/create-mac-icon.cjs')
    if (!iconResult.success) {
      process.exit(1)
    }
  }

  if (!buildBackend()) {
    process.exit(1)
  }

  if (!buildFrontend()) {
    process.exit(1)
  }

  if (!buildElectron(mode)) {
    process.exit(1)
  }

  if (!verifyOutput(mode)) {
    console.error('Build finished but verification failed')
    process.exit(1)
  }

  console.log(`Build completed: ${BUILD_MODES[mode].description}`)
  console.log(`Output: ${path.join(ROOT_DIR, BUILD_MODES[mode].output)}`)
}

main()
