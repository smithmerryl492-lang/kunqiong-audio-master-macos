import { useState, useRef, useCallback, useEffect } from 'react'
import AuthCodeModal from './components/AuthCodeModal'
import UpdateModal, { UpdateInfo } from './components/UpdateModal'
import { useAuthCode } from './hooks/useAuthCode'
import OptimizedTabWrapper from './components/OptimizedTabWrapper'
import { AppContext, AppContextType, SharedFile, ModuleProcessHandler } from './context/AppContext'

import Header from './components/Header'
import FunctionTabs from './components/FunctionTabs'
import MainArea from './components/MainArea'
import AudioCutArea from './components/AudioCutArea'
import VideoExtractAudioArea from './components/VideoExtractAudioArea'
import AudioMergeArea from './components/AudioMergeArea'
import AudioToTextArea from './components/AudioToTextArea'
import VocalExtractArea from './components/VocalExtractArea'
import VolumeAdjustArea from './components/VolumeAdjustArea'
import AudioRecordArea from './components/AudioRecordArea'
import AudioCompressArea from './components/AudioCompressArea'
import AudioDenoiseArea from './components/AudioDenoiseArea'
import AudioSpeedArea from './components/AudioSpeedArea'
import AddBgmArea from './components/AddBgmArea'
import TextToSpeechArea from './components/TextToSpeechArea'
import FadeInOutArea from './components/FadeInOutArea'
import VoiceChangeArea from './components/VoiceChangeArea'
import VideoReplaceAudioArea from './components/VideoReplaceAudioArea'
import AudioReverseArea from './components/AudioReverseArea'
import RemoveSilenceArea from './components/RemoveSilenceArea'
import EchoArea from './components/EchoArea'
import EqualizerArea from './components/EqualizerArea'
import NoiseGeneratorArea from './components/NoiseGeneratorArea'
import TranslateArea from './components/TranslateArea'
import AddCoverArea from './components/AddCoverArea'
import VideoRemoveVocalArea from './components/VideoRemoveVocalArea'
import VocalEnhanceArea from './components/VocalEnhanceArea'
import AddSoundEffectArea from './components/AddSoundEffectArea'
import Footer from './components/Footer'

function App() {
  const [activeTab, setActiveTab] = useState('音频转换')
  const [, setLangTick] = useState(0)
  const [outputFormat, setOutputFormat] = useState('MP3')
  
  // 监听语言变化
  useEffect(() => {
    const handleLanguageChange = () => {
      setLangTick(tick => tick + 1)
    }
    window.addEventListener('languageChange', handleLanguageChange)
    return () => window.removeEventListener('languageChange', handleLanguageChange)
  }, [])
  const [quality, setQuality] = useState(256)
  const [channel, setChannel] = useState('original')
  const [encoding, setEncoding] = useState('VBR')
  const [sampleRate, setSampleRate] = useState('自动')
  const [outputPath, setOutputPath] = useState('')
  const [sharedFiles, setSharedFiles] = useState<Map<string, SharedFile[]>>(new Map())
  const [ttsText, setTtsText] = useState('')
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  // 检查更新
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        // @ts-ignore
        const result = await window.electron.checkUpdate()
        console.log('Update check result:', result)
        if (result && result.has_update) {
          setUpdateInfo(result)
          setShowUpdateModal(true)
        }
      } catch (e) {
        console.error('Failed to check for updates:', e)
      }
    }
    
    // 延迟检查，避免影响启动速度
    const timer = setTimeout(checkUpdate, 3000)
    return () => clearTimeout(timer)
  }, [])
  
  // 授权码相关
  const {
    showAuthCodeModal,
    setShowAuthCodeModal,
    checkAndShowAuthCode,
    handleAuthCodeSuccess,
    handleAuthError,
  } = useAuthCode()
  
  // 模块处理函数注册表
  const processHandlersRef = useRef<Map<string, ModuleProcessHandler>>(new Map())

  const registerProcessHandler = useCallback((module: string, handler: ModuleProcessHandler) => {
    processHandlersRef.current.set(module, handler)
  }, [])

  const unregisterProcessHandler = useCallback((module: string) => {
    processHandlersRef.current.delete(module)
  }, [])

  const triggerProcess = useCallback((module: string) => {
    const handler = processHandlersRef.current.get(module)
    if (handler) handler()
  }, [])

  // 添加文件到指定模块
  const addFilesToModule = (module: string, files: SharedFile[]) => {
    setSharedFiles(prev => {
      const newMap = new Map(prev)
      const existing = newMap.get(module) || []
      newMap.set(module, [...existing, ...files])
      return newMap
    })
    // 切换到目标模块
    setActiveTab(module)
  }

  // 跳转到文字转语音并设置文本
  const goToTTS = (text: string) => {
    setTtsText(text)
    setActiveTab('文字转语音')
  }

  // 这些功能有自己的底部栏，不需要显示通用Footer
  const hideFooterTabs = ['音频录制', '文字转语音', '翻译', '音量调整', '音频压缩', '音频转文字', '音频剪切', '音频降噪', '人声-伴奏提取', '增加音效', '人声增强', '截去静音', '淡入淡出', '回声', '音频变速', '音频倒放', '添加背景音', '音频合并']
  const showFooter = !hideFooterTabs.includes(activeTab)

  const contextValue: AppContextType = {
    sharedFiles,
    addFilesToModule,
    setActiveTab,
    ttsText,
    setTtsText,
    goToTTS,
    registerProcessHandler,
    unregisterProcessHandler,
    triggerProcess,
    checkAndShowAuthCode,
    handleAuthError,
    globalOutputPath: outputPath,
  }

  return (
    <AppContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#0a0a14] flex flex-col">
        <Header />
        <FunctionTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <OptimizedTabWrapper tab="音频转换" activeTab={activeTab}>
          <MainArea outputFormat={outputFormat} setOutputFormat={setOutputFormat} quality={quality} setQuality={setQuality} channel={channel} setChannel={setChannel} encoding={encoding} setEncoding={setEncoding} sampleRate={sampleRate} setSampleRate={setSampleRate} outputPath={outputPath} />
        </OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频剪切" activeTab={activeTab}><AudioCutArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="视频提取音频" activeTab={activeTab}><VideoExtractAudioArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频合并" activeTab={activeTab}><AudioMergeArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频转文字" activeTab={activeTab}><AudioToTextArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="人声-伴奏提取" activeTab={activeTab}><VocalExtractArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音量调整" activeTab={activeTab}><VolumeAdjustArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频录制" activeTab={activeTab}><AudioRecordArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频压缩" activeTab={activeTab}><AudioCompressArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频降噪" activeTab={activeTab}><AudioDenoiseArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频变速" activeTab={activeTab}><AudioSpeedArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="添加背景音" activeTab={activeTab}><AddBgmArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="文字转语音" activeTab={activeTab}><TextToSpeechArea initialText={ttsText} onTextUsed={() => setTtsText('')} /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="淡入淡出" activeTab={activeTab}><FadeInOutArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频变声" activeTab={activeTab}><VoiceChangeArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="视频替换音频" activeTab={activeTab}><VideoReplaceAudioArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="音频倒放" activeTab={activeTab}><AudioReverseArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="截去静音" activeTab={activeTab}><RemoveSilenceArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="回声" activeTab={activeTab}><EchoArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="均衡器" activeTab={activeTab}><EqualizerArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="生成噪音" activeTab={activeTab}><NoiseGeneratorArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="翻译" activeTab={activeTab}><TranslateArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="添加封面" activeTab={activeTab}><AddCoverArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="视频消除人声" activeTab={activeTab}><VideoRemoveVocalArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="人声增强" activeTab={activeTab}><VocalEnhanceArea /></OptimizedTabWrapper>
        <OptimizedTabWrapper tab="增加音效" activeTab={activeTab}><AddSoundEffectArea /></OptimizedTabWrapper>
        {showFooter && <Footer outputPath={outputPath} setOutputPath={setOutputPath} activeTab={activeTab} onProcess={() => triggerProcess(activeTab)} />}

        {/* 授权码弹窗 */}
        <AuthCodeModal
          isOpen={showAuthCodeModal}
          onClose={() => setShowAuthCodeModal(false)}
          onSuccess={handleAuthCodeSuccess}
        />

        {/* 更新提示弹窗 */}
        <UpdateModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          updateInfo={updateInfo}
        />
      </div>
    </AppContext.Provider>
  )
}

export default App
