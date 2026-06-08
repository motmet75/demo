import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchPublicOrder } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const STEPS = [
  { key: 'PENDING',   label: 'Placed',    emoji: '📋' },
  { key: 'CONFIRMED', label: 'Confirmed', emoji: '✅' },
  { key: 'PREPARING', label: 'Preparing', emoji: '👨‍🍳' },
  { key: 'READY',     label: 'Ready',     emoji: '🔔' },
  { key: 'COMPLETED', label: 'Done',      emoji: '🎉' },
]

const STATUS_IDX = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, COMPLETED: 4 }

const STATUS_STYLE = {
  PENDING:   { color: '#78909c', bg: '#f5f5f5', label: 'Waiting for confirmation' },
  CONFIRMED: { color: '#43a047', bg: '#f1f8e9', label: 'Order confirmed!' },
  PREPARING: { color: '#fb8c00', bg: '#fff8e1', label: 'Being prepared…' },
  READY:     { color: '#0288d1', bg: '#e1f5fe', label: '🔔 Ready to pick up!' },
  COMPLETED: { color: '#2e7d32', bg: '#e8f5e9', label: 'Completed — thank you!' },
  CANCELLED: { color: '#e53935', bg: '#fce4ec', label: 'Order cancelled' },
}

function StepDot({ step, activeIdx, idx }) {
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
        {step.label}
      </Typography>
    </Box>
  )
}

export default function ShopOrderStatusPage() {
  const { orderCode } = useParams()
  const [params] = useSearchParams()
  const tenantId  = params.get('tenantId')
  const companyId = params.get('companyId')

  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!orderCode || !tenantId || !companyId) return
    fetchPublicOrder(orderCode, tenantId, companyId)
      .then(({ data }) => { if (data?.orderCode) setOrder(data); else setError('Order not found') })
      .catch(() => setError('Failed to load order'))
  }, [orderCode, tenantId, companyId])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  if (!order && !error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (error && !order) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>

  const status    = order.status || 'PENDING'
  const cancelled = status === 'CANCELLED'
  const activeIdx = cancelled ? -1 : (STATUS_IDX[status] ?? 0)
  const style     = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  const isQrUrl   = order.paymentQr?.startsWith('https://')
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Big number hero ─────────────────────────────── */}
      <Box sx={{
        bgcolor: style.bg,
        textAlign: 'center',
        px: 2,
        pt: { xs: 5, md: 6 },
        pb: { xs: 3, md: 4 },
      }}>
        <Typography sx={{
          fontSize: { xs: 100, md: 128 },
          fontWeight: 900,
          lineHeight: 1,
          color: style.color,
          letterSpacing: -4,
        }}>
          {displayNum}
        </Typography>

        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 1,
          mt: 1.5, px: 2.5, py: 0.75,
          bgcolor: '#fff', borderRadius: 99,
          border: `1.5px solid ${style.color}22`,
        }}>
          {status === 'PREPARING' && (
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: style.color, flexShrink: 0,
              animation: 'blink 1.4s infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
            }} />
          )}
          <Typography fontWeight={700} sx={{ color: style.color, fontSize: { xs: 15, md: 17 } }}>
            {style.label}
          </Typography>
        </Box>
      </Box>

      {/* ── Step bar ─────────────────────────────────────── */}
      {!cancelled && (
        <Box sx={{ bgcolor: '#fff', borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', px: { xs: 1.5, md: 4 }, py: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', maxWidth: 560, mx: 'auto' }}>
            {STEPS.map((step, idx) => (
              <React.Fragment key={step.key}>
                <StepDot step={step} activeIdx={activeIdx} idx={idx} />
                {idx < STEPS.length - 1 && (
                  <Box sx={{ height: 2, flex: 1, mt: '13px', mb: 'auto', bgcolor: idx < activeIdx ? '#a5d6a7' : '#eeeeee', borderRadius: 2 }} />
                )}
              </React.Fragment>
            ))}
          </Box>
        </Box>
      )}

      {/* ── Payment QR — shown at READY ──────────────────── */}
      {status === 'READY' && order.paymentQr && (
        <Box sx={{ textAlign: 'center', px: { xs: 2, md: 4 }, pt: 3, pb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} color="#0277bd" sx={{ mb: 1.5 }}>
            Scan to Pay
          </Typography>
          <img
            src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`}
            alt="Payment QR"
            style={{ width: 180, height: 180, display: 'block', margin: '0 auto', borderRadius: 8 }}
          />
          <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1.25 }}>
            {fmt(order.totalAmount)}
          </Typography>
          <Typography variant="caption" color="text.secondary">ref: {order.orderCode}</Typography>
        </Box>
      )}

      {/* ── Notes ────────────────────────────────────────── */}
      {order.notes && (
        <Box sx={{ mx: { xs: 1.5, md: 4 }, mt: 2, p: 1.5, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid #f0f0f0' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}
            sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>Notes</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>{order.notes}</Typography>
        </Box>
      )}

      {/* ── Completion ───────────────────────────────────── */}
      {status === 'COMPLETED' && (
        <Box sx={{ textAlign: 'center', pt: 3 }}>
          <Typography variant="h4">🎉</Typography>
          <Typography fontWeight={700} color="#2e7d32">Thank you!</Typography>
          <Typography variant="body2" color="text.secondary">See you next time.</Typography>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', pb: 2, pt: 1 }}>
        {order.orderCode} · refreshes every 5s
      </Typography>
    </Box>
  )
}
