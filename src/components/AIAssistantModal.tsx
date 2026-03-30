import { X, Sparkles, AlertCircle, CheckCircle, Info, TrendingUp, Zap, Settings } from 'lucide-react'
import { useState } from 'react'
import { AudioAnalysisResult, analyzeAudio } from '../services/aiAssistantApi'
import { t } from '../utils/i18n'

interface AIAssistantModalProps {
  isOpen: boolean
  onClose: () => void
  file: File | null
  fileName: string
  onApplySuggestions: (suggestions: AudioAnalysisResult['suggestions']) => void
}

export default function AIAssistantModal({ 
  isOpen, 
  onClose, 
  file, 
  fileName,
  onApplySuggestions 
}: AIAssistantModalProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<AudioAnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleAnalyze = async () => {
    if (!file) return

    setIsAnalyzing(true)
    setError(null)
    
    try {
      const analysisResult = await analyzeAudio(file)
      setResult(analysisResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ai_assistant.analyze_failed'))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleApply = () => {
    if (result?.suggestions) {
      onApplySuggestions(result.suggestions)
      onClose()
    }
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 75) return 'text-blue-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getSeverityColor = (severity: string) => {
    if (severity === 'severe') return 'text-red-400'
    if (severity === 'moderate' || severity === 'high') return 'text-orange-400'
    return 'text-yellow-400'
  }

  const getSeverityIcon = (severity: string) => {
    if (severity === 'severe') return '🔴'
    if (severity === 'moderate' || severity === 'high') return '🟠'
    return '🟡'
  }

  const getProcessingStepName = (step: string) => {
    const names: Record<string, string> = {
      'normalize_loudness': t('ai_assistant.steps.normalize_loudness'),
      'denoise': t('ai_assistant.steps.denoise'),
      'remove_silence': t('ai_assistant.steps.remove_silence'),
      'declip': t('ai_assistant.steps.declip'),
      'compress': t('ai_assistant.steps.compress'),
      'eq': t('ai_assistant.steps.eq')
    }
    return names[step] || step
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1a1a2e] rounded-lg w-[900px] max-h-[85vh] overflow-hidden shadow-xl border border-[#2a3a50]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3a50] bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white text-lg font-medium">{t('ai_assistant.title')}</h2>
              <p className="text-gray-400 text-xs">{t('ai_assistant.description')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-180px)]">
          {/* File Info */}
          <div className="mb-6 p-4 bg-[#12121e] rounded-lg border border-[#2a3a50]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium mb-1">{fileName}</p>
                <p className="text-gray-400 text-xs">{t('ai_assistant.click_to_analyze')}</p>
              </div>
              {!result && (
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !file}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAnalyzing ? t('ai_assistant.analyzing') : t('ai_assistant.start_analyze')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 text-sm font-medium">{t('ai_assistant.analyze_failed')}</p>
                <p className="text-red-300 text-xs mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 text-sm">{t('ai_assistant.analyzing_text')}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-6">
              {/* Quality Score */}
              <div className="p-6 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-lg border border-blue-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t('ai_assistant.quality_score')}
                  </h3>
                  <span className="text-xs text-gray-400">{result.scene.scene_name} · {t('ai_assistant.confidence', { confidence: (result.scene.confidence * 100).toFixed(0) })}</span>
                </div>
                <div className="flex items-end gap-4">
                  <div className={`text-6xl font-bold ${getScoreColor(result.quality_score.score)}`}>
                    {result.quality_score.score.toFixed(0)}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-lg font-medium">{result.quality_score.grade_name}</span>
                      <span className="text-gray-400 text-xs">{t('ai_assistant.score_max')}</span>
                    </div>
                    <div className="h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${
                          result.quality_score.score >= 90 ? 'bg-green-500' :
                          result.quality_score.score >= 75 ? 'bg-blue-500' :
                          result.quality_score.score >= 60 ? 'bg-yellow-500' :
                          result.quality_score.score >= 40 ? 'bg-orange-500' :
                          'bg-red-500'
                        } transition-all duration-500`}
                        style={{ width: `${result.quality_score.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-[#12121e] rounded-lg border border-[#2a3a50]">
                  <p className="text-gray-400 text-xs mb-1">{t('common.duration')}</p>
                  <p className="text-white text-sm font-medium">{formatDuration(result.basic_info.duration)}</p>
                </div>
                <div className="p-3 bg-[#12121e] rounded-lg border border-[#2a3a50]">
                  <p className="text-gray-400 text-xs mb-1">{t('common.size')}</p>
                  <p className="text-white text-sm font-medium">{formatFileSize(result.basic_info.file_size)}</p>
                </div>
                <div className="p-3 bg-[#12121e] rounded-lg border border-[#2a3a50]">
                  <p className="text-gray-400 text-xs mb-1">{t('main.sample_rate') || '采样率'}</p>
                  <p className="text-white text-sm font-medium">{result.basic_info.sample_rate} Hz</p>
                </div>
                <div className="p-3 bg-[#12121e] rounded-lg border border-[#2a3a50]">
                  <p className="text-gray-400 text-xs mb-1">{t('common.channel') || '声道'}</p>
                  <p className="text-white text-sm font-medium">{result.basic_info.channels === 1 ? t('ai_assistant.mono') : t('ai_assistant.stereo')}</p>
                </div>
              </div>

              {/* Problems */}
              {result.problems.length > 0 && (
                <div className="p-4 bg-[#12121e] rounded-lg border border-[#2a3a50]">
                  <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    {t('ai_assistant.problems_detected', { count: result.problems.length })}
                  </h3>
                  <div className="space-y-2">
                    {result.problems.map((problem, index) => (
                      <div key={index} className="p-3 bg-[#1a1a2e] rounded border border-[#2a3a50]">
                        <div className="flex items-start gap-2">
                          <span className="text-lg">{getSeverityIcon(problem.severity)}</span>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${getSeverityColor(problem.severity)}`}>
                              {problem.description}
                            </p>
                            <p className="text-gray-400 text-xs mt-1">{problem.suggestion}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Problems */}
              {result.problems.length === 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-green-400 text-sm font-medium">{t('ai_assistant.quality_good')}</p>
                    <p className="text-green-300 text-xs mt-1">{t('ai_assistant.no_problems')}</p>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <div className="p-4 bg-gradient-to-br from-purple-600/10 to-blue-600/10 rounded-lg border border-purple-500/30">
                <h3 className="text-white text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  {t('ai_assistant.ai_suggestions')}
                </h3>
                
                <div className="space-y-3">
                  {/* Recommended Settings */}
                  <div className="p-3 bg-[#1a1a2e] rounded border border-[#2a3a50]">
                    <p className="text-gray-400 text-xs mb-2">{t('ai_assistant.recommended_config')}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('common.format')}:</span>
                        <span className="text-white font-medium">{result.suggestions.recommended_format}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('common.quality')}:</span>
                        <span className="text-white font-medium">{result.suggestions.recommended_quality} kbps</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('common.channel') || '声道'}:</span>
                        <span className="text-white font-medium">
                          {result.suggestions.recommended_channel === 'mono' ? t('ai_assistant.mono') : 
                           result.suggestions.recommended_channel === 'stereo' ? t('ai_assistant.stereo') : t('ai_assistant.original')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">{t('main.encoding') || '编码'}:</span>
                        <span className="text-white font-medium">{result.suggestions.recommended_encoding}</span>
                      </div>
                    </div>
                  </div>

                  {/* Processing Steps */}
                  {result.suggestions.processing_steps.length > 0 && (
                    <div className="p-3 bg-[#1a1a2e] rounded border border-[#2a3a50]">
                      <p className="text-gray-400 text-xs mb-2">{t('ai_assistant.processing_steps')}</p>
                      <div className="flex flex-wrap gap-2">
                        {result.suggestions.processing_steps.map((step, index) => (
                          <span 
                            key={index}
                            className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded border border-purple-500/30"
                          >
                            {index + 1}. {getProcessingStepName(step)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="flex items-start gap-2 p-3 bg-[#1a1a2e] rounded border border-[#2a3a50]">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-300 text-xs">{result.suggestions.reason}</p>
                  </div>
                </div>
              </div>

              {/* Technical Details */}
              <details className="group">
                <summary className="cursor-pointer p-3 bg-[#12121e] rounded-lg border border-[#2a3a50] hover:border-[#3a4a60] transition-colors">
                  <span className="text-gray-400 text-xs flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    {t('ai_assistant.tech_details')}
                  </span>
                </summary>
                <div className="mt-2 p-4 bg-[#12121e] rounded-lg border border-[#2a3a50] space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400 mb-1">{t('ai_assistant.loudness')}</p>
                      <p className="text-white">{result.loudness.estimated_lufs.toFixed(1)} LUFS</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">{t('ai_assistant.dynamic_range')}</p>
                      <p className="text-white">{result.dynamic_range.dynamic_range_db.toFixed(1)} dB</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">{t('ai_assistant.noise_floor')}</p>
                      <p className="text-white">{result.noise.noise_floor_db.toFixed(1)} dB</p>
                    </div>
                    <div>
                      <p className="text-gray-400 mb-1">{t('ai_assistant.silence_ratio')}</p>
                      <p className="text-white">{result.silence.silence_ratio.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a3a50] flex justify-between items-center bg-[#12121e]">
          <p className="text-gray-400 text-xs">
            {result && t('ai_assistant.analyze_done', { problems: result.problems.length, suggestions: result.suggestions.processing_steps.length })}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#2a3a50] hover:bg-[#3a4a60] text-white rounded text-sm transition-colors"
            >
              {t('ai_assistant.close')}
            </button>
            {result && (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded text-sm font-medium transition-all"
              >
                <Zap className="w-4 h-4" />
                <span>{t('ai_assistant.apply_suggestions')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
