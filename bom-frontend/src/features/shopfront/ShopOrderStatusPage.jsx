import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchPublicOrder } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const STEPS = [
  { key: 'PENDING',   label: 'Placed',     emoji: '📋' },
  { key: 'CONFIRMED', label: 'Confirmed',  emoji: '✅' },
  { key: 'PREPARING', label: 'Preparing',  emoji: '👨‍🍳' },
  { key: 'READY',     label: 'Ready',      emoji: '🔔' },
  { key: 'COMPLETED', label: 'Done',       emoji: '🎉' },
]

const STATUS_IDX = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, COMPLETED: 4 }

const STATUS_COLOR = {
  PENDING:   { bg: '#e3f2fd', text: '#1565c0', accent: '#1976d2' },
  CONFIRMED: { bg: '#e8f5e9', text: '#2e7d32', accent: '#388e3c' },
  PREPARING: { bg: '#fff3e0', text: '#e65100', accent: '#f57c00' },
  READY:     { bg: '#f3e5f5', text: '#6a1b9a', accent: '#8e24aa' },
  COMPLETED: { bg: '#e8f5e9', text: '#1b5e20', accent: '#2e7d32' },
  CANCELLED: { bg: '#fce4ec', text: '#b71c1c', accent: '#c62828' },
}

const STATUS_MESSAGE = {
  PENDING:   'Order received — waiting for confirmation.',
  CONFIRMED: 'Order confirmed! We\'re getting started.',
  PREPARING: 'Your order is being prepared.',
  READY:     'Ready! Please proceed to payment.',
  COMPLETED: 'Order complete. Thank you!',
  CANCELLED: 'This order was cancelled.',
}

function StepDot({ step, activeIdx, idx }) {
  const done    = idx < activeIdx
  const active  = idx === activeIdx
  const pending = idx > activeIdx

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
      <Box sx={{
        width: 38, height: 38, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: active ? 20 : 16,
        bgcolor: done ? '#4caf50' : active ? '#1976d2' : '#f0f0f0',
        border: active ? '3px solid #1565c0' : done ? '2px solid #388e3c' : '2px solid #e0e0e0',
        boxShadow: active ? '0 2px 8px rgba(25,118,210,0.35)' : 'none',
        transition: 'all 0.3s',
      }}>
        {done ? (
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>✓</Typography>
        ) : (
          <Typography sx={{ lineHeight: 1 }}>{step.emoji}</Typography>
        )}
      </Box>
      <Typography variant="caption" sx={{
        fontWeight: active ? 800 : done ? 600 : 400,
        color: active ? '#1565c0' : done ? '#388e3c' : '#9e9e9e',
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        {step.label}
      </Typography>
    </Box>
  )
}

function StepConnector({ done }) {
  return (
    <Box sx={{
      height: 3, flex: 1, mt: '17px', mb: 'auto',
      bgcolor: done ? '#4caf50' : '#e0e0e0',
      borderRadius: 2,
      transition: 'background-color 0.3s',
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
  const colors    = STATUS_COLOR[status] || STATUS_COLOR.PENDING
  const isQrUrl   = order.paymentQr?.startsWith('https://')

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', bgcolor: '#f5f5f5', minHeight: '100vh', pb: 4 }}>

      {/* Status banner */}
      <Box sx={{
        background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.bg} 100%)`,
        px: 3, pt: 4, pb: 3, textAlign: 'center',
      }}>
        <Typography variant="h2" sx={{ lineHeight: 1, mb: 1 }}>
          {cancelled ? '❌' : STEPS[Math.max(0, activeIdx)]?.emoji}
        </Typography>
        <Typography variant="h6" fontWeight={800} sx={{ color: colors.text, mb: 0.5 }}>
          {cancelled ? 'Cancelled' : STEPS[Math.max(0, activeIdx)]?.label}
        </Typography>
        <Typography variant="body2" sx={{ color: colors.text, opacity: 0.85 }}>
          {STATUS_MESSAGE[status]}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.text, opacity: 0.6, display: 'block', mt: 1 }}>
          Order #{order.orderCode}
        </Typography>
      </Box>

      {/* Progress steps */}
      {!cancelled && (
        <Box sx={{ bgcolor: '#fff', px: 2, py: 2, borderBottom: '1px solid #eeeeee' }}>
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

      <Box sx={{ px: 2, pt: 2 }}>

        {/* Payment QR — shown at READY step */}
        {status === 'READY' && order.paymentQr && (
          <Card elevation={0} sx={{
            mb: 2, borderRadius: 3, border: `2px solid ${colors.accent}`,
            textAlign: 'center', overflow: 'hidden',
          }}>
            <Box sx={{ bgcolor: colors.accent, py: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#fff' }}>
                Scan to Pay
              </Typography>
            </Box>
            <CardContent sx={{ pb: '16px !important' }}>
              <img
                src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`}
                alt="Payment QR"
                style={{ width: 220, height: 220, display: 'block', margin: '0 auto', borderRadius: 8 }}
              />
              <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1.5 }}>
                {fmt(order.totalAmount)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Transfer with exact amount · Order {order.orderCode}
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Order items */}
        <Card elevation={0} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e8e8e8' }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
              Order Summary
            </Typography>
            {(order.items || []).map(item => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{item.modelName}</Typography>
                  <Typography variant="caption" color="text.secondary">× {item.quantity}</Typography>
                </Box>
                <Typography variant="body2" fontWeight={600} color="primary">{fmt(item.lineTotal)}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1 }} />
            {order.deliveryFee > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Delivery fee</Typography>
                <Typography variant="body2">{fmt(order.deliveryFee)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight={800} variant="body1">Total</Typography>
              <Typography fontWeight={800} variant="body1" color="primary">{fmt(order.totalAmount)}</Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Notes */}
        {order.notes && (
          <Card elevation={0} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e8e8e8' }}>
            <CardContent sx={{ py: '12px !important' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                Notes
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{order.notes}</Typography>
            </CardContent>
          </Card>
        )}

        {/* Completion message */}
        {status === 'COMPLETED' && (
          <Box sx={{
            textAlign: 'center', py: 3,
            bgcolor: '#e8f5e9', borderRadius: 3, border: '1px solid #c8e6c9',
          }}>
            <Typography variant="h4" sx={{ mb: 0.5 }}>🎉</Typography>
            <Typography fontWeight={700} color="#2e7d32">Thank you!</Typography>
            <Typography variant="body2" color="#388e3c">See you next time.</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
