import { t } from '../utils/i18n'

// 预设服务 - 管理音频转换参数预设

export interface AudioPreset {
  id: string
  name: string
  outputFormat: string
  quality: number
  channel: string
  encoding: string
  sampleRate: string
  isBuiltIn?: boolean
  createdAt: number
}

const STORAGE_KEY = 'audio_presets'

// 获取内置预设
function getBuiltInPresets(): AudioPreset[] {
  return [
    {
      id: 'high-quality-mp3',
      name: t('common_presets.high_quality_mp3'),
      outputFormat: 'MP3',
      quality: 320,
      channel: 'original',
      encoding: 'VBR',
      sampleRate: t('common_presets.auto'),
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'standard-mp3',
      name: t('common_presets.standard_mp3'),
      outputFormat: 'MP3',
      quality: 192,
      channel: 'original',
      encoding: 'VBR',
      sampleRate: t('common_presets.auto'),
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'compressed-mp3',
      name: t('common_presets.compressed_mp3'),
      outputFormat: 'MP3',
      quality: 128,
      channel: 'original',
      encoding: 'CBR',
      sampleRate: t('common_presets.auto'),
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'lossless-flac',
      name: t('common_presets.lossless_flac'),
      outputFormat: 'FLAC',
      quality: 320,
      channel: 'original',
      encoding: 'VBR',
      sampleRate: t('common_presets.auto'),
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'high-quality-wav',
      name: t('common_presets.high_quality_wav'),
      outputFormat: 'WAV',
      quality: 320,
      channel: 'original',
      encoding: 'VBR',
      sampleRate: '48000',
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'podcast-optimized',
      name: t('common_presets.podcast_opt'),
      outputFormat: 'MP3',
      quality: 96,
      channel: 'mono',
      encoding: 'CBR',
      sampleRate: '44100',
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'voice-recording',
      name: t('common_presets.voice_record'),
      outputFormat: 'MP3',
      quality: 64,
      channel: 'mono',
      encoding: 'CBR',
      sampleRate: '22050',
      isBuiltIn: true,
      createdAt: Date.now()
    },
    {
      id: 'music-production',
      name: t('common_presets.music_prod'),
      outputFormat: 'WAV',
      quality: 320,
      channel: 'original',
      encoding: 'VBR',
      sampleRate: '96000',
      isBuiltIn: true,
      createdAt: Date.now()
    }
  ]
}

// 获取所有预设（内置 + 用户自定义）
export function getAllPresets(): AudioPreset[] {
  const userPresets = getUserPresets()
  return [...getBuiltInPresets(), ...userPresets]
}

// 获取用户自定义预设
export function getUserPresets(): AudioPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to load presets:', error)
    return []
  }
}

// 保存预设
export function savePreset(preset: Omit<AudioPreset, 'id' | 'createdAt'>): AudioPreset {
  const userPresets = getUserPresets()
  
  const newPreset: AudioPreset = {
    ...preset,
    id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now()
  }
  
  userPresets.push(newPreset)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets))
  
  return newPreset
}

// 更新预设
export function updatePreset(id: string, updates: Partial<AudioPreset>): boolean {
  const userPresets = getUserPresets()
  const index = userPresets.findIndex(p => p.id === id)
  
  if (index === -1) return false
  
  userPresets[index] = { ...userPresets[index], ...updates }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets))
  
  return true
}

// 删除预设
export function deletePreset(id: string): boolean {
  const userPresets = getUserPresets()
  const filtered = userPresets.filter(p => p.id !== id)
  
  if (filtered.length === userPresets.length) return false
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  return true
}

// 获取单个预设
export function getPreset(id: string): AudioPreset | null {
  const allPresets = getAllPresets()
  return allPresets.find(p => p.id === id) || null
}

// 导出预设到文件
export function exportPresets(presets: AudioPreset[]): void {
  const dataStr = JSON.stringify(presets, null, 2)
  const dataBlob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(dataBlob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = `audio-presets-${Date.now()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// 从文件导入预设
export function importPresets(file: File): Promise<AudioPreset[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const presets = JSON.parse(e.target?.result as string) as AudioPreset[]
        
        // 验证数据格式
        if (!Array.isArray(presets)) {
          throw new Error('Invalid preset format')
        }
        
        // 添加到用户预设
        const userPresets = getUserPresets()
        const newPresets = presets.map(p => ({
          ...p,
          id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isBuiltIn: false,
          createdAt: Date.now()
        }))
        
        const combined = [...userPresets, ...newPresets]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(combined))
        
        resolve(newPresets)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
