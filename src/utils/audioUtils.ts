// 音频工具函数集合
import { openFolder } from '../services/api'
import { t } from './i18n'

// 缓存音频时长，避免重复计算
const durationCache = new Map<string, number>()

export const getAudioDuration = async (file: File): Promise<number> => {
  // 使用文件名+大小+修改时间作为缓存键
  const cacheKey = `${file.name}-${file.size}-${file.lastModified}`
  
  if (durationCache.has(cacheKey)) {
    return durationCache.get(cacheKey)!
  }

  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    
    const cleanup = () => {
      audio.src = ''
      URL.revokeObjectURL(objURL)
    }
    
    const objURL = URL.createObjectURL(file)
    
    audio.onloadedmetadata = () => {
      const duration = audio.duration || 0
      durationCache.set(cacheKey, duration)
      cleanup()
      resolve(duration)
    }
    
    audio.onerror = () => {
      cleanup()
      resolve(0)
    }
    
    // 设置超时，避免卡住
    setTimeout(() => {
      cleanup()
      resolve(0)
    }, 5000)
    
    audio.src = objURL
  })
}

export const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '00:00:00.000'
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
}

export const generateFileId = (): string => {
  return Math.random().toString(36).substring(2, 9)
}

// 清理缓存，防止内存泄漏
export const clearDurationCache = (): void => {
  durationCache.clear()
}

// 限制缓存大小
export const limitCacheSize = (maxSize: number = 100): void => {
  if (durationCache.size > maxSize) {
    const entries = Array.from(durationCache.entries())
    const toDelete = entries.slice(0, entries.length - maxSize)
    toDelete.forEach(([key]) => durationCache.delete(key))
  }
}

// 统一的打开输出文件夹函数
export const openOutputFolder = async (outputPath: string) => {
  try {
    console.log('尝试打开文件夹:', outputPath)
    
    // 如果路径为空，提示用户
    if (!outputPath || outputPath.trim() === '') {
      alert(t('footer.output_path_empty'))
      return { success: false, message: '路径为空' }
    }

    // 优先使用 Electron 原生能力
    if ((window as any).electron) {
      // 在 Windows 上将 / 替换为 \
      const isWindows = navigator.platform.indexOf('Win') > -1;
      const normalizedPath = isWindows ? outputPath.replace(/\//g, '\\') : outputPath;
      
      // 使用 fs.stat 精确判断路径类型
      let isFile = false;
      let isDirectory = false;
      
      if ((window as any).electron.stat) {
        const stats = await (window as any).electron.stat(normalizedPath);
        if (stats.success) {
          isFile = stats.isFile;
          isDirectory = stats.isDirectory;
        } else {
          // 如果 stat 失败（可能文件不存在），降级到简单的扩展名判断
          const basename = normalizedPath.split(/[\\/]/).pop() || '';
          isFile = basename.includes('.');
        }
      } else {
        // 兼容旧版 preload
        const basename = normalizedPath.split(/[\\/]/).pop() || '';
        isFile = basename.includes('.');
      }

      if (isFile && (window as any).electron.showItemInFolder) {
        // 如果是文件，使用 showItemInFolder（打开文件夹并选中文件）
        console.log('定位文件:', normalizedPath);
        const result = await (window as any).electron.showItemInFolder(normalizedPath);
        if (result && result.success) return { success: true, message: t('api.message.file_located') };
      } else if ((window as any).electron.openPath) {
        // 如果是文件夹（或无法判断类型），尝试直接打开
        console.log('打开文件夹:', normalizedPath);
        const result = await (window as any).electron.openPath(normalizedPath);
        if (result && result.success) return { success: true, message: t('api.message.folder_opened') };
      }
    }
    
    // 降级处理：调用后端 API
    const result = await openFolder(outputPath)
    console.log('打开文件夹结果:', result)
    
    if (!result.success) {
      console.error('打开输出文件夹失败:', result.message)
      // 显示用户友好的错误提示
      alert(`${t('footer.open_folder_failed')} ${result.message || t('api.error.unknown_error')}`)
    }
    return result
  } catch (error) {
    console.error('打开输出文件夹异常:', error)
    const errorMsg = error instanceof Error ? error.message : t('api.error.unknown_error')
    alert(`${t('footer.open_folder_failed')} ${errorMsg}\n${t('api.error.backend_not_running')}`)
    return { success: false, message: errorMsg }
  }
}

// 统一的打开按钮文本
export const OPEN_FOLDER_TEXT = t('footer.open_output_folder')