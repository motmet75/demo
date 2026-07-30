import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import { consumeSessionExpiredReturnTo } from '../api/client'
import { useAuth } from '../context/useAuth'
import { useI18n } from '../i18n/I18nContext'
import {
  getCurrentTimeZone,
  setCurrentTimeZone,
  SUPPORTED_LANGUAGES,
} from '../i18n/translations'
import { LanguageFlag } from './LanguageSelector'

const APP_BASE = '/bom-inventory'
const LOGIN_LANGUAGE_CODES = ['vi', 'cn', 'tw', 'en']
const SHOP_TIME_ZONES = [
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/London',
  'America/Los_Angeles',
  'America/New_York',
  'UTC',
]

function timeZoneLabel(timeZone) {
  try {
    const offsetName = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value
    return `${timeZone} (${offsetName || 'GMT'})`
  } catch {
    return timeZone
  }
}

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
  const { login, verifyLoginTotp, verifyLoginOtp, resendLoginOtp } = useAuth()
  const { language, setLanguage, t, tx } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [timeZone, setTimeZone] = useState(() => getCurrentTimeZone())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState({ key: '', message: '' })
  const [mfaMethod, setMfaMethod] = useState('')
  const [otp, setOtp] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')

  const sessionExpired = new URLSearchParams(location.search).get('expired') === '1'
  const from = normalizeAppPath(locationPath(location.state?.from)) || '/materials'
  const loginLanguages = useMemo(() => LOGIN_LANGUAGE_CODES
    .map((code) => SUPPORTED_LANGUAGES.find((item) => item.code === code))
    .filter(Boolean), [])

  useEffect(() => {
    if (new URLSearchParams(location.search).get('error') === 'oauth2') {
      setError({ key: 'common.googleLoginFailed', message: '' })
    }
  }, [location.search])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return
    setError({ key: '', message: '' })
    setLoading(true)
    try {
      const result = await login({ username, password })
      if (result?.mfaRequired) {
        setMfaMethod(result.mfaMethod || 'email')
        setMaskedEmail(result.maskedEmail || '')
        setPassword('')
        return
      }
      finishLogin()
    } catch (err) {
      setError({ key: '', message: err?.message || 'Login failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleTotpSubmit = async (event) => {
    event.preventDefault()
    if (loading) return
    setError({ key: '', message: '' })
    setLoading(true)
    try {
      const result = await verifyLoginTotp(otp)
      if (result?.mfaRequired) {
        setMfaMethod(result.mfaMethod || 'email')
        setMaskedEmail(result.maskedEmail || '')
        setOtp('')
        return
      }
      finishLogin()
    } catch (err) {
      setError({ key: '', message: err?.message || 'Authenticator verification failed' })
    } finally {
      setLoading(false)
    }
  }

  const finishLogin = () => {
    const savedReturnTo = sessionExpired ? consumeSessionExpiredReturnTo() : ''
    const destination = normalizeAppPath(savedReturnTo) || from
    if (sessionExpired) {
      window.location.assign(fullAppUrl(destination))
      return
    }
    navigate(destination, { replace: true })
  }

  const handleOtpSubmit = async (event) => {
    event.preventDefault()
    if (loading) return
    setError({ key: '', message: '' })
    setLoading(true)
    try {
      await verifyLoginOtp(otp)
      finishLogin()
    } catch (err) {
      setError({ key: '', message: err?.message || 'OTP verification failed' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (loading) return
    setError({ key: '', message: '' })
    setLoading(true)
    try {
      const result = await resendLoginOtp()
      setMaskedEmail(result?.maskedEmail || maskedEmail)
      setOtp('')
    } catch (err) {
      setError({ key: '', message: err?.message || 'Could not resend the verification code' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    // Full-page redirect through the Vite proxy to Spring Security's OAuth2 auth endpoint.
    window.location.href = '/sapi/oauth2/authorization/google'
  }

  const errorText = error.key ? t(error.key) : error.message ? tx(error.message) : ''

  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: { xs: 'calc(100vh - 43px)', sm: 'calc(100vh - 54px)' }, px: 2, py: 5, bgcolor: '#f6f8fb' }}>
      <Paper elevation={2} sx={{ p: { xs: 2.5, sm: 4 }, width: '100%', maxWidth: 460, borderRadius: 1 }}>
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{t('login.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('login.subtitle')}</Typography>
        </Box>

        <Box role="group" aria-label={t('language.label')} sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1, mb: 2.5 }}>
          {loginLanguages.map((item) => {
            const selected = language === item.code
            return (
              <Button
                key={item.code}
                variant={selected ? 'contained' : 'outlined'}
                color={selected ? 'primary' : 'inherit'}
                onClick={() => setLanguage(item.code)}
                startIcon={<LanguageFlag code={item.code} label={item.label} />}
                sx={{
                  minHeight: 40,
                  justifyContent: 'flex-start',
                  borderRadius: 1,
                  textTransform: 'none',
                  fontWeight: selected ? 700 : 500,
                  px: 1,
                  '& .MuiButton-startIcon': { ml: 0, mr: 0.75 },
                  '& .MuiButton-startIcon > *:nth-of-type(1)': { fontSize: 'inherit' },
                }}
              >
                <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.nativeLabel}
                </Box>
              </Button>
            )
          })}
        </Box>

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>{t('login.timeZone')}</InputLabel>
          <Select
            value={timeZone}
            label={t('login.timeZone')}
            onChange={(event) => {
              const nextTimeZone = setCurrentTimeZone(event.target.value)
              setTimeZone(nextTimeZone)
            }}
          >
            {Array.from(new Set([timeZone, ...SHOP_TIME_ZONES])).map((zone) => (
              <MenuItem key={zone} value={zone}>{timeZoneLabel(zone)}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          {t('login.timeZoneHelp')}
        </Typography>

        {sessionExpired ? <Alert severity="warning" sx={{ mb: 2 }}>{t('common.sessionExpired')}</Alert> : null}
        {errorText ? <Alert severity="error" sx={{ mb: 2 }}>{errorText}</Alert> : null}

        {!mfaMethod ? <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleLogin}
          sx={{ mb: 2, py: 1.2, gap: 1.5, borderColor: '#dadce0', color: '#3c4043', fontWeight: 500, textTransform: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {t('common.continueWithGoogle')}
        </Button> : null}

        {!mfaMethod ? <Divider sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">{t('common.orSignInUsername')}</Typography>
        </Divider> : null}

        {!mfaMethod ? <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2 }}>
          <TextField label={t('common.username')} value={username} onChange={(e) => setUsername(e.target.value)} required disabled={loading} />
          <TextField label={t('common.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
          <Button type="submit" variant="contained" disabled={loading} sx={{ py: 1.1, textTransform: 'none' }}>
            {loading ? t('common.signingIn') : t('common.login')}
          </Button>
        </Box> : mfaMethod === 'authenticator' ? (
          <Box component="form" onSubmit={handleTotpSubmit} sx={{ display: 'grid', gap: 2 }}>
            <Alert severity="info">
              Two-factor authentication is enabled. Enter the current 6-digit code from your authenticator app.
            </Alert>
            <TextField
              label="Authenticator code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}' }}
              required
              autoFocus
              disabled={loading}
            />
            <Button type="submit" variant="contained" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying…' : 'Verify authenticator'}
            </Button>
            <Button type="button" color="inherit" onClick={() => {
              setMfaMethod('')
              setOtp('')
              setError({ key: '', message: '' })
            }} disabled={loading}>Back to sign in</Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleOtpSubmit} sx={{ display: 'grid', gap: 2 }}>
            <Alert severity="info">
              This is a new or unrecognized device. Enter the 6-digit code sent to {maskedEmail || 'your email'}.
              This device will be trusted for 30 days.
            </Alert>
            <TextField
              label="Verification code"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}' }}
              required
              autoFocus
              disabled={loading}
            />
            <Button type="submit" variant="contained" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying…' : 'Verify and sign in'}
            </Button>
            <Button type="button" onClick={handleResendOtp} disabled={loading}>Resend code</Button>
            <Button type="button" color="inherit" onClick={() => {
              setMfaMethod('')
              setOtp('')
              setError({ key: '', message: '' })
            }} disabled={loading}>Back to sign in</Button>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
