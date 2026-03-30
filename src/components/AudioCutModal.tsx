import { X, Pause, Play, Square, Volume2, RotateCcw, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { t } from '../utils/i18n'

// 错误边界组件
class ErrorBoundary extends Component<{ children: ReactNode; onError?: () => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onError?: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AudioCutModal Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#1a1f2e] rounded-lg p-8 text-center">
            <p className="text-white mb-4">{t('cut_modal.error_loading')}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false })
                this.props.onError?.()
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            >
              {t('settings.close')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

interface CutSegmentData {
  id: string
  startTime: number
  endTime: number
}

interface AudioCutModalProps {
  isOpen: boolean
  onClose: () => void
  file: File | null
  fileName: string
  duration: number
  initialStartTime?: number
  initialEndTime?: number
  onConfirm: (startTime: number, endTime: number, segments?: CutSegmentData[]) => void
}

interface CutSegment {
  id: string
  startTime: number
  endTime: number
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

function parseTime(timeStr: string): number {
  const parts = timeStr.split(':')
  if (parts.length !== 3) return 0
  const [h, m, rest] = parts
  const [s, ms] = rest.split('.')
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + (parseInt(ms) || 0) / 1000
}

export default function AudioCutModal({ isOpen, onClose, file, fileName, duration, initialStartTime, initialEndTime, onConfirm }: AudioCutModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(duration)
  const [volume, setVolume] = useState(50)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null)
  const [dragStartX, setDragStartX] = useState(0)
  const [dragStartValue, setDragStartValue] = useState({ start: 0, end: 0 })
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [cutMode, setCutMode] = useState<'manual' | 'average' | 'time'>('manual')
  const [segments, setSegments] = useState<CutSegment[]>([])
  const [averageCount, setAverageCount] = useState(2)
  const [timeSplitDuration, setTimeSplitDuration] = useState(30)
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // 创建和清理音频 URL
  useEffect(() => {
    if (file && isOpen) {
      const url = URL.createObjectURL(file)
      setAudioUrl(url)
      return () => {
        if (audioRef.current) {
          const prev = audioRef.current.src
          audioRef.current.pause()
          audioRef.current.src = ''
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        } else {
          URL.revokeObjectURL(url)
        }
        setAudioUrl(null)
      }
    }
  }, [file, isOpen])

  useEffect(() => {
    if (isOpen) {
      setStartTime(initialStartTime ?? 0)
      setEndTime(initialEndTime ?? duration)
      setCurrentTime(initialStartTime ?? 0)
      setIsPlaying(false)
      setSegments([])
      setCutMode('manual')
    }
  }, [isOpen, duration, initialStartTime, initialEndTime])

  useEffect(() => {
    if (file && isOpen) {
      generateWaveform(file)
    }
  }, [file, isOpen])

  const generateWaveform = async (audioFile: File) => {
    try {
      const audioContext = new AudioContext()
      const arrayBuffer = await audioFile.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const channelData = audioBuffer.getChannelData(0)
      
      const samples = 300
      const blockSize = Math.floor(channelData.length / samples)
      if (blockSize <= 0) {
        throw new Error('Audio file too short')
      }
      const waveform: number[] = []
      
      for (let i = 0; i < samples; i++) {
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
          const idx = i * blockSize + j
          if (idx < channelData.length) {
            sum += Math.abs(channelData[idx])
          }
        }
        waveform.push(sum / blockSize)
      }
      
      const maxVal = Math.max(...waveform)
      const normalized = maxVal > 0 ? waveform.map(v => v / maxVal) : waveform.map(() => 0.1)
      setWaveformData(normalized)
      audioContext.close()
    } catch (error) {
      console.error('生成波形失败:', error)
      const mockWaveform = Array.from({ length: 300 }, () => Math.random() * 0.5 + 0.1)
      setWaveformData(mockWaveform)
    }
  }

  useEffect(() => {
    if (canvasRef.current && waveformData.length > 0) {
      drawWaveform()
    }
  }, [waveformData, startTime, endTime, currentTime, duration, cutMode, averageCount])

  const drawWaveform = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const width = canvas.width
    const height = canvas.height
    const centerY = height / 2
    
    ctx.clearRect(0, 0, width, height)
    
    if (waveformData.length === 0 || duration <= 0) return
    
    const barWidth = width / waveformData.length
    
    waveformData.forEach((value, index) => {
      const x = index * barWidth
      const barHeight = value * height * 0.85
      const progress = index / waveformData.length
      const timeAtBar = progress * duration
      
      // 平均分割模式下全部显示绿色
      if (cutMode === 'average' || cutMode === 'time') {
        const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2)
        gradient.addColorStop(0, '#22c55e')
        gradient.addColorStop(0.5, '#16a34a')
        gradient.addColorStop(1, '#22c55e')
        ctx.fillStyle = gradient
      } else if (timeAtBar >= startTime && timeAtBar <= endTime) {
        const gradient = ctx.createLinearGradient(x, centerY - barHeight / 2, x, centerY + barHeight / 2)
        gradient.addColorStop(0, '#22c55e')
        gradient.addColorStop(0.5, '#16a34a')
        gradient.addColorStop(1, '#22c55e')
        ctx.fillStyle = gradient
      } else {
        ctx.fillStyle = '#3d4a5c'
      }
      
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(barWidth - 1, 1), barHeight)
    })
    
    // 绘制当前播放位置线
    if (duration > 0) {
      const playX = (currentTime / duration) * width
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playX, 0)
      ctx.lineTo(playX, height)
      ctx.stroke()
    }
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      if (cutMode === 'manual') {
        if (audio.currentTime < startTime || audio.currentTime >= endTime) {
          audio.currentTime = startTime
          setCurrentTime(startTime)
        }
      }
      audio.volume = volume / 100
      audio.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }

  const stopPlay = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = cutMode === 'manual' ? startTime : 0
      setCurrentTime(cutMode === 'manual' ? startTime : 0)
      setIsPlaying(false)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime
      setCurrentTime(time)
      if (cutMode === 'manual' && time >= endTime) {
        audioRef.current.pause()
        audioRef.current.currentTime = startTime
        setCurrentTime(startTime)
        setIsPlaying(false)
      }
    }
  }

  const handleAudioLoaded = () => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
      audioRef.current.currentTime = cutMode === 'manual' ? startTime : 0
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value)
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    const newTime = Math.max(0, Math.min(duration, progress * duration))
    
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleHandleMouseDown = (type: 'start' | 'end' | 'range', e: React.MouseEvent) => {
    if (cutMode !== 'manual') return
    e.stopPropagation()
    e.preventDefault()
    setDragging(type)
    setDragStartX(e.clientX)
    setDragStartValue({ start: startTime, end: endTime })
  }

  useEffect(() => {
    if (!dragging || !progressBarRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = progressBarRef.current!.getBoundingClientRect()
      const deltaX = e.clientX - dragStartX
      const deltaTime = (deltaX / rect.width) * duration

      if (dragging === 'start') {
        const newStart = Math.max(0, Math.min(endTime - 0.1, dragStartValue.start + deltaTime))
        setStartTime(newStart)
      } else if (dragging === 'end') {
        const newEnd = Math.max(startTime + 0.1, Math.min(duration, dragStartValue.end + deltaTime))
        setEndTime(newEnd)
      } else if (dragging === 'range') {
        const rangeDuration = dragStartValue.end - dragStartValue.start
        let newStart = dragStartValue.start + deltaTime
        let newEnd = dragStartValue.end + deltaTime
        
        if (newStart < 0) {
          newStart = 0
          newEnd = rangeDuration
        }
        if (newEnd > duration) {
          newEnd = duration
          newStart = duration - rangeDuration
        }
        
        setStartTime(newStart)
        setEndTime(newEnd)
      }
    }

    const handleMouseUp = () => setDragging(null)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, dragStartX, dragStartValue, duration, startTime, endTime])

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    const newTime = Math.max(0, Math.min(duration, progress * duration))
    
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const setCurrentAsStart = () => {
    if (currentTime < endTime) {
      setStartTime(currentTime)
    }
  }

  const setCurrentAsEnd = () => {
    if (currentTime > startTime) {
      setEndTime(currentTime)
    }
  }

  const handlePreviewSegment = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime
      setCurrentTime(startTime)
      audioRef.current.volume = volume / 100
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }

  const handleAddToList = () => {
    if (cutMode === 'manual') {
      const newSegment: CutSegment = {
        id: Math.random().toString(36).substring(2, 11),
        startTime,
        endTime
      }
      setSegments(prev => [...prev, newSegment])
    } else if (cutMode === 'average') {
      // 平均分割 - 添加所有分段
      const segmentDuration = duration / averageCount
      const newSegments: CutSegment[] = []
      for (let i = 0; i < averageCount; i++) {
        newSegments.push({
          id: Math.random().toString(36).substring(2, 11),
          startTime: i * segmentDuration,
          endTime: (i + 1) * segmentDuration
        })
      }
      setSegments(prev => [...prev, ...newSegments])
    } else if (cutMode === 'time') {
      // 按时间分割
      const newSegments: CutSegment[] = []
      let currentStart = 0
      while (currentStart < duration) {
        const segEnd = Math.min(currentStart + timeSplitDuration, duration)
        newSegments.push({
          id: Math.random().toString(36).substring(2, 11),
          startTime: currentStart,
          endTime: segEnd
        })
        currentStart = segEnd
      }
      setSegments(prev => [...prev, ...newSegments])
    }
  }

  const handleRemoveSegment = (id: string) => {
    setSegments(prev => prev.filter(s => s.id !== id))
  }

  const handleConfirm = () => {
    // 如果有分段列表，传递分段；否则只传递手动选择的范围
    if (segments.length > 0) {
      onConfirm(startTime, endTime, segments)
    } else if (cutMode === 'manual') {
      // 手动模式下如果没有添加到列表，创建单个分段
      onConfirm(startTime, endTime, [{ id: '1', startTime, endTime }])
    } else {
      onConfirm(startTime, endTime)
    }
    onClose()
  }

  const handleClose = () => {
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
    onClose()
  }

  // 计算平均分割的每段时长（防止除以0）
  const averageSegmentDuration = duration > 0 ? duration / averageCount : 0

  // 计算按时间分割的段数（防止除以0）
  const timeSegmentCount = duration > 0 && timeSplitDuration > 0 ? Math.ceil(duration / timeSplitDuration) : 1

  if (!isOpen) return null

  return (
    <ErrorBoundary onError={onClose}>
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1f2e] rounded-lg w-[1000px] max-w-[95vw] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3040]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-5 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-5 bg-blue-500 rounded-sm ml-0.5"></div>
            </div>
            <span className="text-white text-sm font-medium">{t('cut_modal.title')}</span>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex">
          {/* Left Panel - Main Controls */}
          <div className="flex-1 p-5">
            {/* File Name */}
            <div className="text-white text-sm mb-4">{fileName}</div>

            {/* Waveform */}
            <div className="bg-[#0d1117] rounded-lg p-4 mb-3">
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full h-[180px] cursor-pointer"
                onClick={handleWaveformClick}
              />
            </div>

            {/* Progress Bar */}
            <div 
              ref={progressBarRef}
              className="h-3 bg-[#2a3040] rounded relative cursor-pointer mb-2"
              onClick={handleProgressClick}
            >
              {cutMode === 'manual' ? (
                <>
                  {/* Manual Mode - Yellow Selection Range */}
                  <div
                    className="absolute h-full bg-yellow-500 rounded cursor-move"
                    style={{
                      left: `${(startTime / duration) * 100}%`,
                      width: `${((endTime - startTime) / duration) * 100}%`
                    }}
                    onMouseDown={(e) => handleHandleMouseDown('range', e)}
                  />
                  {/* Start Handle */}
                  <div
                    className="absolute w-3 h-5 bg-yellow-400 rounded -top-1 transform -translate-x-1/2 cursor-ew-resize hover:bg-yellow-300 transition-colors z-10"
                    style={{ left: `${(startTime / duration) * 100}%` }}
                    onMouseDown={(e) => handleHandleMouseDown('start', e)}
                  />
                  {/* End Handle */}
                  <div
                    className="absolute w-3 h-5 bg-yellow-400 rounded -top-1 transform -translate-x-1/2 cursor-ew-resize hover:bg-yellow-300 transition-colors z-10"
                    style={{ left: `${(endTime / duration) * 100}%` }}
                    onMouseDown={(e) => handleHandleMouseDown('end', e)}
                  />
                </>
              ) : cutMode === 'average' ? (
                <>
                  {/* Average Mode - Split segments with dividers */}
                  {Array.from({ length: averageCount }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-full bg-[#3d4a5c] first:rounded-l last:rounded-r"
                      style={{
                        left: `${(i / averageCount) * 100}%`,
                        width: `calc(${100 / averageCount}% - 2px)`,
                        marginLeft: i > 0 ? '2px' : '0'
                      }}
                    />
                  ))}
                  {/* Divider lines */}
                  {Array.from({ length: averageCount - 1 }).map((_, i) => (
                    <div
                      key={`divider-${i}`}
                      className="absolute w-0.5 h-5 bg-yellow-400 -top-1 transform -translate-x-1/2 z-10"
                      style={{ left: `${((i + 1) / averageCount) * 100}%` }}
                    />
                  ))}
                </>
              ) : (
                <>
                  {/* Time Mode - Split by duration */}
                  {Array.from({ length: timeSegmentCount }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-full bg-[#3d4a5c] first:rounded-l last:rounded-r"
                      style={{
                        left: `${(i * timeSplitDuration / duration) * 100}%`,
                        width: `calc(${Math.min(timeSplitDuration, duration - i * timeSplitDuration) / duration * 100}% - 2px)`,
                        marginLeft: i > 0 ? '2px' : '0'
                      }}
                    />
                  ))}
                  {/* Divider lines */}
                  {Array.from({ length: timeSegmentCount - 1 }).map((_, i) => (
                    <div
                      key={`divider-${i}`}
                      className="absolute w-0.5 h-5 bg-yellow-400 -top-1 transform -translate-x-1/2 z-10"
                      style={{ left: `${((i + 1) * timeSplitDuration / duration) * 100}%` }}
                    />
                  ))}
                </>
              )}
              {/* Current Time Indicator */}
              <div
                className="absolute w-3 h-3 bg-blue-500 rounded-full top-0 transform -translate-x-1/2 cursor-pointer z-20"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>

            {/* Time Display and Controls */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-gray-300 text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              
              <div className="flex items-center gap-3">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                {/* Stop */}
                <button
                  onClick={stopPlay}
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
                
                {/* Volume */}
                <div className="flex items-center gap-2 ml-4">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-20 h-1 bg-[#2a3040] rounded appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-gray-400 text-sm w-10">{volume}%</span>
                </div>
              </div>
            </div>

            {/* Cut Mode Selection */}
            <div className="flex items-center gap-6 mb-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cutMode"
                  checked={cutMode === 'manual'}
                  onChange={() => setCutMode('manual')}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className={`text-sm ${cutMode === 'manual' ? 'text-white' : 'text-gray-400'}`}>{t('cut_modal.manual_split')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cutMode"
                  checked={cutMode === 'average'}
                  onChange={() => setCutMode('average')}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className={`text-sm ${cutMode === 'average' ? 'text-white' : 'text-gray-400'}`}>{t('cut_modal.average_split')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="cutMode"
                  checked={cutMode === 'time'}
                  onChange={() => setCutMode('time')}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className={`text-sm ${cutMode === 'time' ? 'text-white' : 'text-gray-400'}`}>{t('cut_modal.time_split')}</span>
              </label>
            </div>

            {/* Mode-specific Controls */}
            {cutMode === 'manual' && (
              <>
                {/* Time Input */}
                <div className="flex items-center gap-8 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">{t('cut_modal.start_time')}</span>
                    <input
                      type="text"
                      value={formatTime(startTime)}
                      onChange={(e) => setStartTime(parseTime(e.target.value))}
                      className="bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-white text-sm w-32 outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={setCurrentAsStart}
                      className="text-gray-400 hover:text-white transition-colors"
                      title={t('cut_modal.use_current_time')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">{t('cut_modal.end_time')}</span>
                    <input
                      type="text"
                      value={formatTime(endTime)}
                      onChange={(e) => setEndTime(parseTime(e.target.value))}
                      className="bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-white text-sm w-32 outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={setCurrentAsEnd}
                      className="text-gray-400 hover:text-white transition-colors"
                      title={t('cut_modal.use_current_time')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Duration Info */}
                <div className="mb-5">
                  <span className="text-gray-400 text-sm">
                    {t('cut_modal.duration_info')} <span className="text-white">{formatTime(endTime - startTime)}</span>
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handlePreviewSegment}
                    className="px-6 py-2 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-sm transition-colors border border-[#2a3a50]"
                  >
                    {t('cut_modal.preview_segment')}
                  </button>
                  <button
                    onClick={handleAddToList}
                    className="px-6 py-2 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-sm transition-colors border border-[#2a3a50]"
                  >
                    {t('cut_modal.add_to_list')}
                  </button>
                </div>
              </>
            )}

            {cutMode === 'average' && (
              <>
                {/* Average Split Settings */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-gray-400 text-sm">{t('cut_modal.average_split_into')}</span>
                  <div className="relative">
                    <select
                      value={averageCount}
                      onChange={(e) => setAverageCount(parseInt(e.target.value))}
                      className="appearance-none bg-[#0d1117] border border-[#2a3040] rounded px-4 py-1.5 pr-8 text-white text-sm outline-none focus:border-blue-500 cursor-pointer min-w-[80px]"
                    >
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n} className="bg-[#1a1a2e]">{n}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <span className="text-gray-400 text-sm">{t('cut_modal.segments')}，{t('cut_modal.each_duration')}</span>
                  <span className="text-white text-sm">{formatTime(averageSegmentDuration)}</span>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAddToList}
                    className="px-6 py-2 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-sm transition-colors border border-[#2a3a50]"
                  >
                    {t('cut_modal.add_to_list')}
                  </button>
                </div>
              </>
            )}

            {cutMode === 'time' && (
              <>
                {/* Time Split Settings */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-gray-400 text-sm">{t('cut_modal.time_split_each')}</span>
                  <input
                    type="number"
                    value={timeSplitDuration}
                    onChange={(e) => setTimeSplitDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 text-white text-sm w-20 outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-sm">{t('cut_modal.seconds')}，{t('cut_modal.total_segments')}</span>
                  <span className="text-white text-sm">{timeSegmentCount}</span>
                  <span className="text-gray-400 text-sm">{t('cut_modal.segments')}</span>
                </div>

                {/* Action Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleAddToList}
                    className="px-6 py-2 bg-[#1a2035] hover:bg-[#252a40] text-white rounded text-sm transition-colors border border-[#2a3a50]"
                  >
                    {t('cut_modal.add_to_list')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Panel - Segment List */}
          <div className="w-64 border-l border-[#2a3040] p-4">
            <div className="text-gray-400 text-sm mb-3">{t('cut_modal.segment_list')}</div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {segments.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-8">
                  {t('cut_modal.no_segments')}
                </div>
              ) : (
                segments.map((segment, index) => (
                  <div 
                    key={segment.id}
                    className="bg-[#0d1117] rounded p-2 flex items-center justify-between"
                  >
                    <div className="text-xs">
                      <div className="text-white mb-1">{t('cut_modal.segment_prefix')} {index + 1}</div>
                      <div className="text-gray-400">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveSegment(segment.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-4 border-t border-[#2a3040]">
          <button
            onClick={handleConfirm}
            className="px-10 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
          >
            {t('cut_modal.confirm')}
          </button>
        </div>

        {/* Audio Element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleAudioLoaded}
            onEnded={() => {
              setIsPlaying(false)
              if (audioRef.current) {
                audioRef.current.currentTime = cutMode === 'manual' ? startTime : 0
                setCurrentTime(cutMode === 'manual' ? startTime : 0)
              }
            }}
            onError={() => {
              if (audioRef.current) {
                const prev = audioRef.current.src
                audioRef.current.pause()
                audioRef.current.src = ''
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
              }
            }}
          />
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
