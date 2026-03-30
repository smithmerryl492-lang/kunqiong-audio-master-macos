import { Trash2, Plus, FolderPlus, Settings, Play, Pause, ChevronDown, CheckCircle2, Clock } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { changeSpeed, openFolder, getDefaultOutputPath, selectDirectory } from '../services/api'
import { useAppContext } from '../context/AppContext'
import FileDropZone from './FileDropZone'
import BottomActionBar from './BottomActionBar'
import EnhancedSlider from './EnhancedSlider'
import ProcessingStatus from './ProcessingStatus'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration?: number
  speed: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function AudioSpeedArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [globalSpeed, setGlobalSpeed] = useState(1.0)
  const [keepPitch, setKeepPitch] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const { checkAndShowAuthCode } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getDefaultOutputPath().then(setOutputPath)
  }, [])

  const addFiles = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file, name: file.name, size: file.size, status: 'pending', speed: globalSpeed
    }))
    setFiles(prev => [...prev, ...audioFiles])
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      audioFiles.forEach(f => newSet.add(f.id))
      return newSet
    })
    // 获取时长
    audioFiles.forEach(af => {
      const audio = new Audio()
      audio.preload = 'metadata'
      const objURL = URL.createObjectURL(af.file)
      audio.onloadedmetadata = () => {
        setFiles(prev => prev.map(f => f.id === af.id ? { ...f, duration: audio.duration } : f))
        audio.src = ''
        URL.revokeObjectURL(objURL)
      }
      audio.onerror = () => {
        audio.src = ''
        URL.revokeObjectURL(objURL)
      }
      audio.src = objURL
    })
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(files.map(f => f.id)) : new Set())
  }
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    checked ? newSet.add(id) : newSet.delete(id)
    setSelectedIds(newSet)
  }
  const handleClearList = () => { setFiles([]); setSelectedIds(new Set()) }

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      addFiles(newFiles)
    }
    e.target.value = ''
  }
  const handleRemoveFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    selectedIds.delete(id)
    setSelectedIds(new Set(selectedIds))
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const updateFileSpeed = (id: string, speed: number) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, speed } : f))
  }

  const formatSpeed = (speed: number) => {
    // 去掉末尾的0，保留最多1位小数
    return parseFloat(speed.toFixed(1)).toString()
  }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await changeSpeed({
        file: audioFile.file,
        speed: audioFile.speed,
        keepPitch,
        outputPath: outputType === 'custom' ? outputPath : ''
      })
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'completed', outputPath: result.output_path } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? {
        ...f, status: 'error', error: error instanceof Error ? error.message : '处理失败'
      } : f))
    }
  }

  const handleOpenSingleFolder = async (filePath: string) => {
    await openOutputFolder(filePath)
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const pendingFiles = files.filter(f => selectedIds.has(f.id) && (f.status === 'pending' || f.status === 'error'))
    if (pendingFiles.length === 0) return
    setIsProcessing(true)
    for (const file of pendingFiles) {
      await handleProcessSingle(file)
    }
    setIsProcessing(false)
  }

  // 文件列表内容
  const renderFileList = () => (
    <div className="flex-1 overflow-auto">
      {files.map(file => (
        <div key={file.id} className="flex items-center bg-[#0d0d1a] hover:bg-[#12121e] px-4 py-2.5 text-xs text-gray-300 border-b border-[#1e2235]">
          <div className="w-8"><input type="checkbox" className="w-3.5 h-3.5 accent-blue-500" checked={selectedIds.has(file.id)} onChange={(e) => handleSelectOne(file.id, e.target.checked)} /></div>
          <div className="flex-1 min-w-0 truncate flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[#1a2a40] flex items-center justify-center flex-shrink-0">
              <svg className="w-2.5 h-2.5 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="truncate">{file.name}</span>
          </div>
          <div className="w-20 text-gray-400 text-xs">{formatSize(file.size)}</div>
          <div className="w-16 text-gray-400 text-xs">{formatDuration(file.duration)}</div>
          <div className="w-36 flex items-center gap-1">
            <EnhancedSlider
              min={0.5}
              max={2}
              step={0.1}
              value={file.speed}
              onChange={(value) => updateFileSpeed(file.id, value)}
              disabled={file.status === 'processing' || file.status === 'completed'}
              className="w-16"
              showValue={false}
              unit="x"
              color="blue"
              size="sm"
            />
            <input 
              type="number" 
              min="0.5" 
              max="2" 
              step="0.1" 
              value={formatSpeed(file.speed)}
              onChange={(e) => updateFileSpeed(file.id, parseFloat(e.target.value) || 1)}
              disabled={file.status === 'processing' || file.status === 'completed'}
              className="w-10 bg-[#1a1a2e] border border-[#2a2a40] rounded px-1 py-0.5 text-[10px] text-white text-center outline-none 
                focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-150" 
            />
            <span className="text-gray-400 text-[10px]">{t('speed.unit')}</span>
          </div>
          <div className="w-16">
            <ProcessingStatus status={file.status} error={file.error} />
          </div>
          <div className="w-24 flex items-center justify-center gap-1">
            {file.status === 'completed' && file.outputPath ? (
              <button onClick={() => handleOpenSingleFolder(file.outputPath!)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs">{t('common.open_output_dir')}</button>
            ) : (
              <button onClick={() => handleProcessSingle(file)} disabled={file.status === 'processing'}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-xs">{t('speed.title')}</button>
            )}
            <button onClick={() => handleRemoveFile(file.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400">
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
        {/* 表头上方的设置区域 */}
        <div className="flex items-center justify-between gap-3 mb-3">
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">{t('speed.batch_speed')}</span>
              <input type="number" min="0.5" max="2" step="0.1" value={globalSpeed}
                onChange={(e) => setGlobalSpeed(parseFloat(e.target.value) || 1)}
                className="w-14 bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 text-xs text-white text-center outline-none" />
              <span className="text-gray-400 text-xs">x</span>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" checked={keepPitch} onChange={(e) => setKeepPitch(e.target.checked)} className="w-3 h-3 accent-blue-500" />
              <span>{t('speed.keep_pitch')}</span>
            </label>
            <button
              onClick={handleClearList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('speed.clear_list')}</span>
            </button>
          </div>
        </div>

        {/* 表头 */}
        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
          <div className="w-8"><input type="checkbox" className="w-3.5 h-3.5 accent-blue-500" checked={files.length > 0 && selectedIds.size === files.length} onChange={(e) => handleSelectAll(e.target.checked)} /></div>
          <div className="flex-1 min-w-0">{t('common.file_name')}</div>
          <div className="w-20">{t('common.size')}</div>
          <div className="w-16">{t('common.duration')}</div>
          <div className="w-36">{t('speed.speed_factor')}</div>
          <div className="w-16">{t('common.file_status')}</div>
          <div className="w-24 text-center">{t('common.action')}</div>
        </div>

        {/* 文件拖放区域 */}
        <FileDropZone
          onFilesAdded={addFiles}
          hasFiles={files.length > 0}
          showButtons={false}
          subDescription={t('speed.speed_tip')}
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
        processButtonText={t('speed.start_speed')}
        isProcessing={isProcessing}
        disabled={selectedIds.size === 0}
      />
    </div>
  )
}
