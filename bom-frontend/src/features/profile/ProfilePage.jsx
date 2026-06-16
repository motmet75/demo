import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Avatar, Box, Button, Card, CardContent,
  Chip, CircularProgress, Divider, Paper, Snackbar, Typography
} from '@mui/material'
import StoreIcon from '@mui/icons-material/Store'
import QrCodeIcon from '@mui/icons-material/QrCode'
import { apiFetchJson } from '../../api/client'
import { useAuth } from '../../context/useAuth'

export default function ProfilePage() {
  const { user, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [setupLoading, setSetupLoading] = useState('')
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    const { res, data } = await apiFetchJson('/auth/profile', { credentials: 'include' })
    if (res.ok) setProfile(data)
    setLoadingProfile(false)
  }, [])

  useEffect(() => {
    // After Google OAuth redirect, the session exists on the backend but
    // the React AuthContext may not have loaded it yet — refresh first.
    refreshMe().then(() => loadProfile())
  }, [refreshMe, loadProfile])

  const handleSetup = async (type) => {
    setSetupLoading(type)
    const { res, data } = await apiFetchJson('/auth/shop/setup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    })
    setSetupLoading('')
    if (res.ok && data?.success) {
      setSnack({ open: true, message: data.message, severity: 'success' })
      // Reload profile so tenant/company info is fresh
      loadProfile()
    } else {
      setSnack({ open: true, message: data?.message || 'Setup failed', severity: 'error' })
    }
  }

  if (loadingProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  const p = profile
  const displayName = [p?.user?.firstName, p?.user?.lastName].filter(Boolean).join(' ') || p?.user?.username || 'User'

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', mt: 4, px: 2 }}>
      {/* User card */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar
            src={p?.user?.avatar || undefined}
            sx={{ width: 64, height: 64, fontSize: 28, bgcolor: 'primary.main' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h6">{displayName}</Typography>
            <Typography variant="body2" color="text.secondary">{p?.user?.email}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {p?.tenant && (
            <Chip
              label={`Tenant: ${p.tenant.tenantName}`}
              color="primary"
              variant="outlined"
              size="small"
            />
          )}
          {p?.company && (
            <Chip
              label={`Company: ${p.company.companyName}`}
              color="secondary"
              variant="outlined"
              size="small"
            />
          )}
        </Box>
      </Paper>

      {/* Shop setup */}
      <Typography variant="h6" sx={{ mb: 2 }}>Set up your shop</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Choose a template to quickly create default tables for your shop. You can customise everything afterwards.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        {/* Matcha shop */}
        <Card
          variant="outlined"
          sx={{ cursor: 'pointer', transition: 'box-shadow .15s', '&:hover': { boxShadow: 4 } }}
        >
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <StoreIcon sx={{ fontSize: 48, color: '#388e3c', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              Matcha Shop
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              6 tables (Bàn 1–4, Quầy, Mang về) — perfect for a café or matcha tea shop
            </Typography>
            <Button
              variant="contained"
              color="success"
              fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('MATCHA')}
              startIcon={setupLoading === 'MATCHA' ? <CircularProgress size={16} color="inherit" /> : <StoreIcon />}
            >
              {setupLoading === 'MATCHA' ? 'Creating...' : 'Create Matcha Shop'}
            </Button>
          </CardContent>
        </Card>

        {/* QR shop */}
        <Card
          variant="outlined"
          sx={{ cursor: 'pointer', transition: 'box-shadow .15s', '&:hover': { boxShadow: 4 } }}
        >
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <QrCodeIcon sx={{ fontSize: 48, color: '#1565c0', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
              QR Shop
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              10 QR-numbered tables (QR-01 to QR-10) — customers scan to order
            </Typography>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('QR')}
              startIcon={setupLoading === 'QR' ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
            >
              {setupLoading === 'QR' ? 'Creating...' : 'Create QR Shop'}
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button variant="text" onClick={() => navigate('/')}>
          Go to Dashboard
        </Button>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
