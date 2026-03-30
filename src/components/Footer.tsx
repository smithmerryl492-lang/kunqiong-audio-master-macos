import { Folder, FolderOpen } from 'lucide-react'
import { selectDirectory, openFolder } from '../services/api'
import { useState } from 'react'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface FooterProps {
  outputPath: string
  setOutputPath: (path: string) => void
  activeTab?: string
  onProcess?: () => void
}

export default function Footer({ outputPath, setOutputPath, activeTab, onProcess }: FooterProps) {
  const { checkAndShowAuthCode } = useAppContext()
  const [outputType, setOutputType] = useState<'original' | 'custom'>('custom')
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exportMode, setExportMode] = useState<'selected' | 'full'>('selected')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSelectDirectory = async () => {
    try {
      const result = await selectDirectory(outputPath)
      if (result.success && result.path) {
        setOutputPath(result.path)
        setOutputType('custom')
      }
    } catch (error) {
      console.error(t('footer.select_dir_failed'), error)
    }
  }

  const handleOpenFolder = async () => {
    try {
      await openOutputFolder(outputPath)
    } catch (error) {
      console.error(t('footer.open_folder_failed'), error)
    }
  }

  const handleExport = async (mode: 'selected' | 'full') => {
    setExportMode(mode)
    setShowExportMenu(false)
    
    // 检查授权码
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    // 触发导出逻辑
    onProcess?.()
  }

  // 处理按钮点击 - 添加授权码检查
  const handleProcessClick = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    
    try {
      // 检查授权码
      const isAuthorized = await checkAndShowAuthCode()
      
      if (isAuthorized) {
        // 用户已授权或不需要授权，继续处理
        onProcess?.()
      }
    } catch (error) {
      console.error(t('footer.process_failed'), error)
    } finally {
      setIsProcessing(false)
    }
  }

  // 判断是否显示导出下拉按钮
  const showExportDropdown = activeTab === '均衡器'

  const getButtonText = () => {
    if (activeTab === '音频合并') return t('footer.start_merge')
    if (activeTab === '视频提取音频') return t('footer.export_all')
    if (activeTab === '音量调整') return t('footer.adjust_all')
    if (activeTab === '生成噪音') return t('footer.process_all')
    if (activeTab === '添加封面') return t('footer.process_all')
    if (activeTab === '音频变声') return t('footer.process_all')
    if (activeTab === '增加音效') return t('footer.process_all')
    return t('footer.process_all')
  }

  return (
    <footer className="h-16 bg-[#12121e] border-t border-[#1e2235] flex items-center justify-between px-4">
      {/* Output Directory */}
      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-xs">{t('footer.output_dir')}</span>
        
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 cursor-pointer" onClick={() => setOutputType('original')}>
            <input
              type="radio"
              checked={outputType === 'original'}
              readOnly
            />
            <span className="text-xs text-gray-300">{t('footer.original_dir')}</span>
          </label>
          
          <label className="flex items-center gap-1 cursor-pointer" onClick={() => setOutputType('custom')}>
            <input
              type="radio"
              checked={outputType === 'custom'}
              readOnly
            />
            <span className="text-xs text-gray-300">{t('footer.custom_dir')}</span>
          </label>
        </div>

        <div className="flex items-center gap-2 ml-2 bg-[#1a1a2e] rounded px-3 py-1.5 border border-[#2a3a50]">
          <span className="text-xs text-gray-400 truncate max-w-[300px]">{outputPath}</span>
          <button 
            onClick={handleSelectDirectory}
            className="text-blue-500 hover:text-blue-400 text-xs font-medium border-l border-[#2a3a50] pl-2"
          >
            {t('footer.change')}
          </button>
        </div>

        <button 
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
          title={t('footer.open_output_folder')}
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      </div>

      {/* Convert Button or Export Dropdown */}
      {showExportDropdown ? (
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
          >
            <span>{exportMode === 'selected' ? t('footer.export_selected') : t('footer.export_full')}</span>
            <svg className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 24 24">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
          
          {showExportMenu && (
            <div className="absolute bottom-full right-0 mb-2 bg-[#1a1f2e] border border-[#3a4050] rounded-lg overflow-hidden shadow-xl z-10 min-w-[140px]">
              <button
                onClick={() => handleExport('selected')}
                className="w-full px-4 py-3 text-sm text-white hover:bg-[#252a40] text-center border-b border-[#3a4050]"
              >
                {t('footer.export_selected')}
              </button>
              <button
                onClick={() => handleExport('full')}
                className="w-full px-4 py-3 text-sm text-white hover:bg-[#252a40] text-center"
              >
                {t('footer.export_full')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button 
          onClick={handleProcessClick}
          disabled={isProcessing}
          className={`px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isProcessing ? t('footer.processing') : getButtonText()}
        </button>
      )}
    </footer>
  )
}
