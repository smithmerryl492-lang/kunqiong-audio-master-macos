import { Folder, FolderOpen, Copy, RotateCcw, AlertCircle, Check } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { selectDirectory, openFolder, getDefaultOutputPath, validatePath } from '../services/api'
import { outputPathStorage, copyPathToClipboard } from '../services/outputPath'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface BottomActionBarProps {
  outputPath: string
  setOutputPath: (path: string) => void
  outputType: 'original' | 'custom'
  setOutputType: (type: 'original' | 'custom') => void
  onProcessAll: () => void
  processButtonText?: string
  isProcessing?: boolean
  disabled?: boolean
  /** 是否显示原目录选项，某些功能可能不支持 */
  showOriginalOption?: boolean
}

export default function BottomActionBar({
  outputPath,
  setOutputPath,
  outputType,
  setOutputType,
  onProcessAll,
  processButtonText,
  isProcessing = false,
  disabled = false,
  showOriginalOption = true
}: BottomActionBarProps) {
  const [pathError, setPathError] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  const finalButtonText = processButtonText || t('footer.process_all')

  // 初始化时从存储加载设置
  useEffect(() => {
    const settings = outputPathStorage.getSettings()
    if (settings.customPath && !outputPath) {
      setOutputPath(settings.customPath)
    }
    if (settings.outputMode) {
      setOutputType(settings.outputMode)
    }
  }, [])

  // 当路径改变时保存到存储
  useEffect(() => {
    if (outputPath && outputType === 'custom') {
      outputPathStorage.setCustomPath(outputPath)
    }
  }, [outputPath, outputType])

  // 当输出模式改变时保存
  useEffect(() => {
    outputPathStorage.setOutputMode(outputType)
  }, [outputType])

  // 验证路径
  const validateCurrentPath = useCallback(async (path: string) => {
    if (!path || outputType === 'original') {
      setPathError(null)
      return
    }

    setIsValidating(true)
    try {
      const result = await validatePath(path)
      if (!result.valid) {
        setPathError(result.error || t('footer.select_dir_failed'))
      } else if (!result.writable) {
        setPathError(result.error || t('footer.process_failed'))
      } else {
        setPathError(null)
      }
    } catch {
      setPathError(null) // 后端未启动时不显示错误
    } finally {
      setIsValidating(false)
    }
  }, [outputType])

  // 路径改变时延迟验证
  useEffect(() => {
    const timer = setTimeout(() => {
      validateCurrentPath(outputPath)
    }, 500)
    return () => clearTimeout(timer)
  }, [outputPath, validateCurrentPath])

  const handleSelectDirectory = async () => {
    const result = await selectDirectory(outputPath)
    if (result.success && result.path) {
      setOutputPath(result.path)
      setOutputType('custom')
      setPathError(null)
      
      // 检查是否可写
      if (result.writable === false) {
        setPathError(result.message || t('footer.process_failed'))
      }
    } else if (result.message) {
      // 用户取消选择不显示错误
      if (!result.message.includes('未选择')) {
        setPathError(result.message)
      }
    }
  }

  const handleOpenFolder = async () => {
    console.log('点击打开文件夹按钮')
    console.log('当前输出路径:', outputPath)
    console.log('输出模式:', outputType)
    
    // 检查路径是否有效
    if (!outputPath || outputPath.trim() === '') {
      const errorMsg = t('footer.output_path_empty')
      console.error(errorMsg)
      setPathError(errorMsg)
      setTimeout(() => setPathError(null), 3000)
      return
    }
    
    try {
      const result = await openOutputFolder(outputPath)
      console.log('打开文件夹结果:', result)
      
      if (!result.success) {
        setPathError(result.message)
        // 3秒后清除错误
        setTimeout(() => setPathError(null), 3000)
      }
    } catch (error) {
      console.error('打开文件夹异常:', error)
      const errorMsg = error instanceof Error ? error.message : t('footer.open_folder_failed')
      setPathError(errorMsg)
      setTimeout(() => setPathError(null), 3000)
    }
  }

  const handleCopyPath = async () => {
    const success = await copyPathToClipboard(outputPath)
    if (success) {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleResetToDefault = async () => {
    try {
      const defaultPath = await getDefaultOutputPath()
      setOutputPath(defaultPath)
      setOutputType('custom')
      setPathError(null)
      outputPathStorage.resetToDefault()
    } catch {
      setPathError(t('footer.get_default_path_failed'))
    }
  }

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value
    setOutputPath(newPath)
    // 清除之前的错误，等待验证
    setPathError(null)
  }

  const handleOutputTypeChange = (type: 'original' | 'custom') => {
    setOutputType(type)
    if (type === 'original') {
      setPathError(null)
    }
  }

  return (
    <div className="h-14 bg-[#12121e] border-t border-[#1e2235] flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <span className="text-gray-400 text-xs">{t('footer.output_dir')}</span>
        <div className="flex items-center gap-2">
          {showOriginalOption && (
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input
                type="radio"
                checked={outputType === 'original'}
                onChange={() => handleOutputTypeChange('original')}
                className="w-3 h-3 accent-blue-500"
              />
              <span>{t('footer.original')}</span>
            </label>
          )}
          <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
            <input
              type="radio"
              checked={outputType === 'custom'}
              onChange={() => handleOutputTypeChange('custom')}
              className="w-3 h-3 accent-blue-500"
            />
            <span>{t('footer.custom')}</span>
          </label>
        </div>
        
        {/* 路径输入框 */}
        <div className="relative">
          <input
            type="text"
            value={outputPath}
            onChange={handlePathChange}
            disabled={outputType === 'original'}
            title={outputPath}
            className={`w-72 bg-[#0a0a14] border rounded px-2 py-1.5 text-xs outline-none pr-16 ${
              outputType === 'original' 
                ? 'text-gray-500 opacity-60 border-[#2a2a40]' 
                : pathError 
                  ? 'text-gray-400 border-red-500/50' 
                  : 'text-gray-400 border-[#2a2a40] focus:border-blue-500/50'
            }`}
          />
          
          {/* 路径操作按钮 */}
          {outputType === 'custom' && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {/* 复制按钮 */}
              <button
                onClick={handleCopyPath}
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                title={t('footer.copy_path')}
              >
                {copySuccess ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              
              {/* 重置按钮 */}
              <button
                onClick={handleResetToDefault}
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                title={t('footer.reset_to_default')}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        
        {/* 错误提示 */}
        {pathError && outputType === 'custom' && (
          <div className="flex items-center gap-1 text-red-400 text-xs">
            <AlertCircle className="w-3 h-3" />
            <span className="max-w-[150px] truncate" title={pathError}>{pathError}</span>
          </div>
        )}
        
        {/* 验证中指示器 */}
        {isValidating && outputType === 'custom' && (
          <span className="text-gray-500 text-xs">{t('footer.validating')}</span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleSelectDirectory}
          disabled={outputType === 'original'}
          className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs border ${
            outputType === 'original'
              ? 'bg-[#1a1a2a] text-gray-500 border-[#2a2a40] cursor-not-allowed'
              : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 border-[#2a2a40]'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>{t('footer.change_dir')}</span>
        </button>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{OPEN_FOLDER_TEXT}</span>
        </button>
        <button
          onClick={onProcessAll}
          disabled={disabled || isProcessing || (outputType === 'custom' && !!pathError)}
          className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
        >
          {isProcessing ? t('footer.processing') : finalButtonText}
        </button>
      </div>
    </div>
  )
}
