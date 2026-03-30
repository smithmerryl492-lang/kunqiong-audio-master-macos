import { X, Play, Pause, CheckCircle, Loader2, AlertCircle, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { changeVoice, openFolder } from '../services/api'
import FileDropZone from './FileDropZone'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  preset: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

const PRESET_OPTIONS = [
  { id: 'low', name: t('voice.preset_low'), pitch: 0.7, speed: 1.0, emoji: '🔉' },
  { id: 'high', name: t('voice.preset_high'), pitch: 1.5, speed: 1.0, emoji: '🔊' },
  { id: 'old', name: t('voice.preset_old'), pitch: 0.85, speed: 0.92, emoji: '👴' },
  { id: 'robot', name: t('voice.preset_robot'), pitch: 1.0, speed: 1.0, emoji: '🤖' },
  { id: 'minion', name: t('voice.preset_minion'), pitch: 2.0, speed: 1.3, emoji: '😄' },
  { id: 'cartoon', name: t('voice.preset_cartoon'), pitch: 1.4, speed: 1.15, emoji: '🎭' },
  { id: 'echo', name: t('voice.preset_echo'), pitch: 1.0, speed: 1.0, emoji: '📢' },
  { id: 'underwater', name: t('voice.preset_underwater'), pitch: 0.9, speed: 0.95, emoji: '🌊' },
  { id: 'telephone', name: t('voice.preset_telephone'), pitch: 1.0, speed: 1.0, emoji: '📞' },
  { id: 'custom', name: t('voice.preset_custom'), pitch: 1.0, speed: 1.0, emoji: '⚙️' },
]

export default function VoiceChangeArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [tempPreset, setTempPreset] = useState('low')
  const [customSpeed, setCustomSpeed] = useState(1.0)
  const [customPitch, setCustomPitch] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [globalPreset, setGlobalPreset] = useState('low')
  const [showGlobalPresetDropdown, setShowGlobalPresetDropdown] = useState(false)
  const { registerProcessHandler, unregisterProcessHandler, checkAndShowAuthCode } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleProcessAll = useCallback(async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending' || f.status === 'error')
    for (const file of pendingFiles) {
      await handleProcessSingleInternal(file)
    }
  }, [files])

  // 注册处理函数到全局 Context
  useEffect(() => {
    registerProcessHandler(t('voice.title'), handleProcessAll)
    return () => unregisterProcessHandler(t('voice.title'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

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

  const addFiles = async (newFiles: File[]) => {
    const audioFiles: AudioFile[] = await Promise.all(
      newFiles.map(async (file) => ({
        id: Math.random().toString(36).substring(2, 11),
        file,
        name: file.name,
        size: file.size,
        duration: await getAudioDuration(file),
        preset: globalPreset,
        status: 'pending' as const,
      }))
    )
    setFiles((prev) => [...prev, ...audioFiles])
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

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
    if (playingId === id) stopAudio()
  }

  const clearFiles = () => {
    stopAudio()
    setFiles([])
  }

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      addFiles(newFiles)
    }
    e.target.value = ''
  }

  const getPresetName = (presetId: string) => {
    return PRESET_OPTIONS.find((p) => p.id === presetId)?.name || '低音'
  }

  const openPresetModal = (fileId: string) => {
    const file = files.find((f) => f.id === fileId)
    if (file) {
      setTempPreset(file.preset)
      const preset = PRESET_OPTIONS.find((p) => p.id === file.preset)
      if (preset) {
        setCustomSpeed(preset.speed)
        setCustomPitch(Math.round((preset.pitch - 1) * 10))
      }
    }
    setEditingFileId(fileId)
    setShowModal(true)
  }

  const selectPreset = (presetId: string) => {
    stopPreview()
    setTempPreset(presetId)
    const preset = PRESET_OPTIONS.find((p) => p.id === presetId)
    if (preset && presetId !== 'custom') {
      setCustomSpeed(preset.speed)
      setCustomPitch(Math.round((preset.pitch - 1) * 10))
    }
  }

  const closeModal = () => {
    stopPreview()
    setShowModal(false)
    setEditingFileId(null)
  }

  const applyPreset = () => {
    if (editingFileId) {
      setFiles((prev) =>
        prev.map((f) => (f.id === editingFileId ? { ...f, preset: tempPreset } : f))
      )
    }
    stopPreview()
    setShowModal(false)
    setEditingFileId(null)
  }

  const handlePreview = async () => {
    if (!editingFileId) return
    const file = files.find((f) => f.id === editingFileId)
    if (!file) return

    if (isPreviewing) {
      stopPreview()
      return
    }

    setIsPreviewing(true)

    try {
      const formData = new FormData()
      formData.append('file', file.file)
      formData.append('preset', tempPreset === 'custom' ? '' : tempPreset)
      formData.append('pitch', String(1 + customPitch / 10))
      formData.append('tempo', String(customSpeed))

      const response = await fetch('http://127.0.0.1:8001/api/voice/preview', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('预览失败')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(url)

      setTimeout(() => {
        previewAudioRef.current?.play().catch(console.error)
      }, 100)
    } catch (error) {
      console.error('Preview error:', error)
      alert('试听失败，请确保后端服务已启动')
      setIsPreviewing(false)
    }
  }

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setIsPreviewing(false)
  }

  const playAudio = (file: AudioFile) => {
    if (playingId === file.id) {
      stopAudio()
      return
    }
    stopAudio()
    const url = URL.createObjectURL(file.file)
    setAudioUrl(url)
    setPlayingId(file.id)
    setTimeout(() => {
      audioRef.current?.play().catch(console.error)
    }, 100)
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }
    setPlayingId(null)
  }

  const handleProcessSingleInternal = async (audioFile: AudioFile) => {
    // 检查授权码
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles((prev) => prev.map((f) => (f.id === audioFile.id ? { ...f, status: 'processing' as const } : f)))

    try {
      const preset = PRESET_OPTIONS.find((p) => p.id === audioFile.preset)
      const result = await changeVoice({
        file: audioFile.file,
        preset: audioFile.preset !== 'custom' ? audioFile.preset : '',
        pitch: preset?.pitch || 1.0,
        tempo: preset?.speed || 1.0,
      })

      setFiles((prev) =>
        prev.map((f) =>
          f.id === audioFile.id
            ? { ...f, status: 'completed' as const, outputPath: result.output_path }
            : f
        )
      )
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === audioFile.id
            ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : t('common.status.error') }
            : f
        )
      )
    }
  }

  const renderStatus = (file: AudioFile) => {
    switch (file.status) {
      case 'processing':
        return (
          <div className="flex items-center justify-center gap-1 text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t('common.status.converting')}</span>
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

  const renderFileList = () => (
    <div className="flex-1 overflow-auto bg-[#0d0d1a] border border-[#1e2235] rounded-b-lg">
      {files.map((file) => (
        <div key={file.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e] text-xs">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 truncate">
            <button
              onClick={() => playAudio(file)}
              className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center flex-shrink-0"
            >
              {playingId === file.id ? (
                <Pause className="w-3 h-3 text-white" />
              ) : (
                <Play className="w-3 h-3 text-white ml-0.5" />
              )}
            </button>
            <span className="truncate text-gray-300" title={file.name}>
              {file.name}
            </span>
          </div>
          <div className="w-28 text-center text-gray-400">{formatSize(file.size)}</div>
          <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
          <div className="w-24 text-center">
            <button
              onClick={() => openPresetModal(file.id)}
              className="text-blue-400 hover:text-blue-300 hover:underline"
            >
              {getPresetName(file.preset)}
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
                  openOutputFolder(folderPath || file.outputPath!)
                }}
                className="px-3 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                {OPEN_FOLDER_TEXT}
              </button>
            ) : (
              <button
                onClick={() => handleProcessSingleInternal(file)}
                disabled={file.status === 'processing'}
                className={`px-3 py-1 rounded text-xs ${
                  file.status === 'pending' || file.status === 'error'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {t('common.process') || '处理'}
              </button>
            )}
            <button onClick={() => removeFile(file.id)} className="text-gray-500 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0a0a14]">
      {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={stopAudio} />}
      {previewUrl && <audio ref={previewAudioRef} src={previewUrl} onEnded={stopPreview} />}

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

      {/* Button Bar */}
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
          <button
            onClick={clearFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('common.clear_list')}</span>
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
        <div className="flex-1 min-w-[200px]">{t('common.file_name') || '文件名'}</div>
        <div className="w-28 text-center">{t('common.size')}</div>
        <div className="w-32 text-center">{t('common.duration')}</div>
        <div className="w-24 text-center">{t('voice.title')}</div>
        <div className="w-24 text-center">{t('common.status_text') || '文件状态'}</div>
        <div className="w-24 text-center">{t('common.action') || '操作'}</div>
      </div>

      {/* File Drop Zone */}
      <FileDropZone
        onFilesAdded={addFiles}
        hasFiles={files.length > 0}
        showButtons={false}
        subDescription={t('voice.voice_tip')}
      >
        {renderFileList()}
      </FileDropZone>

      {/* Bottom Bar */}
      {files.length > 0 && (
        <div className="flex items-center mt-3 px-4 py-2 bg-[#12121e] border border-[#1e2235] rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{t('voice.select_voice') || '选择变声'}:</span>
            <div className="relative">
              <button
                onClick={() => setShowGlobalPresetDropdown(!showGlobalPresetDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1a2a40] border border-[#2a3a50] rounded text-xs text-gray-300 hover:border-blue-500 min-w-[100px]"
              >
                <span>{getPresetName(globalPreset)}</span>
                <svg className="w-3 h-3 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showGlobalPresetDropdown && (
                <div className="absolute bottom-full left-0 mb-1 w-32 bg-[#1a2a40] border border-[#2a3a50] rounded shadow-lg z-10 max-h-48 overflow-auto">
                  {PRESET_OPTIONS.filter((p) => p.id !== 'custom').map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setGlobalPreset(preset.id)
                        setFiles((prev) => prev.map((f) => ({ ...f, preset: preset.id })))
                        setShowGlobalPresetDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-xs hover:bg-[#2a3a50] flex items-center gap-2 ${
                        globalPreset === preset.id ? 'text-blue-400' : 'text-gray-300'
                      }`}
                    >
                      <span>{preset.emoji}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voice Preset Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1f2e] rounded-lg w-[680px] border border-[#2a3a50]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3a50]">
              <span className="text-white text-sm">选择变声</span>
              <button onClick={closeModal} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex">
              <div className="flex-1 p-4 max-h-[320px] overflow-auto">
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_OPTIONS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => selectPreset(preset.id)}
                      className={`flex flex-col items-center p-3 rounded-lg border transition-colors ${
                        tempPreset === preset.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-[#2a3a50] hover:border-[#3a4a60]'
                      }`}
                    >
                      <div className="w-14 h-14 mb-2 flex items-center justify-center bg-[#2a3a50] rounded-full">
                        <span className="text-2xl">{preset.emoji}</span>
                      </div>
                      <span className="text-xs text-gray-300">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-48 p-4 border-l border-[#2a3a50]">
                <div className="text-gray-400 text-xs mb-4">{t('voice.preset_custom')}</div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">{t('voice.speed')}:</span>
                    <span className="text-white text-xs">{customSpeed.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.01"
                    value={customSpeed}
                    onChange={(e) => {
                      setCustomSpeed(parseFloat(e.target.value))
                      setTempPreset('custom')
                    }}
                    className="w-full h-1 bg-[#2a3a50] rounded appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-xs">{t('voice.pitch')}:</span>
                    <span className="text-white text-xs">{customPitch}</span>
                  </div>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={customPitch}
                    onChange={(e) => {
                      setCustomPitch(parseInt(e.target.value))
                      setTempPreset('custom')
                    }}
                    className="w-full h-1 bg-[#2a3a50] rounded appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-4 py-3 border-t border-[#2a3a50]">
              <button
                onClick={handlePreview}
                disabled={isPreviewing && !previewUrl}
                className={`px-6 py-2 rounded text-sm flex items-center gap-2 ${
                  isPreviewing
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#2a3a50] hover:bg-[#3a4a60] text-gray-300'
                }`}
              >
                {isPreviewing && !previewUrl ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('common.processing')}
                  </>
                ) : isPreviewing ? (
                  <>
                    <Pause className="w-4 h-4" />
                    {t('voice.stop_preview')}
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    {t('voice.preview')}
                  </>
                )}
              </button>
              <button onClick={applyPreset} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
