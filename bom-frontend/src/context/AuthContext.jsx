import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetchJson, setLiveUsername } from '../api/client'
import AuthContext from './AuthContextValue'
import { useAppContext } from './AppContext'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const { restoreFromUser } = useAppContext()

  const refreshMe = useCallback(async () => {
    const { res, data } = await apiFetchJson('/auth/me', { credentials: 'include' })
    if (!res.ok || !data?.authenticated) {
      setUser(null)
      setLiveUsername(null)
      return null
    }
    const u = data.user || null
    setUser(u)
    setLiveUsername(u?.username ?? null)
    restoreFromUser(u)
    return u
  }, [restoreFromUser])

  // Run once on mount to restore session
  useEffect(() => {
    refreshMe().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(async ({ username, password }) => {
    const { res, data } = await apiFetchJson('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    if (!res.ok || !data?.authenticated) {
      throw new Error(data?.message || 'Login failed')
    }

    const u = data.user || null
    setUser(u)
    setLiveUsername(u?.username ?? null)
    restoreFromUser(u)
    return u
  }, [restoreFromUser])

  const logout = useCallback(async () => {
    await apiFetchJson('/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setLiveUsername(null)
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refreshMe,
    isAdmin: !!user?.authorities?.includes('ROLE_ADMIN')
  }), [user, loading, login, logout, refreshMe])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}