import { Trash2, Play, Plus, FolderPlus } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { removeSilence, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import FileDropZone from './FileDropZone'
import BottomActionBar from './BottomActionBar'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  threshold: number
  minDuration: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function RemoveSilenceArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [editingFile, setEditingFile] = useState<AudioFile | null>(null)
  const [modalThreshold, setModalThreshold] = useState(10)
  const [modalMinDuration, setModalMinDuration] = useState(0.5)
  const { checkAndShowAuthCode } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getDefaultOutputPath().then(setOutputPath) }, [])

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
        id: Math.random().toString(36).substring(2, 9),
        file, name: file.name, size: file.size,
        duration: await getAudioDuration(file),
        threshold: 10, minDuration: 0.5, status: 'pending' as const
      }))
    )
    setFiles(prev => [...prev, ...audioFiles])
  }

  const handleClearList = () => setFiles([])
  const handleRemoveFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      addFiles(newFiles)
    }
    e.target.value = ''
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'MB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const openSettings = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return
    setEditingFile(file)
    setModalThreshold(file.threshold)
    setModalMinDuration(file.minDuration)
    setShowSettingsModal(true)
  }

  const confirmSettings = () => {
    if (editingFile) {
      setFiles(prev => prev.map(f => f.id === editingFile.id ? { ...f, threshold: modalThreshold, minDuration: modalMinDuration } : f))
    }
    setShowSettingsModal(false)
    setEditingFile(null)
  }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await removeSilence({ file: audioFile.file, threshold: audioFile.threshold, minDuration: audioFile.minDuration, outputPath: outputType === 'custom' ? outputPath : '' })
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'completed', outputPath: result.output_path } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('common.process_failed') } : f))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (pendingFiles.length === 0) return
    setIsProcessing(true)
    for (const file of pendingFiles) {
      await handleProcessSingle(file)
    }
    setIsProcessing(false)
  }

  const renderFileList = () => (
    <div className="flex-1 overflow-auto bg-[#0d0d1a]">
      {files.map(file => (
        <div key={file.id} className="flex items-center px-4 py-3 text-xs text-gray-300 border-b border-[#1e2235] hover:bg-[#12121e]">
          <div className="w-[200px] flex items-center gap-2">
            <button className="p-1 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400"><Play className="w-4 h-4" /></button>
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="w-24 text-center text-gray-400">{formatSize(file.size)}</div>
          <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
          <div className="w-24 text-center">
            <button onClick={() => openSettings(file.id)} className="text-blue-400 hover:text-blue-300 text-xs hover:underline">{t('common.settings')}</button>
          </div>
          <div className="w-28 text-center">
            {file.status === 'completed' ? <span className="text-green-400">{t('common.status.done')}</span>
              : file.status === 'processing' ? <span className="text-blue-400">{t('common.processing')}...</span>
              : file.status === 'error' ? <span className="text-red-400" title={file.error}>{t('common.status.error')}</span>
              : <span className="text-gray-400">⊙{t('common.status.pending')}</span>}
          </div>
          <div className="flex-1 flex items-center justify-center gap-4">
            {file.status === 'completed' ? (
              <button onClick={() => file.outputPath && openOutputFolder(file.outputPath)} className="text-blue-400 hover:text-blue-300 text-xs">{OPEN_FOLDER_TEXT}</button>
            ) : file.status === 'processing' ? (
              <span className="text-gray-500 text-xs">{t('common.processing')}</span>
            ) : (
              <button onClick={() => handleProcessSingle(file)} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">{t('common.process')}</button>
            )}
            <button onClick={() => handleRemoveFile(file.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a14]">
      <div className="flex-1 flex flex-col p-3">
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
              onClick={handleClearList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.clear_list')}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
          <div className="w-[200px]">{t('common.file_name')}</div>
          <div className="w-24 text-center">{t('common.file_size')}</div>
          <div className="w-32 text-center">{t('common.file_duration')}</div>
          <div className="w-24 text-center">{t('remove_silence.title')}</div>
          <div className="w-28 text-center">{t('common.file_status')}</div>
          <div className="flex-1 text-center">{t('common.action')}</div>
        </div>

        <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('remove_silence.description')}>
          {renderFileList()}
        </FileDropZone>
      </div>

      <BottomActionBar
        outputPath={outputPath}
        setOutputPath={setOutputPath}
        outputType={outputType}
        setOutputType={setOutputType}
        onProcessAll={handleProcessAll}
        isProcessing={isProcessing}
        disabled={files.length === 0}
      />

      {/* 设置弹窗 */}
      {showSettingsModal && editingFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1f2e] rounded-lg w-[480px] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3040]">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
                  <div className="w-1 h-5 bg-blue-500 rounded-sm"></div>
                  <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
                  <div className="w-1 h-5 bg-blue-500 rounded-sm ml-0.5"></div>
                </div>
                <span className="text-white text-sm font-medium">{t('remove_silence.title')}</span>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-gray-300 text-sm w-28">{t('remove_silence.threshold')}</span>
                <input type="number" value={modalThreshold} onChange={(e) => setModalThreshold(parseInt(e.target.value) || 10)} min="0" max="100"
                  className="w-20 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-sm text-white outline-none text-center" />
                <span className="text-gray-400 text-sm">{t('remove_silence.db_range')}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-gray-300 text-sm w-28">{t('remove_silence.min_duration')}</span>
                <input type="number" value={modalMinDuration} onChange={(e) => setModalMinDuration(parseFloat(e.target.value) || 0.5)} min="0.1" max="10" step="0.1"
                  className="w-20 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-sm text-white outline-none text-center" />
                <span className="text-gray-400 text-sm">{t('remove_silence.seconds')}</span>
              </div>
            </div>
            <div className="flex gap-4 px-6 py-5">
              <button onClick={() => setShowSettingsModal(false)} className="flex-1 py-3 bg-transparent border border-[#3a4050] hover:bg-[#2a3040] text-white rounded text-sm">{t('settings.cancel')}</button>
              <button onClick={confirmSettings} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">{t('settings.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
