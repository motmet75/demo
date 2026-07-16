import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Divider, Paper, TextField, Typography } from '@mui/material'
import { consumeSessionExpiredReturnTo } from '../api/client'
import { useAuth } from '../context/useAuth'

const APP_BASE = '/bom-inventory'

function locationPath(value) {
  if (!value?.pathname) return ''
  return `${value.pathname}${value.search || ''}${value.hash || ''}`
}

function normalizeAppPath(value) {
  if (typeof value !== 'string') return ''
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) return ''
  return path
}

function fullAppUrl(path) {
  const route = normalizeAppPath(path) || '/materials'
  return `${APP_BASE}${route === '/' ? '/' : route}`
}

export default function LoginForm() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sessionExpired = new URLSearchParams(location.search).get('expired') === '1'
  const from = normalizeAppPath(locationPath(location.state?.from)) || '/materials'

  // Show oauth2 error if redirected back from Google with ?error=oauth2
  useEffect(() => {
    if (new URLSearchParams(location.search).get('error') === 'oauth2') {
      setError('Google login failed. Please try again.')
    }
  }, [location.search])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await login({ username, password })
      const savedReturnTo = sessionExpired ? consumeSessionExpiredReturnTo() : ''
      const destination = normalizeAppPath(savedReturnTo) || from
      if (sessionExpired) {
        window.location.assign(fullAppUrl(destination))
        return
      }
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // Full-page redirect through the Vite proxy to Spring Security's OAuth2 auth endpoint
    window.location.href = '/sapi/oauth2/authorization/google'
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Sign in</Typography>

        {sessionExpired ? <Alert severity="warning" sx={{ mb: 2 }}>Your login session expired. Sign in again to reload the page you were using.</Alert> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

        {/* Google login */}
        <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleLogin}
          sx={{ mb: 2, py: 1.2, gap: 1.5, borderColor: '#dadce0', color: '#3c4043', fontWeight: 500 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </Button>

        <Divider sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">or sign in with username</Typography>
        </Divider>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}