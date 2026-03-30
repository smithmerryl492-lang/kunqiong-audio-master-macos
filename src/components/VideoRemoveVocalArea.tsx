import {
  Plus,
  FolderPlus,
  Trash2,
  X,
  Play,
  Pause,
  CheckCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { removeVocalFromVideo, openFolder } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface VideoFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
  outputSize?: number
}

export default function VideoRemoveVocalArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<VideoFile[]>([])
  const [outputPath] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const { checkAndShowAuthCode, registerProcessHandler, unregisterProcessHandler } = useAppContext()

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(f.name)
    )
    addFiles(droppedFiles)
  }

  const addFiles = async (newFiles: File[]) => {
    const videoFiles: VideoFile[] = await Promise.all(
      newFiles.map(async (file) => ({
        id: Math.random().toString(36).substring(2, 11),
        file,
        name: file.name,
        size: file.size,
        duration: await getVideoDuration(file),
        status: 'pending' as const,
      }))
    )
    setFiles((prev) => [...prev, ...videoFiles])
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      const url = URL.createObjectURL(file)
      video.onloadedmetadata = () => {
        const prev = video.src
        const d = video.duration
        video.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        resolve(d)
      }
      video.onerror = () => {
        const prev = video.src
        video.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        resolve(0)
      }
      video.src = url
    })
  }


  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
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
      const selectedFiles = Array.from(e.target.files).filter((f) =>
        /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(f.name)
      )
      addFiles(selectedFiles)
    }
    e.target.value = ''
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (playingId === id) stopVideo()
  }

  const clearFiles = () => {
    stopVideo()
    setFiles([])
  }

  const playVideo = (file: VideoFile) => {
    if (playingId === file.id) {
      stopVideo()
      return
    }
    stopVideo()
    const url = URL.createObjectURL(file.file)
    setVideoUrl(url)
    setPlayingId(file.id)
    setTimeout(() => {
      videoRef.current?.play().catch(console.error)
    }, 100)
  }

  const stopVideo = () => {
    if (videoRef.current) {
      const prev = videoRef.current.src
      videoRef.current.pause()
      videoRef.current.currentTime = 0
      videoRef.current.src = ''
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    } else if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }
    setVideoUrl(null)
    setPlayingId(null)
  }

  const handleProcessAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error')
    for (const file of pendingFiles) {
      await handleProcessFileInternal(file.id)
    }
  }, [files])

  useEffect(() => {
    registerProcessHandler(t('functions.video_remove_vocal.title'), handleProcessAll)
    return () => unregisterProcessHandler(t('functions.video_remove_vocal.title'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

  const handleProcessFileInternal = async (fileId: string) => {
    const videoFile = files.find((f) => f.id === fileId)
    if (!videoFile) return

    // 检查授权码
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'processing' } : f))
    )

    try {
      const result = await removeVocalFromVideo(videoFile.file, outputPath)
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: 'completed',
                outputPath: result.output_path,
                outputSize: result.size,
              }
            : f
        )
      )
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : t('common.process_failed'),
              }
            : f
        )
      )
    }
  }

  const renderStatus = (file: VideoFile) => {
    switch (file.status) {
      case 'processing':
        return (
          <div className="flex items-center justify-center gap-1 text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t('common.processing')}</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center justify-center gap-1 text-green-400">
            <CheckCircle className="w-3 h-3" />
            <span>{t('common.status.done')}</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center justify-center gap-1 text-red-400" title={file.error}>
            <AlertCircle className="w-3 h-3" />
            <span>{t('common.status.error')}</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center justify-center gap-1 text-gray-400">
            <span className="w-3 h-3 rounded-full border border-gray-500 inline-block" />
            <span>{t('common.status.pending')}</span>
          </div>
        )
    }
  }


  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0a0a14]">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {videoUrl && (
        <video ref={videoRef} src={videoUrl} onEnded={stopVideo} className="hidden" />
      )}

      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('common.add_file')}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>{t('common.add_folder')}</span>
          </button>
        </div>
        <button
          onClick={clearFiles}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('common.clear_list')}</span>
        </button>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
        <div className="flex-1 min-w-[200px]">{t('common.file_name')}</div>
        <div className="w-32 text-center">{t('common.file_duration')}</div>
        <div className="w-28 text-center">{t('functions.video_remove_vocal.original_size')}</div>
        <div className="w-28 text-center">{t('functions.video_remove_vocal.output_size')}</div>
        <div className="w-24 text-center">{t('common.file_status')}</div>
        <div className="w-24 text-center">{t('common.action')}</div>
      </div>

      {/* File List / Drop Zone */}
      {files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 border border-dashed rounded-b-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-[#2a3a50] hover:border-[#3a4a60]'
          }`}
        >
          <div className="relative mb-4">
            <div className="w-20 h-16 bg-[#1a2a40] rounded-lg flex items-center justify-center border border-[#2a3a50]">
              <svg className="w-10 h-10 text-blue-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
              </svg>
            </div>
            <div className="absolute -right-2 -bottom-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <line x1="4" y1="4" x2="20" y2="20" />
              </svg>
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-2">{t('main.drag_tip')}</p>
          <p className="text-gray-600 text-[10px]">{t('functions.video_remove_vocal.description')}</p>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 overflow-auto bg-[#0d0d1a] border border-[#1e2235] rounded-b-lg"
        >
          {files.map((file) => (
            <div key={file.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e] text-xs">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 truncate">
                <button
                  onClick={() => playVideo(file)}
                  className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center flex-shrink-0"
                >
                  {playingId === file.id ? (
                    <Pause className="w-3 h-3 text-white" />
                  ) : (
                    <Play className="w-3 h-3 text-white ml-0.5" />
                  )}
                </button>
                <span className="truncate text-gray-300" title={file.name}>{file.name}</span>
              </div>
              <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
              <div className="w-28 text-center text-gray-400">{formatSize(file.size)}</div>
              <div className="w-28 text-center text-gray-400">
                {file.outputSize ? formatSize(file.outputSize) : '-'}
              </div>
              <div className="w-24 text-center">{renderStatus(file)}</div>
              <div className="w-24 text-center flex items-center justify-center gap-2">
                {file.status === 'completed' && file.outputPath ? (
                  <button
                    onClick={() => openOutputFolder(file.outputPath!)}
                    className="px-2 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                  >
                    {OPEN_FOLDER_TEXT}
                  </button>
                ) : (
                  <button
                    onClick={() => handleProcessFileInternal(file.id)}
                    disabled={file.status === 'processing'}
                    className={`px-3 py-1 rounded text-xs ${
                      file.status === 'pending' || file.status === 'error'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {file.status === 'processing' ? t('common.processing') : t('common.process')}
                  </button>
                )}
                <button onClick={() => removeFile(file.id)} className="text-gray-500 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
