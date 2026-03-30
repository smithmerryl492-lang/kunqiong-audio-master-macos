import { Plus, FolderPlus, Trash2, Music, FileAudio, Play, Pause, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { selectDirectory, openFolder, getDefaultOutputPath, cutAudio } from '../services/api'
import { useAppContext } from '../context/AppContext'
import AudioCutModal from './AudioCutModal'
import BatchCutModal, { BatchFileItem } from './BatchCutModal'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface CutSegment {
  id: string
  startTime: number
  endTime: number
}

interface FileItem {
  id: string
  file: File
  name: string
  size: string
  sizeBytes: number
  duration: string
  durationSeconds: number
  outputFormat: string
  status: 'waiting' | 'processing' | 'done' | 'error'
  cutStartTime?: number
  cutEndTime?: number
}

const outputFormats = [t('cut.original_format'), 'MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

// 剪切图标组件
function CutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
      <path d="M10 12h4" strokeDasharray="2 2" />
    </svg>
  )
}

export default function AudioCutArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [outputFormat, setOutputFormat] = useState(t('cut.original_format'))
  const [outputType, setOutputType] = useState<'original' | 'custom'>('custom')
  const [outputPath, setOutputPath] = useState('')
  const [cutModalOpen, setCutModalOpen] = useState(false)
  const [cutModalFile, setCutModalFile] = useState<FileItem | null>(null)
  const [batchCutModalOpen, setBatchCutModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [playingFileId, setPlayingFileId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [pendingSegments, setPendingSegments] = useState<CutSegment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileListRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)
  const { checkAndShowAuthCode } = useAppContext()

  // 清理音频URL
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        const prev = audioRef.current.src
        audioRef.current.pause()
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      } else if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const togglePlayFile = (file: FileItem) => {
    if (playingFileId === file.id) {
      // 停止播放
      if (audioRef.current) {
        const prev = audioRef.current.src
        audioRef.current.pause()
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      }
      setPlayingFileId(null)
      setAudioUrl(null)
    } else {
      // 播放新文件
      if (audioRef.current) {
        const prev = audioRef.current.src
        audioRef.current.pause()
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      } else if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      const url = URL.createObjectURL(file.file)
      setAudioUrl(url)
      setPlayingFileId(file.id)
      
      // 等待音频元素更新后播放
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(console.error)
        }
      }, 100)
    }
  }

  const handleAudioEnded = () => {
    setPlayingFileId(null)
    const prev = audioRef.current?.src || ''
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    setAudioUrl(null)
  }

  // 初始化默认输出路径
  useEffect(() => {
    getDefaultOutputPath().then(path => {
      setOutputPath(path)
    }).catch(() => {
      setOutputPath('C:/Users/admin/Desktop/音频处理大师')
    })
  }, [])

  // 原生拖拽事件处理
  const handleNativeDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleNativeDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleNativeDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer!.dropEffect = 'copy'
  }, [])

  const handleNativeDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files))
    }
  }, [])

  // 绑定原生拖拽事件
  useEffect(() => {
    const element = fileListRef.current
    if (!element) return

    element.addEventListener('dragenter', handleNativeDragEnter, true)
    element.addEventListener('dragleave', handleNativeDragLeave, true)
    element.addEventListener('dragover', handleNativeDragOver, true)
    element.addEventListener('drop', handleNativeDrop, true)

    return () => {
      element.removeEventListener('dragenter', handleNativeDragEnter, true)
      element.removeEventListener('dragleave', handleNativeDragLeave, true)
      element.removeEventListener('dragover', handleNativeDragOver, true)
      element.removeEventListener('drop', handleNativeDrop, true)
    }
  }, [handleNativeDragEnter, handleNativeDragLeave, handleNativeDragOver, handleNativeDrop])

  const addFiles = async (newFiles: File[]) => {
    const audioFiles = newFiles.filter(f => 
      f.type.startsWith('audio/') || 
      /\.(mp3|wav|flac|aac|ogg|m4a|wma|ac3|amr|aiff|ape|au|mp2|dts|mmf|wv|caf|pcm)$/i.test(f.name)
    )
    
    const fileItems: FileItem[] = []
    
    for (const file of audioFiles) {
      let duration = 0
      try {
        const audio = new Audio()
        audio.preload = 'metadata'
        const objURL = URL.createObjectURL(file)
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => {
            duration = audio.duration
            URL.revokeObjectURL(objURL)
            audio.src = ''
            resolve()
          }
          audio.onerror = () => {
            URL.revokeObjectURL(objURL)
            audio.src = ''
            resolve()
          }
          audio.src = objURL
        })
      } catch {}

      const fileItem: FileItem = {
        id: Math.random().toString(36).substring(2, 11),
        file,
        name: file.name,
        size: formatFileSize(file.size),
        sizeBytes: file.size,
        duration: formatDuration(duration),
        durationSeconds: duration,
        outputFormat: t('cut.original_format'),
        status: 'waiting'
      }
      fileItems.push(fileItem)
    }
    
    setFiles(prev => [...prev, ...fileItems])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
    e.target.value = ''
  }

  const clearFiles = () => {
    setFiles([])
  }

  const openCutModal = (file: FileItem) => {
    setCutModalFile(file)
    setCutModalOpen(true)
  }

  const handleCutConfirm = (startTime: number, endTime: number, segments?: CutSegment[]) => {
    if (cutModalFile) {
      setFiles(prev => prev.map(f => 
        f.id === cutModalFile.id 
          ? { ...f, cutStartTime: startTime, cutEndTime: endTime }
          : f
      ))
      // 如果有多个分段，保存待导出的分段
      if (segments && segments.length > 0) {
        setPendingSegments(segments)
        // 自动导出所有分段
        exportSegments(cutModalFile, segments)
      }
    }
  }

  // 导出多个分段
  const exportSegments = async (file: FileItem, segments: CutSegment[]) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setIsExporting(true)
    setFiles(prev => prev.map(f => 
      f.id === file.id ? { ...f, status: 'processing' } : f
    ))

    try {
      const actualOutputPath = outputType === 'original' ? outputPath : outputPath
      
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        await cutAudio(file.file, seg.startTime, seg.endTime, actualOutputPath)
      }
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'done' } : f
      ))
    } catch (error) {
      console.error('导出分段失败:', error)
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'error' } : f
      ))
    }
    
    setIsExporting(false)
    setPendingSegments([])
  }

  const handleSelectDirectory = async () => {
    try {
      const result = await selectDirectory(outputPath)
      if (result.success && result.path) {
        setOutputPath(result.path)
        setOutputType('custom')
      }
    } catch (error) {
      console.error('选择目录失败:', error)
    }
  }

  const handleOpenFolder = async () => {
    try {
      await openOutputFolder(outputPath)
    } catch (error) {
      console.error('打开文件夹失败:', error)
    }
  }

  const handleExportAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    if (files.length === 0) return
    
    setIsExporting(true)
    
    // 根据输出类型确定实际输出路径
    const actualOutputPath = outputType === 'original' ? outputPath : outputPath
    
    for (const file of files) {
      if (file.status === 'done') continue
      
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'processing' } : f
      ))
      
      try {
        const startTime = file.cutStartTime ?? 0
        const endTime = file.cutEndTime ?? file.durationSeconds
        
        await cutAudio(file.file, startTime, endTime, actualOutputPath)
        
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'done' } : f
        ))
      } catch (error) {
        console.error('剪切失败:', error)
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'error' } : f
        ))
      }
    }
    
    setIsExporting(false)
  }

  const handleBatchCut = () => {
    // 打开批量剪切弹窗
    setBatchCutModalOpen(true)
  }

  const handleBatchCutConfirm = async (
    selectedFiles: BatchFileItem[], 
    splitMode: 'average' | 'time', 
    splitValue: number
  ) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setIsExporting(true)
    
    for (const file of selectedFiles) {
      // 根据分割模式计算分段
      const segments: { start: number; end: number }[] = []
      
      if (splitMode === 'average') {
        const segmentDuration = file.durationSeconds / splitValue
        for (let i = 0; i < splitValue; i++) {
          segments.push({
            start: i * segmentDuration,
            end: (i + 1) * segmentDuration
          })
        }
      } else {
        let currentStart = 0
        while (currentStart < file.durationSeconds) {
          const segEnd = Math.min(currentStart + splitValue, file.durationSeconds)
          segments.push({
            start: currentStart,
            end: segEnd
          })
          currentStart = segEnd
        }
      }
      
      // 更新状态为处理中
      setFiles(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'processing' } : f
      ))
      
      try {
        // 导出每个分段
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          await cutAudio(file.file, seg.start, seg.end, outputPath)
        }
        
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'done' } : f
        ))
      } catch (error) {
        console.error('批量剪切失败:', error)
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'error' } : f
        ))
      }
    }
    
    setIsExporting(false)
  }

  return (
    <div className="flex-1 flex flex-col p-4 overflow-hidden bg-[#0a0a14]">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept="audio/*"
        onChange={handleFolderSelect}
        className="hidden"
        {...{ webkitdirectory: '', directory: '' } as any}
      />
      
      {/* Audio element for preview */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          className="hidden"
        />
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors border border-blue-500"
          >
            <Plus className="w-4 h-4" />
            <span>{t('common.add_file')}</span>
          </button>
          <button 
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-sm transition-colors border border-[#2a3a50]"
          >
            <FolderPlus className="w-4 h-4" />
            <span>{t('common.add_folder')}</span>
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleBatchCut}
            disabled={files.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
          >
            {t('cut.batch_cut')}
          </button>
          <button 
            onClick={clearFiles}
            className="flex items-center gap-1.5 px-3 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>{t('common.clear_list')}</span>
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-3 text-sm text-gray-400">
        <div className="flex-1 min-w-[280px]">{t('common.file_name') || '文件名'}</div>
        <div className="w-28 text-center">{t('common.size')}</div>
        <div className="w-32 text-center">{t('common.duration')}</div>
        <div className="w-28 text-center">{t('common.format')}</div>
        <div className="w-28 text-center">{t('common.status_text') || '文件状态'}</div>
        <div className="w-24 text-center">{t('common.action') || '操作'}</div>
      </div>

      {/* File List / Drop Zone */}
      <div ref={fileListRef} className="flex-1 flex flex-col relative">
      {files.length > 0 ? (
        <div className="flex-1 overflow-y-auto bg-[#0d0d18]">
          {files.map(file => (
            <div 
              key={file.id}
              className="flex items-center px-4 py-3 border-b border-[#1a1a28] hover:bg-[#12121e] transition-colors"
            >
              {/* File Name */}
              <div className="flex-1 min-w-[280px] flex items-center gap-3">
                <button 
                  onClick={() => togglePlayFile(file)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {playingFileId === file.id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>
                <span className="text-white text-sm truncate">{file.name}</span>
              </div>
              
              {/* File Size */}
              <div className="w-28 text-center text-gray-300 text-sm">
                {file.size}
              </div>
              
              {/* Duration */}
              <div className="w-32 text-center text-gray-300 text-sm">
                {file.cutStartTime !== undefined && file.cutEndTime !== undefined 
                  ? formatDuration(file.cutEndTime - file.cutStartTime)
                  : file.duration}
              </div>
              
              {/* Output Format */}
              <div className="w-28 text-center text-gray-400 text-sm">
                -
              </div>
              
              {/* Status */}
              <div className="w-28 text-center">
                {file.status === 'waiting' && (
                  <span className="text-gray-400 text-sm">-</span>
                )}
                {file.status === 'processing' && (
                  <span className="text-blue-400 text-sm">{t('cut.processing')}</span>
                )}
                {file.status === 'done' && (
                  <span className="text-green-400 text-sm">{t('common.status.done')}</span>
                )}
                {file.status === 'error' && (
                  <span className="text-red-400 text-sm">{t('common.status.error')}</span>
                )}
              </div>
              
              {/* Actions */}
              <div className="w-24 flex items-center justify-center">
                {file.status === 'done' ? (
                  <button
                    onClick={() => {
                      const folderPath = outputPath
                      openFolder(folderPath)
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                  >
                    {OPEN_FOLDER_TEXT}
                  </button>
                ) : (
                  <button
                    onClick={() => openCutModal(file)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                      file.cutStartTime !== undefined 
                        ? 'text-green-400 hover:text-green-300' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title={t('main.cut_audio')}
                  >
                    <CutIcon className="w-4 h-4" />
                    <span>{t('main.cut_audio')}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
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
          <p className="text-gray-500 text-sm mb-2">
            {t('main.drag_tip')}
          </p>
          <p className="text-gray-600 text-xs">
            {t('cut.description') || '音频分割，支持多种分割类型'}
          </p>
        </div>
      )}
      
      {/* 拖拽覆盖层 */}
      {isDragging && files.length > 0 && (
        <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10 pointer-events-none">
          <div className="text-blue-400 text-sm font-medium">{t('main.release_to_add') || '释放文件以添加'}</div>
        </div>
      )}
      </div>

      {/* Bottom Settings Bar */}
      <div className="mt-4 flex items-center justify-between">
        {/* Output Format */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{t('common.format')}:</span>
          <div className="relative">
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="appearance-none bg-[#1a2035] border border-[#2a3a50] rounded px-4 py-2 pr-8 text-white text-sm outline-none focus:border-blue-500 cursor-pointer min-w-[120px]"
            >
              {outputFormats.map(fmt => (
                <option key={fmt} value={fmt} className="bg-[#1a1a2e]">{fmt}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Output Directory */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">{t('footer.output_dir')}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="outputType"
                checked={outputType === 'original'}
                onChange={() => setOutputType('original')}
                className="accent-blue-500"
              />
              <span className="text-gray-300 text-sm">{t('footer.original_dir')}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="outputType"
                checked={outputType === 'custom'}
                onChange={() => setOutputType('custom')}
                className="accent-blue-500"
              />
              <span className="text-gray-300 text-sm">{t('footer.custom_dir')}</span>
            </label>
          </div>
          
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            disabled={outputType === 'original'}
            title={outputPath}
            className={`bg-[#1a2035] border border-[#2a3a50] rounded px-3 py-2 text-sm outline-none w-[280px] ${outputType === 'original' ? 'text-gray-500 opacity-60' : 'text-gray-300 focus:border-blue-500'}`}
          />
          
          <button
            onClick={handleSelectDirectory}
            disabled={outputType === 'original'}
            className="px-4 py-2 bg-[#1a2035] hover:bg-[#252a40] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors border border-[#2a3a50]"
          >
            {t('footer.change')}
          </button>
          
          <button
            onClick={handleOpenFolder}
            className="px-4 py-2 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-sm transition-colors border border-[#2a3a50]"
          >
            {OPEN_FOLDER_TEXT}
          </button>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportAll}
          disabled={files.length === 0 || isExporting}
          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors min-w-[120px]"
        >
          {isExporting ? t('cut.processing') : t('footer.export_all')}
        </button>
      </div>

      {/* Cut Modal */}
      {cutModalFile && (
        <AudioCutModal
          isOpen={cutModalOpen}
          onClose={() => setCutModalOpen(false)}
          file={cutModalFile.file}
          fileName={cutModalFile.name}
          duration={cutModalFile.durationSeconds}
          initialStartTime={cutModalFile.cutStartTime}
          initialEndTime={cutModalFile.cutEndTime}
          onConfirm={handleCutConfirm}
        />
      )}

      {/* Batch Cut Modal */}
      <BatchCutModal
        isOpen={batchCutModalOpen}
        onClose={() => setBatchCutModalOpen(false)}
        files={files}
        onConfirm={handleBatchCutConfirm}
      />
    </div>
  )
}
