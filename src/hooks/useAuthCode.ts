import { useState, useCallback, useEffect } from 'react'
import { checkNeedAuthCode, validateAuthCode, authCodeStorage } from '../services/authCode'

export function useAuthCode() {
  const [showAuthCodeModal, setShowAuthCodeModal] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // 应用启动时检查授权状态
  useEffect(() => {
    const checkAuthStatus = async () => {
      const savedAuthCode = authCodeStorage.getAuthCode()
      if (savedAuthCode) {
        // 有本地授权码，验证是否有效
        const isValid = await validateAuthCode(savedAuthCode)
        setIsAuthorized(isValid)
        if (!isValid) {
          // 授权码无效，清除本地存储
          authCodeStorage.clear()
        }
      }
    }
    checkAuthStatus()
  }, [])

  // 检查是否需要授权码，如果需要则显示弹窗
  const checkAndShowAuthCode = useCallback(
    async (softNumber: string = '10003'): Promise<boolean> => {
      console.log('checkAndShowAuthCode called')
      setIsChecking(true)

      try {
        // 先检查本地是否已有有效的授权码
        const savedAuthCode = authCodeStorage.getAuthCode()
        console.log('savedAuthCode:', savedAuthCode)
        if (savedAuthCode) {
          // 验证本地授权码是否有效
          console.log('Validating saved auth code...')
          const isValid = await validateAuthCode(savedAuthCode, softNumber)
          console.log('Saved auth code valid:', isValid)
          if (isValid) {
            setIsAuthorized(true)
            setIsChecking(false)
            return true
          } else {
            // 授权码无效，清除本地存储
            authCodeStorage.clear()
            setIsAuthorized(false)
          }
        }

        // 检查是否需要授权码
        console.log('Checking if auth code is needed...')
        const { isNeed } = await checkNeedAuthCode(softNumber)
        console.log('isNeed:', isNeed)

        if (isNeed) {
          // 需要授权码，显示弹窗
          console.log('Showing auth code modal')
          setShowAuthCodeModal(true)
          setIsChecking(false)
          return false
        }

        // 不需要授权码，直接返回成功
        console.log('Auth code not needed, returning true')
        setIsAuthorized(true)
        setIsChecking(false)
        return true
      } catch (error) {
        console.error('Failed to check auth code:', error)
        setIsAuthorized(false)
        setShowAuthCodeModal(true)
        setIsChecking(false)
        return false
      }
    },
    []
  )

  // 处理授权码验证成功
  const handleAuthCodeSuccess = useCallback((authCode: string) => {
    authCodeStorage.setAuthCode(authCode)
    setIsAuthorized(true)
    setShowAuthCodeModal(false)
  }, [])

  // 清除授权状态
  const clearAuthCode = useCallback(() => {
    authCodeStorage.clear()
    setIsAuthorized(false)
  }, [])

  const handleAuthError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      if (error.message === 'AUTH_CODE_EXPIRED' || error.message === 'AUTH_CODE_CHECK_FAILED') {
        authCodeStorage.clear()
        setIsAuthorized(false)
        setShowAuthCodeModal(true)
      }
    }
  }, [])

  return {
    showAuthCodeModal,
    setShowAuthCodeModal,
    isChecking,
    isAuthorized,
    checkAndShowAuthCode,
    handleAuthCodeSuccess,
    clearAuthCode,
    handleAuthError,
  }
}
