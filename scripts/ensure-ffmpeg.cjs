#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const { spawnSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const FFMPEG_DIR = path.join(ROOT_DIR, 'ffmpeg')
const CACHE_DIR = path.join(ROOT_DIR, '.cache', 'ffmpeg-downloads')
const FORCE = process.argv.includes('--force')

function log(message) {
  process.stdout.write(`[ffmpeg] ${message}\n`)
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function rmSafe(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true })
}

function getPlatformConfig() {
  if (process.platform === 'win32') {
    if (process.arch !== 'x64') {
      throw new Error(`Unsupported Windows arch: ${process.arch}`)
    }
    return {
      type: 'bundle',
      label: 'Windows x64',
      archiveName: 'ffmpeg-release-essentials.zip',
      url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
      outputs: [
        { binaryName: 'ffmpeg.exe', destinationName: 'ffmpeg.exe' },
        { binaryName: 'ffprobe.exe', destinationName: 'ffprobe.exe' },
      ],
    }
  }

  if (process.platform === 'darwin') {
    const archSegment = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'amd64' : null
    if (!archSegment) {
      throw new Error(`Unsupported macOS arch: ${process.arch}`)
    }
    const baseUrl = `https://ffmpeg.martin-riedl.de/redirect/latest/macos/${archSegment}/release`
    return {
      type: 'single',
      label: `macOS ${process.arch}`,
      outputs: [
        {
          binaryName: 'ffmpeg',
          destinationName: 'ffmpeg',
          archiveName: `ffmpeg-${archSegment}.zip`,
          url: `${baseUrl}/ffmpeg.zip`,
        },
        {
          binaryName: 'ffprobe',
          destinationName: 'ffprobe',
          archiveName: `ffprobe-${archSegment}.zip`,
          url: `${baseUrl}/ffprobe.zip`,
        },
      ],
    }
  }

  throw new Error(`Unsupported platform: ${process.platform}`)
}

function outputsExist(config) {
  return config.outputs.every((entry) => fs.existsSync(path.join(FFMPEG_DIR, entry.destinationName)))
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination)

    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close()
        fs.unlinkSync(destination)
        const redirectUrl = new URL(response.headers.location, url).toString()
        resolve(download(redirectUrl, destination))
        return
      }

      if (response.statusCode !== 200) {
        file.close()
        fs.unlinkSync(destination)
        reject(new Error(`Download failed: ${url} -> HTTP ${response.statusCode}`))
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close(resolve)
      })
    })

    request.on('error', (error) => {
      file.close()
      fs.unlink(destination, () => reject(error))
    })
  })
}

function extractZip(archivePath, destinationDir) {
  ensureDir(destinationDir)

  if (process.platform === 'win32') {
    const command = [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`,
    ]
    const result = spawnSync('powershell', command, { stdio: 'inherit' })
    if (result.status !== 0) {
      throw new Error(`Failed to extract ${archivePath}`)
    }
    return
  }

  const result = spawnSync('unzip', ['-o', '-q', archivePath, '-d', destinationDir], { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`Failed to extract ${archivePath}`)
  }
}

function findBinary(rootDir, binaryName) {
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
      } else if (entry.isFile() && entry.name === binaryName) {
        return fullPath
      }
    }
  }
  return null
}

function copyBinary(sourcePath, destinationPath) {
  fs.copyFileSync(sourcePath, destinationPath)
  if (process.platform !== 'win32') {
    fs.chmodSync(destinationPath, 0o755)
  }
}

async function ensureBundle(config) {
  const archivePath = path.join(CACHE_DIR, config.archiveName)
  const extractDir = path.join(CACHE_DIR, `extract-${config.archiveName.replace(/\.zip$/, '')}`)

  log(`Downloading ${config.label} bundle from ${config.url}`)
  await download(config.url, archivePath)

  rmSafe(extractDir)
  extractZip(archivePath, extractDir)

  for (const output of config.outputs) {
    const sourcePath = findBinary(extractDir, output.binaryName)
    if (!sourcePath) {
      throw new Error(`Unable to locate ${output.binaryName} in ${archivePath}`)
    }
    copyBinary(sourcePath, path.join(FFMPEG_DIR, output.destinationName))
    log(`Prepared ${output.destinationName}`)
  }
}

async function ensureSingles(config) {
  for (const output of config.outputs) {
    const archivePath = path.join(CACHE_DIR, output.archiveName)
    const extractDir = path.join(CACHE_DIR, `extract-${output.archiveName.replace(/\.zip$/, '')}`)

    log(`Downloading ${output.destinationName} from ${output.url}`)
    await download(output.url, archivePath)

    rmSafe(extractDir)
    extractZip(archivePath, extractDir)

    const sourcePath = findBinary(extractDir, output.binaryName)
    if (!sourcePath) {
      throw new Error(`Unable to locate ${output.binaryName} in ${archivePath}`)
    }
    copyBinary(sourcePath, path.join(FFMPEG_DIR, output.destinationName))
    log(`Prepared ${output.destinationName}`)
  }
}

async function main() {
  const config = getPlatformConfig()
  ensureDir(FFMPEG_DIR)
  ensureDir(CACHE_DIR)

  if (FORCE) {
    for (const output of config.outputs) {
      rmSafe(path.join(FFMPEG_DIR, output.destinationName))
    }
  }

  if (outputsExist(config)) {
    log(`Using existing ${config.label} binaries in ${FFMPEG_DIR}`)
    return
  }

  if (config.type === 'bundle') {
    await ensureBundle(config)
  } else {
    await ensureSingles(config)
  }

  log('Download complete')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(`[ffmpeg] ${error.message}`)
    process.exit(1)
  })
