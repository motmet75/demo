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
import QrCode2Icon from '@mui/icons-material/QrCode2'
import DownloadIcon from '@mui/icons-material/Download'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Snackbar from '@mui/material/Snackbar'
import { resolveToken, fetchMenu, createOrder, fetchPublicMenuOptions,
         fetchActiveTableOrders, startCustomerEdit, cancelCustomerEdit,
         updatePublicOrderItems, fetchPublicOrder, fetchTokenSession,
         cancelPublicOrder, fetchShopConfig, callStaff, fetchPublicStaffCall,
         fetchLatestPublicStaffCall, redeemPublicVoucher, fetchPublicTables, changePublicOrderTable } from '../../api/shopApi'
import ItemOptionsDialog from './ItemOptionsDialog'
import OrderReceiptDialog from './OrderReceiptDialog'
import VoucherQrScanDialog from '../shoporder/VoucherQrScanDialog'
import LanguageSelector from '../../components/LanguageSelector'
import { ORDERING_LANGUAGE_CODES } from '../../i18n/translations'
import { useI18n } from '../../i18n/I18nContext'
import { localizedCategory, localizedChoiceLabel, localizedGroupName, localizedLabel, localizedModelName, localizedSelectedOptions, localizedTableName } from '../../i18n/menuLocalization'
import { shopCustomerText, shopStatusText } from '../../i18n/shopCustomerText'
import { decorateAllowedSideOptions, getAllowedSideMax } from '../../utils/sideItemConfig'
import { saveQrImage } from '../../utils/saveQrImage'

const genUid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const fmt    = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))

const STAFF_CALL_STORAGE_PREFIX = 'shop_customer_staff_call_v1'
const SHOP_MENU_DISPLAY_SIZE_PREF = 'shop.menu.displaySize'
const SHOP_MENU_CONTRAST_PREF = 'shop.menu.highContrast'

function readShopMenuPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}

function writeShopMenuPref(key, value) {
  try { localStorage.setItem(key, value) } catch { /* browser storage may be blocked */ }
}

function staffCallStorageKey(token, ctx) {
  if (token) return `${STAFF_CALL_STORAGE_PREFIX}:token:${token}`
  if (ctx?.tenantId && ctx?.companyId && ctx?.tableId) {
    return `${STAFF_CALL_STORAGE_PREFIX}:table:${ctx.tenantId}:${ctx.companyId}:${ctx.tableId}`
  }
  return null
}

function readStoredStaffCall(key) {
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.call?.id) return parsed.call
    if (parsed?.id) return { id: parsed.id }
  } catch { /* ignore */ }
  return null
}

const FULFILLMENT_OPTIONS = [
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon sx={{ fontSize: 38 }} /> },
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon sx={{ fontSize: 38 }} /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon sx={{ fontSize: 38 }} /> },
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

const STATUS_TRANSLATION_KEYS = {
  PENDING: 'shopOrder.status.pending',
  CONFIRMED: 'shopOrder.status.confirmed',
  PREPARING: 'shopOrder.status.preparing',
  READY: 'shopOrder.status.ready',
  PICKED_UP: 'shopOrder.status.pickedUp',
  COMPLETED: 'shopOrder.status.completed',
  CANCELLED: 'shopOrder.status.cancelled',
}

function orderStatusLabel(order, language, translate) {
  const status = order?.status || 'PENDING'
  return localizedLabel(order?.statusLabels, language, shopStatusText(language, status) || translate(STATUS_TRANSLATION_KEYS[status] || status))
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

function SessionOrderList({ session, token, onEdit, onView, t, language, formatAmount, itemName }) {
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelNote, setCancelNote]     = useState('')
  const [cancelling, setCancelling]     = useState(false)
  const [cancelError, setCancelError]   = useState('')
  const translate = t || ((key, vars = {}) => String(key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? ''))
  const money = formatAmount || fmt
  const displayItemName = itemName || ((item) => item?.modelName || '')
  const statusLabel = (order) => orderStatusLabel(order, language, translate)

  const orders = (session?.orders || []).filter(o => o.status !== 'CANCELLED')

  const doCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true); setCancelError('')
    try {
      const { res, data } = await cancelPublicOrder(cancelTarget.orderCode, cancelNote)
      if (!res.ok) { setCancelError(data?.error || translate('shop.cancelOrder')); setCancelling(false); return }
      setCancelTarget(null); setCancelNote('')
    } catch { setCancelError(translate('common.networkError')) }
    setCancelling(false)
  }

  if (!orders.length) return (
    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
      <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
      <Typography>{translate('shop.noOrders')}</Typography>
    </Box>
  )

  const grandTotal = orders.reduce((s, o) => s + payableAmount(o), 0)

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
          const childMap   = buildChildMap(order.items)
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
                <Chip label={statusLabel(order)} color={chip.color} size="small" sx={{ fontWeight: 700, fontSize: 11 }} />
                {editing && (
                  <Chip label={translate('status.editing')} size="small"
                    sx={{ bgcolor: '#f59e0b', color: '#fff', fontWeight: 700, fontSize: 10 }} />
                )}
                <Box sx={{ flex: 1 }} />
                <Typography fontWeight={800} color="primary" sx={{ fontSize: 14 }}>
                  {money(payableAmount(order))}
                </Typography>
              </Box>

              {(order.customerName || order.customerPhone) && (
                <Box sx={{ px: 2, pt: 1, fontWeight: 800, fontSize: 14 }}>
                  {order.customerName || shopCustomerText(language, 'tracking.customer')}{order.customerPhone ? ` · ***${String(order.customerPhone).replace(/\D/g, '').slice(-3)}` : ''}
                </Box>
              )}
              {order.paymentRequestedAt && order.paymentStatus !== 'PAID' && (
                <Alert severity="warning" sx={{ mx: 2, mt: 1, fontWeight: 800 }}>
                  {shopCustomerText(language, 'tracking.payAtCounterShort')}
                </Alert>
              )}

              <Box sx={{ px: 2, py: 1 }}>
                {roots.slice(0, 4).map((item) => {
                  const optsText = localizedSelectedOptions(item.modelId, item.selectedOptions, {}, language)
                  const children = childMap[String(item.id)] || []
                  return (
                    <Box key={item.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.4 }}>
                      <Typography variant="caption" sx={{ color: '#ff5722', fontWeight: 700, flexShrink: 0, pt: 0.15 }}>
                        x{item.quantity}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" sx={{ display: 'block', color: '#333' }} noWrap>
                          {displayItemName(item)}
                        </Typography>
                        {optsText && (
                          <Typography variant="caption" sx={{ display: 'block', color: '#64748b' }} noWrap>
                            {optsText}
                          </Typography>
                        )}
                        {children.slice(0, 3).map(child => {
                          const childOpts = localizedSelectedOptions(child.modelId, child.selectedOptions, {}, language)
                          return (
                            <Typography key={child.id} variant="caption" sx={{ display: 'block', color: '#64748b' }} noWrap>
                              + x{child.quantity} {displayItemName(child)}{childOpts ? ` · ${childOpts}` : ''}
                            </Typography>
                          )
                        })}
                      </Box>
                      <Chip label={statusLabel(order)} color={chip.color} size="small"
                        sx={{ height: 16, fontSize: 10, fontWeight: 600, mt: 0.1 }} />
                    </Box>
                  )
                })}
                {roots.length > 4 && (
                  <Typography variant="caption" color="text.secondary">+{roots.length - 4} {translate('shop.otherItems')}...</Typography>
                )}
              </Box>

              <Box sx={{ px: 2, pb: 1.25, pt: 0.25, display: 'flex', gap: 1 }}>
                {isPending && (
                  <Button variant={editing ? 'contained' : 'outlined'} size="small"
                    color={editing ? 'warning' : 'primary'}
                    onClick={() => onEdit(order)}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20, flex: 1 }}>
                    {editing ? translate('shop.continueEditing') : translate('shop.editOrder')}
                  </Button>
                )}
                <Button variant="outlined" size="small" onClick={() => onView && onView(order)}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20, flexShrink: 0 }}>
                  {translate('common.view')}
                </Button>
                {isPending && !isPaid && (
                  <Button variant="outlined" size="small" color="error"
                    onClick={() => { setCancelTarget(order); setCancelNote(''); setCancelError('') }}
                    sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20, flexShrink: 0 }}>
                    {translate('common.cancel')}
                  </Button>
                )}
                {isPaid && (
                  <Chip label={translate('common.paid')} color="success" size="small"
                    sx={{ fontWeight: 700, fontSize: 11, alignSelf: 'center' }} />
                )}
              </Box>
            </Box>
          )
        })}
      </Box>

      {orders.length > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1.5, borderTop: '1.5px solid #e0e0e0', mx: -2, px: 2 }}>
          <Typography fontWeight={700} sx={{ color: '#555' }}>{translate('shop.needPayment', { count: orders.length })}</Typography>
          <Typography fontWeight={900} color="primary" sx={{ fontSize: 17 }}>{money(grandTotal)}</Typography>
        </Box>
      )}

      <Dialog open={Boolean(cancelTarget)} onClose={() => !cancelling && setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{translate('shop.cancelThisOrder')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {translate('shop.cancelWarning', { value: cancelTarget?.orderNumber ? `#${cancelTarget.orderNumber}` : cancelTarget?.orderCode })}
          </Typography>
          <TextField fullWidth size="small" multiline rows={2} label={translate('shop.optionalReason')}
            value={cancelNote} onChange={e => setCancelNote(e.target.value)} disabled={cancelling} />
          {cancelError && <Alert severity="error" sx={{ mt: 1.5 }}>{cancelError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelTarget(null)} disabled={cancelling}>{translate('shop.keepOrder')}</Button>
          <Button variant="contained" color="error" onClick={doCancel} disabled={cancelling}
            sx={{ fontWeight: 700, minWidth: 120, borderRadius: 20 }}>
            {cancelling ? <CircularProgress size={18} color="inherit" /> : translate('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function TrackingOverlay({ order: initialOrder, ctx, token, tables = [], onEdit, onOrderMore, onUpdated, formatSelectedOptions }) {
  const [order, setOrder] = React.useState(initialOrder)
  const [imagePreview, setImagePreview] = React.useState(null)
  const [finishingEdit, setFinishingEdit] = React.useState(false)
  const [changingTable, setChangingTable] = React.useState(false)
  const [selectedTableId, setSelectedTableId] = React.useState(initialOrder?.tableId || '')
  const [actionMessage, setActionMessage] = React.useState('')
  const { language, t, formatMoney } = useI18n()
  const ct = React.useCallback((key, vars) => shopCustomerText(language, key, vars), [language])
  const fmtLocal = React.useCallback((n) => n != null ? formatMoney(n, 'VND') : '', [formatMoney])
  const displayItemName = React.useCallback((item) => localizedModelName(item, language), [language])

  React.useEffect(() => { setOrder(initialOrder); setSelectedTableId(initialOrder?.tableId || '') }, [initialOrder])

  const finishEditing = async () => {
    setFinishingEdit(true); setActionMessage('')
    try {
      const { res, data } = await cancelCustomerEdit(order.orderCode)
      if (!res.ok) setActionMessage(data?.error || data?.message || ct('tracking.cannotFinishEdit'))
      else { setOrder(data); onUpdated?.(data); setActionMessage(ct('tracking.finishEditDone')) }
    } catch { setActionMessage(ct('common.networkError')) }
    setFinishingEdit(false)
  }

  const changeTable = async () => {
    if (!selectedTableId || selectedTableId === order.tableId) return
    setChangingTable(true); setActionMessage('')
    try {
      const { res, data } = await changePublicOrderTable(order.orderCode, selectedTableId, token)
      if (!res.ok) setActionMessage(data?.error || data?.message || ct('tracking.cannotChangeTable'))
      else { setOrder(data); onUpdated?.(data); setActionMessage(ct('tracking.tableChangedDone')) }
    } catch { setActionMessage(ct('common.networkError')) }
    setChangingTable(false)
  }

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
  const statusLabel = orderStatusLabel(order, language, t)
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const heroNum = order.orderNumber ? `#${order.orderNumber}` : order.dailySeq ? `#${order.dailySeq}` : '—'
  const allItems   = order.items || []
  const childMap   = buildChildMap(allItems)
  const rootItems  = allItems.filter(it => !it.parentItemId)

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 2000, bgcolor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ bgcolor: style.bg, textAlign: 'center', px: 2, pt: 5, pb: 3, flexShrink: 0 }}>
        <Typography sx={{ fontSize: { xs: 80, md: 110 }, fontWeight: 900, lineHeight: 1, color: style.color, letterSpacing: 0 }}>
          {heroNum}
        </Typography>
        <Typography sx={{ fontSize: 12, color: style.color, opacity: 0.55, mt: 0.75 }}>
          {order.orderNumber ? `${ct('tracking.order')} #${order.orderNumber}` : ''}{order.orderCode ? ` - ${order.orderCode}` : ''}
        </Typography>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 1.5, px: 2.5, py: 0.75,
          bgcolor: '#fff', borderRadius: 99, border: `1.5px solid ${style.color}22` }}>
          {status === 'PREPARING' && (
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.color,
              animation: 'blink 1.4s infinite',
              '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } } }} />
          )}
          <Typography fontWeight={700} sx={{ color: style.color, fontSize: 18 }}>{statusLabel}</Typography>
        </Box>
        {order.customerEditing && (
          <Box sx={{ mt: 1 }}>
            <Chip label={t('status.editing')} size="small" color="warning" sx={{ fontWeight: 700 }} />
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
                      {shopStatusText(language, step.key) || t(STATUS_TRANSLATION_KEYS[step.key] || step.label)}
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

      {order.paymentRequestedAt && order.paymentStatus !== 'PAID' && (
        <Alert severity="warning" sx={{ mx: 'auto', mt: 1.5, width: 'calc(100% - 32px)', maxWidth: 520, fontWeight: 800, flexShrink: 0 }}>
          {ct('tracking.payAtCounter')}
        </Alert>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 1.5 }}>
        {rootItems.map((item, idx) => {
          const children = childMap[String(item.id)] || []
          const itemImage = item.imageUrl || item.thumbnailUrl || ''
          return (
            <Box key={item.id || idx} sx={{ mb: 1, pb: 1, borderBottom: '1px solid #f0f0f0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box onClick={() => itemImage && setImagePreview({ imageUrl: itemImage, modelName: item.modelName })}
                  sx={{ width: 76, height: 76, flexShrink: 0, borderRadius: 1.5, bgcolor: '#eef2f7', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: itemImage ? 'pointer' : 'default' }}>
                  {itemImage ? <Box component="img" src={itemImage} alt={displayItemName(item)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                    : <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: 28 }}>{String(displayItemName(item) || '?').slice(0, 1)}</Typography>}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} sx={{ fontSize: 22, color: '#0f172a', lineHeight: 1.18 }}>{Number(item.quantity)}x {displayItemName(item)}</Typography>
                </Box>
                <Typography color="primary" fontWeight={900} sx={{ fontSize: 20, flexShrink: 0 }}>{fmtLocal(item.lineTotal)}</Typography>
              </Box>
              {item.selectedOptions && (
                <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>
                  {formatSelectedOptions ? formatSelectedOptions(item.modelId, item.selectedOptions) : fmtOpts(item.selectedOptions)}
                </Typography>
              )}
              {item.itemNotes && (
                <Typography variant="caption" sx={{ pl: 1.5, color: '#f59e0b', display: 'block' }}>
                  ⚠ {item.itemNotes}
                </Typography>
              )}
              {children.map((child, ci) => (
                <Box key={child.id || ci} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 2.5, mt: 0.4, borderLeft: '2px solid #c7d2fe', ml: 1 }}>
                  {(child.imageUrl || child.thumbnailUrl) && <Box component="img" src={child.imageUrl || child.thumbnailUrl} alt={displayItemName(child)} sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1, border: '1px solid #c7d2fe', flexShrink: 0 }} onError={e => { e.target.style.display = 'none' }} />}
                  <Typography sx={{ color: '#4338ca', fontWeight: 900, fontSize: 18, flex: 1, minWidth: 0 }} noWrap>
                    + {Number(child.quantity)}x {displayItemName(child)}
                  </Typography>
                  <Typography color="primary" fontWeight={900} sx={{ fontSize: 16, flexShrink: 0 }}>{fmtLocal(child.lineTotal)}</Typography>
                </Box>
              ))}
            </Box>
          )
        })}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
          <Typography fontWeight={700}>{t('common.total')}</Typography>
          <Typography fontWeight={900} color="primary">{fmtLocal(payableAmount(order))}</Typography>
        </Box>
      </Box>

      <Box sx={{ px: 2, pb: 3, pt: 1.5, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0, borderTop: '1px solid #f0f0f0' }}>
        {actionMessage && (
          <Alert severity={[ct('tracking.finishEditDone'), ct('tracking.tableChangedDone')].includes(actionMessage) ? 'success' : 'error'}>{actionMessage}</Alert>
        )}
        {order.customerEditing && (
          <Button variant="contained" color="warning" fullWidth onClick={finishEditing} disabled={finishingEdit}
            sx={{ borderRadius: 20, fontWeight: 800, textTransform: 'none' }}>
            {finishingEdit ? <CircularProgress size={20} color="inherit" /> : ct('tracking.finishEdit')}
          </Button>
        )}
        {tables.length > 0 && !isDone && !isCancelled && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box component="select" value={selectedTableId} onChange={e => setSelectedTableId(e.target.value)}
              sx={{ flex: 1, minHeight: 44, px: 1, border: '1px solid #93c5fd', borderRadius: 2, bgcolor: '#fff', fontSize: 16 }}>
              <option value="">{ct('tracking.chooseTable')}</option>
              {tables.map(table => <option key={table.id} value={table.id}>{localizedTableName(table, language)}</option>)}
            </Box>
            <Button variant="outlined" onClick={changeTable}
              disabled={changingTable || !selectedTableId || selectedTableId === order.tableId}
              sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none' }}>
              {changingTable ? <CircularProgress size={18} /> : ct('tracking.changeTable')}
            </Button>
          </Box>
        )}
        {isPending && !order.customerEditing && (
          <Button variant="outlined" fullWidth startIcon={<EditNoteIcon />} onClick={() => onEdit(order)}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none', borderColor: '#f59e0b', color: '#b45309' }}>
            {t('shop.editOrder')}
          </Button>
        )}
        {!isDone && !isCancelled && (
          <Button variant="outlined" fullWidth startIcon={<AddShoppingCartIcon />} onClick={onOrderMore}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none' }}>
            {t('shop.placeOrder')}
          </Button>
        )}
        {(isDone || isCancelled) && (
          <Button variant="contained" fullWidth onClick={onOrderMore}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none', bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' } }}>
            {t('shop.placeOrder')}
          </Button>
        )}
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {order.orderCode}
        </Typography>
      </Box>

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
              <Typography fontWeight={800}>{imagePreview.modelName}</Typography>
            </Box>
          </>
        )}
      </Dialog>
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
        const parts = Object.entries(v).filter(([, q]) => q > 0).map(([label, q]) => q > 1 ? `${label}x${q}` : label)
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
  const { language, setLanguage, t, formatMoney } = useI18n()
  const fmt = useCallback((n) => n != null ? formatMoney(n, 'VND') : '', [formatMoney])
  const cText = useCallback((key, vars) => shopCustomerText(language, key, vars), [language])
  const modelName = useCallback((model) => localizedModelName(model, language), [language])
  const modelCategory = useCallback((model) => localizedCategory(model, language), [language])
  const optionGroupName = useCallback((group) => localizedGroupName(group, language), [language])
  const choiceName = useCallback((choice) => localizedChoiceLabel(choice, language), [language])

  const tokenParam    = params.get('t')
  const rawTenantId   = params.get('tenantId')
  const rawCompanyId  = params.get('companyId')
  const rawTableId    = params.get('tableId')
  const rawCustomerName = params.get('customerName') || ''
  const rawLanguage   = params.get('lang') || params.get('language') || ''
  const rawSearchQuery = params.get('search') || params.get('q') || params.get('item') || ''
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
  const [tableOrders, setTableOrders]       = useState([])
  const [tableOrdersPromptOpen, setTableOrdersPromptOpen] = useState(false)
  const [tokenSession, setTokenSession]     = useState(null)
  const [sessionOpen, setSessionOpen]       = useState(false)
  const [shopConfig, setShopConfig]         = useState({ prepaidMenu: false, bankBin: '', bankAccountNumber: '', bankAccountName: '' })
  const [publicTables, setPublicTables]     = useState([])
  const [prepaidQrOrder, setPrepaidQrOrder] = useState(null)
  const [imagePreview, setImagePreview]     = useState(null)
  const [voucherScanOpen, setVoucherScanOpen] = useState(false)
  const [voucherPayload, setVoucherPayload] = useState('')
  const [voucherSnack, setVoucherSnack]     = useState({ open: false, message: '', severity: 'success' })
  const [form, setForm] = useState({
    fulfillmentType: 'DINE_IN', customerName: rawCustomerName, customerPhone: '',
    deliveryAddress: '', customerTableTag: '', selectedTableId: '', requestedFulfillmentAt: '', paymentMethod: 'CASH',
  })

  // ── New UI state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]         = useState(rawSearchQuery)
  const [gridView, setGridView]               = useState(false)
  const [displaySize, setDisplaySize]         = useState(() => readShopMenuPref(SHOP_MENU_DISPLAY_SIZE_PREF, 'normal'))
  const [highContrast, setHighContrast]       = useState(() => readShopMenuPref(SHOP_MENU_CONTRAST_PREF, 'false') === 'true')
  const [activeCategory, setActiveCategory]   = useState(null)
  const [callStaffOpen, setCallStaffOpen]       = useState(false)
  const [callStaffReason, setCallStaffReason]   = useState('payment')
  const [callStaffNote, setCallStaffNote]       = useState('')
  const [callStaffDone, setCallStaffDone]       = useState(false)
  const [activeStaffCall, setActiveStaffCall]   = useState(null)
  const [callStaffLoading, setCallStaffLoading] = useState(false)
  const [staffCallNow, setStaffCallNow]         = useState(Date.now())
  const headerRef    = useRef(null)
  const searchInputRef = useRef(null)
  const tableTagInputRef = useRef(null)
  const tableOrdersPromptedRef = useRef(false)
  const [headerH, setHeaderH] = useState(165)
  const categoryRefs = useRef({})
  const staffCallKey = staffCallStorageKey(tokenParam, ctx)

  useEffect(() => {
    if (!rawSearchQuery) return
    setSearchQuery(rawSearchQuery)
    setActiveCategory(null)
    window.setTimeout(() => searchInputRef.current?.focus?.(), 150)
  }, [rawSearchQuery])

  const [cart, setCart] = useState({})
  const [sideForm, setSideForm] = useState({})
  const [optionsTarget, setOptionsTarget] = useState(null)
  const large = displaySize === 'large'
  const visibleOrders = React.useMemo(() => {
    const byCode = new Map()
    ;[...(tokenSession?.orders || []), ...(tableOrders || [])].forEach(order => {
      if (order?.orderCode) byCode.set(order.orderCode, order)
    })
    return [...byCode.values()]
  }, [tableOrders, tokenSession?.orders])
  const activeVisibleOrders = React.useMemo(
    () => visibleOrders.filter(order => order.status !== 'CANCELLED'),
    [visibleOrders]
  )
  const activeTableOrders = React.useMemo(
    () => (tableOrders || []).filter(order => order.status !== 'CANCELLED'),
    [tableOrders]
  )
  const visibleOrderSession = React.useMemo(
    () => ({ ...(tokenSession || {}), orders: visibleOrders }),
    [tokenSession, visibleOrders]
  )

  useEffect(() => {
    setActiveCategory(null)
  }, [language])

  useEffect(() => {
    if (rawLanguage) setLanguage(rawLanguage)
  }, [rawLanguage, setLanguage])

  const trackingPathForOrder = useCallback((order) => {
    if (!order?.orderCode) return
    const sessionToken = ctx?.tokenType === 'QUEUE_QR' ? null : (tokenParam || order.sourceToken)
    const queryParams = new URLSearchParams()
    if (sessionToken) queryParams.set('t', sessionToken)
    if (language) queryParams.set('lang', language)
    const query = queryParams.toString() ? `?${queryParams.toString()}` : ''
    return `/shop/order/${encodeURIComponent(order.orderCode)}${query}`
  }, [ctx?.tokenType, language, tokenParam])

  const openTrackingScreen = useCallback((order, { newTab = false, targetWindow = null } = {}) => {
    const path = trackingPathForOrder(order)
    if (!path) return
    if (newTab) {
      const appBase = window.location.pathname.split('/shop/')[0] || '/bom-inventory'
      const url = `${window.location.origin}${appBase}${path}`
      const tab = targetWindow || window.open(url, '_blank')
      if (tab) {
        try { tab.location.href = url; tab.focus?.() } catch { /* browser may block tab access */ }
        return
      }
    }
    navigate(path)
  }, [navigate, trackingPathForOrder])

  const rememberVisibleOrder = useCallback((order) => {
    if (!order?.orderCode) return
    const upsert = (orders = []) => [order, ...orders.filter(item => item?.orderCode !== order.orderCode)]
    setTokenSession(prev => ({ ...(prev || {}), orders: upsert(prev?.orders || []) }))
    if (ctx?.tableId && order.tableId && String(order.tableId) === String(ctx.tableId)) {
      setTableOrders(prev => upsert(prev || []))
    }
  }, [ctx?.tableId])

  const formatSelectedOptions = useCallback((modelId, selectedOptions) => {
    return localizedSelectedOptions(modelId, selectedOptions, optionsByModel, language)
  }, [language, optionsByModel])

  const resetMobileSearchZoom = useCallback((input = searchInputRef.current) => {
    input?.blur?.()
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const isTouchScreen = window.matchMedia?.('(pointer: coarse)')?.matches
    if (!isTouchScreen) return
    window.setTimeout(() => {
      try {
        const meta = document.querySelector('meta[name="viewport"]')
        const originalViewport = meta?.getAttribute('content') || ''
        if (meta && originalViewport) {
          const resetViewport = originalViewport.includes('maximum-scale')
            ? originalViewport.replace(/maximum-scale\s*=\s*[^,\s]+/i, 'maximum-scale=1.0')
            : `${originalViewport}, maximum-scale=1.0`
          meta.setAttribute('content', resetViewport)
          window.setTimeout(() => meta.setAttribute('content', originalViewport), 300)
        }
        window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: 'auto' })
      } catch { /* keep search usable if viewport APIs are blocked */ }
    }, 60)
  }, [])
  // ── Data loading ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tokenParam) return
    resolveToken(tokenParam)
      .then(({ res, data }) => {
        if (!res.ok) { setError(cText('checkout.invalidQr')); setLoading(false); return }
        const tableId = data.tableId || (data.tokenType === 'QUEUE_QR' ? rawTableId : null)
        const resolved = { tenantId: data.tenantId, companyId: data.companyId, tableId, tokenType: data.tokenType }
        setCtx(resolved)
        if (resolved.tableId || rawCustomerName) {
          setForm(f => ({
            ...f,
            ...(resolved.tableId ? { fulfillmentType: 'DINE_IN' } : {}),
            ...(rawCustomerName ? { customerName: rawCustomerName } : {}),
          }))
        }
      })
      .catch(() => { setError(cText('checkout.cannotReadQr')); setLoading(false) })
  }, [cText, tokenParam, rawTableId, rawCustomerName])

  useEffect(() => {
    if (!ctx) return
    if (!ctx.tenantId || !ctx.companyId) { setError(cText('checkout.missingShop')); setLoading(false); return }
    Promise.all([
      fetchMenu(ctx.tenantId, ctx.companyId),
      fetchPublicMenuOptions(ctx.tenantId, ctx.companyId),
      fetchShopConfig(ctx.tenantId, ctx.companyId),
      fetchPublicTables(ctx.tenantId, ctx.companyId),
    ]).then(([menuRes, optsRes, cfgRes, tablesRes]) => {
      setMenu(Array.isArray(menuRes.data) ? menuRes.data : [])
      const byModel = {}
      ;(Array.isArray(optsRes.data) ? optsRes.data : []).forEach(opt => {
        if (!byModel[opt.modelId]) byModel[opt.modelId] = []
        byModel[opt.modelId].push(opt)
      })
      setOptionsByModel(byModel)
      if (cfgRes.data) setShopConfig(cfgRes.data)
      setPublicTables(Array.isArray(tablesRes.data) ? tablesRes.data : [])
      setLoading(false)
    }).catch(() => { setError(cText('checkout.cannotLoadMenu')); setLoading(false) })
  }, [cText, ctx])

  const refreshMenu = useCallback(() => {
    if (!ctx?.tenantId || !ctx?.companyId) return
    fetchMenu(ctx.tenantId, ctx.companyId)
      .then(menuRes => setMenu(Array.isArray(menuRes.data) ? menuRes.data : []))
      .catch(() => {})
  }, [ctx?.tenantId, ctx?.companyId])

  const loadTokenSession = useCallback(() => {
    if (!tokenParam) return
    fetchTokenSession(tokenParam)
      .then(({ data }) => { if (data?.orders != null) setTokenSession(data) })
      .catch(() => {})
  }, [tokenParam])

  const loadActiveTableOrders = useCallback(() => {
    if (!ctx?.tableId || !ctx?.tenantId || !ctx?.companyId) {
      setTableOrders([])
      return
    }
    fetchActiveTableOrders(ctx.tableId, ctx.tenantId, ctx.companyId)
      .then(({ res, data }) => {
        if (!res.ok) {
          setTableOrders([])
          return
        }
        const orders = Array.isArray(data) ? data : []
        const activeOrders = orders.filter(order => order?.status !== 'CANCELLED')
        setTableOrders(orders)
        if (activeOrders.length > 0 && !tableOrdersPromptedRef.current) {
          tableOrdersPromptedRef.current = true
          setTableOrdersPromptOpen(true)
        }
      })
      .catch(() => {})
  }, [ctx?.tableId, ctx?.tenantId, ctx?.companyId])

  useEffect(() => {
    tableOrdersPromptedRef.current = false
    setTableOrders([])
    setTableOrdersPromptOpen(false)
  }, [ctx?.tableId])

  useEffect(() => {
    loadActiveTableOrders()
    if (!ctx?.tableId) return undefined
    const id = setInterval(loadActiveTableOrders, 5000)
    return () => clearInterval(id)
  }, [ctx?.tableId, loadActiveTableOrders])

  useEffect(() => {
    const id = setInterval(() => setStaffCallNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!staffCallKey || !activeStaffCall?.id) return
    try {
      localStorage.setItem(staffCallKey, JSON.stringify({ call: activeStaffCall, savedAt: new Date().toISOString() }))
    } catch { /* ignore */ }
  }, [staffCallKey, activeStaffCall])

  useEffect(() => {
    if (!staffCallKey || !ctx?.tenantId || !ctx?.companyId) return
    let cancelled = false
    const stored = readStoredStaffCall(staffCallKey)
    if (stored?.id) setActiveStaffCall(prev => prev?.id ? prev : stored)
    const loadStaffCall = async () => {
      try {
        if (stored?.id) {
          const { res, data } = await fetchPublicStaffCall(stored.id, tokenParam, ctx.tenantId, ctx.companyId, ctx.tableId)
          if (cancelled) return
          if (res.ok && data?.id) { setActiveStaffCall(data); return }
        }
        const { res, data } = await fetchLatestPublicStaffCall(tokenParam, ctx.tenantId, ctx.companyId, ctx.tableId)
        if (!cancelled && res.ok && data?.id) setActiveStaffCall(data)
      } catch { /* silent */ }
    }
    loadStaffCall()
    return () => { cancelled = true }
  }, [staffCallKey, tokenParam, ctx?.tenantId, ctx?.companyId, ctx?.tableId])
  useEffect(() => {
    loadTokenSession()
    if (!tokenParam) return
    const id = setInterval(loadTokenSession, 5000)
    return () => clearInterval(id)
  }, [loadTokenSession, tokenParam])
  useEffect(() => {
    if (!activeStaffCall?.id || activeStaffCall.replyMessage || activeStaffCall.status === 'DISMISSED') return
    let cancelled = false
    const poll = async () => {
      try {
        const { data } = await fetchPublicStaffCall(activeStaffCall.id, tokenParam, ctx?.tenantId, ctx?.companyId, ctx?.tableId)
        if (cancelled || !data?.id) return
        setActiveStaffCall(data)
        if (data.replyMessage) setCallStaffDone(true)
      } catch { /* silent */ }
    }
    const intervalId = setInterval(poll, 5000)
    poll()
    return () => { cancelled = true; clearInterval(intervalId) }
  }, [activeStaffCall?.id, activeStaffCall?.replyMessage, activeStaffCall?.status, tokenParam, ctx?.tenantId, ctx?.companyId, ctx?.tableId])

  useEffect(() => {
    if (!editOrderCode || loading) return
    fetchPublicOrder(editOrderCode)
      .then(async ({ data }) => {
        if (!data?.orderCode) return
        try { await startCustomerEdit(data.orderCode) } catch { /* backend lock optional */ }
        restoreCartFromOrder(data)
        setEditingOrderCode(data.orderCode)
        setCartOpen(true)
        const nextParams = new URLSearchParams()
        if (tokenParam) {
          nextParams.set('t', tokenParam)
        } else {
          if (data.tenantId || ctx?.tenantId) nextParams.set('tenantId', data.tenantId || ctx.tenantId)
          if (data.companyId || ctx?.companyId) nextParams.set('companyId', data.companyId || ctx.companyId)
          if (data.tableId || ctx?.tableId) nextParams.set('tableId', data.tableId || ctx.tableId)
        }
        navigate({ search: nextParams.toString() }, { replace: true })
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOrderCode, loading, tokenParam, ctx?.tenantId, ctx?.companyId, ctx?.tableId, navigate])

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
  const modelImageMap = menu.reduce((map, m) => {
    const img = m.imageUrl || m.thumbnailUrl || ''
    if (img) map[m.id] = img
    return map
  }, {})

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
  const voucherDisplayCode = voucherPayload
    ? (voucherPayload.startsWith('BV:') ? voucherPayload.split(':')[1] || 'Voucher QR' : voucherPayload)
    : ''

  const getModelQty = (modelId) =>
    cartEntries.reduce((n, e) => n + (e.modelId === modelId ? e.qty : 0), 0)

  const getCartModelTotalQty = (modelId, entries = cartEntries) =>
    entries.reduce((total, entry) => {
      const mainQty = String(entry.modelId) === String(modelId) ? Number(entry.qty || 0) : 0
      const sideQty = (entry.sideItems || []).reduce((sum, side) => (
        String(side.modelId) === String(modelId)
          ? sum + Number(side.qty || 0) * Number(entry.qty || 0)
          : sum
      ), 0)
      return total + mainQty + sideQty
    }, 0)

  const dailyLimitFor = (model) => model?.shopDailyLimitUnits != null ? Number(model.shopDailyLimitUnits) : null
  const dailyRemainingFor = (model) => {
    if (dailyLimitFor(model) == null) return null
    return Math.max(0, Math.floor(Number(model?.shopDailyRemainingUnits ?? 0)))
  }
  const availableToAddForModel = (model, entries = cartEntries) => {
    const remaining = dailyRemainingFor(model)
    if (remaining == null) return null
    return Math.max(0, remaining - getCartModelTotalQty(model.id, entries))
  }
  const soldOutMessage = (model, available = 0) => {
    const label = modelName(model)
    return available <= 0
      ? cText('daily.soldOutItem', { item: label })
      : cText('daily.leftItem', { item: label, count: available })
  }
  const dailyAvailabilityLabel = (available) =>
    available <= 0 ? cText('daily.soldOut') : cText('daily.left', { count: available })

  const grouped = menu.reduce((g, m) => {
    const cat = modelCategory(m) || t('shop.menu')
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  const categories = Object.keys(grouped)

  const filteredItems = searchQuery.trim()
    ? menu.filter(m => modelName(m).toLowerCase().includes(searchQuery.toLowerCase()))
    : []

  // Items shown when a category chip is active (no search)
  const categoryItems = !searchQuery.trim() && activeCategory ? (grouped[activeCategory] || []) : []

  const relativeStaffCallAge = useCallback((value, now) => {
    const ts = Number(new Date(value || 0))
    if (!Number.isFinite(ts) || ts <= 0) return ''
    const mins = Math.max(0, Math.floor((now - ts) / 60000))
    if (mins < 1) return t('shop.justNow')
    if (mins < 60) return t('shop.minutesAgo', { count: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t('shop.hoursAgo', { count: hours })
    return t('shop.daysAgo', { count: Math.floor(hours / 24) })
  }, [t])

  const staffCallAge = activeStaffCall
    ? relativeStaffCallAge(activeStaffCall.repliedAt || activeStaffCall.createdAt, staffCallNow)
    : ''
  const staffCallHasReply = Boolean(activeStaffCall?.replyMessage)
  const staffCallTitle = staffCallHasReply
    ? t('shop.counterReplied')
    : activeStaffCall?.status === 'DISMISSED'
      ? t('shop.staffHandled')
      : t('shop.staffCalled')
  const staffCallMessage = staffCallHasReply
    ? activeStaffCall.replyMessage
    : activeStaffCall?.status === 'DISMISSED'
      ? t('shop.requestHandled')
      : t('shop.waitingStaffReply')
  const allowedSideOptionsFor = (model) => decorateAllowedSideOptions(menu, model?.allowedSideIds)
  const maxAllowedSideQty = (parentModelId, sideModelId) => {
    const parent = menu.find(item => String(item.id) === String(parentModelId))
    return getAllowedSideMax(parent?.allowedSideIds, sideModelId) || 0
  }
  const clampAllowedSideQty = (parentModelId, sideModelId, quantity) => {
    const requested = Math.max(0, Math.floor(Number(quantity) || 0))
    const limit = maxAllowedSideQty(parentModelId, sideModelId)
    return limit > 0 ? Math.min(limit, requested) : requested
  }

  // ── Cart mutations ────────────────────────────────────────────────────
  const createEntry = (model, qty, selectedOptions, itemNotes, rawSides = []) => {
    const available = availableToAddForModel(model)
    const finalQty = available != null ? Math.min(Math.max(0, available), qty) : qty
    if (finalQty <= 0) {
      setError(soldOutMessage(model, 0))
      return
    }
    const id = genUid()
    const allowedSideIds = new Set(allowedSideOptionsFor(model).map(side => String(side.id)))
    const sideItems = rawSides
      .filter(side => allowedSideIds.has(String(side.modelId)))
      .map(side => {
        const sideModel = menu.find(item => String(item.id) === String(side.modelId))
        const sideAvailable = sideModel ? availableToAddForModel(sideModel) : null
        const dailySideMaxPerMain = sideAvailable != null && finalQty > 0 ? Math.floor(sideAvailable / finalQty) : null
        const requestedQty = clampAllowedSideQty(model.id, side.modelId, side.qty)
        return {
          ...side,
          imageUrl: side.imageUrl || side.thumbnailUrl || null,
          qty: dailySideMaxPerMain != null ? Math.min(requestedQty, dailySideMaxPerMain) : requestedQty,
          uid: genUid(),
        }
      })
      .filter(side => side.qty > 0)
    setCart(prev => ({
      ...prev,
      [id]: { uid: id, modelId: model.id, imageUrl: model.imageUrl || model.thumbnailUrl || null, qty: finalQty, selectedOptions: selectedOptions || null, itemNotes: itemNotes || null, sideItems },
    }))
    if (available != null && finalQty < qty) setError(soldOutMessage(model, available))
  }

  const deleteEntry = (uid) =>
    setCart(prev => { const { [uid]: _, ...rest } = prev; return rest })

  const incrementEntry = (uid) => {
    const entry = cart[uid]
    const model = entry ? menu.find(item => String(item.id) === String(entry.modelId)) : null
    const available = model ? availableToAddForModel(model) : null
    if (available != null && available <= 0) {
      setError(soldOutMessage(model, 0))
      return
    }
    const blockingSide = (entry?.sideItems || []).map(side => {
      const sideModel = menu.find(item => String(item.id) === String(side.modelId))
      const sideAvailable = sideModel ? availableToAddForModel(sideModel) : null
      const additionalQty = Math.max(0, Number(side.qty || 0))
      return sideAvailable != null && additionalQty > sideAvailable
        ? { sideModel, sideAvailable }
        : null
    }).find(Boolean)
    if (blockingSide?.sideModel) {
      setError(soldOutMessage(blockingSide.sideModel, blockingSide.sideAvailable))
      return
    }
    setCart(prev => { const e = prev[uid]; if (!e) return prev; return { ...prev, [uid]: { ...e, qty: e.qty + 1 } } })
  }

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
    const parent = cart[parentUid]; if (!parent) return
    const currentSides = parent.sideItems || []
    const existing = currentSides.find(si => String(si.modelId) === String(sf.model.id))
    const currentQty = existing?.qty || 0
    const requestedQty = Math.max(1, sf.qty || 1)
    const limit = maxAllowedSideQty(parent.modelId, sf.model.id)
    const allowedByMenu = limit > 0 ? Math.max(0, limit - currentQty) : null
    const sideAvailable = availableToAddForModel(sf.model)
    const parentQty = Math.max(1, Number(parent.qty || 1))
    const allowedByDaily = sideAvailable != null ? Math.floor(sideAvailable / parentQty) : null
    const allowedAddQty = [allowedByMenu, allowedByDaily]
      .filter(v => v != null)
      .reduce((min, v) => Math.min(min, v), requestedQty)
    const addQty = Math.max(0, Math.min(requestedQty, allowedAddQty))
    if (addQty <= 0) {
      if (sideAvailable != null) setError(soldOutMessage(sf.model, sideAvailable || 0))
      return
    }
    const nextQty = currentQty + addQty
    setCart(prev => {
      const currentParent = prev[parentUid]; if (!currentParent) return prev
      const nextCurrentSides = currentParent.sideItems || []
      const nextExisting = nextCurrentSides.find(si => String(si.modelId) === String(sf.model.id))
      const nextSideItems = nextExisting
        ? nextCurrentSides.map(si => si.uid === nextExisting.uid ? { ...si, qty: nextQty } : si)
        : [...nextCurrentSides, { uid: genUid(), modelId: sf.model.id, modelName: sf.model.modelName, imageUrl: sf.model.imageUrl || sf.model.thumbnailUrl || null, qty: nextQty }]
      return { ...prev, [parentUid]: { ...currentParent, sideItems: nextSideItems } }
    })
    if (addQty < requestedQty && sideAvailable != null) setError(soldOutMessage(sf.model, sideAvailable))
    setSideForm(prev => ({ ...prev, [parentUid]: {} }))
  }

  const changeSideQty = (parentUid, sideUid, delta) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return { ...prev, [parentUid]: { ...parent,
        sideItems: parent.sideItems
          .map(si => {
            if (si.uid !== sideUid) return si
            const limit = maxAllowedSideQty(parent.modelId, si.modelId)
            const sideModel = menu.find(item => String(item.id) === String(si.modelId))
            const sideAvailable = sideModel ? availableToAddForModel(sideModel, Object.values(prev)) : null
            const dailyMax = sideAvailable != null
              ? (si.qty || 0) + Math.floor(sideAvailable / Math.max(1, Number(parent.qty || 1)))
              : null
            const requested = Math.max(0, (si.qty || 1) + delta)
            const cappedByMenu = limit > 0 ? Math.min(limit, requested) : requested
            return { ...si, qty: dailyMax != null ? Math.min(dailyMax, cappedByMenu) : cappedByMenu }
          })
          .filter(si => si.qty > 0) } }
    })

  const removeSide = (parentUid, sideUid) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return { ...prev, [parentUid]: { ...parent, sideItems: parent.sideItems.filter(si => si.uid !== sideUid) } }
    })

  // ── Menu card click handlers ──────────────────────────────────────────
  const handleAddClick = (model) => {
    const available = availableToAddForModel(model)
    if (available != null && available <= 0) {
      setError(soldOutMessage(model, 0))
      return
    }
    const hasOpts = (optionsByModel[model.id] || []).length > 0
    const allowedSideOptions = allowedSideOptionsFor(model).map(side => ({
      ...side,
      dailyRemainingForCart: availableToAddForModel(side),
    }))
    const hasSides = allowedSideOptions.length > 0
    if (hasOpts || hasSides) {
      setOptionsTarget({ model, allowedSideOptions, maxQty: available })
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
    const available = availableToAddForModel(optionsTarget.model)
    const finalQty = available != null ? Math.min(qty, available) : qty
    if (finalQty > 0) createEntry(optionsTarget.model, finalQty, selectedOptions, itemNotes, sideItems || [])
    else setError(soldOutMessage(optionsTarget.model, 0))
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
        uid: genUid(), modelId: child.modelId, modelName: child.modelName, imageUrl: child.imageUrl || child.thumbnailUrl || null,
        qty: clampAllowedSideQty(it.modelId, child.modelId, Math.max(1, Math.round(Number(child.quantity) / parentQty))),
      }))
      newCart[uid] = { uid, modelId: it.modelId, imageUrl: it.imageUrl || it.thumbnailUrl || null, qty: Number(it.quantity) || 1,
        selectedOptions: it.selectedOptions || null, itemNotes: it.itemNotes || null, sideItems }
    })
    setCart(newCart); setSideForm({})
  }

  const buildItemRequests = () => cartEntries.map(entry => {
    const parentModel = menu.find(model => String(model.id) === String(entry.modelId))
    const allowedSideIds = new Set(allowedSideOptionsFor(parentModel).map(side => String(side.id)))
    return {
      modelId: entry.modelId, quantity: entry.qty,
      selectedOptions: entry.selectedOptions || null, itemNotes: entry.itemNotes || null,
      sideItems: (entry.sideItems || [])
        .filter(side => allowedSideIds.has(String(side.modelId)))
        .map(side => ({
          modelId: side.modelId,
          quantity: clampAllowedSideQty(entry.modelId, side.modelId, side.qty) * (entry.qty || 1),
          selectedOptions: null,
          itemNotes: null,
          sideItems: [],
        }))
        .filter(side => side.quantity > 0),
    }
  })

  const showVoucherSnack = (message, severity = 'success') =>
    setVoucherSnack({ open: true, message, severity })

  const handleVoucherScan = (payload) => {
    const clean = String(payload || '').trim()
    setVoucherScanOpen(false)
    if (!clean) return
    setVoucherPayload(clean)
    setError('')
  }

  const applyVoucherToOrder = async (order) => {
    const code = voucherPayload.trim()
    if (!code || !order?.orderCode) return order
    try {
      const { res, data } = await redeemPublicVoucher(code, order.orderCode)
      if (!res.ok) {
        showVoucherSnack(data?.error || data?.message || 'Voucher không hợp lệ hoặc đã hết hạn.', 'error')
        return order
      }
      const nextOrder = data?.order || order
      setVoucherPayload('')
      showVoucherSnack(cText('checkout.voucherApplied', { code: data?.voucher?.code || '' }).trim())
      return nextOrder
    } catch {
      showVoucherSnack(cText('checkout.voucherFailed'), 'error')
      return order
    }
  }
  const dailyLimitErrorText = (data, fallbackKey) => {
    if (data?.code !== 'DAILY_MENU_LIMIT_EXCEEDED') {
      return data?.message || data?.error || cText(fallbackKey)
    }
    const cappedModel = menu.find(item => String(item.id) === String(data.modelId))
      || { id: data.modelId, modelName: data.modelName || 'Item' }
    const remaining = Math.max(0, Math.floor(Number(data.remainingUnits ?? 0)))
    return soldOutMessage(cappedModel, remaining)
  }
  const handlePlaceOrder = async () => {
    if (!itemCount) return
    if (!editingOrderCode) {
      const name = form.customerName.trim()
      const phone = form.customerPhone.trim()
      if (form.fulfillmentType === 'DINE_IN' && !ctx?.tableId && !form.selectedTableId && !form.customerTableTag.trim()) {
        setError('')
        window.alert(cText('checkout.needTable'))
        window.setTimeout(() => tableTagInputRef.current?.focus(), 0)
        return
      }
      if (form.fulfillmentType === 'PICKUP' && !name) {
        setError(cText('checkout.needPickupName')); return
      }
      if (form.fulfillmentType === 'PICKUP' && !phone) {
        setError(cText('checkout.needPickupPhone')); return
      }
      if (form.fulfillmentType === 'DELIVERY' && !name) {
        setError(cText('checkout.needDeliveryName')); return
      }
      if (form.fulfillmentType === 'DELIVERY' && !phone) {
        setError(cText('checkout.needDeliveryPhone')); return
      }
      if (form.fulfillmentType === 'DELIVERY' && !form.requestedFulfillmentAt) {
        setError(cText('checkout.needDeliveryTime')); return
      }
      if (form.fulfillmentType === 'DELIVERY' && !form.deliveryAddress.trim()) {
        setError(cText('checkout.needDeliveryAddress')); return
      }
    }
    const trackingTab = !editingOrderCode && form.paymentMethod !== 'BANK_QR'
      ? window.open('about:blank', '_blank')
      : null
    const closeTrackingTab = () => {
      try { trackingTab?.close?.() } catch { /* browser may block close */ }
    }
    setSubmitting(true); setError('')
    const items = buildItemRequests()
    try {
      if (editingOrderCode) {
        const { res, data } = await updatePublicOrderItems(editingOrderCode, items)
        if (!res.ok) { setError(dailyLimitErrorText(data, 'checkout.cannotUpdateOrder')); setSubmitting(false); return }
        const updatedOrder = { ...data, customerEditing: false, customerEditingSince: null }
        const finalOrderRaw = await applyVoucherToOrder(updatedOrder)
        const finalOrder = { ...finalOrderRaw, customerEditing: false, customerEditingSince: null }
        rememberVisibleOrder(finalOrder)
        setCart({}); setSideForm({}); setCheckout(false); setCartOpen(false)
        setEditingOrderCode(null); setTrackingOrder(finalOrder)
        loadTokenSession()
        refreshMenu()
      } else {
        const body = {
          fulfillmentType: form.fulfillmentType,
          tableId: form.fulfillmentType === 'DINE_IN' ? (ctx.tableId || form.selectedTableId || null) : null,
          customerName: form.customerName || null, customerPhone: form.customerPhone || null,
          deliveryAddress: form.fulfillmentType === 'DELIVERY' ? form.deliveryAddress : null,
          customerTableTag: form.fulfillmentType === 'DINE_IN' ? form.customerTableTag || null : null,
          requestedFulfillmentAt: form.fulfillmentType === 'DELIVERY' && form.requestedFulfillmentAt
            ? new Date(form.requestedFulfillmentAt).toISOString() : null,
          deliveryFee: null, paymentMethod: form.paymentMethod, notes: notes || null,
          manualOrderNumber: seqParam ? Number(seqParam) : null, token: tokenParam || null, items,
        }
        const { res, data } = await createOrder(ctx.tenantId, ctx.companyId, body)
        if (!res.ok) { closeTrackingTab(); setError(dailyLimitErrorText(data, 'checkout.cannotCreateOrder')); setSubmitting(false); return }
        const finalOrder = await applyVoucherToOrder(data)
        rememberVisibleOrder(finalOrder)
        setCart({}); setSideForm({}); setNotes(''); setCheckout(false); setCartOpen(false)
        refreshMenu()
        if (form.paymentMethod === 'BANK_QR' && finalOrder.paymentQr) {
          setPrepaidQrOrder(finalOrder)
        } else {
          openTrackingScreen(finalOrder, { newTab: true, targetWindow: trackingTab })
          setSessionOpen(true)
        }
      }
    } catch { closeTrackingTab(); setError(cText('common.networkError')) } finally { setSubmitting(false) }
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

  const pickCallStaffOrder = () => {
    const activeStatuses = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY'])
    const timestamp = order => Number(new Date(order?.createdAt || 0)) || 0
    const candidates = [...(tokenSession?.orders || []), ...(tableOrders || [])].filter(Boolean)
    const active = candidates
      .filter(order => activeStatuses.has(order.status))
      .sort((a, b) => timestamp(b) - timestamp(a))
    if (active.length > 0) return active[0]
    return candidates
      .filter(order => order.status !== 'CANCELLED')
      .sort((a, b) => timestamp(b) - timestamp(a))[0] || null
  }
  const handleCallStaff = async () => {
    setCallStaffLoading(true); setError('')
    try {
      const callOrder = pickCallStaffOrder()
      const { res, data } = await callStaff(ctx.tenantId, ctx.companyId, ctx.tableId, callStaffReason, callStaffNote, tokenParam, callOrder)
      if (!res.ok) {
        setError(data?.error || 'Không gọi được nhân viên. Vui lòng báo trực tiếp.')
        setCallStaffLoading(false)
        return
      }
      const nextStaffCall = data || null
      setActiveStaffCall(nextStaffCall)
      if (staffCallKey && nextStaffCall?.id) {
        try {
          localStorage.setItem(staffCallKey, JSON.stringify({ call: nextStaffCall, savedAt: new Date().toISOString() }))
        } catch { /* ignore */ }
      }
      setCallStaffOpen(false)
      setCallStaffReason('payment')
      setCallStaffNote('')
      setCallStaffDone(true)
    } catch {
      setError('Lỗi mạng khi gọi nhân viên. Vui lòng thử lại.')
    }
    setCallStaffLoading(false)
  }

  // ── CartEntryList (closure for handler access) ────────────────────────
  const renderCartEntryList = () => (
    <Stack spacing={0.75}>
      {cartEntries.map((entry, idx) => {
        const m      = menu.find(x => x.id === entry.modelId)
        if (!m) return null
        const entryImage = entry.imageUrl || entry.thumbnailUrl || m.imageUrl || m.thumbnailUrl || ''
        const opts   = parseOpts(entry.selectedOptions)
        const groups = optionsByModel[entry.modelId] || []
        const sf        = sideForm[entry.uid] || {}
        const eTotal    = entryTotal(entry)
        const sides     = entry.sideItems || []
        const unitPrice = Number(m.sellingPrice || 0) + calcOptAddOn(entry)
        const mainTotal = entry.qty * unitPrice
        const sideTotal = eTotal - mainTotal
        const allowedSideOptions = allowedSideOptionsFor(m)
        const canAddSides = allowedSideOptions.length > 0
        const sideFormModelId = sf.model?.id
        const sideFormMaxQty = sideFormModelId ? maxAllowedSideQty(entry.modelId, sideFormModelId) : 0
        const sideFormCurrentQty = sideFormModelId
          ? Number(sides.find(side => String(side.modelId) === String(sideFormModelId))?.qty || 0)
          : 0
        const sideFormRemainingQty = sideFormMaxQty > 0
          ? Math.max(0, sideFormMaxQty - sideFormCurrentQty)
          : null
        const sideFormDailyAvailable = sf.model ? availableToAddForModel(sf.model) : null
        const sideFormDailyRemainingQty = sideFormDailyAvailable != null
          ? Math.floor(sideFormDailyAvailable / Math.max(1, Number(entry.qty || 1)))
          : null
        const sideFormEffectiveRemainingQty = [sideFormRemainingQty, sideFormDailyRemainingQty]
          .filter(v => v != null)
          .reduce((min, v) => Math.min(min, v), Number.POSITIVE_INFINITY)
        const sideFormRemainingMax = Number.isFinite(sideFormEffectiveRemainingQty) ? Math.max(0, sideFormEffectiveRemainingQty) : null
        const sideFormQty = sideFormRemainingMax == null
          ? Math.max(1, Number(sf.qty) || 1)
          : Math.min(sideFormRemainingMax, Math.max(1, Number(sf.qty) || 1))
        const sideFormAtMax = sideFormRemainingMax === 0

        return (
          <Box key={entry.uid} sx={{ border: highContrast ? '2px solid #111827' : '1.5px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', bgcolor: '#fff' }}>
            <Box sx={{ bgcolor: highContrast ? '#fff' : '#f8faff', px: large ? 1.75 : 1.5, pt: large ? 1.25 : 1, pb: large ? 1 : 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography sx={{ color: '#94a3b8', fontWeight: 700, fontSize: large ? 15 : 13, flexShrink: 0 }}>{idx + 1}.</Typography>
                <Box onClick={() => entryImage && setImagePreview({ imageUrl: entryImage, modelName: modelName(m) })}
                  sx={{ width: large ? 64 : 52, height: large ? 64 : 52, flexShrink: 0, borderRadius: 1.5, bgcolor: '#eef2f7', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: entryImage ? 'pointer' : 'default' }}>
                  {entryImage ? (
                    <Box component="img" src={entryImage} alt={modelName(m)}
                      onError={e => { e.target.style.display = 'none' }}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: large ? 22 : 18 }}>
                      {String(modelName(m) || '?').slice(0, 1)}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 100, overflow: 'hidden' }}>
                  <Typography fontWeight={800} sx={{ fontSize: large ? 19 : 16, color: '#0f172a', lineHeight: 1.2 }} noWrap>{modelName(m)}</Typography>
                  <Typography sx={{ color: '#64748b', fontSize: large ? 15 : 13, fontWeight: 700 }}>{fmt(unitPrice)} / ly</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton onClick={() => decrementEntry(entry.uid)} sx={{ p: 0.75 }}>
                    <RemoveIcon sx={{ fontSize: large ? 24 : 20 }} />
                  </IconButton>
                  <Typography fontWeight={800} sx={{ minWidth: large ? 36 : 30, textAlign: 'center', fontSize: large ? 22 : 18 }}>{entry.qty}</Typography>
                  <IconButton onClick={() => incrementEntry(entry.uid)}
                    sx={{ p: 0.75, bgcolor: '#ff5722', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#e64a19' } }}>
                    <AddIcon sx={{ fontSize: large ? 24 : 20 }} />
                  </IconButton>
                </Box>
                <Typography color="primary" fontWeight={800} sx={{ minWidth: large ? 92 : 74, textAlign: 'right', fontSize: large ? 18 : 15 }}>
                  {fmt(mainTotal)}
                </Typography>
                <IconButton color="error" onClick={() => deleteEntry(entry.uid)} sx={{ p: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: large ? 26 : 22 }} />
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
                      sx={{ fontSize: large ? 14 : 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {optionGroupName(grp)}{grp.required ? ' *' : ''}{grp.isFree ? ' (free)' : ''}
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
                              <Typography sx={{ flex: 1, fontSize: large ? 16 : 13, fontWeight: cQty > 0 ? 800 : 600, color: cQty > 0 ? '#1e293b' : '#475569' }} noWrap>
                                {choiceName(c)}{tag}
                              </Typography>
                              {cQty === 0 ? (
                                <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, 1)}
                                  sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                                  <AddIcon sx={{ fontSize: large ? 22 : 18 }} />
                                </IconButton>
                              ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                  <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, -1)}
                                    sx={{ p: 0.5, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                                    <RemoveIcon sx={{ fontSize: large ? 22 : 18 }} />
                                  </IconButton>
                                  <Typography fontWeight={800} sx={{ minWidth: large ? 28 : 22, textAlign: 'center', fontSize: large ? 18 : 15, color: '#4f46e5' }}>
                                    {cQty}
                                  </Typography>
                                  <IconButton size="small" onClick={() => setOptionQty(entry.uid, grp.groupName, c.label, 1)}
                                    sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                                    <AddIcon sx={{ fontSize: large ? 22 : 18 }} />
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
                            <Chip key={c.label} label={choiceName(c)} size="small"
                              onClick={() => toggleOption(entry.uid, grp.groupName, c.label, grp.multiSelect)}
                              sx={{ height: large ? 36 : 30, fontSize: large ? 15 : 13, cursor: 'pointer',
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
                  {sides.map(si => {
                    const sm = menu.find(x => x.id === si.modelId)
                    const sideImage = si.imageUrl || si.thumbnailUrl || sm?.imageUrl || sm?.thumbnailUrl || ''
                    const sideMaxQty = maxAllowedSideQty(entry.modelId, si.modelId)
                    const perCup = si.qty || 1; const effectiveQty = perCup * entry.qty
                    const effectivePrice = sm ? effectiveQty * Number(sm.sellingPrice || 0) : 0
                    const sideDailyAvailable = sm ? availableToAddForModel(sm) : null
                    const sideDailyAddPerCup = sideDailyAvailable != null
                      ? Math.floor(sideDailyAvailable / Math.max(1, Number(entry.qty || 1)))
                      : null
                    const sideDailyAtMax = sideDailyAddPerCup != null && sideDailyAddPerCup <= 0
                    return (
                      <Box key={si.uid} sx={{ px: 1, py: 1, borderBottom: '1px solid #e8eaf6' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box onClick={() => sideImage && setImagePreview({ imageUrl: sideImage, modelName: modelName(si) })}
                            sx={{ width: large ? 64 : 52, height: large ? 64 : 52, flexShrink: 0, borderRadius: 1.5, bgcolor: '#e8eaf6', overflow: 'hidden', border: '1px solid #c7d2fe',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sideImage ? 'pointer' : 'default' }}>
                            {sideImage ? <Box component="img" src={sideImage} alt={modelName(si)}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={e => { e.target.style.display = 'none' }} />
                              : <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: large ? 22 : 18 }}>{String(modelName(si) || '?').slice(0, 1)}</Typography>}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={800} sx={{ fontSize: large ? 17 : 14, color: '#1e293b' }} noWrap>{modelName(si)}</Typography>
                            <Typography sx={{ color: '#6366f1', fontSize: large ? 15 : 13, fontWeight: 800 }}>{sm ? fmt(effectivePrice) : ''}</Typography>
                            {sideMaxQty > 0 && <Typography sx={{ color: '#64748b', fontSize: large ? 13 : 11 }}>Max {sideMaxQty}</Typography>}
                            {sideDailyAvailable != null && <Typography sx={{ color: sideDailyAvailable <= 0 ? '#dc2626' : '#64748b', fontSize: large ? 13 : 11, fontWeight: 800 }}>{dailyAvailabilityLabel(sideDailyAvailable)}</Typography>}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <IconButton onClick={() => changeSideQty(entry.uid, si.uid, -1)}
                              sx={{ p: 0.75, color: '#94a3b8', bgcolor: '#f1f5f9', borderRadius: 1 }}>
                              <RemoveIcon sx={{ fontSize: large ? 24 : 20 }} />
                            </IconButton>
                            <Typography fontWeight={800} sx={{ minWidth: large ? 34 : 28, textAlign: 'center', fontSize: large ? 22 : 18, color: '#4f46e5' }}>
                              {effectiveQty}
                            </Typography>
                            <IconButton onClick={() => changeSideQty(entry.uid, si.uid, 1)} disabled={(sideMaxQty > 0 && perCup >= sideMaxQty) || sideDailyAtMax}
                              sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                              <AddIcon sx={{ fontSize: large ? 24 : 20 }} />
                            </IconButton>
                          </Box>
                          <IconButton onClick={() => removeSide(entry.uid, si.uid)} sx={{ p: 0.5, color: '#94a3b8' }}>
                            <CloseIcon sx={{ fontSize: large ? 26 : 22 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    )
                  })}
                  {sides.length > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1, py: 0.75, borderTop: '1px dashed #c7d2fe' }}>
                      <Typography sx={{ color: '#64748b', fontSize: large ? 15 : 13 }}>{fmt(mainTotal)} + {fmt(sideTotal)} topping</Typography>
                      <Typography fontWeight={800} color="primary" sx={{ fontSize: large ? 18 : 15 }}>= {fmt(eTotal)}</Typography>
                    </Box>
                  )}
                  {canAddSides && (
                    <Box sx={{ pt: 0.75, pb: 1, px: 1 }}>
                      <Autocomplete size="small" options={allowedSideOptions} getOptionLabel={m => modelName(m)}
                        value={sf.model || null} onChange={(_, v) => setSideForm(prev => ({
                          ...prev,
                          [entry.uid]: { model: v, qty: 1 },
                        }))}
                        renderOption={(props, option) => {
                          const img = option.imageUrl || option.thumbnailUrl || ''
                          return (
                            <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: large ? 58 : 48 }}>
                              <Box onClick={(e) => { e.stopPropagation(); img && setImagePreview({ imageUrl: img, modelName: modelName(option) }) }}
                                sx={{ width: large ? 44 : 36, height: large ? 44 : 36, flexShrink: 0, borderRadius: 1, bgcolor: '#e8eaf6', overflow: 'hidden', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: img ? 'pointer' : 'default' }}>
                                {img ? <Box component="img" src={img} alt={modelName(option)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                                  : <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: large ? 18 : 14 }}>{String(modelName(option) || '?').slice(0, 1)}</Typography>}
                              </Box>
                              <Typography sx={{ fontWeight: 800, fontSize: large ? 16 : 14, color: '#1e293b' }} noWrap>{modelName(option)}</Typography>
                            </Box>
                          )
                        }}
                        renderInput={params => <TextField {...params} label="Add topping" size="small"
                          InputProps={{ ...params.InputProps, sx: { fontSize: large ? 16 : 14 } }}
                          inputProps={{ ...params.inputProps, style: { ...params.inputProps.style, fontSize: large ? 16 : 14 } }} />}
                        isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="Không có" fullWidth />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <IconButton onClick={() => setSF(entry.uid, 'qty', Math.max(1, sideFormQty - 1))}
                          disabled={sideFormQty <= 1}
                          sx={{ p: 0.75, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                          <RemoveIcon sx={{ fontSize: large ? 24 : 20 }} />
                        </IconButton>
                        <Typography fontWeight={800} sx={{ minWidth: large ? 34 : 28, textAlign: 'center', fontSize: large ? 22 : 18, color: '#4f46e5' }}>
                          {sideFormQty}
                        </Typography>
                        <IconButton onClick={() => setSF(entry.uid, 'qty', sideFormQty + 1)}
                          disabled={!sf.model || (sideFormRemainingMax != null && sideFormQty >= sideFormRemainingMax)}
                          sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1 }}>
                          <AddIcon sx={{ fontSize: large ? 24 : 20 }} />
                        </IconButton>
                        <Box sx={{ flex: 1 }} />
                        <Button variant="contained" startIcon={<PlaylistAddIcon />}
                          onClick={() => addSideInline(entry.uid)} disabled={!sf.model || sideFormAtMax}
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

  const renderCartPanel = (onCheckout) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6" fontWeight={800}>{t('shop.cart')}</Typography>
      {itemCount === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
          <ShoppingCartIcon sx={{ fontSize: 36, mb: 0.5, opacity: 0.3 }} />
          <Typography variant="body2">Thêm món để bắt đầu đặt hàng</Typography>
        </Box>
      ) : (
        <>
          {renderCartEntryList()}
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography fontWeight={700} sx={{ fontSize: 17 }}>{t('common.total')}</Typography>
            <Typography fontWeight={900} color="primary" sx={{ fontSize: 18 }}>{fmt(totalAmount)}</Typography>
          </Box>
          <TextField size="small" fullWidth multiline rows={2} label={t('shop.orderNote')}
            placeholder={t('shop.specialRequest')} value={notes} onChange={e => setNotes(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />
          <Button variant="contained" fullWidth size="large" onClick={onCheckout}
            sx={{ borderRadius: 20, fontWeight: 800, textTransform: 'none', fontSize: 15,
              bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' } }}>
            {t('shop.placeOrder')} - {fmt(totalAmount)}
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
    const optsStr  = variants.length === 1 ? formatSelectedOptions(m.id, variants[0]?.selectedOptions) : null
    const available = availableToAddForModel(m)
    const capped = available != null
    const soldOutForCart = capped && available <= 0
    return (
      <Box sx={{
        display: 'flex', alignItems: 'stretch', bgcolor: '#fff', borderRadius: 2, overflow: 'hidden',
        border: qty > 0 ? '2px solid #ff5722' : highContrast ? '1.5px solid #111827' : '1.5px solid transparent',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <Box onClick={() => m.imageUrl && setImagePreview(m)} sx={{
          width: large ? 116 : 96, flexShrink: 0, bgcolor: '#f5f5f5', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: m.imageUrl ? 'pointer' : 'default',
        }}>
          {m.imageUrl
            ? <Box component="img" src={m.imageUrl} alt={modelName(m)}
                sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { e.target.style.display = 'none' }} />
            : <Typography sx={{ fontSize: large ? 42 : 34, opacity: 0.15, userSelect: 'none' }}>🍽</Typography>}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, px: 1.5, py: 1.25 }}>
          <Typography fontWeight={700} sx={{ fontSize: large ? 18 : 15, lineHeight: 1.25, color: '#111827' }}>
            {modelName(m)}
          </Typography>
          {m.ingredients && (
            <Typography sx={{ color: '#64748b', fontSize: large ? 13 : 11, lineHeight: 1.35, mt: 0.35,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {m.ingredients}
            </Typography>
          )}
          {hasOpts && !optsStr && (
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: large ? 13 : 11 }}>{t('shop.customizable')}</Typography>
          )}
          {optsStr && (
            <Typography variant="caption" sx={{ color: '#ff5722', fontSize: large ? 13 : 11, display: 'block' }} noWrap>
              {optsStr}
            </Typography>
          )}
          {variants.length > 1 && (
            <Chip label={t('shop.optionVariants', { count: variants.length })} size="small"
              sx={{ height: large ? 22 : 18, fontSize: large ? 12 : 10, bgcolor: '#fff3e0', color: '#ff5722', mt: 0.5 }} />
          )}
          <Typography fontWeight={800} sx={{ color: '#ff5722', fontSize: large ? 18 : 15, mt: 0.75 }}>
            {fmt(m.sellingPrice)}
          </Typography>
          {capped && (
            <Chip
              label={dailyAvailabilityLabel(available)}
              size="small"
              color={available <= 0 ? 'error' : available <= 3 ? 'warning' : 'success'}
              sx={{ mt: 0.75, height: large ? 24 : 20, fontSize: large ? 12 : 10, fontWeight: 900 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, flexShrink: 0, alignSelf: 'center' }}>
          {qty > 0 && (
            <>
              <IconButton size="small" onClick={() => handleRemoveClick(m.id)}
                sx={{ width: large ? 40 : 32, height: large ? 40 : 32, bgcolor: '#f5f5f5', color: '#ff5722', borderRadius: 1.5 }}>
                <RemoveIcon sx={{ fontSize: large ? 22 : 18 }} />
              </IconButton>
              <Typography fontWeight={900} sx={{ minWidth: large ? 34 : 28, textAlign: 'center', fontSize: large ? 21 : 17 }}>
                {qty}
              </Typography>
            </>
          )}
          <IconButton size="small" onClick={() => handleAddClick(m)} disabled={soldOutForCart}
            sx={{ width: large ? 40 : 32, height: large ? 40 : 32, bgcolor: '#ff5722', color: '#fff', borderRadius: 1.5,
              '&:hover': { bgcolor: '#e64a19' }, '&.Mui-disabled': { bgcolor: '#cbd5e1', color: '#fff' } }}>
            <AddIcon sx={{ fontSize: large ? 22 : 18 }} />
          </IconButton>
        </Box>
      </Box>
    )
  }

  // ── MenuGridItem ──────────────────────────────────────────────────────
  const MenuGridItem = ({ m }) => {
    const qty = getModelQty(m.id)
    const available = availableToAddForModel(m)
    const capped = available != null
    const soldOutForCart = capped && available <= 0
    return (
      <Box sx={{
        bgcolor: '#fff', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        border: qty > 0 ? '2px solid #ff5722' : highContrast ? '1.5px solid #111827' : '1.5px solid transparent',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <Box onClick={() => m.imageUrl && setImagePreview(m)} sx={{
          width: '100%', paddingTop: '70%', position: 'relative',
          bgcolor: '#f5f5f5', overflow: 'hidden', cursor: m.imageUrl ? 'pointer' : 'default',
        }}>
          {m.imageUrl
            ? <Box component="img" src={m.imageUrl} alt={modelName(m)}
                sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            : <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: large ? 46 : 36, opacity: 0.15, userSelect: 'none' }}>🍽</Typography>
              </Box>}
          {qty > 0 && (
            <Box sx={{ position: 'absolute', top: 6, right: 6, bgcolor: '#ff5722', color: '#fff',
              borderRadius: 10, minWidth: large ? 28 : 22, height: large ? 28 : 22, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 900, fontSize: large ? 15 : 13 }}>
              {qty}
            </Box>
          )}
        </Box>
        <Box sx={{ px: 1.25, pt: 1, pb: 1.25, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography fontWeight={700} sx={{
            fontSize: large ? 16 : 13, lineHeight: 1.32, color: '#111827', flex: 1, mb: 0.75,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {modelName(m)}
          </Typography>
          {m.ingredients && (
            <Typography sx={{ color: '#64748b', fontSize: large ? 12 : 10, lineHeight: 1.3, mb: 0.75,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {m.ingredients}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography fontWeight={800} sx={{ color: '#ff5722', fontSize: large ? 17 : 14 }}>
              {fmt(m.sellingPrice)}
            </Typography>
            {capped && (
              <Chip
                label={dailyAvailabilityLabel(available)}
                size="small"
                color={available <= 0 ? 'error' : available <= 3 ? 'warning' : 'success'}
                sx={{ height: large ? 22 : 18, fontSize: large ? 11 : 9, fontWeight: 900, mx: 0.5 }}
              />
            )}
            {qty > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton onClick={() => handleRemoveClick(m.id)}
                  sx={{ p: 0.25, width: large ? 32 : 26, height: large ? 32 : 26, bgcolor: '#f5f5f5', color: '#ff5722', borderRadius: 1 }}>
                  <RemoveIcon sx={{ fontSize: 15 }} />
                </IconButton>
                <IconButton onClick={() => handleAddClick(m)} disabled={soldOutForCart}
                  sx={{ p: 0.25, width: large ? 32 : 26, height: large ? 32 : 26, bgcolor: '#ff5722', color: '#fff', borderRadius: 1,
                    '&:hover': { bgcolor: '#e64a19' }, '&.Mui-disabled': { bgcolor: '#cbd5e1', color: '#fff' } }}>
                  <AddIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Box>
            ) : (
              <IconButton onClick={() => handleAddClick(m)} disabled={soldOutForCart}
                sx={{ p: 0.5, width: large ? 36 : 30, height: large ? 36 : 30, bgcolor: '#ff5722', color: '#fff', borderRadius: 1.5,
                  '&:hover': { bgcolor: '#e64a19' }, '&.Mui-disabled': { bgcolor: '#cbd5e1', color: '#fff' } }}>
                <AddIcon sx={{ fontSize: large ? 22 : 18 }} />
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
    <Box sx={{ p: 3 }}><Alert severity="error">{error || cText('checkout.invalidShopQr')}</Alert></Box>
  )

  return (
    <Box sx={{ bgcolor: highContrast ? '#eef2f7' : '#f5f5f5', minHeight: '100vh' }}>

      {/* ── Fixed header ──────────────────────────────────────── */}
      <Box ref={headerRef} sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        bgcolor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {/* Row 1: Title + action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1.25, pb: 0.5, gap: 0.75 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={900} sx={{ fontSize: large ? 22 : 18, color: '#1a1a1a', lineHeight: 1.2 }}>
              {t('shop.placeOrder')}
            </Typography>
            {ctx.tableId && (
              <Chip icon={<TableBarIcon sx={{ fontSize: '12px !important', color: '#1976d2 !important' }} />}
                label={t('shop.dineIn')} size="small"
                sx={{ height: 18, fontSize: 11, bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 600 }} />
            )}
          </Box>

          <LanguageSelector compact languageCodes={ORDERING_LANGUAGE_CODES} />

          {/* Gọi nhân viên */}
          <Button size="small" variant="outlined" onClick={() => setCallStaffOpen(true)}
            startIcon={<SupportAgentIcon sx={{ fontSize: '16px !important' }} />}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 20, fontSize: 12,
              px: 1.25, py: 0.4, flexShrink: 0,
              borderColor: '#ff5722', color: '#ff5722',
              '&:hover': { bgcolor: '#fff3e0', borderColor: '#ff5722' } }}>
            {t('shop.callStaff')}
          </Button>

          {/* Món đã gọi */}
          <Badge
            badgeContent={activeVisibleOrders.length || null}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: 10, fontWeight: 900, minWidth: 16, height: 16 } }}>
            <Button size="small"
              variant={activeVisibleOrders.length > 0 ? 'contained' : 'outlined'}
              onClick={() => setSessionOpen(true)}
              startIcon={<ReceiptLongIcon sx={{ fontSize: '16px !important' }} />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 20, fontSize: 12,
                px: 1.25, py: 0.4, flexShrink: 0,
                ...(activeVisibleOrders.length > 0
                  ? { bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' } }
                  : {}) }}>
              {t('shop.orders')}
            </Button>
          </Badge>
        </Box>

        {/* Row 2: Category tabs */}
        <Box sx={{
          display: 'flex', overflowX: 'auto', px: 1.5, pb: 0.75, gap: 0.5,
          '&::-webkit-scrollbar': { display: 'none' }, scrollbarWidth: 'none',
        }}>
          <Chip key="__all" label={t('common.all') || 'All'} size="small"
            onClick={() => { setActiveCategory(null); setSearchQuery(''); resetMobileSearchZoom() }}
            sx={{
              flexShrink: 0, cursor: 'pointer', height: large ? 34 : 28, fontSize: large ? 14 : 12, fontWeight: 700,
              bgcolor: !activeCategory && !searchQuery ? '#ff5722' : '#f0f0f0',
              color: !activeCategory && !searchQuery ? '#fff' : '#444',
              '&:hover': { bgcolor: !activeCategory && !searchQuery ? '#e64a19' : '#e0e0e0' },
            }} />
          {categories.map(cat => (
            <Chip key={cat} label={cat} size="small"
              onClick={() => selectCategory(cat)}
              sx={{
                flexShrink: 0, cursor: 'pointer', height: large ? 34 : 28, fontSize: large ? 14 : 12, fontWeight: 700,
                bgcolor: activeCategory === cat ? '#ff5722' : '#f0f0f0',
                color: activeCategory === cat ? '#fff' : '#444',
                '&:hover': { bgcolor: activeCategory === cat ? '#e64a19' : '#e0e0e0' },
              }} />
          ))}
        </Box>

        {/* Row 3: Search + view toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pb: 1.25, gap: 1 }}>
          <TextField size="small" fullWidth variant="outlined" type="search"
            inputRef={searchInputRef}
            placeholder={t('shop.searchMenu')}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setActiveCategory(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                resetMobileSearchZoom(e.currentTarget)
              }
            }}
            onBlur={e => resetMobileSearchZoom(e.currentTarget)}
            inputProps={{
              enterKeyHint: 'search',
              style: { fontSize: 16 },
              'aria-label': t('shop.searchMenu'),
            }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: large ? 24 : 20, color: '#bbb' }} /></InputAdornment>,
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" edge="end" onClick={() => { setSearchQuery(''); resetMobileSearchZoom() }}>
                    <CloseIcon sx={{ fontSize: large ? 20 : 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { borderRadius: 20, bgcolor: highContrast ? '#fff' : '#f5f5f5', '& fieldset': { border: 'none' }, fontSize: large ? 16 : 14 },
            }}
          />
          <IconButton onClick={() => setGridView(v => !v)}
            sx={{ bgcolor: gridView ? '#ff5722' : '#f0f0f0', color: gridView ? '#fff' : '#555',
              borderRadius: 1.5, flexShrink: 0,
              '&:hover': { bgcolor: gridView ? '#e64a19' : '#e0e0e0' } }}>
            {gridView ? <ViewListIcon sx={{ fontSize: large ? 26 : 22 }} /> : <GridViewIcon sx={{ fontSize: large ? 26 : 22 }} />}
          </IconButton>
          <IconButton onClick={() => { const next = displaySize === 'large' ? 'normal' : 'large'; setDisplaySize(next); writeShopMenuPref(SHOP_MENU_DISPLAY_SIZE_PREF, next) }}
            sx={{ bgcolor: large ? '#1f2937' : '#f0f0f0', color: large ? '#fff' : '#555', borderRadius: 1.5, flexShrink: 0, width: large ? 42 : 36, height: large ? 42 : 36, fontWeight: 900, fontSize: large ? 18 : 15, '&:hover': { bgcolor: large ? '#111827' : '#e0e0e0' } }}>
            Aa
          </IconButton>
          <IconButton onClick={() => { const next = !highContrast; setHighContrast(next); writeShopMenuPref(SHOP_MENU_CONTRAST_PREF, String(next)) }}
            sx={{ bgcolor: highContrast ? '#111827' : '#f0f0f0', color: highContrast ? '#fff' : '#555', borderRadius: 1.5, flexShrink: 0, width: large ? 42 : 36, height: large ? 42 : 36, '&:hover': { bgcolor: highContrast ? '#020617' : '#e0e0e0' } }}>
            <VisibilityIcon sx={{ fontSize: large ? 24 : 20 }} />
          </IconButton>
        </Box>
      </Box>

      {/* ── Content ───────────────────────────────────────────── */}
      {error && <Alert severity="error" sx={{ mx: 2, mt: 1, position: 'relative', zIndex: 1 }}>{error}</Alert>}

      <Box sx={{ pt: `${headerH}px`, pb: itemCount > 0 ? '80px' : '24px' }}>
        {editingOrderCode && (
          <Box sx={{ mx: 1.5, mt: 1.5, mb: 0.5, p: 1.5, bgcolor: '#fff7ed', border: '2px solid #f59e0b', borderRadius: 2.5, boxShadow: '0 3px 12px rgba(245,158,11,.18)' }}>
            <Typography fontWeight={900} sx={{ color: '#9a3412', fontSize: 17 }}>
              Bạn đang sửa đơn hàng
            </Typography>
            <Typography sx={{ mt: 0.5, mb: 1.25, color: '#7c2d12', fontSize: 14, lineHeight: 1.35 }}>
              Nếu bạn bấm nhầm hoặc không muốn thay đổi món, hãy bấm nút bên dưới để mở khóa đơn và quay lại theo dõi.
            </Typography>
            <Button variant="contained" color="warning" fullWidth onClick={handleCancelEdit}
              sx={{ minHeight: 48, borderRadius: 20, fontWeight: 900, textTransform: 'none', fontSize: 16 }}>
              Hoàn tất chỉnh sửa
            </Button>
          </Box>
        )}
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

      {activeStaffCall?.id && (
        <Box sx={{
          position: 'fixed', left: 12, right: 12, bottom: itemCount > 0 ? 88 : 16, zIndex: 260,
          px: 1, py: 0.75, display: 'flex', alignItems: 'flex-start', gap: 0.75,
          borderRadius: 2, border: '1px solid', boxShadow: '0 8px 24px rgba(15,23,42,0.18)',
          borderColor: staffCallHasReply ? '#a5d6a7' : '#ffcc80',
          bgcolor: staffCallHasReply ? '#e8f5e9' : '#fff8e1',
        }}>
          <SupportAgentIcon sx={{ fontSize: 18, color: staffCallHasReply ? '#2e7d32' : '#ff5722', mt: 0.1, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
              <Typography fontWeight={900} sx={{ fontSize: 12.5, color: staffCallHasReply ? '#1b5e20' : '#bf360c', lineHeight: 1.2, flexShrink: 0 }}>
                {staffCallTitle}
              </Typography>
              <Chip label={activeStaffCall.reason === 'payment' ? t('shop.paymentHelp') : t('shop.support')} size="small"
                sx={{ height: 17, fontSize: 10, fontWeight: 800, bgcolor: '#fff', color: staffCallHasReply ? '#2e7d32' : '#ff5722' }} />
              {staffCallAge && (
                <Typography variant="caption" noWrap sx={{ color: staffCallHasReply ? '#2e7d32' : '#8a4b00', fontSize: 10.5, minWidth: 0 }}>
                  {staffCallAge}
                </Typography>
              )}
            </Box>
            <Typography variant="body2" sx={{ mt: 0.15, fontSize: 12, color: '#333', overflowWrap: 'anywhere', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {staffCallMessage}
            </Typography>
          </Box>
        </Box>
      )}
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
                ? `${t('common.update')} ${t('shop.order')} - ${fmt(totalAmount)}`
                : `${t('common.confirm')} ${t('shop.placeOrder')} - ${itemCount} ${t('shop.items')} - ${fmt(totalAmount)}`}
            </Button>

            {editingOrderCode && (
              <Button variant="text" size="small" onClick={handleCancelEdit}
                sx={{ textTransform: 'none', color: '#9a3412', flexShrink: 0, fontSize: 12, px: 0.5, fontWeight: 800 }}>
                {cText('tracking.finishEdit')}
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
          {t('shop.callStaff')}
        </DialogTitle>
        <DialogContent sx={{ px: 2.5, pb: 1 }}>
          <RadioGroup value={callStaffReason} onChange={e => setCallStaffReason(e.target.value)}>
            {[
              { value: 'payment', label: t('shop.paymentHelp') },
              { value: 'other',   label: t('shop.support') },
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
            placeholder={t('shop.specialRequest')}
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
            {callStaffLoading ? t('common.loading') : t('shop.callStaff')}
          </Button>
          <Button fullWidth onClick={() => setCallStaffOpen(false)}
            disabled={callStaffLoading}
            sx={{ textTransform: 'none', color: 'text.secondary', borderRadius: 20 }}>
            {t('common.cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Call staff success snack ──────────────────────────── */}
      <Snackbar open={callStaffDone} autoHideDuration={activeStaffCall?.replyMessage ? 8000 : 4000} onClose={() => setCallStaffDone(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={activeStaffCall?.replyMessage ? 'info' : 'success'} onClose={() => setCallStaffDone(false)} sx={{ fontWeight: 700 }}>
          {activeStaffCall?.replyMessage || t('shop.staffComing')}
        </Alert>
      </Snackbar>

      <Snackbar open={voucherSnack.open} autoHideDuration={5000}
        onClose={() => setVoucherSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={voucherSnack.severity || 'success'} onClose={() => setVoucherSnack(s => ({ ...s, open: false }))} sx={{ fontWeight: 700 }}>
          {voucherSnack.message}
        </Alert>
      </Snackbar>


      {/* ── Cart bottom sheet ──────────────────────────────────── */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0,
          borderRadius: '16px 16px 0 0', maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1 }}>
          <Typography fontWeight={800} variant="h6" sx={{ flex: 1 }}>{t('shop.cart')}</Typography>
          <IconButton size="small" onClick={() => setCartOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          {renderCartPanel(() => { setCartOpen(false); setError(''); editingOrderCode ? handlePlaceOrder() : setCheckout(true) })}
        </DialogContent>
      </Dialog>

      {/* ── Prepaid payment QR ────────────────────────────────── */}
      {prepaidQrOrder && (() => {
        const amount = Math.round(payableAmount(prepaidQrOrder))
        const qrUrl = prepaidQrOrder.paymentQr || (shopConfig.bankBin && shopConfig.bankAccountNumber
          ? `https://img.vietqr.io/image/${shopConfig.bankBin}-${shopConfig.bankAccountNumber}-qr_only.png`
            + `?amount=${amount}&addInfo=${encodeURIComponent(prepaidQrOrder.orderCode)}`
            + `&accountName=${encodeURIComponent(shopConfig.bankAccountName || '')}`
          : null)
        const orderNum = prepaidQrOrder.orderNumber ? `#${prepaidQrOrder.orderNumber}` : prepaidQrOrder.orderCode
        return (
          <Dialog open fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ textAlign: 'center', pb: 0.5, pt: 2.5, fontWeight: 900, fontSize: 20 }}>
              {t('shop.paymentOrder', { value: orderNum })}
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center', pt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('shop.scanQrToPay')}
              </Typography>
              {qrUrl ? (
                <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2,
                  border: '2px solid #1976d2', mb: 1.5 }}>
                  <img src={qrUrl} alt="Payment QR" style={{ width: 220, height: 220, display: 'block', borderRadius: 6 }} />
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mb: 1.5 }}>{t('shop.bankNotConfigured')}</Alert>
              )}
              <Typography variant="h5" fontWeight={900} color="primary">{fmt(payableAmount(prepaidQrOrder))}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('shop.code')}: <strong>{prepaidQrOrder.orderCode}</strong>
                {shopConfig.bankAccountName ? ` · ${shopConfig.bankAccountName}` : ''}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2.5, flexDirection: 'column', gap: 1 }}>
              <Button variant="outlined" fullWidth startIcon={<DownloadIcon />}
                onClick={() => saveQrImage(qrUrl, prepaidQrOrder.orderCode)}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20 }}>
                Save QR to Photos
              </Button>
              <Button variant="contained" fullWidth size="large"
                onClick={() => { const order = prepaidQrOrder; setPrepaidQrOrder(null); openTrackingScreen(order, { newTab: true }); setSessionOpen(true) }}
                sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 20 }}>
                {t('shop.paidTrackOrder')}
              </Button>
              <Button fullWidth size="small" color="inherit"
                onClick={() => { const order = prepaidQrOrder; setPrepaidQrOrder(null); openTrackingScreen(order, { newTab: true }); setSessionOpen(true) }}
                sx={{ textTransform: 'none', color: 'text.secondary' }}>
                {t('shop.payLaterClose')}
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
            <Typography fontWeight={900} variant="h6">{t('shop.orders')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('shop.needPayment', { count: activeVisibleOrders.length })}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setSessionOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto', px: 2, pb: 3 }}>
          <SessionOrderList
            session={visibleOrderSession}
            t={t}
            language={language}
            formatAmount={fmt}
            itemName={modelName}
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
            {editingOrderCode ? cText('checkout.updateTitle') : cText('checkout.createTitle')}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                {cText('checkout.fulfillmentType')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {FULFILLMENT_OPTIONS.map(opt => (
                  <Box key={opt.value} onClick={() => { setForm(f => ({ ...f, fulfillmentType: opt.value })); setError('') }} sx={{
                    border: '2px solid', borderRadius: 3, py: 1.5, px: 0.5, textAlign: 'center',
                    cursor: 'pointer',
                    borderColor: form.fulfillmentType === opt.value ? '#ff5722' : '#e0e0e0',
                    bgcolor: form.fulfillmentType === opt.value ? '#fff3e0' : '#fff',
                    transition: 'all 0.15s',
                    transform: form.fulfillmentType === opt.value ? 'translateY(-2px)' : 'none',
                    boxShadow: form.fulfillmentType === opt.value ? '0 6px 16px rgba(255,87,34,.18)' : 'none',
                  }}>
                    <Box sx={{ color: form.fulfillmentType === opt.value ? '#ff5722' : 'text.secondary' }}>{opt.icon}</Box>
                    <Typography sx={{ display: 'block', fontSize: 13, lineHeight: 1.2 }} fontWeight={800}
                      color={form.fulfillmentType === opt.value ? '#ff5722' : 'text.secondary'}>{t(opt.value === 'DINE_IN' ? 'shop.dineIn' : opt.value === 'DELIVERY' ? 'shop.delivery' : 'shop.pickup')}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {form.fulfillmentType === 'DINE_IN' && !ctx?.tableId && (
              <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: '#fff8f4', border: '1px solid #ffccbc' }}>
                <Typography fontWeight={800} sx={{ mb: 1, fontSize: 14 }}>{cText('checkout.tablePromptTitle')}</Typography>
                <Stack spacing={1.25}>
                  <TextField inputRef={tableTagInputRef} label={cText('checkout.tableTagLabel')} size="small" fullWidth
                    placeholder={cText('checkout.tableTagPlaceholder')} value={form.customerTableTag}
                    onChange={e => { setForm(f => ({ ...f, customerTableTag: e.target.value, selectedTableId: '' })); setError('') }}
                    helperText={cText('checkout.tableTagHelp')} />
                  {publicTables.length > 0 && (
                    <>
                      <Divider><Typography variant="caption" color="text.secondary">{cText('checkout.or')}</Typography></Divider>
                      <TextField select label={cText('checkout.chooseTable')} size="small" fullWidth value={form.selectedTableId}
                        onChange={e => { setForm(f => ({ ...f, selectedTableId: e.target.value, customerTableTag: '' })); setError('') }}>
                        {publicTables.map(table => <MenuItem key={table.id} value={table.id}>{localizedTableName(table, language)}</MenuItem>)}
                      </TextField>
                    </>
                  )}
                </Stack>
              </Box>
            )}
            {form.fulfillmentType === 'DINE_IN' && ctx?.tableId && (
              <Alert severity="info" icon={<TableBarIcon />}>{cText('checkout.scannedTableInfo')}</Alert>
            )}
            {form.fulfillmentType !== 'DINE_IN' && <>
              <TextField label={t('shop.customerName')} size="small" fullWidth required value={form.customerName}
                onChange={e => { setForm(f => ({ ...f, customerName: e.target.value })); setError('') }} />
              <TextField label={t('shop.customerPhone')} size="small" fullWidth required type="tel" value={form.customerPhone}
                onChange={e => { setForm(f => ({ ...f, customerPhone: e.target.value })); setError('') }} />
            </>}
            {form.fulfillmentType === 'DELIVERY' && (
              <>
                <TextField label={cText('checkout.receiveTime')} type="datetime-local" size="small" fullWidth required
                  value={form.requestedFulfillmentAt} onChange={e => { setForm(f => ({ ...f, requestedFulfillmentAt: e.target.value })); setError('') }}
                  InputLabelProps={{ shrink: true }} />
                <TextField label={t('shop.deliveryAddress')} size="small" fullWidth required multiline rows={2}
                  value={form.deliveryAddress} onChange={e => { setForm(f => ({ ...f, deliveryAddress: e.target.value })); setError('') }} />
              </>
            )}
            <TextField label={t('shop.orderNote')} size="small" fullWidth multiline rows={2}
              placeholder={t('shop.specialRequest')}
              value={notes} onChange={e => setNotes(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />
            <FormControl size="small" fullWidth>
              <InputLabel>{t('common.payment')}</InputLabel>
              <Select value={form.paymentMethod} label={t('common.payment')}
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <MenuItem value="CASH">{t('common.cash')}</MenuItem>
                <MenuItem value="BANK_QR" disabled={!shopConfig.bankBin || !shopConfig.bankAccountNumber}>
                  {t('common.bankTransfer')} QR
                </MenuItem>
              </Select>
            </FormControl>
            {(!shopConfig.bankBin || !shopConfig.bankAccountNumber) && (
              <Alert severity="info" sx={{ py: 0.25 }}>
                {t('shop.bankNotConfigured')}
              </Alert>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="outlined" size="small" startIcon={<QrCode2Icon />}
                onClick={() => setVoucherScanOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 20 }}>
                {voucherPayload ? t('shop.applyVoucher') : t('shop.scanVoucher')}
              </Button>
              {voucherPayload && (
                <Chip size="small" color="warning" label={voucherDisplayCode}
                  onDelete={() => setVoucherPayload('')}
                  sx={{ maxWidth: '100%', fontWeight: 700, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
              )}
            </Box>

            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {cText('checkout.yourOrder')}
              </Typography>
              {cartEntries.map((entry, idx) => {
                const m = menu.find(x => x.id === entry.modelId)
                if (!m) return null
                const entryImage = entry.imageUrl || entry.thumbnailUrl || m.imageUrl || m.thumbnailUrl || ''
                const optsStr   = formatSelectedOptions(entry.modelId, entry.selectedOptions)
                const sides     = entry.sideItems || []
                const unitPrice = Number(m.sellingPrice || 0) + calcOptAddOn(entry)
                const mainTotal = entry.qty * unitPrice
                const sideTotal = sides.reduce((s, si) => {
                  const sm = menu.find(x => x.id === si.modelId)
                  return s + (si.qty || 1) * Number(sm?.sellingPrice || 0) * entry.qty
                }, 0)
                return (
                  <Box key={entry.uid} sx={{ mb: 1.25, p: 1, border: '1.5px solid #e2e8f0', borderRadius: 2, bgcolor: '#fff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box onClick={() => entryImage && setImagePreview({ imageUrl: entryImage, modelName: modelName(m) })}
                        sx={{ width: 72, height: 72, flexShrink: 0, borderRadius: 1.5, bgcolor: '#eef2f7', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: entryImage ? 'pointer' : 'default' }}>
                        {entryImage ? <Box component='img' src={entryImage} alt={modelName(m)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                          : <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: 28 }}>{String(modelName(m) || '?').slice(0, 1)}</Typography>}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography fontWeight={900} sx={{ fontSize: 20, color: '#0f172a', lineHeight: 1.18 }}>{idx + 1}. {entry.qty}x {modelName(m)}</Typography>
                        {optsStr && <Typography sx={{ color: '#64748b', fontSize: 15, lineHeight: 1.25 }}>{optsStr}</Typography>}
                        {entry.itemNotes && <Typography sx={{ color: '#64748b', fontSize: 14, fontStyle: 'italic' }}>{cText('tracking.note')}: {entry.itemNotes}</Typography>}
                      </Box>
                      <Typography sx={{ color: '#ff5722', fontSize: 18, fontWeight: 900, flexShrink: 0 }}>{fmt(mainTotal)}</Typography>
                    </Box>
                    {sides.length > 0 && (
                      <Box sx={{ mt: 1, ml: 2, pl: 1, borderLeft: '2px solid #c7d2fe', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {sides.map(si => {
                          const sm = menu.find(x => x.id === si.modelId)
                          const sideImage = si.imageUrl || si.thumbnailUrl || sm?.imageUrl || sm?.thumbnailUrl || ''
                          const sideQty = (si.qty || 1) * entry.qty
                          const sideLine = sideQty * Number(sm?.sellingPrice || 0)
                          return (
                            <Box key={si.uid || si.modelId} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Box onClick={() => sideImage && setImagePreview({ imageUrl: sideImage, modelName: modelName(si) })}
                                sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 1, bgcolor: '#e8eaf6', overflow: 'hidden', border: '1px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sideImage ? 'pointer' : 'default' }}>
                                {sideImage ? <Box component='img' src={sideImage} alt={modelName(si)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                                  : <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: 16 }}>{String(modelName(si) || '?').slice(0, 1)}</Typography>}
                              </Box>
                              <Typography sx={{ flex: 1, minWidth: 0, color: '#4338ca', fontSize: 16, fontWeight: 800 }} noWrap>+ {sideQty}x {modelName(si)}</Typography>
                              <Typography sx={{ color: '#ff5722', fontSize: 15, fontWeight: 900, flexShrink: 0 }}>{fmt(sideLine)}</Typography>
                            </Box>
                          )
                        })}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, borderTop: '1px dotted #c7d2fe' }}>
                          <Typography sx={{ color: '#64748b', fontSize: 15, fontWeight: 800 }}>{cText('checkout.withTopping')}</Typography>
                          <Typography fontWeight={900} sx={{ color: '#ff5722', fontSize: 18 }}>{fmt(mainTotal + sideTotal)}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Box>
                )
              })}
              <Divider sx={{ my: 0.75 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography fontWeight={700}>{t('common.total')}</Typography>
                <Typography fontWeight={700} sx={{ color: '#ff5722' }}>{fmt(totalAmount)}</Typography>
              </Box>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setCheckout(false)} disabled={submitting}>{cText('common.back')}</Button>
          <Button variant="contained" fullWidth onClick={handlePlaceOrder} disabled={submitting}
            sx={{ borderRadius: 20, fontWeight: 700, textTransform: 'none',
              bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' } }}>
            {submitting ? <CircularProgress size={20} color="inherit" /> :
              editingOrderCode ? cText('checkout.updateAmount', { amount: fmt(totalAmount) }) : cText('checkout.placeAmount', { amount: fmt(totalAmount) })}
          </Button>
        </DialogActions>
      </Dialog>

      <VoucherQrScanDialog
        open={voucherScanOpen}
        onClose={() => setVoucherScanOpen(false)}
        onScan={handleVoucherScan}
      />

      {/* ── Inline order tracking ──────────────────────────────── */}
      {trackingOrder && (
        <TrackingOverlay
          order={trackingOrder}
          ctx={ctx}
          token={tokenParam}
          tables={publicTables}
          onEdit={handleEditOrder}
          onOrderMore={() => setTrackingOrder(null)}
          onUpdated={setTrackingOrder}
          formatSelectedOptions={formatSelectedOptions}
        />
      )}

      {/* ── Table occupied dialog ──────────────────────────────── */}
      <Dialog open={tableOrdersPromptOpen && activeTableOrders.length > 0} onClose={() => setTableOrdersPromptOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableRestaurantIcon color="warning" />
            <Typography fontWeight={700}>{t('shop.tableOccupied')}</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {t('shop.tableOccupiedMessage', { count: activeTableOrders.length })}
          </Typography>
          {activeTableOrders.slice(0, 3).map(o => (
            <Box key={o.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 1.25, py: 0.75, mb: 0.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <Typography variant="body2" fontWeight={700}>
                {o.orderNumber ? `#${o.orderNumber}` : o.orderCode}
              </Typography>
              <Chip label={orderStatusLabel(o, language, t)} size="small"
                color={o.status === 'READY' ? 'success' : o.status === 'PREPARING' ? 'warning' : 'default'} />
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button onClick={() => setTableOrdersPromptOpen(false)} variant="outlined"
            sx={{ flex: 1, textTransform: 'none', borderRadius: 20 }}>
            {t('shop.placeOrder')}
          </Button>
          <Button variant="contained" color="warning"
            onClick={() => {
              const latest = activeTableOrders[activeTableOrders.length - 1]
              if (latest) setTrackingOrder(latest)
              setTableOrdersPromptOpen(false)
            }}
            sx={{ flex: 1, textTransform: 'none', borderRadius: 20 }}>
            {t('shop.viewOrder')}
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
          maxQty={optionsTarget.maxQty}
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
