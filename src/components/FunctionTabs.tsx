import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, useEffect, useCallback } from 'react'
import { t } from '../utils/i18n'

interface FunctionTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

// 使用 ID 作为稳定标识符，label 使用翻译函数
const tabs = [
  { id: '音频转换', icon: '🎵', label: () => t('functions.audio_convert') },
  { id: '音频剪切', icon: '✂️', label: () => t('functions.audio_cut') },
  { id: '视频提取音频', icon: '🎬', label: () => t('functions.video_extract_audio.title') },
  { id: '音频合并', icon: '🔗', label: () => t('functions.audio_merge') },
  { id: '音频转文字', icon: '📝', label: () => t('functions.audio_to_text') },
  { id: '人声-伴奏提取', icon: '👥', label: () => t('functions.vocal_separate') },
  { id: '音量调整', icon: '🔊', label: () => t('functions.volume_adjust') },
  { id: '音频录制', icon: '🎙️', label: () => t('functions.audio_record') },
  { id: '音频压缩', icon: '📦', label: () => t('functions.audio_compress') },
  { id: '音频降噪', icon: '🔇', label: () => t('functions.audio_denoise') },
  { id: '音频变速', icon: '⏩', label: () => t('functions.audio_speed') },
  { id: '添加背景音', icon: '🎶', label: () => t('functions.add_bgm') },
  { id: '文字转语音', icon: '🗣️', label: () => t('functions.text_to_speech.title') },
  { id: '淡入淡出', icon: '📈', label: () => t('functions.fade_in_out') },
  { id: '音频变声', icon: '🎭', label: () => t('functions.voice_change') },
  { id: '视频替换音频', icon: '🔄', label: () => t('functions.video_replace_audio.title') },
  { id: '音频倒放', icon: '⏪', label: () => t('functions.audio_reverse') },
  { id: '截去静音', icon: '🔕', label: () => t('functions.remove_silence.title') },
  { id: '回声', icon: '🔉', label: () => t('functions.echo.title') },
  { id: '均衡器', icon: '🎚️', label: () => t('functions.equalizer.title') },
  { id: '生成噪音', icon: '📻', label: () => t('functions.noise_generator.title') },
  { id: '翻译', icon: '🌐', label: () => {
    const title = t('functions.translate.title');
    return title !== 'functions.translate.title' ? title : t('functions.translate');
  } },
  { id: '添加封面', icon: '🖼️', label: () => t('functions.add_cover.title') },
  { id: '视频消除人声', icon: '🚫', label: () => t('functions.video_remove_vocal.title') },
  { id: '人声增强', icon: '🎤', label: () => t('functions.vocal_enhance.title') },
  { id: '增加音效', icon: '✨', label: () => t('functions.add_effect.title') },
]

export default function FunctionTabs({ activeTab, onTabChange }: FunctionTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      const maxScroll = scrollWidth - clientWidth
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < maxScroll - 10)
      setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0)
    }
  }, [])

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [checkScroll])

  // 切换到上一个/下一个功能
  const switchTab = (direction: 'prev' | 'next') => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    let newIndex: number
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
    } else {
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
    }
    
    onTabChange(tabs[newIndex].id)
    
    // 滚动到新选中的标签
    setTimeout(() => {
      const tabElements = scrollRef.current?.children
      if (tabElements && tabElements[newIndex]) {
        const tabElement = tabElements[newIndex] as HTMLElement
        tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        setTimeout(checkScroll, 300)
      }
    }, 0)
  }

  // 滑动条拖动处理
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (scrollRef.current) {
      const { scrollWidth, clientWidth } = scrollRef.current
      const maxScroll = scrollWidth - clientWidth
      const newScrollLeft = (parseFloat(e.target.value) / 100) * maxScroll
      scrollRef.current.scrollLeft = newScrollLeft
    }
  }

  return (
    <div className="bg-[#12121e] border-b border-[#1e2235] flex flex-col">
      {/* Tabs Row */}
      <div className="flex items-center h-16">
        {/* Left Arrow - 切换到上一个功能 */}
        <button
          onClick={() => switchTab('prev')}
          className="px-2 h-full hover:bg-[#1e2235] transition-colors flex items-center"
        >
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>

        {/* Tabs Container */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex-1 flex overflow-x-auto scrollbar-hide py-2 gap-x-1"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center justify-center flex-shrink-0 min-w-[80px] px-3 py-1.5 rounded transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#1e2235]'
                }`}
              >
                <span className="text-lg mb-0.5">{tab.icon}</span>
                <span className="text-[10px] text-center w-full truncate px-1" title={tab.label()}>
                  {tab.label()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Right Arrow - 切换到下一个功能 */}
        <button
          onClick={() => switchTab('next')}
          className="px-2 h-full hover:bg-[#1e2235] transition-colors flex items-center"
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Scrollbar - 增加滑动条长度 */}
      <div className="pb-3 pt-1 mx-2">
        <div className="relative h-1.5 bg-[#1e2235] rounded-full w-full">
          <input
            type="range"
            min="0"
            max="100"
            value={scrollProgress * 100}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-8 -top-3 opacity-0 cursor-pointer z-10"
          />
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-150"
            style={{ 
              width: '35%',
              left: `${scrollProgress * 65}%`
            }}
          />
        </div>
      </div>
    </div>
  )
}
