// API 基础 URL
const API_BASE = 'https://api-web.kunqiongai.com'

// 登录相关接口类型定义
export interface UserInfo {
  avatar: string
  nickname: string
}

export interface LoginResponse {
  code: number
  msg: string
  time: number
  data: {
    token: string
  }
}

export interface CheckLoginResponse {
  code: number
  msg: string
  time: number
  data: unknown[]
}

export interface UserInfoResponse {
  code: number
  msg: string
  time: number
  data: {
    user_info: UserInfo
  }
}

export interface WebLoginUrlResponse {
  code: number
  msg: string
  time: number
  data: {
    login_url: string
  }
}

export interface LogoutResponse {
  code: number
  msg: string
  time: number
  data: null
}

// 签名的 nonce 数据结构
export interface SignedNonce {
  nonce: string
  timestamp: number
  signature: string
}

// 生成签名的 nonce（根据文档示例代码实现）
export async function generateSignedNonce(): Promise<SignedNonce> {
  // 1. 生成随机 nonce（UUID格式，去掉连字符）
  const randomBytes = new Uint8Array(16)
  crypto.getRandomValues(randomBytes)
  const nonce = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  // 2. 生成时间戳（秒级），用于防重放攻击
  const timestamp = Math.floor(Date.now() / 1000)

  // 3. 构造待签名的字符串（nonce + 时间戳，用分隔符区分）
  const message = `${nonce}|${timestamp}`

  // 4. HMAC-SHA256签名（算法与服务端一致）
  const SECRET_KEY = '7530bfb1ad6c41627b0f0620078fa5ed'
  const encoder = new TextEncoder()
  const keyData = encoder.encode(SECRET_KEY)
  const messageData = encoder.encode(message)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData)
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  // 5. 返回组合数据
  return {
    nonce,
    timestamp,
    signature
  }
}

// 将带签名的 nonce 编码为 URL 安全的字符串
export function encodeSignedNonce(signedNonce: SignedNonce): string {
  // 先转为 JSON 字符串，再 base64 编码（避免 URL 转义问题）
  const jsonStr = JSON.stringify(signedNonce)
  const base64Str = btoa(jsonStr)
  // 替换 base64 中的 URL 不安全字符
  const urlSafeStr = base64Str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return urlSafeStr
}

// 获取网页端登录地址
export async function getWebLoginUrl(): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/soft_desktop/get_web_login_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: WebLoginUrlResponse = await response.json()
    if (data.code !== 1) {
      throw new Error(data.msg || '获取登录地址失败')
    }

    return data.data.login_url
  } catch (error) {
    console.error('Failed to get web login URL:', error)
    throw error
  }
}

// 获取登录令牌
export async function getLoginToken(clientNonce: string): Promise<string | null> {
  try {
    const formData = new URLSearchParams()
    formData.append('client_type', 'desktop')
    formData.append('client_nonce', clientNonce)

    const response = await fetch(`${API_BASE}/user/desktop_get_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: LoginResponse = await response.json()
    if (data.code !== 1) {
      if (data.msg === '正在登录中，请稍后再试') {
        // 登录中，继续轮询
        return null
      }
      throw new Error(data.msg || '获取令牌失败')
    }

    return data.data.token
  } catch (error) {
    console.error('Failed to get login token:', error)
    throw error
  }
}

// 检查是否已登录
export async function checkLogin(token: string): Promise<boolean> {
  try {
    const formData = new URLSearchParams()
    formData.append('token', token)

    const response = await fetch(`${API_BASE}/user/check_login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    if (!response.ok) {
      return false
    }

    const data: CheckLoginResponse = await response.json()
    return data.code === 1
  } catch (error) {
    console.error('Failed to check login:', error)
    return false
  }
}

// 获取用户信息
export async function getUserInfo(token: string): Promise<UserInfo> {
  try {
    const response = await fetch(`${API_BASE}/soft_desktop/get_user_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'token': token,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: UserInfoResponse = await response.json()
    if (data.code !== 1) {
      throw new Error(data.msg || '获取用户信息失败')
    }

    return data.data.user_info
  } catch (error) {
    console.error('Failed to get user info:', error)
    throw error
  }
}

// 退出登录
export async function logout(token: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'token': token,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data: LogoutResponse = await response.json()
    if (data.code !== 1) {
      throw new Error(data.msg || '退出登录失败')
    }
  } catch (error) {
    console.error('Failed to logout:', error)
    throw error
  }
}

// 轮询获取令牌
export async function pollToken(
  clientNonce: string,
  maxWaitTime: number = 300000, // 默认 300 秒
  pollInterval: number = 2000, // 默认每 2 秒轮询一次
  onProgress?: (elapsed: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const startTime = Date.now()

  while (true) {
    // 检查是否超时
    const elapsed = Date.now() - startTime
    if (elapsed > maxWaitTime) {
      throw new Error('登录超时，请重试')
    }

    // 检查是否被中止
    if (signal?.aborted) {
      throw new Error('登录已取消')
    }

    try {
      // 尝试获取令牌
      const token = await getLoginToken(clientNonce)
      if (token) {
        return token
      }
      // 登录中，继续轮询
    } catch (error) {
      // 令牌还未准备好，继续轮询
    }

    // 更新进度
    if (onProgress) {
      onProgress(elapsed)
    }

    // 等待后再轮询
    await new Promise(resolve => setTimeout(resolve, pollInterval))
  }
}

// 检查是否登录（使用本地存储的token）
export async function checkLoginStatus(): Promise<boolean> {
  const token = authStorage.getToken()
  if (!token) {
    return false
  }
  return await checkLogin(token)
}

// 本地存储管理
export const authStorage = {
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token)
  },

  getToken: (): string | null => {
    return localStorage.getItem('auth_token')
  },

  removeToken: () => {
    localStorage.removeItem('auth_token')
  },

  setUserInfo: (userInfo: UserInfo) => {
    localStorage.setItem('user_info', JSON.stringify(userInfo))
  },

  getUserInfo: (): UserInfo | null => {
    const data = localStorage.getItem('user_info')
    return data ? JSON.parse(data) : null
  },

  removeUserInfo: () => {
    localStorage.removeItem('user_info')
  },

  clear: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
  },
}
