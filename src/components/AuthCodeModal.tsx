import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, Loader } from 'lucide-react'
import { validateAuthCode, checkNeedAuthCode } from '../services/authCode'
import kunqiongIcon from '../../kunqiong.png'
import { t } from '../utils/i18n'

interface AuthCodeModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (authCode: string) => void
}

export default function AuthCodeModal({
  isOpen,
  onClose,
  onSuccess,
}: AuthCodeModalProps) {
  const [authCode, setAuthCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authCodeUrl, setAuthCodeUrl] = useState<string | null>(null)

  // 弹窗打开时获取授权码 URL
  useEffect(() => {
    if (isOpen) {
      const fetchAuthCodeUrl = async () => {
        try {
          const { authCodeUrl } = await checkNeedAuthCode()
          setAuthCodeUrl(authCodeUrl || null)
        } catch (err) {
          console.error('Failed to fetch auth code URL:', err)
        }
      }
      fetchAuthCodeUrl()
    }
  }, [isOpen])

  const handleValidate = async () => {
    if (!authCode.trim()) {
      setError(t('auth.input_empty'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const isValid = await validateAuthCode(authCode)
      if (isValid) {
        onSuccess(authCode)
        setAuthCode('')
        onClose()
      } else {
        setError(t('auth.invalid_code'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.validate_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetAuthCode = () => {
    if (authCodeUrl) {
      window.open(authCodeUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleValidate()
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
          <div className="flex items-center gap-2">
            <img src={kunqiongIcon} alt={t('auth.product_name')} className="w-6 h-6" />
            <h3 className="text-white text-sm font-medium">
              {t('auth.product_name')}·{t('auth.title')}
            </h3>
          </div>
          <div className="w-4 h-4" />
        </div>

        {/* 内容区 */}
        <div className="p-5 space-y-4">
          {/* 说明文本 */}
          <p className="text-gray-400 text-sm text-center">
            {t('auth.description')}
          </p>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-600/20 border border-red-600/50 rounded p-3">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* 授权码输入框 */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('auth.input_placeholder')}
              className="w-full bg-[#12121e] text-gray-300 text-sm rounded px-4 py-3 border border-[#2a3a50] outline-none focus:border-blue-500 transition-colors pr-10"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* 验证按钮 */}
          <button
            onClick={handleValidate}
            disabled={isLoading || !authCode.trim()}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-600 text-white text-sm font-medium rounded transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                <span>{t('auth.validating')}</span>
              </>
            ) : (
              <span>{t('auth.validate_button')}</span>
            )}
          </button>

          {/* 获取授权码链接 */}
          <div className="text-center">
            <button
              onClick={handleGetAuthCode}
              disabled={!authCodeUrl}
              className="text-blue-400 hover:text-blue-300 disabled:text-gray-500 text-sm transition-colors"
            >
              {t('auth.get_code')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
