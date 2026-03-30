import { Plus, FolderPlus, Music, FileAudio, Play, Pause, Volume2, Trash2, X, Scissors, Pencil, Square, Bookmark } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { convertAudio } from '../services/api'
import AudioCutModal from './AudioCutModal'
import EditMetadataModal, { AudioMetadata } from './EditMetadataModal'
import PresetModal from './PresetModal'
import { AudioPreset } from '../services/presetService'
import { useAppContext } from '../context/AppContext'
import { t } from '../utils/i18n'

interface MainAreaProps {
  outputFormat: string
  setOutputFormat: (format: string) => void
  quality: number
  setQuality: (quality: number) => void
  channel: string
  setChannel: (channel: string) => void
  encoding: string
  setEncoding: (encoding: string) => void
  sampleRate: string
  setSampleRate: (rate: string) => void
  outputPath: string
}

interface FileItem {
  id: string
  file: File
  name: string
  size: string
  sizeBytes: number
  duration: string
  durationSeconds: number
  format: string
  bitrate: string
  status: 'waiting' | 'converting' | 'done' | 'error'
  progress: number
  outputPath?: string
  outputFormat: string
  outputBitrate: number
  // 剪切信息
  cutStartTime?: number
  cutEndTime?: number
  // 元数据
  metadata?: {
    title: string
    artist: string
    album: string
    year: string
    genre: string
  }
}

const supportedFormats = [
  'MP3', 'WAV', 'FLAC', 'AAC', 'OGG',
  'M4A', 'WMA', 'AC3', 'M4R', 'AMR', 'AIFF', 'AU', 'MP2',
  'WV', 'CAF', 'PCM'
]

const qualityMarks = [32, 64, 96, 112, 128, 160, 192, 224, 256, 320]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
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

export default function MainArea({
  outputFormat,
  setOutputFormat,
  quality,
  setQuality,
  channel,
  setChannel,
  encoding,
  setEncoding,
  sampleRate,
  setSampleRate,
  outputPath
}: MainAreaProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [cutModalOpen, setCutModalOpen] = useState(false)
  const [cutModalFile, setCutModalFile] = useState<FileItem | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editModalFile, setEditModalFile] = useState<FileItem | null>(null)
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [volume, setVolume] = useState(100)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const fileListRef = useRef<HTMLDivElement>(null)
  const dragCounterRef = useRef(0)

  // 管理音频 URL，避免内存泄漏
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile.file)
      setAudioUrl(url)
      setCurrentTime(0)
      setIsPlaying(false)
      return () => {
        const audio = audioRef.current
        if (audio) {
          const prev = audio.src
          audio.pause()
          audio.src = ''
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        } else {
          URL.revokeObjectURL(url)
        }
      }
    } else {
      setAudioUrl(null)
    }
  }, [selectedFile?.id])

  // 原生拖拽事件处理（支持有文件时继续拖拽添加）
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
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
        f.type.startsWith('audio/')
      )
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles)
      }
    }
  }, [])

  // 绑定原生拖拽事件到文件列表区域
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
    const fileItems: FileItem[] = []
    
    for (const file of newFiles) {
      const ext = file.name.split('.').pop()?.toUpperCase() || ''
      
      // 获取音频时长
      let duration = 0
      try {
        await new Promise<void>((resolve) => {
          const audio = new Audio()
          audio.preload = 'metadata'
          const objectUrl = URL.createObjectURL(file)
          audio.onloadedmetadata = () => {
            duration = audio.duration
            audio.src = ''
            URL.revokeObjectURL(objectUrl)
            resolve()
          }
          audio.onerror = () => {
            audio.src = ''
            URL.revokeObjectURL(objectUrl)
            resolve()
          }
          audio.src = objectUrl
        })
      } catch {}

      const fileItem: FileItem = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name.replace(/\.[^/.]+$/, ''),
        size: formatFileSize(file.size),
        sizeBytes: file.size,
        duration: formatDuration(duration),
        durationSeconds: duration,
        format: ext.toLowerCase(),
        bitrate: '192kbps',
        status: 'waiting',
        progress: 0,
        outputFormat: outputFormat,
        outputBitrate: quality
      }
      fileItems.push(fileItem)
    }
    
    setFiles(prev => [...prev, ...fileItems])
    if (fileItems.length > 0 && !selectedFile) {
      setSelectedFile(fileItems[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
    }
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    if (selectedFile?.id === id) {
      setSelectedFile(files.find(f => f.id !== id) || null)
    }
  }

  const clearFiles = () => {
    setFiles([])
    setSelectedFile(null)
  }

  const updateFileOutput = (id: string, format: string, bitrate: number) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, outputFormat: format, outputBitrate: bitrate, status: 'waiting', outputPath: undefined } : f
    ))
    if (selectedFile?.id === id) {
      setSelectedFile(prev => prev ? { ...prev, outputFormat: format, outputBitrate: bitrate, status: 'waiting', outputPath: undefined } : null)
    }
  }

  const { registerProcessHandler, unregisterProcessHandler, checkAndShowAuthCode } = useAppContext()

  const convertFileInternal = async (fileItem: FileItem) => {
    // 检查授权码前设置状态，提供视觉反馈
    setFiles(prev => prev.map(f => 
      f.id === fileItem.id ? { ...f, status: 'converting' } : f
    ))

    try {
      const isAuthorized = await checkAndShowAuthCode()
      if (!isAuthorized) {
        setFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'waiting' } : f
        ))
        return
      }
      
      const result = await convertAudio({
        file: fileItem.file,
        outputFormat: fileItem.outputFormat,
        bitrate: fileItem.outputBitrate,
        channels: channel,
        encoding,
        sampleRate: sampleRate === t('main.auto') ? 'auto' : sampleRate,
        outputPath,
        startTime: fileItem.cutStartTime,
        endTime: fileItem.cutEndTime,
        metadata: fileItem.metadata
      })

      setFiles(prev => prev.map(f =>
        f.id === fileItem.id ? { ...f, status: 'done', outputPath: result.output_path, outputSize: result.size } : f
      ))

      // 如果触发了降级存储，给用户一个明显的提示
      if ((result as any).is_fallback) {
        alert(t('main.save_to_temp', { path: result.output_path }))
      }
    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === fileItem.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('main.convert_failed') } : f
      ))
    }
  }

  const handleConvertAll = useCallback(async () => {
    const waitingFiles = files.filter(f => f.status === 'waiting')
    for (const file of waitingFiles) {
      await convertFileInternal(file)
    }
  }, [files])

  useEffect(() => {
    registerProcessHandler(t('functions.audio_convert'), handleConvertAll)
    return () => unregisterProcessHandler(t('functions.audio_convert'))
  }, [registerProcessHandler, unregisterProcessHandler, handleConvertAll])

  useEffect(() => {
    if (selectedFile) {
      setFiles(prev => prev.map(f => 
        f.id === selectedFile.id 
          ? { ...f, outputFormat, outputBitrate: quality, status: 'waiting', outputPath: undefined }
          : f
      ))
      setSelectedFile(prev => prev ? { ...prev, outputFormat, outputBitrate: quality, status: 'waiting', outputPath: undefined } : null)
    }
  }, [outputFormat, quality])

  useEffect(() => {
    if (selectedFile && selectedFile.status === 'done') {
      setFiles(prev => prev.map(f => 
        f.id === selectedFile.id 
          ? { ...f, status: 'waiting', outputPath: undefined }
          : f
      ))
      setSelectedFile(prev => prev ? { ...prev, status: 'waiting', outputPath: undefined } : null)
    }
  }, [channel, encoding, sampleRate])

  const convertSelectedFile = async () => {
    if (selectedFile && selectedFile.status === 'waiting') {
      setIsConverting(true)
      await convertFileInternal(selectedFile)
      setIsConverting(false)
    }
  }

  const getSliderPosition = (value: number) => {
    const min = 32
    const max = 320
    return ((value - min) / (max - min)) * 100
  }

  // 打开剪切弹窗
  const openCutModal = (file: FileItem) => {
    setCutModalFile(file)
    setCutModalOpen(true)
  }

  // 处理剪切确认
  const handleCutConfirm = (startTime: number, endTime: number) => {
    if (cutModalFile) {
      // 将剪切信息保存到文件项中
      setFiles(prev => prev.map(f => 
        f.id === cutModalFile.id 
          ? { ...f, cutStartTime: startTime, cutEndTime: endTime }
          : f
      ))
      // 更新选中文件
      if (selectedFile?.id === cutModalFile.id) {
        setSelectedFile(prev => prev ? { ...prev, cutStartTime: startTime, cutEndTime: endTime } : null)
      }
    }
  }

  // 打开编辑元数据弹窗
  const openEditModal = (file: FileItem) => {
    setEditModalFile(file)
    setEditModalOpen(true)
  }

  // 处理保存元数据
  const handleSaveMetadata = (metadata: AudioMetadata) => {
    if (editModalFile) {
      // 将元数据保存到文件项中
      setFiles(prev => prev.map(f => 
        f.id === editModalFile.id 
          ? { ...f, metadata }
          : f
      ))
      // 更新选中文件
      if (selectedFile?.id === editModalFile.id) {
        setSelectedFile(prev => prev ? { ...prev, metadata } : null)
      }
    }
  }

  // 处理应用到全部
  const handleApplyMetadataToAll = (metadata: AudioMetadata) => {
    // 将元数据应用到所有文件
    setFiles(prev => prev.map(f => ({ ...f, metadata })))
    if (selectedFile) {
      setSelectedFile(prev => prev ? { ...prev, metadata } : null)
    }
  }

  // 加载预设
  const handleLoadPreset = (preset: AudioPreset) => {
    setOutputFormat(preset.outputFormat)
    setQuality(preset.quality)
    setChannel(preset.channel)
    setEncoding(preset.encoding)
    setSampleRate(preset.sampleRate)
  }

  // 播放控制
  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      // 如果设置了剪切，从剪切开始时间播放
      if (selectedFile?.cutStartTime !== undefined) {
        if (audio.currentTime < selectedFile.cutStartTime || 
            (selectedFile.cutEndTime !== undefined && audio.currentTime >= selectedFile.cutEndTime)) {
          audio.currentTime = selectedFile.cutStartTime
          setCurrentTime(selectedFile.cutStartTime)
        }
      }
      audio.volume = volume / 100
      audio.play().then(() => {
        setIsPlaying(true)
      }).catch(err => {
        console.error(t('main.play_failed'), err)
      })
    }
  }

  // 停止播放
  const stopPlay = () => {
    const audio = audioRef.current
    if (!audio) return
    
    audio.pause()
    const startTime = selectedFile?.cutStartTime ?? 0
    audio.currentTime = startTime
    setCurrentTime(startTime)
    setIsPlaying(false)
  }

  // 处理时间更新
  const handleTimeUpdate = () => {
    const audio = audioRef.current
    if (!audio) return
    
    const time = audio.currentTime
    setCurrentTime(time)
    
    // 如果设置了剪切结束时间，到达后停止
    if (selectedFile?.cutEndTime !== undefined && time >= selectedFile.cutEndTime) {
      audio.pause()
      const startTime = selectedFile.cutStartTime ?? 0
      audio.currentTime = startTime
      setCurrentTime(startTime)
      setIsPlaying(false)
    }
  }

  // 点击进度条定位
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !selectedFile) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    
    // 计算实际播放范围
    const startTime = selectedFile.cutStartTime ?? 0
    const endTime = selectedFile.cutEndTime ?? selectedFile.durationSeconds
    const duration = endTime - startTime
    
    const newTime = startTime + progress * duration
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  // 音量变化
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }

  // 音频加载完成
  const handleAudioLoaded = () => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
      // 如果有剪切设置，定位到开始时间
      if (selectedFile?.cutStartTime !== undefined) {
        audioRef.current.currentTime = selectedFile.cutStartTime
        setCurrentTime(selectedFile.cutStartTime)
      }
    }
  }

  // 计算显示的时长和进度
  const getDisplayDuration = () => {
    if (!selectedFile) return 0
    if (selectedFile.cutStartTime !== undefined && selectedFile.cutEndTime !== undefined) {
      return selectedFile.cutEndTime - selectedFile.cutStartTime
    }
    return selectedFile.durationSeconds
  }

  const getDisplayCurrentTime = () => {
    if (!selectedFile) return 0
    const startTime = selectedFile.cutStartTime ?? 0
    return Math.max(0, currentTime - startTime)
  }

  const getProgressPercent = () => {
    const duration = getDisplayDuration()
    if (duration <= 0) return 0
    return (getDisplayCurrentTime() / duration) * 100
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a14]">
      {/* Hidden file input */}
  <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleAudioLoaded}
          onEnded={() => {
            setIsPlaying(false)
            if (selectedFile?.cutStartTime !== undefined) {
              if (audioRef.current) {
                audioRef.current.currentTime = selectedFile.cutStartTime
                setCurrentTime(selectedFile.cutStartTime)
              }
            }
          }}
        />
      )}

      {/* Top Bar - Output Settings */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e2235]">
        {/* Left: Add buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('main.add_files')}</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252a3a] hover:bg-[#2a3040] text-white rounded text-xs transition-colors border border-[#3a4a60]">
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t('main.add_folder')}</span>
          </button>
          <button 
            onClick={() => setPresetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252a3a] hover:bg-[#2a3040] text-white rounded text-xs transition-colors border border-[#3a4a60]"
            title={t('main.preset_title')}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>{t('main.preset')}</span>
          </button>
        </div>
        
        {/* Right: Quality & Format selectors */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('main.select_output_quality')}</span>
            <select
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="bg-[#1a1a2e] border border-[#2a3a50] rounded px-2 py-1 text-sm text-white outline-none min-w-[70px]"
            >
              {qualityMarks.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            <span className="text-gray-400 text-xs">kbps</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('main.select_output_format')}</span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="bg-[#1a1a2e] border border-[#2a3a50] rounded px-2 py-1 text-sm text-white outline-none min-w-[100px]"
            >
              {supportedFormats.map(fmt => (
                <option key={fmt} value={fmt}>{fmt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex p-3 gap-3 overflow-hidden">
        {/* Left Panel - File List */}
        <div ref={fileListRef} className="flex-1 flex flex-col relative">
        {files.length > 0 ? (
          <>
            {/* Header with file count */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-xs">{t('main.file_count', { count: files.length })}</span>
              <button 
                onClick={clearFiles}
                className="flex items-center gap-1 text-gray-400 hover:text-white text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('main.clear_list')}</span>
              </button>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {files.map(file => (
                <div 
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`bg-[#252a3a] rounded-lg p-4 cursor-pointer border transition-colors ${
                    selectedFile?.id === file.id 
                      ? 'border-blue-500' 
                      : 'border-transparent hover:border-[#3a4a60]'
                  }`}
                >
                  <div className="flex items-center">
                    {/* Source File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium mb-2 truncate">{file.name}</div>
                      <div className="flex items-center gap-6 text-xs text-gray-400">
                        <span>{t('main.duration')}<span className="text-gray-300">{file.duration}</span></span>
                        <span>{t('main.size')}<span className="text-gray-300">{file.size}</span></span>
                      </div>
                      <div className="flex items-center gap-6 text-xs text-gray-400 mt-1">
                        <span>{t('main.format')}<span className="text-gray-300">{file.format}</span></span>
                        <span>{t('main.quality')}<span className="text-gray-300">{file.bitrate}</span></span>
                      </div>
                    </div>

                    {/* Shuffle Icon */}
                    <div className="px-6 flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                      </svg>
                    </div>

                    {/* Output File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-sm font-medium truncate ${file.metadata?.title ? 'text-green-400' : 'text-white'}`}>
                          {file.metadata?.title || file.name}
                        </span>
                        <div className="flex items-center gap-1 text-gray-500">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openCutModal(file)
                            }}
                            className={`hover:text-blue-400 transition-colors ${file.cutStartTime !== undefined ? 'text-green-400' : ''}`}
                            title={file.cutStartTime !== undefined ? t('main.is_cut') : t('main.cut_audio')}
                          >
                            <Scissors className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(file)
                            }}
                            className={`hover:text-blue-400 transition-colors ${file.metadata ? 'text-green-400' : ''}`}
                            title={file.metadata ? t('main.is_metadata') : t('main.edit_info')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-xs text-gray-400">
                        <span>{t('main.duration')}<span className={file.cutStartTime !== undefined ? 'text-green-400' : 'text-gray-300'}>
                          {file.cutStartTime !== undefined && file.cutEndTime !== undefined 
                            ? formatDuration(file.cutEndTime - file.cutStartTime)
                            : file.duration}
                        </span></span>
                        <span>{t('main.size')}<span className="text-gray-300">{t('main.to_be_calculated')}</span></span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                        <span className="flex items-center gap-1">
                          {t('main.format')}
                          <select
                            value={file.outputFormat}
                            onChange={(e) => updateFileOutput(file.id, e.target.value, file.outputBitrate)}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-transparent text-gray-300 text-xs outline-none cursor-pointer ml-1"
                          >
                            {supportedFormats.map(fmt => (
                              <option key={fmt} value={fmt} className="bg-[#1a1a2e]">{fmt.toLowerCase()}</option>
                            ))}
                          </select>
                          <svg className="w-3 h-3 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                        <span>{t('main.quality')}<span className="text-blue-400">{file.outputBitrate}kbps</span></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 ml-4">
                      {file.status === 'done' && file.outputPath ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            const folderPath = file.outputPath!.substring(0, Math.max(
                              file.outputPath!.lastIndexOf('\\'),
                              file.outputPath!.lastIndexOf('/')
                            ))
                            import('../utils/audioUtils').then(utils => utils.openOutputFolder(folderPath || file.outputPath!))
                          }}
                          className="px-6 py-2 rounded text-sm font-medium transition-colors bg-green-600 hover:bg-green-700 text-white"
                         >
                          {t('main.open_folder')}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            convertFileInternal(file)
                          }}
                          disabled={file.status === 'converting'}
                          className={`px-6 py-2 rounded text-sm font-medium transition-colors ${
                            file.status === 'converting'
                            ? 'bg-gray-600 text-white cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {file.status === 'converting' ? t('main.converting') : t('main.convert')}
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFile(file.id)
                        }}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Empty State - Drop Zone */
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border border-dashed rounded-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
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
              <p className="text-gray-500 text-xs mb-3">
                {t('main.drag_tip')}
              </p>
              <div className="text-center px-6 max-w-lg">
                <p className="text-gray-600 text-[10px] leading-relaxed">
                  {t('main.supported_formats_tip', { formats: supportedFormats.join(', ') })}
                </p>
              </div>
            </div>
        )}
        
        {/* 拖拽覆盖层提示 */}
        {isDragging && files.length > 0 && (
          <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10 pointer-events-none">
            <div className="text-blue-400 text-sm font-medium">{t('common.release_to_add')}</div>
          </div>
        )}
      </div>

      {/* Right Panel - Settings & Preview */}
      <div className="w-72 flex flex-col gap-3">
        {/* Quality Slider */}
        <div className="bg-[#12121e] rounded-lg p-3 border border-[#1e2235]">
          <div className="mb-4">
            <span className="text-gray-400 text-xs">{t('main.quality_label')}: ({t('main.recommended_range')})</span>
          </div>
          
          {/* 滑块区域 */}
          <div className="relative px-1">
            {/* 绿色三角指示器 - 在选中点正上方 */}
            <div 
              className="absolute -top-3 transition-all duration-150"
              style={{ 
                left: `${(qualityMarks.indexOf(quality) / (qualityMarks.length - 1)) * 100}%`,
                transform: 'translateX(-50%)'
              }}
            >
              <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-green-500" />
            </div>
            
            {/* 轨道容器 */}
            <div className="relative h-4 flex items-center">
              {/* 灰色底轨 */}
              <div className="absolute w-full h-[2px] bg-gray-600 rounded-full" />
              
              {/* 蓝色推荐范围轨道 (112-256, 即索引3到8) */}
              <div 
                className="absolute h-[2px] bg-blue-500 rounded-full" 
                style={{ 
                  left: `${(3 / 9) * 100}%`, 
                  width: `${(5 / 9) * 100}%` 
                }} 
              />
              
              {/* 圆点按钮 */}
              {qualityMarks.map((mark, idx) => {
                const isInRange = mark >= 112 && mark <= 256
                const isSelected = quality === mark
                return (
                  <button
                    key={mark}
                    onClick={() => setQuality(mark)}
                    className={`absolute w-2 h-2 rounded-full transition-transform hover:scale-150 ${
                      isInRange ? 'bg-blue-500' : 'bg-gray-500'
                    }`}
                    style={{ 
                      left: `${(idx / (qualityMarks.length - 1)) * 100}%`,
                      transform: 'translateX(-50%)'
                    }}
                  />
                )
              })}
            </div>
            
            {/* 数字标签 */}
            <div className="relative mt-2 h-4">
              {qualityMarks.map((mark, idx) => (
                <span 
                  key={mark}
                  className="absolute text-[9px] text-gray-500"
                  style={{ 
                    left: `${(idx / (qualityMarks.length - 1)) * 100}%`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  {mark}
                </span>
              ))}
            </div>
          </div>
          
          {/* kbps 显示 */}
          <div className="text-right mt-1">
            <span className="text-blue-400 text-sm font-medium">{quality}kbps</span>
          </div>
        </div>

        {/* Channel & Encoding Settings */}
        <div className="bg-[#12121e] rounded-lg p-3 border border-[#1e2235]">
          <div className="flex gap-4">
            <div className="flex-1">
              <p className="text-gray-400 text-xs mb-2">{t('main.channel_label')}:</p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={channel === 'original'}
                    onChange={() => setChannel('original')}
                    className="accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-300">{t('main.original_audio')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={channel === 'mono'}
                    onChange={() => setChannel('mono')}
                    className="accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-300">{t('main.mono')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={channel === 'stereo'}
                    onChange={() => setChannel('stereo')}
                    className="accent-blue-500"
                  />
                  <span className="text-[11px] text-gray-300">{t('main.stereo')}</span>
                </label>
              </div>
            </div>

            <div className="flex-1">
              <div className="flex justify-between mb-2">
                <p className="text-gray-400 text-xs">{t('main.encoding_label')}:</p>
                <p className="text-gray-400 text-xs">{t('main.sample_rate_label')}:</p>
              </div>
              <div className="flex gap-2">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="encoding"
                      checked={encoding === 'VBR'}
                      onChange={() => setEncoding('VBR')}
                      className="accent-blue-500"
                    />
                    <span className="text-[11px] text-gray-300">VBR</span>
                    <span className="text-gray-500 text-[10px]">ⓘ</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="encoding"
                      checked={encoding === 'CBR'}
                      onChange={() => setEncoding('CBR')}
                      className="accent-blue-500"
                    />
                    <span className="text-[11px] text-gray-300">CBR</span>
                    <span className="text-gray-500 text-[10px]">ⓘ</span>
                  </label>
                </div>
                <div className="ml-auto">
                  <select
                    value={sampleRate}
                    onChange={(e) => setSampleRate(e.target.value)}
                    className="bg-[#0a0a14] border border-[#2a2a40] rounded px-1.5 py-0.5 text-[11px] text-white outline-none"
                  >
                    <option value="自动">{t('main.auto')}</option>
                    <option value="8000">8000 Hz</option>
                    <option value="11025">11025 Hz</option>
                    <option value="22050">22050 Hz</option>
                    <option value="44100">44100 Hz</option>
                    <option value="48000">48000 Hz</option>
                    <option value="96000">96000 Hz</option>
                    <option value="192000">192000 Hz</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-[#12121e] rounded-lg border border-[#1e2235] flex flex-col p-3 min-h-[180px]">
          {selectedFile ? (
            <>
              {/* File Name */}
              <div className="text-white text-xs mb-2 truncate">
                {selectedFile.metadata?.title || selectedFile.name}.{selectedFile.format}
              </div>
              
              {/* Music Note Icon */}
              <div className="flex-1 flex items-center justify-center relative">
                {/* 背景圆环 */}
                <div className={`absolute w-32 h-32 rounded-full bg-blue-500/10 ${isPlaying ? 'animate-pulse' : ''}`} />
                <div className="w-24 h-24 relative z-10">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <defs>
                      <linearGradient id="noteGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M75 10 L75 60 C75 72 63 80 52 80 C41 80 30 72 30 60 C30 48 41 40 52 40 C58 40 64 42 70 46 L70 22 L48 28 L48 68 C48 80 36 88 25 88 C14 88 3 80 3 68 C3 56 14 48 25 48 C31 48 37 50 43 54 L43 18 L75 10 Z"
                      fill="url(#noteGradient)"
                    />
                  </svg>
                </div>
              </div>

              {/* Player Controls */}
              <div className="mt-auto">
                {/* Control Buttons & Progress */}
                <div className="flex items-center gap-2 mb-2">
                  {/* Play/Pause Button */}
                  <button 
                    onClick={togglePlay}
                    className="w-7 h-7 flex items-center justify-center text-white hover:text-blue-400 transition-colors bg-[#2a2a40] rounded"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  
                  {/* Stop Button */}
                  <button 
                    onClick={stopPlay}
                    className="w-7 h-7 flex items-center justify-center text-white hover:text-blue-400 transition-colors bg-[#2a2a40] rounded"
                  >
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                  
                  {/* Progress Bar */}
                  <div 
                    ref={progressBarRef}
                    className="flex-1 h-1.5 bg-[#2a2a40] rounded relative cursor-pointer group"
                    onClick={handleProgressClick}
                  >
                    {/* Progress */}
                    <div 
                      className="h-full bg-blue-500 rounded transition-all" 
                      style={{ width: `${getProgressPercent()}%` }}
                    />
                    {/* Thumb */}
                    <div 
                      className="absolute w-3 h-3 bg-white rounded-full -top-[3px] transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `${getProgressPercent()}%` }}
                    />
                  </div>
                </div>

                {/* Time & Volume */}
                <div className="flex items-center justify-between">
                  {/* Time Display */}
                  <div className="text-[10px] text-gray-400">
                    <span>{formatDuration(getDisplayCurrentTime())}</span>
                    <span className="mx-1">/</span>
                    <span className={selectedFile.cutStartTime !== undefined ? 'text-green-400' : ''}>
                      {formatDuration(getDisplayDuration())}
                    </span>
                  </div>
                  
                  {/* Volume Control */}
                  <div className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="w-14 h-1 bg-[#2a2a40] rounded appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 mb-3">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <defs>
                    <linearGradient id="noteGradientEmpty" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M75 10 L75 60 C75 72 63 80 52 80 C41 80 30 72 30 60 C30 48 41 40 52 40 C58 40 64 42 70 46 L70 22 L48 28 L48 68 C48 80 36 88 25 88 C14 88 3 80 3 68 C3 56 14 48 25 48 C31 48 37 50 43 54 L43 18 L75 10 Z"
                    fill="url(#noteGradientEmpty)"
                  />
                </svg>
              </div>
              <div className="w-full mt-auto">
                <div className="flex items-center gap-2 mb-2">
                  <button className="w-7 h-7 flex items-center justify-center text-white bg-[#2a2a40] rounded">
                    <Play className="w-4 h-4" />
                  </button>
                  <button className="w-7 h-7 flex items-center justify-center text-white bg-[#2a2a40] rounded">
                    <Square className="w-3 h-3 fill-current" />
                  </button>
                  <div className="flex-1 h-1.5 bg-[#2a2a40] rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[10px] text-gray-500">
                    <span>00:00:00.000</span>
                    <span className="mx-1">/</span>
                    <span>00:00:00.000</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-gray-400" />
                    <div className="w-14 h-1 bg-[#2a2a40] rounded" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Audio Cut Modal */}
      <AudioCutModal
        isOpen={cutModalOpen}
        onClose={() => setCutModalOpen(false)}
        file={cutModalFile?.file || null}
        fileName={cutModalFile ? `${cutModalFile.name}.${cutModalFile.format}` : ''}
        duration={cutModalFile?.durationSeconds || 0}
        initialStartTime={cutModalFile?.cutStartTime}
        initialEndTime={cutModalFile?.cutEndTime}
        onConfirm={handleCutConfirm}
      />

      {/* Edit Metadata Modal */}
      <EditMetadataModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        fileName={editModalFile ? `${editModalFile.name}.${editModalFile.format}` : ''}
        initialMetadata={editModalFile?.metadata}
        onSave={handleSaveMetadata}
        onApplyToAll={handleApplyMetadataToAll}
      />

      {/* Preset Modal */}
      <PresetModal
        isOpen={presetModalOpen}
        onClose={() => setPresetModalOpen(false)}
        currentSettings={{
          outputFormat,
          quality,
          channel,
          encoding,
          sampleRate
        }}
        onLoadPreset={handleLoadPreset}
      />
    </div>
  )
}
