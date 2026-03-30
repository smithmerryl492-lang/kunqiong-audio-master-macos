const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const fs = require('fs')

const zhCN = require('./locales/zh-CN.json')

function t(pathStr, params = {}) {
  const keys = pathStr.split('.')
  let result = zhCN
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      return pathStr
    }
  }
  if (typeof result !== 'string') return pathStr
  let finalString = result
  for (const [key, value] of Object.entries(params)) {
    finalString = finalString.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return finalString
}

let logFile = null
try {
  const userDataPath = app.getPath('userData')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }
  logFile = path.join(userDataPath, 'app.log')
  fs.appendFileSync(logFile, '')
} catch (error) {
  console.error(t('logs.init_failed'), error)
}

function log(message) {
  const time = new Date().toISOString()
  const line = `[${time}] ${message}\n`
  console.log(message)
  if (!logFile) return
  try {
    fs.appendFileSync(logFile, line)
  } catch {}
}

function logError(message) {
  const time = new Date().toISOString()
  const line = `[${time}] ERROR: ${message}\n`
  console.error(message)
  if (!logFile) return
  try {
    fs.appendFileSync(logFile, line)
  } catch {}
}

log(t('logs.app_started'))
log(`platform: ${process.platform}/${process.arch}`)
log(`userData: ${app.getPath('userData')}`)
log(`appPath: ${app.getAppPath()}`)
log(`isPackaged: ${app.isPackaged}`)

app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-dev-shm-usage')
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer')
app.commandLine.appendSwitch('enable-usermedia-screen-capturing')

let mainWindow
let backendProcess
let frontendServer
let currentBackendPort = 8001
let currentFrontendPort = 8000

function getBinaryName(baseName) {
  return process.platform === 'win32' ? `${baseName}.exe` : baseName
}

function getRepoRoot() {
  return path.join(__dirname, '..')
}

function getPackagedAppDir() {
  return path.join(process.resourcesPath, 'app')
}

function getResourcePath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath)
  }
  return path.join(getRepoRoot(), relativePath)
}

function getFrontendDistPath() {
  return app.isPackaged
    ? path.join(getPackagedAppDir(), 'dist')
    : path.join(getRepoRoot(), 'dist')
}

function getFFmpegDir() {
  return getResourcePath('ffmpeg')
}

function getFFmpegPath() {
  const binaryPath = path.join(getFFmpegDir(), getBinaryName('ffmpeg'))
  return fs.existsSync(binaryPath) ? binaryPath : 'ffmpeg'
}

function getFFprobePath() {
  const binaryPath = path.join(getFFmpegDir(), getBinaryName('ffprobe'))
  return fs.existsSync(binaryPath) ? binaryPath : 'ffprobe'
}

function getBackendDir() {
  return app.isPackaged
    ? getResourcePath('backend')
    : path.join(getRepoRoot(), 'backend-dist')
}

function getBackendExecutablePath() {
  return path.join(getBackendDir(), getBinaryName('backend'))
}

function getWindowIconPath() {
  const candidates = app.isPackaged
    ? [
        path.join(getPackagedAppDir(), 'build', 'icon.png'),
        path.join(getPackagedAppDir(), 'public', 'app-icon.png'),
      ]
    : [
        path.join(getRepoRoot(), 'public', 'app-icon.png'),
        path.join(getRepoRoot(), 'app-icon.png'),
        path.join(getRepoRoot(), 'public', '音频处理大师.png'),
      ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}

function prependPath(dirPath) {
  const delimiter = process.platform === 'win32' ? ';' : ':'
  const existingPath = process.env.PATH || ''
  return `${dirPath}${delimiter}${existingPath}`
}

async function findFreePort(startPort) {
  const net = require('net')
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(findFreePort(startPort + 1)))
    server.listen(startPort, '127.0.0.1', () => {
      server.close(() => resolve(startPort))
    })
  })
}

async function startFrontendServer() {
  const http = require('http')
  const mime = require('mime-types')
  const url = require('url')

  const distPath = getFrontendDistPath()
  if (!fs.existsSync(distPath)) {
    throw new Error(`Frontend build not found: ${distPath}`)
  }

  currentFrontendPort = await findFreePort(8000)

  frontendServer = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url)
    let pathname = parsedUrl.pathname || '/'
    if (pathname === '/') {
      pathname = '/index.html'
    }

    const filePath = path.join(distPath, pathname)
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<h1>404 Not Found</h1>')
      return
    }

    const ext = path.extname(filePath)
    const contentType = mime.lookup(ext) || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': contentType })

    const readStream = fs.createReadStream(filePath)
    readStream.pipe(res)
    readStream.on('error', () => {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Server Error')
    })
  })

  await new Promise((resolve, reject) => {
    frontendServer.once('error', reject)
    frontendServer.listen(currentFrontendPort, '127.0.0.1', () => resolve())
  })

  log(t('logs.frontend_started', { port: currentFrontendPort }))
  log(t('logs.frontend_path', { path: distPath }))
}

function stopFrontendServer() {
  if (!frontendServer) return
  log(t('logs.stop_frontend'))
  frontendServer.close()
  frontendServer = null
}

async function startBackend() {
  if (!app.isPackaged) {
    log(t('logs.start_backend_dev'))
    return
  }

  const backendPath = getBackendExecutablePath()
  log(t('logs.backend_path', { path: backendPath }))
  log(t('logs.backend_exists', { exists: fs.existsSync(backendPath) }))

  if (!fs.existsSync(backendPath)) {
    throw new Error(`Backend executable not found: ${backendPath}`)
  }

  currentBackendPort = await findFreePort(8001)

  const ffmpegDir = getFFmpegDir()
  const env = {
    ...process.env,
    FFMPEG_PATH: getFFmpegPath(),
    FFPROBE_PATH: getFFprobePath(),
    RESOURCE_PATH: getBackendDir(),
    PATH: fs.existsSync(ffmpegDir) ? prependPath(ffmpegDir) : process.env.PATH || '',
  }

  backendProcess = spawn(backendPath, ['--port', currentBackendPort.toString()], {
    cwd: getBackendDir(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: process.platform === 'win32',
  })

  backendProcess.stdout.on('data', (data) => {
    log(`Backend stdout: ${data.toString()}`)
  })

  backendProcess.stderr.on('data', (data) => {
    log(`Backend stderr: ${data.toString()}`)
  })

  backendProcess.on('error', (error) => {
    logError(`${t('logs.backend_failed')} ${error.message}`)
  })

  backendProcess.on('exit', (code) => {
    log(t('logs.backend_exit', { code }))
  })
}

function stopBackend() {
  if (!backendProcess) {
    stopFrontendServer()
    return
  }

  log(t('logs.stop_backend'))
  try {
    if (process.platform === 'win32' && backendProcess.pid) {
      execSync(`taskkill /pid ${backendProcess.pid} /T /F`, { stdio: 'ignore' })
    } else {
      backendProcess.kill('SIGTERM')
    }
  } catch (error) {
    logError(`Failed to stop backend: ${error.message}`)
  }

  backendProcess = null
  stopFrontendServer()
}

function createWindow() {
  const iconPath = getWindowIconPath()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
    },
    icon: iconPath,
    backgroundColor: '#1a1b26',
    show: false,
  })

  if (app.isPackaged) {
    mainWindow.loadURL(`http://127.0.0.1:${currentFrontendPort}?backendPort=${currentBackendPort}`)
  } else {
    mainWindow.loadURL(`http://localhost:5177?backendPort=${currentBackendPort}`)
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(async () => {
  try {
    if (app.isPackaged) {
      await startFrontendServer()
      await startBackend()
    }
    createWindow()
  } catch (error) {
    logError(`App bootstrap failed: ${error.message}`)
    dialog.showErrorBox('启动失败', error.message)
    app.quit()
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  stopBackend()
})

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow.maximize()
  }
})

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close()
})

ipcMain.handle('shell:openPath', async (event, targetPath) => {
  try {
    const error = await shell.openPath(targetPath)
    if (error) {
      return { success: false, error }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('shell:showItemInFolder', async (event, targetPath) => {
  try {
    shell.showItemInFolder(targetPath)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('fs:stat', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath)
    return {
      success: true,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      size: stats.size,
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('dialog:showOpenDialog', async (event, options) => {
  return dialog.showOpenDialog(mainWindow, options)
})

ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.handle('update:check', async () => {
  const version = app.getVersion()
  const software = '10003'
  const apiUrl = `http://software.kunqiongai.com:8000/api/v1/updates/check/?software=${software}&version=${version}`

  log(`Checking for update: ${apiUrl}`)

  return new Promise((resolve) => {
    const http = require('http')
    const req = http.get(apiUrl, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (error) {
          logError(`Failed to parse update response: ${error}`)
          resolve({ has_update: false, error: 'Parse error' })
        }
      })
    })

    req.on('error', (error) => {
      logError(`Update check failed: ${error}`)
      resolve({ has_update: false, error: error.message })
    })

    req.setTimeout(5000, () => {
      req.destroy()
      resolve({ has_update: false, error: 'Timeout' })
    })
  })
})

ipcMain.handle('update:start', async (event, updateInfo) => {
  if (process.platform !== 'win32') {
    return {
      success: false,
      error: 'macOS updater is not bundled in the unsigned build',
    }
  }

  try {
    const updaterPath = app.isPackaged
      ? path.join(process.resourcesPath, 'updater.exe')
      : path.join(getRepoRoot(), 'updater.exe')

    if (!fs.existsSync(updaterPath)) {
      logError(`Updater not found at ${updaterPath}`)
      return { success: false, error: 'Updater not found' }
    }

    const appDir = path.dirname(app.getPath('exe'))
    const exeName = path.basename(app.getPath('exe'))
    const args = [
      '--url', updateInfo.download_url,
      '--hash', updateInfo.package_hash,
      '--dir', appDir,
      '--exe', exeName,
      '--pid', process.pid.toString(),
    ]

    log(`Launching updater: ${updaterPath} ${args.join(' ')}`)

    const subprocess = spawn(updaterPath, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })

    subprocess.unref()
    app.quit()
    return { success: true }
  } catch (error) {
    logError(`Failed to start updater: ${error}`)
    return { success: false, error: error.message }
  }
})
