import { Plus, FolderPlus, Trash2, FileAudio, Music, Play, FolderOpen, CheckCircle, XCircle } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import { openFolder } from '../services/api'
import { useAppContext } from '../context/AppContext'
import { openOutputFolder, OPEN_FOLDER_TEXT } from '../utils/audioUtils'
import { t } from '../utils/i18n'

interface AudioFile {
  id: string
  file: File
  name: string
  size: number
  duration: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  error?: string
  outputPath?: string
}

// 结果弹窗状态
interface ResultModalState {
  show: boolean
  success: boolean
  message: string
  outputPath?: string
}

const PRESETS = [
  { id: 'default', name: t('equalizer.presets.default'), bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'custom', name: t('equalizer.presets.custom'), bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'ska', name: t('equalizer.presets.ska'), bands: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2] },
  { id: 'country', name: t('equalizer.presets.country'), bands: [2, 1, 0, -1, 0, 1, 2, 3, 3, 2] },
  { id: 'bass', name: t('equalizer.presets.bass'), bands: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { id: 'classical', name: t('equalizer.presets.classical'), bands: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
  { id: 'vocal', name: t('equalizer.presets.vocal'), bands: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
  { id: 'blues', name: t('equalizer.presets.blues'), bands: [2, 1, 0, 0, -1, 0, 1, 2, 3, 3] },
  { id: 'rock', name: t('equalizer.presets.rock'), bands: [4, 3, 1, 0, -1, -1, 0, 2, 3, 4] },
  { id: 'folk', name: t('equalizer.presets.folk'), bands: [1, 2, 2, 1, 0, 0, 1, 2, 2, 1] },
  { id: 'energy', name: t('equalizer.presets.energy'), bands: [3, 2, 1, 2, 3, 3, 2, 1, 2, 3] },
  { id: 'pop', name: t('equalizer.presets.pop'), bands: [-1, 0, 2, 4, 4, 3, 1, 0, -1, -1] },
  { id: 'electronic', name: t('equalizer.presets.electronic'), bands: [4, 3, 1, 0, -2, -2, 0, 2, 4, 5] },
  { id: 'hardrock', name: t('equalizer.presets.hardrock'), bands: [5, 4, 2, 0, -2, -1, 1, 3, 4, 5] },
  { id: 'dance', name: t('equalizer.presets.dance'), bands: [5, 4, 2, 0, -1, 0, 2, 4, 4, 3] },
  { id: 'light', name: t('equalizer.presets.light'), bands: [2, 2, 1, 0, 0, 0, 0, 1, 2, 2] },
]

const BANDS = [
  { key: 'band31', freq: '031', label: '031' },
  { key: 'band62', freq: '062', label: '062' },
  { key: 'band125', freq: '125', label: '125' },
  { key: 'band250', freq: '250', label: '250' },
  { key: 'band600', freq: '600', label: '600' },
  { key: 'band1k', freq: '1K', label: '1K' },
  { key: 'band2k', freq: '2K', label: '2K' },
  { key: 'band4k', freq: '4K', label: '4K' },
  { key: 'band8k', freq: '8K', label: '8K' },
  { key: 'band16k', freq: '16K', label: '16K' },
]

export default function EqualizerArea() {
  const [isDragging, setIsDragging] = useState(false)
  const [currentFile, setCurrentFile] = useState<AudioFile | null>(null)
  const [preset, setPreset] = useState('default')
  const [bands, setBands] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [selectionStart, setSelectionStart] = useState(0) // 选择起点百分比 0-1
  const [selectionEnd, setSelectionEnd] = useState(1) // 选择终点百分比 0-1
  const [draggingHandle, setDraggingHandle] = useState<'start' | 'end' | null>(null)
  const [resultModal, setResultModal] = useState<ResultModalState>({ show: false, success: false, message: '' })
  
  const [draggingBand, setDraggingBand] = useState<number | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveformContainerRef = useRef<HTMLDivElement>(null)
  const bandRefs = useRef<(HTMLDivElement | null)[]>([])

  const { registerProcessHandler, unregisterProcessHandler, checkAndShowAuthCode, globalOutputPath } = useAppContext()

  // 处理均衡器滑块拖拽
  useEffect(() => {
    if (draggingBand === null) return

    const handleMouseMove = (e: MouseEvent) => {
      const bandEl = bandRefs.current[draggingBand]
      if (!bandEl) return
      
      const rect = bandEl.getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height
      
      // 计算值：顶部是+12，底部是-12
      const ratio = 1 - Math.max(0, Math.min(1, y / height))
      const value = Math.round(ratio * 24 - 12)
      
      const newBands = [...bands]
      newBands[draggingBand] = value
      setBands(newBands)
      if (preset !== 'custom') setPreset('custom')
    }

    const handleMouseUp = () => {
      setDraggingBand(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingBand, bands, preset])

  const handleProcessAll = useCallback(async () => {
    console.log('handleProcessAll 被调用了')
    
    if (!currentFile) {
      setResultModal({ show: true, success: false, message: t('equalizer.select_file_first') })
      return
    }

    const isAuthorized = await checkAndShowAuthCode()
    if (!isAuthorized) {
      console.log('授权码验证失败')
      return
    }

    console.log('开始处理均衡器，参数:', { currentFile: currentFile.name, bands, selectionStart, selectionEnd, globalOutputPath })

    try {
      // 调用后端API处理均衡器
      const formData = new FormData()
      formData.append('file', currentFile.file)
      formData.append('bands', JSON.stringify(bands))
      formData.append('selection_start', selectionStart.toString())
      formData.append('selection_end', selectionEnd.toString())
      formData.append('output_path', globalOutputPath || '')

      console.log('发送请求到后端...')
      const response = await fetch('http://127.0.0.1:8001/api/equalizer', {
        method: 'POST',
        body: formData
      })

      console.log('后端响应状态:', response.status)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${t('equalizer.process_failed')}`)
      }

      const result = await response.json()
      setResultModal({ 
        show: true, 
        success: true, 
        message: t('equalizer.process_success'), 
        outputPath: result.output_path 
      })
      console.log('均衡器处理结果:', result)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('common.unknown_error')
      setResultModal({ show: true, success: false, message: t('equalizer.process_failed_prefix') + errorMsg })
      console.error('均衡器处理错误:', error)
    }
  }, [currentFile, bands, selectionStart, selectionEnd, globalOutputPath, checkAndShowAuthCode])

  useEffect(() => {
    registerProcessHandler(t('functions.equalizer'), handleProcessAll)
    return () => unregisterProcessHandler(t('functions.equalizer'))
  }, [registerProcessHandler, unregisterProcessHandler, handleProcessAll])

  // 创建音频URL和波形
  useEffect(() => {
    if (currentFile?.file) {
      const url = URL.createObjectURL(currentFile.file)
      setAudioUrl(url)
      generateWaveform(currentFile.file)
      return () => {
        if (audioRef.current) {
          const prev = audioRef.current.src
          audioRef.current.pause()
          audioRef.current.src = ''
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        } else {
          URL.revokeObjectURL(url)
        }
      }
    } else {
      return () => {
        if (audioRef.current) {
          const prev = audioRef.current.src
          audioRef.current.pause()
          audioRef.current.src = ''
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        }
      }
    }
  }, [currentFile])

  // 绘制波形
  useEffect(() => {
    if (canvasRef.current && waveformData.length > 0) {
      drawWaveform()
    }
  }, [waveformData, currentTime, currentFile?.duration, selectionStart, selectionEnd])

  // 重置选择区域当文件改变时
  useEffect(() => {
    if (currentFile) {
      setSelectionStart(0)
      setSelectionEnd(1)
    }
  }, [currentFile?.id])

  // 处理拖动
  useEffect(() => {
    if (!draggingHandle) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!waveformContainerRef.current) return
      const rect = waveformContainerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const progress = Math.max(0, Math.min(1, x / rect.width))

      if (draggingHandle === 'start') {
        setSelectionStart(Math.min(progress, selectionEnd - 0.01))
      } else {
        setSelectionEnd(Math.max(progress, selectionStart + 0.01))
      }
    }

    const handleMouseUp = () => {
      setDraggingHandle(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingHandle, selectionStart, selectionEnd])

  const generateWaveform = async (audioFile: File) => {
    try {
      const audioContext = new AudioContext()
      const arrayBuffer = await audioFile.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const channelData = audioBuffer.getChannelData(0)
      
      const samples = 400
      const blockSize = Math.floor(channelData.length / samples)
      const waveform: number[] = []
      
      for (let i = 0; i < samples; i++) {
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(channelData[i * blockSize + j])
        }
        waveform.push(sum / blockSize)
      }
      
      const maxVal = Math.max(...waveform)
      const normalized = waveform.map(v => v / maxVal)
      setWaveformData(normalized)
    } catch {
      const mockWaveform = Array.from({ length: 400 }, () => Math.random() * 0.5 + 0.1)
      setWaveformData(mockWaveform)
    }
  }

  const drawWaveform = () => {
    const canvas = canvasRef.current
    if (!canvas || !currentFile) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const width = canvas.width
    const height = canvas.height
    const centerY = height / 2
    const duration = currentFile.duration || 1
    
    ctx.clearRect(0, 0, width, height)
    
    const barWidth = width / waveformData.length
    const playProgress = currentTime / duration
    
    // 绘制波形
    waveformData.forEach((value, index) => {
      const x = index * barWidth
      const barHeight = value * height * 0.8
      const progress = index / waveformData.length
      
      // 判断是否在选择区域内
      const inSelection = progress >= selectionStart && progress <= selectionEnd
      
      // 渐变色：从蓝色到绿色到黄色
      const hue = 180 + progress * 60 // 从青色到黄绿色
      if (inSelection) {
        ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
      } else {
        ctx.fillStyle = `hsl(${hue}, 30%, 30%)` // 未选中区域变暗
      }
      
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 0.5, 1), barHeight)
    })
    
    // 播放位置线
    if (duration > 0) {
      const playX = playProgress * width
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playX, 0)
      ctx.lineTo(playX, height)
      ctx.stroke()
      
      // 时间标签 - 在波形中间显示
      ctx.fillStyle = '#1a1f2e'
      ctx.fillRect(playX - 35, height / 2 - 10, 70, 20)
      ctx.strokeStyle = '#3a4050'
      ctx.strokeRect(playX - 35, height / 2 - 10, 70, 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(formatTime(currentTime), playX, height / 2 + 4)
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('audio/') || /\.(mp3|wav|flac|aac|ogg|m4a|wma)$/i.test(f.name)
    )
    if (droppedFiles.length > 0) {
      addFile(droppedFiles[0])
    }
  }

  const addFile = async (file: File) => {
    const duration = await getAudioDuration(file)
    const audioFile: AudioFile = {
      id: Math.random().toString(36).substring(2, 11),
      file,
      name: file.name,
      size: file.size,
      duration,
      status: 'pending'
    }
    setCurrentFile(audioFile)
    setCurrentTime(0)
    setIsPlaying(false)
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

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      addFile(e.target.files[0])
    }
    e.target.value = ''
  }

  const handlePresetChange = (presetId: string) => {
    setPreset(presetId)
    const selectedPreset = PRESETS.find(p => p.id === presetId)
    if (selectedPreset && presetId !== 'custom') {
      setBands([...selectedPreset.bands])
    }
  }

  const handleBandChange = (index: number, value: number) => {
    const newBands = [...bands]
    newBands[index] = value
    setBands(newBands)
    if (preset !== 'custom') setPreset('custom')
  }

  const handleReset = () => {
    setBands([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    setPreset('default')
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().catch(console.error)
      setIsPlaying(true)
    }
  }

  const stopPlay = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setCurrentTime(0)
      setIsPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentFile) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    const newTime = Math.max(0, Math.min(currentFile.duration, progress * currentFile.duration))
    
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a14]">
      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />

      {!currentFile ? (
        // 空状态 - 拖拽区域
        <div className="flex-1 flex flex-col p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs border border-blue-500">
                <Plus className="w-3.5 h-3.5" /><span>{t('common.add_file')}</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-xs border border-[#2a3a50]">
                <FolderPlus className="w-3.5 h-3.5" /><span>{t('common.add_folder')}</span>
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs">
              <Trash2 className="w-3.5 h-3.5" /><span>{t('common.clear_list')}</span>
            </button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer ${
              isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-[#2a3a50] hover:border-[#3a4a60]'
            }`}
          >
            <div className="relative mb-4">
              <div className="w-20 h-16 bg-[#1a2a40] rounded-lg flex items-center justify-center border border-[#2a3a50]">
                <FileAudio className="w-10 h-10 text-blue-400/60" />
              </div>
              <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg">
                <Music className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-gray-500 text-xs mb-2">{t('main.drag_tip')}</p>
            <p className="text-gray-600 text-[10px]">{t('equalizer.description')}</p>
          </div>
        </div>
      ) : (
        // 编辑模式 - 参考图片布局
        <div className="flex-1 flex flex-col p-4">
          {/* 顶部：文件名和操作按钮 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-white text-sm truncate flex-1" title={currentFile.name}>
              {currentFile.name}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-xs border border-[#2a3a50]"
              >
                {t('equalizer.reselect_file')}
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-xs border border-[#2a3a50]"
              >
                {t('equalizer.reset')}
              </button>
            </div>
          </div>

          {/* 波形显示区域 */}
          <div className="relative mb-2">
            {/* 当前播放时间 - 左上角 */}
            <div className="absolute top-1 left-1 z-10 px-2 py-0.5 bg-[#1a1f2e]/80 rounded text-xs text-white">
              {formatTime(currentTime)}
            </div>
            
            <div ref={waveformContainerRef} className="relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={120}
                className="w-full h-[120px] cursor-pointer rounded"
                onClick={handleWaveformClick}
              />
              
              {/* 左侧选择手柄 */}
              <div
                className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center select-none"
                style={{ left: `calc(${selectionStart * 100}% - 6px)` }}
                onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('start') }}
              >
                <div className="w-3 h-full bg-blue-500 rounded-sm" />
              </div>
              
              {/* 右侧选择手柄 */}
              <div
                className="absolute top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center select-none"
                style={{ left: `calc(${selectionEnd * 100}% - 6px)` }}
                onMouseDown={(e) => { e.preventDefault(); setDraggingHandle('end') }}
              >
                <div className="w-3 h-full bg-blue-500 rounded-sm" />
              </div>
            </div>
            
            {/* 时间显示 */}
            <div className="flex justify-between mt-1">
              <span className="text-xs text-gray-400">{formatTime(selectionStart * currentFile.duration)}</span>
              <span className="text-xs text-gray-400">{formatTime(selectionEnd * currentFile.duration)}</span>
            </div>
          </div>

          {/* 播放控制 - 居中 */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button onClick={togglePlay} className="text-white hover:text-blue-400">
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <Play className="w-6 h-6" fill="currentColor" />
              )}
            </button>
            <button onClick={stopPlay} className="text-white hover:text-blue-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
            </button>
          </div>

          {/* 预设选择 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePresetChange(p.id)}
                className={`px-3 py-1 rounded text-xs transition-colors border ${
                  preset === p.id 
                    ? 'bg-blue-600 text-white border-blue-500' 
                    : 'bg-[#1a2035] text-gray-400 hover:bg-[#252a40] border-[#2a3a50]'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* 10段均衡器 - 柱状样式 */}
          <div className="flex-1 flex items-end justify-between px-4 pb-4">
            {BANDS.map((band, index) => (
              <div key={band.key} className="flex flex-col items-center gap-2">
                {/* 柱状滑块容器 */}
                <div 
                  ref={el => bandRefs.current[index] = el}
                  className="relative h-32 w-8 flex flex-col items-center cursor-pointer select-none group"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setDraggingBand(index)
                    // 立即更新值
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = e.clientY - rect.top
                    const ratio = 1 - Math.max(0, Math.min(1, y / rect.height))
                    const value = Math.round(ratio * 24 - 12)
                    handleBandChange(index, value)
                  }}
                >
                  {/* 背景轨道 */}
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-2 bg-gradient-to-t from-[#1a2a40] via-[#252540] to-[#2a3a50] rounded-sm border border-[#3a4a60]/30" />
                  
                  {/* 中线标记 (0dB) */}
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-500 opacity-60" />
                  <div className="absolute left-1 right-1 top-1/2 h-px bg-gray-400 opacity-40" />
                  
                  {/* 填充柱 - 根据值显示 */}
                  {bands[index] !== 0 && (
                    <div 
                      className={`absolute left-1/2 -translate-x-1/2 w-2 rounded-sm transition-all duration-150 ${
                        bands[index] > 0 
                          ? 'bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400 shadow-lg shadow-blue-500/20' 
                          : 'bg-gradient-to-b from-orange-600 via-orange-500 to-orange-400 shadow-lg shadow-orange-500/20'
                      }`}
                      style={bands[index] > 0 ? { 
                        bottom: '50%',
                        height: `${(bands[index] / 12) * 50}%`,
                      } : {
                        top: '50%',
                        height: `${(-bands[index] / 12) * 50}%`,
                      }}
                    />
                  )}
                  
                  {/* 滑块手柄 */}
                  <div 
                    className={`absolute left-1/2 -translate-x-1/2 w-6 h-3 rounded-md shadow-lg z-10 border-2 border-white/20 transition-all duration-150 ${
                      draggingBand === index 
                        ? 'bg-gradient-to-b from-blue-300 to-blue-500 shadow-blue-500/60 scale-110 border-white/40' 
                        : 'bg-gradient-to-b from-blue-400 to-blue-600 shadow-blue-500/30 group-hover:scale-105 group-hover:shadow-blue-500/50'
                    }`}
                    style={{ 
                      top: `${((12 - bands[index]) / 24) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                  
                  {/* 悬停时的辅助线 */}
                  <div className="absolute left-0 right-0 opacity-0 group-hover:opacity-30 transition-opacity duration-150 pointer-events-none">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div 
                        key={i} 
                        className="absolute left-0 right-0 h-px bg-gray-400" 
                        style={{ top: `${(i + 1) * 20}%` }}
                      />
                    ))}
                  </div>
                </div>
                
                {/* 当前值显示 */}
                <span className={`text-xs font-mono w-8 text-center transition-colors duration-150 ${
                  bands[index] > 0 ? 'text-blue-400 font-semibold' : 
                  bands[index] < 0 ? 'text-orange-400 font-semibold' : 
                  'text-gray-500'
                }`}>
                  {bands[index] > 0 ? `+${bands[index]}` : bands[index]}
                </span>
                
                {/* 频率标签 */}
                <span className="text-xs text-gray-400">{band.label}</span>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => { setIsPlaying(false); setCurrentTime(0) }}
        />
      )}

      {/* 结果弹窗 */}
      {resultModal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] rounded-lg w-80 overflow-hidden shadow-xl border border-[#2a3a50]">
            {/* 内容区域 */}
            <div className="p-6 flex flex-col items-center">
              {resultModal.success ? (
                <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
              ) : (
                <XCircle className="w-12 h-12 text-red-500 mb-3" />
              )}
              <p className={`text-center ${resultModal.success ? 'text-green-400' : 'text-red-400'}`}>
                {resultModal.message}
              </p>
            </div>
            
            {/* 按钮区域 */}
            <div className="px-6 pb-6 flex justify-center gap-3">
              {resultModal.success && resultModal.outputPath && (
                <button
                  onClick={() => openOutputFolder(resultModal.outputPath!)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#2a3a50] hover:bg-[#3a4a60] text-gray-300 rounded text-sm border border-[#3a4a60]"
                >
                  <FolderOpen className="w-4 h-4" />
                  {OPEN_FOLDER_TEXT}
                </button>
              )}
              <button
                onClick={() => setResultModal({ show: false, success: false, message: '' })}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
              >
                {t('settings.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
