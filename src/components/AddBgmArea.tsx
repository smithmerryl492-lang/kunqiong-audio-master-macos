import { Play, ChevronDown, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { addBgm, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import BgmLibraryModal from './BgmLibraryModal'
import BgmSettingsModal from './BgmSettingsModal'
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
  bgmFile?: File
  bgmName?: string
  outputFormat: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function AddBgmArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [globalOutputFormat, setGlobalOutputFormat] = useState('原文件格式')
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [bgmVolume, setBgmVolume] = useState(0.3)
  const [loopBgm, setLoopBgm] = useState(true)
  const [showBgmLibrary, setShowBgmLibrary] = useState(false)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [showBgmSettings, setShowBgmSettings] = useState(false)
  const [settingsFile, setSettingsFile] = useState<AudioFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const globalOutputFormatOptions = [t('cut.original_format'), 'MP3', 'WAV', 'FLAC', 'AAC', 'OGG', 'M4A']

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
        outputFormat: globalOutputFormat, status: 'pending' as const
      }))
    )
    setFiles(prev => [...prev, ...audioFiles])
  }

  const formatSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
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

  const openBgmSelector = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (file) { setSettingsFile(file); setShowBgmSettings(true) }
  }

  const updateOutputFormat = (id: string, format: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, outputFormat: format } : f))
  }

  const { checkAndShowAuthCode } = useAppContext()

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    if (!audioFile.bgmFile) return
    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const format = audioFile.outputFormat === t('cut.original_format') ? audioFile.name.split('.').pop()?.toLowerCase() || 'mp3' : audioFile.outputFormat.toLowerCase()
      const result = await addBgm({ mainAudio: audioFile.file, bgmAudio: audioFile.bgmFile, bgmVolume, loopBgm, outputFormat: format, outputPath: outputType === 'custom' ? outputPath : '' })
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'completed', outputPath: result.output_path } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('bgm.add_failed') } : f))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    const pendingFiles = files.filter(f => f.status === 'pending' && f.bgmFile)
    if (pendingFiles.length === 0) return
    setIsProcessing(true)
    for (const file of pendingFiles) {
      await handleProcessSingle(file)
    }
    setIsProcessing(false)
  }

  const handleBatchSetBgm = () => { setSelectedFileId('batch'); setShowBgmLibrary(true) }

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
          <div className="w-28 text-center">
            {file.bgmName ? (
              <span className="text-green-400 text-xs truncate block" title={file.bgmName}>
                {file.bgmName.length > 10 ? file.bgmName.slice(0, 10) + '...' : file.bgmName}
              </span>
            ) : (
              <button onClick={() => openBgmSelector(file.id)} className="text-blue-400 hover:text-blue-300 text-xs">{t('bgm.select_bgm')}</button>
            )}
          </div>
          <div className="w-32 text-center">
            <div className="relative inline-block">
              <select value={file.outputFormat} onChange={(e) => updateOutputFormat(file.id, e.target.value)}
                disabled={file.status === 'processing' || file.status === 'completed'}
                className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-xs text-white outline-none disabled:opacity-50 min-w-[100px]">
                {globalOutputFormatOptions.map(fmt => (<option key={fmt} value={fmt}>{fmt}</option>))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="w-24 text-center">
            {file.status === 'completed' ? <span className="text-green-400">{t('common.status.done')}</span>
              : file.status === 'processing' ? <span className="text-blue-400">{t('bgm.adding')}</span>
              : file.status === 'error' ? <span className="text-red-400" title={file.error}>{t('common.status.error')}</span>
              : <span className="text-gray-400">⊙{t('common.status.pending')}</span>}
          </div>
          <div className="flex-1 flex items-center justify-center">
            {file.status === 'completed' ? (
              <button onClick={() => file.outputPath && openOutputFolder(file.outputPath)} className="px-3 py-1 text-blue-400 hover:text-blue-300 text-xs">{OPEN_FOLDER_TEXT}</button>
            ) : file.status === 'processing' ? (
              <span className="text-gray-500 text-xs">{t('bgm.adding')}</span>
            ) : (
              <button onClick={() => handleProcessSingle(file)} disabled={!file.bgmFile}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs">{t('common.process') || '处理'}</button>
            )}
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

      <div className="flex-1 flex flex-col p-3">
        {/* 批量设置 */}
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
            <button onClick={handleBatchSetBgm} className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs">{t('bgm.bgm_library')}</button>
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
          <div className="w-[200px]">{t('common.file_name') || '文件名'}</div>
          <div className="w-24 text-center">{t('common.size')}</div>
          <div className="w-32 text-center">{t('common.duration')}</div>
          <div className="w-28 text-center">{t('bgm.title')}</div>
          <div className="w-32 text-center">{t('common.format')}</div>
          <div className="w-24 text-center">{t('common.status_text') || '文件状态'}</div>
          <div className="flex-1 text-center">{t('common.action') || '操作'}</div>
        </div>

        <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('bgm.bgm_tip')}>
          {renderFileList()}
        </FileDropZone>
      </div>

      <BottomActionBar
        outputPath={outputPath}
        setOutputPath={setOutputPath}
        outputType={outputType}
        setOutputType={setOutputType}
        onProcessAll={handleProcessAll}
        processButtonText={t('bgm.start_add')}
        isProcessing={isProcessing}
        disabled={files.filter(f => f.bgmFile && f.status === 'pending').length === 0}
      />

      <BgmLibraryModal isOpen={showBgmLibrary} onClose={() => { setShowBgmLibrary(false); setSelectedFileId(null) }}
        onSelect={(bgm) => {
          if (selectedFileId === 'batch') {
            setFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, bgmFile: bgm.file, bgmName: bgm.name } : f))
          } else if (selectedFileId) {
            setFiles(prev => prev.map(f => f.id === selectedFileId ? { ...f, bgmFile: bgm.file, bgmName: bgm.name } : f))
          }
          setShowBgmLibrary(false); setSelectedFileId(null)
        }} />

      <BgmSettingsModal isOpen={showBgmSettings} onClose={() => { setShowBgmSettings(false); setSettingsFile(null) }}
        audioFile={settingsFile ? { file: settingsFile.file, name: settingsFile.name, duration: settingsFile.duration } : null}
        onSave={(bgm) => {
          if (settingsFile && bgm) {
            setFiles(prev => prev.map(f => f.id === settingsFile.id ? { ...f, bgmFile: bgm.file, bgmName: bgm.name } : f))
          }
          setShowBgmSettings(false); setSettingsFile(null)
        }} />
    </div>
  )
}
