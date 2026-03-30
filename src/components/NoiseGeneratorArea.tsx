import { Plus, FolderPlus, Trash2, FileAudio, X, CheckCircle, Loader2, AlertCircle, Play, Pause } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { addNoise } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  noiseType: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

const NOISE_TYPES = [
  { id: 'white', name: t('noise.types.white') },
  { id: 'pink', name: t('noise.types.pink') },
  { id: 'brown', name: t('noise.types.brown') },
  { id: 'blue', name: t('noise.types.blue') },
]

export default function NoiseGeneratorArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath] = useState('')
  const [showNoiseModal, setShowNoiseModal] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [tempNoiseType, setTempNoiseType] = useState('white')
  const [tempTimeMode, setTempTimeMode] = useState<'full' | 'partial'>('full')
  const [tempStartTime, setTempStartTime] = useState(0)
  const [tempEndTime, setTempEndTime] = useState(0)
  const [modalPlaying, setModalPlaying] = useState(false)
  const [modalCurrentTime, setModalCurrentTime] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const modalAudioRef = useRef<HTMLAudioElement>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const { checkAndShowAuthCode, registerProcessHandler, unregisterProcessHandler } = useAppContext()

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
      newFiles.map(async (file) => {
        const duration = await getAudioDuration(file)
        return {
          id: Math.random().toString(36).substring(2, 11),
          file,
          name: file.name,
          size: file.size,
          duration,
          noiseType: 'white',
          status: 'pending' as const
        }
      })
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

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))
  const clearFiles = () => setFiles([])

  const openNoiseSettings = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (file) {
      setTempNoiseType(file.noiseType)
      setTempTimeMode('full')
      setTempStartTime(0)
      setTempEndTime(file.duration)
      setModalCurrentTime(0)
      setModalPlaying(false)
      // 预加载音频
      if (modalAudioRef.current) {
        const prev = modalAudioRef.current.src
        modalAudioRef.current.pause()
        modalAudioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        modalAudioRef.current.src = URL.createObjectURL(file.file)
        modalAudioRef.current.load()
      }
    }
    setEditingFileId(fileId)
    setShowNoiseModal(true)
  }

  const confirmNoiseSettings = () => {
    if (editingFileId) {
      setFiles(prev => prev.map(f => f.id === editingFileId ? { ...f, noiseType: tempNoiseType } : f))
    }
    setShowNoiseModal(false)
    setEditingFileId(null)
  }

  const cancelNoiseSettings = () => {
    if (modalAudioRef.current) {
      modalAudioRef.current.pause()
      const prev = modalAudioRef.current.src
      modalAudioRef.current.src = ''
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
    }
    setShowNoiseModal(false)
    setEditingFileId(null)
    setModalPlaying(false)
    setModalCurrentTime(0)
  }

  const getEditingFile = () => files.find(f => f.id === editingFileId)

  const toggleModalPlay = () => {
    const file = getEditingFile()
    if (!file || !modalAudioRef.current) return

    if (modalPlaying) {
      modalAudioRef.current.pause()
      setModalPlaying(false)
    } else {
      // 如果当前时间不在选定范围内，从开始时间播放
      const currentTime = modalAudioRef.current.currentTime
      if (currentTime < tempStartTime || currentTime >= tempEndTime) {
        modalAudioRef.current.currentTime = tempStartTime
        setModalCurrentTime(tempStartTime)
      }
      modalAudioRef.current.play().then(() => {
        setModalPlaying(true)
      }).catch(err => {
        console.error(t('noise.play_failed'), err)
      })
    }
  }

  const handleModalTimeUpdate = () => {
    if (modalAudioRef.current) {
      const time = modalAudioRef.current.currentTime
      setModalCurrentTime(time)
      // 如果超过结束时间，停止播放并回到开始时间
      if (tempTimeMode === 'partial' && time >= tempEndTime && modalPlaying) {
        modalAudioRef.current.pause()
        modalAudioRef.current.currentTime = tempStartTime
        setModalCurrentTime(tempStartTime)
        setModalPlaying(false)
      }
    }
  }

  const handleModalSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setModalCurrentTime(time)
    if (modalAudioRef.current) {
      modalAudioRef.current.currentTime = time
    }
  }

  const setCurrentAsStart = () => {
    setTempStartTime(modalCurrentTime)
  }

  const setCurrentAsEnd = () => {
    setTempEndTime(modalCurrentTime)
  }

  const handleProcessAll = useCallback(async () => {
    const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error')
    for (const file of pendingFiles) {
      await handleProcessFileInternal(file.id)
    }
  }, [files])

  useEffect(() => {
    registerProcessHandler(t('functions.noise_generator'), handleProcessAll)
    return () => unregisterProcessHandler(t('functions.noise_generator'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

  const handleProcessFileInternal = async (fileId: string) => {
    const audioFile = files.find(f => f.id === fileId)
    if (!audioFile) return

    // 检查授权码
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f))

    try {
      const result = await addNoise({
        file: audioFile.file,
        startTime: 0,
        endTime: audioFile.duration,
        noiseType: audioFile.noiseType,
        noiseVolume: 0.5,
        replaceAudio: true,
        outputFormat: 'mp3',
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

  const togglePlay = (file: AudioFile) => {
    if (playingId === file.id) {
      if (audioRef.current) {
        audioRef.current.pause()
        const prev = audioRef.current.src
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      }
      setPlayingId(null)
    } else {
      if (audioRef.current) {
        const prev = audioRef.current.src
        audioRef.current.pause()
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        audioRef.current.src = URL.createObjectURL(file.file)
        audioRef.current.onended = () => {
          const cur = audioRef.current?.src || ''
          if (audioRef.current) {
            audioRef.current.src = ''
          }
          if (cur && cur.startsWith('blob:')) URL.revokeObjectURL(cur)
        }
        audioRef.current.play()
        setPlayingId(file.id)
      }
    }
  }

  const getNoiseTypeName = (type: string) => {
    return NOISE_TYPES.find(t => t.id === type)?.name || t('noise.types.white')
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
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      <audio ref={modalAudioRef} onTimeUpdate={handleModalTimeUpdate} onEnded={() => {
        setModalPlaying(false)
        const cur = modalAudioRef.current?.src || ''
        if (modalAudioRef.current) {
          modalAudioRef.current.src = ''
        }
        if (cur && cur.startsWith('blob:')) URL.revokeObjectURL(cur)
      }} />

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
        <div className="w-28 text-center">{t('common.file_size')}</div>
        <div className="w-32 text-center">{t('common.file_duration')}</div>
        <div className="w-24 text-center">{t('noise.noise_settings')}</div>
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
              <FileAudio className="w-10 h-10 text-gray-400/60" />
            </div>
            <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white text-xs font-bold">~</span>
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-2">{t('main.drag_tip')}</p>
          <p className="text-gray-600 text-[10px]">{t('noise.description')}</p>
        </div>
      ) : (
        <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className="flex-1 overflow-auto bg-[#0d0d1a] border border-[#1e2235] rounded-b-lg">
          {files.map((file) => (
            <div key={file.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e] text-xs">
              <div className="flex-1 min-w-[200px] flex items-center gap-2 truncate">
                <button onClick={() => togglePlay(file)} className="text-gray-400 hover:text-white">
                  {playingId === file.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <span className="truncate text-gray-300" title={file.name}>{file.name}</span>
              </div>
              <div className="w-28 text-center text-gray-400">{formatSize(file.size)}</div>
              <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
              <div className="w-24 text-center">
                <button 
                  onClick={() => openNoiseSettings(file.id)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {getNoiseTypeName(file.noiseType)}
                </button>
              </div>
              <div className="w-24 text-center">{renderStatus(file)}</div>
              <div className="w-24 text-center flex items-center justify-center gap-2">
                {file.status === 'completed' && file.outputPath ? (
                  <button 
                    onClick={() => {
                      const folderPath = file.outputPath!.substring(0, Math.max(
                        file.outputPath!.lastIndexOf('\\'),
                        file.outputPath!.lastIndexOf('/')
                      ))
                      import('../utils/audioUtils').then(utils => utils.openOutputFolder(folderPath || file.outputPath!))
                    }}
                    className="px-3 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                  >
                    {t('main.open_folder')}
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

      {/* Noise Settings Modal */}
      {showNoiseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#2a3142] rounded-lg w-[480px] border border-[#3a4a60]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#3a4a60]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <div className="w-1 h-4 bg-blue-500 rounded" />
                  <div className="w-1 h-6 bg-blue-500 rounded" />
                  <div className="w-1 h-4 bg-blue-500 rounded" />
                </div>
                <span className="text-white text-sm font-medium">{t('noise.advanced_settings')}</span>
              </div>
              <button onClick={cancelNoiseSettings} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* 噪音类型 */}
              <div className="flex items-center gap-4 mb-8">
                <span className="text-white text-base font-medium">{t('noise.noise_type')}</span>
                <select
                  value={tempNoiseType}
                  onChange={(e) => setTempNoiseType(e.target.value)}
                  className="bg-transparent border border-[#4a5568] rounded px-4 py-2 text-gray-300 text-sm min-w-[140px] outline-none focus:border-blue-500"
                >
                  {NOISE_TYPES.map(type => (
                    <option key={type.id} value={type.id} className="bg-[#2a3142]">{type.name}</option>
                  ))}
                </select>
              </div>

              {/* 生效时间段 */}
              <div className="mb-6">
                <h4 className="text-white text-base font-medium mb-4">{t('noise.effective_time')}</h4>
                <div className="space-y-4">
                  {/* 整段音频选项 */}
                  <label className="flex items-center gap-3 cursor-pointer" onClick={() => setTempTimeMode('full')}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      tempTimeMode === 'full' ? 'border-blue-500 bg-blue-500' : 'border-gray-500'
                    }`}>
                      {tempTimeMode === 'full' && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className="text-gray-300 text-sm">{t('noise.full_audio')}</span>
                  </label>
                  
                  {/* 部分时间段选项 */}
                  <div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-3 cursor-pointer" onClick={() => setTempTimeMode('partial')}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          tempTimeMode === 'partial' ? 'border-blue-500 bg-blue-500' : 'border-gray-500'
                        }`}>
                          {tempTimeMode === 'partial' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span className="text-gray-300 text-sm">{t('noise.partial_time')}</span>
                      </label>
                      
                      {/* 播放按钮、进度条、时间显示 */}
                      {tempTimeMode === 'partial' && (
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={toggleModalPlay}
                            className="w-8 h-8 rounded-full border border-gray-500 flex items-center justify-center text-gray-400 hover:text-white hover:border-white"
                          >
                            {modalPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max={getEditingFile()?.duration || 0}
                            step="0.001"
                            value={modalCurrentTime}
                            onChange={handleModalSeek}
                            className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                          />
                          <span className="text-gray-400 text-sm min-w-[90px]">{formatDuration(modalCurrentTime)}</span>
                        </div>
                      )}
                    </div>

                    {/* 开始时间和结束时间输入 */}
                    {tempTimeMode === 'partial' && (
                      <div className="mt-6 ml-8 space-y-4">
                        {/* 开始时间 */}
                        <div className="flex items-center gap-3">
                          <span className="text-gray-300 text-sm w-16">{t('noise.start_time')}</span>
                          <input
                            type="text"
                            value={formatDuration(tempStartTime)}
                            onChange={(e) => {
                              const parts = e.target.value.split(/[:.]/)
                              if (parts.length >= 4) {
                                const h = parseInt(parts[0]) || 0
                                const m = parseInt(parts[1]) || 0
                                const s = parseInt(parts[2]) || 0
                                const ms = parseInt(parts[3]) || 0
                                setTempStartTime(h * 3600 + m * 60 + s + ms / 1000)
                              }
                            }}
                            className="w-32 bg-transparent border border-[#4a5568] rounded px-3 py-1.5 text-sm text-gray-300 text-center outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={setCurrentAsStart}
                            className="text-gray-400 hover:text-white"
                            title={t('noise.use_current_time')}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>

                        {/* 结束时间 */}
                        <div className="flex items-center gap-3">
                          <span className="text-gray-300 text-sm w-16">{t('noise.end_time')}</span>
                          <input
                            type="text"
                            value={formatDuration(tempEndTime)}
                            onChange={(e) => {
                              const parts = e.target.value.split(/[:.]/)
                              if (parts.length >= 4) {
                                const h = parseInt(parts[0]) || 0
                                const m = parseInt(parts[1]) || 0
                                const s = parseInt(parts[2]) || 0
                                const ms = parseInt(parts[3]) || 0
                                setTempEndTime(h * 3600 + m * 60 + s + ms / 1000)
                              }
                            }}
                            className="w-32 bg-transparent border border-[#4a5568] rounded px-3 py-1.5 text-sm text-gray-300 text-center outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={setCurrentAsEnd}
                            className="text-gray-400 hover:text-white"
                            title={t('noise.use_current_time')}
                          >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-4 px-6 py-5 border-t border-[#3a4a60]">
              <button
                onClick={cancelNoiseSettings}
                className="px-10 py-2.5 border border-[#4a5568] text-gray-300 rounded text-sm hover:bg-[#3a4a60]"
              >
                {t('settings.cancel')}
              </button>
              <button
                onClick={confirmNoiseSettings}
                className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                {t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
