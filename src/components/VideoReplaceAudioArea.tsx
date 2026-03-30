import { Plus, FolderPlus, Trash2, FileVideo, X, CheckCircle, Loader2, AlertCircle, FolderOpen, Music, Volume2, Play } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { replaceVideoAudio, selectDirectory, openFolder } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface VideoFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  audioFile?: File
  audioName?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function VideoReplaceAudioArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<VideoFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(false)
  const [audioVolume, setAudioVolume] = useState(1.0)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const { checkAndShowAuthCode, registerProcessHandler, unregisterProcessHandler } = useAppContext()

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('video/') || /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(f.name)
    )
    addFiles(droppedFiles)
  }

  const addFiles = async (newFiles: File[]) => {
    const videoFiles: VideoFile[] = await Promise.all(
      newFiles.map(async (file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        size: file.size,
        duration: await getVideoDuration(file),
        status: 'pending' as const
      }))
    )
    setFiles(prev => [...prev, ...videoFiles])
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const objURL = URL.createObjectURL(file)
      video.onloadedmetadata = () => {
        const d = video.duration
        URL.revokeObjectURL(objURL)
        video.src = ''
        resolve(d)
      }
      video.onerror = () => {
        URL.revokeObjectURL(objURL)
        video.src = ''
        resolve(0)
      }
      video.src = objURL
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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
      const selectedFiles = Array.from(e.target.files).filter(f =>
        f.type.startsWith('video/') || /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(f.name)
      )
      addFiles(selectedFiles)
    }
    e.target.value = ''
  }

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedFileId) {
      const audioFile = e.target.files[0]
      setFiles(prev => prev.map(f =>
        f.id === selectedFileId ? { ...f, audioFile, audioName: audioFile.name } : f
      ))
    }
    e.target.value = ''
    setSelectedFileId(null)
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))
  const clearFiles = () => setFiles([])

  const selectOutputPath = async () => {
    try {
      const result = await selectDirectory(outputPath)
      if (result.success && result.path) setOutputPath(result.path)
    } catch (error) {
      console.error(t('footer.select_dir_failed'), error)
    }
  }

  const openAudioSelector = (fileId: string) => {
    setSelectedFileId(fileId)
    audioInputRef.current?.click()
  }

  const handleProcessAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' && f.audioFile)
    for (const file of pendingFiles) {
      await handleProcessSingleInternal(file)
    }
  }, [files])

  useEffect(() => {
    registerProcessHandler(t('functions.video_replace_audio.title'), handleProcessAll)
    return () => unregisterProcessHandler(t('functions.video_replace_audio.title'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

  const handleProcess = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const pendingFiles = files.filter(f => f.status === 'pending' && f.audioFile)
    if (pendingFiles.length === 0) return

    setIsProcessing(true)

    for (const videoFile of pendingFiles) {
      setFiles(prev => prev.map(f => f.id === videoFile.id ? { ...f, status: 'processing' } : f))

      try {
        const result = await replaceVideoAudio({
          videoFile: videoFile.file,
          audioFile: videoFile.audioFile!,
          keepOriginalAudio,
          audioVolume,
          outputPath
        })

        setFiles(prev => prev.map(f =>
          f.id === videoFile.id ? { ...f, status: 'completed', outputPath: result.output_path } : f
        ))
      } catch (error) {
        setFiles(prev => prev.map(f =>
          f.id === videoFile.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('functions.video_replace_audio.replace_failed') } : f
        ))
      }
    }

    setIsProcessing(false)
  }

  const handleOpenFolder = async (path: string) => {
    try {
      const dir = path.substring(0, Math.max(
        path.lastIndexOf('\\'),
        path.lastIndexOf('/')
      ))
      await openOutputFolder(dir || path)
    } catch (error) {
      console.error(t('footer.open_folder_failed'), error)
    }
  }

  const renderStatus = (file: VideoFile) => {
    switch (file.status) {
      case 'processing':
        return <span className="text-blue-400 text-xs">{t('common.processing')}</span>
      case 'completed':
        return <span className="text-green-400 text-xs">{t('common.status.done')}</span>
      case 'error':
        return <span className="text-red-400 text-xs" title={file.error}>{t('common.status.error')}</span>
      default:
        return <span className="text-gray-400 text-xs">⊙{t('common.status.pending')}</span>
    }
  }

  // 处理单个文件
  const handleProcessSingleInternal = async (videoFile: VideoFile) => {
    if (!videoFile.audioFile) {
      alert(t('functions.video_replace_audio.select_audio_first'))
      return
    }

    // 检查授权码
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === videoFile.id ? { ...f, status: 'processing' } : f))

    try {
      const result = await replaceVideoAudio({
        videoFile: videoFile.file,
        audioFile: videoFile.audioFile,
        keepOriginalAudio,
        audioVolume,
        outputPath
      })

      setFiles(prev => prev.map(f =>
        f.id === videoFile.id ? { ...f, status: 'completed', outputPath: result.output_path } : f
      ))
    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === videoFile.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('functions.video_replace_audio.replace_failed') } : f
      ))
    }
  }

  const canProcess = files.some(f => f.status === 'pending' && f.audioFile)

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0a0a14]">
      <input ref={fileInputRef} type="file" accept="video/*" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />

      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500">
            <Plus className="w-3.5 h-3.5" /><span>{t('common.add_file')}</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-xs transition-colors border border-[#2a3a50]">
            <FolderPlus className="w-3.5 h-3.5" /><span>{t('common.add_folder')}</span>
          </button>
        </div>
        <button onClick={clearFiles} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors">
          <Trash2 className="w-3.5 h-3.5" /><span>{t('common.clear_list')}</span>
        </button>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
        <div className="w-[220px]">{t('common.file_name')}</div>
        <div className="w-28 text-center">{t('common.file_size')}</div>
        <div className="w-32 text-center">{t('common.file_duration')}</div>
        <div className="w-32 text-center">{t('functions.video_replace_audio.title')}</div>
        <div className="w-28 text-center">{t('common.file_status')}</div>
        <div className="flex-1 text-center">{t('common.action')}</div>
      </div>

      {/* File List / Drop Zone */}
      {files.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 border border-dashed rounded-b-lg flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a3a50] hover:border-[#3a4a60]'
          }`}
        >
          <div className="relative mb-4">
            <div className="w-20 h-16 bg-[#1a2a40] rounded-lg flex items-center justify-center border border-[#2a3a50]">
              <FileVideo className="w-10 h-10 text-blue-400/60" />
            </div>
            <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
              <Music className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-2">{t('functions.video_replace_audio.drag_tip')}</p>
          <p className="text-gray-600 text-[10px]">{t('functions.video_replace_audio.description')}</p>
        </div>
      ) : (
        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="flex-1 overflow-auto bg-[#0d0d1a]">
          {files.map((file) => (
            <div key={file.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e] text-xs">
              {/* 文件名 */}
              <div className="w-[220px] flex items-center gap-2">
                <button className="p-1 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400">
                  <Play className="w-4 h-4" />
                </button>
                <span className="truncate text-gray-300" title={file.name}>{file.name}</span>
              </div>
              {/* 文件大小 */}
              <div className="w-28 text-center text-gray-400">{formatSize(file.size)}</div>
              {/* 文件时长 */}
              <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
              {/* 替换音频 */}
              <div className="w-32 text-center">
                {file.audioName ? (
                  <span className="text-green-400 text-xs truncate block" title={file.audioName}>
                    {file.audioName.length > 12 ? file.audioName.slice(0, 12) + '...' : file.audioName}
                  </span>
                ) : (
                  <button onClick={() => openAudioSelector(file.id)} className="text-blue-400 hover:text-blue-300 text-xs hover:underline">{t('functions.video_replace_audio.select_audio')}</button>
                )}
              </div>
              {/* 文件状态 */}
              <div className="w-28 text-center">{renderStatus(file)}</div>
              {/* 操作 */}
              <div className="flex-1 text-center">
                {file.status === 'completed' ? (
                  <button
                    onClick={() => file.outputPath && openOutputFolder(file.outputPath)}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    {OPEN_FOLDER_TEXT}
                  </button>
                ) : file.status === 'processing' ? (
                  <span className="text-gray-500 text-xs">{t('common.processing')}</span>
                ) : (
                  <button
                    onClick={() => handleProcessSingleInternal(file)}
                    disabled={!file.audioFile}
                    className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded text-xs"
                  >
                    {t('common.process')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


    </div>
  )
}
