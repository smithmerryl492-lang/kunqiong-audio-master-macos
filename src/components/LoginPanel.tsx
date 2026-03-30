import { useState, useEffect, useRef } from 'react'
import { X, Loader, LogOut, Copy, Check } from 'lucide-react'
import {
  generateSignedNonce,
  encodeSignedNonce,
  getWebLoginUrl,
  pollToken,
  checkLogin,
  getUserInfo,
  logout,
  authStorage,
  UserInfo,
} from '../services/auth'

interface LoginPanelProps {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: (userInfo: UserInfo) => void
  onLogout: () => void
  userInfo: UserInfo | null
  isLoggedIn: boolean
}

export default function LoginPanel({
  isOpen,
  onClose,
  onLoginSuccess,
  onLogout,
  userInfo,
  isLoggedIn,
}: LoginPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginUrl, setLoginUrl] = useState<string | null>(null)
  const [encodedNonce, setEncodedNonce] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [pollProgress, setPollProgress] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [copied, setCopied] = useState(false)

  // 开始登录流程
  const handleStartLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. 生成带签名的 nonce
      const signedNonce = await generateSignedNonce()
      const encoded = encodeSignedNonce(signedNonce)
      setEncodedNonce(encoded)

      // 2. 获取网页端登录地址
      let webLoginUrl = 'http://111.229.158.50:1388/login'
      try {
        const result = await getWebLoginUrl()
        webLoginUrl = result
      } catch (err) {
        console.warn('Failed to get login URL from API, using default:', err)
      }

      // 3. 拼接完整的登录 URL（携带 client_type 和 client_nonce）
      const fullLoginUrl = `${webLoginUrl}?client_type=desktop&client_nonce=${encoded}`
      setLoginUrl(fullLoginUrl)

      // 4. 打开登录页面
      await openExternalBrowser(fullLoginUrl)

      // 5. 开始轮询
      setIsPolling(true)
      setIsLoading(false)
      abortControllerRef.current = new AbortController()

      try {
        const token = await pollToken(
          encoded,
          300000, // 300 秒超时
          2000, // 每 2 秒轮询一次
          (elapsed) => {
            setPollProgress(Math.min(elapsed / 300000, 1))
          },
          abortControllerRef.current.signal
        )

        // 6. 保存 token
        authStorage.setToken(token)

        // 7. 获取用户信息
        const info = await getUserInfo(token)
        authStorage.setUserInfo(info)

        // 8. 回调成功
        onLoginSuccess(info)
        setIsPolling(false)
        setLoginUrl(null)
        setEncodedNonce(null)
        onClose()
      } catch (err) {
        if (err instanceof Error && err.message === '登录已取消') {
          setError('登录已取消')
        } else {
          setError(err instanceof Error ? err.message : '登录失败')
        }
        setIsPolling(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动登录失败')
      setIsLoading(false)
    }
  }

  // 唤起外部浏览器
  const openExternalBrowser = async (url: string): Promise<boolean> => {
    try {
      // 直接使用 window.open 作为唯一方案
      const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (newWindow) {
        // 尝试获得焦点
        try {
          newWindow.focus()
        } catch (e) {
          // 某些浏览器可能不允许
        }
        return true
      }

      return false
    } catch (err) {
      console.error('Failed to open external browser:', err)
      return false
    }
  }

  // 取消登录
  const handleCancelLogin = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsPolling(false)
    setLoginUrl(null)
    setEncodedNonce(null)
    setPollProgress(0)
  }

  // 退出登录
  const handleLogout = async () => {
    try {
      const token = authStorage.getToken()
      if (token) {
        await logout(token)
      }
      authStorage.clear()
      onLogout()
      onClose()
    } catch (err) {
      console.error('Logout failed:', err)
      // 即使失败也清除本地数据
      authStorage.clear()
      onLogout()
      onClose()
    }
  }

  // 复制登录链接
  const handleCopyUrl = () => {
    if (loginUrl) {
      navigator.clipboard.writeText(loginUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-[#1a1a2e] rounded-lg w-[400px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="px-5 py-4 border-b border-[#2a3a50] flex justify-between items-center">
          <h3 className="text-white text-sm font-medium">
            {isLoggedIn ? '用户信息' : '登录'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="p-5">
          {isLoggedIn && userInfo ? (
            // 已登录状态
            <div className="space-y-4">
              {/* 用户头像和昵称 */}
              <div className="flex items-center gap-3">
                <img
                  src={userInfo.avatar}
                  alt={userInfo.nickname}
                  className="w-12 h-12 rounded-full object-cover border border-[#2a3a50]"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"%3E%3Cpath d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/%3E%3Ccircle cx="12" cy="7" r="4"/%3E%3C/svg%3E'
                  }}
                />
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">
                    {userInfo.nickname}
                  </p>
                  <p className="text-gray-400 text-xs">已登录</p>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="border-t border-[#2a3a50]"></div>

              {/* 退出登录按钮 */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 text-sm rounded transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>退出登录</span>
              </button>
            </div>
          ) : isPolling ? (
            // 登录中状态
            <div className="space-y-4">
              <div className="text-center">
                <Loader className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-gray-300 text-sm mb-2">正在登录中...</p>
                <p className="text-gray-500 text-xs">
                  请在浏览器中完成登录
                </p>
              </div>

              {/* 进度条 */}
              <div className="bg-[#0a0a14] rounded-full h-1 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${pollProgress * 100}%` }}
                ></div>
              </div>

              {/* 登录链接（备用） */}
              {loginUrl && (
                <div className="bg-[#0a0a14] rounded p-3 space-y-2">
                  <p className="text-gray-400 text-xs">
                    如果浏览器未打开，请手动访问：
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={loginUrl}
                      readOnly
                      className="flex-1 bg-[#12121e] text-gray-300 text-xs rounded px-2 py-1 border border-[#2a3a50] outline-none"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="p-1 bg-[#2a3a50] hover:bg-[#3a4a60] text-gray-400 hover:text-white rounded transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 取消按钮 */}
              <button
                onClick={handleCancelLogin}
                className="w-full px-4 py-2 bg-[#2a3a50] hover:bg-[#3a4a60] text-gray-300 hover:text-white text-sm rounded transition-colors"
              >
                取消登录
              </button>
            </div>
          ) : (
            // 未登录状态
            <div className="space-y-4">
              {error && (
                <div className="bg-red-600/20 border border-red-600/50 rounded p-3">
                  <p className="text-red-400 text-xs">{error}</p>
                </div>
              )}

              <p className="text-gray-400 text-sm">
                点击下方按钮，在浏览器中完成登录
              </p>

              <button
                onClick={handleStartLogin}
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-600 text-white text-sm font-medium rounded transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>启动登录...</span>
                  </>
                ) : (
                  <span>点击登录</span>
                )}
              </button>

              <p className="text-gray-500 text-xs text-center">
                登录后可同步您的账户信息
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
