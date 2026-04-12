import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Button from '@mui/material/Button'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAppContext } from '../../context/AppContext'
import { apiFetchJson } from '../../api/client'
import { numFmt4, dateFmt } from '../../utils/format'

const STATUS_COLORS = {
  PROVISIONAL: 'default',
  FINALIZED:   'success',
  CANCELLED:   'error',
}

const ORDER_STATUS_COLORS = {
  DRAFT:           'default',
  CONFIRMED:       'primary',
  MATERIAL_READY:  'warning',
  IN_PRODUCTION:   'warning',
  COMPLETED:       'success',
  DELIVERED:       'success',
  CANCELLED:       'error',
}

export default function ConsumptionLogPage() {
  const { tenantId, companyId } = useAppContext()
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  // filter state
  const [filterOrderNumber, setFilterOrderNumber] = useState('')
  const [filterMaterial,    setFilterMaterial]    = useState('')
  const [filterStatus,      setFilterStatus]      = useState('')
  const [filterInvId,       setFilterInvId]       = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo,   setFilterCreatedTo]   = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')

  const toDatetimeLocal = (d) => {
    const p = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const applyCreatedRangePreset = (preset) => {
    setCreatedRangePreset(preset)
    if (!preset) { setFilterCreatedFrom(''); setFilterCreatedTo(''); return }
    const now = new Date()
    const ts  = new Date(now.getFullYear(), now.getMonth(), now.getDate(),  0, 0, 0)
    const te  = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59)
    if (preset === 'today') {
      setFilterCreatedFrom(toDatetimeLocal(ts)); setFilterCreatedTo(toDatetimeLocal(te))
    } else if (preset === 'yesterday') {
      const ys=new Date(ts); ys.setDate(ys.getDate()-1)
      const ye=new Date(te); ye.setDate(ye.getDate()-1)
      setFilterCreatedFrom(toDatetimeLocal(ys)); setFilterCreatedTo(toDatetimeLocal(ye))
    } else if (preset === 'this_week') {
      const ws=new Date(ts); ws.setDate(ws.getDate()-now.getDay())
      setFilterCreatedFrom(toDatetimeLocal(ws)); setFilterCreatedTo(toDatetimeLocal(te))
    } else if (preset.startsWith('last_')) {
      const d=parseInt(preset.replace('last_',''),10)
      const f=new Date(ts); f.setDate(f.getDate()-(d-1))
      setFilterCreatedFrom(toDatetimeLocal(f)); setFilterCreatedTo(toDatetimeLocal(te))
    }
  }

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ tenantId, companyId })
      const { res, data } = await apiFetchJson(`/bom/order-consumption-log?${params}`)
      if (!res.ok) throw new Error('Failed to load consumption log data')
      setRows((Array.isArray(data) ? data : []).map((r, i) => ({ ...r, _id: r.id || i })))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [tenantId, companyId])

  useEffect(() => { load() }, [load])

  const columns = [
    { field: 'orderNumber', headerName: 'Order #', width: 160,
      renderCell: ({ value }) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</span>
      )},
    { field: 'orderStatus', headerName: 'Order Status', width: 150,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={ORDER_STATUS_COLORS[value] || 'default'} />
      )},
    { field: 'materialCode', headerName: 'Material Code', width: 150 },
    { field: 'materialName', headerName: 'Material Name', width: 200 },
    { field: 'plannedQty',         headerName: 'Planned Qty',     width: 120, type: 'number', valueFormatter: numFmt4 },
    { field: 'effectivePlannedQty',headerName: 'Eff. Planned Qty',width: 140, type: 'number', valueFormatter: numFmt4 },
    { field: 'realConsumptionQty', headerName: 'Real Qty',        width: 120, type: 'number', valueFormatter: v => numFmt4(v) || '—' },
    { field: 'varianceQty',        headerName: 'Variance',        width: 110, type: 'number', valueFormatter: v => numFmt4(v) || '—',
      cellClassName: ({ value }) => value != null && Number(value) !== 0 ? 'variance-nonzero' : '' },
    {
      field: 'deductedInventoryId',
      headerName: 'Deducted Inventory ID',
      width: 290,
      renderCell: ({ value }) => value
        ? (
          <Tooltip title={value}>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1565c0' }}>
              {value}
            </span>
          </Tooltip>
        )
        : <span style={{ color: '#bbb' }}>—</span>,
    },
    { field: 'status', headerName: 'Log Status', width: 130,
      renderCell: ({ value }) => (
        <Chip label={value} size="small"
          color={STATUS_COLORS[value] || 'default'}
          variant="outlined" />
      )},
    { field: 'createdAt', headerName: 'Created At', width: 170, valueFormatter: dateFmt },
    { field: 'updatedAt', headerName: 'Updated At', width: 170, valueFormatter: dateFmt },
  ]

  const filteredRows = rows.filter(r => {
    const s = v => (v == null ? '' : String(v)).toLowerCase()
    if (filterOrderNumber && !s(r.orderNumber).includes(filterOrderNumber.toLowerCase())) return false
    if (filterMaterial && !s(r.materialCode).includes(filterMaterial.toLowerCase())
                       && !s(r.materialName).includes(filterMaterial.toLowerCase())) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterInvId && !s(r.deductedInventoryId).includes(filterInvId.toLowerCase())) return false
    if (filterCreatedFrom || filterCreatedTo) {
      const d = r.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d)) return false
      if (filterCreatedFrom && d < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo   && d > new Date(filterCreatedTo))   return false
    }
    return true
  })

  const clearFilters = () => {
    setFilterOrderNumber(''); setFilterMaterial('')
    setFilterStatus(''); setFilterInvId('')
    setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('')
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Order Consumption Log</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={load}><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'flex-end' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Order #</Typography>
          <input value={filterOrderNumber} onChange={e => setFilterOrderNumber(e.target.value)}
            placeholder="Filter Order #" style={{ fontSize: 12, padding: '3px 6px', width: 140 }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Material</Typography>
          <input value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)}
            placeholder="Filter Material" style={{ fontSize: 12, padding: '3px 6px', width: 140 }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Log Status</Typography>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', height: 24 }}>
            <option value="">— All —</option>
            <option value="PROVISIONAL">PROVISIONAL</option>
            <option value="FINALIZED">FINALIZED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Inventory ID</Typography>
          <input value={filterInvId} onChange={e => setFilterInvId(e.target.value)}
            placeholder="Filter Inv. ID" style={{ fontSize: 12, padding: '3px 6px', width: 140 }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Quick Range</Typography>
          <select value={createdRangePreset} onChange={e => applyCreatedRangePreset(e.target.value)}
            style={{ fontSize: 12, padding: '3px 6px', height: 24 }}>
            <option value="">— All —</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_7">Last 7 Days</option>
            <option value="last_14">Last 14 Days</option>
            <option value="last_30">Last 30 Days</option>
            <option value="last_60">Last 60 Days</option>
            <option value="last_90">Last 90 Days</option>
          </select>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Created From</Typography>
          <input type="datetime-local" value={filterCreatedFrom}
            onChange={e => { setCreatedRangePreset(''); setFilterCreatedFrom(e.target.value) }}
            style={{ fontSize: 12, padding: '3px 6px' }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Created To</Typography>
          <input type="datetime-local" value={filterCreatedTo}
            onChange={e => { setCreatedRangePreset(''); setFilterCreatedTo(e.target.value) }}
            style={{ fontSize: 12, padding: '3px 6px' }} />
        </Box>
        <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-end' }} onClick={clearFilters}>
          Clear
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'flex-end' }}>
          {filteredRows.length} / {rows.length}
        </Typography>
      </Box>

      {(!tenantId || !companyId) && (
        <Alert severity="warning" sx={{ mb: 2 }}>Select Tenant and Company.</Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataGrid
        rows={filteredRows}
        columns={columns}
        getRowId={r => r._id}
        loading={loading}
        autoHeight
        pageSizeOptions={[20, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
        sx={{
          background: '#fff',
          borderRadius: 2,
          '& .variance-nonzero': { color: '#d32f2f', fontWeight: 600 },
        }}
      />
    </Box>
  )
}
