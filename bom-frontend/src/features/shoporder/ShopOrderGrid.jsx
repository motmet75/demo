import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import RefreshIcon from '@mui/icons-material/Refresh'
import VisibilityIcon from '@mui/icons-material/Visibility'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { fetchShopOrders, confirmShopOrder, prepareShopOrder, readyShopOrder, completeShopOrder, cancelShopOrder } from '../../api/shopApi'
import ShopOrderDetailModal from './ShopOrderDetailModal'

const STATUS_COLOR = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', COMPLETED: 'success', CANCELLED: 'error' }
const STATUSES = ['', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']
const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN') : ''

export default function ShopOrderGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detailOrder, setDetailOrder] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchShopOrders(statusFilter || null)
      setRows(Array.isArray(data) ? data : [])
    } catch { setError('Failed to load orders') }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const act = async (fn, id) => {
    try { await fn(id); load() } catch (e) { setError(e.message || 'Action failed') }
  }

  const columns = [
    { field: 'orderCode', headerName: 'Order #', width: 130 },
    { field: 'status', headerName: 'Status', width: 110, renderCell: ({ value }) => <Chip label={value} color={STATUS_COLOR[value] || 'default'} size="small" /> },
    { field: 'fulfillmentType', headerName: 'Type', width: 90 },
    { field: 'customerName', headerName: 'Customer', width: 130 },
    { field: 'totalAmount', headerName: 'Total', width: 110, renderCell: ({ value }) => fmt(value) },
    { field: 'paymentStatus', headerName: 'Payment', width: 90 },
    { field: 'createdAt', headerName: 'Created', width: 150, renderCell: ({ value }) => dateFmt(value) },
    {
      field: 'actions', headerName: 'Actions', width: 340, sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip title="Detail"><IconButton size="small" onClick={() => setDetailOrder(row)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          {row.status === 'PENDING' && <Button size="small" variant="outlined" onClick={() => act(confirmShopOrder, row.id)}>Confirm</Button>}
          {row.status === 'CONFIRMED' && <Button size="small" variant="outlined" color="warning" onClick={() => act(prepareShopOrder, row.id)}>Prepare</Button>}
          {row.status === 'PREPARING' && <Button size="small" variant="outlined" color="success" onClick={() => act(readyShopOrder, row.id)}>Ready</Button>}
          {row.status === 'READY' && <Button size="small" variant="contained" color="success" onClick={() => act(completeShopOrder, row.id)}>Complete</Button>}
          {!['COMPLETED', 'CANCELLED'].includes(row.status) && <Button size="small" color="error" onClick={() => act(cancelShopOrder, row.id)}>Cancel</Button>}
        </Box>
      )
    }
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField select label="Status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} size="small" sx={{ width: 160 }}>
          {STATUSES.map(s => <MenuItem key={s} value={s}>{s || 'All'}</MenuItem>)}
        </TextField>
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh</Button>
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ flex: 1, minHeight: 400 }}>
        <DataGrid rows={rows} columns={columns} loading={loading} getRowId={r => r.id} pageSizeOptions={[25, 50]} density="compact" />
      </Box>
      {detailOrder && <ShopOrderDetailModal open order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={load} />}
    </Box>
  )
}
