import { Plus, FolderPlus, Trash2, X, CheckCircle, Loader2, AlertCircle, Image } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { addCover } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  coverFile?: File
  coverPreview?: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function AddCoverArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(f.name)
    )
    addFiles(droppedFiles)
  }

  const addFiles = async (newFiles: File[]) => {
    const audioFiles: AudioFile[] = await Promise.all(
      newFiles.map(async (file) => ({
        id: Math.random().toString(36).substring(2, 11),
        file,
        name: file.name,
        size: file.size,
        duration: await getAudioDuration(file),
        status: 'pending' as const
      }))
    )
    setFiles(prev => [...prev, ...audioFiles])
  }

  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      const objURL = URL.createObjectURL(file)
      audio.onloadedmetadata = () => {
        const d = audio.duration
        audio.src = ''
        URL.revokeObjectURL(objURL)
        resolve(d)
      }
      audio.onerror = () => {
        audio.src = ''
        URL.revokeObjectURL(objURL)
        resolve(0)
      }
      audio.src = objURL
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
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
      const selectedFiles = Array.from(e.target.files).filter(f =>
        f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(f.name)
      )
      addFiles(selectedFiles)
    }
    e.target.value = ''
  }

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedFileId) {
      const coverFile = e.target.files[0]
      const coverPreview = URL.createObjectURL(coverFile)
      setFiles(prev => prev.map(f =>
        f.id === selectedFileId ? { ...f, coverFile, coverPreview } : f
      ))
    }
    e.target.value = ''
    setSelectedFileId(null)
  }

  const removeFile = (id: string) => {
    const file = files.find(f => f.id === id)
    if (file?.coverPreview) URL.revokeObjectURL(file.coverPreview)
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearFiles = () => {
    files.forEach(f => f.coverPreview && URL.revokeObjectURL(f.coverPreview))
    setFiles([])
  }

  const openCoverSelector = (fileId: string) => {
    setSelectedFileId(fileId)
    coverInputRef.current?.click()
  }

  const { registerProcessHandler, unregisterProcessHandler, checkAndShowAuthCode } = useAppContext()

  const handleProcessAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' && f.coverFile)
    for (const file of pendingFiles) {
      await handleProcessFileInternal(file.id)
    }
  }, [files])

  useEffect(() => {
    registerProcessHandler(t('functions.add_cover'), handleProcessAll)
    return () => unregisterProcessHandler(t('functions.add_cover'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

  const handleProcessFileInternal = async (fileId: string) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    const audioFile = files.find(f => f.id === fileId)
    if (!audioFile || !audioFile.coverFile) return

    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f))

    try {
      const result = await addCover({
        audioFile: audioFile.file,
        coverImage: audioFile.coverFile,
        outputPath
      })

      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'completed', outputPath: result.output_path } : f
      ))
    } catch (error) {
      setFiles(prev => prev.map(f =>
        f.id === fileId ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('common.process_failed') } : f
      ))
    }
  }

  const renderStatus = (file: AudioFile) => {
    switch (file.status) {
      case 'processing':
        return <div className="flex items-center gap-1 text-blue-400"><Loader2 className="w-3 h-3 animate-spin" /><span>{t('common.processing')}</span></div>
      case 'completed':
        return <div className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" /><span>{t('common.status.done')}</span></div>
      case 'error':
        return <div className="flex items-center gap-1 text-red-400" title={file.error}><AlertCircle className="w-3 h-3" /><span>{t('common.status.error')}</span></div>
      default:
        return <div className="flex items-center gap-1 text-gray-400"><span className="w-3 h-3 rounded-full border border-gray-500 inline-block" /><span>{t('common.status.pending')}</span></div>
    }
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0a0a14]">
      <input ref={fileInputRef} type="file" accept="audio/*" multiple onChange={handleFileSelect} className="hidden" />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png" onChange={handleCoverSelect} className="hidden" />

      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500">
            <Plus className="w-3.5 h-3.5" /><span>{t('common.add_file')}</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors border border-blue-500">
            <FolderPlus className="w-3.5 h-3.5" /><span>{t('common.add_folder')}</span>
          </button>
        </div>
        <button onClick={clearFiles} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors">
          <Trash2 className="w-3.5 h-3.5" /><span>{t('common.clear_list')}</span>
        </button>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
        <div className="flex-1 min-w-[200px]">{t('common.file_name')}</div>
        <div className="w-32 text-center">{t('common.file_duration')}</div>
        <div className="w-28 text-center">{t('common.file_size')}</div>
        <div className="w-24 text-center">{t('add_cover.add_cover_label')}</div>
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
            isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a3a50] hover:border-[#3a4a60]'
          }`}
        >
          <div className="relative mb-4">
            <div className="w-20 h-16 bg-[#1a2a40] rounded-lg flex items-center justify-center border border-[#2a3a50]">
              <svg className="w-10 h-10 text-blue-400/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg">
              <Image className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-2">{t('main.drag_tip')}</p>
          <p className="text-gray-600 text-[10px]">{t('add_cover.mp3_tip')}</p>
        </div>
      ) : (
        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="flex-1 overflow-auto bg-[#0d0d1a] border border-[#1e2235] rounded-b-lg">
          {files.map((file) => (
            <div key={file.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e] text-xs">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 truncate">
                {/* 封面预览或默认图标 */}
                {file.coverPreview ? (
                  <img src={file.coverPreview} alt="cover" className="w-8 h-8 object-cover rounded flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-pink-500 rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  </div>
                )}
                <span className="truncate text-gray-300" title={file.name}>{file.name}</span>
              </div>
              <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
              <div className="w-28 text-center text-gray-400">{formatSize(file.size)}</div>
              <div className="w-24 text-center">
                <button 
                  onClick={() => openCoverSelector(file.id)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {t('add_cover.select_cover')}
                </button>
              </div>
              <div className="w-24 text-center">{renderStatus(file)}</div>
              <div className="w-24 text-center flex items-center justify-center gap-2">
                {file.status === 'completed' && file.outputPath ? (
                  <button 
                    onClick={() => openOutputFolder(file.outputPath!)}
                    className="px-3 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                  >
                    {OPEN_FOLDER_TEXT}
                  </button>
                ) : (
                  <button 
                    onClick={() => handleProcessFileInternal(file.id)}
                    disabled={file.status === 'processing' || !file.coverFile}
                    className={`px-3 py-1 rounded text-xs ${
                      file.status === 'pending' && file.coverFile
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {t('common.process')}
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
