import { authCodeStorage } from './authCode'
import { t } from '../utils/i18n'

export const getApiBase = () => {
  // 优先从 window.backendPort 获取（Electron 注入）
  // 其次从 URL 参数获取
  // 最后使用默认值 8001
  const urlParams = new URLSearchParams(window.location.search);
  const port = (window as any).backendPort || urlParams.get('backendPort') || '8001';
  const apiBase = `http://127.0.0.1:${port}/api`;
  console.log(`API Base URL: ${apiBase}`);
  return apiBase;
};

export const API_BASE = getApiBase();

export function getAuthHeaders(): Record<string, string> {
  const authCode = authCodeStorage.getAuthCode()
  const machineCode = authCodeStorage.getMachineCode()
  if (authCode && machineCode) {
    return {
      'X-Auth-Code': authCode,
      'X-Device-Id': machineCode,
    }
  }
  return {}
}

export interface ConvertOptions {
  file: File
  outputFormat: string
  bitrate: number
  channels: string
  encoding: string
  sampleRate: string
  outputPath: string
  startTime?: number
  endTime?: number
  metadata?: AudioMetadata
}

export interface AudioMetadata {
  title?: string
  artist?: string
  album?: string
  year?: string
  genre?: string
}

export interface ConvertResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size?: number
}

// 音频转换（支持剪切和元数据）
export async function convertAudio(options: ConvertOptions): Promise<ConvertResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('output_format', options.outputFormat.toLowerCase())
  formData.append('bitrate', options.bitrate.toString())
  formData.append('channels', options.channels)
  formData.append('encoding', options.encoding.toLowerCase())
  formData.append('sample_rate', options.sampleRate)
  formData.append('output_path', options.outputPath)
  
  // 剪切参数
  if (options.startTime !== undefined) {
    formData.append('start_time', options.startTime.toString())
  }
  if (options.endTime !== undefined) {
    formData.append('end_time', options.endTime.toString())
  }
  
  // 元数据参数
  if (options.metadata) {
    if (options.metadata.title) formData.append('meta_title', options.metadata.title)
    if (options.metadata.artist) formData.append('meta_artist', options.metadata.artist)
    if (options.metadata.album) formData.append('meta_album', options.metadata.album)
    if (options.metadata.year) formData.append('meta_year', options.metadata.year)
    if (options.metadata.genre) formData.append('meta_genre', options.metadata.genre)
  }

  const response = await fetch(`${API_BASE}/convert/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.convert_failed'))
  }

  return response.json()
}

// 获取需求定制页面链接
export interface CustomUrlResult {
  code: number
  msg: string
  time: number
  data: {
    url: string
  }
}

export async function getCustomUrl(): Promise<CustomUrlResult> {
  const response = await fetch('https://api-web.kunqiongai.com/soft_desktop/get_custom_url', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(t('header.get_custom_url_failed'))
  }

  return response.json()
}

// 音频剪切（保持原格式）
export async function cutAudio(
  file: File, 
  startTime: number, 
  endTime: number, 
  outputPath: string,
  outputFormat: string = ''
): Promise<ConvertResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('start_time', startTime.toString())
  formData.append('end_time', endTime.toString())
  formData.append('output_path', outputPath)
  formData.append('output_format', outputFormat)

  const response = await fetch(`${API_BASE}/cut/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.cut_failed'))
  }

  return response.json()
}

// 批量音频剪切
export interface BatchCutResult {
  success: boolean
  message: string
  results: Array<{
    filename: string
    success: boolean
    message: string
    output_path?: string
    output_filename?: string
    size?: number
  }>
}

export async function batchCutAudio(
  files: File[],
  startTimes: number[],
  endTimes: number[],
  outputPath: string,
  outputFormat: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('start_times', JSON.stringify(startTimes))
  formData.append('end_times', JSON.stringify(endTimes))
  formData.append('output_path', outputPath)
  formData.append('output_format', outputFormat)

  const response = await fetch(`${API_BASE}/cut/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.cut_failed'))
  }

  return response.json()
}

// 获取支持的格式
export async function getSupportedFormats(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/convert/formats`, {
    headers: getAuthHeaders(),
  })
  const data = await response.json()
  return data.formats
}

// 健康检查
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase().replace(/\/api$/, '')}/health`)
    return response.ok
  } catch {
    return false
  }
}

// 选择目录结果
export interface SelectDirectoryResult {
  success: boolean
  path: string
  message?: string
  writable?: boolean
}

// 选择目录
export async function selectDirectory(initialPath?: string): Promise<SelectDirectoryResult> {
  // 如果在 Electron 环境中，优先使用原生对话框
  if ((window as any).electron?.showOpenDialog) {
    try {
      const result = await (window as any).electron.showOpenDialog({
        title: t('footer.change_dir'),
        defaultPath: initialPath,
        properties: ['openDirectory', 'createDirectory']
      });
      
      if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
        return {
          success: true,
          path: result.filePaths[0],
          message: t('api.message.select_success'),
          writable: true // Electron 选择的通常可写，后端会再次验证
        };
      } else {
        return { success: false, path: '', message: t('api.error.cancel_select') };
      }
    } catch (error) {
      console.error('Electron dialog error:', error);
      // 如果出错，回退到 HTTP 请求
    }
  }

  try {
    const response = await fetch(`${API_BASE}/fs/select-directory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ path: initialPath || '' })
    })
    if (!response.ok) {
      throw new Error('API error')
    }
    return response.json()
  } catch {
    return { success: false, path: '', message: t('api.error.backend_not_running') }
  }
}

// 打开文件夹
export async function openFolder(path: string): Promise<{ success: boolean; message: string; path?: string }> {
  // 如果在 Electron 环境中，优先使用 shell.openPath
  if ((window as any).electron?.openPath) {
    try {
      // 规范化路径：在 Windows 上将 / 替换为 \
      const isWindows = navigator.platform.indexOf('Win') > -1;
      const normalizedPath = isWindows ? path.replace(/\//g, '\\') : path;
      
      const result = await (window as any).electron.openPath(normalizedPath);
      if (result.success) {
        return { success: true, message: t('api.message.folder_opened'), path: normalizedPath };
      } else {
        console.error('Electron openPath failed:', result.error);
        // 如果出错，回退到 HTTP 请求
      }
    } catch (error) {
      console.error('Electron openPath error:', error);
      // 如果出错，回退到 HTTP 请求
    }
  }

  try {
    console.log('API调用 openFolder:', path)
    console.log('API_BASE:', API_BASE)
    
    const response = await fetch(`${API_BASE}/fs/open-folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ path })
    })
    
    console.log('openFolder响应状态:', response.status)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: t('api.error.unknown_error') }))
      console.error('openFolder API错误:', errorData)
      return { 
        success: false, 
        message: errorData.detail || `HTTP ${response.status} 错误` 
      }
    }
    
    const result = await response.json()
    console.log('openFolder成功:', result)
    return result
  } catch (error) {
    console.error('openFolder异常:', error)
    const errorMsg = error instanceof Error ? error.message : t('api.error.unknown_error')
    return { 
      success: false, 
      message: t('api.error.connection_failed', { error: errorMsg })
    }
  }
}

// 默认输出路径结果
export interface DefaultOutputPathResult {
  path: string
  exists: boolean
  writable: boolean
  error?: string | null
}

// 获取默认输出路径
export async function getDefaultOutputPath(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/fs/default-output-path`, {
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      throw new Error('API error')
    }
    const data: DefaultOutputPathResult = await response.json()
    return data.path
  } catch {
    // 后端未启动时返回默认路径
    return ''
  }
}

// 获取默认输出路径（完整信息）
export async function getDefaultOutputPathInfo(): Promise<DefaultOutputPathResult> {
  try {
    const response = await fetch(`${API_BASE}/fs/default-output-path`, {
      headers: getAuthHeaders(),
    })
    if (!response.ok) {
      throw new Error('API error')
    }
    return response.json()
  } catch {
    return {
      path: '',
      exists: false,
      writable: false,
      error: t('api.error.backend_not_running')
    }
  }
}

// 路径验证结果
export interface ValidatePathResult {
  valid: boolean
  exists: boolean
  writable: boolean
  error?: string | null
  normalized_path?: string
}

// 验证路径
export async function validatePath(path: string): Promise<ValidatePathResult> {
  try {
    const response = await fetch(`${API_BASE}/fs/validate-path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ path })
    })
    if (!response.ok) {
      throw new Error('API error')
    }
    return response.json()
  } catch {
    return {
      valid: false,
      exists: false,
      writable: false,
      error: t('api.error.backend_not_running')
    }
  }
}

// 确保目录存在结果
export interface EnsureDirectoryResult {
  success: boolean
  path: string
  created: boolean
  writable: boolean
  error?: string | null
}

// 确保目录存在
export async function ensureDirectory(path: string): Promise<EnsureDirectoryResult> {
  try {
    const response = await fetch(`${API_BASE}/fs/ensure-directory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ path })
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || t('api.error.create_dir_failed'))
    }
    return response.json()
  } catch (e) {
    return {
      success: false,
      path,
      created: false,
      writable: false,
      error: e instanceof Error ? e.message : t('api.error.create_dir_failed')
    }
  }
}

export interface ExtractOptions {
  file: File
  outputFormat: string
  outputPath: string
  bitrate?: number
  startTime?: number
  endTime?: number
}

// 视频提取音频
export async function extractAudioFromVideo(options: ExtractOptions): Promise<ConvertResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('output_format', options.outputFormat.toLowerCase())
  formData.append('output_path', options.outputPath)
  formData.append('bitrate', (options.bitrate || 192).toString())
  
  if (options.startTime !== undefined) {
    formData.append('start_time', options.startTime.toString())
  }
  if (options.endTime !== undefined) {
    formData.append('end_time', options.endTime.toString())
  }

  const response = await fetch(`${API_BASE}/video/extract/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.extract_failed'))
  }

  return response.json()
}

// 批量视频提取音频
export async function batchExtractAudioFromVideo(
  files: File[],
  outputFormat: string,
  outputPath: string,
  bitrate: number = 192
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('output_format', outputFormat.toLowerCase())
  formData.append('output_path', outputPath)
  formData.append('bitrate', bitrate.toString())

  const response = await fetch(`${API_BASE}/video/extract/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.extract_failed'))
  }

  return response.json()
}


// 音频合并
export interface MergeResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size?: number
}

export async function mergeAudio(
  files: File[],
  transitionDuration: number = 0,
  outputFormat: string = 'mp3',
  outputPath: string = '',
  outputFileName: string = ''
): Promise<MergeResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('transition_duration', transitionDuration.toString())
  formData.append('output_format', outputFormat.toLowerCase())
  formData.append('output_path', outputPath)
  if (outputFileName) formData.append('output_filename', outputFileName)

  const response = await fetch(`${API_BASE}/merge/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.merge_failed'))
  }

  return response.json()
}

// 获取多个音频文件信息
export interface AudioFileInfo {
  path: string
  filename: string
  duration: number
  size: number
  error?: string
}

export async function getAudioFilesInfo(filePaths: string[]): Promise<{ success: boolean; files: AudioFileInfo[] }> {
  const response = await fetch(`${API_BASE}/merge/info?file_paths=${encodeURIComponent(JSON.stringify(filePaths))}`, {
    headers: getAuthHeaders(),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.unknown_error'))
  }

  return response.json()
}


// 音频转文字
export interface TranscribeOptions {
  file: File
  language?: string  // 语言代码，如 'zh', 'en', 'ja'，留空自动检测
  modelSize?: string // 模型大小: tiny, base, small, medium, large
  outputFormat?: string // 输出格式: txt, docx, srt, vtt, json
  outputName?: string // 自定义输出文件名（不含扩展名）
  outputPath?: string // 自定义输出目录
}

export interface TranscribeSegment {
  id: number
  start: number
  end: number
  text: string
}

export interface TranscribeResult {
  success: boolean
  text: string
  language: string
  segments: TranscribeSegment[]
  output_file: string
  output_filename: string
}

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscribeResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  
  if (options.language) {
    formData.append('language', options.language)
  }
  formData.append('model_size', options.modelSize || 'base')
  formData.append('output_format', options.outputFormat || 'txt')
  formData.append('output_name', options.outputName || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/transcribe/transcribe`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.transcribe_failed'))
  }

  return response.json()
}

// 批量音频转文字
export interface BatchTranscribeResult {
  success: boolean
  results: Array<{
    filename: string
    success: boolean
    text?: string
    language?: string
    segments?: TranscribeSegment[]
    output_file?: string
    error?: string
  }>
}

export async function batchTranscribeAudio(
  files: File[],
  language?: string,
  modelSize: string = 'base',
  outputFormat: string = 'txt'
): Promise<BatchTranscribeResult> {
  const results: BatchTranscribeResult = {
    success: true,
    results: []
  }

  // 逐个处理文件（Whisper 模型不适合并行处理）
  for (const file of files) {
    try {
      const result = await transcribeAudio({
        file,
        language,
        modelSize,
        outputFormat
      })
      results.results.push({
        filename: file.name,
        success: true,
        text: result.text,
        language: result.language,
        segments: result.segments,
        output_file: result.output_file
      })
    } catch (error) {
      results.results.push({
        filename: file.name,
        success: false,
        error: error instanceof Error ? error.message : t('api.error.transcribe_failed')
      })
      results.success = false
    }
  }

  return results
}


// 音量调整
export interface VolumeAdjustResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size?: number
}

export async function adjustVolume(
  file: File,
  volume: number,  // 音量倍数 0.1-10.0
  outputFormat: string = '',
  outputPath: string = ''
): Promise<VolumeAdjustResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('volume', volume.toString())
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/volume/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.adjust_volume_failed'))
  }

  return response.json()
}

// 批量音量调整
export async function batchAdjustVolume(
  files: File[],
  volume: number,
  outputFormat: string = '',
  outputPath: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('volume', volume.toString())
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/volume/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.adjust_volume_failed'))
  }

  return response.json()
}

// 音量标准化
export async function normalizeVolume(
  file: File,
  targetLevel: number = -14.0,  // 目标响度 LUFS
  outputFormat: string = '',
  outputPath: string = ''
): Promise<VolumeAdjustResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('target_level', targetLevel.toString())
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/volume/normalize`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('api.error.adjust_volume_failed'))
  }

  return response.json()
}


// 音频录制
export interface SaveRecordingResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
  duration: number
}

export async function saveRecording(
  file: Blob,
  outputFormat: string = 'mp3',
  outputPath: string = '',
  filename: string = ''
): Promise<SaveRecordingResult> {
  const formData = new FormData()
  formData.append('file', file, 'recording.webm')
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)
  formData.append('filename', filename)

  const response = await fetch(`${API_BASE}/record/save`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('record.save_failed'))
  }

  return response.json()
}

export async function deleteRecording(filePath: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/record/delete?file_path=${encodeURIComponent(filePath)}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('record.delete_failed'))
  }

  return response.json()
}


// 音频压缩
export interface CompressOptions {
  file: File
  quality?: string  // low, medium, high, custom
  bitrate?: number  // 自定义比特率 kbps
  ratio?: number    // 压缩比例 20-100 (100%=原文件大小)
  outputFormat?: string
  outputPath?: string
}

export interface CompressResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  original_size: number
  compressed_size: number
  compression_ratio: number
  duration: number
  original_bitrate: number
  target_bitrate: number
}

export async function compressAudio(options: CompressOptions): Promise<CompressResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('quality', options.quality || 'medium')
  if (options.bitrate) {
    formData.append('bitrate', options.bitrate.toString())
  }
  if (options.ratio) {
    formData.append('ratio', options.ratio.toString())
  }
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/compress/`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('compress.failed'))
  }

  return response.json()
}

export async function batchCompressAudio(
  files: File[],
  quality: string = 'medium',
  bitrate?: number,
  outputFormat: string = '',
  outputPath: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('quality', quality)
  if (bitrate) {
    formData.append('bitrate', bitrate.toString())
  }
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/compress/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('compress.failed'))
  }

  return response.json()
}


// 音频变速
export interface SpeedOptions {
  file: File
  speed: number  // 速度倍数 0.5-2.0
  keepPitch?: boolean  // 是否保持音调
  outputFormat?: string
  outputPath?: string
}

export interface SpeedResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
  speed: number
}

export async function changeSpeed(options: SpeedOptions): Promise<SpeedResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('speed', options.speed.toString())
  formData.append('keep_pitch', (options.keepPitch !== false).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/speed/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('speed.failed'))
  }

  return response.json()
}


// 淡入淡出
export interface FadeOptions {
  file: File
  fadeIn: number  // 淡入时长（秒）
  fadeOut: number  // 淡出时长（秒）
  outputFormat?: string
  outputPath?: string
}

export interface FadeResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
  fade_in: number
  fade_out: number
}

export async function fadeAudio(options: FadeOptions): Promise<FadeResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('fade_in', options.fadeIn.toString())
  formData.append('fade_out', options.fadeOut.toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/fade/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('fade.failed'))
  }

  return response.json()
}


// 音频倒放
export interface ReverseOptions {
  file: File
  outputFormat?: string
  outputPath?: string
}

export interface ReverseResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
}

export async function reverseAudio(options: ReverseOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/reverse/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || t('reverse.failed'))
  }

  return response.json()
}


// 音频降噪
export interface DenoiseOptions {
  file: File
  strength?: number  // 降噪强度 0-1
  highpass?: number  // 高通滤波频率
  lowpass?: number   // 低通滤波频率
  outputFormat?: string
  outputPath?: string
}

export async function denoiseAudio(options: DenoiseOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('strength', (options.strength ?? 0.5).toString())
  formData.append('highpass', (options.highpass ?? 0).toString())
  formData.append('lowpass', (options.lowpass ?? 0).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')
  
  console.log('Denoise request:', {
    strength: options.strength,
    highpass: options.highpass,
    lowpass: options.lowpass,
    outputPath: options.outputPath
  })

  const response = await fetch(`${API_BASE}/denoise/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '降噪失败')
  }

  return response.json()
}


// 回声效果
export interface EchoOptions {
  file: File
  delay?: number  // 延迟时间（毫秒）
  decay?: number  // 衰减系数 0-1
  outputFormat?: string
  outputPath?: string
}

export async function echoAudio(options: EchoOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('delay', (options.delay ?? 500).toString())
  formData.append('decay', (options.decay ?? 0.5).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/echo/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '添加回声失败')
  }

  return response.json()
}


// 移除静音
export interface SilenceOptions {
  file: File
  threshold?: number  // 静音阈值 (dB)
  minDuration?: number  // 最小静音时长（秒）
  outputFormat?: string
  outputPath?: string
}

export async function removeSilence(options: SilenceOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('threshold', (options.threshold ?? -50).toString())
  formData.append('min_duration', (options.minDuration ?? 0.5).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/silence/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '移除静音失败')
  }

  return response.json()
}


// 添加BGM
export interface BgmOptions {
  mainAudio: File
  bgmAudio: File
  bgmVolume?: number  // BGM音量 0-1
  loopBgm?: boolean   // 是否循环BGM
  outputFormat?: string
  outputPath?: string
}

export interface BgmResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
}

export async function addBgm(options: BgmOptions): Promise<BgmResult> {
  const formData = new FormData()
  formData.append('main_audio', options.mainAudio)
  formData.append('bgm_audio', options.bgmAudio)
  formData.append('bgm_volume', (options.bgmVolume ?? 0.3).toString())
  formData.append('loop_bgm', (options.loopBgm !== false).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/bgm/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '添加BGM失败')
  }

  return response.json()
}


// 均衡器
export interface EqualizerOptions {
  file: File
  preset?: string  // flat, bass_boost, treble_boost, vocal, rock, pop, jazz, classical, custom
  band60?: number
  band170?: number
  band310?: number
  band600?: number
  band1000?: number
  band3000?: number
  band6000?: number
  band12000?: number
  band14000?: number
  outputFormat?: string
  outputPath?: string
}

export async function applyEqualizer(options: EqualizerOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('preset', options.preset || 'flat')
  formData.append('band_60', (options.band60 ?? 0).toString())
  formData.append('band_170', (options.band170 ?? 0).toString())
  formData.append('band_310', (options.band310 ?? 0).toString())
  formData.append('band_600', (options.band600 ?? 0).toString())
  formData.append('band_1000', (options.band1000 ?? 0).toString())
  formData.append('band_3000', (options.band3000 ?? 0).toString())
  formData.append('band_6000', (options.band6000 ?? 0).toString())
  formData.append('band_12000', (options.band12000 ?? 0).toString())
  formData.append('band_14000', (options.band14000 ?? 0).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/equalizer/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '均衡器处理失败')
  }

  return response.json()
}


// 添加封面
export interface CoverOptions {
  audioFile: File
  coverImage: File
  outputPath?: string
}

export async function addCover(options: CoverOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('audio_file', options.audioFile)
  formData.append('cover_image', options.coverImage)
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/cover/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '添加封面失败')
  }

  return response.json()
}


// 视频替换音频
export interface ReplaceAudioOptions {
  videoFile: File
  audioFile: File
  keepOriginalAudio?: boolean
  audioVolume?: number
  outputPath?: string
}

export async function replaceVideoAudio(options: ReplaceAudioOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('video_file', options.videoFile)
  formData.append('audio_file', options.audioFile)
  formData.append('keep_original_audio', (options.keepOriginalAudio ?? false).toString())
  formData.append('audio_volume', (options.audioVolume ?? 1.0).toString())
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/video/replace/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '替换音频失败')
  }

  return response.json()
}


// 噪音生成
export interface NoiseOptions {
  file: File
  startTime: number
  endTime: number
  noiseType?: string  // white, pink, brown
  noiseVolume?: number
  replaceAudio?: boolean
  outputFormat?: string
  outputPath?: string
}

export async function addNoise(options: NoiseOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('start_time', options.startTime.toString())
  formData.append('end_time', options.endTime.toString())
  formData.append('noise_type', options.noiseType || 'white')
  formData.append('noise_volume', (options.noiseVolume ?? 0.5).toString())
  formData.append('replace_audio', (options.replaceAudio !== false).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/noise/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '添加噪音失败')
  }

  return response.json()
}


// 人声-伴奏提取
export interface VocalExtractOptions {
  file: File
  extractType: 'all' | 'vocals' | 'accompaniment'  // 全部、仅人声、仅伴奏
  model?: string  // htdemucs, htdemucs_ft, mdx_extra
  outputFormat?: string
  outputPath?: string
}

export interface VocalExtractResult {
  success: boolean
  message: string
  results: Array<{
    type: string
    filename: string
    path: string
    size: number
  }>
  output_dir: string
}

export async function extractVocal(options: VocalExtractOptions): Promise<VocalExtractResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('extract_type', options.extractType)
  formData.append('model', options.model || 'htdemucs')
  formData.append('output_format', options.outputFormat || 'mp3')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/vocal/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '分离失败')
  }

  return response.json()
}


// 音频变声
export interface VoiceChangeOptions {
  file: File
  preset?: string
  pitch?: number
  tempo?: number
  outputFormat?: string
  outputPath?: string
}

export interface VoiceChangeResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
  preset: string
  pitch: number
  tempo: number
}

export interface VoicePreset {
  id: string
  name: string
  description: string
}

export async function getVoicePresets(): Promise<{ presets: VoicePreset[] }> {
  const response = await fetch(`${API_BASE}/voice/presets`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('获取预设失败')
  }
  return response.json()
}

export async function changeVoice(options: VoiceChangeOptions): Promise<VoiceChangeResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('preset', options.preset || '')
  formData.append('pitch', (options.pitch ?? 1.0).toString())
  formData.append('tempo', (options.tempo ?? 1.0).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/voice/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '变声失败')
  }

  return response.json()
}

export async function batchChangeVoice(
  files: File[],
  preset: string = '',
  pitch: number = 1.0,
  tempo: number = 1.0,
  outputFormat: string = '',
  outputPath: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('preset', preset)
  formData.append('pitch', pitch.toString())
  formData.append('tempo', tempo.toString())
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/voice/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '批量变声失败')
  }

  return response.json()
}


// 视频消除人声
export interface VideoRemoveVocalResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
  duration: number
  note?: string
}

export async function removeVocalFromVideo(
  file: File,
  outputPath: string = ''
): Promise<VideoRemoveVocalResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/video/remove-vocal/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '消除人声失败')
  }

  return response.json()
}

export async function batchRemoveVocalFromVideo(
  files: File[],
  outputPath: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/video/remove-vocal/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '批量消除人声失败')
  }

  return response.json()
}


// 人声增强
export interface VocalEnhanceOptions {
  file: File
  preset?: string  // light, medium, strong, podcast, phone
  highpass?: number
  lowpass?: number
  eq300?: number
  eq1000?: number
  eq3000?: number
  compression?: number
  normalize?: boolean
  outputFormat?: string
  outputPath?: string
}

export interface VocalEnhanceResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
  preset: string
}

export interface VocalEnhancePreset {
  id: string
  name: string
  description: string
}

export async function getVocalEnhancePresets(): Promise<{ presets: VocalEnhancePreset[] }> {
  const response = await fetch(`${API_BASE}/vocal-enhance/presets`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('获取预设失败')
  }
  return response.json()
}

export async function enhanceVocal(options: VocalEnhanceOptions): Promise<VocalEnhanceResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('preset', options.preset || 'medium')
  formData.append('highpass', (options.highpass ?? 0).toString())
  formData.append('lowpass', (options.lowpass ?? 0).toString())
  formData.append('eq_300', (options.eq300 ?? 0).toString())
  formData.append('eq_1000', (options.eq1000 ?? 0).toString())
  formData.append('eq_3000', (options.eq3000 ?? 0).toString())
  formData.append('compression', (options.compression ?? 0).toString())
  formData.append('normalize', (options.normalize !== false).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/vocal-enhance/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '人声增强失败')
  }

  return response.json()
}

export async function batchEnhanceVocal(
  files: File[],
  preset: string = 'medium',
  outputFormat: string = '',
  outputPath: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('preset', preset)
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/vocal-enhance/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '批量人声增强失败')
  }

  return response.json()
}


// 文字转语音
export interface TTSVoice {
  id: string
  name: string
  gender: string
  style: string
}

export interface TTSOptions {
  text: string
  voice?: string
  rate?: number      // -100 到 +100
  pitch?: number     // -50 到 +50
  volume?: number    // -100 到 +100
  outputFormat?: string
  outputPath?: string
  filename?: string
}

export interface TTSResult {
  success: boolean
  message: string
  output_path: string
  filename: string
  size: number
}

export async function getTTSVoices(): Promise<{ chinese: TTSVoice[], english: TTSVoice[] }> {
  const response = await fetch(`${API_BASE}/tts/voices`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('获取语音列表失败')
  }
  return response.json()
}

export async function textToSpeech(options: TTSOptions): Promise<TTSResult> {
  const formData = new FormData()
  formData.append('text', options.text)
  formData.append('voice', options.voice || 'zh-CN-XiaoxiaoNeural')
  formData.append('rate', (options.rate ?? 0).toString())
  formData.append('pitch', (options.pitch ?? 0).toString())
  formData.append('volume', (options.volume ?? 0).toString())
  formData.append('output_format', options.outputFormat || 'mp3')
  formData.append('output_path', options.outputPath || '')
  formData.append('filename', options.filename || '')

  const response = await fetch(`${API_BASE}/tts/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '转换失败')
  }

  return response.json()
}

export async function previewTTS(
  text: string,
  voice: string = 'zh-CN-XiaoxiaoNeural',
  rate: number = 0,
  pitch: number = 0,
  volume: number = 0
): Promise<Blob> {
  const formData = new FormData()
  formData.append('text', text)
  formData.append('voice', voice)
  formData.append('rate', rate.toString())
  formData.append('pitch', pitch.toString())
  formData.append('volume', volume.toString())

  const response = await fetch(`${API_BASE}/tts/preview`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '试听失败')
  }

  return response.blob()
}

// 带时间戳的试听接口
export interface SentenceTimestamp {
  text: string
  start: number
  end: number
}

export interface PreviewWithTimestampsResult {
  success: boolean
  audio_url: string
  sentences: SentenceTimestamp[]
}

export async function previewTTSWithTimestamps(
  text: string,
  voice: string = 'zh-CN-XiaoxiaoNeural',
  rate: number = 0,
  pitch: number = 0,
  volume: number = 0
): Promise<PreviewWithTimestampsResult> {
  const formData = new FormData()
  formData.append('text', text)
  formData.append('voice', voice)
  formData.append('rate', rate.toString())
  formData.append('pitch', pitch.toString())
  formData.append('volume', volume.toString())

  const response = await fetch(`${API_BASE}/tts/preview-with-timestamps`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '试听失败')
  }

  return response.json()
}


// 添加音效
export interface SoundEffect {
  id: string
  name: string
  file: string
  duration: number
  available?: boolean
  custom?: boolean
}

export interface AddEffectOptions {
  file: File
  startEffect?: string
  endEffect?: string
  startVolume?: number
  endVolume?: number
  outputFormat?: string
  outputPath?: string
}

export async function getSoundEffects(): Promise<{ effects: SoundEffect[] }> {
  const response = await fetch(`${API_BASE}/effect/effects`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('获取音效列表失败')
  }
  return response.json()
}

export async function previewSoundEffect(effectId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/effect/preview/${effectId}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('预览音效失败')
  }
  return response.blob()
}

export async function openEffectsFolder(): Promise<{ success: boolean; path: string }> {
  const response = await fetch(`${API_BASE}/effect/open-folder`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('打开音效文件夹失败')
  }
  return response.json()
}

export async function deleteEffect(effectId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/effect/effect/${effectId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('删除音效失败')
  }
  return response.json()
}

export async function addSoundEffect(options: AddEffectOptions): Promise<ReverseResult> {
  const formData = new FormData()
  formData.append('file', options.file)
  formData.append('start_effect', options.startEffect || '')
  formData.append('end_effect', options.endEffect || '')
  formData.append('start_volume', (options.startVolume ?? 1.0).toString())
  formData.append('end_volume', (options.endVolume ?? 1.0).toString())
  formData.append('output_format', options.outputFormat || '')
  formData.append('output_path', options.outputPath || '')

  const response = await fetch(`${API_BASE}/effect/`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '添加音效失败')
  }

  return response.json()
}

export async function batchAddSoundEffect(
  files: File[],
  startEffect: string = '',
  endEffect: string = '',
  startVolume: number = 1.0,
  endVolume: number = 1.0,
  outputFormat: string = '',
  outputPath: string = ''
): Promise<BatchCutResult> {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('start_effect', startEffect)
  formData.append('end_effect', endEffect)
  formData.append('start_volume', startVolume.toString())
  formData.append('end_volume', endVolume.toString())
  formData.append('output_format', outputFormat)
  formData.append('output_path', outputPath)

  const response = await fetch(`${API_BASE}/effect/batch`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '批量添加音效失败')
  }

  return response.json()
}


// 翻译
export interface TranslateOptions {
  text: string
  sourceLang: string
  targetLang: string
  translator?: string
}

export interface TranslateResult {
  success: boolean
  translated_text: string
  source_lang: string
  target_lang: string
  translator: string
  message?: string
}

export async function translateText(options: TranslateOptions): Promise<TranslateResult> {
  const response = await fetch(`${API_BASE}/translate/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      text: options.text,
      source_lang: options.sourceLang,
      target_lang: options.targetLang,
      translator: options.translator || 'auto'
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '翻译失败')
  }

  return response.json()
}

export async function getTranslateLanguages(): Promise<{ languages: string[] }> {
  const response = await fetch(`${API_BASE}/translate/languages`, {
    headers: getAuthHeaders(),
  })
  return response.json()
}

export async function getTranslators(): Promise<{ translators: string[] }> {
  const response = await fetch(`${API_BASE}/translate/translators`, {
    headers: getAuthHeaders(),
  })
  return response.json()
}

// 文档翻译
export interface DocumentTranslateResult {
  success: boolean
  original_text: string
  translated_text: string
  source_lang: string
  target_lang: string
  translator: string
  filename: string
}

export async function translateDocument(
  file: File,
  sourceLang: string,
  targetLang: string,
  translator: string = 'auto'
): Promise<DocumentTranslateResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('source_lang', sourceLang)
  formData.append('target_lang', targetLang)
  formData.append('translator', translator)

  const response = await fetch(`${API_BASE}/translate/document`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '文档翻译失败')
  }

  return response.json()
}

// 图片翻译
export async function translateImage(
  file: File,
  sourceLang: string,
  targetLang: string,
  translator: string = 'auto'
): Promise<DocumentTranslateResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('source_lang', sourceLang)
  formData.append('target_lang', targetLang)
  formData.append('translator', translator)

  const response = await fetch(`${API_BASE}/translate/image`, {
    method: 'POST',
    body: formData,
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || '图片翻译失败')
  }

  return response.json()
}
