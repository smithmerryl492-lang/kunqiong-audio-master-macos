import { useState, useRef } from 'react'
import { ChevronDown, ArrowLeftRight, Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { translateText, translateDocument, translateImage } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { t } from '../utils/i18n'

type TranslateMode = 'text' | 'document' | 'image'

export default function TranslateArea() {
  const { goToTTS } = useAppContext()
  const [activeMode, setActiveMode] = useState<TranslateMode>('text')
  const [sourceText, setSourceText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [sourceLang, setSourceLang] = useState('中文')
  const [targetLang, setTargetLang] = useState('英语')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const modes: { id: TranslateMode; name: string }[] = [
    { id: 'text', name: t('translate.modes.text') },
    { id: 'document', name: t('translate.modes.document') },
    { id: 'image', name: t('translate.modes.image') }
  ]
  
  const languages = [
    { id: '中文', name: t('translate.languages.chinese') },
    { id: '英语', name: t('translate.languages.english') },
    { id: '日语', name: t('translate.languages.japanese') },
    { id: '韩语', name: t('translate.languages.korean') },
    { id: '法语', name: t('translate.languages.french') },
    { id: '德语', name: t('translate.languages.german') },
    { id: '西班牙语', name: t('translate.languages.spanish') },
    { id: '俄语', name: t('translate.languages.russian') }
  ]

  const swapLanguages = () => {
    const temp = sourceLang
    setSourceLang(targetLang)
    setTargetLang(temp)
    if (translatedText && activeMode === 'text') {
      setSourceText(translatedText)
      setTranslatedText(sourceText)
    }
  }

  const handleModeChange = (mode: TranslateMode) => {
    setActiveMode(mode)
    setError('')
    setSelectedFile(null)
    setTranslatedText('')
    setOriginalText('')
  }

  const handleTextTranslate = async () => {
    if (!sourceText.trim()) { setError(t('translate.input_empty')); return }
    setIsLoading(true)
    setError('')
    try {
      const result = await translateText({ text: sourceText, sourceLang, targetLang })
      setTranslatedText(result.translated_text)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('translate.translate_failed'))
    } finally { setIsLoading(false) }
  }

  const handleFileTranslate = async () => {
    if (!selectedFile) { setError(t('translate.select_file')); return }
    setIsLoading(true)
    setError('')
    try {
      const result = activeMode === 'document'
        ? await translateDocument(selectedFile, sourceLang, targetLang)
        : await translateImage(selectedFile, sourceLang, targetLang)
      setOriginalText(result.original_text)
      setTranslatedText(result.translated_text)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('translate.translate_failed'))
    } finally { setIsLoading(false) }
  }

  const handleFileSelect = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { setError(t('translate.file_too_large')); return }
    if (file.size === 0) { setError(t('translate.file_empty')); return }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (activeMode === 'document' && !['txt', 'doc', 'docx'].includes(ext || '')) {
      setError(t('translate.doc_format_error')); return
    }
    if (activeMode === 'image' && !['jpg', 'jpeg', 'png', 'bmp'].includes(ext || '')) {
      setError(t('translate.img_format_error')); return
    }
    setSelectedFile(file)
    setError('')
    setTranslatedText('')
    setOriginalText('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleClear = () => {
    setSourceText('')
    setTranslatedText('')
    setOriginalText('')
    setError('')
    setSelectedFile(null)
  }

  const handleCopy = () => { if (translatedText) navigator.clipboard.writeText(translatedText) }

  const handleDownload = () => {
    if (!translatedText) return
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'translated.txt'
    a.click()
    URL.revokeObjectURL(url)
  }


  const renderTextMode = () => (
    <div className="flex-1 flex p-4 gap-4">
      <div className="flex-1 flex flex-col bg-[#12121e] rounded-lg overflow-hidden">
        <div className="flex-1 p-4">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value.slice(0, 5000))}
            placeholder={t('translate.input_placeholder')}
            className="w-full h-full bg-transparent text-white text-sm resize-none outline-none placeholder-gray-500"
          />
        </div>
        <div className="flex justify-between px-4 pb-2">
          {error && <span className="text-red-400 text-xs">{error}</span>}
          <span className="text-gray-500 text-xs ml-auto">{sourceText.length}/5000</span>
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-[#12121e] rounded-lg overflow-hidden">
        <div className="flex-1 p-4 text-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t('translate.translating')}</span>
            </div>
          ) : translatedText ? (
            <p className="text-white whitespace-pre-wrap">{translatedText}</p>
          ) : (
            <p className="text-gray-500">{t('translate.fallback_text')}</p>
          )}
        </div>
      </div>
    </div>
  )

  const renderFileMode = () => {
    const isDoc = activeMode === 'document'
    const acceptTypes = isDoc ? '.txt,.doc,.docx' : '.jpg,.jpeg,.png,.bmp'
    const formatText = isDoc ? 'doc、docx、txt' : 'jpg、jpeg、png、bmp'
    const typeText = isDoc ? t('translate.modes.document') : t('translate.modes.image')

    // 翻译完成后显示原文和译文
    if (translatedText) {
      return (
        <div className="flex-1 flex p-4 gap-4">
          <div className="flex-1 flex flex-col bg-[#12121e] rounded-lg overflow-hidden p-4">
            <div className="text-gray-400 text-xs mb-2">{t('translate.original_label')}</div>
            <div className="flex-1 text-white text-sm whitespace-pre-wrap overflow-auto">{originalText}</div>
          </div>
          <div className="flex-1 flex flex-col bg-[#12121e] rounded-lg overflow-hidden p-4">
            <div className="text-gray-400 text-xs mb-2">{t('translate.translated_label')}</div>
            <div className="flex-1 text-white text-sm whitespace-pre-wrap overflow-auto">{translatedText}</div>
          </div>
        </div>
      )
    }

    // 已选择文件后显示文件卡片
    if (selectedFile) {
      return (
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 bg-[#1a2a4a] rounded-lg p-4">
            {/* 文件卡片 */}
            <div className="inline-flex items-center gap-3 bg-[#2a3a5a] rounded-lg px-4 py-3">
              <div className="w-10 h-10 rounded bg-[#3a4a6a] flex items-center justify-center">
                {isDoc ? (
                  <span className="text-blue-400 text-xs font-bold">W</span>
                ) : (
                  <ImageIcon className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <span className="text-gray-300 text-sm">{selectedFile.name}</span>
              <button 
                onClick={() => setSelectedFile(null)}
                className="text-gray-400 hover:text-white ml-4 text-lg"
              >
                ×
              </button>
            </div>
            {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
          </div>
          <input ref={fileInputRef} type="file" accept={acceptTypes} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
        </div>
      )
    }

    // 未选择文件时显示上传区域
    return (
      <div className="flex-1 flex flex-col p-4">
        <div
          className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg transition-colors ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a3a5a]'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex items-center gap-8 mb-6">
            <div className="w-16 h-16 rounded-lg bg-[#1a2a4a] flex items-center justify-center">
              {isDoc ? <FileText className="w-8 h-8 text-[#4a6a9a]" /> : <ImageIcon className="w-8 h-8 text-[#4a6a9a]" />}
            </div>
            <div className="text-[#4a6a9a] text-2xl">→</div>
            <div className="w-16 h-16 rounded-lg bg-[#1a2a4a] flex items-center justify-center border-2 border-dashed border-[#4a6a9a]">
              <span className="text-[#4a6a9a] text-2xl">+</span>
            </div>
          </div>
          <p className="text-[#5a7aaa] text-sm mb-1">
            {t('translate.drag_tip').replace('{type}', typeText).replace('{format}', formatText)}
          </p>
          <p className="text-gray-500 text-xs mb-4">
            {t('translate.size_tip').replace('{type}', typeText)}
          </p>
          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
          <input ref={fileInputRef} type="file" accept={acceptTypes} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
            {t('translate.select_button').replace('{type}', typeText)}
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a14]">
      <div className="flex items-center gap-6 px-4 py-3 border-b border-[#1e2235]">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeChange(mode.id)}
            className={`text-sm transition-colors ${activeMode === mode.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {mode.name}
          </button>
        ))}
      </div>

      {activeMode === 'text' ? renderTextMode() : renderFileMode()}

      <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e2235]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="appearance-none bg-transparent text-gray-300 text-sm pr-5 outline-none cursor-pointer">
              {languages.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button onClick={swapLanguages} className="p-1 text-gray-400 hover:text-white transition-colors">
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <div className="relative">
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="appearance-none bg-transparent text-gray-300 text-sm pr-5 outline-none cursor-pointer">
              {languages.map(lang => <option key={lang.id} value={lang.id}>{lang.name}</option>)}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleClear} className="px-6 py-1.5 bg-[#2a2a40] hover:bg-[#3a3a50] text-gray-300 rounded text-sm transition-colors border border-[#3a3a50]">
            {t('translate.clear')}
          </button>
          <button
            onClick={activeMode === 'text' ? handleTextTranslate : handleFileTranslate}
            disabled={isLoading || (activeMode === 'text' ? !sourceText.trim() : !selectedFile)}
            className="px-6 py-1.5 bg-[#4a4a60] hover:bg-[#5a5a70] text-white rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('translate.translating') : t('translate.translate_button')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleCopy} disabled={!translatedText} className="px-6 py-1.5 bg-[#2a2a40] hover:bg-[#3a3a50] text-gray-300 rounded text-sm transition-colors border border-[#3a3a50] disabled:opacity-50 disabled:cursor-not-allowed">
            {t('translate.copy')}
          </button>
          <button onClick={handleDownload} disabled={!translatedText} className="px-6 py-1.5 bg-[#4a4a60] hover:bg-[#5a5a70] text-gray-300 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {t('translate.download_txt')}
          </button>
        </div>

        <button 
          onClick={() => translatedText && goToTTS(translatedText)}
          disabled={!translatedText}
          className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
        >
          {t('translate.to_tts')}
        </button>
      </div>
    </div>
  )
}
