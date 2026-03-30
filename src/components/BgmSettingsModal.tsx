import { useState, useRef, useEffect } from 'react'
import { X, Play, Pause, Square, Plus, Trash2, Volume2 } from 'lucide-react'
import BgmLibraryModal from './BgmLibraryModal'

interface BgmSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  audioFile: { file: File; name: string; duration: number } | null
  onSave: (bgm: { file: File; name: string } | null) => void
}

export default function BgmSettingsModal({ isOpen, onClose, audioFile, onSave }: BgmSettingsModalProps) {
  const [bgm, setBgm] = useState<{ file: File; name: string } | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(50)
  const [waveformData, setWaveformData] = useState<number[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && audioFile) {
      generateWaveform(audioFile.file)
      setCurrentTime(0)
      setIsPlaying(false)
      setBgm(null)
      const url = URL.createObjectURL(audioFile.file)
      setAudioUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [isOpen, audioFile?.file])

  useEffect(() => {
    if (!isOpen) {
      audioRef.current?.pause()
      setIsPlaying(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (canvasRef.current && waveformData.length > 0) drawWaveform()
  }, [waveformData, currentTime, audioFile?.duration])


  const generateWaveform = async (file: File) => {
    try {
      const audioContext = new AudioContext()
      const arrayBuffer = await file.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const channelData = audioBuffer.getChannelData(0)
      const samples = 300
      const blockSize = Math.floor(channelData.length / samples)
      const waveform: number[] = []
      for (let i = 0; i < samples; i++) {
        let sum = 0
        for (let j = 0; j < blockSize; j++) sum += Math.abs(channelData[i * blockSize + j])
        waveform.push(sum / blockSize)
      }
      const maxVal = Math.max(...waveform)
      setWaveformData(waveform.map(v => v / maxVal))
    } catch {
      setWaveformData(Array.from({ length: 300 }, () => Math.random() * 0.5 + 0.1))
    }
  }

  const drawWaveform = () => {
    const canvas = canvasRef.current
    if (!canvas || !audioFile) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.width, height = canvas.height
    ctx.clearRect(0, 0, width, height)
    const barWidth = width / waveformData.length
    const progress = currentTime / audioFile.duration
    waveformData.forEach((value, index) => {
      const x = index * barWidth
      const barHeight = value * height * 0.8
      ctx.fillStyle = index / waveformData.length < progress ? '#22c55e' : '#4ade80'
      ctx.fillRect(x, (height - barHeight) / 2, barWidth - 1, barHeight)
    })
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const stopPlay = () => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.currentTime = 0
    setCurrentTime(0)
    setIsPlaying(false)
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !audioFile) return
    const rect = e.currentTarget.getBoundingClientRect()
    const newTime = (e.clientX - rect.left) / rect.width * audioFile.duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), ms = Math.floor((s % 1) * 1000)
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`
  }

  const handleSave = () => { onSave(bgm); onClose() }

  if (!isOpen || !audioFile) return null


  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1f2e] rounded-lg w-[900px] max-w-[95vw] shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3040]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1"><div className="w-1 h-4 bg-blue-500 rounded"></div><div className="w-1 h-4 bg-blue-400 rounded"></div></div>
            <span className="text-white text-sm font-medium">设置背景音</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex">
          <div className="flex-1 p-5 border-r border-[#2a3040]">
            <div className="text-white text-sm mb-4">{audioFile.name}</div>
            <div className="bg-[#0d1117] rounded-lg p-4 mb-3">
              <canvas ref={canvasRef} width={500} height={150} className="w-full h-[150px] cursor-pointer" onClick={handleCanvasClick} />
            </div>
            <div className="bg-[#0d1117] rounded-lg h-2 mb-3 cursor-pointer" onClick={(e) => { if (!audioRef.current || !audioFile) return; const rect = e.currentTarget.getBoundingClientRect(); const newTime = (e.clientX - rect.left) / rect.width * audioFile.duration; audioRef.current.currentTime = newTime; setCurrentTime(newTime) }}>
              <div className="bg-white/30 h-full rounded-lg relative" style={{ width: `${(currentTime / audioFile.duration) * 100}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow"></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs">{formatTime(currentTime)} / {formatTime(audioFile.duration)}</span>
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-blue-400">{isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}</button>
                <button onClick={stopPlay} className="text-white hover:text-blue-400"><Square className="w-4 h-4" /></button>
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-400" />
                  <input type="range" min="0" max="100" value={volume} onChange={e => { setVolume(Number(e.target.value)); if(audioRef.current) audioRef.current.volume = Number(e.target.value)/100 }} className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer" />
                  <span className="text-gray-400 text-xs w-8">{volume}%</span>
                </div>
              </div>
            </div>
          </div>
          <div className="w-[280px] p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowLibrary(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs"><Plus className="w-3.5 h-3.5" />添加背景音</button>
              <button onClick={() => setBgm(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-white text-xs"><Trash2 className="w-3.5 h-3.5" />清空</button>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-[200px]">
              {bgm ? (
                <div className="text-center"><div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center"><Play className="w-6 h-6 text-white" /></div><p className="text-white text-sm">{bgm.name}</p></div>
              ) : (
                <p className="text-gray-500 text-sm">请添加背景音乐~</p>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="flex-1 px-4 py-2 bg-[#2a3040] text-white rounded text-sm hover:bg-[#3a4050]">取消</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
        {audioUrl && <audio ref={audioRef} src={audioUrl} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)} onEnded={() => setIsPlaying(false)} />}
      </div>
      <BgmLibraryModal isOpen={showLibrary} onClose={() => setShowLibrary(false)} onSelect={(selected) => { setBgm(selected); setShowLibrary(false) }} />
    </div>
  )
}
