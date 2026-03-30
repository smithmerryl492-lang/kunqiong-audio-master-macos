import { ChevronDown, Play, Folder, FolderOpen, Edit, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { extractVocal, selectDirectory, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import AudioCutModal from './AudioCutModal'
import FileDropZone from './FileDropZone'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration?: number
  extractType: 'all' | 'vocals' | 'accompaniment'
  status: 'waiting' | 'processing' | 'completed' | 'error'
  error?: string
  results?: Array<{ type: string; filename: string; path: string; size: number }>
}

const extractOptions = [
  { value: 'accompaniment', label: t('vocal.accompaniment_extract') },
  { value: 'vocals', label: t('vocal.vocal_extract') },
  { value: 'all', label: t('vocal.all_extract') }
]

export default function VocalExtractArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [batchExtractType, setBatchExtractType] = useState<'all' | 'vocals' | 'accompaniment'>('accompaniment')
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('custom')
  const [isProcessing, setIsProcessing] = useState(false)
  const [editingFile, setEditingFile] = useState<AudioFile | null>(null)
  const [showCutModal, setShowCutModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const { checkAndShowAuthCode } = useAppContext()

  useEffect(() => { getDefaultOutputPath().then(setOutputPath) }, [])

  const addFiles = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file, name: file.name, size: file.size, status: 'waiting', extractType: batchExtractType
    }))
    setFiles(prev => [...prev, ...audioFiles])
    audioFiles.forEach(af => {
      const audio = new Audio()
      audio.preload = 'metadata'
      const objURL = URL.createObjectURL(af.file)
      audio.onloadedmetadata = () => {
        setFiles(prev => prev.map(f => f.id === af.id ? { ...f, duration: audio.duration } : f))
        URL.revokeObjectURL(objURL)
        audio.src = ''
      }
      audio.onerror = () => {
        URL.revokeObjectURL(objURL)
        audio.src = ''
      }
      audio.src = objURL
    })
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
  const handleSelectDirectory = async () => {
    const result = await selectDirectory(outputPath)
    if (result.success && result.path) { setOutputPath(result.path); setOutputType('custom') }
  }
  const handleOpenFolder = async () => { 
    await openOutputFolder(outputPath) 
  }

  const formatSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--:--'
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const updateExtractType = (id: string, type: 'all' | 'vocals' | 'accompaniment') => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, extractType: type } : f))
  }

  const handleEditFile = (file: AudioFile) => { setEditingFile(file); setShowCutModal(true) }
  const handleCloseCutModal = () => { setShowCutModal(false); setEditingFile(null) }
  const handleCutConfirm = () => { handleCloseCutModal() }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await extractVocal({
        file: audioFile.file, extractType: audioFile.extractType, outputFormat: 'mp3',
        outputPath: outputType === 'custom' ? outputPath : ''
      })
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'completed', results: result.results } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : t('vocal.failed') } : f))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const waitingFiles = files.filter(f => f.status === 'waiting' || f.status === 'error')
    if (waitingFiles.length === 0) return
    setIsProcessing(true)
    for (const audioFile of waitingFiles) { await handleProcessSingle(audioFile) }
    setIsProcessing(false)
  }

  const renderFileList = () => (
    <div className="flex-1 overflow-auto bg-[#0d0d1a]">
      {files.map(file => (
        <div key={file.id} className="flex items-center px-4 py-3 text-xs text-gray-300 border-b border-[#1e2235] hover:bg-[#12121e]">
          <div className="flex-[2] min-w-[150px] flex items-center gap-2 truncate pr-2">
            <button className="p-1 hover:bg-blue-500/20 rounded text-gray-400 hover:text-blue-400 flex-shrink-0"><Play className="w-4 h-4" /></button>
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="flex-1 min-w-[100px] text-center text-gray-400 truncate px-2">{formatDuration(file.duration)}</div>
          <div className="flex-1 min-w-[100px] text-center px-2">
            <div className="relative inline-block w-full max-w-[100px]">
              <select value={file.extractType} onChange={(e) => updateExtractType(file.id, e.target.value as any)}
                disabled={file.status === 'processing' || file.status === 'completed'}
                className="w-full appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-[10px] text-white outline-none disabled:opacity-50">
                {extractOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div className="flex-1 min-w-[80px] text-center px-2 truncate">
            {file.status === 'completed' ? <span className="text-green-400">{t('vocal.completed')}</span>
              : file.status === 'processing' ? <span className="text-blue-400">{t('vocal.extracting')}</span>
              : file.status === 'error' ? <span className="text-red-400" title={file.error}>{t('vocal.failed')}</span>
              : <span className="text-gray-400">{t('common.status.pending')}</span>}
          </div>
          <div className="flex-[2] min-w-[150px] flex items-center justify-center gap-3 md:gap-6 px-2">
            {file.status === 'completed' ? (
              <button onClick={() => openOutputFolder(outputPath)} className="px-3 py-1 text-blue-400 hover:text-blue-300 text-xs truncate">{OPEN_FOLDER_TEXT}</button>
            ) : file.status === 'processing' ? (
              <span className="text-gray-500 text-xs truncate">{t('vocal.extracting')}</span>
            ) : (
              <>
                <button onClick={() => handleEditFile(file)} className="flex items-center gap-1 text-gray-400 hover:text-white text-xs flex-shrink-0" title={t('common.edit') || '编辑'}>
                  <Edit className="w-3.5 h-3.5" /><span>{t('common.edit') || '编辑'}</span>
                </button>
                <button onClick={() => handleProcessSingle(file)} className="px-3 md:px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs flex-shrink-0">{t('common.process') || '处理'}</button>
              </>
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
          <div className="flex items-center gap-4">
            <button
              onClick={handleClearList}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.clear_list')}</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">{t('vocal.batch_extract_type')}</span>
              <div className="relative">
                <select value={batchExtractType} onChange={(e) => setBatchExtractType(e.target.value as any)}
                  className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-xs text-white outline-none min-w-[80px]">
                  {extractOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* 表头 */}
        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400 font-medium">
          <div className="flex-[2] min-w-[150px] truncate pr-2">{t('common.file_name')}</div>
          <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.file_duration')}</div>
          <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('vocal.extract_type')}</div>
          <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.file_status')}</div>
          <div className="flex-[2] min-w-[150px] text-center truncate px-2">{t('common.action')}</div>
        </div>

        <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('vocal.title')}>
          {renderFileList()}
        </FileDropZone>
      </div>

      {/* 底部设置栏 */}
      <div className="h-14 bg-[#12121e] border-t border-[#1e2235] flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">{t('footer.output_dir')}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={outputType === 'original'} onChange={() => setOutputType('original')} className="w-3 h-3 accent-blue-500" /><span>{t('footer.original_dir')}</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={outputType === 'custom'} onChange={() => setOutputType('custom')} className="w-3 h-3 accent-blue-500" /><span>{t('footer.custom_dir')}</span>
            </label>
          </div>
          <input type="text" value={outputPath} onChange={(e) => setOutputPath(e.target.value)} disabled={outputType === 'original'}
            className={`w-72 bg-[#0a0a14] border border-[#2a2a40] rounded px-2 py-1.5 text-xs outline-none ${outputType === 'original' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSelectDirectory} disabled={outputType === 'original'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs border ${outputType === 'original' ? 'bg-[#1a1a2a] text-gray-500 border-[#2a2a40] cursor-not-allowed' : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 border-[#2a2a40]'}`}>
            <Folder className="w-3.5 h-3.5" /><span>{t('footer.change')}</span>
          </button>
          <button onClick={handleOpenFolder} className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]">
            <FolderOpen className="w-3.5 h-3.5" /><span>{OPEN_FOLDER_TEXT}</span>
          </button>
          <button onClick={handleProcessAll} disabled={files.length === 0 || isProcessing}
            className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs">
            {isProcessing ? t('vocal.extracting') : t('vocal.all_extract')}
          </button>
        </div>
      </div>

      <AudioCutModal isOpen={showCutModal} onClose={handleCloseCutModal} file={editingFile?.file || null}
        fileName={editingFile?.name || ''} duration={editingFile?.duration || 0} onConfirm={handleCutConfirm} />
    </div>
  )
}
