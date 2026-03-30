import { X, Play, Pause, Plus, Music } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { getSoundEffects, previewSoundEffect, SoundEffect, API_BASE, getAuthHeaders } from '../services/api'
import { t } from '../utils/i18n'

interface SoundEffectLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (effectId: string, effectName: string) => void
  title?: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function SoundEffectLibraryModal({
  isOpen,
  onClose,
  onSelect,
  title = t('effect.library_title')
}: SoundEffectLibraryModalProps) {
  const [effects, setEffects] = useState<SoundEffect[]>([])
  const [selectedEffect, setSelectedEffect] = useState<SoundEffect | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      loadEffects()
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        const prev = audioRef.current.src
        audioRef.current.src = ''
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      }
    }
  }, [isOpen])

  const loadEffects = async () => {
    try {
      const data = await getSoundEffects()
      setEffects(data.effects)
    } catch (err) {
      console.error(t('functions.add_effect.load_failed'), err)
    }
  }

  const handleSelectEffect = (effect: SoundEffect) => {
    setSelectedEffect(effect)
    setCurrentTime(0)
    setIsPlaying(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }

  const handlePlayPause = async () => {
    if (!selectedEffect) return

    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
    } else {
      try {
        const blob = await previewSoundEffect(selectedEffect.id)
        const url = URL.createObjectURL(blob)
        
        if (audioRef.current) {
          const prev = audioRef.current.src
          audioRef.current.pause()
          audioRef.current.src = ''
          if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        }
        
        const audio = new Audio(url)
        audioRef.current = audio
        
        audio.ontimeupdate = () => setCurrentTime(audio.currentTime)
        audio.onended = () => {
          setIsPlaying(false)
          setCurrentTime(0)
          const cur = audio.src
          audio.src = ''
          if (cur && cur.startsWith('blob:')) URL.revokeObjectURL(cur)
        }
        
        await audio.play()
        setIsPlaying(true)
      } catch (err) {
        console.error(t('effect.play_failed'), err)
      }
    }
  }

  const getEffectDisplayName = (name: string) => {
    const key = `effect.names.${name}`
    const translated = t(key)
    return translated === key ? name : translated
  }

  const handleConfirmSelect = () => {
    if (selectedEffect) {
      onSelect(selectedEffect.id, getEffectDisplayName(selectedEffect.name))
      onClose()
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const formData = new FormData()
    formData.append('file', files[0])
    formData.append('name', '')

    try {
      const response = await fetch(`${API_BASE}/effect/upload-effect`, {
        method: 'POST',
        body: formData,
        headers: getAuthHeaders()
      })
      if (response.ok) {
        loadEffects()
      }
    } catch (err) {
      console.error(t('functions.add_effect.upload_failed'), err)
    } finally {
      e.target.value = ''
    }
  }

  const filteredEffects = effects.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1f2e] rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3040]">
          <span className="text-white text-base font-medium">{title}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#2a3040]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('effect.search_placeholder')}
            className="w-full bg-[#0d1117] border border-[#2a3040] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Upload Section */}
          <div className="mb-5">
            <h3 className="text-gray-400 text-sm mb-3">{t('effect.local_upload')}</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.m4a,.flac,.aac"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-32 h-24 border-2 border-dashed border-[#2a3a50] rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-400 transition-colors"
            >
              <Plus className="w-8 h-8 mb-1" />
              <span className="text-xs">{t('effect.upload_effect')}</span>
            </button>
          </div>

          {/* Effects Grid */}
          <div className="mb-3">
            <h3 className="text-gray-400 text-sm mb-3">{t('effect.all_effects')} ({filteredEffects.length})</h3>
            <div className="grid grid-cols-3 gap-3">
              {filteredEffects.map(effect => (
                <div
                  key={effect.id}
                  onClick={() => handleSelectEffect(effect)}
                  className={`bg-[#12121e] rounded-lg p-3 cursor-pointer border-2 transition-colors ${
                    selectedEffect?.id === effect.id
                      ? 'border-blue-500'
                      : 'border-transparent hover:border-[#3a4a60]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate" title={getEffectDisplayName(effect.name)}>
                        {getEffectDisplayName(effect.name)}
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {formatDuration(effect.duration || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Bar */}
        {selectedEffect && (
          <div className="px-5 py-3 bg-[#12121e] border-t border-[#2a3040] flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1">
              <div className="text-white text-sm">{getEffectDisplayName(selectedEffect.name)}</div>
              <div className="text-gray-500 text-xs">
                {formatDuration(currentTime)} / {formatDuration(selectedEffect.duration || 0)}
              </div>
            </div>
            <button
              onClick={handleConfirmSelect}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              {t('effect.select')}
            </button>
          </div>
        )}

        {/* Footer when no selection */}
        {!selectedEffect && (
          <div className="px-5 py-3 border-t border-[#2a3040] flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#2a3040] hover:bg-[#3a4050] text-gray-300 rounded text-sm"
            >
              {t('effect.cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
