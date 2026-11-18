import React, { useState } from 'react'
import { Box, Button, Typography, Alert, Stack } from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { useAppContext } from '../../context/AppContext'
import { apiFetch } from '../../api/client'

const BASE = '/bom-inventory/'

function decodePublicKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, char => char.charCodeAt(0))
}

async function getResponseError(response) {
  const value = await response.text()
  try { return JSON.parse(value).message || JSON.parse(value).error || value } catch { return value || ('HTTP ' + response.status) }
}

/**
 * The enable button must be tapped from Safari's installed Home Screen PWA.
 * iOS requires Notification.requestPermission() to be called in a user gesture.
 */
export default function ShopPushSubscribeButton() {
  const { tenantId, companyId } = useAppContext()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [enabled, setEnabled] = useState(false)

  async function enable() {
    setMessage('')
    if (!tenantId || !companyId) return setMessage('Chọn tenant và công ty trước.')
    if (!window.isSecureContext || !('serviceWorker' in navigator) ||
        !('PushManager' in window) || !('Notification' in window)) {
      return setMessage('Trình duyệt này chưa hỗ trợ Web Push hoặc trang chưa có HTTPS.')
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      return setMessage('Trong Safari, chọn Chia sẻ → Thêm vào Màn hình chính; mở AnhMedia từ biểu tượng mới.')
    }
    setBusy(true)
    try {
      // Call immediately from the user's tap, before awaiting network operations.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Bạn chưa cho phép thông báo trong cài đặt iPhone.')
      const res = await apiFetch('/shop/staff/push/public-key', { credentials: 'include' })
      if (!res.ok) throw new Error(await getResponseError(res))
      const { publicKey } = await res.json()
      const registration = await navigator.serviceWorker.register(
        BASE + 'anhmedia-push-sw.js', { scope: BASE })
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: decodePublicKey(publicKey)
      })
      const saved = await apiFetch('/shop/staff/push/subscriptions', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON())
      })
      if (!saved.ok) throw new Error(await getResponseError(saved))
      setEnabled(true)
      setMessage('Đã đăng ký nhận thông báo cho cửa hàng này trên iPhone.')
    } catch (error) {
      setMessage(error?.message || 'Không thể đăng ký thông báo.')
    } finally { setBusy(false) }
  }

  async function test() {
    setBusy(true)
    try {
      const response = await apiFetch('/shop/staff/push/test', {
        method: 'POST', credentials: 'include'
      })
      if (!response.ok) throw new Error(await getResponseError(response))
      setMessage('Đã xếp hàng thông báo thử. Kiểm tra iPhone.')
    } catch (error) { setMessage(error?.message || 'Gửi thử thất bại.') }
    finally { setBusy(false) }
  }

  return <Box sx={{ p: 1, border: '1px solid #e0e7ff', borderRadius: 2, mb: 1, bgcolor: '#eef2ff' }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
      <NotificationsActiveIcon color="primary" />
      <Box sx={{ flex: 1 }}>
        <Typography fontWeight={800} fontSize={14}>Thông báo đơn hàng trên iPhone</Typography>
        <Typography fontSize={12} color="text.secondary">
          Cài AnhMedia lên Màn hình chính, đăng nhập, chọn cửa hàng và nhấn Bật.
        </Typography>
      </Box>
      <Button size="small" variant="contained" disabled={busy || !companyId} onClick={enable}>
        {enabled ? 'Bật lại' : 'Bật thông báo'}
      </Button>
      {enabled && <Button size="small" variant="outlined" disabled={busy} onClick={test}>Gửi thử</Button>}
    </Stack>
    {!!message && <Alert severity={enabled ? 'info' : 'warning'} sx={{ mt: 1 }}>{message}</Alert>}
  </Box>
}
