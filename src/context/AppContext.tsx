import { createContext, useContext } from 'react'

// 共享文件队列的类型
export interface SharedFile {
  id: string
  name: string
  path: string
  size: number
  duration?: number
}

// 模块处理函数类型
export type ModuleProcessHandler = () => Promise<void> | void

// 创建 Context
export interface AppContextType {
  sharedFiles: Map<string, SharedFile[]>
  addFilesToModule: (module: string, files: SharedFile[]) => void
  setActiveTab: (tab: string) => void
  ttsText: string
  setTtsText: (text: string) => void
  goToTTS: (text: string) => void
  // 模块处理函数注册
  registerProcessHandler: (module: string, handler: ModuleProcessHandler) => void
  unregisterProcessHandler: (module: string) => void
  triggerProcess: (module: string) => void
  // 授权码相关
  checkAndShowAuthCode: (softNumber?: string) => Promise<boolean>
  handleAuthError: (error: unknown) => void
  // 全局输出路径
  globalOutputPath: string
}

export const AppContext = createContext<AppContextType | null>(null)

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}
