import { Plus, FolderPlus, Trash2, Music, FileAudio, Play, X, Check, Loader2, FolderOpen, ChevronDown, Settings } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { adjustVolume, getDefaultOutputPath, openFolder, selectDirectory } from '../services/api'
import { useAppContext } from '../context/AppContext'
import EnhancedSlider from './EnhancedSlider'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import ProcessingStatus from './ProcessingStatus'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: string
  volume: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function VolumeAdjustArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [batchVolume, setBatchVolume] = useState(1.0)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [outputPath, setOutputPath] = useState('')
  const [outputMode, setOutputMode] = useState<'original' | 'custom'>('custom')
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { checkAndShowAuthCode } = useAppContext()
  
  // 初始化默认输出路径
  useEffect(() => {
    getDefaultOutputPath().then(path => setOutputPath(path))
  }, [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(f.name)
    )
    addFiles(droppedFiles)
  }

  const addFiles = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      name: file.name,
      size: file.size,
      duration: '00:00:00.000',
      volume: batchVolume,
      status: 'pending'
    }))
    setFiles(prev => [...prev, ...audioFiles])
    
    // 自动勾选新添加的文件
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      audioFiles.forEach(f => newSet.add(f.id))
      return newSet
    })
    
    // 获取音频时长
    audioFiles.forEach(audioFile => {
      const audio = new Audio()
      audio.src = URL.createObjectURL(audioFile.file)
      audio.onloadedmetadata = () => {
        const duration = formatDuration(audio.duration)
        setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, duration } : f))
        URL.revokeObjectURL(audio.src)
      }
    })
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  const handleAddFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleAddFolderClick = () => {
    folderInputRef.current?.click()
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(files.map(f => f.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    setSelectedIds(newSet)
  }

  const handleVolumeSliderChange = (id: string, value: number) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, volume: value } : f))
  }

  const handleVolumeInputChange = (id: string, value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0.1 && num <= 10) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, volume: num } : f))
    }
  }

  const formatVolume = (volume: number) => {
    // 去掉末尾的0，保留最多1位小数
    return parseFloat(volume.toFixed(1)).toString()
  }

  const handleBatchVolumeChange = (volume: number) => {
    setBatchVolume(volume)
    if (selectedIds.size > 0) {
      setFiles(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, volume } : f))
    }
  }

  const handleRemoveFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    selectedIds.delete(id)
    setSelectedIds(new Set(selectedIds))
  }

  const handleClearAll = () => {
    setFiles([])
    setSelectedIds(new Set())
  }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    setFiles(prev => prev.map(f => 
      f.id === audioFile.id ? { ...f, status: 'processing' } : f
    ))
    
    const path = outputPath || await getDefaultOutputPath()
    
    try {
      const result = await adjustVolume(
        audioFile.file,
        audioFile.volume,
        '',
        path
      )
      
      setFiles(prev => prev.map(f => 
        f.id === audioFile.id ? { 
          ...f, 
          status: 'completed',
          outputPath: result.output_path
        } : f
      ))
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === audioFile.id ? { 
          ...f, 
          status: 'error',
          error: error instanceof Error ? error.message : t('common.error')
        } : f
      ))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    if (files.length === 0) return
    
    setIsProcessing(true)
    const path = outputPath || await getDefaultOutputPath()
    
    for (const audioFile of files) {
      if (audioFile.status === 'completed') continue
      
      setFiles(prev => prev.map(f => 
        f.id === audioFile.id ? { ...f, status: 'processing' } : f
      ))
      
      try {
        const result = await adjustVolume(
          audioFile.file,
          audioFile.volume,
          '',
          path
        )
        
        setFiles(prev => prev.map(f => 
          f.id === audioFile.id ? { 
            ...f, 
            status: 'completed',
            outputPath: result.output_path
          } : f
        ))
      } catch (error) {
        setFiles(prev => prev.map(f => 
          f.id === audioFile.id ? { 
            ...f, 
            status: 'error',
            error: error instanceof Error ? error.message : t('common.error')
          } : f
        ))
      }
    }
    
    setIsProcessing(false)
  }

  const handleOpenOutput = async () => {
    const path = outputPath || await getDefaultOutputPath()
    await openOutputFolder(path)
  }

  const handleSelectOutputDir = async () => {
    const result = await selectDirectory(outputPath)
    if (result.success && result.path) {
      setOutputPath(result.path)
      setOutputMode('custom')
    }
  }

  const volumeOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0]

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0a0a14]">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.wma"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a,.wma"
        className="hidden"
        onChange={handleFileSelect}
        {...{ webkitdirectory: '', directory: '' } as any}
      />

      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleAddFileClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('common.add_file')}</span>
          </button>
          <button 
            onClick={handleAddFolderClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t('common.add_folder')}</span>
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Batch Volume */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('volume.batch_volume')}</span>
            <div className="relative">
              <select
                value={batchVolume}
                onChange={(e) => handleBatchVolumeChange(parseFloat(e.target.value))}
                className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-xs text-white outline-none min-w-[60px]"
              >
                {volumeOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}x</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <button 
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('common.clear_list')}</span>
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400 font-medium">
        <div className="w-8 flex-shrink-0">
          <input 
            type="checkbox" 
            className="w-3.5 h-3.5 accent-blue-500"
            checked={files.length > 0 && selectedIds.size === files.length}
            onChange={(e) => handleSelectAll(e.target.checked)}
          />
        </div>
        <div className="flex-[2] min-w-[150px] truncate pr-2">{t('common.file_name') || '文件名'}</div>
        <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.size')}</div>
        <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.duration')}</div>
        <div className="flex-[1.5] min-w-[150px] text-center truncate px-2">{t('volume.volume_value')}</div>
        <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.status_text') || '文件状态'}</div>
        <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.action') || '操作'}</div>
      </div>

      {/* File List or Drop Zone */}
      {files.length === 0 ? (
        <div
          onClick={handleAddFileClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 border border-dashed rounded-b-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-[#2a3a50] hover:border-[#3a4a60]'
          }`}
        >
          <div className="relative mb-4">
            <div className="w-20 h-16 bg-[#1a2a40] rounded-lg flex items-center justify-center relative border border-[#2a3a50]">
              <FileAudio className="w-10 h-10 text-blue-400/60" />
            </div>
            <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <Music className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-2">{t('main.drag_tip')}</p>
          <p className="text-gray-600 text-[10px]">{t('volume.volume_tip')}</p>
        </div>
      ) : (
        <div 
          className="flex-1 overflow-auto"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {files.map(file => (
            <div key={file.id} className="flex items-center bg-[#0d0d1a] hover:bg-[#12121e] px-4 py-2.5 text-xs text-gray-300 border-b border-[#1e2235]">
              <div className="w-8 flex-shrink-0">
                <input 
                  type="checkbox" 
                  className="w-3.5 h-3.5 accent-blue-500"
                  checked={selectedIds.has(file.id)}
                  onChange={(e) => handleSelectOne(file.id, e.target.checked)}
                />
              </div>
              <div className="flex-[2] min-w-[150px] truncate flex items-center gap-2 pr-2">
                <Play className="w-4 h-4 text-gray-500 flex-shrink-0 cursor-pointer hover:text-blue-400" />
                <span className="truncate" title={file.name}>{file.name}</span>
              </div>
              <div className="flex-1 min-w-[80px] text-center text-gray-400 truncate px-2">{formatSize(file.size)}</div>
              <div className="flex-1 min-w-[100px] text-center text-gray-400 truncate px-2">{file.duration}</div>
              <div className="flex-[1.5] min-w-[150px] flex items-center justify-center gap-2 px-2">
                {/* Volume Slider */}
                <EnhancedSlider
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={file.volume}
                  onChange={(value) => handleVolumeSliderChange(file.id, value)}
                  disabled={file.status === 'processing' || file.status === 'completed'}
                  className="w-full max-w-[100px]"
                  showValue={false}
                  unit="x"
                  color="green"
                  size="sm"
                />
                {/* Volume Input */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={formatVolume(file.volume)}
                    onChange={(e) => handleVolumeInputChange(file.id, e.target.value)}
                    disabled={file.status === 'processing' || file.status === 'completed'}
                    className="w-12 bg-[#1a1a2e] border border-[#2a2a40] rounded px-1 py-0.5 text-[10px] text-white text-center outline-none 
                      focus:border-green-500 focus:ring-1 focus:ring-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-all duration-150"
                  />
                  <span className="text-gray-500 text-[10px]">x</span>
                </div>
              </div>
              <div className="flex-1 min-w-[80px] text-center px-2 truncate">
                <ProcessingStatus status={file.status} error={file.error} />
              </div>
              <div className="flex-1 min-w-[100px] text-center px-2">
                {file.status === 'completed' && file.outputPath ? (
                  <button 
                    onClick={async () => {
                      const folderPath = file.outputPath!.substring(0, Math.max(
                        file.outputPath!.lastIndexOf('\\'),
                        file.outputPath!.lastIndexOf('/')
                      ))
                      await openOutputFolder(folderPath || file.outputPath!)
                    }}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] transition-colors truncate w-full"
                  >
                    {OPEN_FOLDER_TEXT}
                  </button>
                ) : (
                  <button 
                    onClick={() => handleProcessSingle(file)}
                    disabled={file.status === 'processing'}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-[10px] transition-colors truncate w-full"
                  >
                    {t('common.adjust') || '调整'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom Action Bar - 使用统一的 BottomActionBar 组件 */}
      {files.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1e2235]">
          <div className="flex items-center justify-between">
            {/* Left: Output Directory */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400">{t('footer.output_dir')}</span>
              
              {/* Original Directory Option */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="outputMode"
                  checked={outputMode === 'original'}
                  onChange={() => setOutputMode('original')}
                  className="w-3 h-3 accent-blue-500"
                />
                <span className="text-gray-300">{t('footer.original_dir')}</span>
              </label>
              
              {/* Custom Directory Option */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="outputMode"
                  checked={outputMode === 'custom'}
                  onChange={() => setOutputMode('custom')}
                  className="w-3 h-3 accent-blue-500"
                />
                <span className="text-gray-300">{t('footer.custom_dir')}</span>
              </label>
              
              {/* Path Input */}
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                disabled={outputMode === 'original'}
                title={outputPath}
                className={`w-64 bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 text-xs outline-none ${outputMode === 'original' ? 'text-gray-500 opacity-60' : 'text-gray-300 focus:border-blue-500'}`}
                placeholder="输出路径"
              />
            </div>
            
            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectOutputDir}
                disabled={outputMode === 'original'}
                className="px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#252540] disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 border border-[#2a2a40] rounded text-xs transition-colors"
              >
                {t('footer.change')}
              </button>
              <button
                onClick={handleOpenOutput}
                className="px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#252540] text-gray-300 border border-[#2a2a40] rounded text-xs transition-colors"
              >
                {OPEN_FOLDER_TEXT}
              </button>
              <button
                onClick={handleProcessAll}
                disabled={isProcessing || files.every(f => f.status === 'completed')}
                className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
              >
                {isProcessing ? t('volume.adjusting') : t('volume.start_adjust')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
