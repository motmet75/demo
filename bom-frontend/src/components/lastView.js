import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const LAST_VIEW_KEY = 'bom.lastView'

/** Remembers the last staff screen inside the main layout (inventory, shop orders, ...). */
export function useRememberLastView() {
  const location = useLocation()
  useEffect(() => {
    const path = location.pathname
    if (path === '/' || path === '/login') return
    try { localStorage.setItem(LAST_VIEW_KEY, path + location.search) } catch { /* storage unavailable */ }
  }, [location.pathname, location.search])
}

export function lastStaffView() {
  try { return localStorage.getItem(LAST_VIEW_KEY) || '/' } catch { return '/' }
}
