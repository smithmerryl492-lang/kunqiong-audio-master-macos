import { Plus, FolderPlus, Trash2, FileVideo, Play, Pause, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { getDefaultOutputPath, extractAudioFromVideo, openFolder } from '../services/api'
import { useAppContext } from '../context/AppContext'
import AudioCutModal from './AudioCutModal'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

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

const outputFormats = ['MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A', 'WMA', 'AC3']

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

export default function VideoExtractAudioArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<FileItem[]>([])
  const [outputFormat, setOutputFormat] = useState('MP3')
  const [outputPath, setOutputPath] = useState('')
  const [cutModalOpen, setCutModalOpen] = useState(false)
  const [cutModalFile, setCutModalFile] = useState<FileItem | null>(null)
  const [playingFileId, setPlayingFileId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 初始化默认输出路径
  useEffect(() => {
    getDefaultOutputPath().then(path => {
      setOutputPath(path)
    }).catch(() => {
      setOutputPath('C:/AudioConverter/outputs')
    })
  }, [])

  // 清理视频URL
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        const prev = videoRef.current.src
        videoRef.current.pause()
        videoRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      } else if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
    }
  }, [videoUrl])

  const togglePlayFile = (file: FileItem) => {
    if (playingFileId === file.id) {
      if (videoRef.current) {
        const prev = videoRef.current.src
        videoRef.current.pause()
        videoRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      }
      setPlayingFileId(null)
      if (videoUrl) setVideoUrl(null)
    } else {
      if (videoUrl) {
        if (videoRef.current) {
          const prev = videoRef.current.src
          videoRef.current.pause()
          videoRef.current.src = ''
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        } else {
          URL.revokeObjectURL(videoUrl)
        }
      }
      const url = URL.createObjectURL(file.file)
      setVideoUrl(url)
      setPlayingFileId(file.id)
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch(console.error)
        }
      }, 100)
    }
  }

  const handleVideoEnded = () => {
    setPlayingFileId(null)
    const cur = videoRef.current?.src || ''
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }
    if (cur && cur.startsWith('blob:')) URL.revokeObjectURL(cur)
    setVideoUrl(null)
  }

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
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const addFiles = async (newFiles: File[]) => {
    const videoFiles = newFiles.filter(f => 
      f.type.startsWith('video/') || 
      /\.(mp4|avi|mkv|mov|wmv|flv|webm|m4v|mpeg|mpg|3gp|ts)$/i.test(f.name)
    )
    
    const fileItems: FileItem[] = []
    
    for (const file of videoFiles) {
      let duration = 0
      try {
        const video = document.createElement('video')
        video.preload = 'metadata'
        const url = URL.createObjectURL(file)
        video.src = url
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            duration = video.duration
            const prev = video.src
            video.src = ''
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
            resolve()
          }
          video.onerror = () => {
            const prev = video.src
            video.src = ''
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
            resolve()
          }
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
        outputFormat: outputFormat,
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
    if (videoRef.current) {
      const prev = videoRef.current.src
      videoRef.current.pause()
      videoRef.current.src = ''
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    }
    if (videoUrl) setVideoUrl(null)
    setPlayingFileId(null)
    setFiles([])
  }

  const openCutModal = (file: FileItem) => {
    setCutModalFile(file)
    setCutModalOpen(true)
  }

  const handleCutConfirm = (startTime: number, endTime: number) => {
    if (cutModalFile) {
      setFiles(prev => prev.map(f => 
        f.id === cutModalFile.id 
          ? { ...f, cutStartTime: startTime, cutEndTime: endTime }
          : f
      ))
    }
  }

  const { registerProcessHandler, unregisterProcessHandler, checkAndShowAuthCode } = useAppContext()

  const handleExportSingleInternal = useCallback(async (file: FileItem) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'processing' } : f))
    try {
      await extractAudioFromVideo({
        file: file.file,
        outputFormat: file.outputFormat.toLowerCase(),
        outputPath: outputPath,
        startTime: file.cutStartTime,
        endTime: file.cutEndTime
      })
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'done' } : f))
    } catch (error) {
      console.error(t('functions.video_extract_audio.extract_failed'), error)
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: 'error' } : f))
    }
  }, [checkAndShowAuthCode, outputPath])

  const handleExportAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'waiting')
    for (const file of pendingFiles) {
      await handleExportSingleInternal(file)
    }
  }, [files, handleExportSingleInternal])

  useEffect(() => {
    const title = t('functions.video_extract_audio.title')
    registerProcessHandler(title, handleExportAll)
    return () => unregisterProcessHandler(title)
  }, [registerProcessHandler, unregisterProcessHandler, handleExportAll])

  const handleExportSingle = async (file: FileItem) => {
    await handleExportSingleInternal(file)
  }

  const updateFileFormat = (id: string, format: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, outputFormat: format } : f))
  }

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    if (playingFileId === id) {
      setPlayingFileId(null)
      setVideoUrl(null)
    }
  }

  const renderFileList = () => (
    <div className="flex-1 overflow-y-auto bg-[#0d0d1a]">
      {files.map(file => (
        <div 
          key={file.id} 
          className="flex items-center border-b border-[#1e2235] px-4 py-3 text-xs text-gray-300 hover:bg-white/5 group overflow-hidden"
        >
          <div className="flex-[2] min-w-[150px] flex items-center gap-2 truncate pr-2">
            <button 
              onClick={() => togglePlayFile(file)}
              className="p-1 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400 flex-shrink-0"
            >
              {playingFileId === file.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="flex-1 min-w-[80px] text-center text-gray-400 truncate px-2">{file.size}</div>
          <div className="flex-1 min-w-[100px] text-center text-gray-400 truncate px-2">{file.duration}</div>
          <div className="flex-1 min-w-[100px] text-center px-2">
            <div className="relative inline-block w-full max-w-[80px]">
              <select 
                value={file.outputFormat} 
                onChange={(e) => updateFileFormat(file.id, e.target.value)}
                className="w-full appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-xs text-white outline-none"
              >
                {outputFormats.map(fmt => (
                  <option key={fmt} value={fmt}>{fmt}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[80px] text-center px-2 truncate">
            {file.status === 'done' ? <span className="text-green-400">{t('functions.video_extract_audio.export_success')}</span> : 
             file.status === 'processing' ? <span className="text-blue-400">{t('functions.video_extract_audio.exporting')}</span> :
             file.status === 'error' ? <span className="text-red-400">{t('functions.video_extract_audio.export_failed')}</span> :
             <span className="text-gray-400">{t('functions.video_extract_audio.not_exported')}</span>}
          </div>
          <div className="flex-[2] min-w-[150px] flex items-center justify-center gap-3 md:gap-6 px-2">
            {file.status === 'done' ? (
              <button 
                onClick={() => openOutputFolder(outputPath)}
                className="text-blue-400 hover:text-blue-300 text-xs truncate"
              >
                {OPEN_FOLDER_TEXT}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => openCutModal(file)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white text-xs flex-shrink-0"
                >
                  <CutIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('functions.video_extract_audio.cut')}</span>
                </button>
                <button 
                  onClick={() => handleExportSingle(file)}
                  className="px-3 md:px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex-shrink-0"
                >
                  {t('functions.video_extract_audio.export')}
                </button>
              </>
            )}
            <button 
              onClick={() => removeFile(file.id)}
              className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
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
        accept="video/*,.mp4,.avi,.mkv,.mov,.wmv,.flv,.webm,.m4v,.mpeg,.mpg,.3gp,.ts"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept="video/*,.mp4,.avi,.mkv,.mov,.wmv,.flv,.webm,.m4v,.mpeg,.mpg,.3gp,.ts"
        className="hidden"
        onChange={handleFolderSelect}
        {...({ webkitdirectory: '', directory: '' } as any)}
      />

      {/* Video element for duration calculation */}
      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          onEnded={handleVideoEnded}
          className="hidden"
        />
      )}

      <div className="flex-1 flex flex-col p-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('common.add_file')}</span>
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t('common.add_folder')}</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs whitespace-nowrap">{t('functions.video_extract_audio.batch_export_format')}</span>
              <div className="relative">
                <select 
                  value={outputFormat} 
                  onChange={(e) => {
                    setOutputFormat(e.target.value)
                    setFiles(prev => prev.map(f => ({ ...f, outputFormat: e.target.value })))
                  }}
                  className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-xs text-white outline-none"
                >
                  {outputFormats.map(fmt => (
                    <option key={fmt} value={fmt}>{fmt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <button
              onClick={clearFiles}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.clear_list')}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#12121e] border border-[#1e2235] rounded-lg flex flex-col relative overflow-hidden">
          {/* Header */}
          <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400 font-medium">
            <div className="flex-[2] min-w-[150px] truncate pr-2">{t('common.file_name')}</div>
            <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.file_size')}</div>
            <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.file_duration')}</div>
            <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('functions.video_extract_audio.export_format')}</div>
            <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.file_status')}</div>
            <div className="flex-[2] min-w-[150px] text-center truncate px-2">{t('common.action')}</div>
          </div>

          {/* Content */}
          {files.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
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
                  <FileVideo className="w-10 h-10 text-blue-400/60" />
                </div>
                <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
                  <Play className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-gray-500 text-xs mb-3">
                {t('functions.video_replace_audio.drag_tip') || '拖拽视频文件至此处 或 点击添加视频'}
              </p>
              <div className="text-center px-6 max-w-lg">
                <p className="text-gray-600 text-[10px] leading-relaxed">
                  {t('functions.video_extract_audio.description')}
                </p>
              </div>
            </div>
          ) : (
            <div 
              className="flex-1 flex flex-col overflow-hidden"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {renderFileList()}
              {isDragging && (
                <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-b-lg flex items-center justify-center z-10 pointer-events-none">
                  <div className="text-blue-400 text-sm font-medium">{t('common.release_to_add')}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AudioCutModal
        isOpen={cutModalOpen}
        onClose={() => setCutModalOpen(false)}
        file={cutModalFile?.file || null}
        fileName={cutModalFile?.name || ''}
        duration={cutModalFile?.durationSeconds || 0}
        initialStartTime={cutModalFile?.cutStartTime}
        initialEndTime={cutModalFile?.cutEndTime}
        onConfirm={handleCutConfirm}
      />
    </div>
  )
}
