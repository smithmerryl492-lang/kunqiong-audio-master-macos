import { Search, User, Menu, X, Minus, Square, Headphones, Minimize, Maximize2, X as Close, Globe, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAppContext } from '../context/AppContext'
import LoginPanel from './LoginPanel'
import { authStorage, UserInfo, checkLoginStatus } from '../services/auth'
import { getFeedbackUrl } from '../services/feedback'
import LogoIcon from './LogoIcon'
import { OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t, SUPPORTED_LANGUAGES, setLocale, getCurrentLocale } from '../utils/i18n'

// 窗口控制函数
const minimizeWindow = () => {
  console.log('minimizeWindow called')
  const electron = window.electron as any
  if (electron?.ipcRenderer) {
    console.log('Sending window-minimize message')
    electron.ipcRenderer.send('window-minimize')
  } else {
    console.log('electron.ipcRenderer not available')
  }
}

const maximizeWindow = () => {
  console.log('maximizeWindow called')
  const electron = window.electron as any
  if (electron?.ipcRenderer) {
    console.log('Sending window-maximize message')
    electron.ipcRenderer.send('window-maximize')
  } else {
    console.log('electron.ipcRenderer not available')
  }
}

const closeWindow = () => {
  console.log('closeWindow called')
  const electron = window.electron as any
  if (electron?.ipcRenderer) {
    console.log('Sending window-close message')
    electron.ipcRenderer.send('window-close')
  } else {
    console.log('electron.ipcRenderer not available')
  }
}

export default function Header() {
  const { setActiveTab } = useAppContext()
  
  // 所有功能列表 - 移动到组件内部以响应语言变化
  const ALL_FUNCTIONS = [
    { id: t('functions.audio_convert'), keywords: ['转换', '格式', 'mp3', 'wav', 'flac', 'convert'] },
    { id: t('functions.audio_cut'), keywords: ['剪切', '裁剪', '截取', 'cut', 'trim'] },
    { id: t('functions.video_extract_audio.title'), keywords: ['视频', '提取', 'extract', 'video'] },
    { id: t('functions.audio_merge'), keywords: ['合并', '拼接', 'merge', 'join'] },
    { id: t('functions.audio_to_text'), keywords: ['转文字', '语音识别', 'transcribe', 'stt'] },
    { id: t('functions.vocal_separate'), keywords: ['人声', '伴奏', '分离', 'vocal', 'separate'] },
    { id: t('functions.volume_adjust'), keywords: ['音量', '声音大小', 'volume'] },
    { id: t('functions.audio_record'), keywords: ['录制', '录音', 'record'] },
    { id: t('functions.audio_compress'), keywords: ['压缩', 'compress'] },
    { id: t('functions.audio_denoise'), keywords: ['降噪', '去噪', 'denoise', 'noise'] },
    { id: t('functions.audio_speed'), keywords: ['变速', '加速', '减速', 'speed'] },
    { id: t('functions.add_bgm'), keywords: ['背景音', 'bgm', '背景音乐'] },
    { id: t('functions.text_to_speech.title'), keywords: ['文字转语音', 'tts', '语音合成', '朗读'] },
    { id: t('functions.fade_in_out'), keywords: ['淡入', '淡出', 'fade'] },
    { id: t('functions.voice_change'), keywords: ['变声', '声音变换', 'voice change'] },
    { id: t('functions.video_replace_audio.title'), keywords: ['替换', '视频音频', 'replace'] },
    { id: t('functions.audio_reverse'), keywords: ['倒放', '倒转', 'reverse'] },
    { id: t('functions.remove_silence.title'), keywords: ['静音', '去静音', 'silence'] },
    { id: t('functions.echo.title'), keywords: ['回声', 'echo'] },
    { id: t('functions.equalizer.title'), keywords: ['均衡器', 'eq', 'equalizer'] },
    { id: t('functions.noise_generator.title'), keywords: ['噪音', '白噪音', 'noise generator'] },
    { id: t('functions.translate.title'), keywords: ['翻译', 'translate', '翻译文字', '图片翻译'] },
    { id: t('functions.add_cover.title'), keywords: ['封面', 'cover', '专辑封面'] },
    { id: t('functions.video_remove_vocal.title'), keywords: ['消除人声', '去人声', '视频人声'] },
    { id: t('functions.vocal_enhance.title'), keywords: ['人声增强', '增强', 'enhance'] },
    { id: t('functions.add_effect.title'), keywords: ['音效', 'effect', '特效'] },
  ]
  const [searchText, setSearchText] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showAboutModal, setShowAboutModal] = useState(false)
  const [showLoginPanel, setShowLoginPanel] = useState(false)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [filteredFunctions, setFilteredFunctions] = useState<typeof ALL_FUNCTIONS>([])
  const [version, setVersion] = useState('1.0.0')
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const languageDropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // 获取版本号
  useEffect(() => {
    const getVersion = async () => {
      try {
        // @ts-ignore
        const v = await window.electron.getAppVersion()
        if (v) setVersion(v)
      } catch (e) {
        console.error('Failed to get app version:', e)
      }
    }
    getVersion()
  }, [])
  
  // 设置弹窗状态
  const [settingsTab, setSettingsTab] = useState<'audio' | 'general'>('audio')
  const [settings, setSettings] = useState({
    // 音频转换设置
    autoProcess: t('settings.not_add_to_queue'),
    cpuCores: t('settings.min_cpu_cores'),
    newFileOnTop: true,
    outputFileName: t('settings.overwrite_existing'),
    concurrentFiles: '10',
    openOutputFolder: false,
    // 通用设置
    taskCompleteSound: false,
    autoStartOnBoot: false,
  })
  
  // 滚动到指定区域
  const audioSectionRef = useRef<HTMLDivElement>(null)
  const generalSectionRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  const scrollToSection = (section: 'audio' | 'general') => {
    setSettingsTab(section)
    const ref = section === 'audio' ? audioSectionRef : generalSectionRef
    ref.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  // 监听滚动，自动切换左侧标签
  const handleSettingsScroll = () => {
    if (!scrollContainerRef.current || !generalSectionRef.current) return
    const container = scrollContainerRef.current
    const generalSection = generalSectionRef.current
    const generalTop = generalSection.offsetTop - container.offsetTop
    const scrollTop = container.scrollTop
    
    if (scrollTop >= generalTop - 50) {
      setSettingsTab('general')
    } else {
      setSettingsTab('audio')
    }
  }

  // 加载保存的设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings')
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
  }, [])

  // 搜索过滤
  useEffect(() => {
    if (searchText.trim()) {
      const query = searchText.toLowerCase()
      const filtered = ALL_FUNCTIONS.filter(func => 
        func.id.toLowerCase().includes(query) ||
        func.keywords.some(kw => kw.toLowerCase().includes(query))
      )
      setFilteredFunctions(filtered)
      setShowDropdown(true)
    } else {
      setFilteredFunctions([])
      setShowDropdown(false)
    }
  }, [searchText])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
        setShowLanguageDropdown(false)
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const storedUserInfo = authStorage.getUserInfo()
      if (storedUserInfo) {
        setUserInfo(storedUserInfo)
        setIsLoggedIn(true)
      } else {
        const loggedIn = await checkLoginStatus()
        if (loggedIn) {
          const token = authStorage.getToken()
          if (token) {
            try {
              const info = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_user_info', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'token': token,
                },
              })
              const result = await info.json()
              if (result.code === 1 && result.data?.user_info) {
                setUserInfo(result.data.user_info)
                authStorage.setUserInfo(result.data.user_info)
                setIsLoggedIn(true)
              }
            } catch (e) {
              console.error('Failed to get user info:', e)
            }
          }
        }
      }
    }
    checkAuth()
  }, [])

  // 选择功能
  const selectFunction = (funcId: string) => {
    setActiveTab(funcId)
    setSearchText('')
    setShowDropdown(false)
  }

  // 回车搜索
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredFunctions.length > 0) {
      selectFunction(filteredFunctions[0].id)
    }
    if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <>
    <header className="h-11 bg-[#12121e] border-b border-[#1e2235] flex items-center justify-between px-3 select-none" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* Left side - Logo */}
      <div className="flex items-center gap-2">
        <LogoIcon />
        <span className="text-white font-medium text-sm">{t('header.app_name')}</span>
        <span className="px-1.5 py-0.5 rounded bg-[#1e2235] text-[10px] text-gray-400 border border-[#2a2a40]">v{version}</span>
        <span className="text-gray-500 text-xs">{t('header.kunqiong_product')}</span>
      </div>

      {/* Right side - Search, Login, Menu, Window Controls */}
      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="relative" ref={languageDropdownRef} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a2e] border border-[#2a2a40] rounded hover:border-[#3a3a50] transition-colors text-gray-300 hover:text-white"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-xs">{SUPPORTED_LANGUAGES.find(l => l.code === getCurrentLocale())?.name || 'Language'}</span>
          </button>

          {showLanguageDropdown && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-[#1a1a2e] border border-[#2a2a40] rounded shadow-lg z-[100] max-h-80 overflow-y-auto custom-scrollbar" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <div className="py-1">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLocale(lang.code)
                      setShowLanguageDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between transition-colors ${
                      getCurrentLocale() === lang.code 
                        ? 'bg-blue-600/20 text-blue-400' 
                        : 'text-gray-300 hover:bg-[#2a2a40] hover:text-white'
                    }`}
                  >
                    <span>{lang.name}</span>
                    {getCurrentLocale() === lang.code && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative" ref={dropdownRef} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center bg-[#1a1a2e] rounded px-2 py-1 border border-[#2a2a40]">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchText && setShowDropdown(true)}
              placeholder={t('header.input_function_name')}
              className="bg-transparent text-xs text-gray-300 outline-none w-28 placeholder-gray-500"
            />
            <Search 
              className="w-3.5 h-3.5 text-gray-400 ml-1 cursor-pointer hover:text-white" 
              onClick={() => filteredFunctions.length > 0 && selectFunction(filteredFunctions[0].id)}
            />
          </div>
          
          {/* 搜索下拉框 */}
          {showDropdown && filteredFunctions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a2e] border border-[#2a2a40] rounded shadow-lg z-50 max-h-64 overflow-auto" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {filteredFunctions.map(func => (
                <button
                  key={func.id}
                  onClick={() => selectFunction(func.id)}
                  className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-[#2a2a40] hover:text-white transition-colors"
                >
                  {func.id}
                </button>
              ))}
            </div>
          )}
          
          {/* 无结果提示 */}
          {showDropdown && searchText && filteredFunctions.length === 0 && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a2e] border border-[#2a2a40] rounded shadow-lg z-50 p-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <p className="text-xs text-gray-500">{t('header.no_result')}</p>
            </div>
          )}
        </div>

        {/* 软件定制 / 联系我们 按钮 */}
        <button 
          onClick={async () => {
            try {
              console.log('开始获取定制链接...')
              const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_custom_url', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: ''
              })
              const result = await response.json()
              console.log('API响应:', result)
              if (result.code === 1 && result.data?.url) {
                const customUrl = result.data.url
                console.log('定制链接:', customUrl)
                
                // 直接使用window.open打开链接
                console.log('使用window.open打开链接')
                window.open(customUrl, '_blank')
              } else {
                throw new Error(result.msg || t('header.get_custom_url_failed'))
              }
            } catch (error) {
              console.error('打开定制链接失败:', error)
              alert(t('header.get_custom_url_failed'))
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded text-xs font-medium transition-all shadow-lg hover:shadow-xl"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span>{t('header.software_custom')}</span>
        </button>

        {/* 问题反馈 按钮 */}
        <button 
          onClick={async () => {
            try {
              const urlBase = await getFeedbackUrl()
              if (urlBase) {
                const fullUrl = `${urlBase}10003`
                window.open(fullUrl, '_blank')
              } else {
                alert(t('header.get_feedback_url_failed'))
              }
            } catch (e) {
              console.error('Feedback error:', e)
              alert(t('header.get_feedback_url_failed'))
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white rounded text-xs font-medium transition-all shadow-lg hover:shadow-xl"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <span>{t('header.problem_feedback')}</span>
        </button>

        {/* Login/Register */}
        <button 
          onClick={() => setShowLoginPanel(true)}
          className="flex items-center gap-1 text-gray-300 text-xs hover:text-white transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <User className="w-3.5 h-3.5" />
          <span>{isLoggedIn ? userInfo?.nickname : t('header.login_register')}</span>
        </button>

        {/* Menu */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-1 text-gray-300 text-xs hover:text-white"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Menu className="w-3.5 h-3.5" />
            <span>{t('header.menu')}</span>
          </button>
          
          {/* 菜单下拉框 */}
          {showMenu && (
            <div className="absolute top-full right-0 mt-2 w-36 bg-[#1a2a3a] border border-[#2a3a4a] rounded-lg shadow-lg z-50" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {/* 小三角 */}
              <div className="absolute -top-2 right-4 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-[#2a3a4a]" />
              <div className="absolute -top-[6px] right-4 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-[#1a2a3a]" />
              
              <div className="py-2">
                <button
                  onClick={() => { setShowMenu(false); setShowSettingsModal(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a3a4a] hover:text-white transition-colors"
                >
                  {t('header.software_settings')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowHelpModal(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a3a4a] hover:text-white transition-colors"
                >
                  {t('header.help_center')}
                </button>
                <button
                  onClick={async () => {
                    setShowMenu(false)
                    try {
                      const urlBase = await getFeedbackUrl()
                      if (urlBase) {
                        const fullUrl = `${urlBase}10003`
                        window.open(fullUrl, '_blank')
                      } else {
                        alert(t('header.get_feedback_url_failed'))
                      }
                    } catch (e) {
                      console.error('Feedback error:', e)
                      alert(t('header.get_feedback_url_failed'))
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a3a4a] hover:text-white transition-colors"
                >
                  {t('header.problem_feedback')}
                </button>
                <button
                  onClick={() => { setShowMenu(false); setShowAboutModal(true) }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a3a4a] hover:text-white transition-colors"
                >
                  {t('header.about_us')}
                </button>
                <button
                  onClick={async () => {
                    setShowMenu(false)
                    try {
                      console.log('菜单：开始获取定制链接...')
                      const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_custom_url', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: ''
                      })
                      const result = await response.json()
                      console.log('菜单：API响应:', result)
                      if (result.code === 1 && result.data?.url) {
                        const customUrl = result.data.url
                        console.log('菜单：定制链接:', customUrl)
                        
                        // 直接使用window.open打开链接
                        console.log('菜单：使用window.open打开链接')
                        window.open(customUrl, '_blank')
                      } else {
                        throw new Error(result.msg || t('header.get_custom_url_failed'))
                      }
                    } catch (error) {
                      console.error('菜单：打开定制链接失败:', error)
                      alert(t('header.get_custom_url_failed'))
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:bg-[#2a3a4a] hover:text-white transition-colors"
                >
                  {t('header.software_custom')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1 ml-2 border-l border-[#2a2a40] pl-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button onClick={minimizeWindow} className="p-1 hover:bg-[#2a2a40] rounded">
            <Minus className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={maximizeWindow} className="p-1 hover:bg-[#2a2a40] rounded">
            <Square className="w-3 h-3 text-gray-400" />
          </button>
          <button onClick={closeWindow} className="p-1 hover:bg-red-600 rounded">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>
    </header>

    {/* 软件设置模态框 */}
    {showSettingsModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSettingsModal(false)}>
        <div className="bg-[#1e2a3a] rounded-lg w-[650px] h-[500px] flex overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* 左侧边栏 */}
          <div className="w-[120px] bg-[#162030] flex flex-col py-2">
            <button
              onClick={() => scrollToSection('audio')}
              className={`px-4 py-3 text-left text-sm transition-colors ${
                settingsTab === 'audio' 
                  ? 'bg-[#1e2a3a] text-white border-l-2 border-blue-500' 
                  : 'text-gray-400 hover:text-white hover:bg-[#1a2535]'
              }`}
            >
              {t('settings.audio')}
            </button>
            <button
              onClick={() => scrollToSection('general')}
              className={`px-4 py-3 text-left text-sm transition-colors ${
                settingsTab === 'general' 
                  ? 'bg-[#1e2a3a] text-white border-l-2 border-blue-500' 
                  : 'text-gray-400 hover:text-white hover:bg-[#1a2535]'
              }`}
            >
              {t('settings.general')}
            </button>
          </div>
          
          {/* 右侧内容区 */}
          <div className="flex-1 flex flex-col">
            {/* 标题栏 */}
            <div className="px-5 py-3 border-b border-[#2a3a50] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1 h-4 bg-blue-500 rounded"></div>
                  <div className="w-1 h-3 bg-blue-400 rounded"></div>
                  <div className="w-1 h-4 bg-blue-500 rounded"></div>
                  <div className="w-1 h-2 bg-blue-400 rounded"></div>
                </div>
                <h3 className="text-white text-sm font-medium">{t('header.software_settings')}</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* 设置内容 - 可滚动 */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleSettingsScroll}
              className="flex-1 p-5 overflow-auto"
            >
              {/* 音频转换部分 */}
              <div ref={audioSectionRef} className="space-y-5">
                {/* 自动处理 */}
                <div>
                  <div className="text-gray-300 text-sm mb-2">{t('settings.auto_process')}</div>
                  <select 
                    value={settings.autoProcess}
                    onChange={(e) => setSettings({...settings, autoProcess: e.target.value})}
                    className="w-full bg-[#162030] text-gray-300 text-sm rounded px-3 py-2.5 outline-none border border-[#2a3a50] focus:border-blue-500 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option>{t('settings.not_add_to_queue')}</option>
                    <option>{t('settings.add_to_queue')}</option>
                  </select>
                </div>
                
                {/* CPU内核数 */}
                <div>
                  <div className="text-gray-300 text-sm mb-2">{t('settings.cpu_cores')}</div>
                  <select 
                    value={settings.cpuCores}
                    onChange={(e) => setSettings({...settings, cpuCores: e.target.value})}
                    className="w-full bg-[#162030] text-gray-300 text-sm rounded px-3 py-2.5 outline-none border border-[#2a3a50] focus:border-blue-500 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option>{t('settings.min_cpu_cores')}</option>
                    <option>{t('settings.max_cpu_cores')}</option>
                  </select>
                </div>
                
                {/* 添加文件 */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">{t('common.add_file')}</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.newFileOnTop}
                      onChange={(e) => setSettings({...settings, newFileOnTop: e.target.checked})}
                      className="w-4 h-4 accent-blue-500 cursor-pointer rounded border-gray-500"
                    />
                    <span className="text-gray-400 text-sm">{t('settings.new_file_on_top')}</span>
                  </label>
                </div>
                
                {/* 输出文件名 */}
                <div>
                  <div className="text-gray-300 text-sm mb-2">{t('settings.output_file_name')}</div>
                  <select 
                    value={settings.outputFileName}
                    onChange={(e) => setSettings({...settings, outputFileName: e.target.value})}
                    className="w-full bg-[#162030] text-gray-300 text-sm rounded px-3 py-2.5 outline-none border border-[#2a3a50] focus:border-blue-500 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option>{t('settings.auto_rename')}</option>
                    <option>{t('settings.overwrite_existing')}</option>
                  </select>
                </div>
                
                {/* 同时转换文件数 */}
                <div>
                  <div className="text-gray-300 text-sm mb-2">{t('settings.concurrent_files')}</div>
                  <select 
                    value={settings.concurrentFiles}
                    onChange={(e) => setSettings({...settings, concurrentFiles: e.target.value})}
                    className="w-full bg-[#162030] text-gray-300 text-sm rounded px-3 py-2.5 outline-none border border-[#2a3a50] focus:border-blue-500 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                
                {/* 转换完成后 */}
                <div>
                  <div className="text-gray-300 text-sm mb-2">{t('common.status.done')}</div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={settings.openOutputFolder}
                      onChange={(e) => setSettings({...settings, openOutputFolder: e.target.checked})}
                      className="w-4 h-4 accent-blue-500 cursor-pointer rounded border-gray-500"
                    />
                    <span className="text-gray-400 text-sm">{t('settings.open_output_folder')}</span>
                  </label>
                </div>
                
                {/* 分隔线 */}
                <div className="border-t border-[#2a3a50] my-4"></div>
                
                {/* 通用设置部分 */}
                <div ref={generalSectionRef}>
                  <h4 className="text-white text-base font-medium mb-4">{t('settings.general')}</h4>
                  
                  {/* 任务完成提示音 */}
                  <div className="mb-4">
                    <div className="text-gray-300 text-sm mb-2">{t('settings.task_complete_sound')}</div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={settings.taskCompleteSound}
                          onChange={() => setSettings({...settings, taskCompleteSound: true})}
                          className="w-4 h-4 accent-blue-500 cursor-pointer rounded"
                        />
                        <span className="text-gray-400 text-sm">{t('settings.on')}</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={!settings.taskCompleteSound}
                          onChange={() => setSettings({...settings, taskCompleteSound: false})}
                          className="w-4 h-4 accent-blue-500 cursor-pointer rounded"
                        />
                        <span className="text-gray-400 text-sm">{t('settings.off')}</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* 开机启动 */}
                  <div>
                    <div className="text-gray-300 text-sm mb-2">{t('settings.auto_start_on_boot')}</div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.autoStartOnBoot}
                        onChange={(e) => setSettings({...settings, autoStartOnBoot: e.target.checked})}
                        className="w-4 h-4 accent-blue-500 cursor-pointer rounded border-gray-500"
                      />
                      <span className="text-gray-400 text-sm">{t('settings.auto_start_on_boot')}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 底部按钮 */}
            <div className="px-5 py-3 border-t border-[#2a3a50] flex justify-end gap-3">
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-1.5 bg-[#2a3a50] hover:bg-[#3a4a60] text-gray-300 text-sm rounded transition-colors"
              >
                {t('settings.cancel')}
              </button>
              <button 
                onClick={() => {
                  // 保存设置到 localStorage
                  localStorage.setItem('appSettings', JSON.stringify(settings))
                  setShowSettingsModal(false)
                }}
                className="px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              >
                {t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* 帮助中心模态框 */}
    {showHelpModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHelpModal(false)}>
        <div className="bg-[#1a1a2e] rounded-lg w-[500px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-[#2a3a50] flex justify-between items-center">
            <h3 className="text-white text-sm font-medium">{t('header.help_center')}</h3>
            <button onClick={() => setShowHelpModal(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-[#12121e] rounded p-3">
              <h4 className="text-white text-sm mb-2">{t('header.common_questions')}</h4>
              <ul className="text-gray-400 text-xs space-y-2">
                <li>• {t('header.help_convert')}</li>
                <li>• {t('header.help_cut')}</li>
                <li>• {t('header.help_extract')}</li>
                <li>• {t('header.help_merge')}</li>
              </ul>
            </div>

          </div>
          <div className="p-4 border-t border-[#2a3a50] flex justify-end">
            <button 
              onClick={() => setShowHelpModal(false)}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            >
              {t('settings.close')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 关于我们模态框 */}
    {showAboutModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAboutModal(false)}>
        <div className="bg-[#1a1a2e] rounded-lg w-[350px]" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-[#2a3a50] flex justify-between items-center">
            <h3 className="text-white text-sm font-medium">{t('header.about_us')}</h3>
            <button onClick={() => setShowAboutModal(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Headphones className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-white text-lg font-medium mb-2">{t('header.app_name')}</h4>
            <p className="text-gray-400 text-sm mb-4">{t('header.version')} {version}</p>
            <p className="text-gray-500 text-xs">
              {t('header.app_description')}
            </p>
          </div>
          <div className="p-4 border-t border-[#2a3a50] flex justify-center">
            <button 
              onClick={() => setShowAboutModal(false)}
              className="px-6 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
            >
              {t('settings.confirm')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* 登录面板 */}
    <LoginPanel
      isOpen={showLoginPanel}
      onClose={() => setShowLoginPanel(false)}
      onLoginSuccess={(info) => {
        setUserInfo(info)
        setIsLoggedIn(true)
      }}
      onLogout={() => {
        setUserInfo(null)
        setIsLoggedIn(false)
      }}
      userInfo={userInfo}
      isLoggedIn={isLoggedIn}
    />
    </>
  )
}
