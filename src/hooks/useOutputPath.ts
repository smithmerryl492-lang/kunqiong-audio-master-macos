/**
 * 输出路径管理 Hook
 * 提供统一的输出路径状态管理和持久化
 */

import { useState, useEffect, useCallback } from 'react'
import { getDefaultOutputPath, validatePath } from '../services/api'
import { outputPathStorage, getDirectoryFromFilePath } from '../services/outputPath'

export interface UseOutputPathOptions {
  /** 是否支持原目录模式 */
  supportOriginalDir?: boolean
  /** 初始输出模式 */
  initialMode?: 'original' | 'custom'
}

export interface UseOutputPathReturn {
  /** 当前输出路径 */
  outputPath: string
  /** 设置输出路径 */
  setOutputPath: (path: string) => void
  /** 输出模式：原目录或自定义 */
  outputMode: 'original' | 'custom'
  /** 设置输出模式 */
  setOutputMode: (mode: 'original' | 'custom') => void
  /** 路径是否有效 */
  isPathValid: boolean
  /** 路径错误信息 */
  pathError: string | null
  /** 是否正在加载 */
  isLoading: boolean
  /** 重置为默认路径 */
  resetToDefault: () => Promise<void>
  /** 根据文件获取实际输出路径 */
  getActualOutputPath: (file?: File) => string
  /** 验证当前路径 */
  validateCurrentPath: () => Promise<boolean>
}

/**
 * 输出路径管理 Hook
 */
export function useOutputPath(options: UseOutputPathOptions = {}): UseOutputPathReturn {
  const { supportOriginalDir = true, initialMode } = options

  const [outputPath, setOutputPathState] = useState('')
  const [outputMode, setOutputModeState] = useState<'original' | 'custom'>(
    initialMode || (supportOriginalDir ? 'original' : 'custom')
  )
  const [isPathValid, setIsPathValid] = useState(true)
  const [pathError, setPathError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 初始化：从存储加载设置或获取默认路径
  useEffect(() => {
    const initializePath = async () => {
      setIsLoading(true)
      try {
        // 尝试从存储加载
        const settings = outputPathStorage.getSettings()
        
        if (settings.customPath) {
          setOutputPathState(settings.customPath)
          if (!initialMode) {
            setOutputModeState(settings.outputMode)
          }
        } else {
          // 获取默认路径
          const defaultPath = await getDefaultOutputPath()
          setOutputPathState(defaultPath)
          outputPathStorage.setCustomPath(defaultPath)
        }
      } catch (error) {
        console.error('初始化输出路径失败:', error)
        // 使用降级默认路径
        setOutputPathState('C:/Users/Desktop/音频处理大师')
      } finally {
        setIsLoading(false)
      }
    }

    initializePath()
  }, [initialMode])

  // 设置输出路径并保存
  const setOutputPath = useCallback((path: string) => {
    setOutputPathState(path)
    if (path) {
      outputPathStorage.setCustomPath(path)
    }
    // 清除之前的错误
    setPathError(null)
    setIsPathValid(true)
  }, [])

  // 设置输出模式并保存
  const setOutputMode = useCallback((mode: 'original' | 'custom') => {
    setOutputModeState(mode)
    outputPathStorage.setOutputMode(mode)
    if (mode === 'original') {
      setPathError(null)
      setIsPathValid(true)
    }
  }, [])

  // 验证当前路径
  const validateCurrentPath = useCallback(async (): Promise<boolean> => {
    if (outputMode === 'original' || !outputPath) {
      setIsPathValid(true)
      setPathError(null)
      return true
    }

    try {
      const result = await validatePath(outputPath)
      if (!result.valid) {
        setIsPathValid(false)
        setPathError(result.error || '路径无效')
        return false
      }
      if (!result.writable) {
        setIsPathValid(false)
        setPathError(result.error || '目录不可写')
        return false
      }
      setIsPathValid(true)
      setPathError(null)
      return true
    } catch {
      // 后端未启动时假设路径有效
      setIsPathValid(true)
      setPathError(null)
      return true
    }
  }, [outputPath, outputMode])

  // 路径改变时延迟验证
  useEffect(() => {
    if (outputMode === 'original') return

    const timer = setTimeout(() => {
      validateCurrentPath()
    }, 500)

    return () => clearTimeout(timer)
  }, [outputPath, outputMode, validateCurrentPath])

  // 重置为默认路径
  const resetToDefault = useCallback(async () => {
    try {
      const defaultPath = await getDefaultOutputPath()
      setOutputPathState(defaultPath)
      setOutputModeState('custom')
      setPathError(null)
      setIsPathValid(true)
      outputPathStorage.resetToDefault()
      outputPathStorage.setCustomPath(defaultPath)
    } catch (error) {
      console.error('重置默认路径失败:', error)
      setPathError('获取默认路径失败')
    }
  }, [])

  // 根据文件和当前设置获取实际输出路径
  const getActualOutputPath = useCallback((file?: File): string => {
    if (outputMode === 'original' && file) {
      // 尝试获取文件的原始目录
      const originalDir = getDirectoryFromFilePath(file.name)
      if (originalDir) {
        return originalDir
      }
      // 如果无法获取原始目录，返回空字符串让后端处理
      return ''
    }
    return outputPath
  }, [outputMode, outputPath])

  return {
    outputPath,
    setOutputPath,
    outputMode,
    setOutputMode,
    isPathValid,
    pathError,
    isLoading,
    resetToDefault,
    getActualOutputPath,
    validateCurrentPath
  }
}

export default useOutputPath
