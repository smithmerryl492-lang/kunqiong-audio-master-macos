interface ElectronAPI {
  shell?: {
    openExternal: (url: string) => Promise<void>
  }
  ipcRenderer?: {
    send: (channel: string, ...args: any[]) => void
  }
}

interface ElectronAuthAPI {
  getMachineCode: () => string
}

declare global {
  interface Window {
    electron?: ElectronAPI
    electronAPI?: ElectronAuthAPI
  }
}

export {}