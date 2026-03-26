import React from 'react'
import { Alert, Box } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import AdminUserGrid from './AdminUserGrid'

export default function AdminPage() {
  const { user } = useAuth()

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Signed in as <strong>{user?.username}</strong>. Only users with <strong>ROLE_ADMIN</strong> can access this page.
      </Alert>
      <AdminUserGrid />
    </Box>
  )
}