import { Play, AlertCircle, Trash2, Plus, FolderPlus, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { denoiseAudio, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import FileDropZone from './FileDropZone'
import BottomActionBar from './BottomActionBar'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration?: number
  status: 'waiting' | 'processing' | 'completed' | 'error'
  error?: string
  denoiseLevel: number
  aiDenoise: boolean
  outputPath?: string
}

const getDenoiseLevelText = (level: number): string => {
  if (level <= 20) return t('denoise.level_weak')
  if (level <= 40) return t('denoise.level_normal')
  if (level <= 60) return t('denoise.level_good')
  if (level <= 80) return t('denoise.level_strong')
  return t('denoise.level_strongest')
}

const denoiseLevels = [
  { value: 20, label: t('denoise.level_weak') },
  { value: 40, label: t('denoise.level_normal') },
  { value: 60, label: t('denoise.level_good') },
  { value: 80, label: t('denoise.level_strong') },
  { value: 100, label: t('denoise.level_strongest') }
]

export default function AudioDenoiseArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const { checkAndShowAuthCode } = useAppContext()

  useEffect(() => {
    getDefaultOutputPath().then(setOutputPath)
  }, [])

  const addFiles = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: file.name,
      size: file.size,
      status: 'waiting',
      denoiseLevel: 50,
      aiDenoise: false
    }))
    setFiles(prev => [...prev, ...audioFiles])

    // 获取音频时长
    audioFiles.forEach(af => {
      const audio = new Audio(URL.createObjectURL(af.file))
      audio.onloadedmetadata = () => {
        setFiles(prev => prev.map(f => f.id === af.id ? { ...f, duration: audio.duration } : f))
        URL.revokeObjectURL(audio.src)
      }
    })
  }

  const handleClearList = () => setFiles([])

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      addFiles(newFiles)
    }
    e.target.value = ''
  }



  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--:--'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const updateDenoiseLevel = (id: string, level: number) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, denoiseLevel: level } : f))
  }

  const updateAiDenoise = (id: string, enabled: boolean) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, aiDenoise: enabled } : f))
  }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await denoiseAudio({
        file: audioFile.file,
        strength: audioFile.denoiseLevel / 100,
        highpass: 0,
        lowpass: 0,
        outputPath: outputType === 'custom' ? outputPath : ''
      })
      setFiles(prev => prev.map(f => f.id === audioFile.id ? {
        ...f,
        status: 'completed',
        outputPath: result.output_path
      } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? {
        ...f,
        status: 'error',
        error: error instanceof Error ? error.message : t('denoise.failed')
      } : f))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const waitingFiles = files.filter(f => f.status === 'waiting' || f.status === 'error')
    if (waitingFiles.length === 0) return
    setIsProcessing(true)
    for (const audioFile of waitingFiles) {
      await handleProcessSingle(audioFile)
    }
    setIsProcessing(false)
  }

  const renderFileList = () => (
    <div className="flex-1 overflow-y-auto bg-[#0d0d1a]">
      {files.map(file => (
        <div key={file.id} className="flex items-center border-b border-[#1e2235] px-4 py-3 text-xs text-gray-300 hover:bg-white/5 group">
          <div className="flex-[2] min-w-[150px] flex items-center gap-2 truncate pr-2">
            <Play className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="flex-1 min-w-[80px] text-center text-gray-400 truncate px-2">{formatSize(file.size)}</div>
          <div className="flex-1 min-w-[100px] text-center text-gray-400 truncate px-2">{formatDuration(file.duration)}</div>
          <div className="flex-[1.5] min-w-[150px] flex items-center justify-center gap-2 px-2">
            {/* Denoise Level Selector */}
            <div className="relative inline-block w-full max-w-[100px]">
              <select 
                value={file.denoiseLevel} 
                onChange={(e) => updateDenoiseLevel(file.id, parseInt(e.target.value))}
                className="w-full appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-[10px] text-white outline-none focus:border-blue-500"
              >
                {denoiseLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[100px] text-center px-2">
            <button
              onClick={() => updateAiDenoise(file.id, !file.aiDenoise)}
              className={`mx-auto w-10 h-5 rounded-full transition-colors relative ${file.aiDenoise ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${file.aiDenoise ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex-1 min-w-[100px] flex items-center justify-center gap-2 px-2">
            {file.status === 'completed' ? (
              <button 
                onClick={() => openOutputFolder(file.outputPath || '')}
                className="text-blue-400 hover:text-blue-300 text-[10px] truncate"
              >
                {OPEN_FOLDER_TEXT}
              </button>
            ) : (
              <button 
                onClick={() => handleProcessSingle(file)}
                disabled={file.status === 'processing'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-[10px] transition-colors truncate"
              >
                {file.status === 'processing' ? t('denoise.denoising') : (t('common.process') || '处理')}
              </button>
            )}
            <button 
              onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
              className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a14]">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.flac,.ogg,.wma,.aac,.webm"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.m4a,.flac,.ogg,.wma,.aac,.webm"
        className="hidden"
        onChange={handleFileChange}
        {...({ webkitdirectory: '', directory: '' } as any)}
      />

      <div className="flex-1 flex flex-col p-3">
        {/* 按钮栏 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleFileSelect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('common.add_file')}</span>
            </button>
            <button
              onClick={handleFolderSelect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t('common.add_folder')}</span>
            </button>
          </div>
          <button
            onClick={handleClearList}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('common.clear_list')}</span>
          </button>
        </div>

        {/* 表头 */}
        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400 font-medium">
          <div className="flex-[2] min-w-[150px] truncate pr-2">{t('common.file_name')}</div>
          <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.size')}</div>
          <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.duration')}</div>
          <div className="flex-[1.5] min-w-[150px] text-center truncate px-2">{t('denoise.denoise_level')}</div>
          <div className="flex-1 min-w-[100px] text-center flex items-center justify-center gap-1 truncate px-2">
            {t('denoise.ai_denoise')}
            <AlertCircle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          </div>
          <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.action')}</div>
        </div>

        {/* 文件上传区域 */}
        <FileDropZone
          onFilesAdded={addFiles}
          hasFiles={files.length > 0}
          showButtons={false}
          subDescription={t('denoise.denoise_tip')}
        >
          {renderFileList()}
        </FileDropZone>
      </div>

      <BottomActionBar
        outputPath={outputPath}
        setOutputPath={setOutputPath}
        outputType={outputType}
        setOutputType={setOutputType}
        onProcessAll={handleProcessAll}
        processButtonText={t('denoise.start_denoise')}
        isProcessing={isProcessing}
        disabled={files.length === 0}
      />
    </div>
  )
}
