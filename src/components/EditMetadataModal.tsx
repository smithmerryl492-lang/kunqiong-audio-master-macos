import { X } from 'lucide-react'
import { useState, useEffect } from 'react'

interface EditMetadataModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string
  initialMetadata?: AudioMetadata
  onSave: (metadata: AudioMetadata) => void
  onApplyToAll: (metadata: AudioMetadata) => void
}

export interface AudioMetadata {
  title: string
  artist: string
  album: string
  year: string
  genre: string
}

export default function EditMetadataModal({ 
  isOpen, 
  onClose, 
  fileName,
  initialMetadata,
  onSave,
  onApplyToAll 
}: EditMetadataModalProps) {
  const [metadata, setMetadata] = useState<AudioMetadata>({
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: ''
  })

  useEffect(() => {
    if (isOpen) {
      // 加载现有元数据或使用默认值
      if (initialMetadata) {
        setMetadata(initialMetadata)
      } else {
        setMetadata({
          title: fileName.replace(/\.[^/.]+$/, ''),
          artist: '',
          album: '',
          year: '',
          genre: ''
        })
      }
    }
  }, [isOpen, fileName, initialMetadata])

  const handleSave = () => {
    onSave(metadata)
    onClose()
  }

  const handleApplyToAll = () => {
    onApplyToAll(metadata)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1e2536] rounded-lg w-[600px] max-w-[90vw] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a3040]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-6 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
            </div>
            <span className="text-white text-sm">修改文件信息</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* 标题 */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-gray-300 text-sm w-16 shrink-0">标题</label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
              className="flex-1 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 艺术家 & 专辑 */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-gray-300 text-sm w-16 shrink-0">艺术家</label>
            <input
              type="text"
              value={metadata.artist}
              onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
              className="flex-1 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
            <label className="text-gray-300 text-sm w-12 shrink-0 text-center">专辑</label>
            <input
              type="text"
              value={metadata.album}
              onChange={(e) => setMetadata({ ...metadata, album: e.target.value })}
              className="flex-1 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 年份 & 流派 */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-gray-300 text-sm w-16 shrink-0">年份</label>
            <input
              type="text"
              value={metadata.year}
              onChange={(e) => setMetadata({ ...metadata, year: e.target.value })}
              className="flex-1 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
            <label className="text-gray-300 text-sm w-12 shrink-0 text-center">流派</label>
            <input
              type="text"
              value={metadata.genre}
              onChange={(e) => setMetadata({ ...metadata, genre: e.target.value })}
              className="flex-1 bg-transparent border border-[#3a4050] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* 注释 */}
          <p className="text-gray-500 text-sm mb-8">
            注：部分格式不支持修改文件信息
          </p>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4">
            <button
              onClick={handleApplyToAll}
              className="px-8 py-2.5 bg-transparent border border-[#3a4050] hover:bg-[#2a3040] text-white rounded text-sm transition-colors"
            >
              应用到全部
            </button>
            <button
              onClick={handleSave}
              className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              保存修改
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
