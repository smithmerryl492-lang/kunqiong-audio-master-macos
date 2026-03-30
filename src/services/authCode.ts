// 授权码相关 API 服务

const API_BASE = 'https://api-web.kunqiongai.com'

export interface CheckAuthCodeResponse {
  code: number
  msg: string
  time: number
  data: {
    is_need_auth_code: number
    auth_code_url?: string
  }
}

export interface ValidateAuthCodeResponse {
  code: number
  msg: string
  time: number
  data: {
    auth_code_status: number
  }
}

// 获取机器码（通过 Electron 获取真实硬件信息）
export async function getMachineCode(): Promise<string> {
  // 先检查缓存
  const cachedCode = localStorage.getItem('machine_code')
  if (cachedCode) {
    return cachedCode
  }

  try {
    // 尝试通过 Electron 获取真实机器码
    if (window.electronAPI?.getMachineCode) {
      const machineCode = await window.electronAPI.getMachineCode()
      if (machineCode) {
        localStorage.setItem('machine_code', machineCode)
        return machineCode
      }
    }
  } catch (error) {
    console.error('Failed to get machine code from Electron:', error)
  }

  // 降级方案：生成一个基于浏览器指纹的设备 ID
  let deviceId = localStorage.getItem('device_id')
  if (!deviceId) {
    const randomPart = Math.random().toString(36).substring(2, 15)
    const timePart = Date.now().toString(36)
    deviceId = `${timePart}-${randomPart}`
    localStorage.setItem('device_id', deviceId)
  }
  return deviceId
}

// 检查是否需要授权码
export async function checkNeedAuthCode(softNumber: string = '10003'): Promise<{
  isNeed: boolean
  authCodeUrl?: string
}> {
  console.log('checkNeedAuthCode called with softNumber:', softNumber)
  try {
    const machineCode = await getMachineCode()
    console.log('machineCode:', machineCode)
    const formData = new URLSearchParams()
    formData.append('device_id', machineCode)
    formData.append('soft_number', softNumber)

    console.log('Calling API:', `${API_BASE}/soft_desktop/check_get_auth_code`)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8秒超时

    const response = await fetch(
      `${API_BASE}/soft_desktop/check_get_auth_code`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)

    console.log('API response status:', response.status)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: CheckAuthCodeResponse = await response.json()
    console.log('API response data:', JSON.stringify(data))
    if (data.code !== 1) {
      throw new Error(data.msg || '检查授权码失败')
    }

    // 构建完整的授权码获取 URL（带上 device_id 和 software_code 参数）
    let fullAuthCodeUrl = data.data.auth_code_url
    if (fullAuthCodeUrl && data.data.is_need_auth_code === 1) {
      const separator = fullAuthCodeUrl.includes('?') ? '&' : '?'
      fullAuthCodeUrl = `${fullAuthCodeUrl}${separator}device_id=${encodeURIComponent(machineCode)}&software_code=${encodeURIComponent(softNumber)}`
    }

    console.log('checkNeedAuthCode result: isNeed =', data.data.is_need_auth_code === 1)
    return {
      isNeed: data.data.is_need_auth_code === 1,
      authCodeUrl: fullAuthCodeUrl,
    }
  } catch (error) {
    console.error('Failed to check auth code requirement:', error)
    return { isNeed: false }
  }
}

// 验证授权码
export async function validateAuthCode(
  authCode: string,
  softNumber: string = '10003'
): Promise<boolean> {
  try {
    const machineCode = await getMachineCode()
    const formData = new URLSearchParams()
    formData.append('device_id', machineCode)
    formData.append('soft_number', softNumber)
    formData.append('auth_code', authCode)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000) // 8秒超时

    const response = await fetch(
      `${API_BASE}/soft_desktop/check_auth_code_valid`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: controller.signal
      }
    )
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: ValidateAuthCodeResponse = await response.json()
    if (data.code !== 1) {
      throw new Error(data.msg || '验证授权码失败')
    }

    // 验证成功后保存授权码和机器码
    if (data.data.auth_code_status === 1) {
      authCodeStorage.setAuthCode(authCode)
      authCodeStorage.setMachineCode(machineCode)
    }

    return data.data.auth_code_status === 1
  } catch (error) {
    console.error('Failed to validate auth code:', error)
    return false
  }
}

// 检查本地授权码是否有效（重新验证）
export async function checkLocalAuthCodeValid(softNumber: string = '10003'): Promise<boolean> {
  const savedAuthCode = authCodeStorage.getAuthCode()
  if (!savedAuthCode) {
    return false
  }

  // 重新验证授权码
  return await validateAuthCode(savedAuthCode, softNumber)
}

// 本地存储授权码
export const authCodeStorage = {
  setAuthCode: (authCode: string) => {
    localStorage.setItem('auth_code', authCode)
  },

  getAuthCode: (): string | null => {
    return localStorage.getItem('auth_code')
  },

  removeAuthCode: () => {
    localStorage.removeItem('auth_code')
  },

  setMachineCode: (machineCode: string) => {
    localStorage.setItem('machine_code', machineCode)
  },

  getMachineCode: (): string | null => {
    return localStorage.getItem('machine_code')
  },

  clear: () => {
    localStorage.removeItem('auth_code')
    localStorage.removeItem('machine_code')
  },
}
