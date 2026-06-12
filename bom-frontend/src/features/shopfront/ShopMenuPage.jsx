import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardMedia from '@mui/material/CardMedia'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import NoteAltIcon from '@mui/icons-material/NoteAlt'
import TuneIcon from '@mui/icons-material/Tune'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining'
import TableBarIcon from '@mui/icons-material/TableBar'
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Badge from '@mui/material/Badge'
import Collapse from '@mui/material/Collapse'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import EditNoteIcon from '@mui/icons-material/EditNote'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant'
import { resolveToken, fetchMenu, createOrder, fetchPublicMenuOptions,
         fetchActiveTableOrders, startCustomerEdit, cancelCustomerEdit,
         updatePublicOrderItems, fetchPublicOrder, fetchTokenSession,
         cancelPublicOrder, fetchShopConfig } from '../../api/shopApi'
import ItemOptionsDialog from './ItemOptionsDialog'
import OrderReceiptDialog from './OrderReceiptDialog'

const genUid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const fmt    = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const FULFILLMENT_OPTIONS = [
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon fontSize="small" /> },
]

const TRACKING_STEPS = [
  { key: 'PENDING',   label: 'Placed',    emoji: '📋' },
  { key: 'CONFIRMED', label: 'Confirmed', emoji: '✅' },
  { key: 'PREPARING', label: 'Making',    emoji: '👨‍🍳' },
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

function buildChildMap(items) {
  const map = {}
  ;(items || []).forEach(it => {
    if (it.parentItemId) {
      const k = String(it.parentItemId)
      if (!map[k]) map[k] = []
      map[k].push(it)
    }
  })
  return map
}

const STATUS_CHIP_MAP = {
  PENDING:   { label: 'Waiting Confirm', color: 'default' },
  CONFIRMED: { label: 'Confirmed', color: 'success' },
  PREPARING: { label: 'Preparing', color: 'warning' },
  READY:     { label: 'Ready!',    color: 'info'    },
  PICKED_UP: { label: 'Picked up', color: 'success' },
  COMPLETED: { label: 'Done',      color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'error'   },
}

// Button shown in bottom bar / sidebar when session has orders
function ShowOrdersButton({ session, onClick, fullWidth }) {
  const orders   = session?.orders || []
  const editing  = orders.some(o => o.customerEditing)
  const count    = orders.length
  return (
    <Badge
      badgeContent={editing ? '!' : null}
      color="warning"
      sx={{ '& .MuiBadge-badge': { fontSize: 11, fontWeight: 900 }, ...(fullWidth ? { width: '100%' } : {}) }}>
      <Button
        variant="outlined"
        size="medium"
        fullWidth={fullWidth}
        startIcon={<ReceiptLongIcon />}
        onClick={onClick}
        sx={{
          borderRadius: 2, fontWeight: 700, textTransform: 'none', flexShrink: 0,
          borderColor: editing ? '#f59e0b' : undefined,
          color: editing ? '#d97706' : undefined,
          animation: editing ? 'pulse-border 1.6s infinite' : 'none',
          '@keyframes pulse-border': {
            '0%,100%': { boxShadow: '0 0 0 0 #f59e0b44' },
            '50%':     { boxShadow: '0 0 0 6px #f59e0b00' },
          },
        }}>
        {editing ? `✏ Editing · ${count}` : `Show Orders · ${count}`}
      </Button>
    </Badge>
  )
}

// Compact order list shown inside the session dialog
function SessionOrderList({ session, token, onEdit }) {
  const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
  const [cancelTarget, setCancelTarget] = useState(null)   // order being cancelled
  const [cancelNote, setCancelNote]     = useState('')
  const [cancelling, setCancelling]     = useState(false)
  const [cancelError, setCancelError]   = useState('')

  // hide cancelled orders — customers don't need to see them
  const orders = (session?.orders || []).filter(o => o.status !== 'CANCELLED')

  const doCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true); setCancelError('')
    try {
      const { res, data } = await cancelPublicOrder(cancelTarget.orderCode, cancelNote)
      if (!res.ok) { setCancelError(data?.error || 'Failed to cancel'); setCancelling(false); return }
      setCancelTarget(null); setCancelNote('')
    } catch { setCancelError('Network error') }
    setCancelling(false)
  }

  if (!orders.length) return (
    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
      <Typography>No orders yet in this session.</Typography>
    </Box>
  )

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {orders.map((order) => {
          const status    = order.status || 'PENDING'
          const chip      = STATUS_CHIP_MAP[status] || STATUS_CHIP_MAP.PENDING
          const editing   = Boolean(order.customerEditing)
          const isPending = status === 'PENDING'
          const isPaid    = order.paymentStatus === 'PAID'
          const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
          const roots      = (order.items || []).filter(i => !i.parentItemId)

          return (
            <Box key={order.orderCode} sx={{
              border: editing ? '2px solid #f59e0b' : '1px solid #e2e8f0',
              borderRadius: 2, overflow: 'hidden',
              bgcolor: editing ? '#fffbeb' : '#fff',
              animation: editing ? 'glow-edit 2s infinite' : 'none',
              '@keyframes glow-edit': {
                '0%,100%': { boxShadow: '0 0 0 3px #fde68a55' },
                '50%':     { boxShadow: '0 0 0 6px #fde68a00' },
              },
            }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                bgcolor: editing ? '#fef3c7' : '#f8fafc' }}>
                <Typography fontWeight={900} sx={{ fontSize: 20, minWidth: 38, color: editing ? '#b45309' : '#334155' }}>
                  {displayNum}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip label={chip.label} color={chip.color} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
                  {editing && (
                    <Chip
                      icon={<VisibilityIcon sx={{ fontSize: 13 }} />}
                      label="Editing — finish or cancel"
                      size="small"
                      sx={{
                        bgcolor: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 10,
                        animation: 'blink-chip 1.4s infinite',
                        '@keyframes blink-chip': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
                      }}
                    />
                  )}
                </Box>
                <Typography fontWeight={800} color="primary" sx={{ fontSize: 14, flexShrink: 0 }}>
                  {fmt(order.totalAmount)}
                </Typography>
              </Box>

              {/* Item summary */}
              <Box sx={{ px: 2, py: 1 }}>
                {roots.slice(0, 3).map((item) => (
                  <Typography key={item.id} variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                    {item.quantity}× {item.modelName}
                    {item.selectedOptions ? ` (${item.selectedOptions})` : ''}
                  </Typography>
                ))}
                {roots.length > 3 && (
                  <Typography variant="caption" color="text.secondary">+{roots.length - 3} more…</Typography>
                )}
              </Box>

              {/* Actions — only for PENDING orders */}
              {isPending && (
                <Box sx={{ px: 2, pb: 1.25, pt: 0.25, display: 'flex', gap: 1 }}>
                  {editing ? (
                    <Button variant="contained" size="small" color="warning"
                      onClick={() => onEdit(order)}
                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, flex: 1 }}>
                      ✏ Resume editing
                    </Button>
                  ) : (
                    <Button variant="outlined" size="small"
                      onClick={() => onEdit(order)}
                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, flex: 1 }}>
                      Edit
                    </Button>
                  )}
                  {!isPaid && (
                    <Button variant="outlined" size="small" color="error"
                      onClick={() => { setCancelTarget(order); setCancelNote(''); setCancelError('') }}
                      sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, flexShrink: 0 }}>
                      Cancel
                    </Button>
                  )}
                  {isPaid && (
                    <Chip label="Paid ✓" color="success" size="small"
                      sx={{ fontWeight: 700, fontSize: 11, alignSelf: 'center' }} />
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      {/* Cancel confirmation dialog */}
      <Dialog open={Boolean(cancelTarget)} onClose={() => !cancelling && setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Cancel this order?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Order <strong>{cancelTarget?.orderNumber ? `#${cancelTarget.orderNumber}` : cancelTarget?.orderCode}</strong> will
            be cancelled. This cannot be undone.
          </Typography>
          <TextField
            fullWidth size="small" multiline rows={2}
            label="Reason (optional)"
            placeholder="e.g. changed my mind"
            value={cancelNote}
            onChange={e => setCancelNote(e.target.value)}
            disabled={cancelling}
          />
          {cancelError && <Alert severity="error" sx={{ mt: 1.5 }}>{cancelError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling}>Keep order</Button>
          <Button variant="contained" color="error" onClick={doCancel} disabled={cancelling}
            sx={{ fontWeight: 700, minWidth: 120 }}>
            {cancelling ? <CircularProgress size={18} color="inherit" /> : 'Yes, Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function TrackingOverlay({ order: initialOrder, ctx, onEdit, onOrderMore, onUpdated }) {
  const [order, setOrder] = React.useState(initialOrder)
  const fmtLocal = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

  // Poll for updates
  React.useEffect(() => {
    if (!order?.orderCode) return
    const id = setInterval(() => {
      fetchPublicOrder(order.orderCode)
        .then(({ data }) => { if (data?.orderCode) { setOrder(data); onUpdated?.(data) } })
        .catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [order?.orderCode, ctx?.tenantId, ctx?.companyId]) // eslint-disable-line

  const status     = order.status || 'PENDING'
  const style      = STATUS_STYLE[status] || STATUS_STYLE.PENDING
  const activeIdx  = STATUS_IDX[status] ?? 0
  const isPending  = status === 'PENDING'
  const isDone     = status === 'COMPLETED' || status === 'PICKED_UP'
  const isCancelled = status === 'CANCELLED'
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode

  const allItems   = order.items || []
  const childMap   = buildChildMap(allItems)
  const rootItems  = allItems.filter(it => !it.parentItemId)

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 2000,
      bgcolor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Hero */}
      <Box sx={{ bgcolor: style.bg, textAlign: 'center', px: 2, pt: 5, pb: 3, flexShrink: 0 }}>
        <Typography sx={{ fontSize: { xs: 88, md: 110 }, fontWeight: 900, lineHeight: 1,
          color: style.color, letterSpacing: -4 }}>
          {displayNum}
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1.5, px: 2.5, py: 0.75,
          bgcolor: '#fff', borderRadius: 99, border: `1.5px solid ${style.color}22` }}>
          {status === 'PREPARING' && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.color,
              animation: 'blink 1.4s infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
          )}
          <Typography fontWeight={700} sx={{ color: style.color, fontSize: 15 }}>{style.label}</Typography>
        </Box>

        {/* Edit lock indicator */}
        {order.customerEditing && (
          <Box sx={{ mt: 1 }}>
            <Chip label="✏ Editing in progress…" size="small" color="warning" sx={{ fontWeight: 700 }} />
          </Box>
        )}
      </Box>

      {/* Step bar */}
      {!isCancelled && (
        <Box sx={{ borderTop: '1px solid #f0f0f0', borderBottom: '1px solid #f0f0f0', px: 1.5, py: 1.25, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', maxWidth: 520, mx: 'auto' }}>
            {TRACKING_STEPS.map((step, idx) => {
              const done = idx < activeIdx; const active = idx === activeIdx
              return (
                <React.Fragment key={step.key}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
                    <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: active ? 15 : 12,
                      bgcolor: done ? '#a5d6a7' : active ? '#0288d1' : '#eee',
                      border: active ? '2px solid #0277bd' : '2px solid transparent' }}>
                      {done
                        ? <Typography sx={{ color: '#2e7d32', fontWeight: 900, fontSize: 14, lineHeight: 1 }}>✓</Typography>
                        : <Typography sx={{ lineHeight: 1 }}>{step.emoji}</Typography>}
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: active ? 700 : 400,
                      color: active ? '#0277bd' : done ? '#43a047' : '#bdbdbd',
                      fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>
                      {step.label}
                    </Typography>
                  </Box>
                  {idx < TRACKING_STEPS.length - 1 && (
                    <Box sx={{ height: 2, flex: 1, mt: '13px', mb: 'auto',
                      bgcolor: idx < activeIdx ? '#a5d6a7' : '#eee', borderRadius: 2 }} />
                  )}
                </React.Fragment>
              )
            })}
          </Box>
        </Box>
      )}

      {/* Items list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 1.5 }}>
        {rootItems.map((item, idx) => {
          const children = childMap[String(item.id)] || []
          return (
            <Box key={item.id || idx} sx={{ mb: 1, pb: 1, borderBottom: '1px solid #f0f0f0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="body2" fontWeight={700}>
                  {Number(item.quantity)}× {item.modelName}
                </Typography>
                <Typography variant="body2" color="primary" fontWeight={700}>{fmtLocal(item.lineTotal)}</Typography>
              </Box>
              {item.selectedOptions && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>
                  {fmtOpts(item.selectedOptions)}
                </Typography>
              )}
              {item.itemNotes && (
                <Typography variant="caption" sx={{ pl: 1.5, color: '#f59e0b', display: 'block' }}>
                  ⚠ {item.itemNotes}
                </Typography>
              )}
              {children.map((child, ci) => (
                <Box key={child.id || ci} sx={{ display: 'flex', justifyContent: 'space-between',
                  pl: 2.5, mt: 0.25, borderLeft: '2px solid #c7d2fe', ml: 1 }}>
                  <Typography variant="caption" sx={{ color: '#6366f1', fontWeight: 600 }}>
                    + {Number(child.quantity)}× {child.modelName}
                  </Typography>
                  <Typography variant="caption" color="primary">{fmtLocal(child.lineTotal)}</Typography>
                </Box>
              ))}
            </Box>
          )
        })}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
          <Typography fontWeight={700}>Total</Typography>
          <Typography fontWeight={900} color="primary">{fmtLocal(order.totalAmount)}</Typography>
        </Box>
      </Box>

      {/* Action buttons */}
      <Box sx={{ px: 2, pb: 3, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0,
        borderTop: '1px solid #f0f0f0' }}>
        {isPending && !order.customerEditing && (
          <Button variant="outlined" fullWidth startIcon={<EditNoteIcon />}
            onClick={() => onEdit(order)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', borderColor: '#f59e0b', color: '#b45309',
              '&:hover': { bgcolor: '#fffbeb', borderColor: '#f59e0b' } }}>
            Edit My Order
          </Button>
        )}
        {isPending && order.customerEditing && (
          <Typography variant="caption" color="warning.main" textAlign="center" fontWeight={600}>
            Your order is locked for editing — submit changes from the menu
          </Typography>
        )}
        {!isDone && !isCancelled && (
          <Button variant="outlined" fullWidth startIcon={<AddShoppingCartIcon />}
            onClick={onOrderMore}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            {ctx?.tableId ? 'Order More for This Table' : 'Order Again'}
          </Button>
        )}
        {(isDone || isCancelled) && (
          <Button variant="contained" fullWidth onClick={onOrderMore}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            New Order
          </Button>
        )}
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {order.orderCode} · auto-refreshes every 5s
        </Typography>
      </Box>
    </Box>
  )
}

function fmtOpts(selectedOptions) {
  if (!selectedOptions) return null
  try {
    const obj = JSON.parse(selectedOptions)
    return Object.entries(obj).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${v.join(', ')}`
      if (v && typeof v === 'object') {
        const parts = Object.entries(v).filter(([, q]) => q > 0).map(([label, q]) => q > 1 ? `${label}×${q}` : label)
        return parts.length ? `${k}: ${parts.join(', ')}` : null
      }
      return `${k}: ${v}`
    }).filter(Boolean).join(' · ')
  } catch { return null }
}

function hasPrice(choicesJson) {
  try { return JSON.parse(choicesJson || '[]').some(c => typeof c === 'object' && Number(c.price) > 0) } catch { return false }
}

function parseOpts(selectedOptions) {
  try { return selectedOptions ? JSON.parse(selectedOptions) : {} } catch { return {} }
}

export default function ShopMenuPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const tokenParam    = params.get('t')
  const rawTenantId   = params.get('tenantId')
  const rawCompanyId  = params.get('companyId')
  const rawTableId    = params.get('tableId')
  const seqParam      = params.get('seq')
  const editOrderCode = params.get('editOrder')

  const [ctx, setCtx] = useState(
    tokenParam ? null : { tenantId: rawTenantId, companyId: rawCompanyId, tableId: rawTableId }
  )
  const [menu, setMenu]                     = useState([])
  const [optionsByModel, setOptionsByModel] = useState({})
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [notes, setNotes]                   = useState('')
  const [checkout, setCheckout]             = useState(false)
  const [cartOpen, setCartOpen]             = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [placedOrder, setPlacedOrder]       = useState(null)
  const [trackingOrder, setTrackingOrder]   = useState(null) // inline post-order tracking
  const [editingOrderCode, setEditingOrderCode] = useState(null) // order being edited
  const [tableOrders, setTableOrders]       = useState(null) // occupied table dialog
  const [tokenSession, setTokenSession]     = useState(null) // orders for this token
  const [sessionOpen, setSessionOpen]       = useState(false)
  const [shopConfig, setShopConfig]         = useState({ prepaidMenu: false, bankBin: '', bankAccountNumber: '', bankAccountName: '' })
  const [prepaidQrOrder, setPrepaidQrOrder] = useState(null) // show payment QR after placing order
  const [form, setForm] = useState({
    fulfillmentType: 'PICKUP', customerName: '', customerPhone: '',
    deliveryAddress: '', paymentMethod: 'CASH',
  })

  // cart: { [uid]: { uid, modelId, qty, selectedOptions: string|null, itemNotes: string|null,
  //                  sideItems: [{uid, modelId, modelName, qty}] } }
  const [cart, setCart] = useState({})

  // sideForm: { [parentUid]: { model: menuItem|null, qty: number } }
  const [sideForm, setSideForm] = useState({})

  // optionsTarget: for initial add when item has configurable options
  const [optionsTarget, setOptionsTarget] = useState(null)

  // ── Data loading ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tokenParam) return
    resolveToken(tokenParam)
      .then(({ res, data }) => {
        if (!res.ok) { setError('Invalid or expired QR code.'); setLoading(false); return }
        const resolved = { tenantId: data.tenantId, companyId: data.companyId, tableId: data.tableId }
        setCtx(resolved)
        if (resolved.tableId) {
          setForm(f => ({ ...f, fulfillmentType: 'DINE_IN' }))
          // Check if this table already has active orders (group ordering scenario)
          fetchActiveTableOrders(resolved.tableId, resolved.tenantId, resolved.companyId)
            .then(({ data: orders }) => { if (Array.isArray(orders) && orders.length > 0) setTableOrders(orders) })
            .catch(() => {})
        }
      })
      .catch(() => { setError('Failed to read QR code.'); setLoading(false) })
  }, [tokenParam])

  useEffect(() => {
    if (!ctx) return
    if (!ctx.tenantId || !ctx.companyId) { setError('Missing shop context.'); setLoading(false); return }
    Promise.all([
      fetchMenu(ctx.tenantId, ctx.companyId),
      fetchPublicMenuOptions(ctx.tenantId, ctx.companyId),
      fetchShopConfig(ctx.tenantId, ctx.companyId),
    ]).then(([menuRes, optsRes, cfgRes]) => {
      setMenu(Array.isArray(menuRes.data) ? menuRes.data : [])
      const byModel = {}
      ;(Array.isArray(optsRes.data) ? optsRes.data : []).forEach(opt => {
        if (!byModel[opt.modelId]) byModel[opt.modelId] = []
        byModel[opt.modelId].push(opt)
      })
      setOptionsByModel(byModel)
      if (cfgRes.data) setShopConfig(cfgRes.data)
      setLoading(false)
    }).catch(() => { setError('Failed to load menu.'); setLoading(false) })
  }, [ctx])

  // ── Poll token session orders ─────────────────────────────────────────
  const loadTokenSession = useCallback(() => {
    if (!tokenParam) return
    fetchTokenSession(tokenParam)
      .then(({ data }) => { if (data?.orders != null) setTokenSession(data) })
      .catch(() => {})
  }, [tokenParam])

  useEffect(() => {
    loadTokenSession()
    if (!tokenParam) return
    const id = setInterval(loadTokenSession, 5000)
    return () => clearInterval(id)
  }, [loadTokenSession, tokenParam])

  // ── Auto-start edit when opened via tracking page "Edit Order" button ──
  useEffect(() => {
    if (!editOrderCode || loading) return
    fetchPublicOrder(editOrderCode)
      .then(({ data }) => {
        if (!data?.orderCode) return
        startCustomerEdit(data.orderCode)
          .then(() => {
            restoreCartFromOrder(data)
            setEditingOrderCode(data.orderCode)
            setCartOpen(true)
          })
          .catch(() => {})
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderCode, loading])

  // ── Derived values ────────────────────────────────────────────────────
  const cartEntries = Object.values(cart)
  const itemCount   = cartEntries.reduce((n, e) => n + e.qty, 0)

  const calcOptAddOn = (entry) => {
    const groups = optionsByModel[entry.modelId] || []
    const opts   = parseOpts(entry.selectedOptions)
    return groups.reduce((sum, grp) => {
      if (grp.isFree) return sum
      let choiceDefs
      try { choiceDefs = JSON.parse(grp.choices) } catch { return sum }
      const cur = opts[grp.groupName]
      // qty-map format: {label: qty} — used for priced topping choices
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        const priceMap = {}
        choiceDefs.forEach(c => { if (typeof c === 'object') priceMap[c.label] = Number(c.price || 0) })
        return sum + Object.entries(cur).reduce((s, [label, qty]) => s + (priceMap[label] || 0) * qty, 0)
      }
      // legacy string / array format
      const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
      return sum + choiceDefs
        .filter(c => typeof c === 'object' && selArr.includes(c.label))
        .reduce((s, c) => s + (Number(c.price) || 0), 0)
    }, 0)
  }

  const entryTotal = (entry) => {
    const m    = menu.find(x => x.id === entry.modelId)
    const base = m ? Number(m.sellingPrice || 0) : 0
    const main = entry.qty * (base + calcOptAddOn(entry))
    const side = (entry.sideItems || []).reduce((s, si) => {
      const sm = menu.find(x => x.id === si.modelId)
      return s + (sm ? Number(sm.sellingPrice || 0) : 0) * (si.qty || 1) * entry.qty
    }, 0)
    return main + side
  }

  const totalAmount = cartEntries.reduce((t, e) => t + entryTotal(e), 0)

  const getModelQty = (modelId) =>
    cartEntries.reduce((n, e) => n + (e.modelId === modelId ? e.qty : 0), 0)

  // ── Cart mutations ────────────────────────────────────────────────────
  const createEntry = (model, qty, selectedOptions, itemNotes, rawSides = []) => {
    const id = genUid()
    setCart(prev => ({
      ...prev,
      [id]: { uid: id, modelId: model.id, qty, selectedOptions: selectedOptions || null, itemNotes: itemNotes || null, sideItems: rawSides.map(s => ({ ...s, uid: genUid() })) },
    }))
  }

  const deleteEntry = (uid) =>
    setCart(prev => { const { [uid]: _, ...rest } = prev; return rest })

  const incrementEntry = (uid) =>
    setCart(prev => { const e = prev[uid]; if (!e) return prev; return { ...prev, [uid]: { ...e, qty: e.qty + 1 } } })

  const decrementEntry = (uid) =>
    setCart(prev => {
      const e = prev[uid]; if (!e) return prev
      if (e.qty <= 1) { const { [uid]: _, ...rest } = prev; return rest }
      return { ...prev, [uid]: { ...e, qty: e.qty - 1 } }
    })

  const toggleOption = (uid, groupName, value, multiSelect) =>
    setCart(prev => {
      const e = prev[uid]; if (!e) return prev
      const opts = parseOpts(e.selectedOptions)
      const cur  = opts[groupName]
      if (multiSelect) {
        const arr  = Array.isArray(cur) ? cur : (cur ? [cur] : [])
        const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
        if (next.length) opts[groupName] = next; else delete opts[groupName]
      } else {
        if (cur === value) delete opts[groupName]; else opts[groupName] = value
      }
      return { ...prev, [uid]: { ...e, selectedOptions: Object.keys(opts).length ? JSON.stringify(opts) : null } }
    })

  const setOptionQty = (uid, groupName, label, delta) =>
    setCart(prev => {
      const e = prev[uid]; if (!e) return prev
      const opts = parseOpts(e.selectedOptions)
      const cur = (opts[groupName] && typeof opts[groupName] === 'object' && !Array.isArray(opts[groupName]))
        ? opts[groupName] : {}
      const next = Math.max(0, (cur[label] || 0) + delta)
      const updated = { ...cur }
      if (next === 0) delete updated[label]; else updated[label] = next
      if (Object.keys(updated).length) opts[groupName] = updated; else delete opts[groupName]
      return { ...prev, [uid]: { ...e, selectedOptions: Object.keys(opts).length ? JSON.stringify(opts) : null } }
    })

  const setEntryNotes = (uid, val) =>
    setCart(prev => { const e = prev[uid]; if (!e) return prev; return { ...prev, [uid]: { ...e, itemNotes: val || null } } })

  const setSF = (parentUid, field, value) =>
    setSideForm(prev => ({ ...prev, [parentUid]: { ...(prev[parentUid] || {}), [field]: value } }))

  const addSideInline = (parentUid) => {
    const sf = sideForm[parentUid] || {}
    if (!sf.model) return
    const id = genUid()
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return {
        ...prev,
        [parentUid]: {
          ...parent,
          sideItems: [...(parent.sideItems || []),
            { uid: id, modelId: sf.model.id, modelName: sf.model.modelName, qty: sf.qty || 1 }],
        },
      }
    })
    setSideForm(prev => ({ ...prev, [parentUid]: {} }))
  }

  const changeSideQty = (parentUid, sideUid, delta) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return {
        ...prev,
        [parentUid]: {
          ...parent,
          sideItems: parent.sideItems
            .map(si => si.uid === sideUid ? { ...si, qty: Math.max(0, (si.qty || 1) + delta) } : si)
            .filter(si => si.qty > 0),
        },
      }
    })

  const removeSide = (parentUid, sideUid) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return { ...prev, [parentUid]: { ...parent, sideItems: parent.sideItems.filter(si => si.uid !== sideUid) } }
    })

  // ── Menu card click handlers ──────────────────────────────────────────
  const handleAddClick = (model) => {
    const hasOpts = (optionsByModel[model.id] || []).length > 0
    let allowedSideIds = null
    try { allowedSideIds = model.allowedSideIds ? JSON.parse(model.allowedSideIds) : null } catch { allowedSideIds = null }
    const allowedSideOptions = allowedSideIds ? menu.filter(x => allowedSideIds.includes(x.id)) : []
    const hasSides = allowedSideOptions.length > 0
    if (hasOpts || hasSides) {
      setOptionsTarget({ model, allowedSideOptions })
    } else {
      const existing = cartEntries.find(e => e.modelId === model.id && !e.selectedOptions)
      if (existing) incrementEntry(existing.uid)
      else createEntry(model, 1, null, null)
    }
  }

  const handleRemoveClick = (modelId) => {
    const entries = cartEntries.filter(e => e.modelId === modelId)
    if (!entries.length) return
    decrementEntry([...entries].sort((a, b) => a.qty - b.qty)[0].uid)
  }

  const handleOptionsConfirm = ({ qty, selectedOptions, itemNotes, sideItems }) => {
    if (qty > 0) createEntry(optionsTarget.model, qty, selectedOptions, itemNotes, sideItems || [])
    setOptionsTarget(null)
  }

  // ── Restore cart from an existing order (for edit flow) ──────────────
  const restoreCartFromOrder = (order) => {
    const allItems = order.items || []
    const children = {}
    allItems.forEach(it => {
      if (it.parentItemId) {
        const key = String(it.parentItemId)
        if (!children[key]) children[key] = []
        children[key].push(it)
      }
    })
    const newCart = {}
    allItems.filter(it => !it.parentItemId).forEach(it => {
      const uid = genUid()
      const parentQty = Number(it.quantity) || 1
      const sideItems = (children[String(it.id)] || []).map(child => ({
        uid: genUid(), modelId: child.modelId, modelName: child.modelName,
        qty: Math.max(1, Math.round(Number(child.quantity) / parentQty)),
      }))
      newCart[uid] = { uid, modelId: it.modelId, qty: Number(it.quantity) || 1,
        selectedOptions: it.selectedOptions || null, itemNotes: it.itemNotes || null, sideItems }
    })
    setCart(newCart)
    setSideForm({})
  }

  // ── Build item request array from cart ────────────────────────────────
  const buildItemRequests = () => cartEntries.map(entry => ({
    modelId: entry.modelId,
    quantity: entry.qty,
    selectedOptions: entry.selectedOptions || null,
    itemNotes: entry.itemNotes || null,
    sideItems: (entry.sideItems || []).map(side => ({
      modelId: side.modelId, quantity: side.qty || 1,
      selectedOptions: null, itemNotes: null, sideItems: [],
    })),
  }))

  // ── Order submission ──────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!itemCount) return
    setSubmitting(true); setError('')
    const items = buildItemRequests()
    try {
      if (editingOrderCode) {
        // Update existing order
        const { res, data } = await updatePublicOrderItems(editingOrderCode, items)
        if (!res.ok) { setError(data?.message || data?.error || 'Failed to update order'); setSubmitting(false); return }
        setCart({}); setSideForm({}); setCheckout(false); setCartOpen(false)
        setEditingOrderCode(null)
        setTrackingOrder(data)
      } else {
        // New order
        const body = {
          fulfillmentType: form.fulfillmentType,
          tableId: ctx.tableId || null,
          customerName: form.customerName || null,
          customerPhone: form.customerPhone || null,
          deliveryAddress: form.fulfillmentType === 'DELIVERY' ? form.deliveryAddress : null,
          deliveryFee: null,
          paymentMethod: form.paymentMethod,
          notes: notes || null,
          manualOrderNumber: seqParam ? Number(seqParam) : null,
          token: tokenParam || null,
          items,
        }
        const { res, data } = await createOrder(ctx.tenantId, ctx.companyId, body)
        if (!res.ok) { setError(data?.message || 'Failed to place order'); setSubmitting(false); return }
        setCart({}); setSideForm({}); setNotes(''); setCheckout(false); setCartOpen(false)
        if (shopConfig.prepaidMenu && shopConfig.bankBin && shopConfig.bankAccountNumber) {
          setPrepaidQrOrder(data)
        } else {
          setTrackingOrder(data)
        }
      }
    } catch { setError('Network error') } finally { setSubmitting(false) }
  }

  // ── Customer edit: lock the order and restore cart ────────────────────
  const handleEditOrder = async (order) => {
    try {
      await startCustomerEdit(order.orderCode)
      restoreCartFromOrder(order)
      setEditingOrderCode(order.orderCode)
      setTrackingOrder(null)
      setCartOpen(true)
    } catch (e) {
      setError('Cannot edit order right now')
    }
  }

  const handleCancelEdit = async () => {
    if (!editingOrderCode) return
    try { await cancelCustomerEdit(editingOrderCode) } catch {}
    setCart({}); setSideForm({})
    setEditingOrderCode(null)
    // Reload the order to show current status
    fetchPublicOrder(editingOrderCode)
      .then(({ data }) => { if (data?.orderCode) setTrackingOrder(data) })
      .catch(() => {})
  }

  const grouped = menu.reduce((g, m) => {
    const cat = m.category || 'Menu'
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  // ── Cart entry rows (used in both sidebar and mobile sheet) ───────────
  const CartEntryList = () => (
    <Stack spacing={0.75}>
      {cartEntries.map((entry, idx) => {
        const m      = menu.find(x => x.id === entry.modelId)
        if (!m) return null
        const opts   = parseOpts(entry.selectedOptions)
        const groups = optionsByModel[entry.modelId] || []
        const sf        = sideForm[entry.uid] || {}
        const eTotal    = entryTotal(entry)
        const sides     = entry.sideItems || []
        const unitPrice = Number(m.sellingPrice || 0) + calcOptAddOn(entry)
        const mainTotal = entry.qty * unitPrice
        const sideTotal = eTotal - mainTotal
        let allowedSideIds = null
        try { allowedSideIds = m.allowedSideIds ? JSON.parse(m.allowedSideIds) : null } catch { allowedSideIds = null }
        const allowedSideOptions = allowedSideIds ? menu.filter(x => allowedSideIds.includes(x.id)) : []
        const canAddSides = allowedSideOptions.length > 0

        return (
          <Box key={entry.uid} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>

            {/* ── Main item header ── */}
            <Box sx={{ bgcolor: '#f8faff', px: 1.5, pt: 1, pb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {idx + 1}.
                </Typography>
                {/* Name + unit price stacked */}
                <Box sx={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
                  <Typography fontWeight={700} sx={{ fontSize: 16 }} noWrap>{m.modelName}</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                    {fmt(unitPrice)} / ly
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton onClick={() => decrementEntry(entry.uid)} sx={{ p: 0.75 }}>
                    <RemoveIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                  <Typography fontWeight={800} sx={{ minWidth: 30, textAlign: 'center', fontSize: 18 }}>
                    {entry.qty}
                  </Typography>
                  <IconButton onClick={() => incrementEntry(entry.uid)}
                    sx={{ p: 0.75, bgcolor: '#1976d2', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#1565c0' } }}>
                    <AddIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
                {/* Main item line total (sides shown separately below) */}
                <Typography color="primary" fontWeight={800}
                  sx={{ minWidth: 74, textAlign: 'right', fontSize: 15 }}>
                  {fmt(mainTotal)}
                </Typography>
                <IconButton color="error" onClick={() => deleteEntry(entry.uid)} sx={{ p: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Box>

              {/* Inline option chips / priced steppers */}
              {groups.map(grp => {
                let choices = []
                try { choices = JSON.parse(grp.choices) } catch {}
                if (!choices.length) return null
                const priced = !grp.isFree && hasPrice(grp.choices)
                const cur    = opts[grp.groupName]
                return (
                  <Box key={grp.id} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {grp.groupName}{grp.required ? ' *' : ''}{grp.isFree ? ' (free)' : ''}
                    </Typography>
                    {priced ? (
                      /* Priced topping choices — qty stepper rows */
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                        {choices.map(choice => {
                          const c    = typeof choice === 'object' ? choice : { label: String(choice), price: 0 }
                          const qMap = (cur && typeof cur === 'object' && !Array.isArray(cur)) ? cur : {}
                          const cQty = qMap[c.label] || 0
                          const tag  = c.price > 0 ? ` +${Number(c.price).toLocaleString('vi-VN')}đ` : ''
                          return (
                            <Box key={c.label} sx={{
                              display: 'flex', alignItems: 'center', gap: 1,
                              px: 1, py: 0.5,
                              bgcolor: cQty > 0 ? '#f0f0ff' : '#f8faff',
                              borderRadius: 1.5,
                              border: `1px solid ${cQty > 0 ? '#6366f1' : '#e2e8f0'}`,
                            }}>
                              <Typography sx={{ flex: 1, fontSize: 13, fontWeight: cQty > 0 ? 700 : 400, color: cQty > 0 ? '#1e293b' : '#64748b' }} noWrap>
                                {c.label}{tag}
                              </Typography>
                              {cQty === 0 ? (
                                <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, 1)}
                                  sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                  <AddIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                  <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, -1)}
                                    sx={{ p: 0.5, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                                    <RemoveIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                  <Typography fontWeight={800} sx={{ minWidth: 22, textAlign: 'center', fontSize: 15, color: '#4f46e5' }}>
                                    {cQty}
                                  </Typography>
                                  <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, 1)}
                                    sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                    <AddIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Box>
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    ) : (
                      /* Non-priced choices — chips */
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                        {choices.map(choice => {
                          const c      = typeof choice === 'object' ? choice : { label: String(choice), price: 0 }
                          const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
                          const active = selArr.includes(c.label)
                          return (
                            <Chip key={c.label} label={c.label} size="small"
                              onClick={() => toggleOption(entry.uid, grp.groupName, c.label, grp.multiSelect)}
                              sx={{
                                height: 30, fontSize: 13, cursor: 'pointer',
                                bgcolor: active ? '#1976d2' : '#fff',
                                color: active ? '#fff' : '#555',
                                border: `1px solid ${active ? '#1976d2' : '#ddd'}`,
                                fontWeight: active ? 700 : 400,
                                '&:hover': { bgcolor: active ? '#1565c0' : '#f0f4ff' },
                              }} />
                          )
                        })}
                      </Box>
                    )}
                  </Box>
                )
              })}

              {/* Inline item notes */}
              <TextField size="small" variant="standard" fullWidth
                placeholder="Item note (e.g. no sugar, extra spicy…)"
                value={entry.itemNotes || ''}
                onChange={e => setEntryNotes(entry.uid, e.target.value)}
                InputProps={{
                  disableUnderline: false,
                  startAdornment: <InputAdornment position="start"><NoteAltIcon sx={{ fontSize: 16, color: '#ccc' }} /></InputAdornment>,
                  sx: { fontSize: 14 },
                }}
                sx={{ mt: 0.5 }}
              />
            </Box>

            {/* ── Side items tree ── */}
            <Box sx={{ bgcolor: '#f0f4ff', borderTop: '1px solid #e2e8f0' }}>
              <Box sx={{ ml: 1.5, borderLeft: '2px solid #c7d2fe' }}>

                {/* Existing side items */}
                {sides.map((si, siIdx) => {
                  const sm = menu.find(x => x.id === si.modelId)
                  const perCup         = si.qty || 1
                  const effectiveQty   = perCup * entry.qty
                  const effectivePrice = sm ? effectiveQty * Number(sm.sellingPrice || 0) : 0
                  return (
                    <Box key={si.uid} sx={{ px: 1, py: 1, borderBottom: '1px solid #e8eaf6' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Thumbnail */}
                        <Box sx={{
                          width: 52, height: 52, flexShrink: 0, borderRadius: 1.5,
                          bgcolor: '#e8eaf6', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {sm?.imageUrl ? (
                            <Box component="img" src={sm.imageUrl} alt={si.modelName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.style.display = 'none' }} />
                          ) : (
                            <Typography sx={{ fontSize: 24, lineHeight: 1 }}>🧋</Typography>
                          )}
                        </Box>
                        {/* Name + scale hint */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} sx={{ fontSize: 14, color: '#334155' }} noWrap>
                            {si.modelName}
                          </Typography>
                          {entry.qty > 1 ? (
                            <Typography sx={{ color: '#a5b4fc', fontSize: 12 }}>
                              {perCup}/ly × {entry.qty} ly = {effectiveQty}×
                            </Typography>
                          ) : (
                            <Typography sx={{ color: '#6366f1', fontSize: 13, fontWeight: 700 }}>
                              {sm ? fmt(effectivePrice) : ''}
                            </Typography>
                          )}
                        </Box>
                        {/* Stepper */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                          <IconButton onClick={() => changeSideQty(entry.uid, si.uid, -1)}
                            sx={{ p: 0.75, color: '#94a3b8', bgcolor: '#f1f5f9', borderRadius: 1 }}>
                            <RemoveIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                          <Typography fontWeight={800} sx={{ minWidth: 28, textAlign: 'center', fontSize: 18, color: '#4f46e5' }}>
                            {perCup}
                          </Typography>
                          <IconButton onClick={() => changeSideQty(entry.uid, si.uid, 1)}
                            sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                            <AddIcon sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Box>
                        {/* Price shown on right when parent > 1 cup */}
                        {entry.qty > 1 && (
                          <Typography fontWeight={700} sx={{ minWidth: 68, textAlign: 'right', fontSize: 14, color: '#4f46e5', flexShrink: 0 }}>
                            {sm ? fmt(effectivePrice) : ''}
                          </Typography>
                        )}
                        <IconButton onClick={() => removeSide(entry.uid, si.uid)}
                          sx={{ p: 0.5, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                          <CloseIcon sx={{ fontSize: 22 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  )
                })}

                {/* Block total — only shown when there are side items */}
                {sides.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, py: 0.75, borderTop: '1px dashed #c7d2fe' }}>
                    <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                      {fmt(mainTotal)} + {fmt(sideTotal)} topping
                    </Typography>
                    <Typography fontWeight={800} color="primary" sx={{ fontSize: 15 }}>
                      = {fmt(eTotal)}
                    </Typography>
                  </Box>
                )}

                {/* Add side inline form — only shown when the item has configured allowed sides */}
                {canAddSides && (
                <Box sx={{ pt: 0.75, pb: 1, px: 1 }}>
                  <Autocomplete
                    size="small"
                    options={allowedSideOptions}
                    getOptionLabel={m => m.modelName}
                    value={sf.model || null}
                    onChange={(_, v) => setSF(entry.uid, 'model', v)}
                    renderInput={params => <TextField {...params} label="Add topping / side…" size="small" />}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    noOptionsText="No items"
                    fullWidth
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Typography sx={{ color: '#a5b4fc', fontSize: 13, flexShrink: 0 }}>
                      /ly
                    </Typography>
                    <IconButton
                      onClick={() => setSF(entry.uid, 'qty', Math.max(1, (sf.qty || 1) - 1))}
                      sx={{ p: 0.75, bgcolor: '#f1f5f9', color: '#64748b', borderRadius: 1, flexShrink: 0 }}>
                      <RemoveIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                    <Typography fontWeight={800} sx={{ minWidth: 28, textAlign: 'center', fontSize: 18, color: '#4f46e5', flexShrink: 0 }}>
                      {sf.qty || 1}
                    </Typography>
                    <IconButton
                      onClick={() => setSF(entry.uid, 'qty', (sf.qty || 1) + 1)}
                      sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, flexShrink: 0, '&:hover': { bgcolor: '#4f46e5' } }}>
                      <AddIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                    {entry.qty > 1 && (sf.qty || 1) > 0 && (
                      <Typography sx={{ color: '#94a3b8', fontSize: 12, flexShrink: 0 }}>
                        = {(sf.qty || 1) * entry.qty}× total
                      </Typography>
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Button variant="contained"
                      startIcon={<PlaylistAddIcon />}
                      onClick={() => addSideInline(entry.uid)}
                      disabled={!sf.model}
                      sx={{
                        textTransform: 'none', fontSize: 14, height: 44, flexShrink: 0,
                        bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' },
                        '&.Mui-disabled': { bgcolor: '#e0e0e0', color: '#9e9e9e' },
                      }}>
                      Add
                    </Button>
                  </Box>
                </Box>
                )}

              </Box>
            </Box>
          </Box>
        )
      })}
    </Stack>
  )

  // ── Cart panel ────────────────────────────────────────────────────────
  const CartPanel = ({ onCheckout }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6" fontWeight={800}>Your Order</Typography>

      {itemCount === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
          <ShoppingCartIcon sx={{ fontSize: 36, mb: 0.5, opacity: 0.3 }} />
          <Typography variant="body2">Add items to start your order</Typography>
        </Box>
      ) : (
        <>
          <CartEntryList />

          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography fontWeight={700} sx={{ fontSize: 17 }}>Total</Typography>
            <Typography fontWeight={900} color="primary" sx={{ fontSize: 18 }}>{fmt(totalAmount)}</Typography>
          </Box>

          <TextField size="small" fullWidth multiline rows={2} label="Order notes" placeholder="Special requests..."
            value={notes} onChange={e => setNotes(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />

          <Button variant="contained" fullWidth size="large" onClick={onCheckout}
            sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', fontSize: 15 }}>
            Checkout · {fmt(totalAmount)}
          </Button>
        </>
      )}
    </Box>
  )

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (!ctx?.tenantId || !ctx?.companyId) return (
    <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Invalid QR code — missing shop context.'}</Alert></Box>
  )

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}>

      {/* ── Top banner ──────────────────────────────────────── */}
      <Box sx={{ background: 'linear-gradient(135deg, #1565c0 0%, #0288d1 100%)', color: '#fff', px: 2.5, py: { xs: 2.5, md: 3 }, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} letterSpacing={1}>Order</Typography>
        {ctx.tableId && (
          <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 14 }} />}
            label="Dine In" size="small"
            sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

      <Box sx={{
        display: { xs: 'block', md: 'flex' },
        alignItems: 'flex-start',
        maxWidth: { md: 1100 },
        mx: 'auto',
        px: { xs: 0, md: 2 },
        pt: { xs: 0, md: 2 },
        gap: 3,
      }}>

        {/* ── Menu grid ─────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0, px: { xs: 1.5, md: 0 }, pt: { xs: 1.5, md: 0 }, pb: { xs: 16, md: 4 } }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 3 }}>
              <Typography variant="overline" fontWeight={700} color="primary"
                sx={{ letterSpacing: 1.5, display: 'block', mb: 1 }}>{cat}</Typography>
              <Stack spacing={1}>
                {items.map(m => {
                  const qty      = getModelQty(m.id)
                  const hasOpts  = (optionsByModel[m.id] || []).length > 0
                  const variants = cartEntries.filter(e => e.modelId === m.id)
                  const solo     = variants.length === 1 ? variants[0] : null
                  const optsStr  = fmtOpts(solo?.selectedOptions)
                  const noteStr  = solo?.itemNotes
                  return (
                    <Card key={m.id} elevation={0} sx={{
                      borderRadius: 2,
                      border: qty > 0 ? '1.5px solid #1976d2' : '1px solid #e8e8e8',
                      bgcolor: '#fff', transition: 'border-color 0.15s', overflow: 'hidden',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Thumbnail — always present; grey placeholder when no image */}
                        <Box sx={{
                          width: { xs: 88, md: 96 }, height: { xs: 88, md: 96 },
                          flexShrink: 0, bgcolor: '#f0f0f0', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {m.imageUrl ? (
                            <Box component="img" src={m.imageUrl} alt={m.modelName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = '#e8eaf6' }} />
                          ) : (
                            <Typography sx={{ fontSize: 28, lineHeight: 1, userSelect: 'none', opacity: 0.25 }}>🍽</Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1, px: 1.5, py: 1.25 }}>
                          <Typography
                            fontWeight={800}
                            lineHeight={1.25}
                            sx={{ fontSize: { xs: 15, md: 16 }, letterSpacing: 0 }}>
                            {m.modelName}
                          </Typography>
                          <Typography
                            color="primary" fontWeight={700}
                            sx={{ mt: 0.4, fontSize: { xs: 14, md: 15 } }}>
                            {fmt(m.sellingPrice)}
                          </Typography>
                          {hasOpts && (
                            <Chip icon={<TuneIcon sx={{ fontSize: '12px !important' }} />} label="customizable"
                              size="small" variant="outlined"
                              sx={{ mt: 0.5, fontSize: 10, height: 18, color: 'text.secondary', borderColor: '#ddd' }} />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1 }}>
                          {qty > 0 && (
                            <>
                              <IconButton size="small" onClick={() => handleRemoveClick(m.id)}
                                sx={{ bgcolor: '#f0f0f0', '&:hover': { bgcolor: '#e0e0e0' } }}>
                                <RemoveIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 22, textAlign: 'center' }}>{qty}</Typography>
                            </>
                          )}
                          <IconButton size="small" onClick={() => handleAddClick(m)}
                            sx={{ bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}>
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>

                      {variants.length > 1 && (
                        <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#e3f2fd', borderTop: '1px solid #bbdefb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="primary">
                            {variants.length} variations in cart
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 700, display: { xs: 'inline', md: 'none' } }}
                            onClick={() => setCartOpen(true)}>
                            Edit →
                          </Typography>
                        </Box>
                      )}

                      {solo && (optsStr || noteStr) && (
                        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#e3f2fd', borderTop: '1px solid #bbdefb', display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Box sx={{ flex: 1 }}>
                            {optsStr && <Typography variant="caption" color="primary" display="block" noWrap>{optsStr}</Typography>}
                            {noteStr && <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontStyle: 'italic' }}>{noteStr}</Typography>}
                          </Box>
                          <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 700, display: { xs: 'inline', md: 'none' } }}
                            onClick={() => setCartOpen(true)}>
                            Edit →
                          </Typography>
                        </Box>
                      )}
                    </Card>
                  )
                })}
              </Stack>
            </Box>
          ))}
        </Box>

        {/* ── Desktop right sidebar ──────────────────────────── */}
        <Box sx={{
          display: { xs: 'none', md: 'block' },
          width: 380, flexShrink: 0,
          position: 'sticky', top: 16,
          bgcolor: '#fff', borderRadius: 3,
          border: '1px solid #e8e8e8',
          p: 2.5,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
        }}>
          {tokenSession?.orders?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <ShowOrdersButton session={tokenSession} onClick={() => setSessionOpen(true)} fullWidth />
            </Box>
          )}
          <CartPanel onCheckout={() => setCheckout(true)} />
        </Box>
      </Box>

      {/* ── Mobile bottom bar ──────────────────────────────────── */}
      {(itemCount > 0 || (tokenSession?.orders?.length > 0)) && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          borderTop: '1px solid #e0e0e0', bgcolor: '#fff',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.10)',
          alignItems: 'center', gap: 1, px: 2, py: 1.25,
          flexWrap: 'wrap',
        }}>
          {tokenSession?.orders?.length > 0 && (
            <ShowOrdersButton session={tokenSession} onClick={() => setSessionOpen(true)} />
          )}
          {itemCount > 0 && <>
            <Button variant="outlined" size="medium" onClick={() => setCartOpen(true)}
              startIcon={<ShoppingCartIcon />}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', flexShrink: 0 }}>
              Cart ({itemCount})
            </Button>
            {editingOrderCode && (
              <Button variant="text" size="small" onClick={handleCancelEdit}
                sx={{ textTransform: 'none', color: '#ef4444', flexShrink: 0, fontWeight: 600, fontSize: 12 }}>
                Cancel edit
              </Button>
            )}
            <Button variant="contained" size="medium" fullWidth onClick={() => setCheckout(true)}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none',
                bgcolor: editingOrderCode ? '#f59e0b' : undefined,
                '&:hover': { bgcolor: editingOrderCode ? '#d97706' : undefined } }}>
              {editingOrderCode ? `Update Order · ${fmt(totalAmount)}` : `Checkout · ${fmt(totalAmount)}`}
            </Button>
          </>}
        </Box>
      )}

      {/* ── Mobile cart bottom sheet ──────────────────────────── */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0, borderRadius: '16px 16px 0 0', maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1 }}>
          <Typography fontWeight={800} variant="h6" sx={{ flex: 1 }}>Your Cart</Typography>
          <IconButton size="small" onClick={() => setCartOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <CartPanel onCheckout={() => { setCartOpen(false); setCheckout(true) }} />
        </DialogContent>
      </Dialog>

      {/* ── Session orders dialog ───────────────────────────────── */}
      {/* ── Prepaid payment QR ──────────────────────────────────── */}
      {prepaidQrOrder && (() => {
        const amount = Math.round(Number(prepaidQrOrder.totalAmount || 0))
        const qrUrl = shopConfig.bankBin && shopConfig.bankAccountNumber
          ? `https://img.vietqr.io/image/${shopConfig.bankBin}-${shopConfig.bankAccountNumber}-qr_only.png`
            + `?amount=${amount}&addInfo=${encodeURIComponent(prepaidQrOrder.orderCode)}`
            + `&accountName=${encodeURIComponent(shopConfig.bankAccountName || '')}`
          : null
        const orderNum = prepaidQrOrder.orderNumber ? `#${prepaidQrOrder.orderNumber}` : prepaidQrOrder.orderCode
        return (
          <Dialog open fullWidth maxWidth="xs"
            PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ textAlign: 'center', pb: 0.5, pt: 2.5, fontWeight: 900, fontSize: 20 }}>
              Pay to confirm order {orderNum}
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center', pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Scan the QR below to pay. Your order will be confirmed after payment is received.
              </Typography>
              {qrUrl ? (
                <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '2px solid #1976d2', mb: 1.5 }}>
                  <img src={qrUrl} alt="Payment QR" style={{ width: 220, height: 220, display: 'block', borderRadius: 6 }} />
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mb: 1.5 }}>Bank account not configured — please pay at counter.</Alert>
              )}
              <Typography variant="h5" fontWeight={900} color="primary">{fmt(prepaidQrOrder.totalAmount)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Ref: <strong>{prepaidQrOrder.orderCode}</strong>
                {shopConfig.bankAccountName ? ` · ${shopConfig.bankAccountName}` : ''}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: 'column', gap: 1 }}>
              <Button variant="contained" fullWidth size="large"
                onClick={() => { setPrepaidQrOrder(null); setTrackingOrder(prepaidQrOrder) }}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2 }}>
                I've paid — Track my order
              </Button>
              <Button fullWidth size="small" color="inherit"
                onClick={() => { setPrepaidQrOrder(null); setTrackingOrder(prepaidQrOrder) }}
                sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Pay later / close
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      <Dialog open={sessionOpen} onClose={() => setSessionOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0, borderRadius: '16px 16px 0 0', maxHeight: '88vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1, pt: 2 }}>
          <ReceiptLongIcon sx={{ mr: 1, color: '#6366f1' }} />
          <Typography fontWeight={800} variant="h6" sx={{ flex: 1 }}>
            Your Orders
            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              ({tokenSession?.orders?.length ?? 0})
            </Typography>
          </Typography>
          <IconButton size="small" onClick={() => setSessionOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto', px: 2, pb: 3 }}>
          <SessionOrderList
            session={tokenSession}
            token={tokenParam}
            onEdit={(order) => { setSessionOpen(false); handleEditOrder(order) }}
            onClose={() => setSessionOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Checkout dialog ──────────────────────────────────────── */}
      <Dialog open={checkout} onClose={() => setCheckout(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={700} variant="h6">Place Order</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>Order type</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {FULFILLMENT_OPTIONS.map(opt => (
                  <Box key={opt.value} onClick={() => setForm(f => ({ ...f, fulfillmentType: opt.value }))} sx={{
                    flex: 1, border: '1.5px solid', borderRadius: 2, py: 1, px: 0.5, textAlign: 'center', cursor: 'pointer',
                    borderColor: form.fulfillmentType === opt.value ? 'primary.main' : '#e0e0e0',
                    bgcolor: form.fulfillmentType === opt.value ? '#e3f2fd' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <Box sx={{ color: form.fulfillmentType === opt.value ? 'primary.main' : 'text.secondary' }}>{opt.icon}</Box>
                    <Typography variant="caption" fontWeight={600}
                      color={form.fulfillmentType === opt.value ? 'primary.main' : 'text.secondary'}>{opt.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <TextField label="Your name" size="small" fullWidth value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            <TextField label="Phone" size="small" fullWidth type="tel" value={form.customerPhone}
              onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
            {form.fulfillmentType === 'DELIVERY' && (
              <TextField label="Delivery address" size="small" fullWidth multiline rows={2}
                value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} />
            )}
            <TextField label="Order notes" size="small" fullWidth multiline rows={2}
              placeholder="Delivery instructions, special requests..."
              value={notes} onChange={e => setNotes(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Payment</InputLabel>
              <Select value={form.paymentMethod} label="Payment"
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="BANK_QR">Bank QR</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Your order</Typography>
              {cartEntries.map((entry, idx) => {
                const m       = menu.find(x => x.id === entry.modelId)
                if (!m) return null
                const optsStr = fmtOpts(entry.selectedOptions)
                const sides   = entry.sideItems || []
                const unitPrice = Number(m.sellingPrice || 0) + calcOptAddOn(entry)
                const mainTotal = entry.qty * unitPrice
                const sideTotal = sides.reduce((s, si) => {
                  const sm = menu.find(x => x.id === si.modelId)
                  return s + (si.qty || 1) * Number(sm?.sellingPrice || 0) * entry.qty
                }, 0)
                return (
                  <Box key={entry.uid} sx={{ mb: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight={700}>{idx + 1}. {entry.qty}× {m.modelName}</Typography>
                      <Typography variant="body2" color="primary" fontWeight={700}>{fmt(mainTotal)}</Typography>
                    </Box>
                    {optsStr && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>{optsStr}</Typography>
                    )}
                    {entry.itemNotes && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block', fontStyle: 'italic' }}>
                        Note: {entry.itemNotes}
                      </Typography>
                    )}
                    {sides.map((side, siIdx) => {
                      const sm = menu.find(x => x.id === side.modelId)
                      if (!sm) return null
                      const perCup   = side.qty || 1
                      const effQty   = perCup * entry.qty
                      const effPrice = effQty * Number(sm.sellingPrice || 0)
                      return (
                        <Box key={side.uid} sx={{ pl: 1.5, mb: 0.25 }}>
                          {/* Single row: number · name · stepper · price */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Typography sx={{ color: '#94a3b8', fontSize: 12, flexShrink: 0, minWidth: 24 }}>
                              {idx + 1}.{siIdx + 1}
                            </Typography>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ display: 'block', fontSize: 14, fontWeight: 600 }} noWrap>
                                {sm.modelName}
                              </Typography>
                              {entry.qty > 1 && (
                                <Typography sx={{ color: '#a5b4fc', fontSize: 12 }}>
                                  {perCup}/ly × {entry.qty} = {effQty}×
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                              <IconButton onClick={() => changeSideQty(entry.uid, side.uid, -1)}
                                sx={{ p: 0.75, color: '#94a3b8', bgcolor: '#f1f5f9', borderRadius: 1 }}>
                                <RemoveIcon sx={{ fontSize: 20 }} />
                              </IconButton>
                              <Typography fontWeight={800} sx={{ minWidth: 28, textAlign: 'center', fontSize: 17, color: '#4f46e5' }}>
                                {perCup}
                              </Typography>
                              <IconButton onClick={() => changeSideQty(entry.uid, side.uid, 1)}
                                sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                <AddIcon sx={{ fontSize: 20 }} />
                              </IconButton>
                            </Box>
                            <Typography color="primary" fontWeight={700} sx={{ minWidth: 60, textAlign: 'right', flexShrink: 0, fontSize: 14 }}>
                              {fmt(effPrice)}
                            </Typography>
                          </Box>
                        </Box>
                      )
                    })}
                    {sides.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 1.5, borderTop: '1px dotted #e2e8f0', mt: 0.5, pt: 0.5 }}>
                        <Typography sx={{ color: '#64748b', fontStyle: 'italic', fontSize: 13 }}>= subtotal</Typography>
                        <Typography fontWeight={900} color="primary" sx={{ fontSize: 14 }}>{fmt(mainTotal + sideTotal)}</Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
              <Divider sx={{ my: 0.75 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography fontWeight={700}>Total</Typography>
                <Typography fontWeight={700} color="primary">{fmt(totalAmount)}</Typography>
              </Box>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setCheckout(false)} disabled={submitting}>Back</Button>
          <Button variant="contained" fullWidth onClick={handlePlaceOrder} disabled={submitting}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            {submitting ? <CircularProgress size={20} /> :
              editingOrderCode ? `Update Order · ${fmt(totalAmount)}` : `Confirm Order · ${fmt(totalAmount)}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Inline order tracking (replaces navigate-away) ────────── */}
      {trackingOrder && (
        <TrackingOverlay
          order={trackingOrder}
          ctx={ctx}
          onEdit={handleEditOrder}
          onOrderMore={() => {
            if (trackingOrder?.orderCode) {
              const tSuffix = tokenParam ? `?t=${encodeURIComponent(tokenParam)}` : ''
              window.open(
                window.location.origin + '/bom-inventory/shop/order/' + encodeURIComponent(trackingOrder.orderCode) + tSuffix,
                '_blank'
              )
            }
            setTrackingOrder(null)
          }}
          onUpdated={setTrackingOrder}
        />
      )}

      {/* ── Table occupied dialog ────────────────────────────────── */}
      <Dialog open={Boolean(tableOrders)} onClose={() => setTableOrders(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableRestaurantIcon color="warning" />
            <Typography fontWeight={700}>Table has active orders</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            This table already has {tableOrders?.length} active order{tableOrders?.length !== 1 ? 's' : ''}.
            Are you ordering for this group?
          </Typography>
          {(tableOrders || []).slice(0, 3).map(o => (
            <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 1.25, py: 0.75, mb: 0.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" fontWeight={700}>
                {o.orderNumber ? `#${o.orderNumber}` : o.orderCode}
              </Typography>
              <Chip label={o.status} size="small"
                color={o.status === 'READY' ? 'success' : o.status === 'PREPARING' ? 'warning' : 'default'} />
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setTableOrders(null)} variant="outlined" sx={{ flex: 1, textTransform: 'none' }}>
            Add New Order
          </Button>
          <Button
            variant="contained" color="warning"
            onClick={() => {
              // Show the most recent active order for this table
              const latest = tableOrders?.[tableOrders.length - 1]
              if (latest) setTrackingOrder(latest)
              setTableOrders(null)
            }}
            sx={{ flex: 1, textTransform: 'none' }}>
            View Orders
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Options dialog (initial add for items with configurable options) ── */}
      {optionsTarget && (
        <ItemOptionsDialog
          open={Boolean(optionsTarget)}
          model={optionsTarget.model}
          options={optionsByModel[optionsTarget.model?.id] || []}
          allowedSideOptions={optionsTarget.allowedSideOptions || []}
          initialCart={null}
          onConfirm={handleOptionsConfirm}
          onClose={() => setOptionsTarget(null)}
        />
      )}
    </Box>
  )
}
