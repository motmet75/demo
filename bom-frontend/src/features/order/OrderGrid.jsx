import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CancelIcon from '@mui/icons-material/Cancel'
import InventoryIcon from '@mui/icons-material/Inventory'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import EditIcon from '@mui/icons-material/Edit'
import { useAppContext } from '../../context/AppContext'
import { fetchOrders, confirmOrder, deliverOrder, cancelOrder, checkInventory, moveToProduction } from '../../api/orderApi'
import OrderCreateModal from './OrderCreateModal'
import OrderDetailModal from './OrderDetailModal'
import FinishOrderModal from './FinishOrderModal'
import OrderEditModal from './OrderEditModal'

const STATUS_COLOR = {
  DRAFT: 'default', CONFIRMED: 'primary', IN_PRODUCTION: 'warning',
  MATERIAL_READY: 'warning', PARTIALLY_COMPLETED: 'warning', COMPLETED: 'success',
  DELIVERED: 'success', CANCELLED: 'error', CANCEL_PENDING: 'error'
}
const ORDER_TYPES_FILTER = ['', 'SALES', 'PRODUCTION', 'TRANSFER', 'INTERNAL']
const STATUS_FILTER = ['', 'DRAFT', 'CONFIRMED', 'MATERIAL_READY', 'IN_PRODUCTION', 'COMPLETED', 'DELIVERED', 'CANCELLED']

export default function OrderGrid() {
  const { tenantId, companyId } = useAppContext()

  const [rows, setRows]           = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [totalRows, setTotalRows] = useState(0)
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  const [filterStatus, setFilterStatus]       = useState('')
  const [filterOrderType, setFilterOrderType] = useState('')
  const [filterFromDate, setFilterFromDate]   = useState('')
  const [filterToDate, setFilterToDate]       = useState('')
  const [dateRangePreset, setDateRangePreset] = useState('')
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 })

  const toDateLocal = (d) => { const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}` }
  const applyDateRangePreset = (preset) => {
    setDateRangePreset(preset)
    if (!preset) { setFilterFromDate(''); setFilterToDate(''); return }
    const now = new Date()
    const today = toDateLocal(now)
    if (preset === 'today') { setFilterFromDate(today); setFilterToDate(today) }
    else if (preset === 'yesterday') { const y=new Date(now); y.setDate(y.getDate()-1); const yd=toDateLocal(y); setFilterFromDate(yd); setFilterToDate(yd) }
    else if (preset === 'this_week') { const ws=new Date(now); ws.setDate(ws.getDate()-now.getDay()); setFilterFromDate(toDateLocal(ws)); setFilterToDate(today) }
    else if (preset.startsWith('last_')) { const d=parseInt(preset.replace('last_',''),10); const f=new Date(now); f.setDate(f.getDate()-(d-1)); setFilterFromDate(toDateLocal(f)); setFilterToDate(today) }
  }

  // selected is scoped to current page rows (server-side pagination — rows is current page)
  const pageIds = new Set(rows.map(r => r.id))
  const selected = selectionModel.type === 'exclude'
    ? rows.map(r => r.id).filter(id => !selectionModel.ids.has(id))
    : Array.from(selectionModel.ids ?? []).filter(id => pageIds.has(id))

  const handleSelectionModelChange = (model) => {
    if (model && model.type === 'exclude') {
      const excluded = model.ids ?? new Set()
      setSelectionModel({ type: 'include', ids: new Set(rows.map(r => r.id).filter(id => !excluded.has(id))) })
    } else { setSelectionModel(model) }
  }

  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId]     = useState(null)
  const [editId, setEditId]         = useState(null)
  const [finishId, setFinishId]     = useState(null)
  const [actionLoading, setActionLoading] = useState({})

  // ── Check Inventory dialog ────────────────────────────────────────
  const [checkOpen, setCheckOpen]     = useState(false)
  const [checkResult, setCheckResult] = useState(null)
  const [checkLoading, setCheckLoading] = useState(false)

  // ── Move to Production dialog ─────────────────────────────────────
  const [moveOpen, setMoveOpen]           = useState(false)
  const [deliveryDateTime, setDeliveryDateTime] = useState('')
  const [moveLoading, setMoveLoading]     = useState(false)

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true); setError('')
    try {
      const result = await fetchOrders({
        status:    filterStatus    || undefined,
        orderType: filterOrderType || undefined,
        fromDate:  filterFromDate ? new Date(filterFromDate).toISOString() : undefined,
        toDate:    filterToDate   ? new Date(filterToDate).toISOString()   : undefined,
        page:      paginationModel.page,
        size:      paginationModel.pageSize
      })
      setRows((result.content || []).map(r => ({ ...r, id: r.id })))
      setTotalRows(result.totalElements || 0)
    } catch (e) {
      setError(e.message || 'Failed to load orders'); setRows([])
    } finally { setLoading(false) }
  }, [tenantId, companyId, filterStatus, filterOrderType, filterFromDate, filterToDate, paginationModel.page, paginationModel.pageSize])

  useEffect(() => { load() }, [load])

  const withLoading = (id, fn) => async () => {
    setActionLoading(prev => ({ ...prev, [id]: true })); setError('')
    try {
      const updated = await fn()
      setRows(prev => prev.map(r => r.id === updated.id ? { ...updated, id: updated.id } : r))
    } catch (e) { setError(e.message || 'Action failed') }
    finally { setActionLoading(prev => ({ ...prev, [id]: false })) }
  }

  const handleConfirm = (id) => withLoading(id, () => confirmOrder(id))()
  const handleDeliver = (id) => withLoading(id, () => deliverOrder(id))()
  const handleCancel  = (id) => {
    if (!window.confirm('Cancel this order? Provisional consumption will be released.')) return
    withLoading(id, () => cancelOrder(id))()
  }

  // ── Check Inventory ───────────────────────────────────────────────
  const handleCheckInventory = async () => {
    if (!selected.length) return
    setCheckLoading(true); setCheckResult(null)
    try {
      const result = await checkInventory(selected)
      setCheckResult(result)
      setCheckOpen(true)
    } catch (e) { setError(e.message) }
    finally { setCheckLoading(false) }
  }

  // ── Move to Production ────────────────────────────────────────────
  const handleMoveToProduction = async () => {
    if (!selected.length) return
    setMoveLoading(true); setError('')
    try {
      const dt = deliveryDateTime ? new Date(deliveryDateTime).toISOString() : null
      const updated = await moveToProduction(selected, dt, 'system')
      // Merge updated orders back
      const map = Object.fromEntries(updated.map(o => [o.id, o]))
      setRows(prev => prev.map(r => map[r.id] ? { ...map[r.id], id: r.id } : r))
      setMoveOpen(false); setSelectionModel({ type: 'include', ids: new Set() })
    } catch (e) { setError(e.message) }
    finally { setMoveLoading(false) }
  }

  const handleFinished = (updated) =>
    setRows(prev => prev.map(r => r.id === updated.id ? { ...updated, id: updated.id } : r))

  const handleUpdated = (updated) =>
    setRows(prev => prev.map(r => r.id === updated.id ? { ...updated, id: updated.id } : r))

  const handleCreated = (order) => {
    setRows(prev => [{ ...order, id: order.id }, ...prev])
    setTotalRows(t => t + 1)
  }

  const columns = [
    { field: 'id', headerName: 'UUID', flex: 1, minWidth: 80,
      renderCell: ({ value }) => value
        ? <span title={value} style={{ fontFamily: 'monospace', fontSize: 11, cursor: 'pointer' }} onClick={() => navigator.clipboard?.writeText(value)}>{value}</span>
        : '—'
    },
    { field: 'orderNumber', headerName: 'Order #', width: 160,
      renderCell: ({ row }) => (
        <Button size="small" variant="text" onClick={() => setDetailId(row.id)}
          sx={{ textTransform: 'none', fontFamily: 'monospace', fontSize: 13 }}>
          {row.orderNumber}
        </Button>
      )
    },
    { field: 'orderType', headerName: 'Type', width: 110,
      renderCell: ({ value }) => <Chip label={value} size="small" variant="outlined" /> },
    { field: 'status', headerName: 'Status', width: 160,
      renderCell: ({ value }) => <Chip label={value} size="small" color={STATUS_COLOR[value] || 'default'} /> },
    { field: 'deliveryDateTime', headerName: 'Delivery', width: 170,
      renderCell: ({ value }) => value ? new Date(value).toLocaleString() : '—' },
    { field: 'plannedStartDate', headerName: 'Planned Start', width: 130 },
    { field: 'plannedEndDate',   headerName: 'Planned End',   width: 130 },
    { field: 'totalPlannedQty',  headerName: 'Planned Qty',   width: 120, type: 'number' },
    { field: 'totalActualQty',   headerName: 'Actual Qty',    width: 110, type: 'number' },
    { field: 'createdBy',        headerName: 'Created By',    width: 120 },
    { field: 'createdAt',        headerName: 'Created At',    width: 180,
      renderCell: ({ value }) => value ? new Date(value).toLocaleString() : '—' },
    {
      field: '_actions', headerName: 'Actions', width: 260, sortable: false, filterable: false,
      renderCell: ({ row }) => {
        const busy = !!actionLoading[row.id]; const s = row.status
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View Detail">
              <IconButton size="small" onClick={() => setDetailId(row.id)}><VisibilityIcon fontSize="small" /></IconButton>
            </Tooltip>
            {s === 'DRAFT' && (
              <Tooltip title="Edit Order"><span>
                <IconButton size="small" color="secondary" disabled={busy} onClick={() => setEditId(row.id)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            )}
            {s === 'DRAFT' && (
              <Tooltip title="Confirm Order"><span>
                <IconButton size="small" color="primary" disabled={busy} onClick={() => handleConfirm(row.id)}>
                  <CheckCircleIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            )}
            {(s === 'CONFIRMED' || s === 'IN_PRODUCTION') && (
              <Tooltip title="Finish Order"><span>
                <IconButton size="small" color="success" disabled={busy} onClick={() => setFinishId(row.id)}>
                  <DoneAllIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            )}
            {(s === 'COMPLETED' || s === 'CONFIRMED') && (
              <Tooltip title="Mark Delivered"><span>
                <IconButton size="small" color="info" disabled={busy} onClick={() => handleDeliver(row.id)}>
                  <LocalShippingIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            )}
            {s !== 'COMPLETED' && s !== 'DELIVERED' && s !== 'CANCELLED' && (
              <Tooltip title="Cancel Order"><span>
                <IconButton size="small" color="error" disabled={busy} onClick={() => handleCancel(row.id)}>
                  <CancelIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            )}
          </Box>
        )
      }
    }
  ]

  const noContextMsg = !tenantId || !companyId
  const hasSelected = selected.length > 0

  return (
    <Box>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Orders</Typography>

        {/* Multi-select actions */}
        {hasSelected && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', border: '1px solid #e0e0e0', borderRadius: 1, px: 1.5, py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{selected.length} selected</Typography>
            <Button size="small" startIcon={<InventoryIcon />} variant="outlined"
              disabled={checkLoading} onClick={handleCheckInventory}>
              {checkLoading ? 'Checking…' : 'Check Inventory'}
            </Button>
            <Button size="small" startIcon={<PlayArrowIcon />} variant="contained" color="warning"
              onClick={() => setMoveOpen(true)}>
              Move to Production
            </Button>
          </Box>
        )}

        <TextField select label="Status" value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); setPaginationModel(p => ({ ...p, page: 0 })) }}
          size="small" sx={{ minWidth: 150 }}>
          {STATUS_FILTER.map(s => <MenuItem key={s} value={s}>{s || 'All Statuses'}</MenuItem>)}
        </TextField>
        <TextField select label="Order Type" value={filterOrderType}
          onChange={e => { setFilterOrderType(e.target.value); setPaginationModel(p => ({ ...p, page: 0 })) }}
          size="small" sx={{ minWidth: 150 }}>
          {ORDER_TYPES_FILTER.map(t => <MenuItem key={t} value={t}>{t || 'All Types'}</MenuItem>)}
        </TextField>
        <TextField select label="Quick Range" value={dateRangePreset}
          onChange={e => { applyDateRangePreset(e.target.value); setPaginationModel(p => ({ ...p, page: 0 })) }}
          size="small" sx={{ minWidth: 140 }}>
          <MenuItem value="">— All —</MenuItem>
          <MenuItem value="today">Today</MenuItem>
          <MenuItem value="yesterday">Yesterday</MenuItem>
          <MenuItem value="this_week">This Week</MenuItem>
          <MenuItem value="last_7">Last 7 Days</MenuItem>
          <MenuItem value="last_14">Last 14 Days</MenuItem>
          <MenuItem value="last_30">Last 30 Days</MenuItem>
          <MenuItem value="last_60">Last 60 Days</MenuItem>
          <MenuItem value="last_90">Last 90 Days</MenuItem>
        </TextField>
        <TextField label="From Date" type="date" value={filterFromDate} onChange={e => { setDateRangePreset(''); setFilterFromDate(e.target.value) }}
          size="small" InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <TextField label="To Date" type="date" value={filterToDate} onChange={e => { setDateRangePreset(''); setFilterToDate(e.target.value) }}
          size="small" InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} disabled={noContextMsg}>
          New Order
        </Button>
      </Box>

      {noContextMsg && <Alert severity="warning" sx={{ mb: 2 }}>Please select a Tenant and Company to manage orders.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Grid ────────────────────────────────────────────────── */}
      <DataGrid
        rows={rows} columns={columns} loading={loading}
        rowCount={totalRows} paginationMode="server"
        paginationModel={paginationModel} onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 20, 50, 100]}
        checkboxSelection
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={handleSelectionModelChange}
        disableRowSelectionOnClick={false}
        autoHeight
        sx={{ background: '#fff', borderRadius: 2 }}
      />

      {/* ── Check Inventory Result Dialog ───────────────────────── */}
      <Dialog open={checkOpen} onClose={() => setCheckOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Inventory Check — {checkResult?.sufficient
            ? <Chip label="SUFFICIENT" color="success" size="small" />
            : <Chip label="INSUFFICIENT" color="error" size="small" />}
        </DialogTitle>
        <DialogContent>
          {checkResult && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Material Code</TableCell>
                  <TableCell>Material Name</TableCell>
                  <TableCell align="right">Required</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(checkResult.rows || []).map(r => (
                  <TableRow key={r.materialId}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{r.materialCode}</TableCell>
                    <TableCell>{r.materialName}</TableCell>
                    <TableCell align="right">{Number(r.requiredQty).toFixed(4)}</TableCell>
                    <TableCell align="right">{Number(r.availableQty).toFixed(4)}</TableCell>
                    <TableCell>
                      <Chip label={r.sufficient ? 'OK' : 'SHORT'} size="small"
                        color={r.sufficient ? 'success' : 'error'} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCheckOpen(false)}>Close</Button>
          {checkResult?.sufficient && (
            <Button variant="contained" color="warning" startIcon={<PlayArrowIcon />}
              onClick={() => { setCheckOpen(false); setMoveOpen(true) }}>
              Proceed to Move to Production
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Move to Production Dialog ───────────────────────────── */}
      <Dialog open={moveOpen} onClose={() => setMoveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Move {selected.length} Order(s) to Production</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            This will check inventory, deduct stock via FEFO, create ISSUE_TO_PRODUCTION
            movements and set order status to MATERIAL_READY.
          </Typography>
          <TextField label="Delivery Date &amp; Time" type="datetime-local" fullWidth size="small"
            value={deliveryDateTime} onChange={e => setDeliveryDateTime(e.target.value)}
            InputLabelProps={{ shrink: true }} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMoveOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" startIcon={<PlayArrowIcon />}
            disabled={moveLoading} onClick={handleMoveToProduction}>
            {moveLoading ? 'Processing…' : 'Confirm Move'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Other Dialogs ───────────────────────────────────────── */}
      <OrderCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <OrderEditModal open={!!editId} orderId={editId} onClose={() => setEditId(null)} onUpdated={handleUpdated} />
      <OrderDetailModal open={!!detailId} orderId={detailId} onClose={() => setDetailId(null)} />
      <FinishOrderModal open={!!finishId} orderId={finishId}
        onClose={() => setFinishId(null)} onFinished={handleFinished} />
    </Box>
  )
}
