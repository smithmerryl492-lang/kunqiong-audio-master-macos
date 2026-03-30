import { X, Info } from 'lucide-react'
import { useState } from 'react'
import { t } from '../utils/i18n'

interface CompressSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  initialQuality: number
  fileSize: number  // 原始文件大小 (bytes)
  onConfirm: (settings: CompressSettings) => void
}

export interface CompressSettings {
  mode: 'ratio' | 'size' | 'params'
  ratio?: number  // 压缩比例 20-100
  targetSize?: number  // 目标大小 (KB)
  bitrate?: number  // 比特率 (kbps)
  sampleRate?: number  // 采样率
  channels?: number  // 声道数 1或2
}

export default function CompressSettingsModal({ isOpen, onClose, initialQuality, fileSize, onConfirm }: CompressSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'ratio' | 'size' | 'params'>('ratio')
  const [ratio, setRatio] = useState(initialQuality)
  const [bitrate, setBitrate] = useState(192)
  const [sampleRate, setSampleRate] = useState(44100)
  const [channels, setChannels] = useState(2)

  // 文件大小相关计算 (MB)
  const fileSizeMB = fileSize / (1024 * 1024)
  const minSizeMB = Math.max(0.1, fileSizeMB * 0.1)  // 最小压缩到10%
  const maxSizeMB = fileSizeMB
  const [targetSizeMB, setTargetSizeMB] = useState(Math.round(fileSizeMB * 0.5 * 100) / 100)

  if (!isOpen) return null

  const handleConfirm = () => {
    const settings: CompressSettings = { mode: activeTab }
    if (activeTab === 'ratio') {
      settings.ratio = ratio
    } else if (activeTab === 'size') {
      settings.targetSize = Math.round(targetSizeMB * 1024)  // 转换为KB
    } else {
      settings.bitrate = bitrate
      settings.sampleRate = sampleRate
      settings.channels = channels
    }
    onConfirm(settings)
    onClose()
  }

  const handleReset = () => {
    setRatio(70)
    setTargetSizeMB(Math.round(fileSizeMB * 0.5 * 100) / 100)
    setBitrate(192)
    setSampleRate(44100)
    setChannels(2)
  }

  const ratioMarks = [20, 30, 40, 50, 60, 70, 80, 90, 100]

  // 计算气泡位置，限制在滑块区域内不超出
  const getTooltipPosition = (value: number, min: number, max: number) => {
    const percent = ((value - min) / (max - min)) * 100
    // 限制在5%-95%之间，防止超出边界
    return Math.max(5, Math.min(95, percent))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] rounded-lg w-[600px] shadow-2xl border border-[#2a2a40]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a40]">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-500 rounded-sm"></div>
              <div className="w-1 h-4 bg-blue-400 rounded-sm"></div>
            </div>
            <span className="text-white text-sm font-medium">{t("compress.settings_title")}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-5">
          <button
            onClick={() => setActiveTab('ratio')}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              activeTab === 'ratio'
                ? 'bg-blue-600 text-white'
                : 'bg-[#2a2a40] text-gray-400 hover:text-white'
            }`}
          >
            {t("compress.tab_ratio")}
          </button>
          <button
            onClick={() => setActiveTab('size')}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              activeTab === 'size'
                ? 'bg-blue-600 text-white'
                : 'bg-[#2a2a40] text-gray-400 hover:text-white'
            }`}
          >
            {t("compress.tab_size")}
          </button>
          <button
            onClick={() => setActiveTab('params')}
            className={`px-4 py-2 rounded text-sm transition-colors ${
              activeTab === 'params'
                ? 'bg-blue-600 text-white'
                : 'bg-[#2a2a40] text-gray-400 hover:text-white'
            }`}
          >
            {t("compress.tab_params")}
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-6 min-h-[280px]">
          {activeTab === 'ratio' && (
            <div>
              <div className="text-gray-300 text-sm mb-6">{t("compress.ratio_label")}</div>
              
              {/* Ratio Slider */}
              <div className="relative mb-4 px-14">
                {/* Slider Track */}
                <div className="relative">
                  {/* Value Tooltip */}
                  <div 
                    className="absolute -top-8 transition-all z-20"
                    style={{ 
                      left: `${getTooltipPosition(ratio, 20, 100)}%`,
                      transform: 'translateX(-50%)'
                    }}
                  >
                    <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded relative whitespace-nowrap">
                      {ratio}%
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500"></div>
                    </div>
                  </div>

                  <div className="flex items-center gap-0">
                    <span className="absolute -left-14 text-gray-500 text-xs w-12 text-right">{t("compress.smaller_size")}</span>
                    <div className="flex-1 relative h-6 flex items-center">
                    {/* Background segments */}
                    <div className="absolute inset-0 flex">
                      {ratioMarks.slice(0, -1).map((mark, i) => (
                        <div
                          key={mark}
                          className={`flex-1 h-3 ${i === 0 ? 'rounded-l' : ''} ${i === ratioMarks.length - 2 ? 'rounded-r' : ''} ${
                            mark < ratio ? 'bg-blue-500' : 'bg-[#3a3a50]'
                          }`}
                          style={{ marginRight: i < ratioMarks.length - 2 ? '2px' : '0' }}
                        />
                      ))}
                    </div>
                    
                    {/* Slider Input */}
                    <input
                      type="range"
                      min="20"
                      max="100"
                      step="10"
                      value={ratio}
                      onChange={(e) => setRatio(parseInt(e.target.value))}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                    />
                    
                    {/* Recommended marker */}
                    <div 
                      className="absolute top-full mt-1 transform -translate-x-1/2 text-[10px] text-blue-400 whitespace-nowrap"
                      style={{ left: `${((70 - 20) / 80) * 100}%` }}
                    >
                      {t("compress.recommended_ratio")}
                    </div>
                  </div>
                  <span className="absolute -right-14 text-gray-500 text-xs w-12">{t("compress.larger_size")}</span>
                </div>

                {/* Scale marks */}
                <div className="flex justify-between mt-3">
                  {ratioMarks.map(mark => (
                    <span key={mark} className="text-gray-500 text-xs">{mark}%</span>
                  ))}
                </div>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 mt-10 text-gray-500 text-xs">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p>{t("compress.ratio_info_1")}</p>
                  <p>{t("compress.ratio_info_2")}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'size' && (
            <div>
              <div className="text-white text-base font-medium mb-6">{t("compress.size_label")}</div>
              
              <div className="flex items-center gap-4">
                <span className="text-gray-400 text-sm">{t("compress.expected_size")}</span>
                <input
                  type="number"
                  min={minSizeMB.toFixed(2)}
                  max={maxSizeMB.toFixed(2)}
                  step="0.01"
                  value={targetSizeMB}
                  onChange={(e) => setTargetSizeMB(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-[#0a0a14] border border-[#2a2a40] rounded px-3 py-2 text-white text-sm outline-none focus:border-blue-500 text-center"
                />
                <span className="text-gray-400 text-sm">MB</span>
                <span className="text-gray-500 text-sm ml-4">{t("compress.range_label")}</span>
                <span className="text-gray-400 text-sm">{minSizeMB.toFixed(2)}MB - {maxSizeMB.toFixed(2)}MB</span>
              </div>

              <div className="flex items-start gap-2 mt-8 text-gray-500 text-xs">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p>{t("compress.size_info_1")}</p>
                  <p>{t("compress.size_info_2")}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="space-y-6">
              {/* 比特率 */}
              <div>
                <div className="text-white text-sm font-medium mb-4">{t("compress.bitrate")}</div>
                <div className="relative mb-2 px-14">
                  <div className="relative">
                    {/* Value Tooltip */}
                    <div 
                      className="absolute -top-8 transition-all z-20"
                      style={{ 
                        left: `${getTooltipPosition(bitrate, 32, 320)}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded relative whitespace-nowrap">
                        {bitrate}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500"></div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <span className="absolute -left-14 text-gray-500 text-xs w-12 text-right">{t("compress.smaller_size")}</span>
                      <div className="flex-1 relative h-6 flex items-center">
                        <div className="absolute inset-0 flex">
                          {[32, 70, 106, 141, 178, 213, 250, 285].map((mark, i) => (
                            <div
                              key={mark}
                              className={`flex-1 h-3 ${i === 0 ? 'rounded-l' : ''} ${i === 7 ? 'rounded-r' : ''} ${
                                mark < bitrate ? 'bg-blue-500' : 'bg-[#3a3a50]'
                              }`}
                              style={{ marginRight: i < 7 ? '2px' : '0' }}
                            />
                          ))}
                        </div>
                        <input
                          type="range"
                          min="32"
                          max="320"
                          step="1"
                          value={bitrate}
                          onChange={(e) => setBitrate(parseInt(e.target.value))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                        />
                      </div>
                      <span className="absolute -right-14 text-gray-500 text-xs w-12">{t("compress.larger_size")}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      {[32, 70, 106, 141, 178, 213, 250, 285, 320].map(mark => (
                        <span key={mark} className="text-gray-500 text-xs">{mark}</span>
                      ))}
                      <span className="text-gray-500 text-xs">/Kbps</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 采样率 */}
              <div>
                <div className="text-white text-sm font-medium mb-4">{t("compress.sample_rate")}</div>
                <div className="relative mb-2 px-14">
                  <div className="relative">
                    {/* Value Tooltip */}
                    <div 
                      className="absolute -top-8 transition-all z-20"
                      style={{ 
                        left: `${getTooltipPosition(sampleRate, 8000, 48000)}%`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded relative whitespace-nowrap">
                        {sampleRate}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-500"></div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      <span className="absolute -left-14 text-gray-500 text-xs w-12 text-right">{t("compress.smaller_size")}</span>
                      <div className="flex-1 relative h-6 flex items-center">
                        <div className="absolute inset-0 flex">
                          {[8000, 13000, 18500, 23200, 28300, 33200, 38500, 43000].map((mark, i) => (
                            <div
                              key={mark}
                              className={`flex-1 h-3 ${i === 0 ? 'rounded-l' : ''} ${i === 7 ? 'rounded-r' : ''} ${
                                mark < sampleRate ? 'bg-blue-500' : 'bg-[#3a3a50]'
                              }`}
                              style={{ marginRight: i < 7 ? '2px' : '0' }}
                            />
                          ))}
                        </div>
                        <input
                          type="range"
                          min="8000"
                          max="48000"
                          step="100"
                          value={sampleRate}
                          onChange={(e) => setSampleRate(parseInt(e.target.value))}
                          className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                        />
                      </div>
                      <span className="absolute -right-14 text-gray-500 text-xs w-12">{t("compress.larger_size")}</span>
                    </div>
                    <div className="flex justify-between mt-2">
                      {[8000, 13000, 18500, 23200, 28300, 33200, 38500, 43000, 48000].map(mark => (
                        <span key={mark} className="text-gray-500 text-xs">{mark}</span>
                      ))}
                      <span className="text-gray-500 text-xs">/Hz</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 声道数 */}
              <div className="flex items-center gap-4">
                <span className="text-white text-sm font-medium">{t("compress.channels")}</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channels"
                    checked={channels === 1}
                    onChange={() => setChannels(1)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="text-gray-400 text-sm">{t("compress.mono")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channels"
                    checked={channels === 2}
                    onChange={() => setChannels(2)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="text-gray-400 text-sm">{t("compress.stereo")}</span>
                </label>
                <span className="text-gray-500 text-xs ml-4">（注：比特率越大、采样率越高、声道数越多，文件越大）</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#2a2a40]">
          <button
            onClick={handleReset}
            className="px-8 py-2 bg-transparent border border-[#3a3a50] text-gray-300 rounded text-sm hover:bg-[#2a2a40] transition-colors"
          >
            {t("compress.reset")}
          </button>
          <button
            onClick={handleConfirm}
            className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            {t("compress.confirm")}
          </button>
        </div>
      </div>
    </div>
  )
}
