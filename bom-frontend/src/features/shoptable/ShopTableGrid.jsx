import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Autocomplete from '@mui/material/Autocomplete'
import useMediaQuery from '@mui/material/useMediaQuery'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PrintIcon from '@mui/icons-material/Print'
import TableBarIcon from '@mui/icons-material/TableBar'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import VisibilityIcon from '@mui/icons-material/Visibility'
import PushPinIcon from '@mui/icons-material/PushPin'
import {
  fetchShopTables, deleteShopTable, fetchTableQr, fetchTableOrders, fetchShopOrders,
  confirmShopOrder, completeShopOrder, markOrderPaid, resetOrderSequence,
  fetchShopTableDrawings, updateShopTableDrawing, setOrderTable, clearOrderTable
} from '../../api/shopApi'
import ShopTableEditModal from './ShopTableEditModal'
import ShopTableLayoutDesigner from './ShopTableLayoutDesigner'
import QuickTableOrderDialog from './QuickTableOrderDialog'
import ManualOrderDialog from '../shoporder/ManualOrderDialog'
import ShopOrderDetailModal from '../shoporder/ShopOrderDetailModal'
import { useAuth } from '../../context/useAuth'
import { useAppContext } from '../../context/AppContext'

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY'])
const STATUS_CHIP = {
  PENDING:   { label: 'Placed',    color: 'default' },
  CONFIRMED: { label: 'Confirmed', color: 'success' },
  PREPARING: { label: 'Preparing', color: 'warning' },
  READY:     { label: 'Ready',     color: 'info' },
  PICKED_UP: { label: 'Picked Up', color: 'success' },
  COMPLETED: { label: 'Completed', color: 'success' },
  CANCELLED: { label: 'Cancelled', color: 'error' },
}

const fmtMoney = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' VND' : '-'
const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '-'
const orderLabel = (order) => order?.orderNumber != null ? `#${order.orderNumber}` : order?.orderCode || '-'
const isActiveOrder = (order) => ACTIVE_STATUSES.has(order?.status)
const isCompletableOrder = (order) => order?.status === 'READY'
const makeSelectionModel = (ids = []) => ({ type: 'include', ids: new Set(ids) })
const normalizeSearch = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()

function currentShiftRange() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(part => [part.type, part.value]))
  let day = `${parts.year}-${parts.month}-${parts.day}`
  const hour = Number(parts.hour)
  let startHour = hour < 14 ? 6 : 14
  let endHour = hour < 14 ? 14 : 22
  if (hour < 6) {
    const previous = new Date(`${day}T12:00:00+07:00`)
    previous.setDate(previous.getDate() - 1)
    day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(previous)
    startHour = 14
    endHour = 22
  }
  return {
    from: `${day}T${String(startHour).padStart(2, '0')}:00:00+07:00`,
    to: `${day}T${String(endHour).padStart(2, '0')}:00:00+07:00`,
  }
}

function selectionIds(model) {
  if (Array.isArray(model)) return model
  if (model?.ids) return Array.from(model.ids)
  return []
}

function statusChip(status, size = 'small') {
  const chip = STATUS_CHIP[status] || { label: status || '-', color: 'default' }
  return <Chip label={chip.label} size={size} color={chip.color} sx={{ fontWeight: 700 }} />
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

function tableOrderBadge(order) {
  const mainItems = (order?.items || []).filter(item => !item.parentItemId)
  const item = mainItems.length === 1 ? mainItems[0] : null
  const itemLabel = item ? ` · ${Number(item.quantity || 1).toLocaleString('vi-VN')}× ${item.modelName || item.itemName || 'Món'}` : ''
  return `${orderLabel(order)}${itemLabel} · ${order.paymentStatus === 'PAID' ? 'Đã trả' : 'Chưa trả'}`
}

export default function ShopTableGrid() {
  const { hasFullBusinessAccess } = useAuth()
  const { tenantId, companyId } = useAppContext()
  const pinStorageKey = `shop.tables.pinned:${tenantId || 'all'}:${companyId || 'all'}`
  const [rows, setRows]                   = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [editTable, setEditTable]         = useState(null)
  const [qrDialog, setQrDialog]           = useState(null)
  const [newOrderTable, setNewOrderTable] = useState(null)
  const [printConfirm, setPrintConfirm]   = useState(null)
  const [ordersDialog, setOrdersDialog]   = useState(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState([])
  const [completingSelected, setCompletingSelected] = useState(false)
  const [resettingSequence, setResettingSequence] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)
  const [activeTab, setActiveTab] = useState('map')
  const [tableQuery, setTableQuery] = useState('')
  const [orderActionId, setOrderActionId] = useState('')
  const [quickOrderTarget, setQuickOrderTarget] = useState(null)
  const [mobileTable, setMobileTable] = useState(null)
  const [mobileFavorites, setMobileFavorites] = useState({})
  const [counterOrders, setCounterOrders] = useState([])
  const [assignDialog, setAssignDialog] = useState(false)
  const [assignOrder, setAssignOrder] = useState(null)
  const [assignTable, setAssignTable] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [moveOrder, setMoveOrder] = useState(null)
  const [moveTable, setMoveTable] = useState(null)
  const [movingOrder, setMovingOrder] = useState(false)
  const [pinnedTableIds, setPinnedTableIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(pinStorageKey) || '[]')
      return Array.isArray(saved) ? saved.map(String) : []
    } catch { return [] }
  })
  const mobile = useMediaQuery('(max-width:700px)')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(pinStorageKey) || '[]')
      setPinnedTableIds(Array.isArray(saved) ? saved.map(String) : [])
    } catch { setPinnedTableIds([]) }
  }, [pinStorageKey])

  const toggleTablePin = tableId => {
    const id = String(tableId)
    setPinnedTableIds(current => {
      const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current]
      try { localStorage.setItem(pinStorageKey, JSON.stringify(next)) } catch { /* browser storage unavailable */ }
      return next
    })
  }

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [tablesRes, ordersRes, drawingsRes, completedRes] = await Promise.all([
        fetchShopTables(), fetchTableOrders(), fetchShopTableDrawings().catch(() => ({ data: [] })),
        fetchShopOrders('COMPLETED', currentShiftRange()),
      ])
      const tables = Array.isArray(tablesRes.data) ? tablesRes.data : []
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : []
      const completed = Array.isArray(completedRes.data) ? completedRes.data : []
      setCounterOrders(completed.filter(order => order.paymentStatus === 'PAID' && !order.tableId && !order.tableClearedAt && order.fulfillmentType !== 'DELIVERY'))
      setRows(tables.map(table => {
        const tableOrders = sortOrders(orders.filter(order => order.tableId && String(order.tableId) === String(table.id)))
        return {
          ...table,
          orders: tableOrders,
          activeOrders: tableOrders,
          activeOrder: tableOrders[0] || null,
          orderCount: tableOrders.length,
          activeOrderCount: tableOrders.length,
        }
      }))
      const configured = {}
      for (const drawing of Array.isArray(drawingsRes.data) ? drawingsRes.data : []) {
        try {
          const parsed = JSON.parse(drawing.layoutJson || '{}')
          for (const item of parsed.items || []) if (item.tableId) configured[String(item.tableId)] = { ids: item.favoriteModelIds || [], drawing, itemId: item.id }
        } catch { /* skip malformed legacy drawing */ }
      }
      setMobileFavorites(configured)
    } catch (error) { setError(error.message || 'Failed to load tables') }
    setLoading(false)
  }, [])

  const refreshTableOrders = useCallback(async () => {
    try {
      const { data } = await fetchTableOrders()
      if (!Array.isArray(data)) return
      setRows(current => current.map(table => {
        const tableOrders = sortOrders(data.filter(order => order.tableId && String(order.tableId) === String(table.id)))
        return {
          ...table,
          orders: tableOrders,
          activeOrders: tableOrders,
          activeOrder: tableOrders[0] || null,
          orderCount: tableOrders.length,
          activeOrderCount: tableOrders.length,
        }
      }))
    } catch { /* keep the last visible table state until the next refresh */ }
  }, [])

  const saveMobileFavorites = async (table, ids) => {
    const configured = mobileFavorites[String(table.id)]
    if (!configured?.drawing) {
      setMobileFavorites(current => ({ ...current, [String(table.id)]: { ids } }))
      return
    }
    try {
      const parsed = JSON.parse(configured.drawing.layoutJson || '{}')
      const nextItems = (parsed.items || []).map(item => item.id === configured.itemId ? { ...item, favoriteModelIds: ids } : item)
      const response = await updateShopTableDrawing(configured.drawing.id, { drawingName: configured.drawing.drawingName, layoutJson: JSON.stringify({ ...parsed, items: nextItems }) })
      if (!response.res.ok) throw new Error(response.data?.message || 'Không lưu được món hay gọi')
      setMobileFavorites(current => ({ ...current, [String(table.id)]: { ids, drawing: response.data, itemId: configured.itemId } }))
    } catch (error) { setError(error.message || 'Không lưu được món hay gọi') }
  }

  const openQuickOrderForTable = table => setQuickOrderTarget({
    table,
    favoriteIds: mobileFavorites[String(table.id)]?.ids || [],
    onSaveFavorites: ids => saveMobileFavorites(table, ids),
  })

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshTableOrders()
    }, 10000)
    return () => window.clearInterval(timer)
  }, [refreshTableOrders])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this table?')) return
    try { await deleteShopTable(id); load() } catch (e) { setError(e.message || 'Delete failed') }
  }

  const handleQr = async (row, forceNew = false) => {
    if (forceNew && !window.confirm(`Generate a new QR for ${row.tableName}? The old printed sticker will stop working.`)) return
    setQrDialog({ table: row, qrBase64: '', activeOrderCount: 0 })
    try {
      const { data } = await fetchTableQr(row.id, forceNew)
      setQrDialog({ table: row, qrBase64: data?.qrBase64 || '', activeOrderCount: data?.activeOrderCount ?? 0 })
    } catch { setError('Failed to load QR') }
  }

  const doPrint = (row, qr) => {
    const win = window.open('', '_blank', 'width=500,height=600')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Table QR - ${row.tableName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #fff; padding: 24px; }
        .box { border: 3px solid #000; border-radius: 16px; padding: 32px 40px; text-align: center; max-width: 360px; width: 100%; }
        h1 { font-size: 42px; font-weight: 900; margin-bottom: 4px; }
        .sub { font-size: 16px; color: #555; margin-bottom: 24px; }
        img { width: 260px; height: 260px; display: block; margin: 0 auto 20px; }
        .footer { font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 12px; margin-top: 4px; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="box">
        <h1>${row.tableName}</h1>
        <p class="sub">Scan to order</p>
        <img src="data:image/png;base64,${qr}" alt="QR" />
        <p class="footer">Point your camera at the QR code</p>
      </div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800) }</script>
    </body></html>`)
    win.document.close()
  }

  const handlePrint = async (row) => {
    try {
      const { data } = await fetchTableQr(row.id)
      const qr = data?.qrBase64 || ''
      const count = data?.activeOrderCount ?? 0
      if (count > 0) {
        setPrintConfirm({ row, qrBase64: qr, activeOrderCount: count })
      } else {
        doPrint(row, qr)
      }
    } catch { setError('Failed to load QR for printing') }
  }

  const resetDailyOrderNumber = async () => {
    if (!window.confirm('Reset last order number to 0 so the next order starts at #1? Use this at the start of a new day.')) return
    setResettingSequence(true); setError('')
    try {
      await resetOrderSequence(0)
      await load()
    } catch (e) {
      setError(e.message || 'Failed to reset order number')
    } finally {
      setResettingSequence(false)
    }
  }

  const openOrders = (row) => {
    setSelectedOrderIds([])
    setOrdersDialog({ table: row, orders: row.orders || [] })
  }

  const assignCounterOrder = async () => {
    if (!assignOrder || !assignTable || assigning) return
    setAssigning(true); setError('')
    try {
      const { res, data } = await setOrderTable(assignOrder.id, assignTable.id)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Không gán được đơn vào bàn')
      setAssignDialog(false); setAssignOrder(null); setAssignTable(null)
      await load()
    } catch (assignError) { setError(assignError.message || 'Không gán được đơn vào bàn') }
    finally { setAssigning(false) }
  }

  const moveOrderToTable = async () => {
    if (!moveOrder || !moveTable || movingOrder) return
    setMovingOrder(true); setError('')
    try {
      const { res, data } = await setOrderTable(moveOrder.id, moveTable.id)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Không chuyển được bàn')
      setOrdersDialog(current => current ? { ...current, orders: current.orders.filter(order => order.id !== moveOrder.id) } : current)
      setMobileTable(current => current ? { ...current, activeOrders: (current.activeOrders || []).filter(order => order.id !== moveOrder.id), activeOrderCount: Math.max(0, Number(current.activeOrderCount || 0) - 1) } : current)
      setMoveOrder(null); setMoveTable(null)
      await load()
    } catch (moveError) { setError(moveError.message || 'Không chuyển được bàn') }
    finally { setMovingOrder(false) }
  }

  const completeSelectedOrders = async () => {
    if (!ordersDialog) return
    const selected = ordersDialog.orders.filter(order => selectedOrderIds.includes(order.id) && isCompletableOrder(order))
    if (!selected.length) {
      setError('Select at least one Ready order to complete')
      return
    }
    if (!window.confirm(`Complete ${selected.length} selected order${selected.length > 1 ? 's' : ''} for ${ordersDialog.table.tableName}?`)) return
    setCompletingSelected(true)
    try {
      await Promise.all(selected.map(order => completeShopOrder(order.id)))
      const completedIds = new Set(selected.map(order => order.id))
      const now = new Date().toISOString()
      setOrdersDialog(prev => prev ? {
        ...prev,
        orders: prev.orders.map(order => completedIds.has(order.id)
          ? { ...order, status: 'COMPLETED', paymentStatus: 'PAID', completedAt: now }
          : order),
      } : prev)
      setSelectedOrderIds([])
      await load()
    } catch (e) {
      setError(e.message || 'Failed to complete selected orders')
    } finally {
      setCompletingSelected(false)
    }
  }

  const selectedReadyCount = (ordersDialog?.orders || [])
    .filter(order => selectedOrderIds.includes(order.id) && isCompletableOrder(order)).length
  const selectedOrderModel = React.useMemo(() => makeSelectionModel(selectedOrderIds), [selectedOrderIds])
  const filteredRows = React.useMemo(() => {
    const query = normalizeSearch(tableQuery.trim())
    const matches = !query ? rows : rows.filter(row => {
      const orderText = (row.activeOrders || []).map(order => [
        orderLabel(order), order.status, order.customerName, order.staffName,
        ...(order.items || []).map(item => item.modelName),
      ].filter(Boolean).join(' ')).join(' ')
      return normalizeSearch(`${row.tableName || ''} ${orderText}`).includes(query)
    })
    return [...matches].sort((a, b) => {
      const aPinned = pinnedTableIds.includes(String(a.id))
      const bPinned = pinnedTableIds.includes(String(b.id))
      if (aPinned !== bPinned) return aPinned ? -1 : 1
      const aNewest = new Date(a.activeOrder?.createdAt || 0).getTime() || 0
      const bNewest = new Date(b.activeOrder?.createdAt || 0).getTime() || 0
      if (aNewest !== bNewest) return bNewest - aNewest
      return String(a.tableName || '').localeCompare(String(b.tableName || ''), 'vi', { numeric: true })
    })
  }, [rows, tableQuery, pinnedTableIds])

  const runOrderAction = async (order, action, actionName) => {
    const actionKey = `${actionName}:${order.id}`
    setOrderActionId(actionKey); setError('')
    try {
      const { res, data } = await action(order.id)
      if (!res.ok) throw new Error(data?.message || data?.error || `Không thể ${actionName} đơn`)
      setOrdersDialog(current => {
        if (!current) return current
        const cleared = Boolean(data?.tableClearedAt)
        return { ...current, orders: cleared ? current.orders.filter(item => item.id !== order.id) : current.orders.map(item => item.id === order.id ? data : item) }
      })
      await load()
    } catch (actionError) {
      setError(actionError.message || `Không thể ${actionName} đơn`)
    } finally {
      setOrderActionId('')
    }
  }

  const renderOrderActions = order => (
    <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap">
      {order.status === 'PENDING' && <Button size="small" variant="contained" disabled={!!orderActionId} onClick={() => runOrderAction(order, confirmShopOrder, 'xác nhận')}>Xác nhận</Button>}
      {order.paymentStatus !== 'PAID' && <Button size="small" variant="outlined" color="success" disabled={!!orderActionId} onClick={() => runOrderAction(order, markOrderPaid, 'đánh dấu đã thanh toán')}>Đã thanh toán</Button>}
      {order.status === 'READY' && <Button size="small" variant="contained" color="success" disabled={!!orderActionId} onClick={() => runOrderAction(order, completeShopOrder, 'hoàn tất')}>Hoàn tất</Button>}
      {!['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status) && <Button size="small" variant="outlined" startIcon={<TableBarIcon />} disabled={!!orderActionId} onClick={() => { setMoveOrder(order); setMoveTable(null) }}>Chuyển bàn</Button>}
      {['COMPLETED', 'PICKED_UP'].includes(order.status) && !order.tableClearedAt && <Button size="small" variant="outlined" color="warning" disabled={!!orderActionId} onClick={() => runOrderAction(order, clearOrderTable, 'dọn bàn')}>Khách đã rời · Dọn bàn</Button>}
      {orderActionId.endsWith(`:${order.id}`) && <CircularProgress size={18} />}
      <Tooltip title="Xem chi tiết"><IconButton size="small" onClick={() => setDetailOrder(order)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
    </Stack>
  )

  const columns = [
    {
      field: 'tableName', headerName: 'Table', width: 175,
      renderCell: ({ value, row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Tooltip title={pinnedTableIds.includes(String(row.id)) ? 'Bỏ ghim bàn' : 'Ghim bàn lên đầu'}>
            <IconButton size="small" color={pinnedTableIds.includes(String(row.id)) ? 'warning' : 'default'} onClick={event => { event.stopPropagation(); toggleTablePin(row.id) }}>
              <PushPinIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <TableBarIcon sx={{ fontSize: 16, color: row.activeOrderCount ? '#0277bd' : '#bdbdbd', flexShrink: 0 }} />
          <Typography variant="body2" fontWeight={row.activeOrderCount ? 800 : 500} noWrap>{value}</Typography>
        </Box>
      ),
    },
    {
      field: 'activeOrderCount', headerName: 'Tại bàn', width: 90,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small" color="primary" sx={{ fontWeight: 800 }} />
        : <Chip label="Trống" size="small" variant="outlined" sx={{ color: '#78909c', borderColor: '#cfd8dc' }} />,
    },
    {
      field: 'activeOrders', headerName: 'Đơn tại bàn · thanh toán', flex: 1, minWidth: 320,
      renderCell: ({ value }) => {
        const list = value || []
        if (!list.length) return <Typography variant="caption" color="text.disabled">Không có đơn tại bàn</Typography>
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', overflow: 'hidden' }}>
            {list.slice(0, 3).map(order => (
              <Tooltip key={order.id} title={tableOrderBadge(order)}>
                <Chip label={tableOrderBadge(order)} size="small" color={order.paymentStatus === 'PAID' ? 'success' : 'warning'} variant="outlined" sx={{ maxWidth: 280, fontWeight: 800 }} />
              </Tooltip>
            ))}
            {list.length > 3 && <Typography variant="caption" color="text.secondary">+{list.length - 3}</Typography>}
          </Box>
        )
      },
    },
    {
      field: 'latestOrder', headerName: 'Last Order', width: 125,
      valueGetter: (_, row) => row.orders?.[0] || null,
      renderCell: ({ row }) => {
        const order = row.orders?.[0]
        return order ? <Typography variant="caption" fontWeight={800}>{orderLabel(order)}</Typography> : null
      },
    },
    {
      field: 'orderCount', headerName: 'Chưa dọn', width: 90,
      renderCell: ({ value }) => <Typography variant="caption" fontWeight={800}>{value || 0}</Typography>,
    },
    {
      field: 'isActive', headerName: 'Active', width: 80,
      renderCell: ({ value }) => <Chip label={value ? 'Yes' : 'No'} color={value ? 'success' : 'default'} size="small" />,
    },
    {
      field: 'actions', headerName: 'Actions', width: 360, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Button
            size="small" variant="contained" color="primary"
            startIcon={<VisibilityIcon />}
            onClick={() => openOrders(row)}
            sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11, px: 1 }}
          >
            Orders
          </Button>
          <Tooltip title="New order for this table">
            <Button
              size="small" variant="outlined" color="primary"
              startIcon={<NoteAddIcon />}
              onClick={() => openQuickOrderForTable(row)}
              sx={{ textTransform: 'none', fontSize: 11, px: 1 }}
            >
              Tạo nhanh
            </Button>
          </Tooltip>
          <Tooltip title="QR Code"><IconButton size="small" onClick={() => handleQr(row)}><QrCode2Icon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Print QR"><IconButton size="small" onClick={() => handlePrint(row)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => setEditTable(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      )
    }
  ]

  const orderColumns = [
    {
      field: 'orderNumber', headerName: 'Order', width: 95,
      renderCell: ({ row }) => <Typography fontWeight={900}>{orderLabel(row)}</Typography>,
    },
    {
      field: 'status', headerName: 'Status', width: 125,
      renderCell: ({ value }) => statusChip(value),
    },
    {
      field: 'createdAt', headerName: 'Created', width: 150,
      renderCell: ({ value }) => <Typography variant="caption">{dateFmt(value)}</Typography>,
    },
    {
      field: 'customerName', headerName: 'Customer', minWidth: 130, flex: 1,
      renderCell: ({ value }) => <Typography variant="caption" noWrap>{value || '-'}</Typography>,
    },
    {
      field: 'items', headerName: 'Items', width: 70,
      renderCell: ({ value }) => <Typography variant="caption" fontWeight={800}>{Array.isArray(value) ? value.length : 0}</Typography>,
    },
    {
      field: 'totalAmount', headerName: 'Total', width: 120,
      renderCell: ({ value }) => <Typography variant="caption" fontWeight={800}>{fmtMoney(value)}</Typography>,
    },
    {
      field: 'paymentStatus', headerName: 'Payment', width: 105,
      renderCell: ({ value }) => <Chip label={value || '-'} size="small" color={value === 'PAID' ? 'success' : 'default'} variant="outlined" />,
    },
    {
      field: 'actions', headerName: 'Thao tác nhanh', width: 360, sortable: false,
      renderCell: ({ row }) => renderOrderActions(row),
    },
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setEditTable({})}>New Table</Button>
        <Button variant="contained" color="secondary" size="small" onClick={() => setAssignDialog(true)}>Gán đơn quầy vào bàn ({counterOrders.length})</Button>
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh</Button>
        {hasFullBusinessAccess && (
          <Button startIcon={resettingSequence ? <CircularProgress size={14} /> : <RestartAltIcon />} onClick={resetDailyOrderNumber} variant="outlined" color="warning" size="small" disabled={resettingSequence}>Reset Order #</Button>
        )}
      </Box>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Paper variant="outlined" sx={{ flexShrink: 0 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="fullWidth">
          <Tab value="map" label="Sơ đồ bàn" />
          <Tab value="list" label={`Danh sách bàn (${rows.length})`} />
        </Tabs>
      </Paper>
      {activeTab === 'map' && (mobile ? <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Autocomplete
          options={rows}
          value={mobileTable}
          onChange={(_, table) => setMobileTable(table)}
          getOptionLabel={table => table.tableName || ''}
          isOptionEqualToValue={(a,b)=>a.id===b.id}
          filterOptions={(options, state) => {
            const query = normalizeSearch(state.inputValue)
            return query ? options.filter(table => normalizeSearch(table.tableName).includes(query)) : options
          }}
          autoHighlight
          renderInput={params => <TextField {...params} label="Gõ tên bàn để lọc và chọn" size="small" />}
        />
        {mobileTable && <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={900}>{mobileTable.tableName}</Typography><Chip color={mobileTable.activeOrderCount?'primary':'success'} label={mobileTable.activeOrderCount?`${mobileTable.activeOrderCount} đơn chưa dọn`:'Bàn trống'} /></Stack>
          {(mobileTable.activeOrders || []).map(order => <Paper key={order.id} variant="outlined" sx={{ p: 1, my: 1 }} onClick={()=>setDetailOrder(order)}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Typography fontWeight={800}>#{order.orderNumber ?? order.dailySeq} · {order.staffName || 'Khách tự gọi'}</Typography><Chip size="small" label={order.paymentStatus === 'PAID' ? 'Đã trả' : 'Chưa trả'} color={order.paymentStatus === 'PAID' ? 'success' : 'warning'} /></Stack>
            <Typography variant="body2">{(order.items || []).filter(item=>!item.parentItemId).map(item=>`${item.quantity} × ${item.modelName}${item.itemNotes?` (${item.itemNotes})`:''}`).join(' · ')}</Typography>
            <Box sx={{ mt: 1 }} onClick={event => event.stopPropagation()}>{renderOrderActions(order)}</Box>
          </Paper>)}
          <Stack direction="row" gap={1}><Button variant="contained" startIcon={<AddIcon />} onClick={()=>openQuickOrderForTable(mobileTable)}>Gọi món nhanh</Button><Button variant="outlined" onClick={()=>setNewOrderTable(mobileTable)}>Đơn đầy đủ</Button></Stack>
        </Box>}
      </Paper> : <ShopTableLayoutDesigner tables={rows} expanded onQuickOrder={setQuickOrderTarget} />)}
      {activeTab === 'list' && <Box sx={{ flex: 1, minHeight: 300, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField
          size="small"
          label="Gõ tên bàn không dấu, số đơn, khách hoặc món để tìm"
          value={tableQuery}
          onChange={event => setTableQuery(event.target.value)}
          autoFocus
          sx={{ maxWidth: 520 }}
        />
        {mobile ? <Stack gap={1} sx={{ overflow: 'auto' }}>
          {filteredRows.map(table => <Paper key={table.id} variant="outlined" sx={{ p: 1.5, bgcolor: table.activeOrderCount ? '#eff6ff' : '#fff' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Stack direction="row" alignItems="center" gap={0.5}>
                <Tooltip title={pinnedTableIds.includes(String(table.id)) ? 'Bỏ ghim bàn' : 'Ghim bàn lên đầu'}><IconButton size="small" color={pinnedTableIds.includes(String(table.id)) ? 'warning' : 'default'} onClick={() => toggleTablePin(table.id)}><PushPinIcon fontSize="small" /></IconButton></Tooltip>
                <Typography variant="h6" fontWeight={900}>{table.tableName}</Typography>
              </Stack>
              <Stack direction="row" gap={0.5} flexWrap="wrap" justifyContent="flex-end">
                <Chip size="small" color={table.activeOrderCount ? 'primary' : 'success'} label={table.activeOrderCount ? `${table.activeOrderCount} đơn chưa dọn` : 'Bàn trống'} />
                {table.activeOrderCount > 0 && <Chip size="small" color={(table.activeOrders || []).some(order => order.paymentStatus !== 'PAID') ? 'warning' : 'success'} variant="outlined" label={`${(table.activeOrders || []).filter(order => order.paymentStatus === 'PAID').length} đã trả · ${(table.activeOrders || []).filter(order => order.paymentStatus !== 'PAID').length} chưa trả`} />}
              </Stack>
            </Stack>
            {(table.activeOrders || []).map(order => <Paper key={order.id} variant="outlined" sx={{ p: 1, mt: 1 }}>
              <Stack direction="row" alignItems="center" gap={0.5} flexWrap="wrap"><Typography fontWeight={900}>{orderLabel(order)}</Typography>{statusChip(order.status)}<Chip size="small" label={order.paymentStatus === 'PAID' ? 'Đã trả' : 'Chưa trả'} color={order.paymentStatus === 'PAID' ? 'success' : 'warning'} /></Stack>
              <Typography variant="body2">{(order.items || []).filter(item => !item.parentItemId).map(item => `${item.quantity} × ${item.modelName}`).join(' · ')}</Typography>
              <Typography variant="body2" fontWeight={800}>{fmtMoney(order.totalAmount)}</Typography>
              <Box sx={{ mt: 1 }}>{renderOrderActions(order)}</Box>
            </Paper>)}
            <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1 }}><Button size="small" variant="contained" onClick={() => openOrders(table)}>Xem đơn</Button><Button size="small" variant="outlined" onClick={() => openQuickOrderForTable(table)}>Tạo nhanh tại bàn</Button><Button size="small" onClick={() => setNewOrderTable(table)}>Đơn đầy đủ</Button></Stack>
          </Paper>)}
          {!filteredRows.length && <Typography color="text.secondary">Không tìm thấy bàn phù hợp.</Typography>}
        </Stack> :
        <DataGrid
          rows={filteredRows}
          columns={columns}
          loading={loading}
          getRowId={r => r.id}
          pageSizeOptions={[25, 50]}
          density="compact"
          getRowClassName={({ row }) => row.activeOrderCount ? 'occupied-row' : ''}
          sx={{
            '& .occupied-row': { bgcolor: '#e3f2fd' },
            '& .occupied-row:hover': { bgcolor: '#bbdefb !important' },
          }}
        />}
      </Box>}

      {editTable !== null && (
        <ShopTableEditModal
          open
          table={editTable.id ? editTable : null}
          onClose={() => setEditTable(null)}
          onSaved={() => { setEditTable(null); load() }}
        />
      )}

      {newOrderTable && (
        <ManualOrderDialog
          open
          defaultTable={newOrderTable}
          onClose={() => setNewOrderTable(null)}
          onCreated={() => { void load() }}
        />
      )}

      {quickOrderTarget && <QuickTableOrderDialog
        open
        table={quickOrderTarget.table}
        favoriteIds={quickOrderTarget.favoriteIds}
        tableOrders={quickOrderTarget.table.activeOrders || []}
        onSaveFavorites={quickOrderTarget.onSaveFavorites}
        onCreated={() => { void load() }}
        onClose={() => setQuickOrderTarget(null)}
      />}

      <Dialog open={assignDialog} onClose={assigning ? undefined : () => setAssignDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>Gán đơn quầy đã thanh toán vào bàn</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Alert severity="info">Các đơn quầy đã thanh toán và hoàn tất trong ca hiện tại. Sau khi gán, đơn vẫn hiện trên bàn cho đến khi bấm “Khách đã rời · Dọn bàn”.</Alert>
          <Autocomplete
            options={counterOrders}
            value={assignOrder}
            onChange={(_, order) => setAssignOrder(order)}
            getOptionLabel={order => `${orderLabel(order)} · ${order.customerName || 'Khách tại quầy'} · ${fmtMoney(order.totalAmount)}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(options, state) => { const query = normalizeSearch(state.inputValue); return query ? options.filter(order => normalizeSearch(`${orderLabel(order)} ${order.orderCode || ''} ${order.customerName || ''} ${(order.items || []).map(item => item.modelName).join(' ')}`).includes(query)) : options }}
            renderInput={params => <TextField {...params} label="Gõ số đơn, khách hoặc món" />}
          />
          <Autocomplete
            options={rows.filter(table => table.isActive !== false)}
            value={assignTable}
            onChange={(_, table) => setAssignTable(table)}
            getOptionLabel={table => `${table.tableName} · ${table.activeOrderCount ? `${table.activeOrderCount} đơn chưa dọn` : 'Bàn trống'}`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(options, state) => { const query = normalizeSearch(state.inputValue); return query ? options.filter(table => normalizeSearch(table.tableName).includes(query)) : options }}
            renderInput={params => <TextField {...params} label="Gõ tên bàn để tìm" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialog(false)} disabled={assigning}>Hủy</Button>
          <Button variant="contained" onClick={assignCounterOrder} disabled={!assignOrder || !assignTable || assigning}>{assigning ? 'Đang gán...' : 'Gán vào bàn'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(moveOrder)} onClose={movingOrder ? undefined : () => { setMoveOrder(null); setMoveTable(null) }} fullWidth maxWidth="xs">
        <DialogTitle>Chuyển đơn {orderLabel(moveOrder)} sang bàn khác</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '12px !important' }}>
          <Alert severity="info">Đơn sẽ rời {moveOrder?.tableName || 'bàn hiện tại'} và xuất hiện tại bàn đích.</Alert>
          <Autocomplete
            autoHighlight
            options={rows.filter(table => table.isActive !== false && String(table.id) !== String(moveOrder?.tableId))}
            value={moveTable}
            onChange={(_, table) => setMoveTable(table)}
            getOptionLabel={table => `${table.tableName} · ${table.activeOrderCount ? `${table.activeOrderCount} đơn chưa dọn` : 'Bàn trống'}`}
            isOptionEqualToValue={(a,b)=>a.id===b.id}
            filterOptions={(options,state)=>{const query=normalizeSearch(state.inputValue);return query?options.filter(table=>normalizeSearch(table.tableName).includes(query)):options}}
            renderInput={params=><TextField {...params} autoFocus label="Gõ tên bàn đích để tìm" placeholder="Không cần gõ dấu" />}
          />
        </DialogContent>
        <DialogActions><Button disabled={movingOrder} onClick={() => { setMoveOrder(null); setMoveTable(null) }}>Hủy</Button><Button variant="contained" disabled={!moveTable || movingOrder} onClick={moveOrderToTable}>{movingOrder ? 'Đang chuyển...' : 'Xác nhận chuyển bàn'}</Button></DialogActions>
      </Dialog>

      <Dialog open={!!ordersDialog} onClose={() => setOrdersDialog(null)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TableBarIcon color="primary" />
          <Typography component="span" fontWeight={900}>{ordersDialog?.table?.tableName}</Typography>
          <Chip label={`${ordersDialog?.orders?.length || 0} orders`} size="small" />
          <Chip label={`${(ordersDialog?.orders || []).filter(isActiveOrder).length} open`} size="small" color="primary" variant="outlined" />
        </DialogTitle>
        <DialogContent sx={{ height: 520 }}>
          <DataGrid
            rows={ordersDialog?.orders || []}
            columns={orderColumns}
            getRowId={row => row.id}
            checkboxSelection
            disableRowSelectionOnClick
            isRowSelectable={({ row }) => isCompletableOrder(row)}
            rowSelectionModel={selectedOrderModel}
            onRowSelectionModelChange={model => setSelectedOrderIds(selectionIds(model))}
            pageSizeOptions={[10, 25, 50]}
            density="compact"
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Only Ready orders can be selected for completion.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrdersDialog(null)}>Close</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={completingSelected ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlineIcon />}
            disabled={!selectedReadyCount || completingSelected}
            onClick={completeSelectedOrders}
          >
            Complete Selected{selectedReadyCount ? ` (${selectedReadyCount})` : ''}
          </Button>
        </DialogActions>
      </Dialog>

      <ShopOrderDetailModal
        open={!!detailOrder}
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        onRefresh={() => { setDetailOrder(null); load() }}
      />

      <Dialog open={!!qrDialog} onClose={() => setQrDialog(null)}>
        <DialogTitle>QR Code - {qrDialog?.table?.tableName}</DialogTitle>
        <DialogContent sx={{ textAlign: 'center', minWidth: 320 }}>
          {qrDialog?.activeOrderCount > 0 && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2, textAlign: 'left' }}>
              <strong>Table not clear</strong> - {qrDialog.activeOrderCount} active order{qrDialog.activeOrderCount > 1 ? 's' : ''} still in progress.
              A new session has been started. Clear the table when those orders are done.
            </Alert>
          )}
          {qrDialog?.qrBase64 ? (
            <>
              <img src={`data:image/png;base64,${qrDialog.qrBase64}`} alt="Table QR" style={{ width: 280, height: 280 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>New session - customers scan to order</Typography>
            </>
          ) : <CircularProgress sx={{ my: 4 }} />}
        </DialogContent>
        <DialogActions>
          {qrDialog?.table && (
              <Button color="warning" onClick={() => handleQr(qrDialog.table, true)}>Regenerate</Button>
          )}
          {qrDialog?.qrBase64 && (
            <Button onClick={() => {
              const a = document.createElement('a')
              a.href = `data:image/png;base64,${qrDialog.qrBase64}`
              a.download = `table-${qrDialog.table?.tableName || 'qr'}.png`
              a.click()
            }}>Download</Button>
          )}
          <Button onClick={() => setQrDialog(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!printConfirm} onClose={() => setPrintConfirm(null)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" /> Table not clear
        </DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{printConfirm?.row?.tableName}</strong> has{' '}
            <strong>{printConfirm?.activeOrderCount}</strong> active order{printConfirm?.activeOrderCount > 1 ? 's' : ''} that
            have not been cleared yet.
          </Typography>
          <Typography sx={{ mt: 1.5, color: 'text.secondary' }}>
            Printing a new QR will start a fresh ordering session. Print anyway?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="warning"
            onClick={() => { doPrint(printConfirm.row, printConfirm.qrBase64); setPrintConfirm(null) }}>
            Print Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
