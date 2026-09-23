import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { CircularProgress, Box } from '@mui/material'
import { useAuth } from '../context/useAuth'

function defaultPathForUser(user) {
  const roles = user?.authorities || []
  if (['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_USER'].some(role => roles.includes(role))) return '/materials'
  if (roles.includes('ROLE_COUNTER')) return '/counter-shift'
  if (roles.includes('ROLE_SHOP_ORDERING')) return '/shop-orders'
  return '/materials'
}

export default function RequireAuth({ children, adminOnly = false, roles = null }) {
  const { user, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  const allowedRoles = roles || (adminOnly ? ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN'] : null)
  if (adminOnly && !isAdmin) {
    return <Navigate to={defaultPathForUser(user)} replace />
  }

  if (allowedRoles && !allowedRoles.some(role => user?.authorities?.includes(role))) {
    return <Navigate to={defaultPathForUser(user)} replace />
  }

  return <>{children}</>
}
