import { Play, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { reverseAudio, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import FileDropZone from './FileDropZone'
import BottomActionBar from './BottomActionBar'
import ProcessingStatus from './ProcessingStatus'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function AudioReverseArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
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
        status: 'pending' as const
      }))
    )
    setFiles(prev => [...prev, ...audioFiles])
  }

  const handleClearList = () => setFiles([])

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
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await reverseAudio({ file: audioFile.file, outputPath: outputType === 'custom' ? outputPath : '' })
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
          <div className="flex-1 min-w-[200px] flex items-center gap-2">
            <button className="p-1 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400"><Play className="w-4 h-4" /></button>
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="w-28 text-center text-gray-400">{formatSize(file.size)}</div>
          <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
          <div className="w-28 text-center">
            <ProcessingStatus status={file.status} error={file.error} />
          </div>
          <div className="w-28 text-center">
            {file.status === 'completed' ? (
              <button onClick={() => file.outputPath && openOutputFolder(file.outputPath)} className="text-blue-400 hover:text-blue-300 text-xs">{OPEN_FOLDER_TEXT}</button>
            ) : file.status === 'processing' ? (
              <span className="text-gray-500 text-xs">{t('common.status.converting')}</span>
            ) : (
              <button onClick={() => handleProcessSingle(file)} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">{t('common.process')}</button>
            )}
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

        {/* 表头 */}
        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
          <div className="flex-1 min-w-[200px]">{t('common.file_name')}</div>
          <div className="w-28 text-center">{t('common.file_size')}</div>
          <div className="w-32 text-center">{t('common.file_duration')}</div>
          <div className="w-28 text-center">{t('common.file_status')}</div>
          <div className="w-28 text-center">{t('common.action')}</div>
        </div>

        <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('reverse.reverse_tip')}>
          {renderFileList()}
        </FileDropZone>

        <BottomActionBar 
          outputPath={outputPath}
          setOutputPath={setOutputPath}
          outputType={outputType}
          setOutputType={setOutputType}
          onProcessAll={handleProcessAll} 
          processButtonText={t('reverse.start_reverse')}
          isProcessing={isProcessing} 
          disabled={files.length === 0}
        />
      </div>
    </div>
  )
}
