import React, { createContext, useContext, useEffect, useReducer } from 'react'
import { getTenants } from '../api/tenantApi'
import { useAuth } from './useAuth'

const TenantListContext = createContext({ tenants: [], loading: false, error: null, reload: () => {} })

function reducer(state, action) {
  switch (action.type) {
    case 'START': return { ...state, loading: true, error: null }
    case 'OK':    return { tenants: action.data, loading: false, error: null }
    case 'ERR':   return { ...state, loading: false, error: action.error }
    default:      return state
  }
}

export function TenantListProvider({ children }) {
  const { user, loading: authLoading } = useAuth()
  const isAdmin = !!user?.authorities?.includes('ROLE_ADMIN')
  const [state, dispatch] = useReducer(reducer, { tenants: [], loading: false, error: null })

  const fetchTenants = async (mounted) => {
    dispatch({ type: 'START' })
    try {
      const data = await getTenants()
      if (mounted.current) dispatch({ type: 'OK', data: Array.isArray(data) ? data : (data?.data ?? []) })
    } catch (e) {
      if (mounted.current) dispatch({ type: 'ERR', error: e.message || String(e) })
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user || !isAdmin) return

    const mounted = { current: true }
    fetchTenants(mounted)
    return () => { mounted.current = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  const reload = () => {
    const mounted = { current: true }
    fetchTenants(mounted)
  }

  return (
    <TenantListContext.Provider value={{ ...state, reload }}>
      {children}
    </TenantListContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTenantList() {
  return useContext(TenantListContext)
}
