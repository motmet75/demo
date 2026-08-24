import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Collapse from '@mui/material/Collapse'
import PrintIcon from '@mui/icons-material/Print'
import EditIcon from '@mui/icons-material/Edit'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import DownloadIcon from '@mui/icons-material/Download'
import ShareIcon from '@mui/icons-material/Share'
import PhoneIcon from '@mui/icons-material/Phone'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { resolveToken, fetchShopConfig, fetchPublicOrder, fetchTokenSession, fetchCounterOrderQr, fetchPublicTables, fetchPublicMenuOptions, changePublicOrderTable, cancelCustomerEdit, switchPublicOrderToBankPayment } from '../../api/shopApi'
import { printOrderReceipt } from '../../utils/printOrderReceipt'
import { useI18n } from '../../i18n/I18nContext'
import { ORDERING_LANGUAGE_CODES } from '../../i18n/translations'
import { localizedLabel, localizedModelName, localizedSelectedOptions, localizedTableName } from '../../i18n/menuLocalization'
import { shopCustomerText, shopStatusText } from '../../i18n/shopCustomerText'
import LanguageSelector from '../../components/LanguageSelector'
import { saveQrImage } from '../../utils/saveQrImage'
import { useAuth } from '../../context/useAuth'
import { useAppContext } from '../../context/AppContext'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))

const textValue = (value) => String(value ?? '').trim()

function shopContactFromConfig(config) {
  return {
    name: textValue(config?.shopName || config?.companyName || config?.name),
    phone: textValue(config?.shopPhone || config?.companyPhoneNumber || config?.phoneNumber || config?.phone),
    address: textValue(config?.shopAddress || config?.companyAddress || config?.address),
  }
}

function phoneHref(phone) {
  const normalized = textValue(phone).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
  return `tel:${normalized || textValue(phone)}`
}

function ShopContactCard({ shopConfig }) {
  const { t } = useI18n()
  const contact = shopContactFromConfig(shopConfig)
  if (!contact.name && !contact.phone && !contact.address) return null
  return (
    <Box sx={{
      mx: { xs: 1.5, md: 'auto' },
      mt: 2,
      px: 2,
      py: 1.5,
      maxWidth: 560,
      width: { md: '100%' },
      border: '1px solid #dbeafe',
      borderRadius: 2,
      bgcolor: '#f8fbff',
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
    }}>
      {(contact.name || contact.phone) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center', justifyContent: 'space-between' }}>
          {contact.name && (
            <Typography fontWeight={900} sx={{ color: '#0f172a', fontSize: { xs: 16, md: 17 }, minWidth: 0, flex: '1 1 180px', overflowWrap: 'anywhere' }}>
              {contact.name}
            </Typography>
          )}
          {contact.phone && (
            <Button
              component="a"
              href={phoneHref(contact.phone)}
              variant="contained"
              size="small"
              startIcon={<PhoneIcon />}
              sx={{ borderRadius: 1.5, fontWeight: 800, textTransform: 'none', flexShrink: 0, maxWidth: '100%', whiteSpace: 'normal', textAlign: 'center' }}>
              {contact.phone}
            </Button>
          )}
        </Box>
      )}
      {contact.address && (
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.35 }}>
          <Box component="span" fontWeight={800}>{t('common.address')}: </Box>{contact.address}
        </Typography>
      )}
    </Box>
  )
}

function loadShopConfigForScope(tenantId, companyId, keyRef, setShopConfig) {
  if (!tenantId || !companyId) return
  const key = `${tenantId}:${companyId}`
  if (keyRef.current === key) return
  keyRef.current = key
  fetchShopConfig(tenantId, companyId)
    .then(({ data }) => setShopConfig(data || null))
    .catch(() => { keyRef.current = '' })
}

function CustomerNotificationsButton() {
  const { language } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')
  if (!supported) return <Alert severity="info">{ct('tracking.notificationsOpenPage')}</Alert>
  if (permission === 'granted') return <Chip label={ct('tracking.notificationsEnabled')} color="success" />
  return (
    <Button variant="outlined" onClick={() => Notification.requestPermission().then(setPermission)} sx={{ textTransform: 'none' }}>
      {ct('tracking.enableNotifications')}
    </Button>
  )
}

function ShareTrackingButton({ orderNumber, fullWidth = true }) {
  const { language } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = languageAwareCurrentUrl(language)
    const title = orderNumber ? `${ct('tracking.order')} #${orderNumber}` : 'SAN Coffee and Tea'
    const text = `${ct('tracking.share')}: ${title}`
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch (error) {
      if (error?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(url); setCopied(true) } catch { /* clipboard unavailable */ }
      }
    }
  }
  return (
    <Button variant="outlined" fullWidth={fullWidth} startIcon={<ShareIcon />} onClick={share}
      sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
      {copied ? ct('tracking.copied') : ct('tracking.share')}
    </Button>
  )
}

function languageAwareCurrentUrl(language) {
  try {
    const url = new URL(window.location.href)
    if (language) url.searchParams.set('lang', language)
    return url.toString()
  } catch {
    return window.location.href
  }
}

function SwitchToBankPaymentButton({ order }) {
  const { language } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const finalStatus = ['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)
  if (order.paymentMethod !== 'CASH' || order.paymentStatus === 'PAID' || finalStatus) return null

  const switchPayment = async () => {
    setSaving(true); setError('')
    try {
      const { res, data } = await switchPublicOrderToBankPayment(order.orderCode)
      if (!res.ok) {
        setError(data?.error || ct('tracking.cannotSwitchPayment'))
        return
      }
      window.location.reload()
    } catch {
      setError(ct('common.networkError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ mt: 1.5 }}>
      <Button variant="contained" color="success" fullWidth startIcon={<QrCode2Icon />}
        disabled={saving} onClick={switchPayment}
        sx={{ borderRadius: 2, fontWeight: 900, textTransform: 'none', py: 1.15 }}>
        {saving ? <CircularProgress size={20} color="inherit" /> : ct('tracking.switchBank')}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  )
}

function notifyCustomer(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body }) } catch { /* notification unsupported by this browser */ }
  }
}

const STEPS = [
  { key: 'PENDING',   label: 'Đã đặt',    emoji: '📋' },
  { key: 'CONFIRMED', label: 'Đã xác nhận', emoji: '✅' },
  { key: 'PREPARING', label: 'Đang chuẩn bị', emoji: '👨‍🍳' },
  { key: 'READY',     label: 'Sẵn sàng',     emoji: '🔔' },
  { key: 'COMPLETED', label: 'Hoàn tất',      emoji: '🎉' },
]

const STATUS_IDX = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, PICKED_UP: 4, COMPLETED: 4 }

const STATUS_STYLE = {
  PENDING:   { color: '#78909c', bg: '#f5f5f5', label: 'Đang chờ xác nhận' },
  CONFIRMED: { color: '#43a047', bg: '#f1f8e9', label: 'Đơn đã được xác nhận!' },
  PREPARING: { color: '#fb8c00', bg: '#fff8e1', label: 'Đang chuẩn bị món…' },
  READY:     { color: '#0288d1', bg: '#e1f5fe', label: '🔔 Món đã sẵn sàng!' },
  PICKED_UP: { color: '#1b5e20', bg: '#e8f5e9', label: '✓ Đã nhận món — chúc ngon miệng!' },
  COMPLETED: { color: '#2e7d32', bg: '#e8f5e9', label: 'Hoàn tất — cảm ơn quý khách!' },
  CANCELLED: { color: '#e53935', bg: '#fce4ec', label: 'Đơn đã hủy' },
}

const STATUS_CHIP = {
  PENDING:   { color: 'default',  label: 'Chờ xác nhận' },
  CONFIRMED: { color: 'success',  label: 'Đã xác nhận' },
  PREPARING: { color: 'warning',  label: 'Đang chuẩn bị' },
  READY:     { color: 'info',     label: 'Sẵn sàng!' },
  PICKED_UP: { color: 'success',  label: 'Đã nhận món' },
  COMPLETED: { color: 'success',  label: 'Hoàn tất' },
  CANCELLED: { color: 'error',    label: 'Đã hủy' },
}

const STATUS_TRANSLATION_KEYS = {
  PENDING: 'shopOrder.status.pending',
  CONFIRMED: 'shopOrder.status.confirmed',
  PREPARING: 'shopOrder.status.preparing',
  READY: 'shopOrder.status.ready',
  PICKED_UP: 'shopOrder.status.pickedUp',
  COMPLETED: 'shopOrder.status.completed',
  CANCELLED: 'shopOrder.status.cancelled',
}

function orderStatusLabel(order, language, t) {
  const status = order?.status || 'PENDING'
  return localizedLabel(order?.statusLabels, language, shopStatusText(language, status) || t(STATUS_TRANSLATION_KEYS[status] || status))
}

function CounterQrButton({ orders, label }) {
  const { language } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const [open, setOpen] = useState(false)
  const [slides, setSlides] = useState([])
  const [loading, setLoading] = useState(false)

  const show = async () => {
    setOpen(true); setLoading(true)
    const loaded = await Promise.all((orders || []).map(async order => {
      try {
        const { data } = await fetchCounterOrderQr(order.orderCode)
        return { order, qrBase64: data?.qrBase64 || '' }
      } catch { return { order, qrBase64: '' } }
    }))
    setSlides(loaded); setLoading(false)
  }

  return <>
    <Button variant="contained" size="small" startIcon={<QrCode2Icon />} onClick={show}
      sx={{ textTransform: 'none', fontWeight: 800 }}>{label || ct('tracking.showCounterQr')}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle>{ct('tracking.counterQrTitle')} {slides.length > 1 ? ct('tracking.counterQrCount', { count: slides.length }) : ''}</DialogTitle>
      <DialogContent sx={{ px: 0 }}>
        {loading ? <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box> : (
          <Box sx={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', gap: 1, px: 2, pb: 2 }}>
            {slides.map(({ order, qrBase64 }, index) => (
              <Box key={order.orderCode} sx={{ minWidth: '100%', scrollSnapAlign: 'center', textAlign: 'center' }}>
                <Typography variant="h3" fontWeight={900}>#{order.orderNumber ?? order.dailySeq ?? index + 1}</Typography>
                {qrBase64 && <img src={`data:image/png;base64,${qrBase64}`} alt={`Order ${order.orderCode} QR`}
                  style={{ width: 'min(78vw, 320px)', height: 'min(78vw, 320px)' }} />}
                <Typography fontWeight={800}>{ct('tracking.counterQrInstruction')}</Typography>
                {slides.length > 1 && <Typography variant="body2" color="text.secondary">{ct('tracking.counterQrSwipe', { current: index + 1, total: slides.length })}</Typography>}
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  </>
}

function StepDot({ step, activeIdx, idx, label }) {
  const done   = idx < activeIdx
  const active = idx === activeIdx
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: done ? '#a5d6a7' : active ? '#0288d1' : '#eeeeee',
        border: active ? '2px solid #0277bd' : '2px solid transparent',
        fontSize: active ? 16 : 13,
        transition: 'all 0.3s',
      }}>
        {done
          ? <Typography sx={{ color: '#2e7d32', fontWeight: 900, fontSize: 15, lineHeight: 1 }}>✓</Typography>
          : <Typography sx={{ lineHeight: 1 }}>{step.emoji}</Typography>}
      </Box>
      <Typography variant="caption" sx={{
        fontWeight: active ? 700 : 400,
        color: active ? '#0277bd' : done ? '#43a047' : '#bdbdbd',
        fontSize: 10, textAlign: 'center', lineHeight: 1.2,
      }}>
        {label || step.label}
      </Typography>
    </Box>
  )
}

// ── Single order full view (no token) ────────────────────────────────────────

function OrderItems({ order, itemName, fmtLocal, optionText }) {
  const roots = (order.items || []).filter(item => !item.parentItemId)
  const children = (order.items || []).filter(item => item.parentItemId)

  if (roots.length === 0) return null

  return (
    <Box sx={{ px: { xs: 1.5, md: 4 }, pt: 2, maxWidth: 560, mx: 'auto', width: '100%' }}>
      {roots.map((item, index) => (
        <Box key={item.id} sx={{ mb: 1, p: 1.25, border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography fontWeight={800} sx={{ flex: 1 }}>
              {index + 1}. {item.quantity}x {itemName(item)}
            </Typography>
            <Typography color="primary" fontWeight={800}>{fmtLocal(item.lineTotal)}</Typography>
          </Box>
          {item.selectedOptions && (
            <Typography variant="body2" color="text.secondary">{optionText ? optionText(item) : item.selectedOptions}</Typography>
          )}
          {children.filter(child => child.parentItemId === item.id).map(child => (
            <Box key={child.id} sx={{ display: 'flex', gap: 1, pl: 2, mt: 0.5 }}>
              <Typography variant="body2" sx={{ flex: 1 }}>
                + {child.quantity}x {itemName(child)}
              </Typography>
              <Typography variant="body2" color="primary" fontWeight={700}>{fmtLocal(child.lineTotal)}</Typography>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

function SingleOrderView({ order, shopConfig, onEdit, onOrderMore, itemName, fmtLocal, optionText }) {
  const [paymentQrOpen, setPaymentQrOpen] = useState(false)
  const { language, t } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const status    = order.status || 'PENDING'
  const cancelled = status === 'CANCELLED'
  const isDone    = status === 'COMPLETED' || status === 'PICKED_UP'
  const activeIdx = cancelled ? -1 : (STATUS_IDX[status] ?? 0)
  const style     = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  const statusLabel = orderStatusLabel(order, language, t)
  const isQrUrl    = order.paymentQr?.startsWith('https://')
  const bankCode   = isQrUrl ? order.paymentQr.split('/image/')[1]?.split('-')[0] : null
  const bankLogoUrl = bankCode ? `https://img.vietqr.io/img/${bankCode}.png` : null
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const heroNum = order.orderNumber ? `#${order.orderNumber}` : order.dailySeq ? `#${order.dailySeq}` : '—'

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ bgcolor: style.bg, textAlign: 'center', px: 2, pt: { xs: 5, md: 6 }, pb: { xs: 3, md: 4 }, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
          <LanguageSelector compact languageCodes={ORDERING_LANGUAGE_CODES} />
        </Box>
        <Typography sx={{ fontSize: { xs: 80, md: 110 }, fontWeight: 900, lineHeight: 1, color: style.color, letterSpacing: 0 }}>
          {heroNum}
        </Typography>
        <Typography sx={{ fontSize: 12, color: style.color, opacity: 0.55, mt: 0.75 }}>
          {order.orderNumber ? `${ct('tracking.order')} #${order.orderNumber}` : ''}{order.orderCode ? ` · ${order.orderCode}` : ''}
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1.5, px: 2.5, py: 0.75, bgcolor: '#fff', borderRadius: 99, border: `1.5px solid ${style.color}22` }}>
          {status === 'PREPARING' && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.color, flexShrink: 0, animation: 'blink 1.4s infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
          )}
          <Typography fontWeight={700} sx={{ color: style.color, fontSize: { xs: 15, md: 17 } }}>{statusLabel}</Typography>
        </Box>
      </Box>

      {!cancelled && (
        <Box sx={{ bgcolor: '#fff', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', px: { xs: 1.5, md: 4 }, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', maxWidth: 560, mx: 'auto' }}>
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.key}>
                <StepDot step={step} activeIdx={activeIdx} idx={idx} label={shopStatusText(language, step.key) || t(STATUS_TRANSLATION_KEYS[step.key] || step.label)} />
                {idx < STEPS.length - 1 && (
                  <Box sx={{ height: 2, flex: 1, mt: '13px', mb: 'auto', bgcolor: idx < activeIdx ? '#a5d6a7' : '#eeeeee', borderRadius: 2 }} />
                )}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}

      <ShopContactCard shopConfig={shopConfig} />

      {order.paymentRequestedAt && order.paymentStatus !== 'PAID' && (
        <Alert severity="warning" sx={{ mx: 'auto', mt: 2, width: 'calc(100% - 32px)', maxWidth: 560, fontWeight: 800 }}>
          {ct('tracking.payAtCounter')}
        </Alert>
      )}

      {order.paymentQr && order.paymentStatus !== 'PAID' && (
        <Box sx={{ px: 2, pt: 2, maxWidth: 560, width: '100%', mx: 'auto' }}>
          <Button variant="contained" fullWidth startIcon={<QrCode2Icon />}
            onClick={() => setPaymentQrOpen(open => !open)}
            sx={{ borderRadius: 2, fontWeight: 900, textTransform: 'none', py: 1.25 }}>
            {paymentQrOpen ? ct('tracking.hidePaymentQr') : ct('tracking.showPaymentQr')}
          </Button>
        <Collapse in={paymentQrOpen}>
        <Box sx={{ textAlign: 'center', pt: 2, pb: 1 }}>
          {bankLogoUrl && <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}><img src={bankLogoUrl} alt="Bank" style={{ height: 40, maxWidth: 140, objectFit: 'contain', borderRadius: 6 }} /></Box>}
          <Typography variant="subtitle2" fontWeight={700} color="#0277bd" sx={{ mb: 1.5 }}>{ct('tracking.scanToPay')}</Typography>
          <img src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`} alt="Payment QR"
            style={{ width: 200, height: 200, display: 'block', margin: '0 auto', borderRadius: 8 }} />
          <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1.25 }}>{fmtLocal(payableAmount(order))}</Typography>
          <Typography variant="caption" color="text.secondary">ref: {order.orderCode}</Typography>
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => saveQrImage(order.paymentQr, order.orderCode)}
            sx={{ display: 'flex', mx: 'auto', mt: 1.25, textTransform: 'none', fontWeight: 700 }}>
            {ct('tracking.saveQr')}
          </Button>
        </Box>
        </Collapse>
        </Box>
      )}

      {order.notes && (
        <Box sx={{ mx: { xs: 1.5, md: 4 }, mt: 2, p: 1.5, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid #f0f0f0' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>{ct('tracking.note')}</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>{order.notes}</Typography>
        </Box>
      )}

      <OrderItems order={order} itemName={itemName} fmtLocal={fmtLocal} optionText={optionText} />

      <Box sx={{ mx: { xs: 1.5, md: 'auto' }, mt: 1, px: 2, py: 1.5, maxWidth: 560, width: { md: '100%' },
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 2 }}>
        <Typography fontWeight={900} sx={{ fontSize: { xs: 17, md: 18 }, color: '#7c2d12' }}>{ct('common.total')}</Typography>
        <Typography fontWeight={900} color="primary" sx={{ fontSize: { xs: 20, md: 22 }, lineHeight: 1.1 }}>
          {fmtLocal(payableAmount(order))}
        </Typography>
      </Box>

      <Box sx={{ px: 2, maxWidth: 560, width: '100%', mx: 'auto' }}>
        <SwitchToBankPaymentButton order={order} />
        <FinishEditingButton order={order} onFinished={() => window.location.reload()} />
        <CustomerTableChanger order={order} token={order.sourceToken || null} onChanged={() => window.location.reload()} />
      </Box>

      {isDone && (
        <Box sx={{ textAlign: 'center', pt: 3 }}>
          <Typography variant="h4">🎉</Typography>
          <Typography fontWeight={700} color="#2e7d32">{ct('tracking.thankYou')}</Typography>
          <Typography variant="body2" color="text.secondary">{ct('tracking.seeYou')}</Typography>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />
      <Box sx={{ px: 2, pb: 2, pt: 1, display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 480, mx: 'auto', width: '100%' }}>
        <Button variant="contained" fullWidth startIcon={<AddShoppingCartIcon />}
          onClick={() => onOrderMore?.(order)}
          sx={{ borderRadius: 2, fontWeight: 900, textTransform: 'none', py: 1.15 }}>
          {ct('tracking.addMore')}
        </Button>
        <CustomerNotificationsButton />
        <ShareTrackingButton orderNumber={order.orderNumber || order.dailySeq} />
        {order.status === 'PENDING' && (
          <Button variant="outlined" fullWidth startIcon={<EditIcon />}
            onClick={() => onEdit(order)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            {ct('tracking.editOrder')}
          </Button>
        )}
        <Box sx={{ textAlign: 'center' }}>
          <Button size="small" startIcon={<PrintIcon />} onClick={() => printOrderReceipt(order)}
            sx={{ textTransform: 'none', color: 'text.disabled', fontSize: 12 }}>
            {ct('tracking.printInvoice')}
          </Button>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
            {order.orderCode} · {ct('tracking.updateEvery')}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ── Session order card ────────────────────────────────────────────────────────

function menuUrl(qs) {
  const appBase = window.location.pathname.split('/shop/')[0]
  return window.location.origin + appBase + '/shop/menu?' + new URLSearchParams(qs)
}

function CustomerTableChanger({ order, token, onChanged }) {
  const { language } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState(order.tableId || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!order.tenantId || !order.companyId) return
    fetchPublicTables(order.tenantId, order.companyId)
      .then(({ data }) => setTables(Array.isArray(data) ? data : []))
      .catch(() => setTables([]))
  }, [order.tenantId, order.companyId])

  const save = async () => {
    if (!tableId || tableId === order.tableId) return
    setSaving(true); setMessage('')
    try {
      const { res, data } = await changePublicOrderTable(order.orderCode, tableId, token)
      if (!res.ok) setMessage(data?.error || ct('tracking.cannotChangeTable'))
      else { setMessage(ct('tracking.tableChanged')); onChanged?.(data) }
    } catch { setMessage(ct('common.networkError')) }
    setSaving(false)
  }

  if (!tables.length || ['CANCELLED', 'COMPLETED'].includes(order.status)) return null
  return (
    <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 0.75 }}>{ct('tracking.changeTable')}</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box component="select" value={tableId} onChange={e => setTableId(e.target.value)}
          sx={{ flex: 1, minHeight: 42, borderRadius: 1, border: '1px solid #93c5fd', px: 1, bgcolor: '#fff' }}>
          <option value="">{ct('tracking.chooseTable')}</option>
          {tables.map(table => <option key={table.id} value={table.id}>{localizedTableName(table, language)}</option>)}
        </Box>
        <Button variant="contained" onClick={save} disabled={saving || !tableId || tableId === order.tableId}>{ct('common.save')}</Button>
      </Box>
      {message && <Typography variant="caption" color={message === ct('tracking.tableChanged') ? 'success.main' : 'error'}>{message}</Typography>}
    </Box>
  )
}

function FinishEditingButton({ order, onFinished }) {
  const { language } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  if (!order.customerEditing) return null
  const finish = async () => {
    setSaving(true); setError('')
    try {
      const { res, data } = await cancelCustomerEdit(order.orderCode)
      if (!res.ok) setError(data?.error || data?.message || ct('tracking.cannotFinishEdit'))
      else onFinished?.(data)
    } catch { setError(ct('common.networkError')) }
    setSaving(false)
  }
  return (
    <Box sx={{ mt: 1.5 }}>
      <Button variant="contained" color="warning" fullWidth onClick={finish} disabled={saving}
        sx={{ fontWeight: 800, textTransform: 'none' }}>
        {saving ? <CircularProgress size={19} color="inherit" /> : ct('tracking.finishEdit')}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
    </Box>
  )
}

function OrderCard({ order, highlighted, token, itemName, fmtLocal, optionText }) {
  const [expanded, setExpanded] = useState(highlighted)
  const [paymentQrOpen, setPaymentQrOpen] = useState(false)
  const { language, t } = useI18n()
  const ct = (key, vars) => shopCustomerText(language, key, vars)
  const status   = order.status || 'PENDING'
  const chip     = STATUS_CHIP[status] || STATUS_CHIP.PENDING
  const style    = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  const statusLabel = orderStatusLabel(order, language, t)
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const isPending = status === 'PENDING'
  const isQrUrl   = order.paymentQr?.startsWith('https://')

  const goEdit = () => {
    window.location.href = menuUrl({ t: token, editOrder: order.orderCode, lang: language })
  }

  // Group items: roots + children
  const roots    = (order.items || []).filter(i => !i.parentItemId)
  const children = (order.items || []).filter(i => i.parentItemId)

  return (
    <Box sx={{
      border: highlighted ? '2px solid #0288d1' : '1px solid #e2e8f0',
      borderRadius: 2,
      overflow: 'hidden',
      bgcolor: '#fff',
      boxShadow: highlighted ? '0 2px 12px #0288d120' : '0 1px 4px #0001',
    }}>
      {/* Header row */}
      <Box
        onClick={() => setExpanded(e => !e)}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer', userSelect: 'none',
          bgcolor: highlighted ? '#e1f5fe' : '#fafafa' }}>
        <Typography fontWeight={900} sx={{ fontSize: 22, color: style.color, minWidth: 40 }}>
          {displayNum}
        </Typography>
        <Box sx={{ flex: 1 }}>
          {(order.customerName || order.customerPhone) && (
            <Typography fontWeight={800} sx={{ fontSize: 13, mb: 0.4 }}>
              {order.customerName || ct('tracking.customer')}{order.customerPhone ? ` · ***${String(order.customerPhone).replace(/\D/g, '').slice(-3)}` : ''}
            </Typography>
          )}
          <Chip label={statusLabel} color={chip.color} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
          {status === 'PREPARING' && (
            <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              bgcolor: style.color, ml: 1, mb: '1px',
              animation: 'blink2 1.4s infinite', '@keyframes blink2': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
          )}
        </Box>
        <Typography fontWeight={900} color="primary" sx={{ fontSize: { xs: 19, sm: 20 }, lineHeight: 1.1 }}>
          {fmtLocal(payableAmount(order))}
        </Typography>
        <Box sx={{ color: '#94a3b8' }}>{expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}</Box>
        <Button size="small" variant="outlined" onClick={event => { event.stopPropagation(); setExpanded(true) }}>{ct('tracking.viewOrder')}</Button>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          {/* Step bar (compact) */}
          {order.paymentRequestedAt && order.paymentStatus !== 'PAID' && (
            <Alert severity="warning" sx={{ mb: 1.5, fontWeight: 800 }}>{ct('tracking.payAtCounterShort')}</Alert>
          )}
          {status !== 'CANCELLED' && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
              {STEPS.map((step, idx) => {
                const activeIdx = STATUS_IDX[status] ?? 0
                return (
                  <React.Fragment key={step.key}>
                    <StepDot step={step} activeIdx={activeIdx} idx={idx} label={shopStatusText(language, step.key) || t(STATUS_TRANSLATION_KEYS[step.key] || step.label)} />
                    {idx < STEPS.length - 1 && (
                      <Box sx={{ height: 2, flex: 1, mt: '13px', bgcolor: idx < activeIdx ? '#a5d6a7' : '#eeeeee', borderRadius: 2 }} />
                    )}
                  </React.Fragment>
                )
              })}
            </Box>
          )}

          {/* Items */}
          {roots.map((item, i) => {
            const itemChildren = children.filter(c => c.parentItemId === item.id)
            const itemImage = item.imageUrl || item.thumbnailUrl || ''
            return (
              <Box key={item.id} sx={{ mb: 1.25, p: 1, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#ffffff' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 64, height: 64, flexShrink: 0, borderRadius: 1.5, bgcolor: '#eef2f7', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {itemImage ? (
                      <Box component="img" src={itemImage} alt={itemName(item)}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: 24 }}>{String(itemName(item) || '?').slice(0, 1)}</Typography>
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={900} sx={{ fontSize: 18, lineHeight: 1.2, color: '#0f172a' }}>
                      {i + 1}. {item.quantity}x {itemName(item)}
                    </Typography>
                    {item.selectedOptions && (
                      <Typography sx={{ color: '#64748b', fontSize: 14, lineHeight: 1.25 }}>{optionText ? optionText(item) : item.selectedOptions}</Typography>
                    )}
                  </Box>
                  <Typography color="primary" fontWeight={900} sx={{ fontSize: 17, flexShrink: 0 }}>{fmtLocal(item.lineTotal)}</Typography>
                </Box>
                {itemChildren.map((child, ci) => {
                  const childImage = child.imageUrl || child.thumbnailUrl || ''
                  return (
                    <Box key={child.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 2, mt: 0.75 }}>
                      <Box sx={{ width: 42, height: 42, flexShrink: 0, borderRadius: 1.25, bgcolor: '#e8eaf6', overflow: 'hidden', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {childImage ? (
                          <Box component="img" src={childImage} alt={itemName(child)}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { e.target.style.display = 'none' }} />
                        ) : (
                          <Typography fontWeight={900} sx={{ color: '#818cf8', fontSize: 16 }}>{String(itemName(child) || '?').slice(0, 1)}</Typography>
                        )}
                      </Box>
                      <Typography sx={{ color: '#4338ca', fontWeight: 800, fontSize: 15, flex: 1, minWidth: 0 }} noWrap>
                        {i + 1}.{ci + 1} {child.quantity}x {itemName(child)}
                      </Typography>
                      <Typography color="primary" fontWeight={900} sx={{ fontSize: 15, flexShrink: 0 }}>{fmtLocal(child.lineTotal)}</Typography>
                    </Box>
                  )
                })}
              </Box>
            )
          })}

          <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '2px solid #fed7aa', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography fontWeight={900} sx={{ fontSize: 17, color: '#7c2d12' }}>{ct('common.total')}</Typography>
            <Typography color="primary" fontWeight={900} sx={{ fontSize: { xs: 20, sm: 22 }, lineHeight: 1.1 }}>
              {fmtLocal(payableAmount(order))}
            </Typography>
          </Box>

          {/* Payment QR if READY */}
          {order.paymentQr && order.paymentStatus !== 'PAID' && (
            <Box sx={{ textAlign: 'center', mt: 1.5, pb: 0.5 }}>
              <Button variant="contained" fullWidth startIcon={<QrCode2Icon />}
                onClick={() => setPaymentQrOpen(open => !open)}
                sx={{ mb: paymentQrOpen ? 1.5 : 0, borderRadius: 2, fontWeight: 900, textTransform: 'none' }}>
                {paymentQrOpen ? ct('tracking.hidePaymentQr') : ct('tracking.showPaymentQr')}
              </Button>
              <Collapse in={paymentQrOpen}>
              <Typography variant="caption" fontWeight={700} color="#0277bd" sx={{ display: 'block', mb: 1 }}>{ct('tracking.scanToPay')}</Typography>
              <img src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`}
                alt="Payment QR" style={{ width: 160, height: 160, borderRadius: 8 }} />
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
                onClick={() => saveQrImage(order.paymentQr, order.orderCode)}
                sx={{ display: 'flex', mx: 'auto', mt: 1, textTransform: 'none', fontWeight: 700 }}>
                {ct('tracking.saveQr')}
              </Button>
              </Collapse>
            </Box>
          )}

          {order.notes && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontStyle: 'italic' }}>
              {ct('tracking.note')}: {order.notes}
            </Typography>
          )}
          <SwitchToBankPaymentButton order={order} />
          <FinishEditingButton order={order} onFinished={() => window.location.reload()} />
          <CustomerTableChanger order={order} token={token} onChanged={() => window.location.reload()} />
        </Box>

        {isPending && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1.25, display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                onClick={goEdit}
                sx={{ fontWeight: 700, textTransform: 'none', flex: 1, borderRadius: 1.5 }}>
                {ct('tracking.editThisOrder')}
              </Button>
              <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 14 }} />}
                onClick={() => printOrderReceipt(order)}
                sx={{ textTransform: 'none', color: 'text.secondary' }}>
                {ct('tracking.printOrder')}
              </Button>
            </Box>
          </>
        )}
        {!isPending && (
          <Box sx={{ px: 2, pb: 1, pt: 0.5 }}>
            <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 14 }} />}
              onClick={() => printOrderReceipt(order)}
              sx={{ textTransform: 'none', color: 'text.secondary' }}>
              {ct('tracking.printInvoice')}
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  )
}

// ── Token session view (all orders for a token) ───────────────────────────────

function groupOptionsByModel(rows) {
  const byModel = {}
  ;(Array.isArray(rows) ? rows : []).forEach(opt => {
    if (!opt?.modelId) return
    if (!byModel[opt.modelId]) byModel[opt.modelId] = []
    byModel[opt.modelId].push(opt)
  })
  return byModel
}

function TokenSessionView({ token, highlightCode, itemName, fmtLocal }) {
  const [session, setSession] = useState(null)
  const [error, setError]     = useState('')
  const [shopConfig, setShopConfig] = useState(null)
  const [optionsByModel, setOptionsByModel] = useState({})
  const previousRef = useRef({})
  const shopConfigKeyRef = useRef('')
  const { language, t } = useI18n()
  const ct = useCallback((key, vars) => shopCustomerText(language, key, vars), [language])
  const optionText = useCallback((item) => localizedSelectedOptions(item.modelId, item.selectedOptions, optionsByModel, language), [language, optionsByModel])

  useEffect(() => {
    let cancelled = false
    resolveToken(token)
      .then(({ data }) => {
        if (cancelled) return
        loadShopConfigForScope(data?.tenantId, data?.companyId, shopConfigKeyRef, setShopConfig)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token])

  const load = useCallback(() => {
    fetchTokenSession(token)
      .then(({ data }) => {
        if (data?.orders == null) { setError(ct('tracking.sessionNotFound')); return }
        const previous = previousRef.current
        ;(data.orders || []).forEach(order => {
          const old = previous[order.id]
          if (old && old.status !== order.status) notifyCustomer(`${ct('tracking.order')} #${order.orderNumber || order.orderCode}`, orderStatusLabel(order, language, t))
          if (old && !old.paymentRequestedAt && order.paymentRequestedAt && order.paymentStatus !== 'PAID') notifyCustomer(ct('tracking.paymentNotificationTitle'), ct('tracking.paymentNotificationBody'))
        })
        const firstOrder = (data.orders || [])[0]
        if (firstOrder?.tenantId && firstOrder?.companyId && Object.keys(optionsByModel).length === 0) {
          fetchPublicMenuOptions(firstOrder.tenantId, firstOrder.companyId)
            .then(({ data: rows }) => setOptionsByModel(groupOptionsByModel(rows)))
            .catch(() => {})
        }
        loadShopConfigForScope(data.tenantId || firstOrder?.tenantId, data.companyId || firstOrder?.companyId, shopConfigKeyRef, setShopConfig)
        previousRef.current = Object.fromEntries((data.orders || []).map(order => [order.id, order]))
        setSession(data)
      })
      .catch(() => setError(ct('tracking.cannotLoadSession')))
  }, [ct, language, optionsByModel, t, token])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  if (!session && !error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>

  const now         = Date.now()
  const expiresAt   = session.expiresAt ? new Date(session.expiresAt) : null
  const msLeft      = expiresAt ? expiresAt - now : null
  const isValid     = session.valid
  const hasOrders   = session.orders && session.orders.length > 0
  const hasPending  = session.orders?.some(o => o.status === 'PENDING')

  const formatExpiry = () => {
    if (!expiresAt) return null
    if (!isValid) return ct('tracking.sessionExpired')
    const mins = Math.floor(msLeft / 60000)
    if (mins < 60) return ct('tracking.expiresMinutes', { minutes: mins })
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    const minuteText = rem > 0
      ? `${rem} ${language === 'cn' || language === 'tw' ? '分钟' : language === 'vi' ? 'phút' : 'minutes'}`
      : ''
    return ct('tracking.expiresHours', { hours: hrs, minutes: minuteText })
  }

  return (
    <Box sx={{ bgcolor: '#f8fafc', minHeight: '100vh', pb: 4 }}>
      {/* Session header */}
      <Box sx={{ bgcolor: isValid ? '#0f172a' : '#374151', color: '#fff', px: 2, pt: 4, pb: 3, textAlign: 'center', position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
          <LanguageSelector compact languageCodes={ORDERING_LANGUAGE_CODES} />
        </Box>
        <Typography sx={{ fontSize: 13, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', mb: 0.5 }}>
          {ct('tracking.sessionTitle')}
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>
          {hasOrders ? ct('tracking.orderCount', { count: session.orders.length }) : ct('tracking.noOrdersShort')}
        </Typography>
        {formatExpiry() && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, mt: 1, px: 2, py: 0.5,
            bgcolor: isValid ? '#1e3a5f' : '#4b5563', borderRadius: 99 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: isValid ? '#34d399' : '#9ca3af',
              animation: isValid ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
            <Typography sx={{ fontSize: 12, color: isValid ? '#a7f3d0' : '#d1d5db' }}>
              {formatExpiry()}
            </Typography>
          </Box>
        )}
      </Box>

      <ShopContactCard shopConfig={shopConfig} />

      {/* Order list */}
      <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {!hasOrders && (
          <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
            <Typography variant="h4" sx={{ mb: 1 }}>🛒</Typography>
            <Typography>{ct('tracking.noOrdersLong')}</Typography>
          </Box>
        )}

        {(session.orders || []).map(order => (
          <OrderCard
            key={order.orderCode}
            order={order}
            highlighted={order.orderCode === highlightCode}
            token={token}
            itemName={itemName}
            fmtLocal={fmtLocal}
            optionText={optionText}
          />
        ))}
      </Box>

      {/* Action bar */}
      {isValid && (
        <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Divider sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.disabled">{ct('tracking.actions')}</Typography>
          </Divider>
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddShoppingCartIcon />}
            onClick={() => { window.location.href = menuUrl({ t: token, lang: language }) }}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', py: 1.25 }}>
            {hasPending ? ct('tracking.addMore') : ct('tracking.newOrder')}
          </Button>
          <ShareTrackingButton orderNumber={session.orders?.length === 1 ? (session.orders[0].orderNumber || session.orders[0].dailySeq) : null} />
          <CustomerNotificationsButton />
        </Box>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
        {ct('tracking.autoUpdate')}
      </Typography>
    </Box>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ShopOrderStatusPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { setTenantId, setCompanyId } = useAppContext()
  const { language, setLanguage, t, formatMoney } = useI18n()
  const fmtLocal = (n) => n != null ? formatMoney(n, 'VND') : ''
  const itemName = (item) => localizedModelName(item, language)
  const ct = useCallback((key, vars) => shopCustomerText(language, key, vars), [language])
  const { orderCode } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')
  const rawLanguage = searchParams.get('lang') || searchParams.get('language') || ''

  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [shopConfig, setShopConfig] = useState(null)
  const [optionsByModel, setOptionsByModel] = useState({})
  const previousOrderRef = useRef(null)
  const shopConfigKeyRef = useRef('')
  const optionText = useCallback((item) => localizedSelectedOptions(item.modelId, item.selectedOptions, optionsByModel, language), [language, optionsByModel])

  useEffect(() => {
    if (rawLanguage) setLanguage(rawLanguage)
  }, [rawLanguage, setLanguage])

  // A shared confirmation link remains customer-facing for anonymous visitors.
  // Signed-in shop users should work with the order in the BOM order grid.
  useEffect(() => {
    if (authLoading || !user || !orderCode) return
    let cancelled = false
    fetchPublicOrder(orderCode)
      .then(({ data }) => {
        if (cancelled || !data?.orderCode) return
        if (data.tenantId) setTenantId(String(data.tenantId))
        if (data.companyId) setCompanyId(String(data.companyId))
        const orderFilter = data.orderNumber != null ? data.orderNumber : data.orderCode
        navigate(`/shop-orders?order=${encodeURIComponent(orderFilter)}`, { replace: true })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [authLoading, navigate, orderCode, setCompanyId, setTenantId, user])

  // Only load single order when there's no token
  const load = useCallback(() => {
    if (token || !orderCode) return
    fetchPublicOrder(orderCode)
      .then(({ data }) => {
        if (!data?.orderCode) { setError(ct('tracking.orderNotFound')); return }
        const old = previousOrderRef.current
        if (old && old.status !== data.status) notifyCustomer(`${ct('tracking.order')} #${data.orderNumber || data.orderCode}`, orderStatusLabel(data, language, t))
        if (old && !old.paymentRequestedAt && data.paymentRequestedAt && data.paymentStatus !== 'PAID') notifyCustomer(ct('tracking.paymentNotificationTitle'), ct('tracking.paymentNotificationBody'))
        if (data.tenantId && data.companyId && Object.keys(optionsByModel).length === 0) {
          fetchPublicMenuOptions(data.tenantId, data.companyId)
            .then(({ data: rows }) => setOptionsByModel(groupOptionsByModel(rows)))
            .catch(() => {})
        }
        loadShopConfigForScope(data.tenantId, data.companyId, shopConfigKeyRef, setShopConfig)
        previousOrderRef.current = data
        setOrder(data)
      })
      .catch(() => setError(ct('tracking.cannotLoadOrder')))
  }, [ct, language, optionsByModel, orderCode, t, token])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  // Token session view
  if (token) {
    return <TokenSessionView token={token} highlightCode={orderCode} itemName={itemName} fmtLocal={fmtLocal} />
  }

  // Single order view (no token — staff-generated links etc.)
  if (!order && !error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (error && !order) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>

  const openMenuForOrder = (ord, extra = {}) => {
    const parts = { lang: language, ...extra }
    if (ord.sourceToken) {
      parts.t = ord.sourceToken
    } else {
      if (ord.tenantId)  parts.tenantId  = String(ord.tenantId)
      if (ord.companyId) parts.companyId = String(ord.companyId)
      if (ord.tableId)   parts.tableId   = String(ord.tableId)
    }
    // Derive app base from current pathname (/bom-inventory/shop/order/…) → /bom-inventory
    const appBase = window.location.pathname.split('/shop/')[0]
    window.location.href = window.location.origin + appBase + '/shop/menu?' + new URLSearchParams(parts)
  }

  const goEditNoToken = (ord) => openMenuForOrder(ord, { editOrder: ord.orderCode })
  const goOrderMoreNoToken = (ord) => openMenuForOrder(ord)

  return <SingleOrderView order={order} shopConfig={shopConfig} onEdit={goEditNoToken} onOrderMore={goOrderMoreNoToken} itemName={itemName} fmtLocal={fmtLocal} optionText={optionText} />
}
