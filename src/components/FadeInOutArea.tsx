import { Play, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { fadeAudio, openFolder, getDefaultOutputPath } from '../services/api'
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
  fadeIn: number | null
  fadeOut: number | null
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

export default function FadeInOutArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchFadeIn, setBatchFadeIn] = useState(0)
  const [batchFadeOut, setBatchFadeOut] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFadeModal, setShowFadeModal] = useState(false)
  const [editingFile, setEditingFile] = useState<AudioFile | null>(null)
  const [modalFadeIn, setModalFadeIn] = useState(0)
  const [modalFadeOut, setModalFadeOut] = useState(0)
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
        fadeIn: null, fadeOut: null, status: 'pending' as const
      }))
    )
    setFiles(prev => [...prev, ...audioFiles])
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + 'B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
    return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
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

  const openFadeSettings = (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return
    setEditingFile(file)
    setModalFadeIn(file.fadeIn ?? 0)
    setModalFadeOut(file.fadeOut ?? 0)
    setShowFadeModal(true)
  }

  const confirmFadeSettings = () => {
    if (editingFile) {
      setFiles(prev => prev.map(f => f.id === editingFile.id ? { ...f, fadeIn: modalFadeIn, fadeOut: modalFadeOut } : f))
    }
    setShowFadeModal(false)
    setEditingFile(null)
  }

  const openBatchModal = () => {
    const pendingIds = files.filter(f => f.status === 'pending').map(f => f.id)
    setSelectedIds(new Set(pendingIds))
    setBatchFadeIn(0)
    setBatchFadeOut(0)
    setShowBatchModal(true)
  }

  const handleBatchSet = () => {
    setFiles(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, fadeIn: batchFadeIn, fadeOut: batchFadeOut } : f))
    setShowBatchModal(false)
    setSelectedIds(new Set())
  }

  const toggleFileSelection = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const toggleSelectAll = () => {
    const pendingFiles = files.filter(f => f.status === 'pending')
    if (selectedIds.size === pendingFiles.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(pendingFiles.map(f => f.id)))
  }

  const handleProcessSingle = async (audioFile: AudioFile) => {
    if (audioFile.fadeIn === null || audioFile.fadeOut === null) { alert('请先设置淡入淡出时长'); return }
    
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'processing' } : f))
    try {
      const result = await fadeAudio({ file: audioFile.file, fadeIn: audioFile.fadeIn, fadeOut: audioFile.fadeOut, outputPath: outputType === 'custom' ? outputPath : '' })
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'completed', outputPath: result.output_path } : f))
    } catch (error) {
      setFiles(prev => prev.map(f => f.id === audioFile.id ? { ...f, status: 'error', error: error instanceof Error ? error.message : '处理失败' } : f))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const pendingFiles = files.filter(f => f.status === 'pending' && f.fadeIn !== null && f.fadeOut !== null)
    if (pendingFiles.length === 0) { alert('没有可处理的文件，请先设置淡入淡出时长'); return }
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
          <div className="w-32 text-center text-gray-400">{formatDuration(file.duration)}</div>
          <div className="w-24 text-center text-gray-400">{file.fadeIn !== null ? `${file.fadeIn}s` : '-'}</div>
          <div className="w-24 text-center text-gray-400">{file.fadeOut !== null ? `${file.fadeOut}s` : '-'}</div>
          <div className="w-24 text-center">
            {file.status === 'completed' ? <span className="text-green-400">{t('common.completed')}</span>
              : file.status === 'processing' ? <span className="text-blue-400">{t('common.processing')}</span>
              : file.status === 'error' ? <span className="text-red-400" title={file.error}>{t('common.error')}</span>
              : <span className="text-gray-400">⊙{t('common.unprocessed')}</span>}
          </div>
          <div className="flex-1 flex items-center justify-center gap-16">
            {file.status === 'completed' ? (
              <button onClick={() => file.outputPath && openOutputFolder(file.outputPath)} className="text-blue-400 hover:text-blue-300 text-xs">{t('common.open_output_dir')}</button>
            ) : file.status === 'processing' ? (
              <span className="text-gray-500 text-xs">{t('common.processing')}</span>
            ) : (
              <>
                <button onClick={() => openFadeSettings(file.id)} className="text-orange-400 hover:text-orange-300 text-xs hover:underline">{t('fade.settings')}</button>
                <button onClick={() => handleProcessSingle(file)} className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">{t('fade.process')}</button>
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
        {/* 批量设置按钮 */}
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
            <button onClick={openBatchModal} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">{t('fade.batch_fade')}</button>
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
          <div className="w-[200px]">{t('common.file_name')}</div>
          <div className="w-32 text-center">{t('common.duration')}</div>
          <div className="w-24 text-center">{t('fade.fade_in')}</div>
          <div className="w-24 text-center">{t('fade.fade_out')}</div>
          <div className="w-24 text-center">{t('common.file_status')}</div>
          <div className="flex-1 text-center">{t('common.action')}</div>
        </div>

        <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('fade.fade_tip')}>
          {renderFileList()}
        </FileDropZone>
      </div>

      <BottomActionBar
        outputPath={outputPath}
        setOutputPath={setOutputPath}
        outputType={outputType}
        setOutputType={setOutputType}
        onProcessAll={handleProcessAll}
        processButtonText={t('fade.start_fade')}
        isProcessing={isProcessing}
        disabled={files.length === 0}
      />

      {/* 淡入淡出设置弹窗 */}
      {showFadeModal && editingFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1f2e] rounded-lg w-[400px] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3040]">
              <span className="text-white text-sm font-medium">{t('fade.fade_settings')}</span>
              <button onClick={() => { setShowFadeModal(false); setEditingFile(null) }} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm w-10">{t('fade.fade_in')}</span>
                <input type="number" value={modalFadeIn} onChange={(e) => setModalFadeIn(parseFloat(e.target.value) || 0)} min="0" max="30" step="0.1"
                  className="w-20 bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-sm text-white outline-none text-center" />
                <span className="text-gray-500 text-sm">{t('common.seconds') || '秒'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm w-10">{t('fade.fade_out')}</span>
                <input type="number" value={modalFadeOut} onChange={(e) => setModalFadeOut(parseFloat(e.target.value) || 0)} min="0" max="30" step="0.1"
                  className="w-20 bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-sm text-white outline-none text-center" />
                <span className="text-gray-500 text-sm">{t('common.seconds') || '秒'}</span>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4">
              <button onClick={() => { setShowFadeModal(false); setEditingFile(null) }} className="flex-1 py-2 bg-[#2a3040] hover:bg-[#3a4050] text-white rounded text-sm">{t('settings.cancel')}</button>
              <button onClick={confirmFadeSettings} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">{t('settings.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 批量设置弹窗 */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1f2e] rounded-lg w-[900px] max-w-[95vw] shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3040]">
              <span className="text-white text-sm font-medium">{t('fade.batch_fade')}</span>
              <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col border-r border-[#2a3040]">
                <div className="flex items-center bg-[#12121e] px-4 py-2 text-xs text-gray-400 border-b border-[#2a3040]">
                  <div className="w-[220px]">{t('common.file_name') || '文件名'}</div>
                  <div className="w-24 text-center">{t('common.size')}</div>
                  <div className="flex-1 text-center">{t('common.duration')}</div>
                </div>
                <div className="flex-1 overflow-auto">
                  {files.filter(f => f.status === 'pending').map(file => (
                    <div key={file.id} className="flex items-center px-4 py-3 text-xs text-gray-300 border-b border-[#1e2235] hover:bg-[#12121e] cursor-pointer"
                      onClick={() => toggleFileSelection(file.id)}>
                      <div className="w-[220px] flex items-center gap-2">
                        <input type="checkbox" checked={selectedIds.has(file.id)} onChange={() => toggleFileSelection(file.id)} onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-500 bg-transparent accent-blue-500" />
                        <span className="truncate" title={file.name}>{file.name}</span>
                      </div>
                      <div className="w-24 text-center text-gray-400">{formatFileSize(file.size)}</div>
                      <div className="flex-1 text-center text-gray-400">{formatDuration(file.duration)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-[280px] p-5">
                <h3 className="text-white text-sm mb-5">{t('fade.fade_settings')}</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-10">{t('fade.fade_in')}</span>
                    <input type="number" value={batchFadeIn} onChange={(e) => setBatchFadeIn(parseFloat(e.target.value) || 0)} min="0" max="30" step="0.1"
                      className="w-20 bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-sm text-white outline-none text-center" />
                    <span className="text-gray-500 text-sm">{t('common.seconds') || '秒'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-10">{t('fade.fade_out')}</span>
                    <input type="number" value={batchFadeOut} onChange={(e) => setBatchFadeOut(parseFloat(e.target.value) || 0)} min="0" max="30" step="0.1"
                      className="w-20 bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-sm text-white outline-none text-center" />
                    <span className="text-gray-500 text-sm">{t('common.seconds') || '秒'}</span>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-6 leading-relaxed">{t('fade.fade_duration_tip') || '注：淡入淡出时长不能超原音频总时长'}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a3040]">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={selectedIds.size === files.filter(f => f.status === 'pending').length && files.filter(f => f.status === 'pending').length > 0}
                    onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-500 bg-transparent accent-blue-500" />
                  <span className="text-gray-400 text-sm">{t('common.select_all') || '全选'}</span>
                </label>
                <span className="text-gray-500 text-sm">{t('common.selected_count', { selected: selectedIds.size, total: files.filter(f => f.status === 'pending').length }) || `已选中${selectedIds.size}/${files.filter(f => f.status === 'pending').length}`}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowBatchModal(false)} className="px-6 py-2 bg-[#2a3040] hover:bg-[#3a4050] text-white rounded text-sm">{t('settings.cancel')}</button>
                <button onClick={handleBatchSet} disabled={selectedIds.size === 0}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded text-sm">{t('settings.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
