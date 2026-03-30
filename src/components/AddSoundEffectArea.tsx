import { X, Loader2, Volume2, FolderOpen, RefreshCw, ChevronDown, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { addSoundEffect, getSoundEffects, previewSoundEffect, openFolder, getDefaultOutputPath, openEffectsFolder, SoundEffect } from '../services/api'
import { useAppContext } from '../context/AppContext'
import FileDropZone from './FileDropZone'
import BottomActionBar from './BottomActionBar'
import SoundEffectLibraryModal from './SoundEffectLibraryModal'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface FileItem {
  id: string
  file: File
  name: string
  duration: string
  size: string
  startEffect: string
  endEffect: string
  startEffectName: string
  endEffectName: string
  status: 'waiting' | 'processing' | 'done' | 'error'
  outputPath?: string
  error?: string
}

export default function AddSoundEffectArea() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [effects, setEffects] = useState<SoundEffect[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isProcessing, setIsProcessing] = useState(false)
  const [globalStartEffect, setGlobalStartEffect] = useState('')
  const [globalEndEffect, setGlobalEndEffect] = useState('')
  const [globalStartEffectName, setGlobalStartEffectName] = useState('')
  const [globalEndEffectName, setGlobalEndEffectName] = useState('')
  const [showStartEffectModal, setShowStartEffectModal] = useState(false)
  const [showEndEffectModal, setShowEndEffectModal] = useState(false)
  const [editingFileId, setEditingFileId] = useState<string | null>(null)
  const [editingEffectType, setEditingEffectType] = useState<'start' | 'end'>('start')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { checkAndShowAuthCode } = useAppContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadEffects(); getDefaultOutputPath().then(setOutputPath) }, [])

  const loadEffects = async () => {
    try {
      const data = await getSoundEffects()
      setEffects(data.effects)
    } catch (err) { console.error(t('functions.add_effect.load_failed'), err) }
  }

  const handleOpenEffectsFolder = async () => {
    try {
      await openEffectsFolder()
    } catch (err) { console.error(t('functions.add_effect.open_folder_failed'), err) }
  }

  const handleSelectStartEffect = (effectId: string, effectName: string) => {
    setGlobalStartEffect(effectId)
    setGlobalStartEffectName(effectName)
    setFiles(prev => prev.map(f => ({ ...f, startEffect: effectId, startEffectName: effectName })))
  }

  const handleSelectEndEffect = (effectId: string, effectName: string) => {
    setGlobalEndEffect(effectId)
    setGlobalEndEffectName(effectName)
    setFiles(prev => prev.map(f => ({ ...f, endEffect: effectId, endEffectName: effectName })))
  }

  const handleSelectFileEffect = (effectId: string, effectName: string) => {
    if (editingFileId) {
      if (editingEffectType === 'start') {
        setFiles(prev => prev.map(f => 
          f.id === editingFileId 
            ? { ...f, startEffect: effectId, startEffectName: effectName }
            : f
        ))
      } else {
        setFiles(prev => prev.map(f => 
          f.id === editingFileId 
            ? { ...f, endEffect: effectId, endEffectName: effectName }
            : f
        ))
      }
      // 同时更新全局音效显示（如果是第一次选择）
      if (editingEffectType === 'start' && !globalStartEffect) {
        setGlobalStartEffect(effectId)
        setGlobalStartEffectName(effectName)
      } else if (editingEffectType === 'end' && !globalEndEffect) {
        setGlobalEndEffect(effectId)
        setGlobalEndEffectName(effectName)
      }
    }
    setEditingFileId(null)
  }

  const openFileEffectModal = (fileId: string, type: 'start' | 'end') => {
    setEditingFileId(fileId)
    setEditingEffectType(type)
  }

  const getEffectName = (effectId: string) => {
    const effect = effects.find(e => e.id === effectId)
    if (!effect) return t('common.none')
    const key = `effect.names.${effect.name}`
    const translated = t(key)
    return translated === key ? effect.name : translated
  }

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60), ms = Math.floor((seconds % 1) * 1000)
    return `00:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
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

  const addFiles = async (newFiles: File[]) => {
    const audioFiles = newFiles.filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(f.name))
    const items: FileItem[] = []
    for (const file of audioFiles) {
      const duration = await getAudioDuration(file)
      items.push({ 
        id: Math.random().toString(36).substring(2, 9), 
        file, 
        name: file.name, 
        duration: formatDuration(duration), 
        size: formatSize(file.size), 
        startEffect: globalStartEffect, 
        endEffect: globalEndEffect, 
        startEffectName: globalStartEffectName,
        endEffectName: globalEndEffectName,
        status: 'waiting' 
      })
    }
    setFiles(prev => [...prev, ...items])
  }

  const removeFile = (id: string) => { setFiles(prev => prev.filter(f => f.id !== id)) }
  const clearFiles = () => setFiles([])

  const handleFileSelect = () => fileInputRef.current?.click()
  const handleFolderSelect = () => folderInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      addFiles(newFiles)
    }
    e.target.value = ''
  }

  const previewEffect = async (effectId: string) => {
    if (!effectId) return
    try {
      const blob = await previewSoundEffect(effectId)
      const url = URL.createObjectURL(blob)
      if (audioRef.current) {
        audioRef.current.pause()
        const prev = audioRef.current.src
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      }
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        const cur = audio.src
        audio.src = ''
        if (cur && cur.startsWith('blob:')) URL.revokeObjectURL(cur)
      }
      audio.play()
    } catch (err) { console.error('预览音效失败:', err) }
  }

  const handleProcessSingle = async (id: string) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    const fileItem = files.find(f => f.id === id)
    if (!fileItem) return
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'processing' as const } : f))
    try {
      const result = await addSoundEffect({ file: fileItem.file, startEffect: fileItem.startEffect, endEffect: fileItem.endEffect, outputPath: outputType === 'custom' ? outputPath : '' })
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', outputPath: result.output_path, size: formatSize(result.size || 0) } : f))
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: err instanceof Error ? err.message : t('common.process_failed') } : f))
    }
  }

  const handleProcessAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    if (files.length === 0) return
    setIsProcessing(true)
    const waitingFiles = files.filter(f => f.status === 'waiting' || f.status === 'error')
    for (const fileItem of waitingFiles) { await handleProcessSingle(fileItem.id) }
    setIsProcessing(false)
  }

  const handleOpenSingleFolder = async (filePath: string) => {
    await openOutputFolder(filePath)
  }

  const renderFileList = () => (
    <div className="flex-1 overflow-auto border border-[#2a3a50] rounded-b-lg">
      {files.map((item) => (
        <div key={item.id} className="flex items-center px-4 py-3 border-b border-[#1e2235] hover:bg-[#12121e]">
          <div className="flex-1 min-w-[150px] text-white text-xs truncate" title={item.name}>{item.name}</div>
          <div className="w-28 text-center text-gray-400 text-xs">{item.duration}</div>
          <div className="w-24 text-center text-gray-400 text-xs">{item.size}</div>
          <div className="w-28 text-center">
            <button
              onClick={() => openFileEffectModal(item.id, 'start')}
              className="bg-[#1a1a2e] text-white text-xs px-2 py-1 rounded border border-[#2a3a50] hover:border-blue-500 w-24 truncate"
            >
              {item.startEffectName || (item.startEffect ? getEffectName(item.startEffect) : t('common.none'))}
            </button>
          </div>
          <div className="w-28 text-center">
            <button
              onClick={() => openFileEffectModal(item.id, 'end')}
              className="bg-[#1a1a2e] text-white text-xs px-2 py-1 rounded border border-[#2a3a50] hover:border-blue-500 w-24 truncate"
            >
              {item.endEffectName || (item.endEffect ? getEffectName(item.endEffect) : t('common.none'))}
            </button>
          </div>
          <div className="w-24 text-center">
            {item.status === 'waiting' && <span className="text-gray-400 text-xs">⊙{t('common.status.pending')}</span>}
            {item.status === 'processing' && <span className="text-blue-400 text-xs flex items-center justify-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{t('common.processing')}</span>}
            {item.status === 'done' && <span className="text-green-400 text-xs">✓{t('common.status.done')}</span>}
            {item.status === 'error' && <span className="text-red-400 text-xs" title={item.error}>✗{t('common.status.error')}</span>}
          </div>
          <div className="w-24 flex items-center justify-center gap-2">
            {item.status === 'waiting' && (item.startEffect || item.endEffect) && (
              <button onClick={() => handleProcessSingle(item.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded whitespace-nowrap">{t('common.process')}</button>
            )}
            {item.status === 'done' && item.outputPath && (
              <button onClick={() => handleOpenSingleFolder(item.outputPath!)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded whitespace-nowrap">{OPEN_FOLDER_TEXT}</button>
            )}
            <button onClick={() => removeFile(item.id)} className="p-1 text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
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

      {/* 全局音效设置 */}
      <div className="flex items-center justify-between mb-3 p-3 bg-[#12121e] rounded-lg border border-[#1e2235]">
        <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('functions.add_effect.start_effect')}</span>
            <button
              onClick={() => setShowStartEffectModal(true)}
              className="flex items-center gap-2 bg-[#1a1a2e] text-white text-xs px-3 py-1.5 rounded border border-[#2a3a50] hover:border-blue-500 min-w-[120px]"
            >
              <span className="flex-1 text-left truncate">{globalStartEffectName || t('functions.add_effect.select_effect')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {globalStartEffect && <button onClick={() => previewEffect(globalStartEffect)} className="text-blue-400 hover:text-blue-300"><Volume2 className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('functions.add_effect.end_effect')}</span>
            <button
              onClick={() => setShowEndEffectModal(true)}
              className="flex items-center gap-2 bg-[#1a1a2e] text-white text-xs px-3 py-1.5 rounded border border-[#2a3a50] hover:border-blue-500 min-w-[120px]"
            >
              <span className="flex-1 text-left truncate">{globalEndEffectName || t('functions.add_effect.select_effect')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {globalEndEffect && <button onClick={() => previewEffect(globalEndEffect)} className="text-blue-400 hover:text-blue-300"><Volume2 className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadEffects} className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white text-xs" title={t('functions.add_effect.refresh')}>
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleOpenEffectsFolder} className="flex items-center gap-1 px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#252540] text-gray-300 rounded text-xs border border-[#2a3a50]">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{t('functions.add_effect.open_folder')}</span>
          </button>
          <button
            onClick={clearFiles}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('common.clear_list')}</span>
          </button>
        </div>
      </div>

      {/* 表头 */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400">
        <div className="flex-1 min-w-[150px]">{t('common.file_name')}</div>
        <div className="w-28 text-center">{t('common.file_duration')}</div>
        <div className="w-24 text-center">{t('common.file_size')}</div>
        <div className="w-28 text-center">{t('functions.add_effect.start_effect_label')}</div>
        <div className="w-28 text-center">{t('functions.add_effect.end_effect_label')}</div>
        <div className="w-24 text-center">{t('common.file_status')}</div>
        <div className="w-24 text-center">{t('common.action')}</div>
      </div>

      <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('functions.add_effect.description')}>
        {renderFileList()}
      </FileDropZone>

      <BottomActionBar
        outputPath={outputPath}
        setOutputPath={setOutputPath}
        outputType={outputType}
        setOutputType={setOutputType}
        onProcessAll={handleProcessAll}
        isProcessing={isProcessing}
        disabled={files.length === 0}
      />

      {/* 音效库弹窗 */}
      <SoundEffectLibraryModal
        isOpen={showStartEffectModal}
        onClose={() => setShowStartEffectModal(false)}
        onSelect={handleSelectStartEffect}
        title={t('functions.add_effect.select_start')}
      />
      <SoundEffectLibraryModal
        isOpen={showEndEffectModal}
        onClose={() => setShowEndEffectModal(false)}
        onSelect={handleSelectEndEffect}
        title={t('functions.add_effect.select_end')}
      />
      <SoundEffectLibraryModal
        isOpen={editingFileId !== null}
        onClose={() => setEditingFileId(null)}
        onSelect={handleSelectFileEffect}
        title={editingEffectType === 'start' ? t('functions.add_effect.select_start') : t('functions.add_effect.select_end')}
      />
    </div>
  )
}
