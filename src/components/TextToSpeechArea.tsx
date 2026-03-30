import { Folder, FolderOpen, RotateCcw, Loader2, Play, Pause, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { textToSpeech, previewTTSWithTimestamps, selectDirectory, openFolder, TTSVoice, SentenceTimestamp } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface TextToSpeechAreaProps {
  initialText?: string
  onTextUsed?: () => void
}

// 多音字映射表
const POLYPHONE_MAP: Record<string, string[]> = {
  '重': ['chóng', 'zhòng'],
  '长': ['cháng', 'zhǎng'],
  '行': ['xíng', 'háng'],
  '乐': ['lè', 'yuè'],
  '了': ['le', 'liǎo'],
  '得': ['de', 'dé', 'děi'],
  '地': ['de', 'dì'],
  '还': ['hái', 'huán'],
  '发': ['fā', 'fà'],
  '数': ['shù', 'shǔ'],
  '着': ['zhe', 'zháo', 'zhāo', 'zhuó'],
  '为': ['wéi', 'wèi'],
  '说': ['shuō', 'shuì'],
  '和': ['hé', 'hè', 'huó', 'huò'],
  '种': ['zhǒng', 'zhòng'],
  '觉': ['jué', 'jiào'],
  '好': ['hǎo', 'hào'],
  '看': ['kàn', 'kān'],
  '只': ['zhī', 'zhǐ'],
  '会': ['huì', 'kuài'],
  '大': ['dà', 'dài'],
  '少': ['shǎo', 'shào'],
  '都': ['dōu', 'dū'],
  '没': ['méi', 'mò'],
  '要': ['yào', 'yāo'],
  '相': ['xiāng', 'xiàng'],
  '间': ['jiān', 'jiàn'],
  '分': ['fēn', 'fèn'],
  '应': ['yīng', 'yìng'],
  '当': ['dāng', 'dàng'],
  '难': ['nán', 'nàn'],
  '传': ['chuán', 'zhuàn'],
  '便': ['biàn', 'pián'],
  '空': ['kōng', 'kòng'],
  '干': ['gān', 'gàn'],
  '调': ['diào', 'tiáo'],
  '处': ['chǔ', 'chù'],
  '强': ['qiáng', 'qiǎng', 'jiàng'],
  '教': ['jiāo', 'jiào'],
  '乘': ['chéng', 'shèng'],
  '降': ['jiàng', 'xiáng'],
  '弹': ['dàn', 'tán'],
  '率': ['lǜ', 'shuài'],
  '模': ['mó', 'mú'],
  '曾': ['céng', 'zēng'],
  '朝': ['cháo', 'zhāo'],
  '藏': ['cáng', 'zàng'],
  '血': ['xuè', 'xiě'],
  '角': ['jiǎo', 'jué'],
  '量': ['liàng', 'liáng'],
  '参': ['cān', 'shēn', 'cēn'],
}

// 数字读法选项
const NUMBER_READING_OPTIONS = [
  { id: 'default', name: t('text_to_speech.numbers.default'), desc: t('text_to_speech.numbers.default_desc') },
  { id: 'digit', name: t('text_to_speech.numbers.digit'), desc: t('text_to_speech.numbers.digit_desc') },
  { id: 'number', name: t('text_to_speech.numbers.number'), desc: t('text_to_speech.numbers.number_desc') },
  { id: 'phone', name: t('text_to_speech.numbers.phone'), desc: t('text_to_speech.numbers.phone_desc') },
]

// 间隔选项 - 按图片样式：0.5s, 1s, 1.5s, 2s, 2.5s, 3s, 5s
const PAUSE_OPTIONS = [
  { id: '0.5s', time: '0.5s', display: '[0.5s]' },
  { id: '1s', time: '1s', display: '[1s]' },
  { id: '1.5s', time: '1.5s', display: '[1.5s]' },
  { id: '2s', time: '2s', display: '[2s]' },
  { id: '2.5s', time: '2.5s', display: '[2.5s]' },
  { id: '3s', time: '3s', display: '[3s]' },
  { id: '5s', time: '5s', display: '[5s]' },
]

const STATIC_TTS_VOICES: { chinese: TTSVoice[]; english: TTSVoice[] } = {
  chinese: [
    { id: 'zh-CN-XiaoxiaoNeural', name: t('text_to_speech.voices.xiaoxiao'), gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.gentle') },
    { id: 'zh-CN-XiaoyiNeural', name: t('text_to_speech.voices.xiaoyi'), gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.lively') },
    { id: 'zh-CN-YunjianNeural', name: t('text_to_speech.voices.yunjian'), gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.sunny') },
    { id: 'zh-CN-YunxiNeural', name: t('text_to_speech.voices.yunxi'), gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.mild') },
    { id: 'zh-CN-YunxiaNeural', name: t('text_to_speech.voices.yunxia'), gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.boy') },
    { id: 'zh-CN-YunyangNeural', name: t('text_to_speech.voices.yunyang'), gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.news') },
    { id: 'zh-CN-liaoning-XiaobeiNeural', name: t('text_to_speech.voices.xiaobei'), gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.dongbei') },
    { id: 'zh-CN-shaanxi-XiaoniNeural', name: t('text_to_speech.voices.xiaoni'), gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.shaanxi') },
    { id: 'zh-TW-HsiaoChenNeural', name: t('text_to_speech.voices.hsiaochen'), gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.taiwan') },
    { id: 'zh-TW-YunJheNeural', name: t('text_to_speech.voices.yunjhe'), gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.taiwan') },
    { id: 'zh-HK-HiuGaaiNeural', name: t('text_to_speech.voices.hiugaai'), gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.cantonese') },
    { id: 'zh-HK-WanLungNeural', name: t('text_to_speech.voices.wanlung'), gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.cantonese') },
  ],
  english: [
    { id: 'en-US-JennyNeural', name: 'Jenny', gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.us_english') },
    { id: 'en-US-GuyNeural', name: 'Guy', gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.us_english') },
    { id: 'en-US-AriaNeural', name: 'Aria', gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.us_english') },
    { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: t('text_to_speech.voices.female'), style: t('text_to_speech.styles.uk_english') },
    { id: 'en-GB-RyanNeural', name: 'Ryan', gender: t('text_to_speech.voices.male'), style: t('text_to_speech.styles.uk_english') },
  ],
}

export default function TextToSpeechArea({ initialText, onTextUsed }: TextToSpeechAreaProps) {
  const [text, setText] = useState('')
  const [voices] = useState<{ chinese: TTSVoice[], english: TTSVoice[] }>(STATIC_TTS_VOICES)
  const [selectedVoice, setSelectedVoice] = useState('zh-CN-XiaoxiaoNeural')
  const [voiceName, setVoiceName] = useState(`${t('text_to_speech.voices.xiaoxiao')}-${t('text_to_speech.styles.gentle')}`)
  const [volume, setVolume] = useState(5)
  const [speed, setSpeed] = useState(5)
  const [pitch, setPitch] = useState(5)
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [outputPath, setOutputPath] = useState('')
  const [outputType, setOutputType] = useState<'original' | 'custom'>('original')
  const [isConverting, setIsConverting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showVoiceModal, setShowVoiceModal] = useState(false)
  const [showPolyphoneModal, setShowPolyphoneModal] = useState(false)
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [showNumberMenu, setShowNumberMenu] = useState(false)
  const [numberReadingMode, setNumberReadingMode] = useState('default')
  const [selectedPolyphone, setSelectedPolyphone] = useState<{ char: string; index: number } | null>(null)
  const [polyphoneMarks, setPolyphoneMarks] = useState<Map<number, string>>(new Map()) // index -> pinyin
  const [result, setResult] = useState<{ success: boolean; message: string; path?: string } | null>(null)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(-1) // 当前播放的句子索引
  const [sentenceTimestamps, setSentenceTimestamps] = useState<SentenceTimestamp[]>([]) // 带时间戳的句子数组
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const animationFrameRef = useRef<number | null>(null) // 用于动画帧更新
  const { checkAndShowAuthCode } = useAppContext()

  // 接收从其他页面传来的文本
  useEffect(() => {
    if (initialText) {
      setText(initialText.slice(0, 3000))
      onTextUsed?.()
    }
  }, [initialText, onTextUsed])

  // 将 0-10 的滑块值转换为 API 参数
  const sliderToRate = (val: number) => (val - 5) * 20  // -100 到 +100
  const sliderToPitch = (val: number) => (val - 5) * 10  // -50 到 +50
  const sliderToVolume = (val: number) => (val - 5) * 20  // -100 到 +100

  const handleSelectDirectory = async () => {
    try {
      const result = await selectDirectory(outputPath)
      if (result.success && result.path) {
        setOutputPath(result.path)
      }
    } catch (err) {
      console.error(t('footer.select_dir_failed'), err)
    }
  }

  const handleOpenFolder = async () => {
    if (outputPath) {
      await openOutputFolder(outputPath)
    }
  }

  // 根据当前播放时间更新高亮句子
  const updateCurrentSentence = (currentTime: number, timestamps: SentenceTimestamp[]) => {
    for (let i = 0; i < timestamps.length; i++) {
      const sentence = timestamps[i]
      if (currentTime >= sentence.start && currentTime < sentence.end) {
        setCurrentSentenceIndex(i)
        return
      }
    }
    // 如果超过最后一句的结束时间，高亮最后一句
    if (timestamps.length > 0 && currentTime >= timestamps[timestamps.length - 1].start) {
      setCurrentSentenceIndex(timestamps.length - 1)
    }
  }

  // 方案B：一次性生成音频，根据时间戳同步高亮
  const handlePreview = async () => {
    // 如果正在播放，则停止
    if (isPlaying) {
      stopPlayback()
      return
    }

    if (!text.trim()) {
      setResult({ success: false, message: t('text_to_speech.input_empty') })
      return
    }

    setIsPreviewing(true)
    setResult(null)

    try {
      // 获取带时间戳的音频
      const response = await previewTTSWithTimestamps(
        text,
        selectedVoice,
        sliderToRate(speed),
        sliderToPitch(pitch),
        sliderToVolume(volume)
      )

      if (!response.success) {
        throw new Error(t('text_to_speech.generate_failed'))
      }

      setSentenceTimestamps(response.sentences)
      setCurrentSentenceIndex(0)
      setIsPlaying(true)
      setIsPreviewing(false)

      // 创建音频并播放
      const audio = new Audio(`http://127.0.0.1:8001${response.audio_url}`)
      audioRef.current = audio

      // 使用 requestAnimationFrame 实时更新高亮
      const updateHighlight = () => {
        if (audioRef.current && !audioRef.current.paused) {
          updateCurrentSentence(audioRef.current.currentTime, response.sentences)
          animationFrameRef.current = requestAnimationFrame(updateHighlight)
        }
      }

      audio.onplay = () => {
        animationFrameRef.current = requestAnimationFrame(updateHighlight)
      }

      audio.onended = () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        setIsPlaying(false)
        setCurrentSentenceIndex(-1)
        setSentenceTimestamps([])
      }

      audio.onerror = () => {
        setResult({ success: false, message: t('text_to_speech.play_failed') })
        stopPlayback()
      }

      await audio.play()
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : t('text_to_speech.preview_failed') })
      setIsPreviewing(false)
    }
  }

  // 停止播放
  const stopPlayback = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setIsPlaying(false)
    setCurrentSentenceIndex(-1)
    setSentenceTimestamps([])
    setIsPreviewing(false)
  }

  const handleConvert = async () => {
    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) return

    if (!text.trim()) {
      setResult({ success: false, message: t('text_to_speech.input_empty') })
      return
    }

    setIsConverting(true)
    setResult(null)

    try {
      const res = await textToSpeech({
        text,
        voice: selectedVoice,
        rate: sliderToRate(speed),
        pitch: sliderToPitch(pitch),
        volume: sliderToVolume(volume),
        outputFormat,
        outputPath
      })

      setResult({ success: true, message: t('text_to_speech.convert_success'), path: res.output_path })
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : t('text_to_speech.convert_failed') })
    } finally {
      setIsConverting(false)
    }
  }

  const selectVoice = (voice: TTSVoice) => {
    setSelectedVoice(voice.id)
    setVoiceName(`${voice.name}-${voice.style}`)
    setShowVoiceModal(false)
  }

  const handleImportTxt = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const content = await file.text()
        setText(content.slice(0, 3000))
      }
    }
    input.click()
  }

  // 清空文本
  const handleClearText = () => {
    setText('')
    setResult(null)
  }

  // 插入间隔标记
  const insertPause = (pause: typeof PAUSE_OPTIONS[0]) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newText = text.slice(0, start) + pause.display + text.slice(end)
      setText(newText.slice(0, 3000))
      // 恢复光标位置
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + pause.display.length, start + pause.display.length)
      }, 0)
    } else {
      setText((text + pause.display).slice(0, 3000))
    }
    setShowPauseMenu(false)
  }

  // 点击多音字选择读音
  const handlePolyphoneClick = (char: string, index: number) => {
    setSelectedPolyphone({ char, index })
  }

  // 选择多音字的读音
  const selectPolyphonePinyin = (pinyin: string) => {
    if (selectedPolyphone) {
      setPolyphoneMarks(prev => {
        const newMap = new Map(prev)
        newMap.set(selectedPolyphone.index, pinyin)
        return newMap
      })
      setSelectedPolyphone(null)
    }
  }

  // 确认多音字标注，将标注应用到文本
  const confirmPolyphoneMarks = () => {
    if (polyphoneMarks.size === 0) {
      setShowPolyphoneModal(false)
      return
    }
    
    // 从后往前替换，避免索引变化
    const sortedMarks = Array.from(polyphoneMarks.entries()).sort((a, b) => b[0] - a[0])
    let newText = text
    for (const [index, pinyin] of sortedMarks) {
      const char = text[index]
      const mark = `[${char}:${pinyin}]`
      newText = newText.slice(0, index) + mark + newText.slice(index + 1)
    }
    setText(newText.slice(0, 3000))
    setPolyphoneMarks(new Map())
    setShowPolyphoneModal(false)
  }

  // 取消多音字读音标注
  const cancelPolyphoneMark = (index: number) => {
    setPolyphoneMarks(prev => {
      const newMap = new Map(prev)
      newMap.delete(index)
      return newMap
    })
    setSelectedPolyphone(null)
  }

  // 设置数字读法
  const handleNumberReading = (mode: string) => {
    setNumberReadingMode(mode)
    setShowNumberMenu(false)
    // 可以在这里添加提示
    setResult({ success: true, message: `${t('text_to_speech.number_reading')}${NUMBER_READING_OPTIONS.find(o => o.id === mode)?.name}` })
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a14]">
      <div className="flex-1 flex">
        {/* Left Panel - Text Input */}
        <div className="flex-1 flex flex-col p-4 border-r border-[#1e2235]">
          <div className="text-gray-500 text-xs mb-2 space-y-0.5">
            <p>1.{t('text_to_speech.input_empty')}</p>
            <p>2.{t('text_to_speech.step_2')}</p>
            <p>3.{t('text_to_speech.step_3')}</p>
          </div>

          <div className="flex-1 bg-[#12121e] rounded border border-[#1e2235] p-3 mb-3 overflow-auto">
            {isPlaying && sentenceTimestamps.length > 0 ? (
              // 播放时显示高亮文本
              <div className="text-sm leading-relaxed">
                {sentenceTimestamps.map((sentence, index) => (
                  <span
                    key={index}
                    className={`${
                      index === currentSentenceIndex
                        ? 'text-blue-400'
                        : index < currentSentenceIndex
                        ? 'text-gray-500'
                        : 'text-gray-300'
                    }`}
                  >
                    {sentence.text}
                  </span>
                ))}
              </div>
            ) : (
              // 正常编辑模式
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 3000))}
                placeholder={t('text_to_speech.placeholder')}
                className="w-full h-full bg-transparent text-gray-300 text-sm outline-none resize-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* 清空文本 */}
              <button 
                onClick={handleClearText}
                className="px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
              >
                {t('text_to_speech.clear_text')}
              </button>
              {/* 示例文本 */}
              <button 
                onClick={() => setText(t('text_to_speech.example_content'))}
                className="px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
              >
                {t('text_to_speech.example_text')}
              </button>
              {/* 导入TXT文件 */}
              <button 
                onClick={handleImportTxt}
                className="px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
              >
                {t('text_to_speech.import_txt')}
              </button>
              {/* 多音字 */}
              <button 
                onClick={() => setShowPolyphoneModal(true)}
                className="px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
              >
                {t('text_to_speech.polyphone')}
              </button>
              {/* 插入间隔 - 点击显示/隐藏 */}
              <div className="relative">
                <button 
                  onClick={() => setShowPauseMenu(!showPauseMenu)}
                  className="flex items-center gap-1 px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
                >
                  {t('text_to_speech.insert_pause')}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showPauseMenu ? 'rotate-180' : ''}`} />
                </button>
                {showPauseMenu && (
                  <>
                    {/* 点击外部关闭的遮罩层 */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowPauseMenu(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-1 bg-[#2a3a50] border border-[#3a4a60] rounded-lg shadow-lg z-20 p-4">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        {PAUSE_OPTIONS.slice(0, 6).map(pause => (
                          <button
                            key={pause.id}
                            onClick={() => insertPause(pause)}
                            className="text-gray-300 hover:text-blue-400 text-sm transition-colors"
                          >
                            {pause.time}
                          </button>
                        ))}
                      </div>
                      {PAUSE_OPTIONS.length > 6 && (
                        <div className="mt-4 pt-2 border-t border-[#3a4a60]">
                          <button
                            onClick={() => insertPause(PAUSE_OPTIONS[6])}
                            className="text-gray-300 hover:text-blue-400 text-sm transition-colors"
                          >
                            {PAUSE_OPTIONS[6].time}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* 数字读法 - 点击显示/隐藏 */}
              <div className="relative">
                <button 
                  onClick={() => setShowNumberMenu(!showNumberMenu)}
                  className="flex items-center gap-1 px-4 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
                >
                  {t('text_to_speech.number_reading')}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showNumberMenu ? 'rotate-180' : ''}`} />
                </button>
                {showNumberMenu && (
                  <>
                    {/* 点击外部关闭的遮罩层 */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowNumberMenu(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a2e] border border-[#2a3a50] rounded shadow-lg z-20 min-w-[180px]">
                      {NUMBER_READING_OPTIONS.map(option => (
                        <button
                          key={option.id}
                          onClick={() => handleNumberReading(option.id)}
                          className={`block w-full px-4 py-2 text-left text-xs hover:bg-[#2a2a40] ${
                            numberReadingMode === option.id ? 'text-blue-400' : 'text-gray-300'
                          }`}
                        >
                          <div>{option.name}</div>
                          <div className="text-gray-500 text-[10px]">{option.desc}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <span className="text-gray-500 text-xs">{text.length}/3000</span>
          </div>

          {/* Result Message */}
          {result && (
            <div className={`mt-3 p-2 rounded text-xs ${result.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              {result.message}
            </div>
          )}
        </div>

        {/* Right Panel - Settings */}
        <div className="w-72 p-4 flex flex-col gap-4">
          {/* Voice Type */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-16">{t('text_to_speech.voice_type')}</span>
            <button 
              onClick={() => setShowVoiceModal(true)}
              className="flex-1 px-3 py-1.5 bg-[#1e2235] text-gray-300 rounded text-xs border border-[#2a2a40] text-left truncate"
            >
              {voiceName}
            </button>
            <button 
              onClick={() => setShowVoiceModal(true)}
              className="text-blue-400 text-xs hover:text-blue-300"
            >
              {t('footer.change')}
            </button>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-16">{t('text_to_speech.volume')}</span>
            <input
              type="range"
              min="0"
              max="10"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 h-1 rounded appearance-none cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${volume * 10}%, #2a2a40 ${volume * 10}%, #2a2a40 100%)`
              }}
            />
            <span className="text-gray-300 text-xs w-6">{volume}</span>
            <button onClick={() => setVolume(5)} className="text-gray-500 hover:text-gray-300">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed Slider */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-16">{t('text_to_speech.speed')}</span>
            <input
              type="range"
              min="0"
              max="10"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="flex-1 h-1 rounded appearance-none cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${speed * 10}%, #2a2a40 ${speed * 10}%, #2a2a40 100%)`
              }}
            />
            <span className="text-gray-300 text-xs w-6">{speed}</span>
            <button onClick={() => setSpeed(5)} className="text-gray-500 hover:text-gray-300">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pitch Slider */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-16">{t('text_to_speech.pitch')}</span>
            <input
              type="range"
              min="0"
              max="10"
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="flex-1 h-1 rounded appearance-none cursor-pointer accent-blue-500"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${pitch * 10}%, #2a2a40 ${pitch * 10}%, #2a2a40 100%)`
              }}
            />
            <span className="text-gray-300 text-xs w-6">{pitch}</span>
            <button onClick={() => setPitch(5)} className="text-gray-500 hover:text-gray-300">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border-t border-[#1e2235] my-2" />

          {/* Output Format */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-16">{t('text_to_speech.output_format')}</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={outputFormat === 'mp3'}
                  onChange={() => setOutputFormat('mp3')}
                  className="w-3.5 h-3.5 accent-blue-500"
                />
                <span className="text-gray-300 text-xs">MP3</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={outputFormat === 'wav'}
                  onChange={() => setOutputFormat('wav')}
                  className="w-3.5 h-3.5 accent-blue-500"
                />
                <span className="text-gray-300 text-xs">WAV</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="h-16 bg-[#12121e] border-t border-[#1e2235] flex items-center px-4">
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-xs">{t('footer.output_dir')}</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={outputType === 'original'} onChange={() => setOutputType('original')} className="w-3 h-3 accent-blue-500" />
              <span>{t('footer.original')}</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="radio" checked={outputType === 'custom'} onChange={() => setOutputType('custom')} className="w-3 h-3 accent-blue-500" />
              <span>{t('footer.custom')}</span>
            </label>
          </div>
          <input
            type="text"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            placeholder="默认输出到 outputs 目录"
            disabled={outputType === 'original'}
            className={`w-72 bg-[#0a0a14] border border-[#2a2a40] rounded px-2 py-1.5 text-xs outline-none ${outputType === 'original' ? 'text-gray-500 opacity-60' : 'text-gray-400'}`}
          />
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button 
            onClick={handleSelectDirectory}
            disabled={outputType === 'original'}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs border border-[#2a2a40] ${outputType === 'original' ? 'bg-[#1a1a2a] text-gray-500 cursor-not-allowed' : 'bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300'}`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{t('footer.change_dir')}</span>
          </button>
          <button 
            onClick={handleOpenFolder}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#1e2235] hover:bg-[#2a2a40] text-gray-300 rounded text-xs border border-[#2a2a40]"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>{OPEN_FOLDER_TEXT}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button 
            onClick={handlePreview}
            disabled={!isPlaying && !text.trim()}
            className={`flex items-center gap-1.5 px-6 py-2 rounded text-xs border ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white' 
                : 'bg-[#1e2235] hover:bg-[#2a2a40] border-[#2a2a40] text-gray-300 disabled:opacity-50'
            }`}
          >
            {isPreviewing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            {isPlaying ? t('text_to_speech.stop_playback') : t('text_to_speech.preview')}
          </button>
          <button 
            onClick={handleConvert}
            disabled={isConverting || !text.trim()}
            className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded text-xs"
          >
            {isConverting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t('text_to_speech.start_convert')}
          </button>
        </div>
      </div>

      {/* Polyphone Selection Modal */}
      {showPolyphoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowPolyphoneModal(false); setSelectedPolyphone(null); setPolyphoneMarks(new Map()) }}>
          <div className="bg-[#1a1a2e] rounded-lg w-[700px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#2a3a50]">
              <p className="text-gray-400 text-sm">{t('text_to_speech.polyphone_tip')}</p>
            </div>
            
            {/* 文本显示区域 */}
            <div className="flex-1 p-4 overflow-auto min-h-[300px]">
              <div className="bg-[#12121e] rounded p-4 min-h-[250px] border border-[#2a3a50] relative">
                {text ? (
                  <div className="text-base leading-relaxed flex flex-wrap">
                    {text.split('').map((char, index) => {
                      const isPolyphone = POLYPHONE_MAP[char]
                      const markedPinyin = polyphoneMarks.get(index)
                      const isSelected = selectedPolyphone?.index === index
                      
                      return (
                        <span key={index} className="relative inline-block">
                          <span
                            onClick={() => isPolyphone && handlePolyphoneClick(char, index)}
                            className={`${
                              isPolyphone 
                                ? 'text-yellow-400 cursor-pointer hover:bg-yellow-400/20' 
                                : 'text-gray-300'
                            } ${isSelected ? 'bg-yellow-400/30' : ''}`}
                          >
                            {char}
                          </span>
                          {markedPinyin && (
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-blue-400 whitespace-nowrap">
                              {markedPinyin}
                            </span>
                          )}
                          
                          {/* 拼音选择下拉 */}
                          {isSelected && POLYPHONE_MAP[char] && (
                            <div className="absolute top-full left-0 mt-1 bg-[#2a3a50] border border-[#3a4a60] rounded shadow-lg z-20 flex items-center gap-1 p-1">
                              {POLYPHONE_MAP[char].map((pinyin, idx) => (
                                <button
                                  key={idx}
                                  onClick={(e) => { e.stopPropagation(); selectPolyphonePinyin(pinyin) }}
                                  className={`px-2 py-1 text-xs rounded hover:bg-blue-600 hover:text-white transition-colors ${
                                    markedPinyin === pinyin ? 'bg-blue-600 text-white' : 'text-gray-300 bg-[#1e2235]'
                                  }`}
                                >
                                  {pinyin}
                                </button>
                              ))}
                              {markedPinyin && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); cancelPolyphoneMark(index) }}
                                  className="px-1.5 py-1 text-xs text-gray-400 hover:text-red-400"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}
                        </span>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">{t('text_to_speech.placeholder')}</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[#2a3a50] flex justify-end">
              <button 
                onClick={confirmPolyphoneMarks}
                className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                {t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Selection Modal */}
      {showVoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowVoiceModal(false)}>
          <div className="bg-[#1a1a2e] rounded-lg p-4 w-[500px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-white text-sm font-medium mb-4">{t('text_to_speech.select_voice')}</h3>
            
            <div className="mb-4">
              <h4 className="text-gray-400 text-xs mb-2">{t('text_to_speech.chinese_voice')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {voices.chinese.map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => selectVoice(voice)}
                    className={`p-2 rounded text-left text-xs border ${
                      selectedVoice === voice.id 
                        ? 'border-blue-500 bg-blue-500/20 text-white' 
                        : 'border-[#2a3a50] bg-[#12121e] text-gray-300 hover:border-[#3a4a60]'
                    }`}
                  >
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-gray-500 text-[10px]">{voice.gender} · {voice.style}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-gray-400 text-xs mb-2">{t('text_to_speech.english_voice')}</h4>
              <div className="grid grid-cols-2 gap-2">
                {voices.english.map(voice => (
                  <button
                    key={voice.id}
                    onClick={() => selectVoice(voice)}
                    className={`p-2 rounded text-left text-xs border ${
                      selectedVoice === voice.id 
                        ? 'border-blue-500 bg-blue-500/20 text-white' 
                        : 'border-[#2a3a50] bg-[#12121e] text-gray-300 hover:border-[#3a4a60]'
                    }`}
                  >
                    <div className="font-medium">{voice.name}</div>
                    <div className="text-gray-500 text-[10px]">{voice.gender} · {voice.style}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button 
                onClick={() => setShowVoiceModal(false)}
                className="px-4 py-1.5 bg-[#2a3a50] hover:bg-[#3a4a60] text-white text-xs rounded"
              >
                {t('settings.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
