import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
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
import VisibilityIcon from '@mui/icons-material/Visibility'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import TableBarIcon from '@mui/icons-material/TableBar'
import TvIcon from '@mui/icons-material/Tv'
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
import LabelIcon from '@mui/icons-material/Label'
import PaidIcon from '@mui/icons-material/Paid'
import {
  fetchShopOrders, fetchActiveOrders, confirmShopOrder, prepareShopOrder, readyShopOrder,
  completeShopOrder, cancelShopOrder, resetOrderSequence, setShopOrderNumber,
  generateDisplayBoardToken, pickupShopOrder, revertShopOrder, markOrderPaid, fetchBankConfig
} from '../../api/shopApi'
import { printCupLabels } from '../../utils/printOrderReceipt'
import ShopOrderDetailModal from './ShopOrderDetailModal'
import ManualOrderDialog from './ManualOrderDialog'
import QrOrderDialog from './QrOrderDialog'

const BOARD_CHANNEL = 'shop_display_board'
function broadcastReady() {
  try { new BroadcastChannel(BOARD_CHANNEL).postMessage({ type: 'ORDER_READY' }) } catch { /* */ }
}

const STATUS_COLOR  = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }
const STATUS_LABEL  = { PENDING: 'Placed', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready ✓', PICKED_UP: 'Picked Up ✓', COMPLETED: 'Done', CANCELLED: 'Cancelled' }
const STATUSES      = ['', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'PICKED_UP', 'COMPLETED', 'CANCELLED']
const fmt           = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const dateFmt       = (v) => v ? new Date(v).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(v).toLocaleDateString('vi-VN') : ''
const elapsed       = (v) => {
  if (!v) return ''
  const m = Math.floor((Date.now() - new Date(v)) / 60000)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

// ── Stock panel ─────────────────────────────────────────────────────

function StockPanel({ items, onUseInOrder, onClear }) {
  const [queued, setQueued]     = useState([])
  const [dragOver, setDragOver] = useState(false)

  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    try {
      const item = JSON.parse(e.dataTransfer.getData('application/json'))
      setQueued(prev => {
        const ex = prev.find(i => i.modelId === item.modelId)
        if (ex) return prev.map(i => i.modelId === item.modelId ? { ...i, qty: i.qty + item.qty } : i)
        return [...prev, { ...item }]
      })
    } catch { /* */ }
  }

  const addToQueue = (item) => {
    setQueued(prev => {
      const ex = prev.find(i => i.modelId === item.modelId)
      if (ex) return prev.map(i => i.modelId === item.modelId ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const queuedTotal = queued.reduce((s, i) => s + i.qty * Number(i.sellingPrice || 0), 0)

  return (
    <Box sx={{ width: 220, flexShrink: 0, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#fffde7' }}>
      <Box sx={{ p: 1.25, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1, fontSize: 12 }}>Stock from Cancellations</Typography>
        <Tooltip title="Clear all">
          <IconButton size="small" onClick={onClear} sx={{ p: 0.25 }}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Available (drag or click +)
        </Typography>
        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
          {items.map((item, idx) => (
            <Box key={`${item.modelId}-${idx}`} draggable onDragStart={e => handleDragStart(e, item)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#fff', borderRadius: 1, px: 0.75, py: 0.5, border: '1px solid #e0e0e0', cursor: 'grab', '&:hover': { bgcolor: '#fff9c4', borderColor: '#f9a825' } }}>
              <DragIndicatorIcon sx={{ fontSize: 14, color: '#bdbdbd', flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" fontWeight={600} noWrap display="block">{item.modelName}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{item.qty > 1 ? `×${item.qty} ` : ''}{fmt(item.sellingPrice)}</Typography>
              </Box>
              <Tooltip title="Add to new order">
                <IconButton size="small" onClick={() => addToQueue(item)} sx={{ p: 0.25, color: '#1976d2', flexShrink: 0 }}>
                  <AddShoppingCartIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Stack>
      </Box>
      <Box sx={{ borderTop: '1px solid #e0e0e0', p: 1 }}>
        <Box onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
          sx={{ border: `2px dashed ${dragOver ? '#1976d2' : '#bbb'}`, borderRadius: 1.5, p: 1, textAlign: 'center', transition: 'all 0.15s', bgcolor: dragOver ? '#e3f2fd' : 'transparent', mb: queued.length ? 1 : 0 }}>
          <Typography variant="caption" color={dragOver ? 'primary' : 'text.disabled'} sx={{ fontSize: 11 }}>
            {dragOver ? '↓ Drop here' : 'Drop items for new order'}
          </Typography>
        </Box>
        {queued.length > 0 && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Queued ({queued.length})
            </Typography>
            <Stack spacing={0.25} sx={{ mt: 0.25, mb: 0.75 }}>
              {queued.map(i => (
                <Box key={i.modelId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ flex: 1 }} noWrap>{i.qty}× {i.modelName}</Typography>
                  <IconButton size="small" onClick={() => setQueued(prev => prev.filter(x => x.modelId !== i.modelId))} sx={{ p: 0.125 }}>
                    <CloseIcon sx={{ fontSize: 12, color: '#bbb' }} />
                  </IconButton>
                </Box>
              ))}
              <Typography variant="caption" color="primary" fontWeight={700} sx={{ fontSize: 11 }}>{fmt(queuedTotal)}</Typography>
            </Stack>
            <Button variant="contained" size="small" fullWidth startIcon={<AddCircleOutlineIcon />}
              onClick={() => { onUseInOrder(queued); setQueued([]) }}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: 11 }}>
              Create Order
            </Button>
          </>
        )}
      </Box>
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

function StatusBoard({ status, orders, onAction, onDetail, onPayQr }) {
  const style = BOARD_STYLE[status] || BOARD_STYLE.CONFIRMED

  if (!orders.length) {
    const icons = { CONFIRMED: <KitchenIcon sx={{ fontSize: 44, opacity: 0.18 }} />, PREPARING: <HourglassTopIcon sx={{ fontSize: 44, opacity: 0.18 }} />, READY: <CheckCircleIcon sx={{ fontSize: 44, opacity: 0.18 }} />, PICKED_UP: <LocalShippingIcon sx={{ fontSize: 44, opacity: 0.18 }} /> }
    return (
      <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
        {icons[status]}
        <Typography variant="body2" sx={{ mt: 1 }}>No {status.toLowerCase().replace('_', ' ')} orders</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1.5, p: 1.5 }}>
      {orders.map(order => {
        const since = elapsed(order.confirmedAt || order.createdAt)
        return (
          <Card key={order.id} elevation={2} sx={{
            borderRadius: 2, border: `2px solid ${style.border}`, bgcolor: style.cardBg,
            animation: style.animate ? 'pulse 3s ease-in-out infinite' : 'none',
            '@keyframes pulse': { '0%,100%': { boxShadow: `0 0 0 0 ${style.border}22` }, '50%': { boxShadow: `0 0 0 6px ${style.border}22` } },
          }}>
            <CardContent sx={{ pb: '8px !important', pt: 1.5, px: 1.5 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.75 }}>
                <Box sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: style.numColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, flexShrink: 0, mr: 1 }}>
                  {order.orderNumber ?? '?'}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mb: 0.25 }}>
                    {order.tableName && <Chip icon={<TableBarIcon sx={{ fontSize: 12 }} />} label={order.tableName} size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                    {order.paymentStatus === 'PAID'
                      ? <Chip icon={<PaidIcon sx={{ fontSize: 12 }} />} label="PAID" size="small" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 800 }} />
                      : <Chip label="UNPAID" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
                    }
                  </Box>
                  {order.customerName && <Typography variant="caption" display="block" noWrap>{order.customerName}</Typography>}
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{since} ago</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <Tooltip title="Print cup labels">
                    <IconButton size="small" onClick={() => printCupLabels(order)} sx={{ p: 0.25, color: style.color }}>
                      <LabelIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                  {order.paymentStatus !== 'PAID' && (
                    <Tooltip title="Payment QR">
                      <IconButton size="small" onClick={() => onPayQr(order)} sx={{ p: 0.25, color: '#1565c0' }}>
                        <QrCode2Icon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="View detail">
                    <IconButton size="small" onClick={() => onDetail(order)} sx={{ p: 0.25 }}>
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              <Divider sx={{ mb: 0.75 }} />

              {/* Items */}
              <Stack spacing={0.2} sx={{ mb: 1, minHeight: 32 }}>
                {(order.items || []).map(item => {
                  const opts = parseOpts(item.selectedOptions)
                  const optStr = Object.entries(opts).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('+') : v}`).join(' · ')
                  return (
                    <Box key={item.id}>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: 13, color: style.color }}>
                        {Number(item.quantity)}× {item.modelName}
                      </Typography>
                      {optStr && <Typography variant="caption" sx={{ fontSize: 11, pl: 1.25, display: 'block', color: '#555' }}>{optStr}</Typography>}
                      {item.itemNotes && <Typography variant="caption" sx={{ fontSize: 11, pl: 1.25, fontStyle: 'italic', display: 'block', color: '#c62828', fontWeight: 700 }}>⚠ {item.itemNotes}</Typography>}
                    </Box>
                  )
                })}
              </Stack>

              {order.notes && <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, fontStyle: 'italic', display: 'block', mb: 0.75 }}>Note: {order.notes}</Typography>}

              {/* Action buttons per status */}
              <Stack spacing={0.5}>
                {order.paymentStatus !== 'PAID' && status !== 'PICKED_UP' && (
                  <Button size="small" variant="contained" color="success" fullWidth
                    startIcon={<PaidIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onAction('pay', order.id)}
                    sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#2e7d32', '&:hover': { bgcolor: '#1b5e20' } }}>
                    Mark as Paid
                  </Button>
                )}
                {status === 'CONFIRMED' && (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button size="small" variant="contained" color="warning" fullWidth onClick={() => onAction('prepare', order.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Start Preparing</Button>
                    <Tooltip title="Revert to Pending">
                      <Button size="small" variant="outlined" color="error" onClick={() => onAction('revert', order.id)} startIcon={<UndoIcon sx={{ fontSize: 13 }} />} sx={{ textTransform: 'none', fontSize: 11, minWidth: 76 }}>Revert</Button>
                    </Tooltip>
                  </Box>
                )}
                {status === 'PREPARING' && (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('ready', order.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Mark Ready ✓</Button>
                    <Tooltip title="Revert to Pending">
                      <Button size="small" variant="outlined" color="error" onClick={() => onAction('revert-from-preparing', order.id)} startIcon={<UndoIcon sx={{ fontSize: 13 }} />} sx={{ textTransform: 'none', fontSize: 11, minWidth: 76 }}>Revert</Button>
                    </Tooltip>
                  </Box>
                )}
                {status === 'READY' && (
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {order.paymentMethod === 'BANK_QR'
                      ? <Button size="small" variant="contained" color="info" fullWidth onClick={() => onAction('pickup', order.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Picked Up ✓</Button>
                      : <Button size="small" variant="contained" color="success" fullWidth onClick={() => onAction('complete', order.id)} sx={{ textTransform: 'none', fontWeight: 700, fontSize: 12 }}>Complete ✓</Button>
                    }
                  </Box>
                )}
                {status === 'PICKED_UP' && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11, textAlign: 'center', display: 'block' }}>
                    Picked up {order.completedAt ? dateFmt(order.completedAt) : ''}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        )
      })}
    </Box>
  )
}

// ── Main ShopOrderGrid ──────────────────────────────────────────────

export default function ShopOrderGrid() {
  const [rows, setRows]                 = useState([])
  const [boardRows, setBoardRows]       = useState([])   // for board tabs — unfiltered
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailOrder, setDetailOrder]   = useState(null)
  const [resetOpen, setResetOpen]       = useState(false)
  const [resetTo, setResetTo]           = useState(0)
  const [resetting, setResetting]       = useState(false)
  const [manualOpen, setManualOpen]     = useState(false)
  const [manualDefaults, setManualDefaults] = useState(null)
  const [qrOrderOpen, setQrOrderOpen]   = useState(false)
  const [boardOpen, setBoardOpen]       = useState(false)
  const [boardUrl, setBoardUrl]         = useState('')
  const [boardLoading, setBoardLoading] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [tab, setTab]                   = useState(0)
  const [stockItems, setStockItems]     = useState([])
  const [payQrOrder, setPayQrOrder]     = useState(null)
  const [bankConfig, setBankConfig]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchShopOrders(statusFilter || null)
      setRows(Array.isArray(data) ? data : [])
    } catch { setError('Failed to load orders') }
    setLoading(false)
  }, [statusFilter])

  const loadBoard = useCallback(async () => {
    try {
      const [activeRes, pickedRes] = await Promise.all([
        fetchActiveOrders(),
        fetchShopOrders('PICKED_UP'),
      ])
      const all = [
        ...(Array.isArray(activeRes.data) ? activeRes.data : []),
        ...(Array.isArray(pickedRes.data) ? pickedRes.data : []),
      ]
      setBoardRows(all)
    } catch { /* silent */ }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadBoard() }, [loadBoard])

  const reload = () => { load(); loadBoard() }

  // Derived per-status slices for board tabs
  const confirmedOrders = boardRows.filter(r => r.status === 'CONFIRMED')
  const preparingOrders = boardRows.filter(r => r.status === 'PREPARING')
  const readyOrders     = boardRows.filter(r => r.status === 'READY')
  const pickedUpOrders  = boardRows.filter(r => r.status === 'PICKED_UP')

  const act = async (fn, id) => {
    try { await fn(id); reload() } catch (e) { setError(e.message || 'Action failed') }
  }

  const handleBoardAction = async (type, id) => {
    const map = {
      'prepare':               prepareShopOrder,
      'revert':                revertShopOrder,
      'revert-from-preparing': revertShopOrder,
      'ready':                 (id) => readyShopOrder(id).then(r => { broadcastReady(); return r }),
      'complete':              completeShopOrder,
      'pickup':                pickupShopOrder,
      'pay':                   markOrderPaid,
    }
    const fn = map[type]
    if (!fn) return
    try { await fn(id); reload() } catch (e) { setError(e.message || 'Action failed') }
  }

  const handleCancel = async (row) => {
    try {
      await cancelShopOrder(row.id)
      if (row.items?.length) {
        const newStock = row.items.map(item => ({
          modelId: item.modelId, modelName: item.modelName,
          sellingPrice: item.unitPrice, qty: Number(item.quantity),
          selectedOptions: {}, itemNotes: '',
        }))
        setStockItems(prev => {
          const merged = [...prev]
          newStock.forEach(ns => {
            const ex = merged.find(s => s.modelId === ns.modelId)
            if (ex) ex.qty += ns.qty; else merged.push(ns)
          })
          return [...merged]
        })
      }
      reload()
    } catch (e) { setError(e.message || 'Failed to cancel') }
  }

  const handleOpenBoard = async () => {
    setBoardLoading(true); setBoardOpen(true)
    try {
      const { data } = await generateDisplayBoardToken()
      setBoardUrl(`${window.location.origin}/bom-inventory/shop/board?t=${data.token}`)
    } catch (e) { setError(e.message || 'Failed to generate board URL') }
    setBoardLoading(false)
  }

  const handleReset = async () => {
    setResetting(true)
    try { await resetOrderSequence(Number(resetTo)); setResetOpen(false); setResetTo(0) }
    catch (e) { setError(e.message || 'Reset failed') }
    setResetting(false)
  }

  const handlePayQr = async (order) => {
    let config = bankConfig
    if (!config) {
      try {
        const { data } = await fetchBankConfig()
        setBankConfig(data || {})
        config = data || {}
      } catch { setError('Failed to load bank config'); return }
    }
    setPayQrOrder(order)
  }

  const processRowUpdate = useCallback(async (newRow, oldRow) => {
    if (newRow.orderNumber === oldRow.orderNumber) return oldRow
    const num = parseInt(newRow.orderNumber, 10)
    if (isNaN(num) || num < 1) return oldRow
    try {
      const { data } = await setShopOrderNumber(newRow.id, num)
      return data ?? { ...newRow, orderNumber: num }
    } catch (e) { setError(e.message || 'Failed to update number'); return oldRow }
  }, [])

  const columns = [
    {
      field: 'orderNumber', headerName: '#', width: 64, editable: true, type: 'number', headerAlign: 'center', align: 'center',
      renderCell: ({ value }) => (
        <Tooltip title="Click to edit number">
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: value ? '#1976d2' : '#e0e0e0', color: value ? '#fff' : '#9e9e9e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            {value ?? '–'}
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'orderCode', headerName: 'Code', flex: 1, minWidth: 110,
      renderCell: ({ value }) => value ? <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>{value}</Typography> : null,
    },
    {
      field: 'tableName', headerName: 'Table', width: 90,
      renderCell: ({ value }) => value
        ? <Chip icon={<TableBarIcon sx={{ fontSize: 14 }} />} label={value} size="small" variant="outlined" color="info" />
        : <Typography variant="caption" color="text.disabled">—</Typography>
    },
    {
      field: 'status', headerName: 'Status', width: 115,
      renderCell: ({ value }) => <Chip label={STATUS_LABEL[value] || value} color={STATUS_COLOR[value] || 'default'} size="small" sx={{ fontWeight: 700, minWidth: 90 }} />
    },
    {
      field: 'fulfillmentType', headerName: 'Type', width: 80,
      renderCell: ({ value }) => { const map = { DINE_IN: '🪑 Dine', PICKUP: '🥡 Pick', DELIVERY: '🛵 Del' }; return <Typography variant="caption">{map[value] || value}</Typography> }
    },
    { field: 'customerName', headerName: 'Customer', width: 120, renderCell: ({ value }) => <Typography variant="body2" noWrap>{value || '—'}</Typography> },
    {
      field: 'notes', headerName: 'Notes', width: 130,
      renderCell: ({ value }) => value
        ? <Tooltip title={value}><Typography variant="caption" noWrap sx={{ maxWidth: 120, display: 'block' }}>{value}</Typography></Tooltip>
        : <Typography variant="caption" color="text.disabled">—</Typography>
    },
    { field: 'totalAmount', headerName: 'Total', width: 100, renderCell: ({ value }) => <Typography variant="body2" fontWeight={600} color="primary">{fmt(value)}</Typography> },
    {
      field: 'paymentStatus', headerName: 'Payment', width: 100,
      renderCell: ({ value }) => value === 'PAID'
        ? <Chip icon={<PaidIcon sx={{ fontSize: 14 }} />} label="PAID" size="small" color="success" sx={{ fontWeight: 800, fontSize: 12 }} />
        : <Chip label="UNPAID" size="small" color="warning" variant="outlined" sx={{ fontWeight: 700, fontSize: 12 }} />
    },
    { field: 'createdAt', headerName: 'Time', width: 130, renderCell: ({ value }) => dateFmt(value) },
    {
      field: 'actions', headerName: 'Actions', width: 360, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Tooltip title="Detail"><IconButton size="small" onClick={() => setDetailOrder(row)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print cup labels"><IconButton size="small" onClick={() => printCupLabels(row)}><LabelIcon fontSize="small" /></IconButton></Tooltip>
          {row.paymentStatus !== 'PAID' && row.status !== 'CANCELLED' && (
            <Tooltip title="Payment QR">
              <IconButton size="small" color="primary" onClick={() => handlePayQr(row)}><QrCode2Icon fontSize="small" /></IconButton>
            </Tooltip>
          )}
          {row.status === 'PENDING'   && <Button size="small" variant="outlined" onClick={() => act(confirmShopOrder, row.id)}>Confirm</Button>}
          {row.status === 'CONFIRMED' && <Button size="small" variant="outlined" color="warning" onClick={() => act(prepareShopOrder, row.id)}>Prepare</Button>}
          {row.status === 'CONFIRMED' && <Tooltip title="Revert to Pending"><Button size="small" variant="outlined" color="error" startIcon={<UndoIcon sx={{ fontSize: 13 }} />} onClick={() => act(revertShopOrder, row.id)}>Revert</Button></Tooltip>}
          {row.status === 'PREPARING' && <Button size="small" variant="outlined" color="success" onClick={async () => { await act(readyShopOrder, row.id); broadcastReady() }}>Ready</Button>}
          {row.status === 'READY' && row.paymentMethod === 'BANK_QR' && <Button size="small" variant="contained" color="info" onClick={() => act(pickupShopOrder, row.id)}>Picked Up</Button>}
          {row.status === 'READY' && row.paymentMethod !== 'BANK_QR' && <Button size="small" variant="contained" color="success" onClick={() => act(completeShopOrder, row.id)}>Complete</Button>}
          {row.paymentStatus !== 'PAID' && !['PICKED_UP','COMPLETED','CANCELLED'].includes(row.status) && (
            <Tooltip title="Mark as paid">
              <Button size="small" variant="outlined" color="success" startIcon={<PaidIcon sx={{ fontSize: 13 }} />} onClick={() => act(markOrderPaid, row.id)} sx={{ fontWeight: 700, minWidth: 0, px: 0.75 }}>Paid</Button>
            </Tooltip>
          )}
          {!['PICKED_UP','COMPLETED','CANCELLED'].includes(row.status) && <Button size="small" color="error" onClick={() => handleCancel(row)}>✕</Button>}
        </Box>
      )
    }
  ]

  const tabBadge = (label, count, color = 'primary') => (
    <Badge badgeContent={count || null} color={color} max={99}
      sx={{ '& .MuiBadge-badge': { right: -6, top: 4 } }}>
      <span style={{ paddingRight: count ? 10 : 0 }}>{label}</span>
    </Badge>
  )

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {stockItems.length > 0 && (
        <StockPanel items={stockItems} onUseInOrder={items => { setManualDefaults(items); setManualOpen(true) }} onClear={() => setStockItems([])} />
      )}

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <Box sx={{ px: 1.5, py: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
          <TextField select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="small" sx={{ width: 148 }}>
            {STATUSES.map(s => <MenuItem key={s} value={s}>{s ? (STATUS_LABEL[s] || s) : 'All'}</MenuItem>)}
          </TextField>
          <Button startIcon={<RefreshIcon />} onClick={reload} variant="outlined" size="small">Refresh</Button>
          <Button startIcon={<AddCircleOutlineIcon />} onClick={() => { setManualDefaults(null); setManualOpen(true) }}
            variant="contained" size="small" color="success" sx={{ textTransform: 'none', fontWeight: 700 }}>New Order</Button>
          <Button startIcon={<QrCode2Icon />} onClick={() => setQrOrderOpen(true)}
            variant="outlined" size="small" color="primary" sx={{ textTransform: 'none', fontWeight: 700 }}>QR Order</Button>
          <Box sx={{ flex: 1 }} />
          <Button startIcon={<TvIcon />} onClick={handleOpenBoard} variant="outlined" size="small" color="info">Display Board</Button>
          <Button startIcon={<RestartAltIcon />} onClick={() => setResetOpen(true)} variant="outlined" size="small" color="warning">Reset Counter</Button>
        </Box>

        {error && <Alert severity="error" onClose={() => setError('')} sx={{ mx: 1.5, mt: 0.5 }}>{error}</Alert>}

        {/* Tabs */}
        <Box sx={{ borderBottom: '1px solid #e0e0e0', px: 1.5, flexShrink: 0 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40 }}>
            <Tab label="Orders"                                                                           sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Production',  confirmedOrders.length, 'primary')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Processing',  preparingOrders.length, 'warning')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Ready',       readyOrders.length,     'success')}                      sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
            <Tab label={tabBadge('Picked Up',   pickedUpOrders.length,  'info')}                         sx={{ textTransform: 'none', fontWeight: 600, minHeight: 40, fontSize: 13 }} />
          </Tabs>
        </Box>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {tab === 0 && (
            <Box sx={{ height: '100%', p: 1.5, boxSizing: 'border-box' }}>
              <DataGrid rows={rows} columns={columns} loading={loading} getRowId={r => r.id}
                pageSizeOptions={[25, 50, 100]} density="compact"
                processRowUpdate={processRowUpdate} onProcessRowUpdateError={e => setError(e.message)}
                sx={{ height: '100%', '& .MuiDataGrid-cell--editable': { cursor: 'cell' }, '& .MuiDataGrid-row:hover': { bgcolor: '#f5f9ff' } }}
              />
            </Box>
          )}
          {tab === 1 && <StatusBoard status="CONFIRMED"  orders={confirmedOrders} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
          {tab === 2 && <StatusBoard status="PREPARING"  orders={preparingOrders} onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
          {tab === 3 && <StatusBoard status="READY"      orders={readyOrders}     onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
          {tab === 4 && <StatusBoard status="PICKED_UP"  orders={pickedUpOrders}  onAction={handleBoardAction} onDetail={setDetailOrder} onPayQr={handlePayQr} />}
        </Box>
      </Box>

      {/* Dialogs */}
      <ManualOrderDialog open={manualOpen} onClose={() => { setManualOpen(false); setManualDefaults(null) }} onCreated={reload} defaultItems={manualDefaults} />
      <QrOrderDialog open={qrOrderOpen} onClose={() => setQrOrderOpen(false)} />
      {detailOrder && (
        <ShopOrderDetailModal open order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={() => { reload(); setDetailOrder(null) }} />
      )}

      <Dialog open={boardOpen} onClose={() => setBoardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><TvIcon color="info" /> Display Board</DialogTitle>
        <DialogContent>
          {boardLoading ? <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box> : boardUrl ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Open on a TV or tablet. Shows in-progress and ready orders, auto-refreshes. Valid 24 hours.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField value={boardUrl} size="small" fullWidth inputProps={{ readOnly: true, style: { fontSize: 13 } }} onClick={e => e.target.select()} />
                <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
                  <IconButton onClick={() => { navigator.clipboard.writeText(boardUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }} color={copied ? 'success' : 'default'}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Button variant="text" size="small" sx={{ mt: 1 }} onClick={() => window.open(boardUrl, '_blank')}>Open in new tab →</Button>
            </>
          ) : null}
        </DialogContent>
        <DialogActions><Button onClick={() => setBoardOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      {/* Payment QR dialog — generate VietQR (qr_only, no logo in center) for any unpaid order */}
      {payQrOrder && (() => {
        const cfg = bankConfig
        const qrUrl = cfg?.bankBin && cfg?.bankAccountNumber
          ? `https://img.vietqr.io/image/${cfg.bankBin}-${cfg.bankAccountNumber}-qr_only.png`
            + `?amount=${Math.round(Number(payQrOrder.totalAmount || 0))}`
            + `&addInfo=${encodeURIComponent(payQrOrder.orderCode || '')}`
            + `&accountName=${encodeURIComponent(cfg.bankAccountName || '')}`
          : null
        return (
          <Dialog open onClose={() => setPayQrOrder(null)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <QrCode2Icon color="primary" />
                <Typography fontWeight={700}>Payment QR</Typography>
              </Box>
              <IconButton size="small" onClick={() => setPayQrOrder(null)}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
              {qrUrl ? (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#15803d" sx={{ mb: 1 }}>
                    Scan to Pay · VietQR
                  </Typography>
                  <Box sx={{ display: 'inline-block', p: 1.5, bgcolor: '#fff', borderRadius: 2, border: '2px solid #e3f2fd', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
                    <img src={qrUrl} alt="VietQR payment"
                      style={{ width: 200, height: 200, display: 'block', borderRadius: 6 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={900} color="primary" sx={{ mt: 1.25 }}>
                    {fmt(payQrOrder.totalAmount)}
                  </Typography>
                  {payQrOrder.orderNumber && (
                    <Typography variant="body2" fontWeight={700} color="text.secondary">
                      Order #{payQrOrder.orderNumber}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    ref: {payQrOrder.orderCode}
                  </Typography>
                </Box>
              ) : (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No bank account configured. Set it up in <strong>Bank Account Setup</strong> first.
                </Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2 }}>
              <Button onClick={() => setPayQrOrder(null)} sx={{ textTransform: 'none' }}>Close</Button>
            </DialogActions>
          </Dialog>
        )
      })()}

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Reset Order Counter</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Next new order will be <strong>#{Number(resetTo) + 1}</strong>.
          </Typography>
          <TextField label="Reset counter to" type="number" size="small" fullWidth value={resetTo}
            onChange={e => setResetTo(e.target.value)} inputProps={{ min: 0 }} helperText="Use 0 to restart from #1" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} disabled={resetting}>Cancel</Button>
          <Button onClick={handleReset} variant="contained" color="warning" disabled={resetting}>
            {resetting ? 'Resetting…' : `Reset to ${resetTo}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
