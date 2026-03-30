const { contextBridge, shell, ipcRenderer, desktopCapturer } = require('electron')

console.log('Preload script loaded')

// 简单的哈希函数（不依赖 crypto 模块）
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // 转换为16进制字符串并补齐
  const hex = Math.abs(hash).toString(16)
  return hex.padStart(8, '0').repeat(8) // 生成64位哈希
}

// 生成机器码（简化版，不依赖 child_process）
function generateMachineCode() {
  try {
    // 使用 navigator 信息生成设备指纹
    const info = [
      navigator.userAgent,
      navigator.language,
      navigator.platform,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|')
    
    return simpleHash(info)
  } catch (e) {
    console.error('Failed to generate machine code:', e)
    return simpleHash(Date.now().toString())
  }
}

// 暴露 electron API
contextBridge.exposeInMainWorld('electron', {
  shell: {
    openExternal: (url) => {
      console.log('shell.openExternal called with:', url)
      return shell.openExternal(url)
    }
  },
  ipcRenderer: {
    send: (channel, ...args) => {
      console.log('ipcRenderer.send called with:', channel, args)
      return ipcRenderer.send(channel, ...args)
    },
    on: (channel, func) => {
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    },
    once: (channel, func) => {
      ipcRenderer.once(channel, (event, ...args) => func(...args))
    }
  },
  // 获取系统音频源（用于录制系统声音）
  getDesktopSources: async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 0, height: 0 }
      })
      return sources.map(source => ({
        id: source.id,
        name: source.name,
        displayId: source.display_id
      }))
    } catch (error) {
      console.error('Failed to get desktop sources:', error)
      return []
    }
  },
  // 文件系统操作
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItemInFolder', path),
  stat: (path) => ipcRenderer.invoke('fs:stat', path),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  // 更新相关
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  startUpdate: (updateInfo) => ipcRenderer.invoke('update:start', updateInfo),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion')
})

// 暴露 electronAPI 用于授权码功能
contextBridge.exposeInMainWorld('electronAPI', {
  getMachineCode: () => {
    return generateMachineCode()
  }
})

console.log('Preload script: electron API exposed')
