import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAppContext } from '../../context/AppContext'
import { apiFetchJson } from '../../api/client'

export default function ConsumptionPage() {
  const { tenantId, companyId } = useAppContext()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true); setError('')
    try {
      // Query the order_consumption_view via a dedicated endpoint
      const params = new URLSearchParams({ tenantId, companyId })
      const { res, data } = await apiFetchJson(`/bom/api/order-consumption?${params}`)
      if (!res.ok) throw new Error('Failed to load consumption data')
      setRows((Array.isArray(data) ? data : []).map((r, i) => ({ ...r, _id: r.id || i })))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [tenantId, companyId])

  useEffect(() => { load() }, [load])

  const columns = [
    { field: 'orderNumber', headerName: 'Order #', width: 160,
      renderCell: ({ value }) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</span> },
    { field: 'orderStatus', headerName: 'Order Status', width: 150,
      renderCell: ({ value }) => {
        const color = { DRAFT:'default', CONFIRMED:'primary', MATERIAL_READY:'warning',
          IN_PRODUCTION:'warning', COMPLETED:'success', DELIVERED:'success', CANCELLED:'error' }
        return <Chip label={value} size="small" color={color[value] || 'default'} />
      }},
    { field: 'deliveryDateTime', headerName: 'Delivery', width: 170,
      valueFormatter: v => v ? new Date(v).toLocaleString() : '—' },
    { field: 'materialCode', headerName: 'Material Code', width: 150 },
    { field: 'materialName', headerName: 'Material Name', width: 200 },
    { field: 'plannedQty', headerName: 'Planned Qty', width: 120, type: 'number',
      valueFormatter: v => v != null ? Number(v).toFixed(4) : '' },
    { field: 'adjustedQty', headerName: 'Adjusted Qty', width: 130, type: 'number',
      valueFormatter: v => v != null ? Number(v).toFixed(4) : '' },
    { field: 'availableQty', headerName: 'Available Qty', width: 130, type: 'number',
      valueFormatter: v => v != null ? Number(v).toFixed(4) : '' },
    { field: 'checkResult', headerName: 'Check', width: 120,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small"
            color={value === 'SUFFICIENT' ? 'success' : 'error'}
            variant="outlined" />
        : '—' },
    { field: 'createdAt', headerName: 'Checked At', width: 170,
      valueFormatter: v => v ? new Date(v).toLocaleString() : '' },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Order Consumption</Typography>
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {(!tenantId || !companyId) && <Alert severity="warning" sx={{ mb: 2 }}>Select Tenant and Company.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataGrid
        rows={rows} columns={columns} getRowId={r => r._id}
        loading={loading} autoHeight disableRowSelectionOnClick
        pageSizeOptions={[20, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
        sx={{ background: '#fff', borderRadius: 2 }}
      />
    </Box>
  )
}
