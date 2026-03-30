import { X, Save, Trash2, Download, Upload, Star, Clock } from 'lucide-react'
import { useState, useRef } from 'react'
import { AudioPreset, getAllPresets, savePreset, deletePreset, updatePreset, exportPresets, importPresets } from '../services/presetService'

interface PresetModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: {
    outputFormat: string
    quality: number
    channel: string
    encoding: string
    sampleRate: string
  }
  onLoadPreset: (preset: AudioPreset) => void
}

export default function PresetModal({ isOpen, onClose, currentSettings, onLoadPreset }: PresetModalProps) {
  const [presets, setPresets] = useState<AudioPreset[]>(getAllPresets())
  const [presetName, setPresetName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('请输入预设名称')
      return
    }

    const newPreset = savePreset({
      name: presetName.trim(),
      ...currentSettings
    })

    setPresets(getAllPresets())
    setPresetName('')
    setShowSaveForm(false)
  }

  const handleDeletePreset = (id: string) => {
    if (confirm('确定要删除这个预设吗？')) {
      deletePreset(id)
      setPresets(getAllPresets())
    }
  }

  const handleRenamePreset = (id: string) => {
    if (!editingName.trim()) return
    
    updatePreset(id, { name: editingName.trim() })
    setPresets(getAllPresets())
    setEditingId(null)
    setEditingName('')
  }

  const handleExportPresets = () => {
    const userPresets = presets.filter(p => !p.isBuiltIn)
    if (userPresets.length === 0) {
      alert('没有可导出的自定义预设')
      return
    }
    exportPresets(userPresets)
  }

  const handleImportPresets = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await importPresets(file)
      setPresets(getAllPresets())
      alert('预设导入成功！')
    } catch (error) {
      alert('导入失败：' + (error instanceof Error ? error.message : '未知错误'))
    }

    e.target.value = ''
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  const builtInPresets = presets.filter(p => p.isBuiltIn)
  const userPresets = presets.filter(p => !p.isBuiltIn)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] rounded-lg w-[700px] max-h-[80vh] overflow-hidden shadow-xl border border-[#2a3a50]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a50]">
          <h2 className="text-white text-lg font-medium">参数预设管理</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* Current Settings */}
          <div className="mb-6 p-4 bg-[#12121e] rounded-lg border border-[#2a3a50]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-medium">当前参数</h3>
              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>保存为预设</span>
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">格式:</span>
                <span className="text-white">{currentSettings.outputFormat}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">质量:</span>
                <span className="text-white">{currentSettings.quality} kbps</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">声道:</span>
                <span className="text-white">{currentSettings.channel === 'original' ? '原始' : currentSettings.channel === 'mono' ? '单声道' : '立体声'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">编码:</span>
                <span className="text-white">{currentSettings.encoding}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400">采样率:</span>
                <span className="text-white">{currentSettings.sampleRate}</span>
              </div>
            </div>

            {/* Save Form */}
            {showSaveForm && (
              <div className="mt-4 pt-4 border-t border-[#2a3a50]">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    placeholder="输入预设名称..."
                    className="flex-1 bg-[#0a0a14] border border-[#2a3a50] rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  />
                  <button
                    onClick={handleSavePreset}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveForm(false)
                      setPresetName('')
                    }}
                    className="px-4 py-2 bg-[#2a3a50] hover:bg-[#3a4a60] text-white rounded text-sm transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Built-in Presets */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-medium flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500" />
                内置预设
              </h3>
              <span className="text-gray-400 text-xs">{builtInPresets.length} 个</span>
            </div>
            
            <div className="space-y-2">
              {builtInPresets.map(preset => (
                <div
                  key={preset.id}
                  className="p-3 bg-[#12121e] rounded-lg border border-[#2a3a50] hover:border-blue-500/50 transition-colors cursor-pointer"
                  onClick={() => {
                    onLoadPreset(preset)
                    onClose()
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-sm font-medium">{preset.name}</span>
                    <span className="text-xs text-gray-400 bg-[#1a1a2e] px-2 py-1 rounded">
                      {preset.outputFormat}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{preset.quality} kbps</span>
                    <span>{preset.encoding}</span>
                    <span>{preset.channel === 'original' ? '原始声道' : preset.channel === 'mono' ? '单声道' : '立体声'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Presets */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                我的预设
              </h3>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportPresets}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white text-xs transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>导入</span>
                </button>
                <button
                  onClick={handleExportPresets}
                  className="flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>导出</span>
                </button>
                <span className="text-gray-400 text-xs">{userPresets.length} 个</span>
              </div>
            </div>
            
            {userPresets.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm bg-[#12121e] rounded-lg border border-dashed border-[#2a3a50]">
                还没有自定义预设，点击上方"保存为预设"按钮创建
              </div>
            ) : (
              <div className="space-y-2">
                {userPresets.map(preset => (
                  <div
                    key={preset.id}
                    className="p-3 bg-[#12121e] rounded-lg border border-[#2a3a50] hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {editingId === preset.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenamePreset(preset.id)
                            if (e.key === 'Escape') {
                              setEditingId(null)
                              setEditingName('')
                            }
                          }}
                          onBlur={() => handleRenamePreset(preset.id)}
                          className="flex-1 bg-[#0a0a14] border border-blue-500 rounded px-2 py-1 text-sm text-white outline-none"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => {
                            onLoadPreset(preset)
                            onClose()
                          }}
                          className="flex-1 text-left text-white text-sm font-medium hover:text-blue-400 transition-colors"
                        >
                          {preset.name}
                        </button>
                      )}
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-gray-400 bg-[#1a1a2e] px-2 py-1 rounded">
                          {preset.outputFormat}
                        </span>
                        <button
                          onClick={() => {
                            setEditingId(preset.id)
                            setEditingName(preset.name)
                          }}
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          title="重命名"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePreset(preset.id)}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{preset.quality} kbps</span>
                      <span>{preset.encoding}</span>
                      <span>{preset.channel === 'original' ? '原始声道' : preset.channel === 'mono' ? '单声道' : '立体声'}</span>
                      <span className="ml-auto">{formatDate(preset.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a3a50] flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#2a3a50] hover:bg-[#3a4a60] text-white rounded text-sm transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
