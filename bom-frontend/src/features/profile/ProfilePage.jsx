import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert, Avatar, Box, Button, Card, CardContent,
  Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Paper, Snackbar, Switch, TextField, Typography
} from '@mui/material'
import StoreIcon from '@mui/icons-material/Store'
import QrCodeIcon from '@mui/icons-material/QrCode'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import EmailIcon from '@mui/icons-material/Email'
import RiceBowlIcon from '@mui/icons-material/RiceBowl'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import LockResetIcon from '@mui/icons-material/LockReset'
import { apiFetchJson } from '../../api/client'
import { useAuth } from '../../context/useAuth'
import { extendShopValidity } from '../../api/authApi'
import { useI18n } from '../../i18n/I18nContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeNotificationEmails(value) {
  const unique = new Map()
  let invalid = ''
  String(value || '').split(/[\s,;]+/).forEach(part => {
    const email = part.trim()
    if (!email) return
    if (!EMAIL_PATTERN.test(email)) {
      if (!invalid) invalid = email
      return
    }
    const key = email.toLowerCase()
    if (!unique.has(key)) unique.set(key, email)
  })
  return { emails: Array.from(unique.values()), invalid }
}

function ValidityCard({ company, user, isAdmin, onExtended }) {
  const [extendOpen, setExtendOpen]   = useState(false)
  const [days, setDays]               = useState('30')
  const [extending, setExtending]     = useState(false)
  const [extendError, setExtendError] = useState('')

  const hasExpiry = !!company.validUntil
  const validUntil = hasExpiry ? new Date(company.validUntil) : null
  const now = new Date()
  const daysLeft = validUntil ? Math.ceil((validUntil - now) / (1000 * 60 * 60 * 24)) : null
  const expired = daysLeft !== null && daysLeft <= 0

  const color = !hasExpiry ? 'primary' : expired ? 'error' : daysLeft <= 3 ? 'warning' : 'success'
  const bgColor = !hasExpiry ? '#e3f2fd' : expired ? '#fce4ec' : daysLeft <= 3 ? '#fff8e1' : '#e8f5e9'
  const textColor = !hasExpiry ? '#1565c0' : expired ? '#c62828' : daysLeft <= 3 ? '#e65100' : '#2e7d32'

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || ''
  const expiryStr = validUntil ? validUntil.toLocaleDateString('vi-VN') : 'N/A'
  const subject = encodeURIComponent(`[Shop Extension] Request for ${displayName} <${user?.email}>`)
  const body = encodeURIComponent(
    `Hello,\n\nI would like to request an extension for my shop account.\n\nAccount: ${user?.email}\nCompany: ${company.companyName}\nCurrent expiry: ${expiryStr}\n\nThank you.`
  )
  const mailtoHref = `mailto:services@anhmedia.vn?subject=${subject}&body=${body}`

  const statusText = !hasExpiry
    ? 'Trial — no expiry date set'
    : expired
      ? 'Trial expired'
      : `Trial active — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`

  const subText = !hasExpiry
    ? 'Contact us to set up your trial period'
    : expired
      ? `Expired on ${expiryStr}`
      : `Expires ${expiryStr}`

  const handleExtend = async () => {
    const d = parseInt(days, 10)
    if (!d || d < 1) { setExtendError('Enter a valid number of days'); return }
    setExtending(true); setExtendError('')
    const { res, data } = await extendShopValidity(company.id, d)
    setExtending(false)
    if (!res.ok) { setExtendError(data?.message || 'Failed to extend'); return }
    setExtendOpen(false)
    onExtended?.()
  }

  return (
    <>
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, bgcolor: bgColor, border: `1.5px solid ${textColor}33`, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <AccessTimeIcon sx={{ color: textColor, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ color: textColor }}>
              {statusText}
            </Typography>
            <Typography variant="caption" color="text.secondary">{subText}</Typography>
          </Box>
          {isAdmin ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => { setDays('30'); setExtendError(''); setExtendOpen(true) }}
              sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Extend Trial
            </Button>
          ) : (
            <Button
              component="a"
              href={mailtoHref}
              variant={expired || !hasExpiry ? 'contained' : 'outlined'}
              color={color}
              startIcon={<EmailIcon />}
              sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Request Extension
            </Button>
          )}
        </Box>
      </Paper>

      <Dialog open={extendOpen} onClose={() => !extending && setExtendOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Extend Trial — {company.companyName}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Current expiry: <strong>{expiryStr}</strong>. Enter how many days to add from today (or from current expiry if still valid).
          </Typography>
          <TextField
            label="Days to add"
            type="number"
            size="small"
            fullWidth
            value={days}
            onChange={e => setDays(e.target.value)}
            inputProps={{ min: 1 }}
            disabled={extending}
          />
          {extendError && <Alert severity="error" sx={{ mt: 1.5 }}>{extendError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExtendOpen(false)} disabled={extending}>Cancel</Button>
          <Button variant="contained" onClick={handleExtend} disabled={extending}
            startIcon={extending ? <CircularProgress size={16} color="inherit" /> : <AddCircleOutlineIcon />}
            sx={{ fontWeight: 700, minWidth: 140 }}>
            {extending ? 'Extending…' : `Add ${days || '?'} days`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default function ProfilePage() {
  const { user, refreshMe } = useAuth()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [setupLoading, setSetupLoading] = useState('')
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const resetTimerRef = useRef(null)
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' })
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [passwordOtpSent, setPasswordOtpSent] = useState(false)
  const [passwordOtpEmail, setPasswordOtpEmail] = useState('')
  const [passwordOtp, setPasswordOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [emailOpen, setEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [orderNotifyEnabled, setOrderNotifyEnabled] = useState(false)
  const [orderNotifyEmails, setOrderNotifyEmails] = useState('')
  const [orderNotifyBusy, setOrderNotifyBusy] = useState(false)
  const [orderNotifyError, setOrderNotifyError] = useState('')
  const [orderNotifyDirty, setOrderNotifyDirty] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true)
    const { res, data } = await apiFetchJson('/auth/profile', { credentials: 'include' })
    if (res.ok) {
      setProfile(data)
      setOrderNotifyEnabled(Boolean(data?.company?.newOrderNotificationEnabled))
      setOrderNotifyEmails(data?.company?.newOrderNotificationEmails || data?.company?.newOrderNotificationEmail || '')
      setOrderNotifyError('')
      setOrderNotifyDirty(false)
    }
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

  const closePasswordDialog = () => {
    if (passwordBusy) return
    setPasswordOpen(false)
    setPasswordOtpSent(false)
    setPasswordOtpEmail('')
    setPasswordOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
  }

  const requestPasswordOtp = async () => {
    setPasswordBusy(true)
    setPasswordError('')
    const { res, data } = await apiFetchJson('/auth/password-otp/request', {
      method: 'POST', credentials: 'include',
    })
    setPasswordBusy(false)
    if (!res.ok) {
      setPasswordError(res.status === 400 ? t('profile.password.noEmail') : res.status === 429 ? t('profile.password.wait') : t('profile.password.sendFailed'))
      return
    }
    setPasswordOtpSent(true)
    setPasswordOtpEmail(data?.email || profile?.user?.email || '')
  }

  const confirmPasswordChange = async () => {
    if (newPassword.length < 8) { setPasswordError(t('profile.password.minLength')); return }
    if (newPassword !== confirmPassword) { setPasswordError(t('profile.password.mismatch')); return }
    if (!/^\d{6}$/.test(passwordOtp.trim())) { setPasswordError(t('profile.password.otpRequired')); return }
    setPasswordBusy(true)
    setPasswordError('')
    const { res } = await apiFetchJson('/auth/password-otp/confirm', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: passwordOtp.trim(), newPassword, confirmPassword }),
    })
    setPasswordBusy(false)
    if (!res.ok) {
      setPasswordError(res.status === 429 ? t('profile.password.tooMany') : res.status === 400 ? t('profile.password.invalidOtp') : t('profile.password.changeFailed'))
      return
    }
    closePasswordDialog()
    setSnack({ open: true, message: t('profile.password.changed'), severity: 'success' })
  }

  const closeEmailDialog = () => {
    if (emailBusy) return
    setEmailOpen(false)
    setNewEmail('')
    setEmailPassword('')
    setEmailError('')
  }

  const openEmailDialog = () => {
    setNewEmail(profile?.user?.email || '')
    setEmailPassword('')
    setEmailError('')
    setEmailOpen(true)
  }

  const confirmEmailChange = async () => {
    const cleanEmail = newEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { setEmailError(t('profile.email.invalid')); return }
    if (!emailPassword) { setEmailError(t('profile.email.passwordRequired')); return }
    setEmailBusy(true)
    setEmailError('')
    const { res, data } = await apiFetchJson('/auth/profile/email', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: emailPassword }),
    })
    setEmailBusy(false)
    if (!res.ok) {
      setEmailError(res.status === 401 ? t('profile.email.passwordWrong')
        : res.status === 409 ? t('profile.email.exists')
          : data?.message || t('profile.email.changeFailed'))
      return
    }
    closeEmailDialog()
    setSnack({ open: true, message: t('profile.email.changed'), severity: 'success' })
    refreshMe().then(() => loadProfile())
  }

  const handleOrderNotifyToggle = (checked) => {
    setOrderNotifyEnabled(checked)
    if (checked && !orderNotifyEmails.trim() && p?.user?.email) {
      setOrderNotifyEmails(p.user.email)
    }
    setOrderNotifyError('')
    setOrderNotifyDirty(true)
  }

  const saveOrderNotification = async () => {
    const parsed = normalizeNotificationEmails(orderNotifyEmails)
    if (parsed.invalid) {
      setOrderNotifyError(t('profile.orderNotify.invalid', { email: parsed.invalid }))
      return
    }
    if (orderNotifyEnabled && parsed.emails.length === 0) {
      setOrderNotifyError(t('profile.orderNotify.required'))
      return
    }
    const normalizedEmails = parsed.emails.join('\n')
    setOrderNotifyBusy(true)
    setOrderNotifyError('')
    const { res, data } = await apiFetchJson('/auth/profile/order-notification', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: orderNotifyEnabled, emails: normalizedEmails }),
    })
    setOrderNotifyBusy(false)
    if (!res.ok || data?.success === false) {
      setOrderNotifyError(data?.message || t('profile.orderNotify.saveFailed'))
      return
    }
    const savedEmails = data?.newOrderNotificationEmails || normalizedEmails
    const savedEnabled = Boolean(data?.newOrderNotificationEnabled)
    setOrderNotifyEnabled(savedEnabled)
    setOrderNotifyEmails(savedEmails)
    setOrderNotifyDirty(false)
    setProfile(current => current ? ({
      ...current,
      company: current.company ? {
        ...current.company,
        newOrderNotificationEnabled: savedEnabled,
        newOrderNotificationEmails: savedEmails,
      } : current.company,
    }) : current)
    setSnack({ open: true, message: t('profile.orderNotify.saved'), severity: 'success' })
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

      <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <EmailIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('profile.email.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('profile.email.description', { email: p?.user?.email || t('profile.email.none') })}
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<EmailIcon />} onClick={openEmailDialog}>
            {p?.user?.email ? t('profile.email.action') : t('profile.email.linkAction')}
          </Button>
        </Box>
      </Paper>

      {p?.company && (
        <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <EmailIcon color={orderNotifyEnabled ? 'success' : 'primary'} sx={{ mt: 0.5 }} />
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="subtitle1" fontWeight={700}>{t('profile.orderNotify.title')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {t('profile.orderNotify.description')}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={orderNotifyEnabled}
                    onChange={e => handleOrderNotifyToggle(e.target.checked)}
                    disabled={orderNotifyBusy}
                    color="success"
                  />
                }
                label={t('profile.orderNotify.enabled')}
                sx={{ mb: 1 }}
              />
              <TextField
                label={t('profile.orderNotify.recipients')}
                value={orderNotifyEmails}
                onChange={e => {
                  setOrderNotifyEmails(e.target.value)
                  setOrderNotifyError('')
                  setOrderNotifyDirty(true)
                }}
                placeholder={p?.user?.email || 'owner@example.com'}
                helperText={t('profile.orderNotify.recipientsHelp')}
                disabled={orderNotifyBusy}
                multiline
                minRows={2}
                fullWidth
              />
              {orderNotifyError && <Alert severity="error" sx={{ mt: 1.5 }}>{orderNotifyError}</Alert>}
            </Box>
            <Button
              variant="contained"
              color="success"
              onClick={saveOrderNotification}
              disabled={orderNotifyBusy || !orderNotifyDirty}
              startIcon={orderNotifyBusy ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
              sx={{ alignSelf: 'flex-end', textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {t('common.save')}
            </Button>
          </Box>
        </Paper>
      )}

      <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <LockResetIcon color="primary" />
          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('profile.password.title')}</Typography>
            <Typography variant="body2" color="text.secondary">{t('profile.password.description')}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<LockResetIcon />} onClick={() => setPasswordOpen(true)}>
            {t('profile.password.action')}
          </Button>
        </Box>
      </Paper>

      <Dialog open={passwordOpen} onClose={closePasswordDialog} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{t('profile.password.dialogTitle')}</DialogTitle>
        <DialogContent>
          {!passwordOtpSent ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('profile.password.sendHelp', { email: p?.user?.email || '' })}
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 2, mt: 0.5 }}>
              <Alert severity="info">{t('profile.password.sentTo', { email: passwordOtpEmail })}</Alert>
              <TextField label={t('profile.password.otp')} value={passwordOtp}
                onChange={e => setPasswordOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }} autoFocus fullWidth />
              <TextField label={t('profile.password.new')} type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" fullWidth />
              <TextField label={t('profile.password.confirm')} type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" fullWidth />
              <Button size="small" onClick={requestPasswordOtp} disabled={passwordBusy} sx={{ justifySelf: 'start' }}>
                {t('profile.password.resend')}
              </Button>
            </Box>
          )}
          {passwordError && <Alert severity="error" sx={{ mt: 2 }}>{passwordError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closePasswordDialog} disabled={passwordBusy}>{t('common.cancel')}</Button>
          {!passwordOtpSent ? (
            <Button variant="contained" onClick={requestPasswordOtp} disabled={passwordBusy}
              startIcon={passwordBusy ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}>
              {t('profile.password.sendOtp')}
            </Button>
          ) : (
            <Button variant="contained" onClick={confirmPasswordChange} disabled={passwordBusy}
              startIcon={passwordBusy ? <CircularProgress size={16} color="inherit" /> : <LockResetIcon />}>
              {t('profile.password.update')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={emailOpen} onClose={closeEmailDialog} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{t('profile.email.dialogTitle')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gap: 2, mt: 0.5 }}>
            <Alert severity="info">{t('profile.email.help')}</Alert>
            <TextField label={t('profile.email.new')} type="email" value={newEmail}
              onChange={e => setNewEmail(e.target.value)} autoComplete="email" autoFocus fullWidth />
            <TextField label={t('profile.email.password')} type="password" value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)} autoComplete="current-password" fullWidth />
          </Box>
          {emailError && <Alert severity="error" sx={{ mt: 2 }}>{emailError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeEmailDialog} disabled={emailBusy}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={confirmEmailChange} disabled={emailBusy}
            startIcon={emailBusy ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}>
            {t('profile.email.update')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Validity card — always show when company exists */}
      {p?.company && (
        <ValidityCard
          company={p.company}
          user={p.user}
          isAdmin={user?.isAdmin || user?.role === 'ADMIN'}
          onExtended={loadProfile}
        />
      )}

      {/* Shop setup */}
      <Typography variant="h6" sx={{ mb: 2 }}>Set up your shop</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        One click to create tables, sample menu items (models), BOMs, and options — your shop is ready to take orders immediately.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 2 }}>
        {/* Matcha shop */}
        <Card variant="outlined" sx={{ transition: 'box-shadow .15s', '&:hover': { boxShadow: 4 } }}>
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <StoreIcon sx={{ fontSize: 44, color: '#388e3c', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Matcha Shop</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              6 bàn · Cà Phê Đen, Cà Phê Sữa, Trà Xanh · tùy chọn đường & đá
            </Typography>
            <Button
              variant="contained" color="success" fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('MATCHA')}
              startIcon={setupLoading === 'MATCHA' ? <CircularProgress size={16} color="inherit" /> : <StoreIcon />}
            >
              {setupLoading === 'MATCHA' ? 'Đang tạo...' : 'Tạo Matcha Shop'}
            </Button>
          </CardContent>
        </Card>

        {/* QR shop */}
        <Card variant="outlined" sx={{ transition: 'box-shadow .15s', '&:hover': { boxShadow: 4 } }}>
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <QrCodeIcon sx={{ fontSize: 44, color: '#1565c0', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>QR Shop</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              10 bàn QR-01–10 · khách quét để đặt hàng · thức uống mẫu
            </Typography>
            <Button
              variant="contained" color="primary" fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('QR')}
              startIcon={setupLoading === 'QR' ? <CircularProgress size={16} color="inherit" /> : <QrCodeIcon />}
            >
              {setupLoading === 'QR' ? 'Đang tạo...' : 'Tạo QR Shop'}
            </Button>
          </CardContent>
        </Card>

        {/* Quán cơm */}
        <Card variant="outlined" sx={{ transition: 'box-shadow .15s', '&:hover': { boxShadow: 4 } }}>
          <CardContent sx={{ textAlign: 'center', py: 3 }}>
            <RiceBowlIcon sx={{ fontSize: 44, color: '#e65100', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Quán Cơm</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              6 bàn · Cơm Tấm với topping sườn, bì, chả, trứng · thêm hành, ớt, tốp mỡ (miễn phí)
            </Typography>
            <Button
              variant="contained" fullWidth
              disabled={!!setupLoading}
              onClick={() => handleSetup('RICE')}
              startIcon={setupLoading === 'RICE' ? <CircularProgress size={16} color="inherit" /> : <RiceBowlIcon />}
              sx={{ bgcolor: '#e65100', '&:hover': { bgcolor: '#bf360c' } }}
            >
              {setupLoading === 'RICE' ? 'Đang tạo...' : 'Tạo Quán Cơm'}
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
        <Button variant="text" onClick={() => navigate('/shop-orders')}>
          Go to Shop Orders
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
