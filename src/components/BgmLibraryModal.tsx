import { useState, useRef, useEffect } from 'react'
import { X, Play, Pause, Search, Loader2, Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { t } from '../utils/i18n'

interface BgmLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (bgm: { file: File; name: string }) => void
}

interface LocalBgm {
  id: string
  name: string
  category: string
  filename: string
  path: string
}

const RECENT_KEY = 'bgm_recent_used'

export default function BgmLibraryModal({ isOpen, onClose, onSelect }: BgmLibraryModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState(t('bgm.recent_used'))
  const [categories, setCategories] = useState<string[]>([])
  const [localBgms, setLocalBgms] = useState<LocalBgm[]>([])
  const [recentBgms, setRecentBgms] = useState<LocalBgm[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (isOpen) { loadLocalBgms(); loadRecentBgms() } }, [isOpen])

  // 将后端传来的中文分类名映射为翻译键
  const translateCategory = (cat: string) => {
    const mapping: Record<string, string> = {
      '古典': t('bgm.categories.classical'),
      '氛围': t('bgm.categories.atmosphere'),
      '流行': t('bgm.categories.pop'),
      '电子': t('bgm.categories.electronic'),
      '轻音乐': t('bgm.categories.light')
    }
    return mapping[cat] || cat
  }

  const loadLocalBgms = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://127.0.0.1:8001/api/bgm/list')
      const data = await res.json()
      setLocalBgms(data.bgms || [])
      setCategories(data.categories || [])
    } catch (e) { console.error(t('bgm.load_failed'), e) }
    finally { setLoading(false) }
  }

  const loadRecentBgms = () => {
    try { const stored = localStorage.getItem(RECENT_KEY); if (stored) setRecentBgms(JSON.parse(stored)) } catch { setRecentBgms([]) }
  }

  const saveToRecent = (bgm: LocalBgm) => {
    const updated = [bgm, ...recentBgms.filter(b => b.id !== bgm.id)].slice(0, 10)
    setRecentBgms(updated)
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  }

  const allTabs = [t('bgm.recent_used'), t('bgm.local_upload'), ...categories]
  const getDisplayBgms = () => {
    if (searchQuery) return localBgms.filter(bgm => bgm.name.toLowerCase().includes(searchQuery.toLowerCase()))
    if (activeTab === t('bgm.recent_used')) return recentBgms
    if (activeTab === t('bgm.local_upload')) return []
    return localBgms.filter(bgm => bgm.category === activeTab)
  }

  const handlePlay = (bgm: LocalBgm) => {
    if (playingId === bgm.id) { audioRef.current?.pause(); setPlayingId(null) }
    else if (audioRef.current) { audioRef.current.src = 'http://127.0.0.1:8001/api/bgm/local/' + encodeURIComponent(bgm.path); audioRef.current.play(); setPlayingId(bgm.id) }
  }

  const handleSelect = async (bgm: LocalBgm) => {
    setLoadingId(bgm.id)
    try {
      const res = await fetch('http://127.0.0.1:8001/api/bgm/local/' + encodeURIComponent(bgm.path))
      const blob = await res.blob()
      const file = new File([blob], bgm.filename, { type: 'audio/mpeg' })
      saveToRecent(bgm)
      onSelect({ file, name: bgm.name })
      onClose()
    } catch { alert(t('bgm.get_bgm_failed')) }
    finally { setLoadingId(null) }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { onSelect({ file: f, name: f.name.replace(/\.[^/.]+$/, '') }); onClose() }
    e.target.value = ''
  }

  const scrollTabs = (dir: 'left' | 'right') => { if (tabsRef.current) tabsRef.current.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' }) }
  useEffect(() => { if (!isOpen) { audioRef.current?.pause(); setPlayingId(null) } }, [isOpen])
  if (!isOpen) return null
  const displayBgms = getDisplayBgms()

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
      <div className="bg-[#1a1f2e] rounded-lg w-[900px] max-w-[95vw] shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3040]">
          <span className="text-white text-sm font-medium">{t('bgm.bgm_library')}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2a3040]">
          <button onClick={() => scrollTabs('left')} className="text-gray-400 hover:text-white p-1 shrink-0"><ChevronLeft className="w-4 h-4" /></button>
          <div ref={tabsRef} className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide">
            {allTabs.map(tab => (<button key={tab} onClick={() => { setActiveTab(tab); setSearchQuery('') }} className={`px-4 py-1.5 rounded text-xs whitespace-nowrap ${activeTab === tab && !searchQuery ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#2a3040]'}`}>{translateCategory(tab)}</button>))}
          </div>
          <button onClick={() => scrollTabs('right')} className="text-gray-400 hover:text-white p-1 shrink-0"><ChevronRight className="w-4 h-4" /></button>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder={t('bgm.search_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-44 bg-[#0d1117] border border-[#2a3040] rounded-lg px-4 py-2 pl-10 text-sm text-white outline-none" />
            </div>
            <button className="px-4 py-2 bg-[#2a3040] text-white rounded-lg text-sm hover:bg-[#3a4050]">{t('bgm.query')}</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5">
          {loading ? (<div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>) : (
            <>
              {activeTab === t('bgm.recent_used') && !searchQuery && (<div className="mb-6"><h3 className="text-white text-sm mb-3">{t('bgm.recent_used')}</h3>{recentBgms.length === 0 ? <p className="text-gray-500 text-xs">{t('bgm.no_data')}</p> : (<div className="grid grid-cols-3 gap-3">{recentBgms.map(bgm => <BgmCard key={bgm.id} bgm={bgm} playingId={playingId} loadingId={loadingId} onPlay={handlePlay} onSelect={handleSelect} translateCategory={translateCategory} />)}</div>)}</div>)}
              {(activeTab === t('bgm.local_upload') || activeTab === t('bgm.recent_used')) && !searchQuery && (<div className="mb-6"><h3 className="text-white text-sm mb-3">{t('bgm.local_upload')}</h3><button onClick={() => fileInputRef.current?.click()} className="w-48 h-24 bg-[#2a3545] hover:bg-[#3a4555] rounded-lg flex items-center justify-center border border-dashed border-[#4a5565]"><Plus className="w-8 h-8 text-gray-400" /></button></div>)}
              {activeTab !== t('bgm.recent_used') && activeTab !== t('bgm.local_upload') && !searchQuery && (<div><h3 className="text-white text-sm mb-3">{translateCategory(activeTab)}</h3>{displayBgms.length === 0 ? <p className="text-gray-500 text-xs">{t('bgm.no_category_data')}</p> : (<div className="grid grid-cols-3 gap-3">{displayBgms.map(bgm => <BgmCard key={bgm.id} bgm={bgm} playingId={playingId} loadingId={loadingId} onPlay={handlePlay} onSelect={handleSelect} translateCategory={translateCategory} />)}</div>)}</div>)}
              {searchQuery && (<div><h3 className="text-white text-sm mb-3">{t('bgm.search_result')} ({displayBgms.length})</h3>{displayBgms.length === 0 ? <p className="text-gray-500 text-xs">{t('bgm.no_search_result')}</p> : (<div className="grid grid-cols-3 gap-3">{displayBgms.map(bgm => <BgmCard key={bgm.id} bgm={bgm} playingId={playingId} loadingId={loadingId} onPlay={handlePlay} onSelect={handleSelect} translateCategory={translateCategory} />)}</div>)}</div>)}
            </>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,.flac,.ogg" className="hidden" onChange={handleFileUpload} />
        <audio ref={audioRef} onEnded={() => setPlayingId(null)} />
      </div>
    </div>
  )
}

function BgmCard({ bgm, playingId, loadingId, onPlay, onSelect, translateCategory }: { bgm: LocalBgm; playingId: string | null; loadingId: string | null; onPlay: (bgm: LocalBgm) => void; onSelect: (bgm: LocalBgm) => void; translateCategory: (cat: string) => string }) {
  return (
    <div className="bg-[#12121e] rounded-lg p-4 hover:bg-[#1a1a2e] group">
      <div className="flex items-start gap-3">
        <button onClick={() => onPlay(bgm)} className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shrink-0">{playingId === bgm.id ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}</button>
        <div className="flex-1 min-w-0"><div className="text-white text-sm truncate mb-1">{bgm.name}</div><div className="text-gray-500 text-xs">{translateCategory(bgm.category)}</div></div>
      </div>
      <div className="flex justify-end mt-3"><button onClick={() => onSelect(bgm)} disabled={loadingId === bgm.id} className="text-blue-400 hover:text-blue-300 disabled:text-gray-500">{loadingId === bgm.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}</button></div>
    </div>
  )
}