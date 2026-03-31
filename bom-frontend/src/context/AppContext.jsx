import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { apiFetch, setLiveContext } from '../api/client'

// LocalStorage key versioned so future schema changes are easier
const STORAGE_KEY = 'bom_app_context_v1'

const defaultState = {
  tenantId: null,
  companyId: null,
  companyName: null,
}

const AppContext = createContext({
  ...defaultState,
  setTenantId: () => {},
  setCompanyId: () => {},
  setCompanyWithName: () => {},
  reset: () => {},
  restoreFromUser: () => {},
})

export function AppProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaultState
      const parsed = JSON.parse(raw)
      return {
        tenantId: parsed.tenantId ?? null,
        companyId: parsed.companyId ?? null,
        companyName: parsed.companyName ?? null,
      }
    } catch {
      return defaultState
    }
  })

  // Keep the in-memory live context (used by apiFetch) in sync with React state
  useEffect(() => {
    setLiveContext(state.tenantId, state.companyId)
  }, [state.tenantId, state.companyId])

  // Track whether we should persist to server (skip initial mount)
  const initialised = useRef(false)

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore localStorage errors
    }
  }, [state])

  // Persist to server whenever state changes (after first render)
  useEffect(() => {
    if (!initialised.current) {
      initialised.current = true
      return
    }
    // Fire-and-forget: save last context to backend for this user
    apiFetch('/auth/last-context', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: state.tenantId ?? '',
        companyId: state.companyId ?? '',
      }),
    }).catch(() => {/* ignore – user may not be logged in yet */})
  }, [state.tenantId, state.companyId])

  // When tenant changes, clear company and companyName
  const setTenantId = (tenantId) => {
    setState((s) => {
      if (s.tenantId === tenantId) return { ...s }
      return { ...s, tenantId: tenantId ?? null, companyId: null, companyName: null }
    })
  }

  // When company changes (id only, clears name)
  const setCompanyId = (companyId) => {
    setState((s) => {
      if (s.companyId === companyId) return { ...s }
      return { ...s, companyId: companyId ?? null, companyName: null }
    })
  }

  // When company changes with known name
  const setCompanyWithName = (companyId, companyName) => {
    setState((s) => {
      if (s.companyId === companyId && s.companyName === companyName) return s
      return { ...s, companyId: companyId ?? null, companyName: companyName ?? null }
    })
  }

  const reset = () => setState(defaultState)

  // Called by AuthContext after login/me to restore last-used tenant+company
  const restoreFromUser = (user) => {
    if (!user) return
    const isAdmin = Array.isArray(user.authorities) && user.authorities.includes('ROLE_ADMIN')

    setState((s) => {
      // Non-admin: lock tenantId to assignedTenantId, but allow free company selection
      if (!isAdmin) {
        const forcedTenant = user.assignedTenantId ?? null
        // Restore lastCompanyId if tenant hasn't changed, otherwise reset
        const restoredCompany = forcedTenant === s.tenantId
          ? (user.lastCompanyId ?? s.companyId)
          : (user.lastCompanyId ?? null)
        if (forcedTenant === s.tenantId && restoredCompany === s.companyId) return s
        return { tenantId: forcedTenant, companyId: restoredCompany }
      }

      // Admin: restore last-used context as before
      const newTenantId = user.lastTenantId ?? s.tenantId
      const newCompanyId = user.lastTenantId === s.tenantId
        ? (user.lastCompanyId ?? s.companyId)
        : user.lastCompanyId ?? null
      if (newTenantId === s.tenantId && newCompanyId === s.companyId) return s
      return { tenantId: newTenantId, companyId: newCompanyId }
    })
  }

  return (
    <AppContext.Provider
      value={{
        tenantId: state.tenantId,
        companyId: state.companyId,
        companyName: state.companyName,
        setTenantId,
        setCompanyId,
        setCompanyWithName,
        reset,
        restoreFromUser,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within an AppProvider')
  return ctx
}

export default AppContext