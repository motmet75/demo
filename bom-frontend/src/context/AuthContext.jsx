import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchJson, rememberSessionExpiredReturnTo, resetSessionExpiredNotice, SESSION_EXPIRED_EVENT, setLiveUsername } from '../api/client'
import AuthContext from './AuthContextValue'
import { useAppContext } from './AppContext'

const LOGIN_PATH = '/bom-inventory/login?expired=1'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const userRef = useRef(null)
  const { restoreFromUser } = useAppContext()

  useEffect(() => {
    userRef.current = user
  }, [user])

  const handleSessionExpired = useCallback(() => {
    setUser(null)
    setLiveUsername(null)

    if (typeof window === 'undefined') return
    if (window.location.pathname.startsWith('/bom-inventory/login')) return

    rememberSessionExpiredReturnTo()
    window.alert('Your login session expired. Please sign in again.')
    window.location.assign(LOGIN_PATH)
  }, [])

  const refreshMe = useCallback(async (options = {}) => {
    const { promptExpired = false } = options
    const hadUser = !!userRef.current
    const { res, data } = await apiFetchJson('/auth/me', {
      credentials: 'include',
      skipSessionExpiredHandler: true
    })
    if (!res.ok || !data?.authenticated) {
      setUser(null)
      setLiveUsername(null)
      if (promptExpired && hadUser) {
        handleSessionExpired()
      }
      return null
    }
    const u = data.user || null
    setUser(u)
    setLiveUsername(u?.username ?? null)
    resetSessionExpiredNotice()
    restoreFromUser(u)
    return u
  }, [handleSessionExpired, restoreFromUser])

  // Run once on mount to restore session.
  useEffect(() => {
    refreshMe().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [handleSessionExpired])

  useEffect(() => {
    const verifyOpenSession = () => {
      if (document.visibilityState === 'visible' && userRef.current) {
        refreshMe({ promptExpired: true })
      }
    }
    window.addEventListener('focus', verifyOpenSession)
    document.addEventListener('visibilitychange', verifyOpenSession)
    return () => {
      window.removeEventListener('focus', verifyOpenSession)
      document.removeEventListener('visibilitychange', verifyOpenSession)
    }
  }, [refreshMe])

  const login = useCallback(async ({ username, password }) => {
    const { res, data } = await apiFetchJson('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (res.ok && data?.mfaRequired) {
      return {
        mfaRequired: true,
        maskedEmail: data.maskedEmail,
        expiresInSeconds: data.expiresInSeconds,
      }
    }
    if (!res.ok || !data?.authenticated) {
      throw new Error(data?.message || 'Login failed')
    }

    const u = data.user || null
    setUser(u)
    setLiveUsername(u?.username ?? null)
    resetSessionExpiredNotice()
    restoreFromUser(u)
    return { mfaRequired: false, user: u }
  }, [restoreFromUser])

  const verifyLoginOtp = useCallback(async (otp) => {
    const { res, data } = await apiFetchJson('/auth/login-otp/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    })
    if (!res.ok || !data?.authenticated) {
      throw new Error(data?.message || 'OTP verification failed')
    }
    const u = data.user || null
    setUser(u)
    setLiveUsername(u?.username ?? null)
    resetSessionExpiredNotice()
    restoreFromUser(u)
    return u
  }, [restoreFromUser])

  const resendLoginOtp = useCallback(async () => {
    const { res, data } = await apiFetchJson('/auth/login-otp/resend', {
      method: 'POST',
      credentials: 'include'
    })
    if (!res.ok) throw new Error(data?.message || 'Could not resend the verification code')
    return data
  }, [])

  const logout = useCallback(async () => {
    await apiFetchJson('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      skipSessionExpiredHandler: true
    })
    setUser(null)
    setLiveUsername(null)
    resetSessionExpiredNotice()
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login,
    verifyLoginOtp,
    resendLoginOtp,
    logout,
    refreshMe,
    isAdmin: !!user?.authorities?.includes('ROLE_ADMIN')
  }), [user, loading, login, verifyLoginOtp, resendLoginOtp, logout, refreshMe])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
