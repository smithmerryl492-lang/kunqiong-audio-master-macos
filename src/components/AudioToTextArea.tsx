import { Folder, FolderOpen, Play, Check, FileAudio, Plus, FolderPlus, Trash2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import FileDropZone from './FileDropZone'
import { transcribeAudio, selectDirectory, openFolder, getDefaultOutputPath } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

// 其他语种列表
const otherLanguages = [
  { letter: 'A', languages: [{ value: 'ar', label: t('stt.arabic') }] },
  { letter: 'B', languages: [{ value: 'pl', label: t('stt.polish') }] },
  { letter: 'D', languages: [{ value: 'de', label: t('stt.german') }] },
  { letter: 'E', languages: [{ value: 'ru', label: t('stt.russian') }] },
  { letter: 'F', languages: [{ value: 'fr', label: t('stt.french') }] },
  { letter: 'H', languages: [{ value: 'ko', label: t('stt.korean') }, { value: 'nl', label: t('stt.dutch') }] },
  { letter: 'J', languages: [{ value: 'cs', label: t('stt.czech') }] },
  { letter: 'P', languages: [{ value: 'pt', label: t('stt.portuguese') }] },
  { letter: 'R', languages: [{ value: 'ja', label: t('stt.japanese') }, { value: 'sv', label: t('stt.swedish') }] },
  { letter: 'T', languages: [{ value: 'th', label: t('stt.thai') }, { value: 'tr', label: t('stt.turkish') }] },
  { letter: 'X', languages: [{ value: 'es', label: t('stt.spanish') }, { value: 'el', label: t('stt.greek') }] },
  { letter: 'Y', languages: [{ value: 'it', label: t('stt.italian') }, { value: 'id', label: t('stt.indonesian') }, { value: 'vi', label: t('stt.vietnamese') }] },
]

// 方言列表
const dialects = [
  { value: 'zh-yue', label: t('stt.cantonese') },
  { value: 'zh-min', label: t('stt.hokkien') },
  { value: 'zh-wu', label: t('stt.wu') },
  { value: 'zh-hakka', label: t('stt.hakka') },
]

interface AudioFile {
  id: string
  file: File
  name: string
  outputName: string
  size: number
  duration?: number
  status: 'waiting' | 'processing' | 'completed' | 'error'
  result?: { text: string; language: string; outputFile: string }
  error?: string
}

export default function AudioToTextArea() {
  const [files, setFiles] = useState<AudioFile[]>([])
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('custom')
  const [outputFormat, setOutputFormat] = useState('txt')
  const [language, setLanguage] = useState('zh')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showOtherLangPanel, setShowOtherLangPanel] = useState(false)
  const [otherLangTab, setOtherLangTab] = useState<'foreign' | 'dialect'>('foreign')
  const otherLangRef = useRef<HTMLDivElement>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const { checkAndShowAuthCode } = useAppContext()

  useEffect(() => { getDefaultOutputPath().then(setOutputPath) }, [])

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) { clearTimeout(hideTimeoutRef.current); hideTimeoutRef.current = null }
    setShowOtherLangPanel(true)
  }
  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => setShowOtherLangPanel(false), 150)
  }

  const getLanguageLabel = (value: string) => {
    const basicLangs: Record<string, string> = { zh: t('stt.mandarin'), en: t('stt.english'), auto: t('stt.mixed') }
    if (basicLangs[value]) return basicLangs[value]
    for (const group of otherLanguages) {
      const found = group.languages.find(l => l.value === value)
      if (found) return found.label
    }
    const dialect = dialects.find(d => d.value === value)
    if (dialect) return dialect.label
    return t('stt.other_languages')
  }

  const isOtherLanguage = !['zh', 'en', 'auto'].includes(language)

  const addFiles = (newFiles: File[]) => {
    const audioFiles: AudioFile[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file, name: file.name, outputName: file.name.replace(/\.[^/.]+$/, ''),
      size: file.size, status: 'waiting',
    }))
    setFiles((prev) => [...prev, ...audioFiles])
    audioFiles.forEach((af) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      const objURL = URL.createObjectURL(af.file)
      audio.onloadedmetadata = () => {
        setFiles((prev) => prev.map((f) => (f.id === af.id ? { ...f, duration: audio.duration } : f)))
        audio.src = ''
        URL.revokeObjectURL(objURL)
      }
      audio.onerror = () => {
        audio.src = ''
        URL.revokeObjectURL(objURL)
      }
      audio.src = objURL
    })
  }

  const handleOutputNameChange = (id: string, newName: string) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, outputName: newName } : f)))
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
  const getStatusText = (status: string) => {
    const map: Record<string, string> = { 
      waiting: t('common.status.pending'), 
      processing: t('common.status.converting'), 
      completed: t('common.status.done'), 
      error: t('common.status.error') 
    }
    return map[status] || status
  }
  const getWhisperLanguage = (lang: string): string | undefined => {
    if (lang === 'auto') return undefined
    if (lang.startsWith('zh-')) return 'zh'
    return lang
  }

  const handleTranscribeSingle = async (audioFile: AudioFile) => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    setFiles((prev) => prev.map((f) => (f.id === audioFile.id ? { ...f, status: 'processing' } : f)))
    try {
      const result = await transcribeAudio({
        file: audioFile.file, language: getWhisperLanguage(language), modelSize: 'base',
        outputFormat, outputName: audioFile.outputName, outputPath: outputType === 'custom' ? outputPath : '',
      })
      setFiles((prev) => prev.map((f) => f.id === audioFile.id ? {
        ...f, status: 'completed', result: { text: result.text, language: result.language, outputFile: result.output_file }
      } : f))
    } catch (error) {
      setFiles((prev) => prev.map((f) => f.id === audioFile.id ? {
        ...f, status: 'error', error: error instanceof Error ? error.message : t('stt.failed')
      } : f))
    }
  }

  const handleTranscribeAll = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return
    
    const waitingFiles = files.filter((f) => f.status === 'waiting')
    if (waitingFiles.length === 0) return
    setIsProcessing(true)
    for (const audioFile of waitingFiles) { await handleTranscribeSingle(audioFile) }
    setIsProcessing(false)
  }

  // 文件列表内容
  const renderFileList = () => (
    <div className="flex-1 overflow-y-auto bg-[#0d0d1a]">
      {files.map((file) => (
        <div key={file.id} className="flex items-center border-b border-[#1e2235] px-4 py-3 text-xs text-gray-300 hover:bg-white/5 group">
          <div className="flex-[2] min-w-[150px] flex items-center gap-2 truncate pr-2">
            <Play className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span className="truncate" title={file.name}>{file.name}</span>
          </div>
          <div className="flex-[1.5] min-w-[120px] text-center px-2 truncate">
            <input
              type="text"
              value={file.outputName}
              onChange={(e) => handleOutputNameChange(file.id, e.target.value)}
              disabled={file.status === 'completed' || file.status === 'processing'}
              className="w-full bg-[#1a1a2e] border border-[#2a2a40] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="flex-1 min-w-[80px] text-center text-gray-400 truncate px-2">{formatSize(file.size)}</div>
          <div className="flex-1 min-w-[100px] text-center text-gray-400 truncate px-2">{formatDuration(file.duration)}</div>
          <div className="flex-1 min-w-[80px] text-center px-2 truncate">
            <span className={file.status === 'completed' ? 'text-green-400' : file.status === 'processing' ? 'text-blue-400' : file.status === 'error' ? 'text-red-400' : 'text-gray-400'}>
              {getStatusText(file.status)}
            </span>
          </div>
          <div className="flex-1 min-w-[100px] flex items-center justify-center gap-2 px-2">
            {file.status === 'completed' ? (
              <button
                onClick={() => file.result?.outputFile && openOutputFolder(file.result.outputFile)}
                className="text-blue-400 hover:text-blue-300 text-[10px] truncate"
              >
                {OPEN_FOLDER_TEXT}
              </button>
            ) : (
              <button
                onClick={() => handleTranscribeSingle(file)}
                disabled={file.status === 'processing'}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-[10px] transition-colors truncate"
              >
                {t('common.process')}
              </button>
            )}
            <button
              onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
              className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 flex-shrink-0"
            >
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

        {/* 表头 */}
        <div className="flex items-center bg-[#12121e] border-b border-[#1e2235] px-4 py-2 text-xs text-gray-400 font-medium">
          <div className="flex-[2] min-w-[150px] truncate pr-2">{t('common.file_name')}</div>
          <div className="flex-[1.5] min-w-[120px] text-center truncate px-2">{t('main.output_file_name') || '输出文件名'}</div>
          <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.size')}</div>
          <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.duration')}</div>
          <div className="flex-1 min-w-[80px] text-center truncate px-2">{t('common.status_text') || '状态'}</div>
          <div className="flex-1 min-w-[100px] text-center truncate px-2">{t('common.action')}</div>
        </div>

        {/* 文件拖放区域 */}
        <FileDropZone onFilesAdded={addFiles} hasFiles={files.length > 0} showButtons={false} subDescription={t('stt.all_files')}>
          {renderFileList()}
        </FileDropZone>
      </div>

      {/* 底部设置 */}
      <div className="bg-[#12121e] border-t border-[#1e2235] px-4 py-3 space-y-3">
        {/* 输出格式和语种 */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{t('stt.export_format')}</span>
            <div className="flex items-center gap-4">
              {[{ value: 'txt', label: 'TXT' }, { value: 'docx', label: 'WORD' }, { value: 'srt', label: 'SRT' }].map((fmt) => (
                <label key={fmt.value} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                  <input type="radio" checked={outputFormat === fmt.value} onChange={() => setOutputFormat(fmt.value)} className="w-3 h-3 accent-blue-500" />
                  <span>{fmt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{t('stt.select_lang')}</span>
            <div className="flex items-center gap-4">
              {[{ value: 'zh', label: t('stt.mandarin') }, { value: 'en', label: t('stt.english') }, { value: 'auto', label: t('stt.mixed') }].map((lang) => (
                <label key={lang.value} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                  <input type="radio" checked={language === lang.value} onChange={() => setLanguage(lang.value)} className="w-3 h-3 accent-blue-500" />
                  <span>{lang.label}</span>
                </label>
              ))}
              {/* 其他语种 */}
              <div ref={otherLangRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                <label className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                  <input type="radio" checked={isOtherLanguage} readOnly className="w-3 h-3 accent-blue-500" />
                  <span>{isOtherLanguage ? getLanguageLabel(language) : t('stt.other_languages')}</span>
                </label>
                {showOtherLangPanel && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#1a1a2e] border border-[#2a2a40] rounded-lg shadow-xl z-50" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                    <div className="flex border-b border-[#2a2a40]">
                      <button onClick={() => setOtherLangTab('foreign')} className={`flex-1 px-4 py-2.5 text-sm ${otherLangTab === 'foreign' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t('stt.foreign_languages')}</button>
                      <button onClick={() => setOtherLangTab('dialect')} className={`flex-1 px-4 py-2.5 text-sm ${otherLangTab === 'dialect' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>{t('stt.dialects')}</button>
                    </div>
                    <div className="p-4 max-h-80 overflow-auto">
                      {otherLangTab === 'foreign' ? (
                        <div className="space-y-4">
                          {otherLanguages.map((group) => (
                            <div key={group.letter}>
                              <div className="text-blue-400 text-sm mb-2">{group.letter}</div>
                              <div className="flex flex-wrap gap-2">
                                {group.languages.map((lang) => (
                                  <button key={lang.value} onClick={() => { setLanguage(lang.value); setShowOtherLangPanel(false) }}
                                    className={`px-4 py-1.5 text-xs rounded border ${language === lang.value ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-[#2a2a40] border-[#3a3a50] text-gray-300 hover:border-blue-500'}`}>
                                    {lang.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dialects.map((dialect) => (
                            <button key={dialect.value} onClick={() => { setLanguage(dialect.value); setShowOtherLangPanel(false) }}
                              className={`w-full px-4 py-2 text-xs rounded border text-left flex items-center justify-between ${language === dialect.value ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-[#2a2a40] border-[#3a3a50] text-gray-300 hover:border-blue-500'}`}>
                              <span>{dialect.label}</span>
                              {language === dialect.value && <Check className="w-4 h-4 text-blue-400" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 输出目录 */}
        <div className="flex items-center justify-between">
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
            <button onClick={handleSelectDirectory} disabled={outputType === 'original'} className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-[#2a2a40] ${outputType === 'original' ? 'bg-[#1a1a2a] text-gray-500 cursor-not-allowed' : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300'}`}>
              <Folder className="w-3.5 h-3.5" /><span>{t('footer.change')}</span>
            </button>
            <button onClick={handleOpenFolder} className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]">
              <FolderOpen className="w-3.5 h-3.5" /><span>{OPEN_FOLDER_TEXT}</span>
            </button>
            <button onClick={handleTranscribeAll} disabled={files.length === 0 || isProcessing}
              className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-xs">
              {isProcessing ? t('stt.transcribing') : t('stt.start_transcribe')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
