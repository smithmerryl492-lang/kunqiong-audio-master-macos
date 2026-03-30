// AI音频助手API服务

export interface AudioAnalysisResult {
  success: boolean
  basic_info: {
    duration: number
    sample_rate: number
    channels: number
    file_size: number
    samples: number
  }
  quality_score: {
    score: number
    grade: string
    grade_name: string
  }
  loudness: {
    average_loudness: number
    max_loudness: number
    min_loudness: number
    average_db: number
    max_db: number
    estimated_lufs: number
  }
  dynamic_range: {
    dynamic_range_db: number
    is_compressed: boolean
  }
  clipping: {
    clipping_rate: number
    has_clipping: boolean
    clipped_samples: number
    severity: string
  }
  silence: {
    silence_ratio: number
    silent_duration: number
    non_silent_duration: number
    silence_intervals: number
    has_excessive_silence: boolean
  }
  spectrum: {
    spectral_centroid: number
    spectral_bandwidth: number
    spectral_rolloff: number
    zero_crossing_rate: number
    is_rich_spectrum: boolean
  }
  noise: {
    noise_floor_db: number
    has_noise: boolean
    noise_level: string
  }
  scene: {
    scene: string
    scene_name: string
    confidence: number
  }
  problems: Array<{
    type: string
    severity: string
    description: string
    suggestion: string
  }>
  suggestions: {
    recommended_format: string
    recommended_quality: number
    recommended_sample_rate: string
    recommended_channel: string
    recommended_encoding: string
    processing_steps: string[]
    target_lufs: number
    reason: string
    priority: string
  }
}

const API_BASE = 'http://127.0.0.1:8001'

export async function analyzeAudio(file: File): Promise<AudioAnalysisResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/analysis/analyze`, {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error(`分析失败: ${response.statusText}`)
  }

  return response.json()
}
