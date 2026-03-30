import { X, ChevronDown } from 'lucide-react'
import { useState } from 'react'

export interface BatchFileItem {
  id: string
  file: File
  name: string
  size: string
  sizeBytes: number
  duration: string
  durationSeconds: number
}

interface BatchCutModalProps {
  isOpen: boolean
  onClose: () => void
  files: BatchFileItem[]
  onConfirm: (selectedFiles: BatchFileItem[], splitMode: 'average' | 'time', splitValue: number) => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
}

export default function BatchCutModal({ isOpen, onClose, files, onConfirm }: BatchCutModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [splitMode, setSplitMode] = useState<'average' | 'time'>('average')
  const [averageCount, setAverageCount] = useState(2)
  const [timeDuration, setTimeDuration] = useState(30)

  const handleSelectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(files.map(f => f.id)))
    }
  }

  const handleSelectFile = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleConfirm = () => {
    const selectedFiles = files.filter(f => selectedIds.has(f.id))
    if (selectedFiles.length === 0) return
    onConfirm(selectedFiles, splitMode, splitMode === 'average' ? averageCount : timeDuration)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1f2e] rounded-lg w-[900px] max-w-[95vw] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a3040]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-5 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-5 bg-blue-500 rounded-sm ml-0.5"></div>
            </div>
            <span className="text-white text-sm font-medium">批量剪切</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex">
          {/* Left - File List */}
          <div className="flex-1 p-4">
            {/* Table Header */}
            <div className="flex items-center bg-[#12121e] border-b border-[#2a3040] px-4 py-3 text-sm text-gray-400 rounded-t">
              <div className="w-8"></div>
              <div className="flex-1 min-w-[200px]">文件名</div>
              <div className="w-24 text-center">文件大小</div>
              <div className="w-32 text-center">文件时长</div>
            </div>

            {/* File List */}
            <div className="bg-[#0d1117] rounded-b max-h-[400px] overflow-y-auto">
              {files.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-12">
                  暂无文件
                </div>
              ) : (
                files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center px-4 py-3 border-b border-[#1a1a28] hover:bg-[#12121e] transition-colors cursor-pointer"
                    onClick={() => handleSelectFile(file.id)}
                  >
                    <div className="w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(file.id)}
                        onChange={() => handleSelectFile(file.id)}
                        className="w-4 h-4 accent-blue-500 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px] text-white text-sm truncate pr-4">
                      {file.name.length > 20 ? file.name.slice(0, 10) + '...' + file.name.slice(-10) : file.name}
                    </div>
                    <div className="w-24 text-center text-gray-300 text-sm">
                      {file.size}
                    </div>
                    <div className="w-32 text-center text-gray-300 text-sm">
                      {file.duration}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right - Split Options */}
          <div className="w-56 border-l border-[#2a3040] p-4">
            {/* Split Mode Selection */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === 'average'}
                  onChange={() => setSplitMode('average')}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className={`text-sm ${splitMode === 'average' ? 'text-white' : 'text-gray-400'}`}>
                  平均分割
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="splitMode"
                  checked={splitMode === 'time'}
                  onChange={() => setSplitMode('time')}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className={`text-sm ${splitMode === 'time' ? 'text-white' : 'text-gray-400'}`}>
                  按时间分割
                </span>
              </label>
            </div>

            {/* Split Settings */}
            {splitMode === 'average' ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">平均分割为</span>
                <div className="relative">
                  <select
                    value={averageCount}
                    onChange={(e) => setAverageCount(parseInt(e.target.value))}
                    className="appearance-none bg-[#0d1117] border border-[#2a3040] rounded px-3 py-1.5 pr-7 text-white text-sm outline-none focus:border-blue-500 cursor-pointer w-16"
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n} className="bg-[#1a1a2e]">{n}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <span className="text-gray-400 text-sm">段</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">每段时长</span>
                  <input
                    type="number"
                    value={timeDuration}
                    onChange={(e) => setTimeDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="bg-[#0d1117] border border-[#2a3040] rounded px-2 py-1.5 text-white text-sm w-16 outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-sm">秒</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2a3040]">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === files.length && files.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 accent-blue-500 cursor-pointer"
              />
              <span className="text-gray-300 text-sm">全选</span>
            </label>
            <span className="text-gray-400 text-sm">已选中{selectedIds.size}/{files.length}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-8 py-2 bg-[#2a3040] hover:bg-[#3a4050] text-white rounded text-sm transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="px-8 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
            >
              批量剪切
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
