import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import PrintIcon from '@mui/icons-material/Print'
import EditIcon from '@mui/icons-material/Edit'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { fetchPublicOrder, fetchTokenSession } from '../../api/shopApi'
import { printOrderReceipt } from '../../utils/printOrderReceipt'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))

const STEPS = [
  { key: 'PENDING',   label: 'Placed',    emoji: '📋' },
  { key: 'CONFIRMED', label: 'Confirmed', emoji: '✅' },
  { key: 'PREPARING', label: 'Preparing', emoji: '👨‍🍳' },
  { key: 'READY',     label: 'Ready',     emoji: '🔔' },
  { key: 'COMPLETED', label: 'Done',      emoji: '🎉' },
]

const STATUS_IDX = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, PICKED_UP: 4, COMPLETED: 4 }

const STATUS_STYLE = {
  PENDING:   { color: '#78909c', bg: '#f5f5f5', label: 'Waiting for confirmation' },
  CONFIRMED: { color: '#43a047', bg: '#f1f8e9', label: 'Order confirmed!' },
  PREPARING: { color: '#fb8c00', bg: '#fff8e1', label: 'Being prepared…' },
  READY:     { color: '#0288d1', bg: '#e1f5fe', label: '🔔 Ready to pick up!' },
  PICKED_UP: { color: '#1b5e20', bg: '#e8f5e9', label: '✓ Picked up — enjoy!' },
  COMPLETED: { color: '#2e7d32', bg: '#e8f5e9', label: 'Completed — thank you!' },
  CANCELLED: { color: '#e53935', bg: '#fce4ec', label: 'Order cancelled' },
}

const STATUS_CHIP = {
  PENDING:   { color: 'default',  label: 'Waiting Confirm' },
  CONFIRMED: { color: 'success',  label: 'Confirmed' },
  PREPARING: { color: 'warning',  label: 'Preparing' },
  READY:     { color: 'info',     label: 'Ready!' },
  PICKED_UP: { color: 'success',  label: 'Picked up' },
  COMPLETED: { color: 'success',  label: 'Done' },
  CANCELLED: { color: 'error',    label: 'Cancelled' },
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

// ── Single order full view (no token) ────────────────────────────────────────

function SingleOrderView({ order, onEdit }) {
  const status    = order.status || 'PENDING'
  const cancelled = status === 'CANCELLED'
  const isDone    = status === 'COMPLETED' || status === 'PICKED_UP'
  const activeIdx = cancelled ? -1 : (STATUS_IDX[status] ?? 0)
  const style     = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  const isQrUrl    = order.paymentQr?.startsWith('https://')
  const bankCode   = isQrUrl ? order.paymentQr.split('/image/')[1]?.split('-')[0] : null
  const bankLogoUrl = bankCode ? `https://img.vietqr.io/img/${bankCode}.png` : null
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const heroNum = order.orderNumber ? `#${order.orderNumber}` : order.dailySeq ? `#${order.dailySeq}` : '—'

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ bgcolor: style.bg, textAlign: 'center', px: 2, pt: { xs: 5, md: 6 }, pb: { xs: 3, md: 4 } }}>
        <Typography sx={{ fontSize: { xs: 80, md: 110 }, fontWeight: 900, lineHeight: 1, color: style.color, letterSpacing: 0 }}>
          {heroNum}
        </Typography>
        <Typography sx={{ fontSize: 12, color: style.color, opacity: 0.55, mt: 0.75 }}>
          {order.orderNumber ? `Đơn #${order.orderNumber}` : ''}{order.orderCode ? ` · ${order.orderCode}` : ''}
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1.5, px: 2.5, py: 0.75, bgcolor: '#fff', borderRadius: 99, border: `1.5px solid ${style.color}22` }}>
          {status === 'PREPARING' && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.color, flexShrink: 0, animation: 'blink 1.4s infinite', '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
          )}
          <Typography fontWeight={700} sx={{ color: style.color, fontSize: { xs: 15, md: 17 } }}>{style.label}</Typography>
        </Box>
      </Box>

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

      {status === 'READY' && order.paymentQr && (
        <Box sx={{ textAlign: 'center', px: { xs: 2, md: 4 }, pt: 3, pb: 1 }}>
          {bankLogoUrl && <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}><img src={bankLogoUrl} alt="Bank" style={{ height: 40, maxWidth: 140, objectFit: 'contain', borderRadius: 6 }} /></Box>}
          <Typography variant="subtitle2" fontWeight={700} color="#0277bd" sx={{ mb: 1.5 }}>Scan to Pay</Typography>
          <img src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`} alt="Payment QR"
            style={{ width: 200, height: 200, display: 'block', margin: '0 auto', borderRadius: 8 }} />
          <Typography variant="h6" fontWeight={800} color="primary" sx={{ mt: 1.25 }}>{fmt(payableAmount(order))}</Typography>
          <Typography variant="caption" color="text.secondary">ref: {order.orderCode}</Typography>
        </Box>
      )}

      {order.notes && (
        <Box sx={{ mx: { xs: 1.5, md: 4 }, mt: 2, p: 1.5, bgcolor: '#fafafa', borderRadius: 2, border: '1px solid #f0f0f0' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.5 }}>Notes</Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>{order.notes}</Typography>
        </Box>
      )}

      {isDone && (
        <Box sx={{ textAlign: 'center', pt: 3 }}>
          <Typography variant="h4">🎉</Typography>
          <Typography fontWeight={700} color="#2e7d32">Thank you!</Typography>
          <Typography variant="body2" color="text.secondary">See you next time.</Typography>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />
      <Box sx={{ px: 2, pb: 2, pt: 1, display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 480, mx: 'auto', width: '100%' }}>
        {order.status === 'PENDING' && (
          <Button variant="outlined" fullWidth startIcon={<EditIcon />}
            onClick={() => onEdit(order)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            Edit Order
          </Button>
        )}
        <Box sx={{ textAlign: 'center' }}>
          <Button size="small" startIcon={<PrintIcon />} onClick={() => printOrderReceipt(order)}
            sx={{ textTransform: 'none', color: 'text.disabled', fontSize: 12 }}>
            Print Receipt
          </Button>
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.25 }}>
            {order.orderCode} · refreshes every 5s
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

function OrderCard({ order, highlighted, token }) {
  const [expanded, setExpanded] = useState(highlighted)
  const status   = order.status || 'PENDING'
  const chip     = STATUS_CHIP[status] || STATUS_CHIP.PENDING
  const style    = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const isPending = status === 'PENDING'
  const isQrUrl   = order.paymentQr?.startsWith('https://')

  const goEdit = () => {
    window.location.href = menuUrl({ t: token, editOrder: order.orderCode })
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
          <Chip label={chip.label} color={chip.color} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
          {status === 'PREPARING' && (
            <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              bgcolor: style.color, ml: 1, mb: '1px',
              animation: 'blink2 1.4s infinite', '@keyframes blink2': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
          )}
        </Box>
        <Typography fontWeight={800} color="primary" sx={{ fontSize: 15 }}>{fmt(payableAmount(order))}</Typography>
        <Box sx={{ color: '#94a3b8' }}>{expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}</Box>
      </Box>

      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          {/* Step bar (compact) */}
          {status !== 'CANCELLED' && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
              {STEPS.map((step, idx) => {
                const activeIdx = STATUS_IDX[status] ?? 0
                return (
                  <React.Fragment key={step.key}>
                    <StepDot step={step} activeIdx={activeIdx} idx={idx} />
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
            return (
              <Box key={item.id} sx={{ mb: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" fontWeight={600}>
                    {i + 1}. {item.quantity}× {item.modelName}
                    {item.selectedOptions && <Typography component="span" variant="caption" color="text.secondary"> ({item.selectedOptions})</Typography>}
                  </Typography>
                  <Typography variant="body2" fontWeight={700} color="primary">{fmt(item.lineTotal)}</Typography>
                </Box>
                {itemChildren.map((child, ci) => (
                  <Box key={child.id} sx={{ display: 'flex', justifyContent: 'space-between', pl: 2 }}>
                    <Typography variant="caption" color="text.secondary">{i + 1}.{ci + 1} {child.quantity}× {child.modelName}</Typography>
                    <Typography variant="caption" color="primary" fontWeight={600}>{fmt(child.lineTotal)}</Typography>
                  </Box>
                ))}
              </Box>
            )
          })}

          {/* Payment QR if READY */}
          {status === 'READY' && order.paymentQr && (
            <Box sx={{ textAlign: 'center', mt: 1.5, pb: 0.5 }}>
              <Typography variant="caption" fontWeight={700} color="#0277bd" sx={{ display: 'block', mb: 1 }}>Scan to Pay</Typography>
              <img src={isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`}
                alt="Payment QR" style={{ width: 160, height: 160, borderRadius: 8 }} />
            </Box>
          )}

          {order.notes && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontStyle: 'italic' }}>
              Note: {order.notes}
            </Typography>
          )}
        </Box>

        {isPending && (
          <>
            <Divider />
            <Box sx={{ px: 2, py: 1.25, display: 'flex', gap: 1 }}>
              <Button variant="outlined" size="small" startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                onClick={goEdit}
                sx={{ fontWeight: 700, textTransform: 'none', flex: 1, borderRadius: 1.5 }}>
                Edit this order
              </Button>
              <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 14 }} />}
                onClick={() => printOrderReceipt(order)}
                sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Print
              </Button>
            </Box>
          </>
        )}
        {!isPending && (
          <Box sx={{ px: 2, pb: 1, pt: 0.5 }}>
            <Button size="small" startIcon={<PrintIcon sx={{ fontSize: 14 }} />}
              onClick={() => printOrderReceipt(order)}
              sx={{ textTransform: 'none', color: 'text.secondary' }}>
              Print Receipt
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  )
}

// ── Token session view (all orders for a token) ───────────────────────────────

function TokenSessionView({ token, highlightCode }) {
  const [session, setSession] = useState(null)
  const [error, setError]     = useState('')

  const load = useCallback(() => {
    fetchTokenSession(token)
      .then(({ data }) => { if (data?.orders != null) setSession(data); else setError('Session not found') })
      .catch(() => setError('Failed to load session'))
  }, [token])

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
    if (!isValid) return 'Session expired'
    const mins = Math.floor(msLeft / 60000)
    if (mins < 60) return `Expires in ${mins} min`
    const hrs = Math.floor(mins / 60)
    const rem = mins % 60
    return `Expires in ${hrs}h ${rem > 0 ? rem + 'm' : ''}`
  }

  return (
    <Box sx={{ bgcolor: '#f8fafc', minHeight: '100vh', pb: 4 }}>
      {/* Session header */}
      <Box sx={{ bgcolor: isValid ? '#0f172a' : '#374151', color: '#fff', px: 2, pt: 4, pb: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', mb: 0.5 }}>
          Order Session
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>
          {hasOrders ? `${session.orders.length} Order${session.orders.length > 1 ? 's' : ''}` : 'No Orders Yet'}
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

      {/* Order list */}
      <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {!hasOrders && (
          <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>
            <Typography variant="h4" sx={{ mb: 1 }}>🛒</Typography>
            <Typography>No orders placed yet in this session.</Typography>
          </Box>
        )}

        {(session.orders || []).map(order => (
          <OrderCard
            key={order.orderCode}
            order={order}
            highlighted={order.orderCode === highlightCode}
            token={token}
          />
        ))}
      </Box>

      {/* Action bar */}
      {isValid && (
        <Box sx={{ px: 2, pt: 2, maxWidth: 560, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Divider sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.disabled">Actions</Typography>
          </Divider>
          <Button
            variant="contained"
            fullWidth
            startIcon={<AddShoppingCartIcon />}
            onClick={() => { window.location.href = menuUrl({ t: token }) }}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', py: 1.25 }}>
            {hasPending ? 'Order More' : 'New Order'}
          </Button>
        </Box>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
        refreshes every 5s
      </Typography>
    </Box>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ShopOrderStatusPage() {
  const { orderCode } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')

  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  // Only load single order when there's no token
  const load = useCallback(() => {
    if (token || !orderCode) return
    fetchPublicOrder(orderCode)
      .then(({ data }) => { if (data?.orderCode) setOrder(data); else setError('Order not found') })
      .catch(() => setError('Failed to load order'))
  }, [orderCode, token])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  // Token session view
  if (token) {
    return <TokenSessionView token={token} highlightCode={orderCode} />
  }

  // Single order view (no token — staff-generated links etc.)
  if (!order && !error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (error && !order) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>

  const goEditNoToken = (ord) => {
    const parts = { editOrder: ord.orderCode }
    if (ord.sourceToken) {
      parts.t = ord.sourceToken
    } else {
      if (ord.tenantId)  parts.tenantId  = String(ord.tenantId)
      if (ord.companyId) parts.companyId = String(ord.companyId)
    }
    // Derive app base from current pathname (/bom-inventory/shop/order/…) → /bom-inventory
    const appBase = window.location.pathname.split('/shop/')[0]
    window.location.href = window.location.origin + appBase + '/shop/menu?' + new URLSearchParams(parts)
  }

  return <SingleOrderView order={order} onEdit={goEditNoToken} />
}
