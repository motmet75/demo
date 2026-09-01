import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Badge from '@mui/material/Badge'
import Stack from '@mui/material/Stack'
import RefreshIcon from '@mui/icons-material/Refresh'
import ScheduleIcon from '@mui/icons-material/Schedule'
import DeleteIcon from '@mui/icons-material/Delete'
import VisibilityIcon from '@mui/icons-material/Visibility'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import LocalCafeIcon from '@mui/icons-material/LocalCafe'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import PaymentsIcon from '@mui/icons-material/Payments'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import TableBarIcon from '@mui/icons-material/TableBar'
import TvIcon from '@mui/icons-material/Tv'
import MonitorIcon from '@mui/icons-material/Monitor'
import PeopleAltIcon from '@mui/icons-material/PeopleAlt'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import UndoIcon from '@mui/icons-material/Undo'
import KitchenIcon from '@mui/icons-material/Kitchen'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import PaidIcon from '@mui/icons-material/Paid'
import PrintIcon from '@mui/icons-material/Print'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import AssessmentIcon from '@mui/icons-material/Assessment'
import SupportAgentIcon from '@mui/icons-material/SupportAgent'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import MergeTypeIcon from '@mui/icons-material/MergeType'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'

import {
  fetchShopOrders, fetchActiveOrders, confirmShopOrder, prepareShopOrder, readyShopOrder,
  completeShopOrder, cancelShopOrder, resetOrderSequence, setShopOrderNumber,
  generateDisplayBoardToken, pickupShopOrder, revertShopOrder, markOrderPaid,
  fetchBankConfig, switchToQrPayment, revertToCash, fetchOrderTagQr, fetchShopOrder,
  fetchShopTables, setOrderTable, setOrderSeat, fetchPickupQr, fetchOrdersByToken,
  lockTokenSession, unlockTokenSession,
  fetchStaffCalls, dismissStaffCall, replyStaffCall, forceConfirmOrder,
  confirmScannedOrder,fetchOrderingStatus, closeShopToday, reopenShop,
   previewCloseToday, fetchShiftSchedule, saveShiftSchedule,
} from '../../api/shopApi'
import { printCupLabelsTracked, printOrderReceiptTracked, printOrderTagTracked, printCombinedReceiptTracked } from '../../utils/printWithHistory'
import ShopOrderDetailModal from './ShopOrderDetailModal'
import ManualOrderDialog from './ManualOrderDialog'
import QrOrderDialog from './QrOrderDialog'
import EodAuditDialog from './EodAuditDialog'
import ConfirmActionDialog from './ConfirmActionDialog'
import MergeBillsDialog from './MergeBillsDialog'
import VoucherQrScanDialog from './VoucherQrScanDialog'
import { useAppContext } from '../../context/AppContext'
import { useI18n } from '../../i18n/I18nContext'
import { localizedCategory, localizedModelName, localizedSelectedOptions } from '../../i18n/menuLocalization'
import { fetchModels } from '../../api/modelApi'
import { apiFetchJson } from '../../api/client'

const BOARD_CHANNEL = 'shop_display_board'
const ORDER_POLL_MS = 5000
const STAFF_CALL_REASON_NEW_ORDER = 'new_order'
const BOARD_VISIBLE_STATUSES = new Set(['CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP'])
const SHOP_ORDER_VIEW_PREF = 'shop.orders.viewMode'
const SHOP_ORDER_CARD_SIZE_PREF = 'shop.orders.cardSize'
const SHOP_ORDER_CONTRAST_PREF = 'shop.orders.highContrast'
const SHOP_ORDER_STATUS_FILTER_SESSION_KEY = 'shop.orders.statusFilter'
const SHOP_ORDER_PAYMENT_FILTER_SESSION_KEY = 'shop.orders.paymentFilter'
const CUSTOMER_EDIT_HISTORY_KEY = 'shop.orders.customerEditHistory.v1'
function readShopOrderPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function writeShopOrderPref(key, value) {
  try { localStorage.setItem(key, value) } catch { /* browser storage may be blocked */ }
}
function readShopOrderSessionValue(key, fallback) {
  try { return sessionStorage.getItem(key) || fallback } catch { return fallback }
}
function writeShopOrderSessionValue(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* browser storage may be blocked */ }
}
function localDateTimeInputValue(date) {
  const p = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`
}
function todayOrderRange() {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return { from: localDateTimeInputValue(from), to: localDateTimeInputValue(to) }
}
function datetimeLocalToIso(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
function parseDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
function orderInTimeRange(order, range) {
  const createdAt = parseDateTime(order?.createdAt)
  if (!createdAt) return true
  const from = parseDateTime(range?.from)
  const to = parseDateTime(range?.to)
  if (from && createdAt < from) return false
  if (to && createdAt >= to) return false
  return true
}
function readShopOrderStatusFilters() {
  const fallback = []
  try {
    const stored = sessionStorage.getItem(SHOP_ORDER_STATUS_FILTER_SESSION_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      const selected = parsed.filter(status => ORDER_STATUSES.includes(status))
      return selected.length === ORDER_STATUSES.length ? [] : selected
    }
  } catch {
    const legacy = readShopOrderSessionValue(SHOP_ORDER_STATUS_FILTER_SESSION_KEY, '')
    if (ORDER_STATUSES.includes(legacy)) return [legacy]
  }
  return fallback
}
function broadcastReady() {
  try { new BroadcastChannel(BOARD_CHANNEL).postMessage({ type: 'ORDER_READY' }) } catch { /* */ }
}

const STAFF_CALL_QUICK_REPLIES = [
  'Nhân viên sẽ có mặt trong ít phút',
  'Đã nhận yêu cầu, vui lòng chờ trong giây lát',
  'Nhân viên đang chuẩn bị thanh toán',
]
function staffCallReasonLabel(reason) {
  if (reason === STAFF_CALL_REASON_NEW_ORDER) return '\u0110\u01a1n m\u1edbi'
  if (reason === 'payment') return 'Thanh to\u00e1n'
  return 'H\u1ed7 tr\u1ee3 kh\u00e1c'
}
function playStaffCallSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    ;[0, 0.28].forEach(offset => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = 880
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(0.45, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.45)
      osc.start(now + offset); osc.stop(now + offset + 0.45)
    })
  } catch { /* browser may block without user gesture */ }
}
function playNewOrderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    ;[0, 0.18, 0.36].forEach((offset, idx) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'triangle'; osc.frequency.value = [784, 988, 1175][idx]
      gain.gain.setValueAtTime(0, now + offset)
      gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.28)
      osc.start(now + offset); osc.stop(now + offset + 0.28)
    })
  } catch { /* browser may block without user gesture */ }
}

const STATUS_COLOR  = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }
const STATUS_LABEL  = { PENDING: 'Placed', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready ✓', PICKED_UP: 'Picked Up ✓', COMPLETED: 'Done', CANCELLED: 'Cancelled' }
const STATUS_I18N_KEY = { PENDING: 'shopOrder.status.pending', CONFIRMED: 'shopOrder.status.confirmed', PREPARING: 'shopOrder.status.preparing', READY: 'shopOrder.status.ready', PICKED_UP: 'shopOrder.status.pickedUp', COMPLETED: 'shopOrder.status.completed', CANCELLED: 'shopOrder.status.cancelled' }
const localizedStatusLabel = (status, t) => STATUS_I18N_KEY[status] ? t(STATUS_I18N_KEY[status]) : (STATUS_LABEL[status] || status)
const localizedPaymentStatusLabel = (status, t) => status === 'PAID' ? t('shopOrder.status.paid') : t('shopOrder.status.unpaid')
const localizedPaymentMethodLabel = (method, t) => {
  if (method === 'BANK_QR') return t('shopOrder.grid.qrBank')
  if (method === 'CASH' || !method) return t('shopOrder.common.cash')
  if (method === 'SPLIT') return t('shopOrder.grid.splitPayment')
  return method
}
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'COMPLETED', 'CANCELLED']
const fmt           = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))
const dateFmt       = (v) => v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(v).toLocaleDateString('vi-VN') : ''
const elapsed       = (v) => {
  if (!v) return ''
  const m = Math.floor((Date.now() - new Date(v)) / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function materialAuditChip(order) {
  const status = order?.materialAuditStatus
  if (!order?.auditMaterialLater && status !== 'WAITING_STOCK' && status !== 'PARTIAL') return null
  if (status === 'PARTIAL') return { label: 'Partial material', color: 'warning' }
  if (status === 'WAITING_STOCK') return { label: 'Audit material later', color: 'error' }
  return { label: 'Material audit', color: 'warning' }
}
function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}
function optionRemark(item, language) {
  return localizedSelectedOptions(item?.modelId, item?.selectedOptions, {}, language)
}
function replaceOrderInList(list, order, include) {
  if (!order?.id) return list
  const idx = list.findIndex(r => r.id === order.id)
  if (!include) return idx >= 0 ? list.filter(r => r.id !== order.id) : list
  if (idx < 0) return [order, ...list]
  const next = [...list]
  next[idx] = order
  return next
}


const ACTION_ICON_COLORS = {
  primary:   { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
  secondary: { bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd' },
  success:   { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  warning:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  error:     { bg: '#fee2e2', color: '#b91c1c', border: '#fecaca' },
  info:      { bg: '#e0f2fe', color: '#0369a1', border: '#7dd3fc' },
}

function MobileOrderActions({ order, actionItems, sx }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const visibleActions = actionItems.filter(action => action && action.show !== false)
  if (!visibleActions.length) return null

  const orderLabel = order?.orderNumber != null ? `#${order.orderNumber}` : (order?.orderCode || '')

  return (
    <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexShrink: 0, ...sx }}>
      <Button
        variant="contained"
        size="small"
        onClick={(event) => { event.stopPropagation(); setOpen(true) }}
        aria-label={t('shop.orderAction.more')}
        sx={{ minWidth: 48, minHeight: 48, px: 0.5, py: 0.25, borderRadius: 1, textTransform: 'none', flexDirection: 'column', lineHeight: 1 }}
      >
        <MoreHorizIcon sx={{ fontSize: 24 }} />
        <Typography component="span" sx={{ mt: 0.2, color: 'inherit', fontSize: 9, fontWeight: 800, lineHeight: 1, whiteSpace: 'nowrap' }}>
          {elapsed(order.confirmedAt || order.createdAt)}
        </Typography>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pr: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={900} sx={{ fontSize: 20 }}>{t('shop.orderAction.more')}</Typography>
            <Typography color="text.secondary" sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
              {t('shop.orderAction.title', { value: orderLabel })}
            </Typography>
          </Box>
          <IconButton onClick={() => setOpen(false)} aria-label={t('common.close')}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 0, pb: 2 }}>
          <Box sx={{ display: 'grid', gap: 1.1 }}>
            {visibleActions.map(action => {
              const iconColor = ACTION_ICON_COLORS[action.color || 'primary'] || ACTION_ICON_COLORS.primary
              const icon = React.cloneElement(action.icon, {
                sx: { fontSize: 34, color: iconColor.color, ...(action.icon.props.sx || {}) },
              })
              return (
                <Button
                  key={action.key}
                  variant="outlined"
                  fullWidth
                  onClick={(event) => { event.stopPropagation(); setOpen(false); action.onClick?.() }}
                  sx={{
                    minHeight: 78,
                    justifyContent: 'flex-start',
                    gap: 1.25,
                    px: 1.25,
                    py: 1,
                    borderRadius: 1,
                    textTransform: 'none',
                    borderColor: iconColor.border,
                    bgcolor: '#fff',
                    '&:hover': { borderColor: iconColor.color, bgcolor: iconColor.bg },
                  }}
                >
                  <Box sx={{ width: 50, height: 50, borderRadius: 1, display: 'grid', placeItems: 'center', bgcolor: iconColor.bg, border: `1px solid ${iconColor.border}`, flexShrink: 0 }}>
                    {icon}
                  </Box>
                  <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#111827', lineHeight: 1.2, textAlign: 'left' }}>
                    {action.label || t(action.labelKey)}
                  </Typography>
                </Button>
              )
            })}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  )
}
// ── Stock panel ─────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <Typography variant="caption" color="text.secondary"
      sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
      {children}
    </Typography>
  )
}

function StockPanel({ items, onUseInOrder, onClear, onRemoveItem }) {
  const { t } = useI18n()
  const [selectedUids, setSelectedUids] = useState(new Set())

  const available = items.filter(i => !i.utilizedOrderCode)
  const utilized  = items.filter(i =>  i.utilizedOrderCode)
  const queued    = available.filter(i => selectedUids.has(i.uid))
  const queueTotal = queued.reduce((s, i) => s + i.qty * Number(i.sellingPrice || 0), 0)

  const toggle = (uid) => setSelectedUids(prev => {
    const next = new Set(prev); next.has(uid) ? next.delete(uid) : next.add(uid); return next
  })

  const handleCreate = () => {
    if (!queued.length) return
    onUseInOrder(queued)
    setSelectedUids(new Set())
  }

  return (
    <Box sx={{ width: 256, flexShrink: 0, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fffde7' }}>

      {/* Header */}
      <Box sx={{ p: 1.25, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1, fontSize: 12 }}>
          Cancelled Stock
        </Typography>
        {available.length > 0 && (
          <Chip label={available.length} size="small" color="warning"
            sx={{ height: 16, fontSize: 10, mr: 0.5, '& .MuiChip-label': { px: 0.75 } }} />
        )}
        <Tooltip title="Clear all">
          <IconButton size="small" onClick={onClear} sx={{ p: 0.25 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Item list */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.75 }}>

        {/* Available */}
        {available.length > 0 && (
          <>
            <SectionLabel>{t('shopOrder.grid.availableTap')}</SectionLabel>
            <Stack spacing={0.5} sx={{ mb: utilized.length ? 1.5 : 0 }}>
              {available.map(item => {
                const sel = selectedUids.has(item.uid)
                return (
                  <Box key={item.uid} sx={{
                    bgcolor: sel ? '#dbeafe' : '#fff',
                    border: `1.5px solid ${sel ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: 1.25, px: 0.75, pt: 0.5, pb: 0.4,
                    transition: 'all 0.12s',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.25 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={700} display="block" noWrap>{item.modelName}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                          {item.qty > 1 ? `×${item.qty}  ` : ''}{fmt(item.sellingPrice)}
                        </Typography>
                        {item.itemNotes && (
                          <Typography variant="caption"
                            sx={{ fontSize: 10, color: '#dc2626', fontStyle: 'italic', display: 'block' }} noWrap>
                            ⚠ {item.itemNotes}
                          </Typography>
                        )}
                        <Typography variant="caption"
                          sx={{ fontSize: 9, color: '#94a3b8', fontFamily: 'monospace', display: 'block', mt: 0.1 }}>
                          from {item.cancelledFromOrderCode}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                        <Tooltip title={sel ? 'Deselect' : 'Select for new order'}>
                          <IconButton size="small" onClick={() => toggle(item.uid)}
                            sx={{ p: 0.25, color: sel ? '#2563eb' : '#9ca3af' }}>
                            {sel
                              ? <CheckCircleIcon sx={{ fontSize: 15 }} />
                              : <AddShoppingCartIcon sx={{ fontSize: 15 }} />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove">
                          <IconButton size="small" onClick={() => { onRemoveItem(item.uid); setSelectedUids(p => { const n = new Set(p); n.delete(item.uid); return n }) }}
                            sx={{ p: 0.125, color: '#d1d5db', '&:hover': { color: '#dc2626' } }}>
                            <CloseIcon sx={{ fontSize: 11 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </>
        )}

        {/* Utilized */}
        {utilized.length > 0 && (
          <>
            <SectionLabel>Utilized ({utilized.length})</SectionLabel>
            <Stack spacing={0.5}>
              {utilized.map(item => (
                <Box key={item.uid} sx={{
                  bgcolor: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 1.25, px: 0.75, pt: 0.5, pb: 0.4, opacity: 0.85,
                }}>
                  <Typography variant="caption" fontWeight={600} display="block" noWrap color="text.secondary">
                    {item.modelName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                    {item.qty > 1 ? `×${item.qty}  ` : ''}{fmt(item.sellingPrice)}
                  </Typography>
                  {item.itemNotes && (
                    <Typography variant="caption"
                      sx={{ fontSize: 10, color: '#9ca3af', fontStyle: 'italic', display: 'block' }} noWrap>
                      {item.itemNotes}
                    </Typography>
                  )}
                  <Typography variant="caption"
                    sx={{ fontSize: 9, fontFamily: 'monospace', display: 'block', color: '#16a34a', fontWeight: 700, mt: 0.1 }}>
                    ✓ → {item.utilizedOrderCode}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </>
        )}

        {items.length === 0 && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, display: 'block', textAlign: 'center', mt: 2 }}>
            No cancelled stock
          </Typography>
        )}
      </Box>

      {/* Create order from selection */}
      {queued.length > 0 && (
        <Box sx={{ borderTop: '1px solid #e0e0e0', p: 1 }}>
          <Typography variant="caption" color="primary" fontWeight={700}
            sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 0.5 }}>
            Selected ({queued.length})
          </Typography>
          <Stack spacing={0.2} sx={{ mb: 0.75 }}>
            {queued.map(i => (
              <Typography key={i.uid} variant="caption" noWrap sx={{ fontSize: 11 }}>
                {i.qty > 1 ? `${i.qty}× ` : ''}{i.modelName}
              </Typography>
            ))}
            <Typography variant="caption" color="primary" fontWeight={800} sx={{ fontSize: 12 }}>
              {fmt(queueTotal)}
            </Typography>
          </Stack>
          <Button variant="contained" size="small" fullWidth startIcon={<AddCircleOutlineIcon />}
            onClick={handleCreate}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
            Create Order
          </Button>
        </Box>
      )}
    </Box>
  )
}

// ── Status Board (shared by all board tabs) ─────────────────────────

const BOARD_STYLE = {
  CONFIRMED:  { headerBg: '#e3f2fd', border: '#1976d2',  cardBg: '#f0f7ff',  color: '#1565c0',  numColor: '#1976d2' },
  PREPARING:  { headerBg: '#fff3e0', border: '#ff9800',  cardBg: '#fffaf0',  color: '#e65100',  numColor: '#ef6c00' },
  READY:      { headerBg: '#e8f5e9', border: '#4caf50',  cardBg: '#f0fdf4',  color: '#2e7d32',  numColor: '#388e3c', animate: true },
  PICKED_UP:  { headerBg: '#e3f2fd', border: '#0288d1',  cardBg: '#f0f9ff',  color: '#01579b',  numColor: '#0288d1' },
}
const BOARD_HIGH_CONTRAST_STYLE = {
  CONFIRMED:  { headerBg: '#dbeafe', border: '#1d4ed8',  cardBg: '#ffffff',  color: '#0f172a',  numColor: '#1d4ed8' },
  PREPARING:  { headerBg: '#ffedd5', border: '#c2410c',  cardBg: '#ffffff',  color: '#0f172a',  numColor: '#c2410c' },
  READY:      { headerBg: '#dcfce7', border: '#15803d',  cardBg: '#ffffff',  color: '#0f172a',  numColor: '#15803d', animate: true },
  PICKED_UP:  { headerBg: '#e0f2fe', border: '#0369a1',  cardBg: '#ffffff',  color: '#0f172a',  numColor: '#0369a1' },
}

function StatusBoard({ status, orders, modelImageMap = {}, onAction, onDetail, onPayQr, onPickupQr, onSwitchQr, onRevertCash, onShowTrackQr, onPrintTag, onMergeBills, onChangeSeat, displaySize = 'normal', highContrast = false }) {
  const { language, t } = useI18n()
  // onAction(type, orderId, orderNumber)
  const large = displaySize === 'large'
  const style = highContrast
    ? (BOARD_HIGH_CONTRAST_STYLE[status] || BOARD_HIGH_CONTRAST_STYLE.CONFIRMED)
    : (BOARD_STYLE[status] || BOARD_STYLE.CONFIRMED)
  const cardMinWidth = large ? 340 : 260
  const numberSize = large ? 60 : 46
  const numberFont = large ? 24 : 18
  const metaFont = large ? 13 : 10
  const badgeFont = large ? 14 : 11
  const rootQtyFont = large ? 30 : 22
  const rootNameFont = large ? 21 : 16
  const detailFont = large ? 16 : 14
  const childQtyFont = large ? 25 : 21
  const childNameFont = large ? 21 : 17
  const primaryTextColor = highContrast ? '#000' : '#111'
  const detailTextColor = highContrast ? '#111827' : '#555'
  const childTextColor = highContrast ? '#111827' : '#374151'
  const mutedTextColor = highContrast ? '#334155' : '#94a3b8'
  const [imagePreview, setImagePreview] = useState(null)

  if (!orders.length) {
    const icons = { CONFIRMED: <KitchenIcon sx={{ fontSize: 44, opacity: 0.18 }} />, PREPARING: <HourglassTopIcon sx={{ fontSize: 44, opacity: 0.18 }} />, READY: <CheckCircleIcon sx={{ fontSize: 44, opacity: 0.18 }} />, PICKED_UP: <LocalShippingIcon sx={{ fontSize: 44, opacity: 0.18 }} /> }
    const statusLabel = localizedStatusLabel(status, t).toLowerCase()
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        {icons[status]}
        <Typography variant="body2" sx={{ mt: 1 }}>{t('shopOrder.grid.emptyStatusOrders', { status: statusLabel })}</Typography>
      </Box>
    )
  }

  return (
    <>
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`, gap: large ? 2 : 1.5, p: large ? 2 : 1.5 }}>
      {orders.map(order => {
        const since = elapsed(order.confirmedAt || order.createdAt)
        const boardActionItems = [
          { key: 'detail', labelKey: 'shop.orderAction.viewDetail', icon: <VisibilityIcon />, color: 'primary', onClick: () => onDetail(order) },
          { key: 'receipt', labelKey: 'shop.orderAction.printReceipt', icon: <ReceiptLongIcon />, color: 'primary', onClick: () => printOrderReceiptTracked(order) },
          { key: 'trackQr', labelKey: 'shop.orderAction.showTracking', icon: <QrCodeScannerIcon />, color: 'info', show: Boolean(onShowTrackQr), onClick: () => onShowTrackQr?.(order) },
          { key: 'trackingTag', labelKey: 'shop.orderAction.printTrackingTag', icon: <LocalOfferIcon />, color: 'secondary', show: Boolean(onPrintTag), onClick: () => onPrintTag?.(order) },
          { key: 'cupLabel', labelKey: 'shop.orderAction.printCupLabel', icon: <LocalCafeIcon />, color: 'warning', onClick: () => printCupLabelsTracked(order) },
          { key: 'paymentQr', labelKey: 'shop.orderAction.paymentQr', icon: <PaymentsIcon />, color: 'success', show: order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED', onClick: () => onPayQr(order) },
          { key: 'merge', labelKey: 'shop.orderAction.mergeOtherBills', icon: <MergeTypeIcon />, color: 'secondary', show: Boolean(onMergeBills) && !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status), onClick: () => onMergeBills?.(order) },
        ]
        return (
          <Card key={order.id} elevation={2} sx={{
            borderRadius: 2, border: `2px solid ${style.border}`, bgcolor: style.cardBg,
            animation: style.animate ? 'pulse 3s ease-in-out infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { boxShadow: `0 0 0 0 ${style.border}22` }, '50%': { boxShadow: `0 0 0 6px ${style.border}22` } },
          }}>
            <CardContent sx={{ pb: '8px !important', pt: 1.5, px: 1.5 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.75 }}>
                <Box sx={{ width: numberSize, height: numberSize, borderRadius: '50%', bgcolor: style.numColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: numberFont, flexShrink: 0, mr: 1 }}>
                  {prefixedOrderNumber(order)}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.25 }}>
                    {order.fulfillmentType === 'DINE_IN' && <Tooltip title={t('shopOrder.grid.changeSeatTooltip')}><Chip clickable onClick={() => onChangeSeat?.(order)} icon={<TableBarIcon sx={{ fontSize: large ? 17 : 15 }} />} label={order.tableName || order.customerTableTag || '?'} size="small" color="info" variant="outlined" sx={{ height: large ? 30 : 26, fontSize: large ? 15 : 13, fontWeight: 900, '& .MuiChip-label': { px: 1 } }} /></Tooltip>}
                    {order.paymentStatus === 'PAID'
                      ? <Chip icon={<PaidIcon sx={{ fontSize: 12 }} />} label={localizedPaymentStatusLabel(order.paymentStatus, t)} size="small" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
                      : <Chip label={localizedPaymentStatusLabel(order.paymentStatus, t)} size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                    }
                    {(() => {
                      const chip = materialAuditChip(order)
                      return chip ? <Chip label={chip.label} size="small" color={chip.color} sx={{ height: large ? 24 : 20, fontSize: large ? 12 : 10, fontWeight: 800 }} /> : null
                    })()}
                  </Box>
                  {order.customerName && <Typography variant="caption" display="block" noWrap>{order.customerName}</Typography>}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, fontSize: metaFont }}>{t('shopOrder.grid.elapsedAgo', { time: since })}</Typography>
                    {(() => {
                      const roots = (order.items || []).filter(it => !it.parentItemId)
                      const totalQty = roots.reduce((s, it) => s + Number(it.quantity || 1), 0)
                      return totalQty > 0 ? (
                        <Box sx={{ bgcolor: style.numColor, color: '#fff', fontWeight: 900, fontSize: badgeFont, borderRadius: 99, px: large ? 1 : 0.75, py: 0.1, lineHeight: 1.6 }}>
                          {t('shopOrder.grid.orderItemsCount', { count: totalQty })}
                        </Box>
                      ) : null
                    })()}
                  </Box>
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.25 }}>
                  <Tooltip title={t('shop.orderAction.printCupLabel')}>
                    <IconButton size="small" onClick={() => printCupLabelsTracked(order)} sx={{ p: 0.25, color: style.color }}>
                      <LocalCafeIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  {order.paymentStatus !== 'PAID' && (
                    <Tooltip title={t('shop.orderAction.paymentQr')}>
                      <IconButton size="small" onClick={() => onPayQr(order)} sx={{ p: 0.25, color: '#1565c0' }}>
                        <PaymentsIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={t('shop.orderAction.viewDetail')}>
                    <IconButton size="small" onClick={() => onDetail(order)} sx={{ p: 0.25 }}>
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <MobileOrderActions order={order} actionItems={boardActionItems} />
              </Box>

              <Divider sx={{ mb: 0.75 }} />

              {/* Items */}
              <Stack spacing={0.3} sx={{ mb: 1, minHeight: 32 }}>
                {(() => {
                  const allItems = order.items || []
                  const roots = allItems.filter(it => !it.parentItemId)
                  return roots.map((root, rIdx) => {
                    const children = allItems.filter(it => it.parentItemId === root.id)
                    const optStr = optionRemark(root, language)
                    return (
                      <Box key={root.id || rIdx} sx={{ mb: 0.5 }}>
                        {/* Root item */}
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: mutedTextColor, flexShrink: 0 }}>
                            {rIdx + 1}.
                          </Typography>
                          <Typography sx={{ fontSize: rootQtyFont, fontWeight: 900, color: style.color, lineHeight: 1, flexShrink: 0 }}>
                            {Number(root.quantity)}×
                          </Typography>
                          <Typography sx={{ fontSize: rootNameFont, fontWeight: 800, color: primaryTextColor, lineHeight: 1.2 }}>
                            {localizedModelName(root, language)}
                          </Typography>
                          {root.dailyLastOrder && (
                            <Chip label={t('shopOrder.grid.dailyLastOrder')} size="small" color="error" sx={{ height: 18, fontSize: 10, fontWeight: 900 }} />
                          )}
                        </Box>
                        {optStr && <Typography sx={{ fontSize: detailFont, pl: 2, display: 'block', color: detailTextColor, lineHeight: 1.4, fontWeight: highContrast ? 700 : 500 }}>{optStr}</Typography>}
                        {root.itemNotes && <Typography sx={{ fontSize: detailFont, pl: 2, fontStyle: 'italic', display: 'block', color: '#c62828', fontWeight: 700 }}>⚠ {root.itemNotes}</Typography>}
                        {/* Child / topping items */}
                        {children.map((child, ci) => {
                          const img = child.imageUrl || child.thumbnailUrl || modelImageMap[child.modelId]
                          return (
                            <Box key={child.id || ci} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 3, pl: 1, mt: 0.3, borderLeft: `3px solid ${style.border}` }}>
                              <Typography sx={{ fontSize: 12, color: mutedTextColor, fontWeight: 800, flexShrink: 0, minWidth: 24 }}>
                                {rIdx + 1}.{ci + 1}
                              </Typography>
                              {img && (
                                <Box component="img" src={img} alt={localizedModelName(child, language)}
                                  onClick={() => setImagePreview({ imageUrl: img, modelName: localizedModelName(child, language) })}
                                  onError={e => { e.target.style.display = 'none' }}
                                  sx={{ width: large ? 38 : 30, height: large ? 38 : 30, objectFit: 'cover', borderRadius: 1, flexShrink: 0, cursor: 'pointer', border: '1px solid #e2e8f0' }} />
                              )}
                              <Typography sx={{ fontSize: childQtyFont, fontWeight: 900, color: primaryTextColor, lineHeight: 1, flexShrink: 0 }}>
                                {Number(child.quantity)}×
                              </Typography>
                              <Typography onClick={() => img && setImagePreview({ imageUrl: img, modelName: localizedModelName(child, language) })}
                                sx={{ fontSize: childNameFont, fontWeight: 900, color: childTextColor, lineHeight: 1.15, flex: 1, ...(img ? { cursor: 'pointer', '&:hover': { color: '#1976d2', textDecoration: 'underline dotted' } } : {}) }}>
                                {localizedModelName(child, language)}{child.dailyLastOrder ? ` [${t('shopOrder.grid.dailyLastOrder')}]` : ''}
                              </Typography>
                            </Box>
                          )
                        })}
                      </Box>
                    )
                  })
                })()}
              </Stack>

              {order.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontStyle: 'italic', display: 'block', mb: 0.75 }}>{t('common.notes')}: {order.notes}</Typography>}

              {/* Action buttons per status */}
              <Stack spacing={0.5}>
                {/* Payment method switch */}
                {!['PICKED_UP', 'COMPLETED', 'CANCELLED'].includes(status) && (
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {order.paymentMethod === 'CASH' && (
                      <Button size="small" variant="outlined" color="success" fullWidth
                        startIcon={<QrCode2Icon sx={{ fontSize: 12 }} />}
                        onClick={() => onSwitchQr(order)}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
                        {t('shopOrder.grid.switchToQr')}
                      </Button>
                    )}
                    {(order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT') && (
                      <Button size="small" variant="outlined" color="warning" fullWidth
                        onClick={() => onRevertCash(order)}
                        sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
                        {t('shopOrder.grid.switchToCash')}
                      </Button>
                    )}
                  </Box>
                )}
                {order.paymentStatus !== 'PAID' && status !== 'PICKED_UP' && (
                  <Button size="small" variant="contained" color="success" fullWidth
                    startIcon={<PaidIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onAction('pay', order.id, order.orderNumber)}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}>
                    {t('shopOrder.grid.markAsPaid')}
                  </Button>
                )}
                {status === 'CONFIRMED' && (
                  <Button size="small" variant="contained" color="warning" fullWidth onClick={() => onAction('prepare', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>{t('shopOrder.grid.prepare')}</Button>
                )}
                {status === 'PREPARING' && (
                  <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('ready', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>{t('shopOrder.grid.readyCheck')}</Button>
                )}
                {status === 'READY' && (
                  <Stack spacing={0.5}>
                    <Button size="small" variant="outlined" color="warning" fullWidth
                      startIcon={<QrCode2Icon sx={{ fontSize: large ? 17 : 13 }} />}
                      onClick={() => onPickupQr(order)}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                      {t('shopOrder.grid.pickupQr')}
                    </Button>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      {(order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT')
                        ? <Button size="small" variant="contained" color="info" fullWidth onClick={() => onAction('pickup', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>{t('shopOrder.grid.pickedUpCheck')}</Button>
                        : <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('complete', order.id, order.orderNumber)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>{t('shopOrder.grid.completeCheck')}</Button>
                      }
                    </Box>
                  </Stack>
                )}
                {status === 'PICKED_UP' && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
                    {t('shopOrder.grid.pickedUpAt', { time: order.completedAt ? dateFmt(order.completedAt) : '' })}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )
      })}
    </Box>

    {/* ── Sub-item image preview ── */}
    <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {imagePreview && (
        <>
          <Box sx={{ position: 'relative', bgcolor: '#f0f0f0', lineHeight: 0 }}>
            <Box component="img" src={imagePreview.imageUrl} alt={imagePreview.modelName}
              sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
            <IconButton size="small" onClick={() => setImagePreview(null)}
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography fontWeight={800} sx={{ fontSize: 17 }}>{imagePreview.modelName}</Typography>
          </Box>
        </>
      )}
    </Dialog>
    </>
  )
}

// ── OrderCard ───────────────────────────────────────────────────────

function editingElapsed(since) {
  if (!since) return '…'
  const mins = Math.floor((Date.now() - new Date(since).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  return mins >= 15 ? `${mins} min ⚠` : `${mins} min`
}

const CARD_STYLE = {
  PENDING:   { border: '#f59e0b', bg: '#fffbeb', num: '#d97706' },
  CONFIRMED: { border: '#3b82f6', bg: '#eff6ff', num: '#2563eb' },
  PREPARING: { border: '#f97316', bg: '#fff7ed', num: '#ea580c' },
  READY:     { border: '#22c55e', bg: '#f0fdf4', num: '#16a34a', pulse: true },
  PICKED_UP: { border: '#0ea5e9', bg: '#f0f9ff', num: '#0284c7' },
  COMPLETED: { border: '#94a3b8', bg: '#f8fafc', num: '#64748b' },
  CANCELLED: { border: '#fca5a5', bg: '#fff5f5', num: '#ef4444' },
}

function OrderCard({ order, tables, actions, modelImageMap = {}, selected, onSelect, displaySize = 'normal', highContrast = false }) {
  const [editNum, setEditNum]       = useState(false)
  const [numVal, setNumVal]         = useState(String(order.orderNumber ?? ''))
  const [imagePreview, setImagePreview] = useState(null)
  const { language, t } = useI18n()

  const large = displaySize === 'large'
  const baseStyle = CARD_STYLE[order.status] || CARD_STYLE.CONFIRMED
  const s       = highContrast ? { ...baseStyle, bg: '#fff', border: baseStyle.num } : baseStyle
  const primaryTextColor = highContrast ? '#000' : '#111'
  const detailTextColor = highContrast ? '#111827' : '#555'
  const childTextColor = highContrast ? '#111827' : '#374151'
  const mutedTextColor = highContrast ? '#334155' : '#94a3b8'
  const secondaryTextColor = highContrast ? '#1f2937' : '#64748b'
  const optionFont = large ? 16 : 14
  const childQtyFont = large ? 24 : 20
  const childNameFont = large ? 21 : 17
  const isQr    = order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT'
  const isActive = !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)
  const roots    = (order.items || []).filter(it => !it.parentItemId)
  const childMap = {}
  ;(order.items || []).filter(it => it.parentItemId).forEach(it => {
    const k = String(it.parentItemId)
    if (!childMap[k]) childMap[k] = []
    childMap[k].push(it)
  })
  const orderActionItems = [
    { key: 'detail', labelKey: 'shop.orderAction.viewDetail', icon: <VisibilityIcon />, color: 'primary', onClick: () => actions.detail(order) },
    { key: 'receipt', labelKey: 'shop.orderAction.printReceipt', icon: <ReceiptLongIcon />, color: 'primary', onClick: () => printOrderReceiptTracked(order) },
    { key: 'combinedReceipt', labelKey: 'shop.orderAction.combinedReceipt', icon: <PeopleAltIcon />, color: 'secondary', show: Boolean(order.sourceToken), onClick: () => actions.combinedReceipt(order.sourceToken) },
    { key: 'trackQr', labelKey: 'shop.orderAction.showTracking', icon: <QrCodeScannerIcon />, color: 'info', onClick: () => actions.showTrackQr(order) },
    { key: 'trackingTag', labelKey: 'shop.orderAction.printTrackingTag', icon: <LocalOfferIcon />, color: 'secondary', onClick: () => actions.printTag(order) },
    { key: 'cupLabel', labelKey: 'shop.orderAction.printCupLabel', icon: <LocalCafeIcon />, color: 'warning', onClick: () => printCupLabelsTracked(order) },
    { key: 'paymentQr', labelKey: 'shop.orderAction.paymentQr', icon: <PaymentsIcon />, color: 'success', show: order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED', onClick: () => actions.payQr(order) },
    { key: 'merge', labelKey: 'shop.orderAction.mergeOtherBills', icon: <MergeTypeIcon />, color: 'secondary', show: isActive, onClick: () => actions.mergeBills(order) },
    { key: 'revert', label: 'Hoàn tác đơn', icon: <UndoIcon />, color: 'warning', show: !['PENDING', 'CANCELLED'].includes(order.status), onClick: () => actions.revert(order) },
  ]
  const commitNum = () => {
    const n = parseInt(numVal, 10)
    if (!isNaN(n) && n > 0 && n !== order.orderNumber) actions.setOrderNumber(order.id, n)
    setEditNum(false)
  }

  return (
    <>
    <Box sx={{
      border: `${highContrast ? 3 : 2}px solid ${selected ? '#6366f1' : s.border}`,
      borderRadius: 2, bgcolor: s.bg,
      display: 'flex', flexDirection: 'column',
      opacity: order.status === 'CANCELLED' ? 0.65 : 1,
      animation: s.pulse ? 'ocPulse 3s ease-in-out infinite' : 'none',
      '@keyframes ocPulse': { '0%,100%': { boxShadow: `0 0 0 0 ${s.border}33` }, '50%': { boxShadow: `0 0 0 6px ${s.border}33` } },
      '&:hover': { boxShadow: `0 2px 12px ${s.border}55` },
      transition: 'box-shadow 0.15s',
    }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: large ? 1 : 0.75, p: large ? 1.5 : 1.25, pb: large ? 0.75 : 0.5 }}>

        {/* Selection checkbox */}
        <Checkbox
          size="small" checked={selected} onChange={onSelect}
          sx={{ p: 0.25, mt: 0.5, color: s.num, '&.Mui-checked': { color: '#6366f1' } }}
        />

        {/* Order number circle — click to edit */}
        {editNum ? (
          <Box component="input"
            type="number" value={numVal} autoFocus
            onChange={e => setNumVal(e.target.value)}
            onBlur={commitNum}
            onKeyDown={e => { if (e.key === 'Enter') commitNum(); if (e.key === 'Escape') { setNumVal(String(order.orderNumber ?? '')); setEditNum(false) } }}
            sx={{ width: large ? 58 : 44, height: large ? 58 : 44, borderRadius: '50%', border: `2px solid ${s.num}`, textAlign: 'center', fontWeight: 900, fontSize: large ? 18 : 15, color: s.num, background: 'white', outline: 'none', p: 0, flexShrink: 0 }}
          />
        ) : (
          <Tooltip title="Click to edit order #">
            <Box onClick={() => { setNumVal(String(order.orderNumber ?? '')); setEditNum(true) }} sx={{
              width: large ? 58 : 44, height: large ? 58 : 44, borderRadius: '50%', flexShrink: 0,
              bgcolor: s.num, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: large ? 21 : 16, cursor: 'pointer',
              '&:hover': { filter: 'brightness(0.85)' },
            }}>
              {prefixedOrderNumber(order)}
            </Box>
          </Tooltip>
        )}

        {/* Status / meta */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', alignItems: 'center', mb: 0.3 }}>
            <Chip label={localizedStatusLabel(order.status, t)} color={STATUS_COLOR[order.status] || 'default'} size="small"
              sx={{ height: large ? 24 : 20, fontSize: large ? 12 : 10, fontWeight: 800 }} />
            {order.fulfillmentType && (() => { const m = { DINE_IN: '🪑', PICKUP: '🥡', DELIVERY: '🛵' }; return <Typography sx={{ fontSize: large ? 17 : 13 }}>{m[order.fulfillmentType] || ''}</Typography> })()}
            {order.fulfillmentType === 'DINE_IN' && <Tooltip title={t('shopOrder.grid.changeSeatTooltip')}><Chip clickable onClick={() => actions.changeSeat(order)} icon={<TableBarIcon sx={{ fontSize: large ? 18 : 16 }} />} label={order.tableName || '?'} size="small" color="info" variant="outlined" sx={{ height: large ? 32 : 28, fontSize: large ? 16 : 14, fontWeight: 900, '& .MuiChip-label': { px: 1 } }} /></Tooltip>}
            {order.customerTableTag && <Tooltip title={t('shopOrder.grid.changeSeatTooltip')}><Chip clickable onClick={() => actions.changeSeat(order)} icon={<TableBarIcon sx={{ fontSize: large ? 19 : 17 }} />} label={`THẺ ${order.customerTableTag}`} size="small" color="error" sx={{ height: large ? 34 : 29, fontSize: large ? 17 : 14, fontWeight: 900, '& .MuiChip-label': { px: 1 } }} /></Tooltip>}
            {order.paymentStatus === 'PAID'
              ? <Chip icon={<PaidIcon sx={{ fontSize: 11, ml: '4px !important' }} />} label={localizedPaymentStatusLabel(order.paymentStatus, t)} size="small" color="success" sx={{ height: large ? 24 : 20, fontSize: large ? 12 : 10, fontWeight: 800 }} />
              : <Chip label={localizedPaymentStatusLabel(order.paymentStatus, t)} size="small" color="warning" variant="outlined" sx={{ height: large ? 24 : 20, fontSize: large ? 12 : 10 }} />
            }
            {order.paymentMethod === 'BANK_QR' && <Chip label="QR" size="small" color="info" sx={{ height: large ? 22 : 18, fontSize: large ? 12 : 10 }} />}
            {order.paymentMethod === 'SPLIT' && <Chip label={t('shopOrder.grid.splitPayment')} size="small" color="secondary" sx={{ height: large ? 22 : 18, fontSize: large ? 12 : 10 }} />}
            {(() => {
              const chip = materialAuditChip(order)
              return chip ? <Chip label={chip.label} size="small" color={chip.color} sx={{ height: large ? 22 : 18, fontSize: large ? 12 : 10, fontWeight: 800 }} /> : null
            })()}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {order.customerName && <Typography sx={{ fontSize: large ? 15 : 12, fontWeight: 800, color: '#1e293b', flex: 1 }} noWrap>{order.customerName}</Typography>}
          </Box>
        </Box>

        {/* Icon cluster */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex' }}>
            <Tooltip title={t('shop.orderAction.viewDetail')}>
              <IconButton size="small" onClick={() => actions.detail(order)} sx={{ p: 0.35 }}><VisibilityIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
            </Tooltip>
            <Tooltip title={t('shop.orderAction.printReceipt')}>
              <IconButton size="small" color="primary" onClick={() => printOrderReceiptTracked(order)} sx={{ p: 0.35 }}><ReceiptLongIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
            </Tooltip>
            {order.sourceToken && (
              <Tooltip title={t('shop.orderAction.combinedReceipt')}>
                <IconButton size="small" color="secondary" onClick={() => actions.combinedReceipt(order.sourceToken)} sx={{ p: 0.35 }}><PeopleAltIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'flex' }}>
            <Tooltip title={t('shop.orderAction.showTracking')}>
              <IconButton size="small" onClick={() => actions.showTrackQr(order)} sx={{ p: 0.35, color: '#0288d1' }}>
                <QrCodeScannerIcon sx={{ fontSize: large ? 20 : 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('shop.orderAction.printTrackingTag')}>
              <IconButton size="small" color="secondary" onClick={() => actions.printTag(order)} sx={{ p: 0.35 }}><LocalOfferIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
            </Tooltip>
            <Tooltip title={t('shop.orderAction.printCupLabel')}>
              <IconButton size="small" onClick={() => printCupLabelsTracked(order)} sx={{ p: 0.35 }}><LocalCafeIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
            </Tooltip>
            {order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && (
              <Tooltip title={t('shop.orderAction.paymentQr')}>
                <IconButton size="small" color="primary" onClick={() => actions.payQr(order)} sx={{ p: 0.35 }}><PaymentsIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
              </Tooltip>
            )}
            {isActive && (
              <Tooltip title={t('shop.orderAction.mergeOtherBills')}>
                <IconButton size="small" onClick={() => actions.mergeBills(order)} sx={{ p: 0.35, color: '#7c3aed' }}><MergeTypeIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ mt: 0.15, maxWidth: large ? 150 : 125, textAlign: 'right', alignSelf: 'flex-end' }}>
            <Typography sx={{ fontSize: large ? 11 : 9, color: '#64748b', lineHeight: 1.15, whiteSpace: 'nowrap' }}>
              {elapsed(order.confirmedAt || order.createdAt)} ago
            </Typography>
            {order.staffName && <Typography title={order.staffName} sx={{ fontSize: large ? 11 : 9, color: '#64748b', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>by {order.staffName}</Typography>}
          </Box>
        </Box>
        <MobileOrderActions order={order} actionItems={orderActionItems} />
      </Box>

      {/* ── Table selector + order code ── */}
      <Box sx={{ px: large ? 1.5 : 1.25, pb: large ? 0.75 : 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <TableBarIcon sx={{ fontSize: large ? 24 : 21, color: '#2563eb', flexShrink: 0 }} />
        <Box component="select"
          value={order.tableId || ''}
          onChange={e => actions.setTable(order.id, e.target.value)}
          sx={{ fontSize: large ? 17 : 15, height: large ? 42 : 38, border: '2px solid #93c5fd', borderRadius: 1, px: 1, flex: 1, cursor: 'pointer', bgcolor: 'white', color: '#111827', fontWeight: 900 }}
        >
          <option value="">{t('shopOrder.grid.noTable')}</option>
          {tables.map(t => <option key={t.id} value={t.id}>{t.tableName}</option>)}
        </Box>
        <Typography sx={{ fontSize: large ? 12 : 10, fontFamily: 'monospace', color: '#94a3b8', flexShrink: 0 }}>{order.orderCode}</Typography>
      </Box>

      <Divider />

      {/* ── Items ── */}
      <Box sx={{ px: large ? 1.5 : 1.25, py: large ? 1 : 0.75, flex: 1 }}>
        {roots.length === 0
          ? <Typography sx={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>{t('shopOrder.edit.noItems')}</Typography>
          : roots.slice(0, 7).map((root, rIdx) => {
              const children = childMap[String(root.id)] || []
              const optStr = optionRemark(root, language)
              return (
                <Box key={root.id || rIdx} sx={{ mb: 0.6 }}>
                  <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'baseline' }}>
                    <Typography sx={{ fontSize: large ? 14 : 12, color: mutedTextColor, fontWeight: 800, flexShrink: 0 }}>{rIdx + 1}.</Typography>
                    <Typography sx={{ fontSize: large ? 28 : 22, fontWeight: 900, color: s.num, lineHeight: 1, flexShrink: 0 }}>{Number(root.quantity)}×</Typography>
                    <Typography sx={{ fontSize: large ? 18 : 15, fontWeight: 800, color: primaryTextColor, lineHeight: 1.2, flex: 1 }}>{localizedModelName(root, language)}</Typography>
                    {root.dailyLastOrder && <Chip label={t('shopOrder.grid.dailyLastOrder')} size="small" color="error" sx={{ height: 18, fontSize: 10, fontWeight: 900 }} />}
                    <Typography sx={{ fontSize: large ? 14 : 12, color: secondaryTextColor, flexShrink: 0, pl: 0.5 }}>{fmt(root.lineTotal)}</Typography>
                  </Box>
                  {optStr && <Typography sx={{ fontSize: optionFont, pl: 2.5, color: detailTextColor, display: 'block', lineHeight: 1.4, fontWeight: highContrast ? 700 : 500 }}>{optStr}</Typography>}
                  {root.itemNotes && <Typography sx={{ fontSize: large ? 15 : 13, pl: 2.5, fontStyle: 'italic', color: '#b91c1c', fontWeight: 700, display: 'block' }}>⚠ {root.itemNotes}</Typography>}
                  {children.map((child, ci) => {
                    const img = child.imageUrl || child.thumbnailUrl || modelImageMap[child.modelId]
                    return (
                      <Box key={child.id || ci} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', ml: 2.5, pl: 0.75, mt: 0.3, borderLeft: `2px solid ${s.border}` }}>
                        <Typography sx={{ fontSize: 12, color: mutedTextColor, fontWeight: 800, flexShrink: 0, minWidth: 24 }}>{rIdx+1}.{ci+1}</Typography>
                        {img && (
                          <Box component="img" src={img} alt={localizedModelName(child, language)}
                            onClick={() => setImagePreview({ imageUrl: img, modelName: localizedModelName(child, language) })}
                            onError={e => { e.target.style.display = 'none' }}
                            sx={{ width: large ? 38 : 30, height: large ? 38 : 30, objectFit: 'cover', borderRadius: 1, flexShrink: 0, cursor: 'pointer', border: '1px solid #e2e8f0' }} />
                        )}
                        <Typography sx={{ fontSize: childQtyFont, fontWeight: 900, color: primaryTextColor, lineHeight: 1, flexShrink: 0 }}>{Number(child.quantity)}×</Typography>
                        <Typography onClick={() => img && setImagePreview({ imageUrl: img, modelName: localizedModelName(child, language) })}
                          sx={{ fontSize: childNameFont, fontWeight: 900, color: childTextColor, lineHeight: 1.15, flex: 1, ...(img ? { cursor: 'pointer', '&:hover': { color: '#1976d2', textDecoration: 'underline dotted' } } : {}) }}>
                          {localizedModelName(child, language)}{child.dailyLastOrder ? ` [${t('shopOrder.grid.dailyLastOrder')}]` : ''}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              )
            })
        }
        {roots.length > 7 && <Typography sx={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>{t('shopOrder.grid.moreItemsCount', { count: roots.length - 7 })}</Typography>}
      </Box>

      {/* ── Notes + total ── */}
      <Box sx={{ px: 1.25, pb: 0.75 }}>
        {order.notes && <Typography sx={{ fontSize: 11, fontStyle: 'italic', color: '#64748b', mb: 0.25 }}>📝 {order.notes}</Typography>}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: large ? 12 : 10, color: '#64748b' }}>{dateFmt(order.createdAt)}</Typography>
          <Typography sx={{ fontSize: 17, fontWeight: 900, color: s.num }}>{fmt(payableAmount(order))}</Typography>
        </Box>
      </Box>

      <Divider />

      {/* ── Actions ── */}
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>

        {/* Payment method swap */}
        {(order.paymentMethod === 'CASH' || isQr) && isActive && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {order.paymentMethod === 'CASH' && (
              <Button size="small" variant="outlined" color="success" startIcon={<QrCode2Icon sx={{ fontSize: 12 }} />}
                onClick={() => actions.switchToQr(order)}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, flex: 1, py: 0.25 }}>
                {t('shopOrder.grid.switchToQr')}
              </Button>
            )}
            {isQr && (
              <Button size="small" variant="outlined" color="warning"
                onClick={() => actions.revertCash(order)}
                sx={{ textTransform: 'none', fontSize: 11, flex: isQr && order.paymentMethod !== 'CASH' ? 1 : 0, py: 0.25, px: 1 }}>
                {t('shopOrder.grid.switchToCash')}
              </Button>
            )}
          </Box>
        )}

        {order.status === 'PENDING' && order.customerEditing && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip label={t('shopOrder.grid.editingChip', { time: order.customerEditingSince ? ` · ${editingElapsed(order.customerEditingSince)}` : '…' })}
              size="small" color="warning" sx={{ fontWeight: 700, fontSize: 10 }} />
            <Button size="small" variant="outlined" color="error" onClick={() => actions.forceConfirm(order)}
              sx={{ textTransform: 'none', fontSize: 10, px: 0.75, py: 0.25, lineHeight: 1.4, fontWeight: 700 }}>
              {t('shopOrder.grid.forceConfirm')}
            </Button>
          </Box>
        )}

        {/* Primary status transition */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {order.status === 'PENDING' && (
            <Button size="small" variant="contained" color="primary" fullWidth
              disabled={Boolean(order.customerEditing)}
              onClick={() => actions.confirm(order)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12 }}>
              {t('shopOrder.grid.confirmOrder')}
            </Button>
          )}
          {order.status === 'CONFIRMED' && (
            <Button size="small" variant="contained" color="warning" fullWidth
              onClick={() => actions.prepare(order)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12 }}>
              {t('shopOrder.grid.startPreparing')}
            </Button>
          )}
          {order.status === 'PREPARING' && (
            <Button size="small" variant="contained" color="success" fullWidth
              onClick={() => actions.ready(order)}
              sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12 }}>
              {t('shopOrder.grid.readyCheck')}
            </Button>
          )}
          {order.status === 'READY' && (
            <>
              <Button size="small" variant="outlined" color="warning"
                startIcon={<QrCode2Icon sx={{ fontSize: 12 }} />}
                onClick={() => actions.pickupQr(order)}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, flex: 1, py: 0.5 }}>
                {t('shopOrder.grid.pickupQr')}
              </Button>
              {isQr
                ? <Button size="small" variant="contained" color="info" onClick={() => actions.pickup(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, flex: 1 }}>{t('shopOrder.grid.pickedUpCheck')}</Button>
                : <Button size="small" variant="contained" color="success" onClick={() => actions.complete(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, flex: 1 }}>{t('shopOrder.grid.completeCheck')}</Button>
              }
            </>
          )}
          {(order.status === 'PICKED_UP' || order.status === 'COMPLETED') && (
            <Typography sx={{ fontSize: 11, color: '#64748b', textAlign: 'center', flex: 1, py: 0.5 }}>
              ✅ {order.status === 'PICKED_UP' ? 'Picked up' : 'Completed'} · {dateFmt(order.completedAt || order.readyAt)}
            </Typography>
          )}
          {order.status === 'CANCELLED' && (
            <Typography sx={{ fontSize: 11, color: '#ef4444', textAlign: 'center', flex: 1, py: 0.5, fontWeight: 700 }}>
              ✕ Cancelled{order.cancelReason ? ` — ${order.cancelReason}` : ''}
            </Typography>
          )}
        </Box>

        {/* Mark paid + Cancel */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {order.paymentStatus !== 'PAID' && isActive && (
            <Button size="small" variant="outlined" color="success" startIcon={<PaidIcon sx={{ fontSize: 12 }} />}
              onClick={() => actions.markPaid(order)}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11, flex: 1, py: 0.25 }}>
              {t('shopOrder.grid.markPaid')}
            </Button>
          )}
          {isActive && (
            <Button size="small" color="error" onClick={() => actions.cancel(order)}
              sx={{ textTransform: 'none', fontSize: 12, px: 1.5, flexShrink: 0 }}>
              ✕ Cancel
            </Button>
          )}
        </Box>
      </Box>
    </Box>

    {/* ── Sub-item image preview ── */}
    <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {imagePreview && (
        <>
          <Box sx={{ position: 'relative', bgcolor: '#f0f0f0', lineHeight: 0 }}>
            <Box component="img" src={imagePreview.imageUrl} alt={imagePreview.modelName}
              sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', display: 'block' }} />
            <IconButton size="small" onClick={() => setImagePreview(null)}
              sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ px: 2.5, py: 2 }}>
            <Typography fontWeight={800} sx={{ fontSize: 17 }}>{imagePreview.modelName}</Typography>
          </Box>
        </>
      )}
    </Dialog>
    </>
  )
}

// ── OrderCardGrid ────────────────────────────────────────────────────

function summarizeOrderItems(order) {
  const roots = (order.items || []).filter(it => !it.parentItemId)
  const totalQty = roots.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
  const label = roots.slice(0, 3).map(item => `${Number(item.quantity || 1)}x ${item.modelName || 'Item'}`).join(', ')
  return { totalQty, label: roots.length > 3 ? `${label} +${roots.length - 3}` : label }
}

function OrderRowsGrid({ rows, tables, actions, selectedIds, onToggleSelect, displaySize = 'normal', highContrast = false }) {
  const { t } = useI18n()
  const large = displaySize === 'large'
  const fontSize = large ? 15 : 13
  const headerSx = {
    position: 'sticky', top: 0, zIndex: 1,
    bgcolor: highContrast ? '#0f172a' : '#f8fafc',
    color: highContrast ? '#fff' : '#334155',
    fontSize: large ? 13 : 12,
    fontWeight: 800,
    textAlign: 'left',
    px: 1,
    py: large ? 1.1 : 0.8,
    borderBottom: highContrast ? '2px solid #0f172a' : '1px solid #cbd5e1',
    whiteSpace: 'nowrap',
  }
  const cellSx = {
    px: 1,
    py: large ? 1 : 0.75,
    fontSize,
    borderBottom: '1px solid #e2e8f0',
    verticalAlign: 'top',
    bgcolor: highContrast ? '#fff' : 'inherit',
  }
  const renderPrimaryAction = (order) => {
    if (order.status === 'PENDING') return <Button size="small" variant="contained" disabled={Boolean(order.customerEditing)} onClick={() => actions.confirm(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: large ? 13 : 11 }}>{t('shopOrder.grid.confirm')}</Button>
    if (order.status === 'CONFIRMED') return <Button size="small" variant="contained" color="warning" onClick={() => actions.prepare(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: large ? 13 : 11 }}>{t('shopOrder.grid.prepare')}</Button>
    if (order.status === 'PREPARING') return <Button size="small" variant="contained" color="success" onClick={() => actions.ready(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: large ? 13 : 11 }}>{t('shopOrder.grid.ready')}</Button>
    if (order.status === 'READY') return <Button size="small" variant="contained" color={order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT' ? 'info' : 'success'} onClick={() => (order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT') ? actions.pickup(order) : actions.complete(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: large ? 13 : 11 }}>{order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT' ? t('shopOrder.grid.pickedUp') : t('shopOrder.grid.complete')}</Button>
    return <Typography sx={{ fontSize: large ? 13 : 11, color: '#64748b', fontWeight: 700 }}>{localizedStatusLabel(order.status, t)}</Typography>
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', borderTop: '1px solid #e2e8f0' }}>
      <Box component="table" sx={{ width: '100%', minWidth: large ? 1220 : 1080, borderCollapse: 'separate', borderSpacing: 0 }}>
        <Box component="thead">
          <Box component="tr">
            <Box component="th" sx={{ ...headerSx, width: 44 }} />
            <Box component="th" sx={{ ...headerSx, width: 110 }}>{t('shopOrder.common.order')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 130 }}>{t('common.status')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 150 }}>{t('common.table')}</Box>
            <Box component="th" sx={{ ...headerSx, minWidth: 260 }}>{t('shopOrder.common.items')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 150 }}>{t('common.customer')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 130 }}>{t('common.payment')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 130, textAlign: 'right' }}>{t('common.total')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 130 }}>{t('shopOrder.common.time')}</Box>
            <Box component="th" sx={{ ...headerSx, width: 260 }}>{t('shopOrder.common.actions')}</Box>
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map(order => {
            const items = summarizeOrderItems(order)
            const isActive = !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)
            return (
              <Box component="tr" key={order.id} sx={{ bgcolor: selectedIds.has(order.id) ? '#eef2ff' : (highContrast ? '#fff' : 'transparent'), '&:hover td': { bgcolor: highContrast ? '#f8fafc' : '#f1f5f9' } }}>
                <Box component="td" sx={cellSx}>
                  <Checkbox size="small" checked={selectedIds.has(order.id)} onChange={() => onToggleSelect(order.id)} />
                </Box>
                <Box component="td" sx={cellSx}>
                  <Typography sx={{ fontSize: large ? 20 : 16, fontWeight: 900, color: '#0f172a' }}>#{prefixedOrderNumber(order)}</Typography>
                  <Typography sx={{ fontSize: large ? 12 : 10, fontFamily: 'monospace', color: '#64748b' }}>{order.orderCode}</Typography>
                </Box>
                <Box component="td" sx={cellSx}>
                  <Chip label={localizedStatusLabel(order.status, t)} color={STATUS_COLOR[order.status] || 'default'} size="small" sx={{ fontWeight: 800, fontSize: large ? 12 : 10 }} />
                  {order.customerEditing && <Chip label="Editing" color="warning" size="small" sx={{ ml: 0.5, fontWeight: 800, fontSize: large ? 12 : 10 }} />}
                </Box>
                <Box component="td" sx={cellSx}>
                  <Box component="select" value={order.tableId || ''} onChange={e => actions.setTable(order.id, e.target.value)} sx={{ width: '100%', height: large ? 42 : 38, fontSize: large ? 16 : 15, fontWeight: 900, border: '2px solid #93c5fd', borderRadius: 1, px: 1, bgcolor: '#fff', color: '#111827' }}>
                    <option value="">{t('shopOrder.grid.noTable')}</option>
                    {tables.map(t => <option key={t.id} value={t.id}>{t.tableName}</option>)}
                  </Box>
                </Box>
                <Box component="td" sx={cellSx}>
                  <Typography sx={{ fontSize, fontWeight: 800, color: '#111827' }}>{items.totalQty} items</Typography>
                  <Typography sx={{ fontSize: large ? 13 : 11, color: '#475569', lineHeight: 1.35 }}>{items.label || 'No items'}</Typography>
                  {order.notes && <Typography sx={{ fontSize: large ? 13 : 11, color: '#b91c1c', fontWeight: 700, lineHeight: 1.35 }}>{order.notes}</Typography>}
                </Box>
                <Box component="td" sx={cellSx}>
                  <Typography sx={{ fontSize, fontWeight: 700 }} noWrap>{order.customerName || '-'}</Typography>
                  {order.staffName && <Typography sx={{ fontSize: large ? 12 : 10, color: '#64748b' }} noWrap>by {order.staffName}</Typography>}
                </Box>
                <Box component="td" sx={cellSx}>
                  <Chip label={localizedPaymentStatusLabel(order.paymentStatus, t)} color={order.paymentStatus === 'PAID' ? 'success' : 'warning'} size="small" sx={{ fontWeight: 800, fontSize: large ? 12 : 10 }} />
                  <Typography sx={{ fontSize: large ? 12 : 10, color: '#64748b', mt: 0.25 }}>{localizedPaymentMethodLabel(order.paymentMethod, t)}</Typography>
                </Box>
                <Box component="td" sx={{ ...cellSx, textAlign: 'right' }}>
                  <Typography sx={{ fontSize: large ? 17 : 14, fontWeight: 900 }}>{fmt(payableAmount(order))}</Typography>
                </Box>
                <Box component="td" sx={cellSx}>
                  <Typography sx={{ fontSize: large ? 12 : 10, color: '#64748b' }}>{dateFmt(order.createdAt)}</Typography>
                  <Typography sx={{ fontSize: large ? 12 : 10, color: '#64748b' }}>{elapsed(order.confirmedAt || order.createdAt)} ago</Typography>
                </Box>
                <Box component="td" sx={cellSx}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {renderPrimaryAction(order)}
                    <Tooltip title={t('shopOrder.grid.viewDetail')}><IconButton size="small" onClick={() => actions.detail(order)}><VisibilityIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton></Tooltip>
                    <Tooltip title={t('shopOrder.grid.printReceipt')}><IconButton size="small" color="primary" onClick={() => printOrderReceiptTracked(order)}><PrintIcon sx={{ fontSize: large ? 20 : 17 }} /></IconButton></Tooltip>
                    {order.paymentStatus !== 'PAID' && isActive && <Button size="small" variant="outlined" color="success" onClick={() => actions.markPaid(order)} sx={{ textTransform: 'none', fontWeight: 800, fontSize: large ? 12 : 10 }}>{t('shopOrder.grid.markPaid')}</Button>}
                    {order.paymentStatus !== 'PAID' && order.status !== 'CANCELLED' && <Tooltip title={t('shopOrder.grid.paymentQr')}><IconButton size="small" color="primary" onClick={() => actions.payQr(order)}><QrCode2Icon sx={{ fontSize: large ? 20 : 17 }} /></IconButton></Tooltip>}
                    {isActive && <Button size="small" color="error" onClick={() => actions.cancel(order)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: large ? 12 : 10 }}>{t('shopOrder.edit.cancel')}</Button>}
                  </Box>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'shopOrder.grid.sortNewest' },
  { value: 'oldest', labelKey: 'shopOrder.grid.sortOldest' },
  { value: 'status', labelKey: 'shopOrder.grid.sortStatus' },
  { value: 'number', labelKey: 'shopOrder.grid.sortNumber' },
  { value: 'total',  labelKey: 'shopOrder.grid.sortTotal' },
]
const STATUS_SORT_ORDER = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, PICKED_UP: 4, COMPLETED: 5, CANCELLED: 6 }

function orderNumberPrefix(order) {
  if (order?.fulfillmentType === 'DINE_IN') return 'T'
  if (order?.fulfillmentType === 'DELIVERY') return 'D'
  if (order?.fulfillmentType === 'PICKUP' && order?.staffName) return 'C'
  if (order?.fulfillmentType === 'PICKUP') return 'A'
  return ''
}

function prefixedOrderNumber(order) {
  const number = order?.orderNumber ?? '?'
  const prefix = orderNumberPrefix(order)
  return prefix ? `${prefix}-${number}` : number
}

function javaStringHash(value) {
  let hash = 0
  String(value || '').split('').forEach(char => {
    hash = Math.imul(31, hash) + char.charCodeAt(0)
    hash |= 0
  })
  return hash
}

function groupSlipNumber(token) {
  const mod = ((javaStringHash(token) % 900000) + 900000) % 900000
  return String(mod + 100000).padStart(6, '0')
}

function rootOrderItems(order) {
  return (order?.items || []).filter(item => !item.parentItemId)
}

function orderItemQuantity(order) {
  return rootOrderItems(order).reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

function itemCategoryLabel(item, modelMetaMap, language, fallback = '') {
  const model = modelMetaMap?.[item?.modelId] || {}
  return localizedCategory(model, language) || item?.category || item?.modelCategory || fallback
}

function OrderCardGrid({ rows, loading, tables, actions, modelImageMap = {}, selectedIds, onToggleSelect, viewMode = 'cards', displaySize = 'normal', highContrast = false }) {
  const { t } = useI18n()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('order') || '')
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('shop_orders_sort') || 'oldest' } catch { return 'oldest' }
  })

  const filtered = useMemo(() => {
    let list = rows
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        String(r.orderNumber || '').includes(q) ||
        (r.orderCode || '').toLowerCase().includes(q) ||
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.tableName || '').toLowerCase().includes(q) ||
        (r.staffName || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.items || []).some(it => (it.modelName || '').toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      if (sortBy === 'status') return (STATUS_SORT_ORDER[a.status] ?? 9) - (STATUS_SORT_ORDER[b.status] ?? 9)
      if (sortBy === 'number') return (a.orderNumber ?? 9999) - (b.orderNumber ?? 9999)
      if (sortBy === 'total')  return Number(b.totalAmount || 0) - Number(a.totalAmount || 0)
      return 0
    })
  }, [rows, search, sortBy])

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <CircularProgress />
    </Box>
  )

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: { xs: 1, sm: 1.5 }, py: { xs: 0.5, sm: 0.75 }, display: 'flex', gap: { xs: 0.75, sm: 1 }, alignItems: 'center', borderBottom: '1px solid #e0e0e0', flexShrink: 0, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder={t('shopOrder.grid.searchOrdersPlaceholder')}
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1, display: { xs: 'none', sm: 'inline-flex' } }} inputProps={{ style: { fontSize: 13 } }} />
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, gap: 0.5, flex: 1 }}>
          <Button size="small" variant={sortBy === 'newest' ? 'contained' : 'outlined'} onClick={() => { setSortBy('newest'); try { localStorage.setItem('shop_orders_sort', 'newest') } catch {} }} sx={{ flex: 1, minHeight: 40, px: 0.75, fontSize: 11, fontWeight: 800 }}>{t('shopOrder.grid.sortNewest')}</Button>
          <Button size="small" variant={sortBy === 'oldest' ? 'contained' : 'outlined'} color="warning" onClick={() => { setSortBy('oldest'); try { localStorage.setItem('shop_orders_sort', 'oldest') } catch {} }} sx={{ flex: 1, minHeight: 40, px: 0.75, fontSize: 11, fontWeight: 800 }}>{t('shopOrder.grid.sortOldest')}</Button>
        </Box>
        <TextField select size="small" label={t('shopOrder.grid.sort')} value={sortBy} onChange={e => { setSortBy(e.target.value); try { localStorage.setItem('shop_orders_sort', e.target.value) } catch {} }} sx={{ width: 190, display: { xs: 'none', sm: 'inline-flex' } }}>
          {SORT_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{t(o.labelKey)}</MenuItem>)}
        </TextField>
        <Typography sx={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{t('shopOrder.grid.filteredOrdersCount', { shown: filtered.length, total: rows.length })}</Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: viewMode === 'grid' ? 0 : (displaySize === 'large' ? 2 : 1.5) }}>
        {filtered.length === 0
          ? <Box sx={{ textAlign: 'center', py: 8 }}><Typography color="text.secondary">{t('shopOrder.grid.noOrders')}</Typography></Box>
          : viewMode === 'grid' ? (
            <OrderRowsGrid
              rows={filtered}
              tables={tables}
              actions={actions}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              displaySize={displaySize}
              highContrast={highContrast}
            />
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${displaySize === 'large' ? 360 : 300}px, 1fr))`, gap: displaySize === 'large' ? 2 : 1.5 }}>
              {filtered.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tables={tables}
                  actions={actions}
                  modelImageMap={modelImageMap}
                  selected={selectedIds.has(order.id)}
                  onSelect={() => onToggleSelect(order.id)}
                  displaySize={displaySize}
                  highContrast={highContrast}
                />
              ))}
            </Box>
          )
        }
      </Box>
    </Box>
  )
}

// ── Main ShopOrderGrid ──────────────────────────────────────────────

export default function ShopOrderGrid() {
  const { t } = useI18n()
  const { tenantId: ctxTenantId, companyId: ctxCompanyId } = useAppContext()
  const [rows, setRows]                 = useState([])
  const [boardRows, setBoardRows]       = useState([])   // for board tabs — unfiltered
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [statusFilters, setStatusFilters] = useState(readShopOrderStatusFilters)
  const [paymentFilter, setPaymentFilter] = useState(() => readShopOrderSessionValue(SHOP_ORDER_PAYMENT_FILTER_SESSION_KEY, ''))
  const [{ from: orderFrom, to: orderTo }, setOrderRange] = useState(todayOrderRange)
  const [tableFilter, setTableFilter]     = useState('')
  const [detailOrder, setDetailOrder]   = useState(null)
  const [resetOpen, setResetOpen]       = useState(false)
  const [resetTo, setResetTo]           = useState(0)
  const [resetting, setResetting]       = useState(false)
  const [manualOpen, setManualOpen]     = useState(false)
  const [manualDefaults, setManualDefaults] = useState(null)
  const [qrOrderOpen, setQrOrderOpen]   = useState(false)
  const [boardOpen, setBoardOpen]       = useState(false)
  const [boardUrl, setBoardUrl]         = useState('')
  const [customerBoardUrl, setCustomerBoardUrl] = useState('')
  const [separateCustomerConfirmed, setSeparateCustomerConfirmed] = useState(false)
  const [boardLoading, setBoardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [copiedCustomer, setCopiedCustomer] = useState(false)
  const [tab, setTab]                   = useState(0)
  const [stockItems, setStockItems]     = useState([])
  const [pendingStockUids, setPendingStockUids] = useState([])
  const [payQrOrder, setPayQrOrder]     = useState(null)
  const [bankConfig, setBankConfig]     = useState(null)
  const [tables, setTables]             = useState([])
  const [selectedRows, setSelectedRows] = useState(new Set())
  const [moveTableOpen, setMoveTableOpen] = useState(false)
  const [moveTableTarget, setMoveTableTarget] = useState('')
  const [moving, setMoving]             = useState(false)
  const [eodOpen, setEodOpen]           = useState(false)
  const [orderViewMode, setOrderViewMode] = useState(() => readShopOrderPref(SHOP_ORDER_VIEW_PREF, 'cards'))
  const [cardDisplaySize, setCardDisplaySize] = useState(() => readShopOrderPref(SHOP_ORDER_CARD_SIZE_PREF, 'normal'))
  const [highContrastCards, setHighContrastCards] = useState(() => readShopOrderPref(SHOP_ORDER_CONTRAST_PREF, 'false') === 'true')
  const [slipFilter, setSlipFilter]     = useState('')
  const [confirmDlg, setConfirmDlg]     = useState(null)
  const [orderScannerOpen, setOrderScannerOpen] = useState(false)
  const [scannedOrders, setScannedOrders] = useState([])
  // confirmDlg shape: { title, message, confirmLabel, confirmColor, requireReason, onConfirm }
  const [pickupQrOrder, setPickupQrOrder] = useState(null)  // { id, orderNumber, orderCode, qrBase64 }
  const [trackQrOrder, setTrackQrOrder]   = useState(null)  // { order, qrBase64, loading }
  const [combinedToken, setCombinedToken] = useState(null)  // token string — opens CombinedReceiptDialog
  const [mergeOrder, setMergeOrder]       = useState(null)  // order to merge others into
  const [modelImageMap, setModelImageMap] = useState({})   // { [modelId]: imageUrl }
  const [modelMetaMap, setModelMetaMap]   = useState({})   // { [modelId]: model }
  const [staffCalls, setStaffCalls]       = useState([])   // pending staff calls
  const [staffCallMobileOpen, setStaffCallMobileOpen] = useState(false)
  const [newOrderNotice, setNewOrderNotice] = useState(null)
  const [customerEditNotice, setCustomerEditNotice] = useState(null)
  const [customerEditHistoryOpen, setCustomerEditHistoryOpen] = useState(false)
  const [customerEditHistory, setCustomerEditHistory] = useState(() => {
    try { const value = JSON.parse(localStorage.getItem(CUSTOMER_EDIT_HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] }
  })
  const [quickLoginOpen, setQuickLoginOpen] = useState(false)
  const [quickLoginHours, setQuickLoginHours] = useState(12)
  const [quickLoginData, setQuickLoginData] = useState(null)
  const [quickLoginLoading, setQuickLoginLoading] = useState(false)
  const [quickLoginError, setQuickLoginError] = useState('')
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false)
  const customerBoardDisplayUrl = customerBoardUrl
    ? `${customerBoardUrl}${separateCustomerConfirmed ? '&separateConfirmed=1' : ''}`
    : ''
  const seenCallIdsRef = React.useRef(new Set())
  const knownOrderIdsRef = React.useRef(new Set())
  const knownEditingRef = React.useRef(new Map())
  const knownSeatRef = React.useRef(new Map())
  const orderPollReadyRef = React.useRef(false)
  const orderRangeParams = useMemo(() => ({
    from: datetimeLocalToIso(orderFrom),
    to: datetimeLocalToIso(orderTo),
  }), [orderFrom, orderTo])
  const orderLocalRange = useMemo(() => ({
    from: orderFrom,
    to: orderTo,
  }), [orderFrom, orderTo])
  const rememberOrders = useCallback((orders) => {
    ;(Array.isArray(orders) ? orders : []).forEach(order => {
      if (order?.id) {
        knownOrderIdsRef.current.add(order.id)
        knownEditingRef.current.set(order.id, Boolean(order.customerEditing))
        knownSeatRef.current.set(order.id, `${order.tableId || ''}|${order.tableName || ''}|${order.customerTableTag || ''}`)
      }
    })
  }, [])

  const notifyNewOrders = useCallback((orders) => {
    const list = Array.isArray(orders) ? orders : []
    const fresh = list.filter(order => order?.id && !knownOrderIdsRef.current.has(order.id))
    const editingStarted = orderPollReadyRef.current ? list.filter(order => order?.id && knownOrderIdsRef.current.has(order.id) && !knownEditingRef.current.get(order.id) && order.customerEditing) : []
    const tableChanged = orderPollReadyRef.current ? list.filter(order => order?.id && knownOrderIdsRef.current.has(order.id) && knownSeatRef.current.has(order.id) && knownSeatRef.current.get(order.id) !== `${order.tableId || ''}|${order.tableName || ''}|${order.customerTableTag || ''}`) : []
    const previousSeats = new Map(tableChanged.map(order => [order.id, knownSeatRef.current.get(order.id)]))
    rememberOrders(list)
    if (!orderPollReadyRef.current) {
      orderPollReadyRef.current = true
      return
    }
    if (fresh.length) {
      playNewOrderSound()
      const first = fresh[0]
      setNewOrderNotice({ count: fresh.length, orderNumber: first.orderNumber ?? null, orderCode: first.orderCode || '', at: Date.now() })
      const now = Date.now()
      setCustomerEditHistory(prev => [...fresh.map((order, index) => ({ id: `order_${order.id}_${now}_${index}`, type: 'new_order', orderId: order.id, orderNumber: order.orderNumber ?? order.orderCode ?? '', customerName: order.customerName || 'Walk-in', at: now })), ...prev].slice(0, 50))
    }
    if (editingStarted.length) {
      playNewOrderSound()
      const now = Date.now()
      const entries = editingStarted.map((order, index) => ({ id: `edit_${order.id}_${now}_${index}`, type: 'customer_edit', orderId: order.id, orderNumber: order.orderNumber ?? order.orderCode ?? '', customerName: order.customerName || 'Khách lẻ', at: now }))
      setCustomerEditHistory(prev => [...entries, ...prev].slice(0, 50))
      setCustomerEditNotice({ count: entries.length, ...entries[0] })
    }
    if (tableChanged.length) {
      playNewOrderSound()
      const now = Date.now()
      const entries = tableChanged.map((order, index) => ({ id: `table_${order.id}_${now}_${index}`, type: 'table_change', orderId: order.id, orderNumber: order.orderNumber ?? order.orderCode ?? '', customerName: order.customerName || 'Customer', detail: `${String(previousSeats.get(order.id) || '').split('|').slice(1).filter(Boolean).join(' / ') || 'No table'} → ${order.tableName || order.customerTableTag || 'No table'}`, at: now }))
      setCustomerEditHistory(prev => [...entries, ...prev].slice(0, 50))
      setCustomerEditNotice({ count: entries.length, ...entries[0] })
    }
  }, [rememberOrders])

  useEffect(() => {
    try { localStorage.setItem(CUSTOMER_EDIT_HISTORY_KEY, JSON.stringify(customerEditHistory)) } catch { /* storage may be blocked */ }
  }, [customerEditHistory])

  const shouldShowInRows = useCallback((order) => {
    const timeMatches = orderInTimeRange(order, orderLocalRange)
    const statusMatches = statusFilters.length === 0 || statusFilters.includes(order?.status)
    const paymentMatches = !paymentFilter
      || (paymentFilter === 'UNPAID' ? order?.paymentStatus !== 'PAID' : order?.paymentStatus === 'PAID')
    return timeMatches && statusMatches && paymentMatches
  }, [orderLocalRange, paymentFilter, statusFilters])

  const mergeOrderIntoState = useCallback((order) => {
    if (!order?.id) return
    rememberOrders([order])
    setRows(prev => replaceOrderInList(prev, order, shouldShowInRows(order)))
    setBoardRows(prev => replaceOrderInList(prev, order, BOARD_VISIBLE_STATUSES.has(order.status)))
    setDetailOrder(prev => prev?.id === order.id ? order : prev)
  }, [rememberOrders, shouldShowInRows])

  const applyOrderSnapshot = useCallback((orders, { notify = false } = {}) => {
    const list = Array.isArray(orders) ? orders : []
    if (notify) notifyNewOrders(list)
    else rememberOrders(list)
    setRows(list.filter(shouldShowInRows))
    setBoardRows(list.filter(order => BOARD_VISIBLE_STATUSES.has(order?.status)))
  }, [notifyNewOrders, rememberOrders, shouldShowInRows])

  const refreshOrderCard = useCallback(async (orderId) => {
    if (!orderId) return null
    const { res, data } = await fetchShopOrder(orderId)
    if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to refresh order')
    if (data?.id) mergeOrderIntoState(data)
    return data || null
  }, [mergeOrderIntoState])

  const handleScannedOrder = useCallback(async (code) => {
    const { res, data } = await confirmScannedOrder(code)
    if (!res.ok) {
      setError(data?.message || 'Cannot confirm scanned order')
      return
    }
    if (data?.id) {
      mergeOrderIntoState(data)
      setScannedOrders(prev => [data, ...prev.filter(order => order.id !== data.id)].slice(0, 8))
    }
  }, [mergeOrderIntoState])

  const generateQuickLogin = async () => {
    setQuickLoginLoading(true); setQuickLoginError(''); setQuickLoginData(null)
    try {
      const { res, data } = await apiFetchJson('/auth/quick-login/generate', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: quickLoginHours }),
      })
      if (!res.ok) setQuickLoginError(data?.message || 'Không thể tạo link đăng nhập')
      else setQuickLoginData(data)
    } catch { setQuickLoginError('Không thể kết nối máy chủ') }
    setQuickLoginLoading(false)
  }

  const applyOrderResult = useCallback(async (result, orderId, fallbackMessage = 'Action failed') => {
    const { res, data } = result || {}
    if (res && !res.ok) throw new Error(data?.message || data?.error || fallbackMessage)
    if (data?.id) {
      mergeOrderIntoState(data)
      return data
    }
    return refreshOrderCard(orderId)
  }, [mergeOrderIntoState, refreshOrderCard])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await fetchShopOrders(null, orderRangeParams)
      const { data } = result
      const list = Array.isArray(data) ? data : []
      setRows(list.filter(shouldShowInRows))
      rememberOrders(list)
      orderPollReadyRef.current = true
    } catch { setError(t('shopOrder.grid.loadOrdersFailed')) }
    setLoading(false)
  }, [orderRangeParams, rememberOrders, shouldShowInRows, t])

  const loadBoard = useCallback(async () => {
    try {
      const [activeRes, pickedRes] = await Promise.all([
        fetchActiveOrders(orderRangeParams),
        fetchShopOrders('PICKED_UP', orderRangeParams),
      ])
      const all = [
        ...(Array.isArray(activeRes.data) ? activeRes.data : []),
        ...(Array.isArray(pickedRes.data) ? pickedRes.data : []),
      ]
      setBoardRows(all)
      rememberOrders(all)
    } catch { /* silent */ }
  }, [orderRangeParams, rememberOrders])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadBoard() }, [loadBoard])
  useEffect(() => {
    fetchShopTables().then(({ data }) => setTables(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])
  useEffect(() => {
    fetchModels().then(list => {
      const imageMap = {}
      const metaMap = {}
      ;(Array.isArray(list) ? list : []).forEach(m => {
        if (!m?.id) return
        metaMap[m.id] = m
        if (m.imageUrl) imageMap[m.id] = m.imageUrl
      })
      setModelImageMap(imageMap)
      setModelMetaMap(metaMap)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const { res, data } = await fetchStaffCalls()
        if (cancelled || !res.ok) return
        const calls = Array.isArray(data) ? data : []
        setStaffCalls(calls)

        const unseen = []
        calls.forEach(c => {
          if (c?.id && !seenCallIdsRef.current.has(c.id)) {
            seenCallIdsRef.current.add(c.id)
            unseen.push(c)
          }
        })

        const newOrderCalls = unseen.filter(c => c.reason === STAFF_CALL_REASON_NEW_ORDER)
        const serviceCalls = unseen.filter(c => c.reason !== STAFF_CALL_REASON_NEW_ORDER)
        if (serviceCalls.length) {
          const now = Date.now()
          setCustomerEditHistory(prev => [...serviceCalls.map((call, index) => ({ id: `call_${call.id}_${now}_${index}`, type: 'shop_qr', orderId: call.orderId || null, orderNumber: call.orderNumber ?? '', customerName: call.tableName ? t('shopOrder.common.tableValue', { value: call.tableName }) : t('common.customer'), detail: staffCallReasonLabel(call.reason), at: call.createdAt || now })), ...prev].slice(0, 50))
        }

        if (newOrderCalls.length) {
          const notifyCalls = newOrderCalls.filter(c => orderPollReadyRef.current && (!c.orderId || !knownOrderIdsRef.current.has(c.orderId)))
          if (notifyCalls.length) {
            playNewOrderSound()
            const first = notifyCalls[0]
            setNewOrderNotice({
              count: notifyCalls.length,
              orderNumber: first.orderNumber ?? null,
              orderCode: first.orderCode || '',
              at: Date.now(),
            })
          }
        }

        serviceCalls.forEach(() => playStaffCallSound())

        const callsWithOrders = unseen.filter(c => c.orderId)
        if (callsWithOrders.length) {
          await Promise.all(callsWithOrders.map(c => refreshOrderCard(c.orderId).catch(() => null)))
        }
      } catch { /* silent */ }
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => { cancelled = true; clearInterval(id) }
  }, [refreshOrderCard])
  useEffect(() => {
    let cancelled = false
    const pollOrders = async () => {
      try {
        const { res, data } = await fetchShopOrders(null, orderRangeParams)
        if (cancelled || !res.ok) return
        applyOrderSnapshot(data, { notify: true })
      } catch { /* silent */ }
    }
    pollOrders()
    const id = setInterval(pollOrders, ORDER_POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [applyOrderSnapshot, orderRangeParams])

  useEffect(() => {
    if (!newOrderNotice) return undefined
    const id = setTimeout(() => setNewOrderNotice(null), 12000)
    return () => clearTimeout(id)
  }, [newOrderNotice])

  useEffect(() => {
    if (!staffCalls.length) setStaffCallMobileOpen(false)
  }, [staffCalls.length])

  const reload = () => { load(); loadBoard() }
  const openCounterDisplay = () => {
    const base = window.location.origin + '/bom-inventory/shop/counter'
    const q = ctxTenantId && ctxCompanyId ? `?tenantId=${ctxTenantId}&companyId=${ctxCompanyId}` : ''
    window.open(base + q, '_blank')
  }

  // Derived per-status slices for board tabs
  const confirmedOrders = boardRows.filter(r => r.status === 'CONFIRMED')
  const preparingOrders = boardRows.filter(r => r.status === 'PREPARING')
  const readyOrders     = boardRows.filter(r => r.status === 'READY')
  const pickedUpOrders  = boardRows.filter(r => r.status === 'PICKED_UP')
  const slipOptions = useMemo(() => {
    const byToken = new Map()
    rows.filter(order => orderInTimeRange(order, orderLocalRange)).forEach(order => {
      const token = String(order.sourceToken || '').trim()
      if (!token) return
      const existing = byToken.get(token) || {
        token,
        slipNumber: groupSlipNumber(token),
        count: 0,
        activeCount: 0,
        orderNumbers: new Set(),
        createdAt: order.createdAt || '',
      }
      existing.count += 1
      if (order.status !== 'CANCELLED') existing.activeCount += 1
      if (order.orderNumber != null) existing.orderNumbers.add(order.orderNumber)
      if (order.createdAt && (!existing.createdAt || new Date(order.createdAt) < new Date(existing.createdAt))) {
        existing.createdAt = order.createdAt
      }
      byToken.set(token, existing)
    })
    return Array.from(byToken.values())
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map(info => {
        const nums = Array.from(info.orderNumbers).sort((a, b) => a - b)
        const orderHint = nums.length === 1 ? ` · #${nums[0]}` : nums.length > 1 ? ` · #${nums[0]}-${nums[nums.length - 1]}` : ''
        return {
          ...info,
          label: `${t('shopOrder.grid.slipNumber', { number: info.slipNumber })}${orderHint} (${info.count})`,
        }
      })
  }, [orderLocalRange, rows, t])
  const selectedSlipFilter = useMemo(
    () => (slipFilter && slipOptions.some(slip => slip.token === slipFilter) ? slipFilter : ''),
    [slipFilter, slipOptions]
  )
  const visibleOrderTotals = useMemo(() => {
    const tableGroups = new Map()
    let separateTotal = 0
    let separateCount = 0
    rows.filter(order => order.status !== 'CANCELLED' && orderInTimeRange(order, orderLocalRange)).forEach(order => {
      const tableLabel = order.fulfillmentType === 'DINE_IN'
        ? (order.tableName || order.customerTableTag || order.tableId || '')
        : ''
      if (!tableLabel) {
        separateTotal += payableAmount(order)
        separateCount += 1
        return
      }
      const tableKey = String(order.tableId || tableLabel)
      const current = tableGroups.get(tableKey) || { key: tableKey, label: tableLabel, count: 0, total: 0 }
      current.count += 1
      current.total += payableAmount(order)
      tableGroups.set(tableKey, current)
    })
    return { tables: Array.from(tableGroups.values()), separateCount, separateTotal }
  }, [orderLocalRange, rows])
  const displayedRows = useMemo(() => rows.filter(order => {
    if (!orderInTimeRange(order, orderLocalRange)) return false
    if (selectedSlipFilter && String(order.sourceToken || '') !== selectedSlipFilter) return false
    if (!tableFilter) return true
    const tableLabel = order.fulfillmentType === 'DINE_IN'
      ? (order.tableName || order.customerTableTag || order.tableId || '')
      : ''
    if (tableFilter === '__SEPARATE__') return !tableLabel
    return String(order.tableId || tableLabel) === tableFilter
  }), [orderLocalRange, rows, tableFilter, selectedSlipFilter])

  const act = async (fn, id, afterSuccess) => {
    try {
      const updated = await applyOrderResult(await fn(id), id)
      afterSuccess?.(updated)
    } catch (e) { setError(e.message || 'Action failed') }
  }

  const askConfirm = (cfg, fn) => setConfirmDlg({ ...cfg, onConfirm: async (reason) => { setConfirmDlg(null); await fn(reason) } })

  const handleBoardAction = (type, id, orderNum) => {
    const configs = {
      'prepare':               { title: t('shopOrder.confirm.prepareTitle'), message: t('shopOrder.confirm.prepareMessage', { order: orderNum }), confirmLabel: t('shopOrder.confirm.startPreparingLabel'), confirmColor: 'warning' },
      'revert':                { title: t('shopOrder.confirm.revertWaitingTitle'), message: t('shopOrder.confirm.revertWaitingMessage'), confirmLabel: t('shopOrder.confirm.revertLabel'), confirmColor: 'error' },
      'revert-from-preparing': { title: t('shopOrder.confirm.revertWaitingTitle'), message: t('shopOrder.confirm.revertPreparingMessage'), confirmLabel: t('shopOrder.confirm.revertLabel'), confirmColor: 'error' },
      'ready':                 { title: t('shopOrder.confirm.readyTitle'), message: t('shopOrder.confirm.readyPickupMessage', { order: orderNum }), confirmLabel: t('shopOrder.confirm.markReadyLabel'), confirmColor: 'success' },
      'complete':              { title: t('shopOrder.confirm.completeTitle'), message: t('shopOrder.confirm.completeMessage', { order: orderNum }), confirmLabel: t('shopOrder.confirm.completeLabel'), confirmColor: 'success' },
      'pickup':                { title: t('shopOrder.confirm.pickupTitle'), message: t('shopOrder.confirm.pickupMessage'), confirmLabel: t('shopOrder.confirm.pickedUpLabel'), confirmColor: 'primary' },
      'pay':                   { title: t('shopOrder.grid.markAsPaidConfirmTitle'), message: t('shopOrder.grid.markAsPaidConfirmMessage', { order: orderNum }), confirmLabel: t('shopOrder.grid.markPaid'), confirmColor: 'success' },
    }
    const cfg = configs[type]
    if (!cfg) return
    const fns = {
      'prepare': prepareShopOrder,
      'revert': revertShopOrder,
      'revert-from-preparing': revertShopOrder,
      'ready': readyShopOrder,
      'complete': completeShopOrder,
      'pickup': pickupShopOrder,
      'pay': markOrderPaid,
    }
    askConfirm(cfg, async () => {
      try {
        await applyOrderResult(await fns[type](id), id)
        if (type === 'ready') broadcastReady()
      } catch (e) { setError(e.message || 'Action failed') }
    })
  }

  const doCancelOrder = async (row, reason) => {
    try {
      await applyOrderResult(await cancelShopOrder(row.id, reason), row.id, 'Failed to cancel')
      if (row.items?.length) {
        const newStock = row.items.map(item => ({
          uid: crypto.randomUUID(),
          modelId: item.modelId, modelName: item.modelName,
          sellingPrice: item.unitPrice, qty: Number(item.quantity),
          selectedOptions: parseOpts(item.selectedOptions) || {},
          itemNotes: item.itemNotes || '',
          cancelledFromOrderCode: row.orderCode,
          utilizedOrderCode: null,
        }))
        setStockItems(prev => [...prev, ...newStock])
      }
    } catch (e) { setError(e.message || 'Failed to cancel') }
  }

  const handleUseInOrder = (queueItems) => {
    setPendingStockUids(queueItems.map(i => i.uid))
    setManualDefaults(queueItems)
    setManualOpen(true)
  }

  const handleCancel = (row) => askConfirm({
    title: t('shopOrder.confirm.cancelTitle', { order: row.orderNumber ?? row.orderCode }),
    message: t('shopOrder.confirm.cancelMessage'),
    confirmLabel: t('shopOrder.confirm.cancelLabel'),
    confirmColor: 'error',
    requireReason: true,
    reasonLabel: t('shopOrder.confirm.reasonLabel'),
  }, (reason) => doCancelOrder(row, reason))

  const handleOpenBoard = async () => {
    setBoardLoading(true); setBoardOpen(true)
    try {
      const { data } = await generateDisplayBoardToken()
      const base = `${window.location.origin}/bom-inventory`
      const rangeQs = new URLSearchParams({
        ...(orderRangeParams?.from ? { from: orderRangeParams.from } : {}),
        ...(orderRangeParams?.to ? { to: orderRangeParams.to } : {}),
      }).toString()
      const suffix = rangeQs ? `&${rangeQs}` : ''
      setBoardUrl(`${base}/shop/board?t=${data.token}${suffix}`)
      setCustomerBoardUrl(`${base}/shop/customer-board?t=${data.token}${suffix}`)
    } catch (e) { setError(e.message || t('shopOrder.grid.generateBoardUrlFailed')) }
    setBoardLoading(false)
  }

  const [hoursStatus, setHoursStatus]   = useState({ open: true, reason: null, reopensAt: null })
  const [closingToday, setClosingToday] = useState(false)
  const [hoursDialogOpen, setHoursDialogOpen] = useState(false)
  const [shifts, setShifts]                   = useState([])
  const [shiftsLoading, setShiftsLoading]      = useState(false)
  const [shiftsSaving, setShiftsSaving]        = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [closePreview, setClosePreview]        = useState(null)

  const refreshHoursStatus = useCallback(() => {
    fetchOrderingStatus(ctxTenantId, ctxCompanyId).then(({ data }) => data && setHoursStatus(data)).catch(() => {})
  }, [ctxTenantId, ctxCompanyId])

  useEffect(() => { refreshHoursStatus() }, [refreshHoursStatus])

  const handleCloseToday = async () => {
    if (!hoursStatus.open) {
      setClosingToday(true)
      try {
        const { data } = await reopenShop()
        if (data) setHoursStatus(data)
      } catch (e) { setError(e.message || t('shopOrder.grid.closeTodayFailed')) }
      setClosingToday(false)
      return
    }
    try {
      const { data } = await previewCloseToday()
      setClosePreview(data?.reopensAt || null)
      setCloseConfirmOpen(true)
    } catch (e) { setError(e.message || t('shopOrder.grid.closeTodayFailed')) }
  }

  const confirmCloseToday = async () => {
    setCloseConfirmOpen(false)
    setClosingToday(true)
    try {
      const { data } = await closeShopToday()
      if (data) setHoursStatus(data)
    } catch (e) { setError(e.message || t('shopOrder.grid.closeTodayFailed')) }
    setClosingToday(false)
  }

  const openHoursDialog = () => {
    setHoursDialogOpen(true)
    setShiftsLoading(true)
    fetchShiftSchedule()
        .then(({ data }) => setShifts((data || []).map(s => ({ ...s, _key: s.id || Math.random().toString(36) }))))
        .catch(e => setError(e.message || t('shopOrder.grid.loadShiftsFailed')))
        .finally(() => setShiftsLoading(false))
  }

  const addShift = (dayOfWeek) => {
    setShifts(prev => [...prev, { _key: Math.random().toString(36), dayOfWeek, startTime: '09:00', endTime: '17:00', label: '', isActive: true }])
  }
  const removeShift = (key) => setShifts(prev => prev.filter(s => s._key !== key))
  const updateShift = (key, field, value) => setShifts(prev => prev.map(s => s._key === key ? { ...s, [field]: value } : s))

  const saveShifts = async () => {
    setShiftsSaving(true)
    try {
      const payload = shifts.map(s => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, label: s.label || null, isActive: s.isActive !== false }))
      await saveShiftSchedule(payload)
      setHoursDialogOpen(false)
      refreshHoursStatus()
    } catch (e) { setError(e.message || t('shopOrder.grid.saveShiftsFailed')) }
    setShiftsSaving(false)
  }

  const DAY_LABELS = [
    { value: 1, label: t('shopOrder.grid.monday') },
    { value: 2, label: t('shopOrder.grid.tuesday') },
    { value: 3, label: t('shopOrder.grid.wednesday') },
    { value: 4, label: t('shopOrder.grid.thursday') },
    { value: 5, label: t('shopOrder.grid.friday') },
    { value: 6, label: t('shopOrder.grid.saturday') },
    { value: 7, label: t('shopOrder.grid.sunday') },
  ]

  const handleReset = async () => {
    setResetting(true)
    try { await resetOrderSequence(Number(resetTo)); setResetOpen(false); setResetTo(0) }
    catch (e) { setError(e.message || t('shopOrder.grid.resetFailed')) }
    setResetting(false)
  }



  const handleSwitchAndPrint = async (row) => {
    try {
      const updated = await applyOrderResult(await switchToQrPayment(row.id), row.id, t('shopOrder.grid.switchPaymentMethodFailed'))
      if (updated) printOrderReceiptTracked(updated)
    } catch (e) { setError(e.message || t('shopOrder.grid.switchPaymentMethodFailed')) }
  }

  const handleRevertToCash = async (row) => {
    try {
      await applyOrderResult(await revertToCash(row.id), row.id, t('shopOrder.grid.revertPaymentFailed'))
    } catch (e) { setError(e.message || t('shopOrder.grid.revertPaymentFailed')) }
  }

  const handleMoveTable = async () => {
    if (!selectedRows.size) return
    setMoving(true)
    try {
      await Promise.all(Array.from(selectedRows).map(async id =>
        applyOrderResult(await setOrderTable(id, moveTableTarget || null), id, t('shopOrder.grid.moveOrdersFailed'))
      ))
      setMoveTableOpen(false); setMoveTableTarget(''); setSelectedRows(new Set())
    } catch (e) { setError(e.message || t('shopOrder.grid.moveOrdersFailed')) }
    setMoving(false)
  }

  const handleInlineTableChange = async (orderId, tableId) => {
    try { await applyOrderResult(await setOrderTable(orderId, tableId || null), orderId, t('shopOrder.grid.setTableFailed')) }
    catch (e) { setError(e.message || t('shopOrder.grid.setTableFailed')) }
  }

  const handleChangeSeat = async (order) => {
    const entered = window.prompt(t('shopOrder.grid.changeSeatPrompt'), order.customerTableTag || order.tableName || '')
    if (entered === null) return
    const clean = entered.trim()
    const command = clean.toUpperCase()
    let fulfillmentType = 'DINE_IN'
    if (['PICKUP', 'MANG DI', 'MANG ĐI'].includes(command)) fulfillmentType = 'PICKUP'
    if (['DELIVERY', 'GIAO HANG', 'GIAO HÀNG'].includes(command)) fulfillmentType = 'DELIVERY'
    const noTable = ['NONE', 'NO TABLE', 'KHONG BAN', 'KHÔNG BÀN'].includes(command)
    const normalized = clean.replace(/^0+/, '')
    const match = fulfillmentType === 'DINE_IN' && !noTable ? tables.find(table => {
      const name = String(table.tableName || '')
      const number = (name.match(/[0-9]+/) || [''])[0]
      return name.toLowerCase() === clean.toLowerCase() || (number && number.replace(/^0+/, '') === normalized)
    }) : null
    const tableId = fulfillmentType === 'DINE_IN' && !noTable ? (match?.id || order.tableId || null) : null
    const tag = fulfillmentType === 'DINE_IN' && !noTable ? (clean || null) : null
    try { await applyOrderResult(await setOrderSeat(order.id, tableId, tag, fulfillmentType), order.id, t('shopOrder.grid.changeSeatFailed')) }
    catch (e) { setError(e.message || t('shopOrder.grid.changeSeatFailed')) }
  }

  const handlePrintTrack = async (row) => {
    try {
      const { data } = await fetchOrderTagQr(row.id)
      printOrderTagTracked(row, data?.qrBase64 || null)
    } catch (e) { setError(e.message || t('shopOrder.grid.trackingQrFailed')) }
  }

  const handlePayQr = async (order) => {
    let config = bankConfig
    if (!config) {
      try {
        const { data } = await fetchBankConfig()
        setBankConfig(data || {})
        config = data || {}
      } catch { setError(t('shopOrder.grid.loadBankConfigFailed')); return }
    }
    setPayQrOrder(order)
  }

  const handlePickupQr = async (row) => {
    try {
      const { data } = await fetchPickupQr(row.id)
      setPickupQrOrder({ id: row.id, orderNumber: row.orderNumber, orderCode: row.orderCode, qrBase64: data.qrBase64 })
    } catch (e) { setError(t('shopOrder.grid.generatePickupQrFailed', { error: e.message || e })) }
  }

  const handleShowTrackQr = async (row) => {
    setTrackQrOrder({ order: row, qrBase64: null, loading: true })
    try {
      const { data } = await fetchOrderTagQr(row.id)
      setTrackQrOrder({ order: row, qrBase64: data?.qrBase64 || null, loading: false })
    } catch {
      setTrackQrOrder(prev => prev ? { ...prev, loading: false } : null)
      setError(t('shopOrder.grid.trackingQrFailed'))
    }
  }

  const cardActions = {
    detail:          (row) => setDetailOrder(row),
    combinedReceipt: (token) => setCombinedToken(token),
    payQr:           handlePayQr,
    printTag:        handlePrintTrack,
    setTable:        handleInlineTableChange,
    changeSeat:      handleChangeSeat,
    setOrderNumber:  async (id, num) => {
      const n = parseInt(num, 10)
      if (isNaN(n) || n < 1) return
      try { await applyOrderResult(await setShopOrderNumber(id, n), id, t('shopOrder.grid.updateNumberFailed')) }
      catch (e) { setError(e.message || t('shopOrder.grid.updateNumberFailed')) }
    },
    confirm:    (row) => askConfirm({ title: t('shopOrder.confirm.confirmTitle'), message: t('shopOrder.confirm.confirmMessage', { order: row.orderNumber ?? row.orderCode }), confirmLabel: t('shopOrder.grid.confirm'), confirmColor: 'primary' }, () => act(confirmShopOrder, row.id)),
    prepare:    (row) => askConfirm({ title: t('shopOrder.confirm.prepareTitle'), message: t('shopOrder.confirm.prepareMessage', { order: row.orderNumber ?? row.orderCode }), confirmLabel: t('shopOrder.confirm.startLabel'), confirmColor: 'warning' }, () => act(prepareShopOrder, row.id)),
    ready:      (row) => askConfirm({ title: t('shopOrder.confirm.readyTitle'), message: t('shopOrder.confirm.readyMessage', { order: row.orderNumber ?? row.orderCode }), confirmLabel: t('shopOrder.confirm.markReadyLabel'), confirmColor: 'success' }, () => act(readyShopOrder, row.id, () => broadcastReady())),
    complete:   (row) => askConfirm({ title: t('shopOrder.confirm.completeTitle'), message: t('shopOrder.confirm.completeMessage', { order: row.orderNumber ?? row.orderCode }), confirmLabel: t('shopOrder.confirm.completeLabel'), confirmColor: 'success' }, () => act(completeShopOrder, row.id)),
    pickup:     (row) => askConfirm({ title: t('shopOrder.confirm.pickupTitle'), message: t('shopOrder.confirm.pickupMessage'), confirmLabel: t('shopOrder.confirm.pickedUpLabel'), confirmColor: 'primary' }, () => act(pickupShopOrder, row.id)),
    markPaid:   (row) => askConfirm({ title: t('shopOrder.grid.markAsPaidConfirmTitle'), message: t('shopOrder.grid.markAsPaidConfirmMessage', { order: row.orderNumber ?? row.orderCode }), confirmLabel: t('shopOrder.grid.markPaid'), confirmColor: 'success' }, () => act(markOrderPaid, row.id)),
    cancel:     handleCancel,
    revert:     (row) => askConfirm({ title: t('shopOrder.confirm.revertOrderTitle'), message: t('shopOrder.confirm.revertOrderMessage', { order: row.orderNumber ?? row.orderCode }), confirmLabel: t('shopOrder.confirm.revertLabel'), confirmColor: 'warning' }, () => act(revertShopOrder, row.id)),
    switchToQr: (row) => askConfirm({ title: t('shopOrder.grid.switchQrConfirmTitle'), message: t('shopOrder.grid.switchQrConfirmMessage'), confirmLabel: t('shopOrder.grid.switchPrint'), confirmColor: 'success' }, () => handleSwitchAndPrint(row)),
    revertCash: (row) => askConfirm({ title: t('shopOrder.grid.revertCashConfirmTitle'), message: t('shopOrder.grid.revertCashConfirmMessage'), confirmLabel: t('shopOrder.grid.switchToCash'), confirmColor: 'warning' }, () => handleRevertToCash(row)),
    pickupQr:    handlePickupQr,
    showTrackQr: handleShowTrackQr,
    mergeBills:  (row) => setMergeOrder(row),
    forceConfirm: (row) => askConfirm({
      title: t('shopOrder.confirm.forceTitle'),
      message: t('shopOrder.confirm.forceMessage', { order: row.orderNumber ?? row.orderCode }),
      confirmLabel: t('shopOrder.confirm.forceLabel'), confirmColor: 'error'
    }, () => act(forceConfirmOrder, row.id)),
  }

  const tabBadge = (label, count, color = 'primary') => (
    <Badge badgeContent={count || null} color={color} max={99}
      sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
      <span style={{ paddingRight: count ? 10 : 0 }}>{label}</span>
    </Badge>
  )

  const handleReplyCall = async (id, message) => {
    try {
      const { data } = await replyStaffCall(id, message)
      setStaffCalls(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
    } catch {
      setError('Không gửi được phản hồi cho khách')
    }
  }
  const handleDismissCall = async (id) => {
    try { await dismissStaffCall(id) } catch { /* silent */ }
    setStaffCalls(prev => prev.filter(c => c.id !== id))
    seenCallIdsRef.current.delete(id)
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column' }}>

      {/* ── Staff call banner ──────────────────────────────── */}
      {staffCalls.length > 0 && (
        <Box sx={{ flexShrink: 0, bgcolor: '#fff3e0', borderBottom: '2px solid #ff5722', px: 2, py: 0.75, display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', gap: 0.5 }}>
          {staffCalls.map(call => (
            <Box key={call.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <SupportAgentIcon sx={{ color: '#ff5722', fontSize: 20, flexShrink: 0 }} />
              <Typography fontWeight={800} sx={{ color: '#bf360c', fontSize: 13, flexShrink: 0 }}>
                {call.reason === STAFF_CALL_REASON_NEW_ORDER ? staffCallReasonLabel(call.reason) : 'G\u1ecdi nh\u00e2n vi\u00ean'}
              </Typography>
              {(call.tableName || call.tableId) && (
                <Chip label={`Bàn ${call.tableName || call.tableId}`} size="small" color="warning" sx={{ fontWeight: 700, height: 20, fontSize: 11 }} />
              )}
              {call.dailySeq != null && (
                <Chip label={`STT ${call.dailySeq}`} size="small" color="info" sx={{ fontWeight: 700, height: 20, fontSize: 11 }} />
              )}
              {(call.orderNumber != null || call.orderCode) && (
                <Chip
                  label={call.orderNumber != null ? `Đơn #${call.orderNumber}` : call.orderCode}
                  size="small"
                  color="primary"
                  sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
                />
              )}
              <Chip
                label={staffCallReasonLabel(call.reason)}
                size="small"
                sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#ff5722', color: '#fff' }}
              />
              {call.note && (
                <Typography variant="caption" sx={{ color: '#555', fontStyle: 'italic', flex: 1 }}>{call.note}</Typography>
              )}
              {call.replyMessage && (
                <Chip label={`Đã trả lời: ${call.replyMessage}`} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#e8f5e9', color: '#1b5e20' }} />
              )}
              {call.reason !== STAFF_CALL_REASON_NEW_ORDER && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: '1 1 360px', minWidth: 240 }}>
                {STAFF_CALL_QUICK_REPLIES.map(message => (
                  <Button key={message} size="small" variant={call.replyMessage === message ? 'contained' : 'outlined'}
                    onClick={() => handleReplyCall(call.id, message)}
                    sx={{ textTransform: 'none', borderRadius: 20, minHeight: 22, py: 0.1, px: 1, fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>
                    {message}
                  </Button>
                ))}
              </Box>
              )}
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                {call.createdAt ? new Date(call.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </Typography>
              <Tooltip title="Đã xử lý">
                <IconButton size="small" onClick={() => handleDismissCall(call.id)}
                  sx={{ color: '#ff5722', p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {stockItems.length > 0 && (
        <StockPanel
          items={stockItems}
          onUseInOrder={handleUseInOrder}
          onClear={() => setStockItems([])}
          onRemoveItem={uid => setStockItems(prev => prev.filter(i => i.uid !== uid))}
        />
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box sx={{ px: { xs: 1, sm: 1.5 }, py: { xs: 0.5, sm: 1 }, display: 'flex', gap: { xs: 0.75, sm: 1 }, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
          <TextField select label={t('common.status')} value={statusFilters}
            onChange={e => {
              const values = typeof e.target.value === 'string'
                ? e.target.value.split(',').filter(Boolean)
                : e.target.value
              const selected = Array.isArray(values) ? values.filter(status => ORDER_STATUSES.includes(status)) : []
              const next = values.includes('__ALL__') || selected.length === ORDER_STATUSES.length ? [] : selected
              setStatusFilters(next)
              writeShopOrderSessionValue(SHOP_ORDER_STATUS_FILTER_SESSION_KEY, JSON.stringify(next))
            }}
            SelectProps={{
              multiple: true,
              displayEmpty: true,
              renderValue: selected => selected.length
                ? selected.map(status => localizedStatusLabel(status, t)).join(', ')
                : t('common.all'),
            }}
            size="small" sx={{ width: { xs: 160, sm: 250 }, flexShrink: 1 }}>
            <MenuItem value="__ALL__">
              <Checkbox size="small" checked={statusFilters.length === 0} />
              {t('common.all')}
            </MenuItem>
            {ORDER_STATUSES.map(status => (
              <MenuItem key={status} value={status}>
                <Checkbox size="small" checked={statusFilters.includes(status)} />
                {localizedStatusLabel(status, t)}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label={t('common.payment')} value={paymentFilter}
            onChange={e => {
              setPaymentFilter(e.target.value)
              writeShopOrderSessionValue(SHOP_ORDER_PAYMENT_FILTER_SESSION_KEY, e.target.value)
            }}
            size="small" sx={{ width: { xs: 118, sm: 155 }, flexShrink: 0 }}>
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="UNPAID">{t('common.unpaid')}</MenuItem>
            <MenuItem value="PAID">{t('common.paid')}</MenuItem>
          </TextField>
          <TextField label={t('shopOrder.grid.fromTime')} type="datetime-local" value={orderFrom}
            onChange={e => setOrderRange(prev => ({ ...prev, from: e.target.value }))}
            size="small" InputLabelProps={{ shrink: true }}
            sx={{ width: { sm: 205 }, flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }} />
          <TextField label={t('shopOrder.grid.toTime')} type="datetime-local" value={orderTo}
            onChange={e => setOrderRange(prev => ({ ...prev, to: e.target.value }))}
            size="small" InputLabelProps={{ shrink: true }}
            sx={{ width: { sm: 205 }, flexShrink: 0, display: { xs: 'none', sm: 'inline-flex' } }} />
          <Button onClick={() => setOrderRange(todayOrderRange())} variant="outlined" size="small"
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', fontWeight: 800, minWidth: 70 }}>
            {t('shopOrder.grid.today')}
          </Button>
          <Button onClick={() => setOrderRange({ from: '', to: '' })} variant="text" size="small"
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', fontWeight: 800, minWidth: 82 }}>
            {t('shopOrder.grid.allTime')}
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={reload} variant="outlined" size="small"
            sx={{ minWidth: { xs: 40, sm: 64 }, px: { xs: 1, sm: 1.25 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 1 } } }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t('shopOrder.grid.refresh')}</Box>
          </Button>
          <Button startIcon={<MoreHorizIcon />} onClick={() => setMobileToolsOpen(true)}
            variant="outlined" size="small"
            sx={{ display: { xs: 'inline-flex', sm: 'none' }, textTransform: 'none', fontWeight: 900, minWidth: 40, px: 1, '& .MuiButton-startIcon': { mr: 0 } }}
            aria-label={t('shop.orderAction.more')}>
            <Box component="span" sx={{ display: 'none' }}>{t('shop.orderAction.more')}</Box>
          </Button>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, border: '1px solid #cbd5e1', borderRadius: 1, overflow: 'hidden', bgcolor: '#fff' }}>
            <Button startIcon={<TvIcon />} size="small" variant={orderViewMode === 'cards' ? 'contained' : 'text'} onClick={() => { setOrderViewMode('cards'); writeShopOrderPref(SHOP_ORDER_VIEW_PREF, 'cards') }} sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 800 }}>{t('shopOrder.grid.cards')}</Button>
            <Button startIcon={<TableBarIcon />} size="small" variant={orderViewMode === 'grid' ? 'contained' : 'text'} onClick={() => { setOrderViewMode('grid'); writeShopOrderPref(SHOP_ORDER_VIEW_PREF, 'grid') }} sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 800 }}>{t('shopOrder.grid.grid')}</Button>
          </Box>
          <TextField select label={t('shopOrder.grid.cardSize')} value={cardDisplaySize} onChange={e => { setCardDisplaySize(e.target.value); writeShopOrderPref(SHOP_ORDER_CARD_SIZE_PREF, e.target.value) }} size="small" sx={{ width: 132, display: { xs: 'none', sm: 'inline-flex' } }}>
            <MenuItem value="normal">{t('shopOrder.grid.normal')}</MenuItem>
            <MenuItem value="large">{t('shopOrder.grid.large')}</MenuItem>
          </TextField>
          <Button startIcon={<MonitorIcon />} aria-pressed={highContrastCards} onClick={() => { const next = !highContrastCards; setHighContrastCards(next); writeShopOrderPref(SHOP_ORDER_CONTRAST_PREF, String(next)) }} variant={highContrastCards ? 'contained' : 'outlined'} size="small" color="secondary" sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', fontWeight: 900, borderWidth: highContrastCards ? 2 : 1, '&:hover': { borderWidth: highContrastCards ? 2 : 1 } }}>{t('shopOrder.grid.contrast')}</Button>
          {staffCalls.length > 0 && (
            <Tooltip title={t('shopOrder.grid.staffNotifications', { count: staffCalls.length })}>
              <IconButton
                size="small"
                color="warning"
                onClick={() => setStaffCallMobileOpen(true)}
                sx={{
                  display: { xs: 'inline-flex', sm: 'none' },
                  width: 36,
                  height: 36,
                  border: '1px solid #ffcc80',
                  bgcolor: '#fff3e0',
                  color: '#ff5722',
                  '&:hover': { bgcolor: '#ffe0b2' },
                }}
              >
                <Badge badgeContent={staffCalls.length} color="error" max={99}
                  sx={{ '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 } }}>
                  <NotificationsActiveIcon sx={{ fontSize: 19 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          <Button startIcon={<AddCircleOutlineIcon />} onClick={() => { setManualDefaults(null); setManualOpen(true) }}
            variant="contained" size="small" color="success" sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', px: { xs: 1, sm: 1.25 }, '& .MuiButton-startIcon': { mr: { xs: 0.5, sm: 1 } } }}>{t('shopOrder.grid.newOrder')}</Button>
          <Button startIcon={<QrCode2Icon />} onClick={() => setQrOrderOpen(true)}
            variant="outlined" size="small" color="primary" sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', fontWeight: 700 }}>{t('shopOrder.grid.qrOrder')}</Button>
          <Button startIcon={<QrCodeScannerIcon />} onClick={() => { setScannedOrders([]); setOrderScannerOpen(true) }}
            variant="contained" size="small" color="primary" sx={{ textTransform: 'none', fontWeight: 800 }}>{t('shopOrder.grid.scanCustomerOrders')}</Button>
          <TextField select size="small" label={t('shopOrder.grid.tableNumber')} value={tableFilter} onChange={e => setTableFilter(e.target.value)}
            sx={{ width: { xs: 112, sm: 122 }, '& .MuiInputBase-input': { fontSize: 13, fontWeight: 800 } }}>
            <MenuItem value="">{t('shopOrder.grid.allTables')}</MenuItem>
            <MenuItem value="__SEPARATE__">{t('shopOrder.grid.noTable')}</MenuItem>
            {tables.map(table => <MenuItem key={table.id} value={String(table.id)}>{table.tableName}</MenuItem>)}
          </TextField>
          <TextField select size="small" label={t('shopOrder.grid.scanSlipNumber')} value={selectedSlipFilter} onChange={e => setSlipFilter(e.target.value)}
            sx={{ width: { xs: 136, sm: 176 }, '& .MuiInputBase-input': { fontSize: 13, fontWeight: 800 } }}>
            <MenuItem value="">{t('shopOrder.grid.allSlips')}</MenuItem>
            {slipOptions.map(slip => <MenuItem key={slip.token} value={slip.token}>{slip.label}</MenuItem>)}
          </TextField>
          {selectedSlipFilter && (
            <Button size="small" variant="contained" color="success" onClick={() => setCombinedToken(selectedSlipFilter)}
              sx={{ textTransform: 'none', fontWeight: 900, minWidth: { xs: 92, sm: 96 }, px: 1 }}>
              {t('shopOrder.grid.paySlip')}
            </Button>
          )}
          <Badge badgeContent={customerEditHistory.length} color="warning" max={99} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            <Button startIcon={<NotificationsActiveIcon />} onClick={() => setCustomerEditHistoryOpen(true)}
              variant="outlined" size="small" color="warning" sx={{ textTransform: 'none', fontWeight: 800 }}>{t('shopOrder.grid.notificationHistory')}</Button>
          </Badge>
          <Button startIcon={<QrCode2Icon />} onClick={() => { setQuickLoginData(null); setQuickLoginError(''); setQuickLoginHours(12); setQuickLoginOpen(true) }}
            variant="outlined" size="small" color="secondary" sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', fontWeight: 800 }}>Đăng nhập iPad</Button>
          {selectedRows.size > 0 && (
            <Button
              startIcon={<DriveFileMoveIcon />}
              onClick={() => { setMoveTableTarget(''); setMoveTableOpen(true) }}
              variant="contained" size="small" color="info"
              sx={{ textTransform: 'none', fontWeight: 700 }}>
              Move {selectedRows.size} order{selectedRows.size > 1 ? 's' : ''} → Table
            </Button>
          )}
          <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
          <Button startIcon={<TvIcon />} onClick={handleOpenBoard} variant="outlined" size="small" color="info" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>{t('shopOrder.grid.displayBoard')}</Button>
          <Button startIcon={<ScheduleIcon />} onClick={openHoursDialog} variant="outlined" size="small" color="info"
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            {t('shopOrder.grid.openingHours')}
          </Button>
          <Button startIcon={hoursStatus.open ? <LockIcon /> : <LockOpenIcon />} onClick={handleCloseToday}
                  variant="outlined" size="small" color={hoursStatus.open ? 'error' : 'success'} disabled={closingToday}
                  sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            {hoursStatus.open ? t('shopOrder.grid.closeToday') : t('shopOrder.grid.reopenShop')}
          </Button>
          <Tooltip title={t('shopOrder.grid.openCounterDisplay')}>
            <Button startIcon={<MonitorIcon />}
              onClick={openCounterDisplay}
              variant="outlined" size="small" color="secondary" sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none' }}>
              Counter
            </Button>
          </Tooltip>
          <Button startIcon={<AssessmentIcon />} onClick={() => setEodOpen(true)} variant="outlined" size="small" color="secondary" sx={{ display: { xs: 'none', sm: 'inline-flex' }, textTransform: 'none', fontWeight: 700 }}>{t('shopOrder.grid.shiftAudit')}</Button>
          <Button startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)} variant="outlined" size="small" color="warning" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>{t('shopOrder.grid.resetCounter')}</Button>
        </Box>

        <Dialog open={mobileToolsOpen} onClose={() => setMobileToolsOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
            <MoreHorizIcon color="primary" />
            <Typography fontWeight={900} sx={{ flex: 1 }}>{t('shop.orderAction.more')}</Typography>
            <IconButton size="small" onClick={() => setMobileToolsOpen(false)} aria-label={t('shopOrder.grid.close')}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: 0 }}>
            <Stack spacing={2}>
              <Stack spacing={1.25}>
                <Typography variant="caption" color="text.secondary" fontWeight={900}>{t('shopOrder.grid.fromTime')} / {t('shopOrder.grid.toTime')}</Typography>
                <TextField label={t('shopOrder.grid.fromTime')} type="datetime-local" value={orderFrom}
                  onChange={e => setOrderRange(prev => ({ ...prev, from: e.target.value }))}
                  size="small" fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label={t('shopOrder.grid.toTime')} type="datetime-local" value={orderTo}
                  onChange={e => setOrderRange(prev => ({ ...prev, to: e.target.value }))}
                  size="small" fullWidth InputLabelProps={{ shrink: true }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button fullWidth onClick={() => setOrderRange(todayOrderRange())} variant="outlined" size="small"
                    sx={{ textTransform: 'none', fontWeight: 900 }}>
                    {t('shopOrder.grid.today')}
                  </Button>
                  <Button fullWidth onClick={() => setOrderRange({ from: '', to: '' })} variant="text" size="small"
                    sx={{ textTransform: 'none', fontWeight: 900 }}>
                    {t('shopOrder.grid.allTime')}
                  </Button>
                </Box>
              </Stack>

              <Divider />

              <Stack spacing={1.25}>
                <Box sx={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 1, overflow: 'hidden', bgcolor: '#fff' }}>
                  <Button fullWidth startIcon={<TvIcon />} size="small" variant={orderViewMode === 'cards' ? 'contained' : 'text'}
                    onClick={() => { setOrderViewMode('cards'); writeShopOrderPref(SHOP_ORDER_VIEW_PREF, 'cards') }}
                    sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 900 }}>
                    {t('shopOrder.grid.cards')}
                  </Button>
                  <Button fullWidth startIcon={<TableBarIcon />} size="small" variant={orderViewMode === 'grid' ? 'contained' : 'text'}
                    onClick={() => { setOrderViewMode('grid'); writeShopOrderPref(SHOP_ORDER_VIEW_PREF, 'grid') }}
                    sx={{ borderRadius: 0, textTransform: 'none', fontWeight: 900 }}>
                    {t('shopOrder.grid.grid')}
                  </Button>
                </Box>
                <TextField select label={t('shopOrder.grid.cardSize')} value={cardDisplaySize}
                  onChange={e => { setCardDisplaySize(e.target.value); writeShopOrderPref(SHOP_ORDER_CARD_SIZE_PREF, e.target.value) }}
                  size="small" fullWidth>
                  <MenuItem value="normal">{t('shopOrder.grid.normal')}</MenuItem>
                  <MenuItem value="large">{t('shopOrder.grid.large')}</MenuItem>
                </TextField>
                <Button fullWidth startIcon={<MonitorIcon />} aria-pressed={highContrastCards}
                  onClick={() => { const next = !highContrastCards; setHighContrastCards(next); writeShopOrderPref(SHOP_ORDER_CONTRAST_PREF, String(next)) }}
                  variant={highContrastCards ? 'contained' : 'outlined'} size="small" color="secondary"
                  sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {t('shopOrder.grid.contrast')}
                </Button>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Button fullWidth startIcon={<QrCode2Icon />} onClick={() => { setQrOrderOpen(true); setMobileToolsOpen(false) }}
                  variant="outlined" size="small" color="primary" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {t('shopOrder.grid.qrOrder')}
                </Button>
                <Button fullWidth startIcon={<NotificationsActiveIcon />} onClick={() => { setCustomerEditHistoryOpen(true); setMobileToolsOpen(false) }}
                  variant="outlined" size="small" color="warning" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {customerEditHistory.length ? `${t('shopOrder.grid.notificationHistory')} (${customerEditHistory.length})` : t('shopOrder.grid.notificationHistory')}
                </Button>
                <Button fullWidth startIcon={<QrCode2Icon />} onClick={() => { setQuickLoginData(null); setQuickLoginError(''); setQuickLoginHours(12); setQuickLoginOpen(true); setMobileToolsOpen(false) }}
                  variant="outlined" size="small" color="secondary" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  Đăng nhập iPad
                </Button>
                <Button fullWidth startIcon={<TvIcon />} onClick={() => { setMobileToolsOpen(false); handleOpenBoard() }}
                  variant="outlined" size="small" color="info" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {t('shopOrder.grid.displayBoard')}
                </Button>
                <Button fullWidth startIcon={<MonitorIcon />} onClick={() => { setMobileToolsOpen(false); openCounterDisplay() }}
                  variant="outlined" size="small" color="secondary" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {t('shopOrder.grid.counterDisplay')}
                </Button>
                <Button fullWidth startIcon={<AssessmentIcon />} onClick={() => { setEodOpen(true); setMobileToolsOpen(false) }}
                  variant="outlined" size="small" color="secondary" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {t('shopOrder.grid.shiftAudit')}
                </Button>
                <Button fullWidth startIcon={<RestartAltIcon />} onClick={() => { setResetOpen(true); setMobileToolsOpen(false) }}
                  variant="outlined" size="small" color="warning" sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 900 }}>
                  {t('shopOrder.grid.resetCounter')}
                </Button>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMobileToolsOpen(false)}>{t('shopOrder.grid.close')}</Button>
          </DialogActions>
        </Dialog>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mx: 1.5, mt: 0.5 }}>{error}</Alert>}
        {newOrderNotice && (
          <Alert severity="info" onClose={() => setNewOrderNotice(null)} sx={{ mx: 1.5, mt: 0.5 }}>
            {newOrderNotice.count > 1
              ? t('shopOrder.grid.newOrdersReceived', { count: newOrderNotice.count })
              : t('shopOrder.grid.newOrderReceived', { number: newOrderNotice.orderNumber != null ? `#${newOrderNotice.orderNumber}` : newOrderNotice.orderCode || '' })}
          </Alert>
        )}
        {customerEditNotice && (
          <Alert severity="warning" onClose={() => setCustomerEditNotice(null)} sx={{ mx: 1.5, mt: 0.5 }}
            action={<Button color="inherit" size="small" onClick={() => setCustomerEditHistoryOpen(true)}>History</Button>}>
            {customerEditNotice.count > 1
              ? `${customerEditNotice.count} customers started editing orders`
              : customerEditNotice.type === 'table_change' ? `Customer changed table for order #${customerEditNotice.orderNumber}: ${customerEditNotice.detail}` : `Customer ${customerEditNotice.customerName} started editing order #${customerEditNotice.orderNumber}`}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: '1px solid #e0e0e0', px: { xs: 0.5, sm: 1.5 }, flexShrink: 0 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons={false} sx={{ minHeight: { xs: 36, sm: 40 } }}>
            <Tab label={t('shop.orders')}                                                                           sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge(t('shopOrder.grid.production'), confirmedOrders.length, 'primary')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge(t('shopOrder.grid.processing'), preparingOrders.length, 'warning')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge(t('shopOrder.grid.ready'), readyOrders.length,     'success')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge(t('shopOrder.grid.pickedUp'), pickedUpOrders.length,  'info')}                         sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
          </Tabs>
        </Box>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {tab === 0 && (
            <>
            {(visibleOrderTotals.tables.length > 0 || visibleOrderTotals.separateCount > 0) && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 1.5, pt: 1.25 }}>
                <Button size="small" variant={tableFilter ? 'outlined' : 'contained'} onClick={() => setTableFilter('')} sx={{ textTransform: 'none', fontWeight: 800 }}>{t('common.all')}</Button>
                {paymentFilter && <Chip label={`${paymentFilter === 'UNPAID' ? t('common.unpaid') : t('common.paid')} ×`} color={paymentFilter === 'UNPAID' ? 'warning' : 'success'} onClick={() => { setPaymentFilter(''); writeShopOrderSessionValue(SHOP_ORDER_PAYMENT_FILTER_SESSION_KEY, '') }} sx={{ fontWeight: 800 }} />}
                {visibleOrderTotals.tables.map(table => (
                  <Box component="button" type="button" onClick={() => setTableFilter(table.key)} key={table.key} sx={{ textAlign: 'left', cursor: 'pointer', px: 1.25, py: 0.75, border: '2px solid', borderColor: tableFilter === table.key ? 'primary.main' : '#90caf9', borderRadius: 1, bgcolor: tableFilter === table.key ? '#bbdefb' : '#e3f2fd' }}>
                    <Typography variant="caption" fontWeight={800}>{t('shopOrder.grid.tableOrderSummary', { table: table.label, count: table.count })}</Typography>
                    <Typography fontWeight={900} color="primary.dark">{t('shopOrder.grid.tableTotal')}: {fmt(table.total)}</Typography>
                  </Box>
                ))}
                {visibleOrderTotals.separateCount > 0 && (
                  <Box component="button" type="button" onClick={() => setTableFilter('__SEPARATE__')} sx={{ textAlign: 'left', cursor: 'pointer', px: 1.25, py: 0.75, border: '2px solid', borderColor: tableFilter === '__SEPARATE__' ? 'warning.main' : '#ffcc80', borderRadius: 1, bgcolor: tableFilter === '__SEPARATE__' ? '#ffe0b2' : '#fff3e0' }}>
                    <Typography variant="caption" fontWeight={800}>{t('shopOrder.grid.takeawaySeparateSummary', { count: visibleOrderTotals.separateCount })}</Typography>
                    <Typography fontWeight={900} color="warning.dark">{t('shopOrder.grid.grandTotal')}: {fmt(visibleOrderTotals.separateTotal)}</Typography>
                  </Box>
                )}
              </Box>
            )}
            <OrderCardGrid
              rows={displayedRows}
              loading={loading}
              tables={tables}
              actions={cardActions}
              modelImageMap={modelImageMap}
              selectedIds={selectedRows}
              viewMode={orderViewMode}
              displaySize={cardDisplaySize}
              highContrast={highContrastCards}
              onToggleSelect={id => setSelectedRows(prev => {
                const next = new Set(prev)
                next.has(id) ? next.delete(id) : next.add(id)
                return next
              })}
            />
            </>
          )}
          {tab === 1 && <StatusBoard status="CONFIRMED"  orders={confirmedOrders} modelImageMap={modelImageMap} displaySize={cardDisplaySize} highContrast={highContrastCards} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} onShowTrackQr={handleShowTrackQr} onPrintTag={handlePrintTrack} onMergeBills={cardActions.mergeBills} onChangeSeat={handleChangeSeat} />}
          {tab === 2 && <StatusBoard status="PREPARING"  orders={preparingOrders} modelImageMap={modelImageMap} displaySize={cardDisplaySize} highContrast={highContrastCards} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} onShowTrackQr={handleShowTrackQr} onPrintTag={handlePrintTrack} onMergeBills={cardActions.mergeBills} onChangeSeat={handleChangeSeat} />}
          {tab === 3 && <StatusBoard status="READY"      orders={readyOrders}     modelImageMap={modelImageMap} displaySize={cardDisplaySize} highContrast={highContrastCards} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} onShowTrackQr={handleShowTrackQr} onPrintTag={handlePrintTrack} onMergeBills={cardActions.mergeBills} onChangeSeat={handleChangeSeat} />}
          {tab === 4 && <StatusBoard status="PICKED_UP"  orders={pickedUpOrders}  modelImageMap={modelImageMap} displaySize={cardDisplaySize} highContrast={highContrastCards} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} onPickupQr={handlePickupQr} onSwitchQr={cardActions.switchToQr} onRevertCash={cardActions.revertCash} onShowTrackQr={handleShowTrackQr} onPrintTag={handlePrintTrack} onMergeBills={cardActions.mergeBills} onChangeSeat={handleChangeSeat} />}
        </Box>
      </Box>

      {/* Dialogs */}
      <Dialog open={customerEditHistoryOpen} onClose={() => setCustomerEditHistoryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('shopOrder.grid.notificationHistory')}</DialogTitle>
        <DialogContent dividers>
          {entry.type === 'new_order' ? t('shopOrder.grid.notifNewOrder', { number: entry.orderNumber })
              : entry.type === 'shop_qr' ? t('shopOrder.grid.notifShopQr') + (entry.orderNumber ? ` · ${t('shopOrder.grid.notifOrderNumber', { number: entry.orderNumber })}` : '')
                  : entry.type === 'table_change' ? t('shopOrder.grid.notifTableChange', { number: entry.orderNumber })
                      : t('shopOrder.grid.notifEditingOrder', { number: entry.orderNumber })}
          <Stack spacing={1}>
            {customerEditHistory.map(entry => (
              <Box key={entry.id} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography fontWeight={800}>
                  {entry.type === 'new_order' ? `New order #${entry.orderNumber}` : entry.type === 'shop_qr' ? `Shop QR notification${entry.orderNumber ? ` · Order #${entry.orderNumber}` : ''}` : entry.type === 'table_change' ? `Customer changed table · Order #${entry.orderNumber}` : `Customer editing order #${entry.orderNumber}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">{entry.customerName}{entry.detail ? ` · ${entry.detail}` : ''} · {dateFmt(entry.at)} · {t('shopOrder.grid.notifRead')}</Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="error" disabled={!customerEditHistory.length} onClick={() => setCustomerEditHistory([])}>{t('shopOrder.grid.clearHistory')}</Button>
          <Button onClick={() => setCustomerEditHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={quickLoginOpen} onClose={() => !quickLoginLoading && setQuickLoginOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Đăng nhập nhanh cho iPad</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Link chỉ dùng một lần. iPad sẽ giữ đăng nhập cho đúng thời gian đã chọn mà không cần mật khẩu.
          </Alert>
          <TextField select fullWidth size="small" label="Thời gian đăng nhập" value={quickLoginHours}
            onChange={event => { setQuickLoginHours(Number(event.target.value)); setQuickLoginData(null) }}>
            {[6, 8, 12, 24].map(hours => <MenuItem key={hours} value={hours}>{hours} giờ{hours === 12 ? ' (mặc định)' : ''}</MenuItem>)}
          </TextField>
          {!quickLoginData && (
            <Button variant="contained" fullWidth onClick={generateQuickLogin} disabled={quickLoginLoading}
              sx={{ mt: 2, textTransform: 'none', fontWeight: 800 }}>
              {quickLoginLoading ? <CircularProgress size={20} color="inherit" /> : 'Tạo link đăng nhập'}
            </Button>
          )}
          {quickLoginError && <Alert severity="error" sx={{ mt: 2 }}>{quickLoginError}</Alert>}
          {quickLoginData?.link && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(quickLoginData.link)}`}
                alt="QR đăng nhập iPad" style={{ width: 260, height: 260, maxWidth: '100%' }} />
              <Typography fontWeight={800}>Quét bằng iPad để đăng nhập</Typography>
              <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f3f4f6', border: '2px dashed #6366f1', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary">Nếu camera iPad không quét được, nhập PIN 6 số (hiệu lực 5 phút):</Typography>
                <Typography sx={{ mt: 0.5, fontFamily: 'monospace', fontSize: 36, fontWeight: 900, letterSpacing: 8, color: '#3730a3', userSelect: 'all' }}>
                  {quickLoginData.token}
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ overflowWrap: 'anywhere', mt: 1 }}>
                {quickLoginData.link}
              </Typography>
              <Button variant="outlined" fullWidth sx={{ mt: 1.5, textTransform: 'none' }}
                onClick={() => navigator.clipboard?.writeText(quickLoginData.link)}>Sao chép link</Button>
              <Alert severity="warning" sx={{ mt: 1.5, textAlign: 'left' }}>Sau khi iPad dùng link, link này không thể dùng lại.</Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setQuickLoginOpen(false)}>Đóng</Button></DialogActions>
      </Dialog>
      <ManualOrderDialog
        open={manualOpen}
        onClose={() => { setManualOpen(false); setManualDefaults(null); setPendingStockUids([]) }}
        onCreated={(createdOrder) => {
          if (pendingStockUids.length && createdOrder?.orderCode) {
            setStockItems(prev => prev.map(i =>
              pendingStockUids.includes(i.uid)
                ? { ...i, utilizedOrderCode: createdOrder.orderCode }
                : i
            ))
          }
          setPendingStockUids([])
          if (createdOrder?.id) mergeOrderIntoState(createdOrder)
          else reload()
        }}
        defaultItems={manualDefaults}
      />
      <VoucherQrScanDialog
        open={orderScannerOpen}
        onClose={() => setOrderScannerOpen(false)}
        onScan={handleScannedOrder}
        continuous
        title={t('shopOrder.grid.scanCustomerOrderQrs')}
        manualLabel={t('shopOrder.grid.orderQrOrCode')}
        scannerLabel={scannedOrders.length ? t('shopOrder.grid.ordersConfirmedKeepScanning', { count: scannedOrders.length }) : t('shopOrder.grid.scanOrdersOneByOne')}
      />
      <EodAuditDialog open={eodOpen} onClose={() => setEodOpen(false)} />
      <QrOrderDialog open={qrOrderOpen} onClose={() => setQrOrderOpen(false)} />
      {detailOrder && (
        <ShopOrderDetailModal open order={detailOrder} displaySize={cardDisplaySize} onClose={() => setDetailOrder(null)} onRefresh={async (updatedOrder) => {
          try {
            if (updatedOrder?.id) mergeOrderIntoState(updatedOrder)
            else if (detailOrder?.id) await refreshOrderCard(detailOrder.id)
            else reload()
          } catch { reload() }
          setDetailOrder(null)
        }} />
      )}
      {mergeOrder && (
        <MergeBillsDialog open order={mergeOrder}
          onClose={() => setMergeOrder(null)}
          onMerge={() => { setMergeOrder(null); reload() }} />
      )}

      <Dialog open={Boolean(staffCallMobileOpen && staffCalls.length)} onClose={() => setStaffCallMobileOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25 }}>
          <Badge badgeContent={staffCalls.length} color="error" max={99}>
            <NotificationsActiveIcon sx={{ color: '#ff5722' }} />
          </Badge>
          <Typography fontWeight={800} sx={{ fontSize: 15, flex: 1 }}>{t('shopOrder.grid.staffNotifications', { count: staffCalls.length })}</Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1 }}>
          <Stack spacing={1}>
            {staffCalls.map(call => (
              <Box key={call.id} sx={{ border: '1px solid #ffe0b2', borderRadius: 1, p: 1, bgcolor: '#fffaf2' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <SupportAgentIcon sx={{ color: '#ff5722', fontSize: 18, flexShrink: 0 }} />
                  <Typography fontWeight={800} sx={{ color: '#bf360c', fontSize: 13, flex: 1, minWidth: 0 }}>
                    {call.reason === STAFF_CALL_REASON_NEW_ORDER ? staffCallReasonLabel(call.reason) : 'G\u1ecdi nh\u00e2n vi\u00ean'}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                    {call.createdAt ? new Date(call.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Typography>
                  <IconButton size="small" onClick={() => handleDismissCall(call.id)} sx={{ color: '#ff5722', p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                  {(call.tableName || call.tableId) && <Chip label={t('shopOrder.common.tableValue', { value: call.tableName || call.tableId })} size="small" color="warning" sx={{ fontWeight: 700, height: 20, fontSize: 11 }} />}
                  {call.dailySeq != null && <Chip label={`STT ${call.dailySeq}`} size="small" color="info" sx={{ fontWeight: 700, height: 20, fontSize: 11 }} />}
                  {(call.orderNumber != null || call.orderCode) && <Chip label={call.orderNumber != null ? `Order #${call.orderNumber}` : call.orderCode} size="small" color="primary" sx={{ fontWeight: 700, height: 20, fontSize: 11 }} />}
                  <Chip label={staffCallReasonLabel(call.reason)} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#ff5722', color: '#fff' }} />
                </Box>
                {call.note && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#555', fontStyle: 'italic', mt: 0.75 }}>{call.note}</Typography>
                )}
                {call.replyMessage && (
                  <Chip label={`Replied: ${call.replyMessage}`} size="small" sx={{ mt: 0.75, height: 20, fontSize: 11, fontWeight: 700, bgcolor: '#e8f5e9', color: '#1b5e20' }} />
                )}
                {call.reason !== STAFF_CALL_REASON_NEW_ORDER && (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
                    {STAFF_CALL_QUICK_REPLIES.map(message => (
                      <Button key={message} size="small" variant={call.replyMessage === message ? 'contained' : 'outlined'}
                        onClick={() => handleReplyCall(call.id, message)}
                        sx={{ textTransform: 'none', borderRadius: 1, minHeight: 24, py: 0.1, px: 1, fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>
                        {message}
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStaffCallMobileOpen(false)} size="small">{t('shopOrder.grid.close')}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={boardOpen} onClose={() => setBoardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TvIcon color="info" /> {t('shopOrder.grid.displayBoards')}</DialogTitle>
        <DialogContent>
          {boardLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box> : boardUrl ? (
            <Stack spacing={2.5}>

              {/* Staff board */}
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <TvIcon fontSize="small" color="info" />
                  <Typography variant="body2" fontWeight={700}>{t('shopOrder.grid.staffBoard')}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('shopOrder.grid.staffBoardHelp')}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField value={boardUrl} size="small" fullWidth inputProps={{ readOnly: true, style: { fontSize: 12 } }} onClick={e => e.target.select()} />
                  <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                    <IconButton onClick={() => { navigator.clipboard.writeText(boardUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} color={copied ? 'success' : 'default'} size="small">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Button variant="text" size="small" sx={{ mt: 0.5 }} onClick={() => window.open(boardUrl, '_blank')}>{t('shopOrder.grid.openNewTab')}</Button>
              </Box>

              {/* Customer board + Link Device QR */}
              <Box sx={{ bgcolor: '#f0fdf4', borderRadius: 2, p: 1.5, border: '1px solid #bbf7d0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <PeopleAltIcon fontSize="small" sx={{ color: '#16a34a' }} />
                  <Typography variant="body2" fontWeight={700} color="#16a34a">{t('shopOrder.grid.customerBoard')}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('shopOrder.grid.customerBoardHelp')}</Typography>
                </Box>
                <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, cursor: 'pointer' }}>
                  <Checkbox size="small" checked={separateCustomerConfirmed}
                    onChange={e => setSeparateCustomerConfirmed(e.target.checked)} />
                  <Box>
                    <Typography variant="body2" fontWeight={700}>Separate confirmed orders</Typography>
                    <Typography variant="caption" color="text.secondary">Tell confirmed customers to approach the cashier area.</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <TextField value={customerBoardDisplayUrl} size="small" fullWidth inputProps={{ readOnly: true, style: { fontSize: 12 } }} onClick={e => e.target.select()} />
                  <Tooltip title={copiedCustomer ? 'Copied!' : 'Copy URL'}>
                    <IconButton onClick={() => { navigator.clipboard.writeText(customerBoardDisplayUrl); setCopiedCustomer(true); setTimeout(() => setCopiedCustomer(false), 2000) }} color={copiedCustomer ? 'success' : 'default'} size="small">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Button variant="text" size="small" color="success" sx={{ mt: 0.5 }} onClick={() => window.open(customerBoardDisplayUrl, '_blank')}>{t('shopOrder.grid.openNewTab')}</Button>

                {/* ── Link Device QR ── */}
                <Box sx={{
                  mt: 1.5,
                  bgcolor: '#022c22',
                  border: '2px solid #16a34a',
                  borderRadius: 2,
                  p: 2,
                  display: 'flex',
                  gap: 2,
                  alignItems: 'center',
                }}>
                  {/* QR code image — generated from the customer board URL */}
                  <Box sx={{
                    bgcolor: '#fff',
                    borderRadius: 1.5,
                    p: 0.75,
                    flexShrink: 0,
                    border: '2px solid #4ade80',
                  }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(customerBoardDisplayUrl)}`}
                      alt="Customer Board QR"
                      style={{ width: 160, height: 160, display: 'block' }}
                    />
                  </Box>
                  {/* Instructions */}
                  <Box>
                    <Typography sx={{ fontWeight: 800, color: '#4ade80', fontSize: 14, mb: 0.75 }}>
                      📱 Link a Device
                    </Typography>
                    <Typography sx={{ color: '#86efac', fontSize: 12, lineHeight: 1.6 }}>
                      Scan this QR with a phone or tablet to mirror the customer board live.
                    </Typography>
                    <Typography sx={{ color: '#4ade80', fontSize: 11, mt: 0.75, lineHeight: 1.5, fontStyle: 'italic' }}>
                      {t('shopOrder.grid.counterDisplay')} tip: open on your counter phone and show it to customers so they can track their order.
                    </Typography>
                    <Button
                      size="small" variant="outlined"
                      startIcon={<ContentCopyIcon sx={{ fontSize: cardDisplaySize === 'large' ? 17 : 13 }} />}
                      onClick={() => { navigator.clipboard.writeText(customerBoardDisplayUrl); setCopiedCustomer(true); setTimeout(() => setCopiedCustomer(false), 2000) }}
                      sx={{ mt: 1, borderColor: '#4ade80', color: '#4ade80', fontWeight: 700, fontSize: 11, textTransform: 'none', '&:hover': { borderColor: '#22c55e', bgcolor: '#14532d' } }}>
                      {copiedCustomer ? 'Copied!' : 'Copy link'}
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary">{t('shopOrder.grid.boardExpiry')}</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setBoardOpen(false)}>{t('shopOrder.grid.close')}</Button></DialogActions>
      </Dialog>
        <Dialog open={hoursDialogOpen} onClose={() => setHoursDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('shopOrder.grid.openingHours')}</DialogTitle>
          <DialogContent dividers>
            {shiftsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : (
                DAY_LABELS.map(day => (
                    <Box key={day.value} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography fontWeight={700} fontSize={14}>{day.label}</Typography>
                        <Button size="small" onClick={() => addShift(day.value)} sx={{ textTransform: 'none' }}>
                          + {t('shopOrder.grid.addShift')}
                        </Button>
                      </Box>
                      {shifts.filter(s => s.dayOfWeek === day.value).length === 0 && (
                          <Typography variant="caption" color="text.secondary">{t('shopOrder.grid.noShifts')}</Typography>
                      )}
                      {shifts.filter(s => s.dayOfWeek === day.value).map(s => (
                          <Box key={s._key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <TextField size="small" label={t('shopOrder.grid.shiftLabel')} value={s.label || ''}
                                       onChange={e => updateShift(s._key, 'label', e.target.value)} sx={{ width: 110 }} />
                            <TextField size="small" type="time" value={s.startTime}
                                       onChange={e => updateShift(s._key, 'startTime', e.target.value)} />
                            <Typography>–</Typography>
                            <TextField size="small" type="time" value={s.endTime}
                                       onChange={e => updateShift(s._key, 'endTime', e.target.value)} />
                            <IconButton size="small" color="error" onClick={() => removeShift(s._key)}><DeleteIcon fontSize="small" /></IconButton>
                          </Box>
                      ))}
                    </Box>
                ))
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHoursDialogOpen(false)}>{t('shopOrder.grid.close')}</Button>
            <Button variant="contained" onClick={saveShifts} disabled={shiftsSaving || shiftsLoading}>
              {shiftsSaving ? <CircularProgress size={18} /> : t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={closeConfirmOpen} onClose={() => setCloseConfirmOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{t('shopOrder.grid.closeToday')}</DialogTitle>
          <DialogContent>
            <Typography>{t('shopOrder.grid.confirmCloseToday')}</Typography>
            <Typography sx={{ mt: 1.5, fontWeight: 700 }}>
              {closePreview
                  ? `${t('shopOrder.grid.reopensAt')}: ${new Date(closePreview).toLocaleString('vi-VN')}`
                  : t('shopOrder.grid.noReopenTime')}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCloseConfirmOpen(false)}>{t('common.back')}</Button>
            <Button variant="contained" color="error" onClick={confirmCloseToday}>{t('shopOrder.grid.closeToday')}</Button>
          </DialogActions>
        </Dialog>

      {/* Payment QR dialog — generate VietQR (qr_only, no logo in center) for any unpaid order */}
      {payQrOrder && (() => {
        const cfg = bankConfig
        const payAmount = payableAmount(payQrOrder)
        const qrUrl = cfg?.bankBin && cfg?.bankAccountNumber
          ? `https://img.vietqr.io/image/${cfg.bankBin}-${cfg.bankAccountNumber}-qr_only.png`
            + `?amount=${Math.round(payAmount)}`
            + `&addInfo=${encodeURIComponent(payQrOrder.orderCode || '')}`
            + `&accountName=${encodeURIComponent(cfg.bankAccountName || '')}`
          : null
        return (
          <Dialog open onClose={() => setPayQrOrder(null)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode2Icon color="primary" />
                <Typography fontWeight={700}>{t('shopOrder.grid.paymentQr')}</Typography>
              </Box>
              <IconButton size="small" onClick={() => setPayQrOrder(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              {qrUrl ? (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#15803d" sx={{ mb: 1 }}>
                    {t('shopOrder.grid.scanToPayVietQr')}
                  </Typography>
                  <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '2px solid #e3f2fd', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                    <img src={qrUrl} alt="VietQR payment"
                      style={{ width: 200, height: 200, display: 'block', borderRadius: 6 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={900} color="primary" sx={{ mt: 1.25 }}>
                    {fmt(payAmount)}
                  </Typography>
                  {payQrOrder.orderNumber && (
                    <Typography variant="body2" fontWeight={700} color="text.secondary">
                      {t('shopOrder.grid.orderNumber', { number: payQrOrder.orderNumber })}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    ref: {payQrOrder.orderCode}
                  </Typography>
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  {t('shopOrder.grid.noBankConfig')}
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2 }}>
              <Button onClick={() => setPayQrOrder(null)} sx={{ textTransform: 'none' }}>{t('shopOrder.grid.close')}</Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Move to Table dialog */}
      <Dialog open={moveTableOpen} onClose={() => setMoveTableOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{t('shopOrder.grid.moveOrders', { count: selectedRows.size })}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('shopOrder.grid.moveTableHelp')}
          </Typography>
          <TextField select label="Target table" size="small" fullWidth
            value={moveTableTarget}
            onChange={e => setMoveTableTarget(e.target.value)}>
            <MenuItem value=""><em>{t('shopOrder.grid.noTable')}</em></MenuItem>
            {tables.map(t => <MenuItem key={t.id} value={t.id}>{t.tableName}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveTableOpen(false)} disabled={moving}>{t('shopOrder.edit.cancel')}</Button>
          <Button onClick={handleMoveTable} variant="contained" color="info" disabled={moving}
            startIcon={moving ? <CircularProgress size={14} /> : <DriveFileMoveIcon />}>
            {moving ? 'Moving…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {confirmDlg && (
        <ConfirmActionDialog
          open
          title={confirmDlg.title}
          message={confirmDlg.message}
          confirmLabel={confirmDlg.confirmLabel}
          confirmColor={confirmDlg.confirmColor}
          requireReason={confirmDlg.requireReason}
          reasonLabel={confirmDlg.reasonLabel}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}

      {/* Pickup QR dialog */}
      {pickupQrOrder && (() => {
        const { orderNumber, orderCode, qrBase64 } = pickupQrOrder
        const origin = window.location.origin + '/bom-inventory'
        const pickupUrl = `${origin}/shop/pickup/${orderCode}` + (ctxTenantId && ctxCompanyId ? `?tenantId=${ctxTenantId}&companyId=${ctxCompanyId}` : '')
        return (
          <Dialog open onClose={() => setPickupQrOrder(null)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 800 }}>
              {t('shopOrder.grid.pickupQrTitle', { order: orderNumber ?? orderCode })}
            </DialogTitle>
            <DialogContent sx={{ textAlign: 'center', pb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('shopOrder.grid.pickupQrHelp')}
              </Typography>
              {qrBase64 && (
                <Box sx={{ bgcolor: '#fff', display: 'inline-block', p: 1, borderRadius: 2, border: '2px solid #e0e0e0', mb: 2 }}>
                  <img src={`data:image/png;base64,${qrBase64}`} alt={t('shopOrder.grid.pickupQr')} style={{ width: 220, height: 220, display: 'block' }} />
                </Box>
              )}
              <TextField
                value={pickupUrl}
                size="small" fullWidth
                inputProps={{ readOnly: true, style: { fontSize: 11 } }}
                onClick={e => e.target.select()}
                sx={{ mb: 1 }}
              />
              <Button variant="outlined" size="small" onClick={() => navigator.clipboard.writeText(pickupUrl)} startIcon={<ContentCopyIcon />}>
                {t('shopOrder.grid.copyLink')}
              </Button>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPickupQrOrder(null)}>{t('shopOrder.grid.close')}</Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      {/* Tracking QR dialog — show QR to customer (view only, includes session token) */}
      {trackQrOrder && (() => {
        const { order, qrBase64, loading } = trackQrOrder
        const origin = window.location.origin + '/bom-inventory'
        const trackUrl = order.sourceToken
          ? `${origin}/shop/order/${order.orderCode}?t=${encodeURIComponent(order.sourceToken)}`
          : `${origin}/shop/order/${order.orderCode}`
        return (
          <Dialog open onClose={() => setTrackQrOrder(null)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode2Icon sx={{ color: '#0288d1' }} />
                <Typography fontWeight={800} variant="h6">{t('shopOrder.grid.trackOrder')}</Typography>
              </Box>
              <IconButton size="small" onClick={() => setTrackQrOrder(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0, textAlign: 'center' }}>
              {order.orderNumber != null && (
                <Typography sx={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: '#0288d1', letterSpacing: -2, mb: 0.5 }}>
                  #{order.orderNumber}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Customer scans to track order · view only
              </Typography>
              {loading ? (
                <Box sx={{ py: 4 }}><CircularProgress /></Box>
              ) : qrBase64 ? (
                <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '2px solid #e1f5fe', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', mb: 1.5 }}>
                  <img src={`data:image/png;base64,${qrBase64}`} alt="Tracking QR"
                    style={{ width: 220, height: 220, display: 'block' }} />
                </Box>
              ) : (
                <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{t('shopOrder.grid.trackingQrFailed')}</Alert>
              )}
              <TextField
                value={trackUrl}
                size="small" fullWidth
                inputProps={{ readOnly: true, style: { fontSize: 11 } }}
                onClick={e => e.target.select()}
                sx={{ mt: 1 }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2, pt: 0.5, gap: 1 }}>
              <Button onClick={() => setTrackQrOrder(null)} sx={{ textTransform: 'none' }}>{t('shopOrder.grid.close')}</Button>
              <Button
                variant="contained" startIcon={<PrintIcon />}
                onClick={() => printOrderTagTracked(order, qrBase64)}
                disabled={!qrBase64 || loading}
                sx={{ fontWeight: 700, textTransform: 'none', flex: 1, bgcolor: '#0288d1', '&:hover': { bgcolor: '#0277bd' } }}>
                Print QR Note
              </Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{t('shopOrder.grid.resetCounter')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Next new order will be <strong>#{Number(resetTo) + 1}</strong>.
          </Typography>
          <TextField label="Reset counter to" type="number" size="small" fullWidth value={resetTo}
            onChange={e => setResetTo(e.target.value)} inputProps={{ min: 0 }} helperText="Use 0 to restart from #1" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetting}>{t('shopOrder.edit.cancel')}</Button>
          <Button onClick={handleReset} variant="contained" color="warning" disabled={resetting}>
            {resetting ? 'Resetting…' : `Reset to ${resetTo}`}
          </Button>
        </DialogActions>
      </Dialog>

      {combinedToken && (
        <CombinedReceiptDialog
          token={combinedToken}
          orderRangeParams={orderRangeParams}
          modelMetaMap={modelMetaMap}
          onClose={() => setCombinedToken(null)}
          onRefresh={reload}
        />
      )}
      </Box>
    </Box>
  )
}

// ── Combined Receipt Dialog ──────────────────────────────────────────
function CombinedReceiptDialog({ token, orderRangeParams = {}, modelMetaMap = {}, onClose, onRefresh }) {
  const { t, language } = useI18n()
  const [orders, setOrders]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [paying, setPaying]       = useState(false)
  const [switching, setSwitching] = useState(false)  // 'toQr' | 'toCash' | false
  const [bankConfig, setBankConfig] = useState(null)
  const [sessionLocked, setSessionLocked] = useState(false)
  const [lockError, setLockError] = useState('')
  const [closing, setClosing] = useState(false)
  const [cancelTarget, setCancelTarget] = useState(null)

  const fmtAmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'

  const reload = () => {
    setLoading(true)
    fetchOrdersByToken(token, orderRangeParams)
        .then(({ res, data }) => {
          if (!res.ok) { setError(data?.error || t('shopOrder.grid.slipLoadFailed')); return }
          setOrders(Array.isArray(data) ? data : [])
        })
        .catch(() => setError(t('shopOrder.grid.slipReloadFailed')))
        .finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [token, orderRangeParams])
  useEffect(() => {
    let active = true
    setSessionLocked(false)
    setLockError('')
    lockTokenSession(token)
      .then(({ res, data }) => {
        if (!active) return
        if (res.ok) setSessionLocked(true)
        else setLockError(data?.message || data?.error || t('shopOrder.grid.slipSessionLockFailed'))
      })
      .catch(() => { if (active) setLockError(t('shopOrder.grid.slipSessionLockFailed')) })
    return () => {
      active = false
      unlockTokenSession(token).catch(() => {})
    }
  }, [token])

  useEffect(() => {
    fetchBankConfig().then(({ data }) => setBankConfig(data || {})).catch(() => {})
  }, [])

  const activeOrders  = orders.filter(o => o.status !== 'CANCELLED')
  const cancelledOrders = orders.filter(o => o.status === 'CANCELLED')
  const unpaidOrders  = activeOrders.filter(o => o.paymentStatus !== 'PAID')
  const switchableToQr = activeOrders.filter(o =>
    o.paymentStatus !== 'PAID' && o.paymentMethod === 'CASH' &&
    !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(o.status)
  )
  const switchableToCash = activeOrders.filter(o =>
    o.paymentStatus !== 'PAID' &&
    (o.paymentMethod === 'BANK_QR' || o.paymentMethod === 'SPLIT') &&
    !['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(o.status)
  )
  const grandTotal    = activeOrders.reduce((s, o) => s + payableAmount(o), 0)
  const unpaidTotal   = unpaidOrders.reduce((s, o) => s + payableAmount(o), 0)
  const totalItems    = activeOrders.reduce((s, o) => s + orderItemQuantity(o), 0)
  const slipNumber    = groupSlipNumber(token)
  const categorySummary = useMemo(() => {
    const groups = new Map()
    activeOrders.forEach(order => {
      rootOrderItems(order).forEach(item => {
        const category = itemCategoryLabel(item, modelMetaMap, language, t('shopOrder.grid.uncategorized'))
        const group = groups.get(category) || { category, quantity: 0, total: 0, items: new Map() }
        const qty = Number(item.quantity || 0)
        const lineTotal = Number(item.lineTotal || 0)
        group.quantity += qty
        group.total += lineTotal
        const name = localizedModelName(item, language) || item.modelName || '-'
        const itemSummary = group.items.get(name) || { name, quantity: 0, total: 0, orders: new Set() }
        itemSummary.quantity += qty
        itemSummary.total += lineTotal
        itemSummary.orders.add(order.orderNumber ?? order.orderCode)
        group.items.set(name, itemSummary)
        groups.set(category, group)
      })
    })
    return Array.from(groups.values())
      .map(group => ({ ...group, items: Array.from(group.items.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)) }))
      .sort((a, b) => b.quantity - a.quantity || a.category.localeCompare(b.category))
  }, [activeOrders, language, modelMetaMap, t])

  // After switching to QR, show the combined QR for the unpaid total
  const anyQrPay = activeOrders.some(o =>
    o.paymentMethod === 'BANK_QR' || o.paymentMethod === 'SPLIT'
  )
  const payQrUrl = bankConfig?.bankBin && bankConfig?.bankAccountNumber && anyQrPay
    ? `https://img.vietqr.io/image/${bankConfig.bankBin}-${bankConfig.bankAccountNumber}-qr_only.png`
      + `?amount=${Math.round(unpaidTotal)}`
      + `&addInfo=${encodeURIComponent(
          slipNumber
              ? `PHIEU ${slipNumber} ${token?.substring(0, 12) || ''}`
              : (token?.substring(0, 12) || 'combined')
      )}`
      + `&accountName=${encodeURIComponent(bankConfig.bankAccountName || '')}`
    : null

  const handleClose = async () => {
    if (closing) return
    setClosing(true)
    try { await unlockTokenSession(token) } catch { /* unlock is best-effort */ }
    setClosing(false)
    onClose()
  }
  const handleMarkAllPaid = async () => {
    if (!unpaidOrders.length) return
    setPaying(true)
    try {
      for (const o of unpaidOrders) await markOrderPaid(o.id)
      onRefresh(); await handleClose(); return
    } catch { setError(t('shopOrder.grid.markOrdersPaidFailed')) }
    setPaying(false)
  }

  const handleSwitchAllToQr = async () => {
    if (!switchableToQr.length) return
    setSwitching('toQr')
    try {
      for (const o of switchableToQr) {
        const { res, data } = await switchToQrPayment(o.id)
        if (!res.ok) throw new Error(data?.message || t('shopOrder.grid.orderActionFailed', { order: o.orderNumber }))
      }
      reload()
      onRefresh()
    } catch (e) { setError(e.message || t('shopOrder.grid.switchToQrFailed')) }
    setSwitching(false)
  }

  const handleSwitchAllToCash = async () => {
    if (!switchableToCash.length) return
    setSwitching('toCash')
    try {
      for (const o of switchableToCash) {
        const { res, data } = await revertToCash(o.id)
        if (!res.ok) throw new Error(data?.message || t('shopOrder.grid.orderActionFailed', { order: o.orderNumber }))
      }
      reload()
      onRefresh()
    } catch (e) { setError(e.message || t('shopOrder.grid.switchToCashFailed')) }
    setSwitching(false)
  }

  const handlePrintWithQr = () => {
    printCombinedReceiptTracked(orders, {
      payQrUrl,
      unpaidTotal,
      tokenRef: token?.substring(0, 12) || 'combined',
    })
  }

  const handleCancelSlipOrder = async (reason) => {
    if (!cancelTarget?.id) return
    try {
      const { res, data } = await cancelShopOrder(cancelTarget.id, reason)
      if (!res.ok) throw new Error(data?.message || data?.error || t('shopOrder.grid.cancelSlipOrderFailed'))
      if (data?.id) setOrders(prev => replaceOrderInList(prev, data, true))
      else reload()
      onRefresh?.()
      setCancelTarget(null)
    } catch (e) {
      setError(e.message || t('shopOrder.grid.cancelSlipOrderFailed'))
    }
  }

  const openTracking = (order) => {
    if (!order?.orderCode) return
    const base = `${window.location.origin}/bom-inventory/shop/order/${encodeURIComponent(order.orderCode)}`
    const query = token ? `?t=${encodeURIComponent(token)}` : ''
    window.open(base + query, '_blank')
  }

  const STATUS_CHIP = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }

  return (
    <>
    <Dialog open onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PeopleAltIcon color="secondary" />
          <Box>
            <Typography fontWeight={900}>{t('shopOrder.grid.paySlip')}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={800}>
              {t('shopOrder.grid.slipNumber', { number: slipNumber })}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={closing}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
        {sessionLocked && <Alert severity="info" sx={{ mb: 2 }}>{t('shopOrder.grid.receiptPaused')}</Alert>}
        {lockError && <Alert severity="warning" sx={{ mb: 2 }}>{lockError}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!loading && (!error || orders.length > 0) && (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' }, gap: 1, mb: 2 }}>
              {[
                { label: t('shopOrder.grid.totalOrders'), value: orders.length },
                { label: t('shopOrder.grid.activeOrders'), value: activeOrders.length },
                { label: t('shopOrder.grid.cancelledOrders'), value: cancelledOrders.length },
                { label: t('shopOrder.grid.totalItems'), value: totalItems },
                { label: t('shopOrder.grid.totalAmount'), value: fmtAmt(grandTotal), wide: true },
              ].map(stat => (
                <Box key={stat.label} sx={{
                  p: 1,
                  minHeight: 62,
                  border: '1px solid #e2e8f0',
                  borderRadius: 1.5,
                  bgcolor: '#f8fafc',
                  gridColumn: { xs: stat.wide ? 'span 2' : 'auto', sm: 'auto' },
                }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={900}>{stat.label}</Typography>
                  <Typography fontWeight={900} sx={{ fontSize: stat.wide ? 17 : 20, lineHeight: 1.15 }}>{stat.value}</Typography>
                </Box>
              ))}
            </Box>

            {/* Payment method switch bar */}
            {(switchableToQr.length > 0 || switchableToCash.length > 0) && (
              <Box sx={{ display: 'flex', gap: 1, mb: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                {switchableToQr.length > 0 && (
                  <Button size="small" variant="outlined" color="success" fullWidth
                    startIcon={switching === 'toQr' ? <CircularProgress size={14} color="inherit" /> : <QrCode2Icon sx={{ fontSize: 14 }} />}
                    onClick={handleSwitchAllToQr}
                    disabled={!!switching}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                    {t('shopOrder.grid.switchToQrCount', { count: switchableToQr.length })}
                  </Button>
                )}
                {switchableToCash.length > 0 && (
                  <Button size="small" variant="outlined" color="warning" fullWidth
                    startIcon={switching === 'toCash' ? <CircularProgress size={14} color="inherit" /> : null}
                    onClick={handleSwitchAllToCash}
                    disabled={!!switching}
                    sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>
                    {t('shopOrder.grid.switchToCashCount', { count: switchableToCash.length })}
                  </Button>
                )}
              </Box>
            )}

            {categorySummary.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography fontWeight={900} sx={{ mb: 1 }}>{t('shopOrder.grid.categorySummary')}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                  {categorySummary.map(group => (
                    <Box key={group.category} sx={{ p: 1.25, border: '1px solid #dbeafe', borderRadius: 1.5, bgcolor: '#f8fbff' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Typography fontWeight={900} sx={{ flex: 1, minWidth: 0 }}>{group.category}</Typography>
                        <Chip size="small" color="primary" label={t('shopOrder.grid.orderItemsCount', { count: group.quantity })} sx={{ fontWeight: 800 }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={900}>{fmtAmt(group.total)}</Typography>
                      <Stack spacing={0.35} sx={{ mt: 0.75 }}>
                        {group.items.slice(0, 6).map(item => (
                          <Box key={item.name} sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                            <Typography fontWeight={900} color="primary" sx={{ minWidth: 34 }}>{item.quantity}×</Typography>
                            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>{item.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{fmtAmt(item.total)}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Order list */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {orders.map((order) => {
                const num         = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
                const roots       = (order.items || []).filter(i => !i.parentItemId)
                const isCancelled = order.status === 'CANCELLED'
                const isQr        = order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT'
                const itemCount   = orderItemQuantity(order)
                return (
                  <Box key={order.id} sx={{
                    border: `1px solid ${isQr && !isCancelled ? '#bbf7d0' : '#e2e8f0'}`,
                    borderRadius: 1.5,
                    opacity: isCancelled ? 0.5 : 1,
                    bgcolor: isCancelled ? '#fafafa' : isQr ? '#f0fdf4' : '#fff',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
                      bgcolor: isCancelled ? '#f5f5f5' : isQr ? '#dcfce7' : '#f8fafc',
                      borderRadius: '6px 6px 0 0' }}>
                      <Typography fontWeight={900} sx={{ fontSize: 18, minWidth: 34,
                        textDecoration: isCancelled ? 'line-through' : 'none', color: '#334155' }}>
                        {num}
                      </Typography>
                      <Chip label={localizedStatusLabel(order.status, t)} color={STATUS_CHIP[order.status] || 'default'}
                        size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                      {order.tableName && (
                        <Chip label={t('shopOrder.common.tableValue', { value: order.tableName })} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                      )}
                      <Chip label={t('shopOrder.grid.orderItemsCount', { count: itemCount })} size="small" variant="outlined" sx={{ fontSize: 10, fontWeight: 800 }} />
                      {isQr && !isCancelled && (
                        <Chip label="💳 QR" size="small" color="success" sx={{ fontWeight: 800, fontSize: 10 }} />
                      )}
                      <Box sx={{ flex: 1 }} />
                      {!isCancelled && (
                        <>
                          <Button size="small" variant="text" onClick={() => openTracking(order)}
                            sx={{ textTransform: 'none', fontWeight: 800, minWidth: 0, px: 0.75 }}>
                            {t('shopOrder.grid.trackOrder')}
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => setCancelTarget(order)}
                            sx={{ textTransform: 'none', fontWeight: 800, minWidth: 0, px: 0.75 }}>
                            {t('shopOrder.grid.cancelSlipOrder')}
                          </Button>
                        </>
                      )}
                      {isCancelled && (
                        <Chip label={t('shopOrder.grid.cancelledMarked')} color="error" size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: 10 }} />
                      )}
                      <Typography fontWeight={800} color={isCancelled ? 'text.disabled' : 'primary'}
                        sx={{ textDecoration: isCancelled ? 'line-through' : 'none' }}>
                        {fmtAmt(payableAmount(order))}
                      </Typography>
                      {order.paymentStatus === 'PAID' && (
                        <Chip label={t('shopOrder.status.paid')} color="success" size="small" sx={{ fontWeight: 700, fontSize: 10 }} />
                      )}
                    </Box>
                    <Box sx={{ px: 2, py: 0.75 }}>
                      {roots.slice(0, 4).map(item => (
                        <Typography key={item.id} variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                          {item.quantity}× {localizedModelName(item, language) || item.modelName}{item.dailyLastOrder ? ` [${t('shopOrder.grid.dailyLastOrder')}]` : ''}
                        </Typography>
                      ))}
                      {roots.length > 4 && (
                        <Typography variant="caption" color="text.secondary">{t('shopOrder.grid.moreItemsCount', { count: roots.length - 4 })}</Typography>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* QR Pay panel — shown when any active order is on QR pay */}
            {payQrUrl && (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, p: 1.5, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                <Box sx={{ bgcolor: '#fff', borderRadius: 1.5, p: 0.75, border: '2px solid #4ade80', flexShrink: 0 }}>
                  <img src={payQrUrl} alt={t('shopOrder.grid.qrPayment')} style={{ width: 100, height: 100, display: 'block' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: '#15803d', fontSize: 13 }}>💳 {t('shopOrder.grid.qrPayment')}</Typography>
                  <Typography sx={{ fontWeight: 900, color: '#15803d', fontSize: 20, lineHeight: 1.2 }}>
                    {fmtAmt(unpaidTotal)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{t('shopOrder.grid.unpaidScan')}</Typography>
                </Box>
              </Box>
            )}

            {/* Grand total */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {t('shopOrder.grid.activeOrders')}: {activeOrders.length}
                {cancelledOrders.length ? ` · ${t('shopOrder.grid.cancelledOrders')}: ${cancelledOrders.length}` : ''}
              </Typography>
              <Typography fontWeight={900} sx={{ fontSize: 20 }} color="primary">
                {fmtAmt(grandTotal)}
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Button onClick={handleClose} disabled={closing} sx={{ textTransform: 'none' }}>{closing ? t('shopOrder.grid.closing') : t('common.close')}</Button>
        <Button variant="outlined" startIcon={<PrintIcon />}
          onClick={() => printCombinedReceiptTracked(orders)}
          disabled={loading || !orders.length}
          sx={{ textTransform: 'none', fontWeight: 700 }}>
          {t('common.print')}
        </Button>
        {/* Print receipt + QR together — only when there's a QR pay URL */}
        {payQrUrl && (
          <Button variant="outlined" color="success"
            startIcon={<PrintIcon />}
            onClick={handlePrintWithQr}
            disabled={loading || !orders.length}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('shopOrder.grid.printPlusQr')}
          </Button>
        )}
        {unpaidOrders.length > 0 && (
          <Button variant="contained" color="success"
            startIcon={paying ? <CircularProgress size={16} color="inherit" /> : <PaidIcon />}
            onClick={handleMarkAllPaid} disabled={paying}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('shopOrder.grid.markAllPaid', { count: unpaidOrders.length })}
          </Button>
        )}
      </DialogActions>
    </Dialog>
    <ConfirmActionDialog
      open={Boolean(cancelTarget)}
      title={t('shopOrder.grid.cancelSlipOrderTitle', { order: cancelTarget?.orderNumber ?? cancelTarget?.orderCode ?? '' })}
      message={t('shopOrder.grid.cancelSlipOrderMessage')}
      confirmLabel={t('shopOrder.confirm.cancelLabel')}
      confirmColor="error"
      requireReason
      reasonLabel={t('shopOrder.confirm.reasonLabel')}
      onConfirm={handleCancelSlipOrder}
      onCancel={() => setCancelTarget(null)}
    />
    </>
  )
}
