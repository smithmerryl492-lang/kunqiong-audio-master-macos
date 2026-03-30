/// <reference types="vite/client" />

// 图片文件类型声明
declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.jpeg' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.ico' {
  const src: string
  export default src
}

// Electron API 类型声明
interface Window {
  electron?: {
    shell: {
      openExternal: (url: string) => Promise<void>
    }
    ipcRenderer: {
      send: (channel: string, ...args: unknown[]) => void
    }
    getDesktopSources: () => Promise<Array<{
      id: string
      name: string
      displayId: string
    }>>
  }
  electronAPI?: {
    getMachineCode: () => string
  }
}
