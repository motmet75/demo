import React, { createContext, useContext, useEffect, useState } from 'react'

// LocalStorage key versioned so future schema changes are easier
const STORAGE_KEY = 'bom_app_context_v1'

const defaultState = {
  tenantId: null,
  companyId: null,
}

const AppContext = createContext({
  ...defaultState,
  setTenantId: () => {},
  setCompanyId: () => {},
  reset: () => {},
})

export function AppProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaultState
      const parsed = JSON.parse(raw)
      // Ensure all expected keys exist
      return {
        tenantId: parsed.tenantId ?? null,
        companyId: parsed.companyId ?? null,
      }
    } catch (e) {
      // If parsing fails, start fresh
      return defaultState
    }
  })

  // Persist to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      // ignore localStorage errors (e.g., quota)
      // optionally you could surface errors to a monitoring service
    }
  }, [state])

  // When tenant changes, clear company
  const setTenantId = (tenantId) => {
    // If tenantId actually changed, clear dependent fields
    setState((s) => {
      if (s.tenantId === tenantId) return { ...s }
      return { ...s, tenantId: tenantId ?? null, companyId: null }
    })
  }

  // When company changes
  const setCompanyId = (companyId) => {
    setState((s) => {
      if (s.companyId === companyId) return { ...s }
      return { ...s, companyId: companyId ?? null }
    })
  }

  const reset = () => setState(defaultState)

  return (
    <AppContext.Provider
      value={{
        tenantId: state.tenantId,
        companyId: state.companyId,
        setTenantId,
        setCompanyId,
        reset,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within an AppProvider')
  return ctx
}

export default AppContext