import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
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
import SearchIcon from '@mui/icons-material/Search'
import GridViewIcon from '@mui/icons-material/GridView'
import ViewListIcon from '@mui/icons-material/ViewList'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Snackbar from '@mui/material/Snackbar'
import { resolveToken, fetchMenu, createOrder, fetchPublicMenuOptions,
         fetchActiveTableOrders, startCustomerEdit, cancelCustomerEdit,
         updatePublicOrderItems, fetchPublicOrder, fetchTokenSession,
         cancelPublicOrder, fetchShopConfig, callStaff } from '../../api/shopApi'
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
  PENDING:   { label: 'Chờ xác nhận', color: 'default' },
  CONFIRMED: { label: 'Đã xác nhận',  color: 'success' },
  PREPARING: { label: 'Đang chế biến', color: 'warning' },
  READY:     { label: 'Sẵn sàng!',    color: 'info'    },
  PICKED_UP: { label: 'Đã nhận',      color: 'success' },
  COMPLETED: { label: 'Hoàn thành',   color: 'success' },
  CANCELLED: { label: 'Đã huỷ',       color: 'error'   },
}

function SessionOrderList({ session, token, onEdit, onView }) {
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelNote, setCancelNote]     = useState('')
  const [cancelling, setCancelling]     = useState(false)
  const [cancelError, setCancelError]   = useState('')

  const orders = (session?.orders || []).filter(o => o.status !== 'CANCELLED')

  const doCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true); setCancelError('')
    try {
      const { res, data } = await cancelPublicOrder(cancelTarget.orderCode, cancelNote)
      if (!res.ok) { setCancelError(data?.error || 'Không thể huỷ'); setCancelling(false); return }
      setCancelTarget(null); setCancelNote('')
    } catch { setCancelError('Lỗi mạng') }
    setCancelling(false)
  }

  if (!orders.length) return (
    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
      <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
      <Typography>Chưa có đơn hàng nào</Typography>
    </Box>
  )

  const grandTotal = orders.reduce((s, o) => s + Number(o.totalAmount || 0), 0)

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2 }}>
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
              border: editing ? '2px solid #f59e0b' : '1px solid #e8e8e8',
              borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                bgcolor: editing ? '#fef3c7' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <Typography fontWeight={900} sx={{ fontSize: 18, color: editing ? '#b45309' : '#1a1a1a' }}>
                  {displayNum}
                </Typography>
                <Chip label={chip.label} color={chip.color} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
                {editing && (
                  <Chip label="Đang sửa" size="small"
                    sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 10 }} />
                )}
                <Box sx={{ flex: 1 }} />
                <Typography fontWeight={800} color="primary" sx={{ fontSize: 14 }}>
                  {fmt(order.totalAmount)}
                </Typography>
              </Box>

              <Box sx={{ px: 2, py: 1 }}>
                {roots.slice(0, 4).map((item) => (
                  <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                    <Typography variant="caption" sx={{ color: '#ff5722', fontWeight: 700, flexShrink: 0 }}>
                      ×{item.quantity}
                    </Typography>
                    <Typography variant="caption" sx={{ flex: 1, color: '#333' }} noWrap>
                      {item.modelName}
                    </Typography>
                    <Chip label={chip.label} color={chip.color} size="small"
                      sx={{ height: 16, fontSize: 10, fontWeight: 600 }} />
                  </Box>
                ))}
                {roots.length > 4 && (
                  <Typography variant="caption" color="text.secondary">+{roots.length - 4} món khác…</Typography>
                )}
              </Box>

              <Box sx={{ px: 2, pb: 1.25, pt: 0.25, display: 'flex', gap: 1 }}>
                {isPending && (
                  <Button variant={editing ? 'contained' : 'outlined'} size="small"
                    color={editing ? 'warning' : 'primary'}
                    onClick={() => onEdit(order)}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20, flex: 1 }}>
                    {editing ? '✏ Tiếp tục sửa' : 'Sửa đơn'}
                  </Button>
                )}
                <Button variant="outlined" size="small" onClick={() => onView && onView(order)}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20, flexShrink: 0 }}>
                  Xem
                </Button>
                {isPending && !isPaid && (
                  <Button variant="outlined" size="small" color="error"
                    onClick={() => { setCancelTarget(order); setCancelNote(''); setCancelError('') }}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20, flexShrink: 0 }}>
                    Huỷ
                  </Button>
                )}
                {isPaid && (
                  <Chip label="Đã thanh toán ✓" color="success" size="small"
                    sx={{ fontWeight: 700, fontSize: 11, alignSelf: 'center' }} />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>

      {orders.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: '1.5px solid #e0e0e0', mx: -2, px: 2 }}>
          <Typography fontWeight={700} sx={{ color: '#555' }}>Cần thanh toán ({orders.length} đơn)</Typography>
          <Typography fontWeight={900} color="primary" sx={{ fontSize: 17 }}>{fmt(grandTotal)}</Typography>
        </Box>
      )}

      <Dialog open={Boolean(cancelTarget)} onClose={() => !cancelling && setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Huỷ đơn này?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Đơn <strong>{cancelTarget?.orderNumber ? `#${cancelTarget.orderNumber}` : cancelTarget?.orderCode}</strong> sẽ bị huỷ và không thể khôi phục.
          </Typography>
          <TextField fullWidth size="small" multiline rows={2} label="Lý do (tuỳ chọn)"
            value={cancelNote} onChange={e => setCancelNote(e.target.value)} disabled={cancelling} />
          {cancelError && <Alert severity="error" sx={{ mt: 1.5 }}>{cancelError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling}>Giữ đơn</Button>
          <Button variant="contained" color="error" onClick={doCancel} disabled={cancelling}
            sx={{ fontWeight: 700, minWidth: 120, borderRadius: 20 }}>
            {cancelling ? <CircularProgress size={18} color="inherit" /> : 'Xác nhận huỷ'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function TrackingOverlay({ order: initialOrder, ctx, onEdit, onOrderMore, onUpdated }) {
  const [order, setOrder] = React.useState(initialOrder)
  const fmtLocal = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

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
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 2000, bgcolor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ bgcolor: style.bg, textAlign: 'center', px: 2, pt: 5, pb: 3, flexShrink: 0 }}>
        <Typography sx={{ fontSize: { xs: 80, md: 110 }, fontWeight: 900, lineHeight: 1, color: style.color, letterSpacing: -4 }}>
          {order.dailySeq ?? order.orderNumber ?? '—'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: style.color, opacity: 0.55, mt: 0.75 }}>
          {order.orderNumber ? `Đơn #${order.orderNumber}` : ''}{order.orderCode ? ` · ${order.orderCode}` : ''}
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
        {order.customerEditing && (
          <Box sx={{ mt: 1 }}>
            <Chip label="✏ Đang sửa đơn…" size="small" color="warning" sx={{ fontWeight: 700 }} />
          </Box>
        )}
      </Box>

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
                    <Box sx={{ height: 2, flex: 1, mt: '13px', mb: 'auto', bgcolor: idx < activeIdx ? '#a5d6a7' : '#eee', borderRadius: 2 }} />
                  )}
                </React.Fragment>
              )
            })}
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 1.5 }}>
        {rootItems.map((item, idx) => {
          const children = childMap[String(item.id)] || []
          return (
            <Box key={item.id || idx} sx={{ mb: 1, pb: 1, borderBottom: '1px solid #f0f0f0' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="body2" fontWeight={700}>{Number(item.quantity)}× {item.modelName}</Typography>
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
          <Typography fontWeight={700}>Tổng cộng</Typography>
          <Typography fontWeight={900} color="primary">{fmtLocal(order.totalAmount)}</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 2, pb: 3, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0, borderTop: '1px solid #f0f0f0' }}>
        {isPending && !order.customerEditing && (
          <Button variant="outlined" fullWidth startIcon={<EditNoteIcon />} onClick={() => onEdit(order)}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none', borderColor: '#f59e0b', color: '#b45309' }}>
            Sửa đơn
          </Button>
        )}
        {!isDone && !isCancelled && (
          <Button variant="outlined" fullWidth startIcon={<AddShoppingCartIcon />} onClick={onOrderMore}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none' }}>
            {ctx?.tableId ? 'Gọi thêm cho bàn này' : 'Đặt thêm'}
          </Button>
        )}
        {(isDone || isCancelled) && (
          <Button variant="contained" fullWidth onClick={onOrderMore}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none', bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' } }}>
            Đặt đơn mới
          </Button>
        )}
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {order.orderCode} · tự động cập nhật mỗi 5 giây
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
  const [trackingOrder, setTrackingOrder]   = useState(null)
  const [editingOrderCode, setEditingOrderCode] = useState(null)
  const [tableOrders, setTableOrders]       = useState(null)
  const [tokenSession, setTokenSession]     = useState(null)
  const [sessionOpen, setSessionOpen]       = useState(false)
  const [shopConfig, setShopConfig]         = useState({ prepaidMenu: false, bankBin: '', bankAccountNumber: '', bankAccountName: '' })
  const [prepaidQrOrder, setPrepaidQrOrder] = useState(null)
  const [imagePreview, setImagePreview]     = useState(null)
  const [form, setForm] = useState({
    fulfillmentType: 'PICKUP', customerName: '', customerPhone: '',
    deliveryAddress: '', paymentMethod: 'CASH',
  })

  // ── New UI state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState('')
  const [gridView, setGridView]               = useState(false)
  const [activeCategory, setActiveCategory]   = useState(null)
  const [callStaffOpen, setCallStaffOpen]       = useState(false)
  const [callStaffReason, setCallStaffReason]   = useState('payment')
  const [callStaffNote, setCallStaffNote]       = useState('')
  const [callStaffDone, setCallStaffDone]       = useState(false)
  const [callStaffLoading, setCallStaffLoading] = useState(false)
  const headerRef    = useRef(null)
  const [headerH, setHeaderH] = useState(165)
  const categoryRefs = useRef({})

  const [cart, setCart] = useState({})
  const [sideForm, setSideForm] = useState({})
  const [optionsTarget, setOptionsTarget] = useState(null)

  // ── Data loading ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tokenParam) return
    resolveToken(tokenParam)
      .then(({ res, data }) => {
        if (!res.ok) { setError('QR code không hợp lệ hoặc đã hết hạn.'); setLoading(false); return }
        const resolved = { tenantId: data.tenantId, companyId: data.companyId, tableId: data.tableId }
        setCtx(resolved)
        if (resolved.tableId) {
          setForm(f => ({ ...f, fulfillmentType: 'DINE_IN' }))
          fetchActiveTableOrders(resolved.tableId, resolved.tenantId, resolved.companyId)
            .then(({ data: orders }) => { if (Array.isArray(orders) && orders.length > 0) setTableOrders(orders) })
            .catch(() => {})
        }
      })
      .catch(() => { setError('Không đọc được QR code.'); setLoading(false) })
  }, [tokenParam])

  useEffect(() => {
    if (!ctx) return
    if (!ctx.tenantId || !ctx.companyId) { setError('Thiếu thông tin cửa hàng.'); setLoading(false); return }
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
    }).catch(() => { setError('Không tải được thực đơn.'); setLoading(false) })
  }, [ctx])

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

  useEffect(() => {
    if (!editOrderCode || loading) return
    fetchPublicOrder(editOrderCode)
      .then(async ({ data }) => {
        if (!data?.orderCode) return
        try { await startCustomerEdit(data.orderCode) } catch { /* backend lock optional */ }
        restoreCartFromOrder(data)
        setEditingOrderCode(data.orderCode)
        setCartOpen(true)
        const newSearch = tokenParam ? `?t=${encodeURIComponent(tokenParam)}` : ''
        navigate(window.location.pathname + newSearch, { replace: true })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderCode, loading])

  // ── Header measurement ────────────────────────────────────────────────
  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        const priceMap = {}
        choiceDefs.forEach(c => { if (typeof c === 'object') priceMap[c.label] = Number(c.price || 0) })
        return sum + Object.entries(cur).reduce((s, [label, qty]) => s + (priceMap[label] || 0) * qty, 0)
      }
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

  const grouped = menu.reduce((g, m) => {
    const cat = m.category || 'Menu'
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  const categories = Object.keys(grouped)

  const filteredItems = searchQuery.trim()
    ? menu.filter(m => m.modelName.toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  // Items shown when a category chip is active (no search)
  const categoryItems = !searchQuery.trim() && activeCategory ? (grouped[activeCategory] || []) : []

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
      return { ...prev, [parentUid]: { ...parent, sideItems: [...(parent.sideItems || []),
        { uid: id, modelId: sf.model.id, modelName: sf.model.modelName, qty: sf.qty || 1 }] } }
    })
    setSideForm(prev => ({ ...prev, [parentUid]: {} }))
  }

  const changeSideQty = (parentUid, sideUid, delta) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return { ...prev, [parentUid]: { ...parent,
        sideItems: parent.sideItems
          .map(si => si.uid === sideUid ? { ...si, qty: Math.max(0, (si.qty || 1) + delta) } : si)
          .filter(si => si.qty > 0) } }
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
    setCart(newCart); setSideForm({})
  }

  const buildItemRequests = () => cartEntries.map(entry => ({
    modelId: entry.modelId, quantity: entry.qty,
    selectedOptions: entry.selectedOptions || null, itemNotes: entry.itemNotes || null,
    sideItems: (entry.sideItems || []).map(side => ({ modelId: side.modelId, quantity: side.qty || 1,
      selectedOptions: null, itemNotes: null, sideItems: [] })),
  }))

  const handlePlaceOrder = async () => {
    if (!itemCount) return
    setSubmitting(true); setError('')
    const items = buildItemRequests()
    try {
      if (editingOrderCode) {
        const { res, data } = await updatePublicOrderItems(editingOrderCode, items)
        if (!res.ok) { setError(data?.message || data?.error || 'Không thể cập nhật đơn'); setSubmitting(false); return }
        setCart({}); setSideForm({}); setCheckout(false); setCartOpen(false)
        setEditingOrderCode(null); setTrackingOrder(data)
      } else {
        const body = {
          fulfillmentType: form.fulfillmentType, tableId: ctx.tableId || null,
          customerName: form.customerName || null, customerPhone: form.customerPhone || null,
          deliveryAddress: form.fulfillmentType === 'DELIVERY' ? form.deliveryAddress : null,
          deliveryFee: null, paymentMethod: form.paymentMethod, notes: notes || null,
          manualOrderNumber: seqParam ? Number(seqParam) : null, token: tokenParam || null, items,
        }
        const { res, data } = await createOrder(ctx.tenantId, ctx.companyId, body)
        if (!res.ok) { setError(data?.message || 'Không thể đặt đơn'); setSubmitting(false); return }
        setCart({}); setSideForm({}); setNotes(''); setCheckout(false); setCartOpen(false)
        if (shopConfig.prepaidMenu && shopConfig.bankBin && shopConfig.bankAccountNumber) {
          setPrepaidQrOrder(data)
        } else {
          setTrackingOrder(data)
        }
      }
    } catch { setError('Lỗi mạng') } finally { setSubmitting(false) }
  }

  const handleEditOrder = async (order) => {
    try { await startCustomerEdit(order.orderCode) } catch { /* backend lock optional */ }
    restoreCartFromOrder(order)
    setEditingOrderCode(order.orderCode)
    setTrackingOrder(null)
    setCartOpen(true)
  }

  const handleCancelEdit = async () => {
    if (!editingOrderCode) return
    try { await cancelCustomerEdit(editingOrderCode) } catch {}
    setCart({}); setSideForm({})
    setEditingOrderCode(null)
    fetchPublicOrder(editingOrderCode)
      .then(({ data }) => { if (data?.orderCode) setTrackingOrder(data) })
      .catch(() => {})
  }

  const selectCategory = (cat) => {
    setSearchQuery('')
    setActiveCategory(prev => prev === cat ? null : cat)
  }

  const handleCallStaff = async () => {
    setCallStaffLoading(true)
    // Fire-and-forget — notify backend but show success regardless
    callStaff(ctx.tenantId, ctx.companyId, ctx.tableId, callStaffReason, callStaffNote, tokenParam).catch(() => {})
    setCallStaffOpen(false)
    setCallStaffReason('payment')
    setCallStaffNote('')
    setCallStaffDone(true)
    setCallStaffLoading(false)
  }

  // ── CartEntryList (closure for handler access) ────────────────────────
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
            <Box sx={{ bgcolor: '#f8faff', px: 1.5, pt: 1, pb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{idx + 1}.</Typography>
                <Box sx={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
                  <Typography fontWeight={700} sx={{ fontSize: 16 }} noWrap>{m.modelName}</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 13 }}>{fmt(unitPrice)} / ly</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton onClick={() => decrementEntry(entry.uid)} sx={{ p: 0.75 }}>
                    <RemoveIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                  <Typography fontWeight={800} sx={{ minWidth: 30, textAlign: 'center', fontSize: 18 }}>{entry.qty}</Typography>
                  <IconButton onClick={() => incrementEntry(entry.uid)}
                    sx={{ p: 0.75, bgcolor: '#ff5722', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#e64a19' } }}>
                    <AddIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>
                <Typography color="primary" fontWeight={800} sx={{ minWidth: 74, textAlign: 'right', fontSize: 15 }}>
                  {fmt(mainTotal)}
                </Typography>
                <IconButton color="error" onClick={() => deleteEntry(entry.uid)} sx={{ p: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Box>

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
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 0.5 }}>
                        {choices.map(choice => {
                          const c    = typeof choice === 'object' ? choice : { label: String(choice), price: 0 }
                          const qMap = (cur && typeof cur === 'object' && !Array.isArray(cur)) ? cur : {}
                          const cQty = qMap[c.label] || 0
                          const tag  = c.price > 0 ? ` +${Number(c.price).toLocaleString('vi-VN')}đ` : ''
                          return (
                            <Box key={c.label} sx={{
                              display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5,
                              bgcolor: cQty > 0 ? '#f0f0ff' : '#f8faff', borderRadius: 1.5,
                              border: `1px solid ${cQty > 0 ? '#6366f1' : '#e2e8f0'}`,
                            }}>
                              <Typography sx={{ flex: 1, fontSize: 13, fontWeight: cQty > 0 ? 700 : 400, color: cQty > 0 ? '#1e293b' : '#64748b' }} noWrap>
                                {c.label}{tag}
                              </Typography>
                              {cQty === 0 ? (
                                <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, 1)}
                                  sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
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
                                    sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                                    <AddIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Box>
                              )}
                            </Box>
                          )
                        })}
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                        {choices.map(choice => {
                          const c      = typeof choice === 'object' ? choice : { label: String(choice), price: 0 }
                          const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
                          const active = selArr.includes(c.label)
                          return (
                            <Chip key={c.label} label={c.label} size="small"
                              onClick={() => toggleOption(entry.uid, grp.groupName, c.label, grp.multiSelect)}
                              sx={{ height: 30, fontSize: 13, cursor: 'pointer',
                                bgcolor: active ? '#ff5722' : '#fff', color: active ? '#fff' : '#555',
                                border: `1px solid ${active ? '#ff5722' : '#ddd'}`, fontWeight: active ? 700 : 400 }} />
                          )
                        })}
                      </Box>
                    )}
                  </Box>
                )
              })}

              <TextField size="small" variant="standard" fullWidth
                placeholder="Ghi chú món (không đường, thêm đá…)"
                value={entry.itemNotes || ''}
                onChange={e => setEntryNotes(entry.uid, e.target.value)}
                InputProps={{ disableUnderline: false,
                  startAdornment: <InputAdornment position="start"><NoteAltIcon sx={{ fontSize: 16, color: '#ccc' }} /></InputAdornment>,
                  sx: { fontSize: 14 } }}
                sx={{ mt: 0.5 }}
              />
            </Box>

            {(sides.length > 0 || canAddSides) && (
              <Box sx={{ bgcolor: '#f0f4ff', borderTop: '1px solid #e2e8f0' }}>
                <Box sx={{ ml: 1.5, borderLeft: '2px solid #c7d2fe' }}>
                  {sides.map((si, siIdx) => {
                    const sm = menu.find(x => x.id === si.modelId)
                    const perCup = si.qty || 1; const effectiveQty = perCup * entry.qty
                    const effectivePrice = sm ? effectiveQty * Number(sm.sellingPrice || 0) : 0
                    return (
                      <Box key={si.uid} sx={{ px: 1, py: 1, borderBottom: '1px solid #e8eaf6' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: 1.5, bgcolor: '#e8eaf6', overflow: 'hidden',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {sm?.imageUrl ? <Box component="img" src={sm.imageUrl} alt={si.modelName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.style.display = 'none' }} />
                              : <Typography sx={{ fontSize: 24 }}>🧋</Typography>}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={700} sx={{ fontSize: 14 }} noWrap>{si.modelName}</Typography>
                            <Typography sx={{ color: '#6366f1', fontSize: 13, fontWeight: 700 }}>{sm ? fmt(effectivePrice) : ''}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <IconButton onClick={() => changeSideQty(entry.uid, si.uid, -1)}
                              sx={{ p: 0.75, color: '#94a3b8', bgcolor: '#f1f5f9', borderRadius: 1 }}>
                              <RemoveIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                            <Typography fontWeight={800} sx={{ minWidth: 28, textAlign: 'center', fontSize: 18, color: '#4f46e5' }}>
                              {effectiveQty}
                            </Typography>
                            <IconButton onClick={() => changeSideQty(entry.uid, si.uid, 1)}
                              sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                              <AddIcon sx={{ fontSize: 20 }} />
                            </IconButton>
                          </Box>
                          <IconButton onClick={() => removeSide(entry.uid, si.uid)} sx={{ p: 0.5, color: '#94a3b8' }}>
                            <CloseIcon sx={{ fontSize: 22 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    )
                  })}
                  {sides.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.75, borderTop: '1px dashed #c7d2fe' }}>
                      <Typography sx={{ color: '#64748b', fontSize: 13 }}>{fmt(mainTotal)} + {fmt(sideTotal)} topping</Typography>
                      <Typography fontWeight={800} color="primary" sx={{ fontSize: 15 }}>= {fmt(eTotal)}</Typography>
                    </Box>
                  )}
                  {canAddSides && (
                    <Box sx={{ pt: 0.75, pb: 1, px: 1 }}>
                      <Autocomplete size="small" options={allowedSideOptions} getOptionLabel={m => m.modelName}
                        value={sf.model || null} onChange={(_, v) => setSF(entry.uid, 'model', v)}
                        renderInput={params => <TextField {...params} label="Thêm topping…" size="small" />}
                        isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="Không có" fullWidth />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <IconButton onClick={() => setSF(entry.uid, 'qty', Math.max(1, (sf.qty || 1) - 1))}
                          sx={{ p: 0.75, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                          <RemoveIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                        <Typography fontWeight={800} sx={{ minWidth: 28, textAlign: 'center', fontSize: 18, color: '#4f46e5' }}>
                          {sf.qty || 1}
                        </Typography>
                        <IconButton onClick={() => setSF(entry.uid, 'qty', (sf.qty || 1) + 1)}
                          sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                          <AddIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                        <Box sx={{ flex: 1 }} />
                        <Button variant="contained" startIcon={<PlaylistAddIcon />}
                          onClick={() => addSideInline(entry.uid)} disabled={!sf.model}
                          sx={{ textTransform: 'none', bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' },
                            '&.Mui-disabled': { bgcolor: '#e0e0e0', color: '#9e9e9e' } }}>
                          Thêm
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            )}
          </Box>
        )
      })}
    </Stack>
  )

  const CartPanel = ({ onCheckout }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6" fontWeight={800}>Giỏ hàng</Typography>
      {itemCount === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
          <ShoppingCartIcon sx={{ fontSize: 36, mb: 0.5, opacity: 0.3 }} />
          <Typography variant="body2">Thêm món để bắt đầu đặt hàng</Typography>
        </Box>
      ) : (
        <>
          <CartEntryList />
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography fontWeight={700} sx={{ fontSize: 17 }}>Tổng cộng</Typography>
            <Typography fontWeight={900} color="primary" sx={{ fontSize: 18 }}>{fmt(totalAmount)}</Typography>
          </Box>
          <TextField size="small" fullWidth multiline rows={2} label="Ghi chú đơn hàng"
            placeholder="Yêu cầu đặc biệt…" value={notes} onChange={e => setNotes(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />
          <Button variant="contained" fullWidth size="large" onClick={onCheckout}
            sx={{ borderRadius: 20, fontWeight: 800, textTransform: 'none', fontSize: 15,
              bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' } }}>
            Thanh toán · {fmt(totalAmount)}
          </Button>
        </>
      )}
    </Box>
  )

  // ── MenuListItem (closure for handler access) ─────────────────────────
  const MenuListItem = ({ m }) => {
    const qty      = getModelQty(m.id)
    const hasOpts  = (optionsByModel[m.id] || []).length > 0
    const variants = cartEntries.filter(e => e.modelId === m.id)
    const optsStr  = variants.length === 1 ? fmtOpts(variants[0]?.selectedOptions) : null
    return (
      <Box sx={{
        display: 'flex', alignItems: 'stretch', bgcolor: '#fff', borderRadius: 2, overflow: 'hidden',
        border: qty > 0 ? '1.5px solid #ff5722' : '1.5px solid transparent',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <Box onClick={() => m.imageUrl && setImagePreview(m)} sx={{
          width: 96, flexShrink: 0, bgcolor: '#f5f5f5', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: m.imageUrl ? 'pointer' : 'default',
        }}>
          {m.imageUrl
            ? <Box component="img" src={m.imageUrl} alt={m.modelName}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { e.target.style.display = 'none' }} />
            : <Typography sx={{ fontSize: 34, opacity: 0.15, userSelect: 'none' }}>🍽</Typography>}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, px: 1.5, py: 1.25 }}>
          <Typography fontWeight={700} sx={{ fontSize: 15, lineHeight: 1.3, color: '#1a1a1a' }}>
            {m.modelName}
          </Typography>
          {hasOpts && !optsStr && (
            <Typography variant="caption" sx={{ color: '#aaa', fontSize: 11 }}>Có thể tuỳ chỉnh</Typography>
          )}
          {optsStr && (
            <Typography variant="caption" sx={{ color: '#ff5722', fontSize: 11, display: 'block' }} noWrap>
              {optsStr}
            </Typography>
          )}
          {variants.length > 1 && (
            <Chip label={`${variants.length} tuỳ chọn`} size="small"
              sx={{ height: 18, fontSize: 10, bgcolor: '#fff3e0', color: '#ff5722', mt: 0.5 }} />
          )}
          <Typography fontWeight={800} sx={{ color: '#ff5722', fontSize: 15, mt: 0.75 }}>
            {fmt(m.sellingPrice)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, flexShrink: 0, alignSelf: 'center' }}>
          {qty > 0 && (
            <>
              <IconButton size="small" onClick={() => handleRemoveClick(m.id)}
                sx={{ width: 32, height: 32, bgcolor: '#f5f5f5', color: '#ff5722', borderRadius: 1.5 }}>
                <RemoveIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography fontWeight={900} sx={{ minWidth: 28, textAlign: 'center', fontSize: 17 }}>
                {qty}
              </Typography>
            </>
          )}
          <IconButton size="small" onClick={() => handleAddClick(m)}
            sx={{ width: 32, height: 32, bgcolor: '#ff5722', color: '#fff', borderRadius: 1.5,
              '&:hover': { bgcolor: '#e64a19' } }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    )
  }

  // ── MenuGridItem ──────────────────────────────────────────────────────
  const MenuGridItem = ({ m }) => {
    const qty = getModelQty(m.id)
    return (
      <Box sx={{
        bgcolor: '#fff', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: qty > 0 ? '1.5px solid #ff5722' : '1.5px solid transparent',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <Box onClick={() => m.imageUrl && setImagePreview(m)} sx={{
          width: '100%', paddingTop: '70%', position: 'relative',
          bgcolor: '#f5f5f5', overflow: 'hidden', cursor: m.imageUrl ? 'pointer' : 'default',
        }}>
          {m.imageUrl
            ? <Box component="img" src={m.imageUrl} alt={m.modelName}
                sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            : <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: 36, opacity: 0.15, userSelect: 'none' }}>🍽</Typography>
              </Box>}
          {qty > 0 && (
            <Box sx={{ position: 'absolute', top: 6, right: 6, bgcolor: '#ff5722', color: '#fff',
              borderRadius: 10, minWidth: 22, height: 22, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 900, fontSize: 13 }}>
              {qty}
            </Box>
          )}
        </Box>
        <Box sx={{ px: 1.25, pt: 1, pb: 1.25, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography fontWeight={700} sx={{
            fontSize: 13, lineHeight: 1.35, color: '#1a1a1a', flex: 1, mb: 0.75,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {m.modelName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography fontWeight={800} sx={{ color: '#ff5722', fontSize: 14 }}>
              {fmt(m.sellingPrice)}
            </Typography>
            {qty > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton onClick={() => handleRemoveClick(m.id)}
                  sx={{ p: 0.25, width: 26, height: 26, bgcolor: '#f5f5f5', color: '#ff5722', borderRadius: 1 }}>
                  <RemoveIcon sx={{ fontSize: 15 }} />
                </IconButton>
                <IconButton onClick={() => handleAddClick(m)}
                  sx={{ p: 0.25, width: 26, height: 26, bgcolor: '#ff5722', color: '#fff', borderRadius: 1,
                    '&:hover': { bgcolor: '#e64a19' } }}>
                  <AddIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            ) : (
              <IconButton onClick={() => handleAddClick(m)}
                sx={{ p: 0.5, width: 30, height: 30, bgcolor: '#ff5722', color: '#fff', borderRadius: 1.5,
                  '&:hover': { bgcolor: '#e64a19' } }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        </Box>
      </Box>
    )
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress sx={{ color: '#ff5722' }} />
    </Box>
  )
  if (!ctx?.tenantId || !ctx?.companyId) return (
    <Box sx={{ p: 3 }}><Alert severity="error">{error || 'QR code không hợp lệ — thiếu thông tin cửa hàng.'}</Alert></Box>
  )

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>

      {/* ── Fixed header ──────────────────────────────────────── */}
      <Box ref={headerRef} sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {/* Row 1: Title + action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1.25, pb: 0.5, gap: 0.75 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={900} sx={{ fontSize: 18, color: '#1a1a1a', lineHeight: 1.2 }}>
              Gọi món
            </Typography>
            {ctx.tableId && (
              <Chip icon={<TableBarIcon sx={{ fontSize: '12px !important', color: '#1976d2 !important' }} />}
                label="Tại bàn" size="small"
                sx={{ height: 18, fontSize: 11, bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
            )}
          </Box>

          {/* Gọi nhân viên */}
          <Button size="small" variant="outlined" onClick={() => setCallStaffOpen(true)}
            startIcon={<SupportAgentIcon sx={{ fontSize: '16px !important' }} />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 20, fontSize: 12,
              px: 1.25, py: 0.4, flexShrink: 0,
              borderColor: '#ff5722', color: '#ff5722',
              '&:hover': { bgcolor: '#fff3e0', borderColor: '#ff5722' } }}>
            Gọi NV
          </Button>

          {/* Món đã gọi */}
          <Badge
            badgeContent={tokenSession?.orders?.filter(o => o.status !== 'CANCELLED').length || null}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: 10, fontWeight: 900, minWidth: 16, height: 16 } }}>
            <Button size="small"
              variant={tokenSession?.orders?.length > 0 ? 'contained' : 'outlined'}
              onClick={() => setSessionOpen(true)}
              startIcon={<ReceiptLongIcon sx={{ fontSize: '16px !important' }} />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 20, fontSize: 12,
                px: 1.25, py: 0.4, flexShrink: 0,
                ...(tokenSession?.orders?.length > 0
                  ? { bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }
                  : {}) }}>
              Đã gọi
            </Button>
          </Badge>
        </Box>

        {/* Row 2: Category tabs */}
        <Box sx={{
          display: 'flex', overflowX: 'auto', px: 1.5, pb: 0.75, gap: 0.5,
          '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
        }}>
          <Chip key="__all" label="Tất cả" size="small"
            onClick={() => { setActiveCategory(null); setSearchQuery('') }}
            sx={{
              flexShrink: 0, cursor: 'pointer', height: 28, fontSize: 12, fontWeight: 600,
              bgcolor: !activeCategory && !searchQuery ? '#ff5722' : '#f0f0f0',
              color: !activeCategory && !searchQuery ? '#fff' : '#444',
              '&:hover': { bgcolor: !activeCategory && !searchQuery ? '#e64a19' : '#e0e0e0' },
            }} />
          {categories.map(cat => (
            <Chip key={cat} label={cat} size="small"
              onClick={() => selectCategory(cat)}
              sx={{
                flexShrink: 0, cursor: 'pointer', height: 28, fontSize: 12, fontWeight: 600,
                bgcolor: activeCategory === cat ? '#ff5722' : '#f0f0f0',
                color: activeCategory === cat ? '#fff' : '#444',
                '&:hover': { bgcolor: activeCategory === cat ? '#e64a19' : '#e0e0e0' },
              }} />
          ))}
        </Box>

        {/* Row 3: Search + view toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pb: 1.25, gap: 1 }}>
          <TextField size="small" fullWidth variant="outlined"
            placeholder="Tìm món..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setActiveCategory(null) }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 20, color: '#bbb' }} /></InputAdornment>,
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" onClick={() => setSearchQuery('')}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { borderRadius: 20, bgcolor: '#f5f5f5', '& fieldset': { border: 'none' }, fontSize: 14 },
            }}
          />
          <IconButton onClick={() => setGridView(v => !v)}
            sx={{ bgcolor: gridView ? '#ff5722' : '#f0f0f0', color: gridView ? '#fff' : '#555',
              borderRadius: 1.5, flexShrink: 0,
              '&:hover': { bgcolor: gridView ? '#e64a19' : '#e0e0e0' } }}>
            {gridView ? <ViewListIcon /> : <GridViewIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* ── Content ───────────────────────────────────────────── */}
      {error && <Alert severity="error" sx={{ mx: 2, mt: 1, position: 'relative', zIndex: 1 }}>{error}</Alert>}

      <Box sx={{ pt: `${headerH}px`, pb: itemCount > 0 ? '80px' : '24px' }}>
        {searchQuery.trim() ? (
          /* ── Search results ────────────────────────────── */
          <Box sx={{ px: 1.5, pt: 1.5 }}>
            {filteredItems.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <SearchIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography color="text.secondary">Không tìm thấy "{searchQuery}"</Typography>
              </Box>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                  {filteredItems.length} kết quả
                </Typography>
                {gridView ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                    {filteredItems.map(m => <MenuGridItem key={m.id} m={m} />)}
                  </Box>
                ) : (
                  <Stack spacing={0.75}>
                    {filteredItems.map(m => <MenuListItem key={m.id} m={m} />)}
                  </Stack>
                )}
              </>
            )}
          </Box>
        ) : activeCategory ? (
          /* ── Single category filter ────────────────────── */
          <Box sx={{ px: 1.5, pt: 1 }}>
            <Typography sx={{
              py: 0.75, fontWeight: 700, fontSize: 13, color: '#888',
              letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5,
            }}>
              {activeCategory} · {categoryItems.length} món
            </Typography>
            {gridView ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                {categoryItems.map(m => <MenuGridItem key={m.id} m={m} />)}
              </Box>
            ) : (
              <Stack spacing={0.75}>
                {categoryItems.map(m => <MenuListItem key={m.id} m={m} />)}
              </Stack>
            )}
          </Box>
        ) : (
          /* ── All categories ────────────────────────────── */
          Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} ref={el => { categoryRefs.current[cat] = el }}>
              <Typography sx={{
                px: 2, py: 1, fontWeight: 700, fontSize: 13, color: '#888',
                bgcolor: '#f5f5f5', letterSpacing: 0.8, textTransform: 'uppercase',
                position: 'sticky', top: `${headerH}px`, zIndex: 50,
                borderBottom: '1px solid #ebebeb',
              }}>
                {cat}
              </Typography>
              <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
                {gridView ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.25 }}>
                    {items.map(m => <MenuGridItem key={m.id} m={m} />)}
                  </Box>
                ) : (
                  <Stack spacing={0.75}>
                    {items.map(m => <MenuListItem key={m.id} m={m} />)}
                  </Stack>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* ── Sticky bottom bar ─────────────────────────────────── */}
      {itemCount > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          px: 1.5, py: 1.5,
          background: 'linear-gradient(to top, rgba(245,245,245,1) 60%, rgba(245,245,245,0))',
        }}>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {/* Cart edit button */}
            <Button variant="outlined" onClick={() => setCartOpen(true)}
              sx={{ borderRadius: 20, minWidth: 'auto', px: 1.75, py: 0, flexShrink: 0,
                borderColor: '#ff5722', color: '#ff5722', fontWeight: 800, fontSize: 14,
                '&:hover': { bgcolor: '#fff3e0', borderColor: '#ff5722' } }}>
              <ShoppingCartIcon sx={{ fontSize: 18, mr: 0.5 }} />
              {itemCount}
            </Button>

            {/* Confirm button */}
            <Button variant="contained" fullWidth size="large"
              onClick={() => editingOrderCode ? handlePlaceOrder() : setCheckout(true)}
              sx={{
                bgcolor: editingOrderCode ? '#f59e0b' : '#ff5722',
                '&:hover': { bgcolor: editingOrderCode ? '#d97706' : '#e64a19' },
                borderRadius: 20, fontWeight: 800, fontSize: 14,
                textTransform: 'none', boxShadow: '0 4px 16px rgba(255,87,34,0.3)',
              }}>
              {editingOrderCode
                ? `Cập nhật đơn · ${fmt(totalAmount)}`
                : `Xác nhận gọi món · ${itemCount} món · ${fmt(totalAmount)}`}
            </Button>

            {editingOrderCode && (
              <Button variant="text" size="small" onClick={handleCancelEdit}
                sx={{ textTransform: 'none', color: '#888', flexShrink: 0, fontSize: 12, px: 0.5 }}>
                Huỷ
              </Button>
            )}
          </Box>
        </Box>
      )}

      {/* ── "Gọi nhân viên" modal ──────────────────────────────── */}
      <Dialog open={callStaffOpen} onClose={() => { if (!callStaffLoading) setCallStaffOpen(false) }}
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0,
          borderRadius: '20px 20px 0 0', maxWidth: '100%', width: '100%' } }}>
        <Box sx={{ width: 40, height: 4, bgcolor: '#e0e0e0', borderRadius: 2, mx: 'auto', mt: 1.5 }} />
        <DialogTitle sx={{ textAlign: 'center', pt: 1.5, pb: 1, fontWeight: 900, fontSize: 18 }}>
          Gọi nhân viên
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pb: 1 }}>
          <RadioGroup value={callStaffReason} onChange={e => setCallStaffReason(e.target.value)}>
            {[
              { value: 'payment', label: 'Yêu cầu thanh toán' },
              { value: 'other',   label: 'Hỗ trợ khác' },
            ].map(opt => (
              <FormControlLabel key={opt.value} value={opt.value}
                control={<Radio sx={{ color: '#ff5722', '&.Mui-checked': { color: '#ff5722' } }} />}
                label={<Typography fontWeight={callStaffReason === opt.value ? 700 : 400}>{opt.label}</Typography>}
                sx={{
                  py: 0.75, px: 1.5, mb: 1, mr: 0, borderRadius: 2,
                  border: '1.5px solid', borderColor: callStaffReason === opt.value ? '#ff5722' : '#e0e0e0',
                  bgcolor: callStaffReason === opt.value ? '#fff3e0' : 'transparent',
                  transition: 'all 0.15s',
                }} />
            ))}
          </RadioGroup>
          <TextField fullWidth multiline rows={3} size="small"
            placeholder="Bạn cần hỗ trợ gì?"
            value={callStaffNote}
            onChange={e => setCallStaffNote(e.target.value)}
            disabled={callStaffLoading}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }} />
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 3.5, pt: 1.5, flexDirection: 'column', gap: 1 }}>
          <Button variant="contained" fullWidth size="large" onClick={handleCallStaff}
            disabled={callStaffLoading}
            startIcon={callStaffLoading ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' },
              borderRadius: 20, fontWeight: 700, textTransform: 'none', fontSize: 15 }}>
            {callStaffLoading ? 'Đang gửi…' : 'Gọi nhân viên'}
          </Button>
          <Button fullWidth onClick={() => setCallStaffOpen(false)}
            disabled={callStaffLoading}
            sx={{ textTransform: 'none', color: 'text.secondary', borderRadius: 20 }}>
            Huỷ
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Call staff success snack ──────────────────────────── */}
      <Snackbar open={callStaffDone} autoHideDuration={4000} onClose={() => setCallStaffDone(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setCallStaffDone(false)} sx={{ fontWeight: 700 }}>
          Nhân viên sẽ đến hỗ trợ bạn trong giây lát!
        </Alert>
      </Snackbar>

      {/* ── Cart bottom sheet ──────────────────────────────────── */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0,
          borderRadius: '16px 16px 0 0', maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1 }}>
          <Typography fontWeight={800} variant="h6" sx={{ flex: 1 }}>Giỏ hàng</Typography>
          <IconButton size="small" onClick={() => setCartOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <CartPanel onCheckout={() => { setCartOpen(false); editingOrderCode ? handlePlaceOrder() : setCheckout(true) }} />
        </DialogContent>
      </Dialog>

      {/* ── Prepaid payment QR ────────────────────────────────── */}
      {prepaidQrOrder && (() => {
        const amount = Math.round(Number(prepaidQrOrder.totalAmount || 0))
        const qrUrl = shopConfig.bankBin && shopConfig.bankAccountNumber
          ? `https://img.vietqr.io/image/${shopConfig.bankBin}-${shopConfig.bankAccountNumber}-qr_only.png`
            + `?amount=${amount}&addInfo=${encodeURIComponent(prepaidQrOrder.orderCode)}`
            + `&accountName=${encodeURIComponent(shopConfig.bankAccountName || '')}`
          : null
        const orderNum = prepaidQrOrder.orderNumber ? `#${prepaidQrOrder.orderNumber}` : prepaidQrOrder.orderCode
        return (
          <Dialog open fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ textAlign: 'center', pb: 0.5, pt: 2.5, fontWeight: 900, fontSize: 20 }}>
              Thanh toán đơn {orderNum}
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center', pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Quét mã QR để thanh toán. Đơn hàng sẽ được xác nhận sau khi thanh toán.
              </Typography>
              {qrUrl ? (
                <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2,
                  border: '2px solid #1976d2', mb: 1.5 }}>
                  <img src={qrUrl} alt="Payment QR" style={{ width: 220, height: 220, display: 'block', borderRadius: 6 }} />
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mb: 1.5 }}>Chưa cấu hình tài khoản ngân hàng — vui lòng thanh toán tại quầy.</Alert>
              )}
              <Typography variant="h5" fontWeight={900} color="primary">{fmt(prepaidQrOrder.totalAmount)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Mã: <strong>{prepaidQrOrder.orderCode}</strong>
                {shopConfig.bankAccountName ? ` · ${shopConfig.bankAccountName}` : ''}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: 'column', gap: 1 }}>
              <Button variant="contained" fullWidth size="large"
                onClick={() => { setPrepaidQrOrder(null); setTrackingOrder(prepaidQrOrder) }}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20 }}>
                Đã thanh toán — Theo dõi đơn
              </Button>
              <Button fullWidth size="small" color="inherit"
                onClick={() => { setPrepaidQrOrder(null); setTrackingOrder(prepaidQrOrder) }}
                sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Thanh toán sau / Đóng
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* ── "Món đã gọi" session orders sheet ────────────────── */}
      <Dialog open={sessionOpen} onClose={() => setSessionOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0,
          borderRadius: '16px 16px 0 0', maxHeight: '88vh' } }}>
        <Box sx={{ width: 40, height: 4, bgcolor: '#e0e0e0', borderRadius: 2, mx: 'auto', mt: 1.5 }} />
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1, pt: 1 }}>
          <ReceiptLongIcon sx={{ mr: 1, color: '#1976d2' }} />
          <Box sx={{ flex: 1 }}>
            <Typography fontWeight={900} variant="h6">Món đã gọi</Typography>
            <Typography variant="caption" color="text.secondary">
              {tokenSession?.orders?.filter(o => o.status !== 'CANCELLED').length ?? 0} đơn hàng
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setSessionOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto', px: 2, pb: 3 }}>
          <SessionOrderList
            session={tokenSession}
            token={tokenParam}
            onEdit={(order) => { setSessionOpen(false); handleEditOrder(order) }}
            onView={(order) => { setSessionOpen(false); setTrackingOrder(order) }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Checkout dialog ───────────────────────────────────── */}
      <Dialog open={checkout} onClose={() => setCheckout(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={700} variant="h6">
            {editingOrderCode ? 'Cập nhật đơn' : 'Xác nhận đặt món'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                Hình thức
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {FULFILLMENT_OPTIONS.map(opt => (
                  <Box key={opt.value} onClick={() => setForm(f => ({ ...f, fulfillmentType: opt.value }))} sx={{
                    flex: 1, border: '1.5px solid', borderRadius: 2, py: 1, px: 0.5, textAlign: 'center',
                    cursor: 'pointer',
                    borderColor: form.fulfillmentType === opt.value ? '#ff5722' : '#e0e0e0',
                    bgcolor: form.fulfillmentType === opt.value ? '#fff3e0' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <Box sx={{ color: form.fulfillmentType === opt.value ? '#ff5722' : 'text.secondary' }}>{opt.icon}</Box>
                    <Typography variant="caption" fontWeight={600}
                      color={form.fulfillmentType === opt.value ? '#ff5722' : 'text.secondary'}>{opt.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <TextField label="Tên khách" size="small" fullWidth value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            <TextField label="Số điện thoại" size="small" fullWidth type="tel" value={form.customerPhone}
              onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
            {form.fulfillmentType === 'DELIVERY' && (
              <TextField label="Địa chỉ giao hàng" size="small" fullWidth multiline rows={2}
                value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} />
            )}
            <TextField label="Ghi chú đơn" size="small" fullWidth multiline rows={2}
              placeholder="Yêu cầu đặc biệt…"
              value={notes} onChange={e => setNotes(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Thanh toán</InputLabel>
              <Select value={form.paymentMethod} label="Thanh toán"
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <MenuItem value="CASH">Tiền mặt</MenuItem>
                <MenuItem value="BANK_QR">Chuyển khoản QR</MenuItem>
              </Select>
            </FormControl>

            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Đơn hàng của bạn
              </Typography>
              {cartEntries.map((entry, idx) => {
                const m = menu.find(x => x.id === entry.modelId)
                if (!m) return null
                const optsStr   = fmtOpts(entry.selectedOptions)
                const sides     = entry.sideItems || []
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
                      <Typography variant="body2" sx={{ color: '#ff5722' }} fontWeight={700}>{fmt(mainTotal)}</Typography>
                    </Box>
                    {optsStr && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>{optsStr}</Typography>
                    )}
                    {entry.itemNotes && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block', fontStyle: 'italic' }}>
                        Ghi chú: {entry.itemNotes}
                      </Typography>
                    )}
                    {sides.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', pl: 1.5, borderTop: '1px dotted #e2e8f0', mt: 0.5, pt: 0.5 }}>
                        <Typography sx={{ color: '#64748b', fontStyle: 'italic', fontSize: 13 }}>= tổng phụ</Typography>
                        <Typography fontWeight={900} sx={{ color: '#ff5722', fontSize: 14 }}>{fmt(mainTotal + sideTotal)}</Typography>
                      </Box>
                    )}
                  </Box>
                )
              })}
              <Divider sx={{ my: 0.75 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography fontWeight={700}>Tổng cộng</Typography>
                <Typography fontWeight={700} sx={{ color: '#ff5722' }}>{fmt(totalAmount)}</Typography>
              </Box>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setCheckout(false)} disabled={submitting}>Quay lại</Button>
          <Button variant="contained" fullWidth onClick={handlePlaceOrder} disabled={submitting}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none',
              bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' } }}>
            {submitting ? <CircularProgress size={20} color="inherit" /> :
              editingOrderCode ? `Cập nhật · ${fmt(totalAmount)}` : `Đặt món · ${fmt(totalAmount)}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Inline order tracking ──────────────────────────────── */}
      {trackingOrder && (
        <TrackingOverlay
          order={trackingOrder}
          ctx={ctx}
          onEdit={handleEditOrder}
          onOrderMore={() => setTrackingOrder(null)}
          onUpdated={setTrackingOrder}
        />
      )}

      {/* ── Table occupied dialog ──────────────────────────────── */}
      <Dialog open={Boolean(tableOrders)} onClose={() => setTableOrders(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableRestaurantIcon color="warning" />
            <Typography fontWeight={700}>Bàn đang có đơn hàng</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Bàn này đang có {tableOrders?.length} đơn hàng. Bạn có muốn đặt thêm không?
          </Typography>
          {(tableOrders || []).slice(0, 3).map(o => (
            <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 1.25, py: 0.75, mb: 0.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" fontWeight={700}>
                {o.orderNumber ? `#${o.orderNumber}` : o.orderCode}
              </Typography>
              <Chip label={STATUS_CHIP_MAP[o.status]?.label || o.status} size="small"
                color={o.status === 'READY' ? 'success' : o.status === 'PREPARING' ? 'warning' : 'default'} />
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setTableOrders(null)} variant="outlined"
            sx={{ flex: 1, textTransform: 'none', borderRadius: 20 }}>
            Đặt thêm
          </Button>
          <Button variant="contained" color="warning"
            onClick={() => {
              const latest = tableOrders?.[tableOrders.length - 1]
              if (latest) setTrackingOrder(latest)
              setTableOrders(null)
            }}
            sx={{ flex: 1, textTransform: 'none', borderRadius: 20 }}>
            Xem đơn
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Options dialog ─────────────────────────────────────── */}
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

      {/* ── Item image preview ─────────────────────────────────── */}
      <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        {imagePreview && (
          <>
            <Box sx={{ position: 'relative', bgcolor: '#f0f0f0', lineHeight: 0 }}>
              <Box component="img" src={imagePreview.imageUrl} alt={imagePreview.modelName}
                sx={{ width: '100%', maxHeight: 340, objectFit: 'contain', display: 'block' }}
                onError={e => { e.target.style.display = 'none' }} />
              <IconButton size="small" onClick={() => setImagePreview(null)}
                sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography fontWeight={800} sx={{ fontSize: 18 }}>{imagePreview.modelName}</Typography>
              <Typography fontWeight={700} sx={{ fontSize: 17, mt: 0.5, color: '#ff5722' }}>
                {fmt(imagePreview.sellingPrice)}
              </Typography>
            </Box>
          </>
        )}
      </Dialog>
    </Box>
  )
}
