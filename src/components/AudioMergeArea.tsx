import { ChevronDown, Info, Play, Pencil, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { mergeAudio, selectDirectory, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import AudioCutModal from './AudioCutModal'
import FileDropZone from './FileDropZone'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  duration: number
  size: number
  transitionDuration: number
  cutStartTime?: number
  cutEndTime?: number
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + 'KB'
  return (bytes / (1024 * 1024)).toFixed(2) + 'MB'
}

async function getAudioDuration(file: File): Promise<number> {
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

export default function AudioMergeArea() {
  const [sortBy, setSortBy] = useState('按添加时间')
  const [globalTransition, setGlobalTransition] = useState(1)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputFormat, setOutputFormat] = useState('MP3')
  const [isMerging, setIsMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<{ success: boolean; message: string; path?: string } | null>(null)
  const [outputFileName, setOutputFileName] = useState('')
  const [useOriginalPath, setUseOriginalPath] = useState(true)
  const [cutModalOpen, setCutModalOpen] = useState(false)
  const [cutModalFile, setCutModalFile] = useState<AudioFile | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const sortOptions = [t('merge.sort_add_time'), t('merge.sort_name'), t('merge.sort_duration_asc'), t('merge.sort_duration_desc')]
  const transitionOptions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const formatOptions = ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG', 'M4A']

  useEffect(() => {
    const now = new Date()
    const timestamp = `${(now.getMonth() + 1).toString().padStart(2, '0')}_${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}_${now.getMinutes().toString().padStart(2, '0')}_${now.getSeconds().toString().padStart(2, '0')}_${now.getMilliseconds().toString().padStart(3, '0')}`
    setOutputFileName(`${t('merge.title') || '合并文件'}-${timestamp}`)
  }, [])

  useEffect(() => { getDefaultOutputPath().then(setOutputPath).catch(console.error) }, [])

  const addFiles = async (newFiles: File[]) => {
    const audioFiles: AudioFile[] = []
    for (const file of newFiles) {
      const duration = await getAudioDuration(file)
      audioFiles.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file, name: file.name, duration, size: file.size, transitionDuration: globalTransition })
    }
    setFiles(prev => [...prev, ...audioFiles])
  }

  const handleClearAll = () => { setFiles([]); setMergeResult(null) }

  const handleGlobalTransitionChange = (value: number) => {
    setGlobalTransition(value)
    setFiles(prev => prev.map(f => ({ ...f, transitionDuration: value })))
  }

  const handleSelectOutputPath = async () => {
    try {
      const result = await selectDirectory(outputPath)
      if (result.success && result.path) { setOutputPath(result.path); setUseOriginalPath(false) }
    } catch (err) { console.error('选择目录失败:', err) }
  }

  const handleOpenFolder = async () => { 
    if (outputPath) await openOutputFolder(outputPath) 
  }

  const sortFiles = (fileList: AudioFile[]) => {
    const sorted = [...fileList]
    switch (sortBy) {
      case '按文件名称': sorted.sort((a, b) => a.name.localeCompare(b.name)); break
      case '按时长升序': sorted.sort((a, b) => a.duration - b.duration); break
      case '按时长降序': sorted.sort((a, b) => b.duration - a.duration); break
    }
    return sorted
  }

  const getTotalDuration = () => files.reduce((sum, f) => {
    if (f.cutStartTime !== undefined && f.cutEndTime !== undefined) return sum + (f.cutEndTime - f.cutStartTime)
    return sum + f.duration
  }, 0)

  const getFileDuration = (file: AudioFile) => {
    if (file.cutStartTime !== undefined && file.cutEndTime !== undefined) return file.cutEndTime - file.cutStartTime
    return file.duration
  }

  const openCutModal = (file: AudioFile) => { setCutModalFile(file); setCutModalOpen(true) }

  const handleCutConfirm = (startTime: number, endTime: number) => {
    if (cutModalFile) {
      setFiles(prev => prev.map(f => f.id === cutModalFile.id ? { ...f, cutStartTime: startTime, cutEndTime: endTime } : f))
    }
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

  const { checkAndShowAuthCode } = useAppContext()

  const handleMerge = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    if (files.length < 2) { setMergeResult({ success: false, message: t('merge.at_least_two_files') || '至少需要2个音频文件' }); return }
    setIsMerging(true); setMergeResult(null)
    try {
      const sortedFiles = sortFiles(files)
      const avgTransition = sortedFiles.reduce((sum, f) => sum + f.transitionDuration, 0) / sortedFiles.length
      const result = await mergeAudio(sortedFiles.map(f => f.file), avgTransition, outputFormat.toLowerCase(), outputPath, outputFileName)
      setMergeResult({ success: result.success, message: result.success ? t('merge.merge_success') : t('merge.merge_failed'), path: result.output_path })
    } catch (err) {
      setMergeResult({ success: false, message: err instanceof Error ? err.message : t('merge.merge_failed') })
    } finally { setIsMerging(false) }
  }

  const displayFiles = sortFiles(files)

  // 文件列表内容
  const renderFileList = () => (
    <div className="flex-1 overflow-auto bg-[#0d0d1a]">
      {displayFiles.map((file) => (
        <div key={file.id} className="flex items-center bg-[#0d0d1a] hover:bg-[#151525] border-b border-[#1e2235] px-4 py-3 text-xs text-gray-300">
          <div className="flex-[2] min-w-[200px] flex items-center gap-2 truncate pr-2">
            <Play className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className={`flex-1 min-w-[100px] text-center px-2 truncate ${file.cutStartTime !== undefined ? 'text-green-400' : 'text-gray-400'}`}>
            {formatDuration(getFileDuration(file))}
          </div>
          <div className="flex-1 min-w-[100px] text-center text-gray-400 truncate px-2">{formatSize(file.size)}</div>
          <div className="flex-1 min-w-[120px] text-center px-2"></div>
          <div className="flex-1 min-w-[100px] text-right px-2">
            <button onClick={() => openCutModal(file)}
              className={`text-[10px] flex items-center gap-1 ml-auto ${file.cutStartTime !== undefined ? 'text-green-400 hover:text-green-300' : 'text-blue-400 hover:text-blue-300'}`}>
              <Pencil className="w-3 h-3" /><span>{t('common.edit') || '编辑'}</span>
            </button>
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

      {/* 表头上方的设置区域 */}
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('common.clear_list')}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('merge.transition')}</span>
            <div className="relative">
              <select value={globalTransition} onChange={(e) => handleGlobalTransitionChange(Number(e.target.value))}
                className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-3 py-1 pr-7 text-xs text-white outline-none min-w-[70px]">
                {transitionOptions.map(opt => (<option key={opt} value={opt}>{opt}s</option>))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 表头 */}
      <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2.5 text-xs text-gray-400 font-medium">
        <div className="flex-[2] min-w-[200px] flex items-center gap-2 truncate pr-2">
          <span className="truncate">{t('common.file_name') || '文件名'}</span>
          <div className="relative flex-shrink-0">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 pr-6 text-[10px] text-gray-300 outline-none">
              {sortOptions.map(opt => (<option key={opt} value={opt}>{opt}</option>))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.duration')}</div>
        <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.size')}</div>
        <div className="flex-1 min-w-[120px] text-center flex items-center justify-center gap-1 truncate px-2">
          <span className="truncate">{t('merge.transition')}</span><Info className="w-3 h-3 text-gray-500 flex-shrink-0" />
        </div>
        <div className="flex-1 min-w-[100px] text-right truncate px-2">{t('common.action') || '操作'}</div>
      </div>

      {/* 文件拖放区域 */}
      <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('merge.merge_tip')}>
        {renderFileList()}
      </FileDropZone>

      {/* 底部设置栏 */}
      {files.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1e2235] space-y-3">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">{t('merge.output_name')}</span>
              <input type="text" value={outputFileName} onChange={(e) => setOutputFileName(e.target.value)}
                className="bg-[#1a1a2e] border border-[#2a2a40] rounded px-3 py-1.5 text-xs text-white outline-none w-[200px] focus:border-blue-500" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-xs">{t('merge.total_duration', { duration: formatDuration(getTotalDuration()) })}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t('common.format')}:</span>
            <div className="relative">
              <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}
                className="appearance-none bg-[#1a1a2e] border border-[#2a2a40] rounded px-3 py-1.5 pr-8 text-xs text-white outline-none min-w-[120px]">
                {formatOptions.map(fmt => (<option key={fmt} value={fmt}>{fmt}</option>))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* 底部操作栏 */}
      <div className="bg-[#12121e] border-t border-[#1e2235] px-4 py-3 flex items-center justify-between mt-3">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">{t('footer.output_dir')}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={useOriginalPath} onChange={() => setUseOriginalPath(true)} className="w-3 h-3 accent-blue-500" /><span>{t('footer.original_dir')}</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={!useOriginalPath} onChange={() => setUseOriginalPath(false)} className="w-3 h-3 accent-blue-500" /><span>{t('footer.custom_dir')}</span>
            </label>
          </div>
          <input type="text" value={outputPath} onChange={(e) => setOutputPath(e.target.value)} disabled={useOriginalPath} title={outputPath}
            className={`w-72 bg-[#0a0a14] border border-[#2a2a40] rounded px-2 py-1.5 text-xs outline-none ${useOriginalPath ? 'text-gray-500 opacity-60' : 'text-gray-400'}`} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSelectOutputPath} disabled={useOriginalPath} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-[#2a2a40] ${useOriginalPath ? 'bg-[#1a1a2a] text-gray-500 cursor-not-allowed' : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300'}`}>{t('footer.change')}</button>
          <button onClick={handleOpenFolder} className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]">{OPEN_FOLDER_TEXT}</button>
          <button onClick={handleMerge} disabled={files.length < 2 || isMerging}
            className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs">
            {isMerging ? t('merge.merging') : t('merge.start_merge')}
          </button>
        </div>
      </div>

      {/* 合并结果提示 */}
      {mergeResult && (
        <div className={`fixed bottom-20 right-4 px-4 py-3 rounded-lg shadow-lg ${mergeResult.success ? 'bg-green-600' : 'bg-red-600'} text-white text-sm z-50`}>
          {mergeResult.message}
          {mergeResult.success && mergeResult.path && (
            <button onClick={() => openOutputFolder(mergeResult.path!)} className="ml-3 underline hover:no-underline">{OPEN_FOLDER_TEXT}</button>
          )}
          <button onClick={() => setMergeResult(null)} className="ml-3 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* 音频剪切弹窗 */}
      <AudioCutModal isOpen={cutModalOpen} onClose={() => setCutModalOpen(false)} file={cutModalFile?.file || null}
        fileName={cutModalFile?.name || ''} duration={cutModalFile?.duration || 0}
        initialStartTime={cutModalFile?.cutStartTime} initialEndTime={cutModalFile?.cutEndTime} onConfirm={handleCutConfirm} />
    </div>
  )
}
