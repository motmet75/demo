import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Fab, Tooltip } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import { useAuth } from '../context/useAuth'

import { lastStaffView } from './lastView'

/**
 * Floating Home button for full-screen staff screens that have no header or
 * sidebar (counter display, display boards). In the home-screen (standalone)
 * app there is no browser back button, so without it these screens are a dead end.
 * Only shown to logged-in staff; customer pages stay clean.
 */
export default function StaffHomeButton() {
  const { user } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const goHome = () => {
    // Opened as a separate window by the app: close it and return to the opener.
    try {
      if (window.opener && !window.opener.closed && window.opener.location.origin === window.location.origin) {
        window.opener.focus()
        window.close()
      }
    } catch { /* cross-origin or blocked opener */ }
    // Still here (window.close is ignored for normal tabs): go to the last staff screen.
    window.setTimeout(() => { if (!window.closed) navigate(lastStaffView()) }, 150)
  }

  return <Tooltip title="Về màn hình chính">
    <Fab size="small" color="primary" aria-label="Về màn hình chính" onClick={goHome} sx={{
      position: 'fixed', zIndex: 2000,
      left: 'calc(12px + env(safe-area-inset-left, 0px))',
      bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      opacity: 0.55, '&:hover, &:focus-visible, &:active': { opacity: 1 },
    }}>
      <HomeIcon />
    </Fab>
  </Tooltip>
}
