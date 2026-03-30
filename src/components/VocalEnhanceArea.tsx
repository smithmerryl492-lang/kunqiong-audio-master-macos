import { Play, Loader2, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { enhanceVocal, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import FileDropZone from './FileDropZone'
import BottomActionBar from './BottomActionBar'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface FileItem {
  id: string
  file: File
  name: string
  duration: string
  size: string
  gain: number
  status: 'waiting' | 'processing' | 'done' | 'error'
  outputPath?: string
  error?: string
}

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + 'B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
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

const getPresetFromGain = (gain: number): string => {
  if (gain <= -6) return 'light'
  if (gain <= 0) return 'medium'
  if (gain <= 6) return 'strong'
  return 'podcast'
}

export default function VocalEnhanceArea() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [globalGain, setGlobalGain] = useState(0)
  const { registerProcessHandler, unregisterProcessHandler, checkAndShowAuthCode } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { getDefaultOutputPath().then(setOutputPath) }, [])

  const addFiles = useCallback(async (newFiles: File[]) => {
    const audioFiles = newFiles.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(f.name))
    const items: FileItem[] = []
    for (const file of audioFiles) {
      const duration = await getAudioDuration(file)
      items.push({ id: Math.random().toString(36).substring(2, 9), file, name: file.name, duration: formatDuration(duration), size: formatSize(file.size), gain: 0, status: 'waiting' })
    }
    setFiles(prev => [...prev, ...items])
  }, [])

  const clearFiles = useCallback(() => setFiles([]), [])
  const updateFileGain = useCallback((id: string, gain: number) => { setFiles(prev => prev.map(f => f.id === id ? { ...f, gain } : f)) }, [])

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      addFiles(newFiles)
    }
    e.target.value = ''
  }

  const handleProcessSingle = useCallback(async (fileItem: FileItem) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await enhanceVocal({ file: fileItem.file, preset: getPresetFromGain(fileItem.gain), eq1000: fileItem.gain, outputPath: outputType === 'custom' ? outputPath : '' })
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'done', outputPath: result.output_path, size: formatSize(result.size) } : f))
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error', error: err instanceof Error ? err.message : t('common.process_failed') } : f))
    }
  }, [checkAndShowAuthCode, outputType, outputPath])

  const handleProcessAll = useCallback(async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    if (files.length === 0) return
    setIsProcessing(true)
    const waitingFiles = files.filter(f => f.status === 'waiting' || f.status === 'error')
    for (const fileItem of waitingFiles) { await handleProcessSingle(fileItem) }
    setIsProcessing(false)
  }, [checkAndShowAuthCode, files, handleProcessSingle])

  useEffect(() => {
    registerProcessHandler(t('functions.vocal_enhance.title'), handleProcessAll)
    return () => unregisterProcessHandler(t('functions.vocal_enhance.title'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

  const handleOpenSingleFolder = async (filePath: string) => {
    await openOutputFolder(filePath)
  }

  const renderFileList = () => (
    <div className="flex-1 overflow-auto border border-[#2a3a50] rounded-b-lg">
      {files.map((item) => (
        <div key={item.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e]">
          <div className="w-8"><Play className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" /></div>
          <div className="flex-1 min-w-[150px] text-white text-xs truncate" title={item.name}>{item.name}</div>
          <div className="w-28 text-center text-gray-400 text-xs">{item.duration}</div>
          <div className="w-24 text-center text-gray-400 text-xs">{item.size}</div>
          <div className="w-48 flex items-center justify-center gap-2">
            <input type="range" min="-12" max="12" value={item.gain} onChange={(e) => updateFileGain(item.id, Number(e.target.value))}
              className="w-24 h-1 bg-[#2a3a50] rounded-lg appearance-none cursor-pointer accent-blue-500" />
            <div className="flex items-center gap-1">
              <input type="number" min="-12" max="12" value={item.gain} onChange={(e) => updateFileGain(item.id, Number(e.target.value))}
                className="w-12 bg-[#1a1a2e] text-white text-xs px-1 py-0.5 rounded border border-[#2a3a50] text-center" />
              <span className="text-gray-400 text-xs">dB</span>
            </div>
          </div>
          <div className="w-24 text-center">
            {item.status === 'waiting' && <span className="text-gray-400 text-xs">⊙{t('common.status.pending')}</span>}
            {item.status === 'processing' && <span className="text-blue-400 text-xs flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t('common.processing')}</span>}
            {item.status === 'done' && <span className="text-green-400 text-xs">✓{t('common.status.done')}</span>}
            {item.status === 'error' && <span className="text-red-400 text-xs" title={item.error}>✗{t('common.status.error')}</span>}
          </div>
          <div className="w-20 flex justify-center gap-1">
            {item.status === 'done' && item.outputPath ? (
              <button onClick={() => handleOpenSingleFolder(item.outputPath!)} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded">{OPEN_FOLDER_TEXT}</button>
            ) : (
              <button onClick={() => handleProcessSingle(item)} disabled={item.status === 'processing'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded">{t('common.process')}</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#0a0a14]">
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
      <div className="flex items-center justify-between mb-3">
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
        <button
          onClick={clearFiles}
          className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('common.clear_list')}</span>
        </button>
      </div>

      {/* 表头 */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
        <div className="w-8"></div>
        <div className="flex-1 min-w-[150px]">{t('common.file_name')}</div>
        <div className="w-28 text-center">{t('common.file_duration')}</div>
        <div className="w-24 text-center">{t('common.file_size')}</div>
        <div className="w-48 text-center">{t('functions.vocal_enhance.gain_range')}</div>
        <div className="w-24 text-center">{t('common.file_status')}</div>
        <div className="w-20 text-center">{t('common.action')}</div>
      </div>

      <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('functions.vocal_enhance.description')}>
        {renderFileList()}
      </FileDropZone>

      {/* 底部全局增益控制 */}
      {files.length > 0 && (
        <div className="flex items-center mt-3 pt-3 border-t border-[#1e2235] px-3">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{t('functions.vocal_enhance.gain_range')}:</span>
            <input type="range" min="-12" max="12" value={globalGain}
              onChange={(e) => { const val = Number(e.target.value); setGlobalGain(val); setFiles(prev => prev.map(f => ({ ...f, gain: val }))) }}
              className="w-32 h-1 bg-[#2a3a50] rounded-lg appearance-none cursor-pointer accent-blue-500" />
            <div className="flex items-center gap-1">
              <input type="number" min="-12" max="12" value={globalGain}
                onChange={(e) => { const val = Number(e.target.value); setGlobalGain(val); setFiles(prev => prev.map(f => ({ ...f, gain: val }))) }}
                className="w-14 bg-[#1a1a2e] text-white text-xs px-2 py-1 rounded border border-[#2a3a50] text-center" />
              <span className="text-gray-400 text-xs">dB</span>
            </div>
          </div>
        </div>
      )}

      <BottomActionBar
        outputPath={outputPath}
        setOutputPath={setOutputPath}
        outputType={outputType}
        setOutputType={setOutputType}
        onProcessAll={handleProcessAll}
        isProcessing={isProcessing}
        disabled={files.length === 0}
      />
    </div>
  )
}
