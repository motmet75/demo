import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
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

const STATUS_CHIP = {
  PENDING:   { label: 'Waiting',   color: '#757575', bg: '#f5f5f5' },
  CONFIRMED: { label: 'Confirmed', color: '#2e7d32', bg: '#f1f8e9' },
  PREPARING: { label: 'Preparing', color: '#e65100', bg: '#fff8e1' },
  READY:     { label: 'Ready to pick up!', color: '#0277bd', bg: '#e1f5fe' },
  COMPLETED: { label: 'Completed', color: '#1b5e20', bg: '#e8f5e9' },
  CANCELLED: { label: 'Cancelled', color: '#b71c1c', bg: '#fce4ec' },
}

const STATUS_MESSAGE = {
  PENDING:   'Your order has been received.',
  CONFIRMED: 'Order confirmed — we\'re getting started.',
  PREPARING: 'Your order is being prepared.',
  READY:     'Your order is ready! Please proceed to pick up.',
  COMPLETED: 'Thank you! Enjoy your order.',
  CANCELLED: 'This order was cancelled.',
}

function StepDot({ step, activeIdx, idx }) {
  const done   = idx < activeIdx
  const active = idx === activeIdx

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: active ? 18 : 14,
        bgcolor: done ? '#a5d6a7' : active ? '#1976d2' : '#eeeeee',
        border: active ? '2px solid #1565c0' : '2px solid transparent',
        transition: 'all 0.3s',
      }}>
        {done
          ? <Typography sx={{ color: '#2e7d32', fontWeight: 900, fontSize: 16, lineHeight: 1 }}>✓</Typography>
          : <Typography sx={{ lineHeight: 1 }}>{step.emoji}</Typography>
        }
      </Box>
      <Typography variant="caption" sx={{
        fontWeight: active ? 700 : 400,
        color: active ? '#1565c0' : done ? '#388e3c' : '#bdbdbd',
        fontSize: 11, textAlign: 'center', lineHeight: 1.2,
      }}>
        {step.label}
      </Typography>
    </Box>
  )
}

function StepConnector({ done }) {
  return (
    <Box sx={{
      height: 2, flex: 1, mt: '15px', mb: 'auto',
      bgcolor: done ? '#a5d6a7' : '#eeeeee',
      borderRadius: 2, transition: 'background-color 0.3s',
    }} />
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
      .then(({ data }) => {
        if (data && data.orderCode) setOrder(data)
        else setError('Order not found')
      })
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
  const chip      = STATUS_CHIP[status] || STATUS_CHIP.PENDING
  const isQrUrl   = order.paymentQr?.startsWith('https://')
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode

  return (
    <Box sx={{ bgcolor: '#f8f9fa', minHeight: '100vh' }}>
      <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 4 } }}>

        {/* ── Order number + status ─────────────────────── */}
        <Box sx={{
          bgcolor: '#fff', borderRadius: 3, border: '1px solid #e8e8e8',
          px: 3, py: 3, textAlign: 'center', mb: 2,
        }}>
          <Typography sx={{
            fontSize: { xs: 72, md: 96 }, fontWeight: 900, lineHeight: 1,
            color: chip.color, letterSpacing: -2,
          }}>
            {displayNum}
          </Typography>

          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1, mb: 0.5,
            bgcolor: chip.bg, px: 2, py: 0.5, borderRadius: 99 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: chip.color,
              animation: status === 'PREPARING' ? 'pulse 1.5s infinite' : 'none',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } }
            }} />
            <Typography variant="body2" fontWeight={700} sx={{ color: chip.color }}>
              {chip.label}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {STATUS_MESSAGE[status]}
          </Typography>
        </Box>

        {/* ── Step progress ────────────────────────────── */}
        {!cancelled && (
          <Box sx={{ bgcolor: '#fff', borderRadius: 3, border: '1px solid #e8e8e8', px: 2, py: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              {STEPS.map((step, idx) => (
                <React.Fragment key={step.key}>
                  <StepDot step={step} activeIdx={activeIdx} idx={idx} />
                  {idx < STEPS.length - 1 && <StepConnector done={idx < activeIdx} />}
                </React.Fragment>
              ))}
            </Box>
          </Box>
        )}

        {/* ── Payment QR — shown at READY ──────────────── */}
        {status === 'READY' && order.paymentQr && (
          <Box sx={{
            bgcolor: '#fff', borderRadius: 3, border: '1.5px solid #b3e5fc',
            textAlign: 'center', px: 3, py: 2.5, mb: 2,
          }}>
            <Typography variant="subtitle2" fontWeight={700} color="#0277bd" sx={{ mb: 1.5 }}>
              Scan to Pay
            </Typography>
            <img
              src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`}
              alt="Payment QR"
              style={{ width: 200, height: 200, display: 'block', margin: '0 auto', borderRadius: 8 }}
            />
            <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1.5 }}>
              {fmt(order.totalAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Transfer exact amount · ref: {order.orderCode}
            </Typography>
          </Box>
        )}

        {/* ── Notes ────────────────────────────────────── */}
        {order.notes && (
          <Box sx={{ bgcolor: '#fff', borderRadius: 3, border: '1px solid #e8e8e8', px: 2, py: 1.5, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>Notes</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>{order.notes}</Typography>
          </Box>
        )}

        {/* ── Completion ───────────────────────────────── */}
        {status === 'COMPLETED' && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h4" sx={{ mb: 0.5 }}>🎉</Typography>
            <Typography fontWeight={700} color="#2e7d32">Thank you!</Typography>
            <Typography variant="body2" color="text.secondary">See you next time.</Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          {order.orderCode} · auto-refreshes every 5s
        </Typography>
      </Box>
    </Box>
  )
}
