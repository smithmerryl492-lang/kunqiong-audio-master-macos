import { Settings, Play, Circle, CheckCircle, Loader2, Trash2, Plus, FolderPlus } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { compressAudio, selectDirectory, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import CompressSettingsModal, { CompressSettings } from './CompressSettingsModal'
import FileDropZone from './FileDropZone'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  status: 'waiting' | 'processing' | 'completed' | 'error'
  compressedSize?: number
  compressionRatio?: number
  error?: string
  settings: CompressSettings
  outputPath?: string
}

export default function AudioCompressArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [batchSettingsOpen, setBatchSettingsOpen] = useState(false)
  const [batchRatio, setBatchRatio] = useState(70)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const { checkAndShowAuthCode } = useAppContext()

  useEffect(() => {
    getDefaultOutputPath().then(setOutputPath)
  }, [])

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
        file,
        name: file.name,
        size: file.size,
        duration: await getAudioDuration(file),
        status: 'waiting' as const,
        settings: { mode: 'ratio' as const, ratio: 70 }
      }))
    )
    setFiles(prev => [...prev, ...audioFiles])
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      audioFiles.forEach(f => newSet.add(f.id))
      return newSet
    })
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(files.map(f => f.id)) : new Set())
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    checked ? newSet.add(id) : newSet.delete(id)
    setSelectedIds(newSet)
  }

  const handleClearList = () => {
    setFiles([])
    setSelectedIds(new Set())
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

  const handleRemoveFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    selectedIds.delete(id)
    setSelectedIds(new Set(selectedIds))
  }

  const handleSelectDirectory = async () => {
    const result = await selectDirectory(outputPath)
    if (result.success && result.path) {
      setOutputPath(result.path)
      setOutputType('custom')
    }
  }

  const handleOpenFolder = async () => {
    await openOutputFolder(outputPath)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00:00.000'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const openSettingsModal = (fileId: string) => {
    setEditingFileId(fileId)
    setSettingsModalOpen(true)
  }

  const handleSettingsConfirm = (settings: CompressSettings) => {
    if (editingFileId) {
      setFiles(prev => prev.map(f => f.id === editingFileId ? {
        ...f,
        settings,
        status: 'waiting',
        compressedSize: undefined,
        compressionRatio: undefined
      } : f))
    }
    setEditingFileId(null)
  }

  const settingsToCompressParams = (settings: CompressSettings): { ratio?: number; bitrate?: number } => {
    if (settings.mode === 'ratio' && settings.ratio) {
      // 压缩率逻辑：100% = 原文件大小（不压缩）
      // 比例越低，文件越小
      return { ratio: settings.ratio }
    } else if (settings.mode === 'params' && settings.bitrate) {
      return { bitrate: settings.bitrate }
    }
    return { ratio: 70 }  // 默认70%压缩比例
  }

  const getSettingsDisplay = (settings: CompressSettings): string => {
    if (settings.mode === 'ratio') return `${settings.ratio || 70}%`
    if (settings.mode === 'size') return `${settings.targetSize || 500}KB`
    if (settings.mode === 'params') return `${settings.bitrate || 128}kbps`
    return '70%'
  }

  const handleCompressSingle = async (fileId: string) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const audioFile = files.find(f => f.id === fileId)
    if (!audioFile || audioFile.status === 'processing') return

    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'processing' } : f))

    try {
      const compressParams = settingsToCompressParams(audioFile.settings)
      const result = await compressAudio({
        file: audioFile.file,
        quality: 'custom',
        ...compressParams,
        outputPath: outputType === 'custom' ? outputPath : ''
      })
      setFiles(prev => prev.map(f => f.id === fileId ? {
        ...f,
        status: 'completed',
        compressedSize: result.compressed_size,
        compressionRatio: result.compression_ratio,
        duration: result.duration || f.duration,
        outputPath: result.output_path
      } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === fileId ? {
        ...f,
        status: 'error',
        error: error instanceof Error ? error.message : '压缩失败'
      } : f))
    }
  }

  const handleCompressAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const selectedFiles = files.filter(f => selectedIds.has(f.id) && f.status !== 'completed')
    if (selectedFiles.length === 0) return

    setIsProcessing(true)
    for (const audioFile of selectedFiles) {
      await handleCompressSingle(audioFile.id)
    }
    setIsProcessing(false)
  }

  const renderStatus = (file: AudioFile) => {
    switch (file.status) {
      case 'processing':
        return (
          <div className="flex items-center justify-center gap-1 text-blue-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>压缩中</span>
          </div>
        )
      case 'completed':
        return (
          <div className="flex items-center justify-center gap-1 text-green-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>已压缩</span>
          </div>
        )
      case 'error':
        return (
          <div className="flex items-center justify-center gap-1 text-red-400" title={file.error}>
            <Circle className="w-3.5 h-3.5" />
            <span>失败</span>
          </div>
        )
      default:
        return (
          <div className="flex items-center justify-center gap-1 text-gray-400">
            <Circle className="w-3.5 h-3.5" />
            <span>{t('common.status.pending')}</span>
          </div>
        )
    }
  }

  // 文件列表内容
  const renderFileList = () => (
    <div className="flex-1 overflow-auto bg-[#0d0d1a] border border-[#1e2235] rounded-b-lg">
      {files.map(file => (
        <div key={file.id} className="flex items-center bg-[#0d0d1a] hover:bg-[#12121e] px-4 py-2.5 text-xs text-gray-300 border-b border-[#1e2235]">
          <div className="w-8">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-blue-500"
              checked={selectedIds.has(file.id)}
              onChange={(e) => handleSelectOne(file.id, e.target.checked)}
            />
          </div>
          <div className="flex-1 min-w-[180px] truncate flex items-center gap-2">
            <button className="w-6 h-6 rounded-full bg-[#1a1a2e] flex items-center justify-center hover:bg-blue-600 transition-colors flex-shrink-0">
              <Play className="w-3 h-3 text-white ml-0.5" />
            </button>
            <span className="truncate">{file.name}</span>
          </div>
          <div className="w-28 text-center text-gray-400">{formatDuration(file.duration)}</div>
          <div className="w-24 text-center text-gray-400">{formatSize(file.size)}</div>
          <div className="w-24 text-center text-gray-400">
            {file.compressedSize ? formatSize(file.compressedSize) : '--'}
          </div>
          <div className="w-24 text-center">{renderStatus(file)}</div>
          <div className="w-36 text-center flex items-center justify-center gap-2">
            <span className="text-gray-300">{getSettingsDisplay(file.settings)}</span>
            <button onClick={() => openSettingsModal(file.id)} className="p-1 hover:bg-[#2a2a40] rounded">
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
            {file.status === 'completed' ? (
              <button
                onClick={() => {
                  const filePath = file.outputPath || ''
                  openOutputFolder(filePath)
                }}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-[10px]"
              >
                {OPEN_FOLDER_TEXT}
              </button>
            ) : (
              <button
                onClick={() => handleCompressSingle(file.id)}
                disabled={file.status === 'processing'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-[10px]"
              >
                {t('compress.title')}
              </button>
            )}
          </div>
          <div className="w-16 text-center">
            <button onClick={() => handleRemoveFile(file.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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
        {/* 按钮栏 */}
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
            onClick={handleClearList}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('common.clear_list')}</span>
          </button>
        </div>

        {/* Table Header */}
        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
          <div className="w-8">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-blue-500"
              checked={files.length > 0 && selectedIds.size === files.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
          </div>
          <div className="flex-1 min-w-[180px]">{t('common.file_name') || '文件名'}</div>
          <div className="w-28 text-center">{t('common.duration')}</div>
          <div className="w-24 text-center">{t('common.size')}</div>
          <div className="w-24 text-center">{t('compress.compressed_size')}</div>
          <div className="w-24 text-center">{t('common.status_text') || '文件状态'}</div>
          <div className="w-36 text-center">{t('compress.batch_settings')}</div>
          <div className="w-16 text-center">{t('common.action') || '操作'}</div>
        </div>

        {/* File Drop Zone */}
        <FileDropZone
          onFilesAdded={addFiles}
          hasFiles={files.length > 0}
          showButtons={false}
          subDescription={t('compress.compression_tip')}
        >
          {renderFileList()}
        </FileDropZone>
      </div>

      {/* Bottom Bar */}
      <div className="bg-[#12121e] border-t border-[#1e2235] px-4 py-3">
        <div className="flex items-center mb-3">
          <span className="text-gray-400 text-xs mr-3">{t('compress.batch_settings')}：</span>
          <span className="text-gray-300 text-xs mr-2">{t('compress.compress_ratio')} {batchRatio}%</span>
          <button onClick={() => setBatchSettingsOpen(true)} className="p-1 hover:bg-[#2a2a40] rounded">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-xs">{t('footer.output_dir')}：</span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input type="radio" checked={outputType === 'original'} onChange={() => setOutputType('original')} className="w-3.5 h-3.5 accent-blue-500" />
                <span>{t('footer.original_dir')}</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                <input type="radio" checked={outputType === 'custom'} onChange={() => setOutputType('custom')} className="w-3.5 h-3.5 accent-blue-500" />
                <span>{t('footer.custom_dir')}</span>
              </label>
            </div>
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              disabled={outputType === 'original'}
              className={`w-80 bg-[#0a0a14] border border-[#2a2a40] rounded px-3 py-1.5 text-xs outline-none ${outputType === 'original' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSelectDirectory} disabled={outputType === 'original'}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs border ${outputType === 'original' ? 'bg-[#1a1a2a] text-gray-500 border-[#2a2a40] cursor-not-allowed' : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 border-[#2a2a40]'}`}>
              {t('footer.change')}
            </button>
            <button onClick={handleOpenFolder} className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]">
              {OPEN_FOLDER_TEXT}
            </button>
            <button
              onClick={handleCompressAll}
              disabled={selectedIds.size === 0 || isProcessing}
              className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs"
            >
              {isProcessing ? t('compress.compressing') : t('footer.process_all')}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modals */}
      <CompressSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => { setSettingsModalOpen(false); setEditingFileId(null) }}
        initialQuality={editingFileId ? (files.find(f => f.id === editingFileId)?.settings.ratio || 70) : 70}
        fileSize={editingFileId ? (files.find(f => f.id === editingFileId)?.size || 0) : 0}
        onConfirm={handleSettingsConfirm}
      />

      <CompressSettingsModal
        isOpen={batchSettingsOpen}
        onClose={() => setBatchSettingsOpen(false)}
        initialQuality={batchRatio}
        fileSize={files.length > 0 ? files[0].size : 1024 * 1024}
        onConfirm={(settings) => {
          if (settings.ratio) setBatchRatio(settings.ratio)
          setFiles(prev => prev.map(f => f.status === 'waiting' ? { ...f, settings } : f))
        }}
      />
    </div>
  )
}
