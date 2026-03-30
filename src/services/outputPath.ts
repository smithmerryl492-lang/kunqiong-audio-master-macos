/**
 * 输出目录管理服务
 * 提供输出目录的持久化存储、验证和管理功能
 */

const STORAGE_KEY = 'audio_output_path_settings'
const DEFAULT_FOLDER_NAME = '音频处理大师'

export interface OutputPathSettings {
  customPath: string
  outputMode: 'original' | 'custom'
  lastUsedPath: string
  useDesktopDefault: boolean
}

const defaultSettings: OutputPathSettings = {
  customPath: '',
  outputMode: 'custom',
  lastUsedPath: '',
  useDesktopDefault: true
}

/**
 * 输出目录存储管理
 */
export const outputPathStorage = {
  /**
   * 获取保存的设置
   */
  getSettings(): OutputPathSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...defaultSettings, ...parsed }
      }
    } catch (e) {
      console.error('读取输出目录设置失败:', e)
    }
    return { ...defaultSettings }
  },

  /**
   * 保存设置
   */
  saveSettings(settings: Partial<OutputPathSettings>): void {
    try {
      const current = this.getSettings()
      const updated = { ...current, ...settings }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch (e) {
      console.error('保存输出目录设置失败:', e)
    }
  },

  /**
   * 设置自定义路径
   */
  setCustomPath(path: string): void {
    this.saveSettings({ 
      customPath: path, 
      lastUsedPath: path,
      outputMode: 'custom'
    })
  },

  /**
   * 获取自定义路径
   */
  getCustomPath(): string {
    return this.getSettings().customPath
  },

  /**
   * 设置输出模式
   */
  setOutputMode(mode: 'original' | 'custom'): void {
    this.saveSettings({ outputMode: mode })
  },

  /**
   * 获取输出模式
   */
  getOutputMode(): 'original' | 'custom' {
    return this.getSettings().outputMode
  },

  /**
   * 获取最后使用的路径
   */
  getLastUsedPath(): string {
    return this.getSettings().lastUsedPath
  },

  /**
   * 重置为默认设置
   */
  resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEY)
  },

  /**
   * 清除所有设置
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  }
}

/**
 * 从文件路径中提取目录
 */
export function getDirectoryFromFilePath(filePath: string): string {
  if (!filePath) return ''
  
  // 处理 Windows 和 Unix 路径
  const lastSeparator = Math.max(
    filePath.lastIndexOf('/'),
    filePath.lastIndexOf('\\')
  )
  
  if (lastSeparator === -1) return ''
  return filePath.substring(0, lastSeparator)
}

/**
 * 从 File 对象获取原始目录路径
 * 注意：由于浏览器安全限制，File 对象不包含完整路径
 * 需要通过 Electron 的 IPC 或后端 API 获取
 */
export function getOriginalDirectory(file: File): string {
  // 尝试从 webkitRelativePath 获取（仅在选择文件夹时有效）
  if (file.webkitRelativePath) {
    const parts = file.webkitRelativePath.split('/')
    if (parts.length > 1) {
      parts.pop() // 移除文件名
      return parts.join('/')
    }
  }
  return ''
}

/**
 * 验证路径是否包含特殊字符
 */
export function hasSpecialCharacters(path: string): boolean {
  // Windows 不允许的字符: < > : " | ? *
  // 但冒号在驱动器号后是允许的
  const invalidChars = /[<>"|?*]/
  return invalidChars.test(path)
}

/**
 * 检查路径长度是否超过系统限制
 */
export function isPathTooLong(path: string): boolean {
  // Windows MAX_PATH 限制为 260 字符
  // 但现代 Windows 支持长路径（需要启用）
  const MAX_PATH_LENGTH = 260
  return path.length > MAX_PATH_LENGTH
}

/**
 * 规范化路径（处理不同操作系统的路径分隔符）
 */
export function normalizePath(path: string): string {
  if (!path) return ''
  
  // 检测操作系统
  const isWindows = navigator.platform.toLowerCase().includes('win')
  
  if (isWindows) {
    // Windows: 将正斜杠转换为反斜杠
    return path.replace(/\//g, '\\')
  } else {
    // Unix/Mac: 将反斜杠转换为正斜杠
    return path.replace(/\\/g, '/')
  }
}

/**
 * 验证路径的有效性
 */
export interface PathValidationResult {
  valid: boolean
  error?: string
}

export function validatePath(path: string): PathValidationResult {
  if (!path) {
    return { valid: false, error: '路径不能为空' }
  }

  if (hasSpecialCharacters(path)) {
    return { valid: false, error: '路径包含非法字符 (< > " | ? *)' }
  }

  if (isPathTooLong(path)) {
    return { valid: false, error: '路径长度超过系统限制 (260字符)' }
  }

  return { valid: true }
}

/**
 * 复制路径到剪贴板
 */
export async function copyPathToClipboard(path: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(path)
    return true
  } catch (e) {
    console.error('复制路径失败:', e)
    // 降级方案：使用 execCommand
    try {
      const textArea = document.createElement('textarea')
      textArea.value = path
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch {
      return false
    }
  }
}

/**
 * 获取默认输出文件夹名称
 */
export function getDefaultFolderName(): string {
  return DEFAULT_FOLDER_NAME
}
