import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetchJson, rememberSessionExpiredReturnTo, resetSessionExpiredNotice, SESSION_EXPIRED_EVENT, setLiveUsername } from '../api/client'
import AuthContext from './AuthContextValue'
import { useAppContext } from './AppContext'

const LOGIN_PATH = '/bom-inventory/login?expired=1'
const AUTH_USER_CACHE_KEY = 'bom_authenticated_user_v1'

function readCachedUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(AUTH_USER_CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function cacheUser(user) {
  if (typeof window === 'undefined') return
  try {
    if (user) {
      window.sessionStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(user))
    } else {
      window.sessionStorage.removeItem(AUTH_USER_CACHE_KEY)
    }
  } catch {
    // Authentication still relies on the server cookie; caching is best-effort.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readCachedUser)
  const [loading, setLoading] = useState(true)
  const userRef = useRef(user)
  const { restoreFromUser } = useAppContext()

  useEffect(() => {
    userRef.current = user
  }, [user])

  const handleSessionExpired = useCallback(() => {
    setUser(null)
    cacheUser(null)
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
    try {
      const { res, data } = await apiFetchJson('/auth/me', {
        credentials: 'include',
        skipSessionExpiredHandler: true
      })

      // Only an authoritative authentication response may clear the client.
      // A proxy 5xx or a network error is expected while the main JAR restarts.
      const sessionRejected = res.status === 401 || (res.ok && data?.authenticated === false)
      if (sessionRejected) {
        setUser(null)
        cacheUser(null)
        setLiveUsername(null)
        if (promptExpired && hadUser) {
          handleSessionExpired()
        }
        return null
      }
      if (!res.ok || !data?.authenticated) {
        return userRef.current
      }

      const u = data.user || null
      setUser(u)
      cacheUser(u)
      setLiveUsername(u?.username ?? null)
      resetSessionExpiredNotice()
      restoreFromUser(u)
      return u
    } catch {
      // Preserve the last verified identity while the backend is unavailable.
      return userRef.current
    }
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
        mfaMethod: data.mfaMethod,
        maskedEmail: data.maskedEmail,
        expiresInSeconds: data.expiresInSeconds,
      }
    }
    if (!res.ok || !data?.authenticated) {
      throw new Error(data?.message || 'Login failed')
    }

    const u = data.user || null
    setUser(u)
    cacheUser(u)
    setLiveUsername(u?.username ?? null)
    resetSessionExpiredNotice()
    restoreFromUser(u)
    return { mfaRequired: false, user: u }
  }, [restoreFromUser])

  const verifyLoginTotp = useCallback(async (otp) => {
    const { res, data } = await apiFetchJson('/auth/login-totp/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp })
    })
    if (!res.ok) throw new Error(data?.message || 'Authenticator verification failed')
    if (data?.mfaRequired) {
      return {
        mfaRequired: true,
        mfaMethod: data.mfaMethod,
        maskedEmail: data.maskedEmail,
        expiresInSeconds: data.expiresInSeconds,
      }
    }
    if (!data?.authenticated) throw new Error(data?.message || 'Login failed')
    const u = data.user || null
    setUser(u)
    cacheUser(u)
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
    cacheUser(u)
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
    cacheUser(null)
    setLiveUsername(null)
    resetSessionExpiredNotice()
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login,
    verifyLoginTotp,
    verifyLoginOtp,
    resendLoginOtp,
    logout,
    refreshMe,
    isSuperAdmin: !!user?.authorities?.includes('ROLE_SUPER_ADMIN'),
    isAdmin: !!user?.authorities?.includes('ROLE_SUPER_ADMIN') || !!user?.authorities?.includes('ROLE_ADMIN'),
    hasFullBusinessAccess: ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'].some(role => user?.authorities?.includes(role)),
    hasShopOrderingAccess: ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER', 'ROLE_SHOP_ORDERING', 'ROLE_COUNTER'].some(role => user?.authorities?.includes(role)),
    hasCounterAccess: ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER', 'ROLE_COUNTER'].some(role => user?.authorities?.includes(role)),
    hasInventoryPriceAccess: ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'].some(role => user?.authorities?.includes(role))
  }), [user, loading, login, verifyLoginTotp, verifyLoginOtp, resendLoginOtp, logout, refreshMe])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
