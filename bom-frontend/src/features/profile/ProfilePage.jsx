import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Avatar, Box, Button, Card, CardContent,
  Chip, CircularProgress, Divider, Paper, Snackbar, Typography
} from '@mui/material'
import StoreIcon from '@mui/icons-material/Store'
import QrCodeIcon from '@mui/icons-material/QrCode'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { apiFetchJson } from '../../api/client'
import { useAuth } from '../../context/useAuth'

export default function ProfilePage() {
  const { user, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [setupLoading, setSetupLoading] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const resetTimerRef = useRef(null)
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

  const handleResetClick = () => {
    if (!resetConfirm) {
      setResetConfirm(true)
      resetTimerRef.current = setTimeout(() => setResetConfirm(false), 4000)
      return
    }
    clearTimeout(resetTimerRef.current)
    setResetConfirm(false)
    handleResetConfirmed()
  }

  const handleResetConfirmed = async () => {
    setResetLoading(true)
    const { res, data } = await apiFetchJson('/auth/shop/reset', {
      method: 'POST',
      credentials: 'include',
    })
    setResetLoading(false)
    if (res.ok && data?.success) {
      setSnack({ open: true, message: data.message, severity: 'info' })
      loadProfile()
    } else {
      setSnack({ open: true, message: data?.message || 'Reset failed', severity: 'error' })
    }
  }

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
      loadProfile()
      setTimeout(() => navigate('/shop-orders'), 1200)
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
        One click to create tables, sample menu items (models), BOMs, and options — your shop is ready to take orders immediately.
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
              Creates 6 tables (Bàn 1–4, Quầy, Mang về) · 3 sample drinks with BOM & menu options — ready to order
            </Typography>
            <Button
              variant="contained"
              color="success"
              fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('MATCHA')}
              startIcon={setupLoading === 'MATCHA' ? <CircularProgress size={16} color="inherit" /> : <StoreIcon />}
            >
              {setupLoading === 'MATCHA' ? 'Setting up...' : 'Create Matcha Shop'}
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
              Creates 10 QR tables (QR-01–10) · 3 sample drinks with BOM & menu options — customers scan to order
            </Typography>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('QR')}
              startIcon={setupLoading === 'QR' ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
            >
              {setupLoading === 'QR' ? 'Setting up...' : 'Create QR Shop'}
            </Button>
          </CardContent>
        </Card>
      </Box>

      <Divider sx={{ mt: 4, mb: 3 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <WarningAmberIcon sx={{ color: 'error.main', fontSize: 20 }} />
        <Typography variant="subtitle2" color="error.main">Danger Zone</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reset clears all tables, orders, models, BOMs and menu options for this company. This cannot be undone.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        <Button
          variant="outlined"
          color="error"
          disabled={resetLoading || !!setupLoading}
          onClick={handleResetClick}
          startIcon={resetLoading
            ? <CircularProgress size={16} color="inherit" />
            : <DeleteForeverIcon />}
          sx={{ minWidth: 180 }}
        >
          {resetLoading ? 'Resetting...' : resetConfirm ? 'Confirm Reset?' : 'Reset Shop'}
        </Button>
        {resetConfirm && (
          <Button variant="text" size="small" onClick={() => { clearTimeout(resetTimerRef.current); setResetConfirm(false) }}>
            Cancel
          </Button>
        )}
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
