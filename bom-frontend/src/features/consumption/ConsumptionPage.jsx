import React, { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import RefreshIcon from '@mui/icons-material/Refresh'
import DownloadIcon from '@mui/icons-material/Download'
import { useAppContext } from '../../context/AppContext'
import { apiFetchJson } from '../../api/client'
import { numFmt, dateFmt } from '../../utils/format'

export default function ConsumptionPage() {
  const { tenantId, companyId } = useAppContext()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // filter state
  const [filterOrderNumber, setFilterOrderNumber] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterMaterialId, setFilterMaterialId] = useState('')
  const [filterInventoryId, setFilterInventoryId] = useState('')
  const [filterCheckedBy, setFilterCheckedBy] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  const toDatetimeLocal = (d) => { const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  const applyCreatedRangePreset = (preset) => {
    setCreatedRangePreset(preset)
    if (!preset) { setFilterCreatedFrom(''); setFilterCreatedTo(''); return }
    const now = new Date()
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const te = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    if (preset === 'today') { setFilterCreatedFrom(toDatetimeLocal(ts)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset === 'yesterday') { const ys=new Date(ts); ys.setDate(ys.getDate()-1); const ye=new Date(te); ye.setDate(ye.getDate()-1); setFilterCreatedFrom(toDatetimeLocal(ys)); setFilterCreatedTo(toDatetimeLocal(ye)) }
    else if (preset === 'this_week') { const ws=new Date(ts); ws.setDate(ws.getDate()-now.getDay()); setFilterCreatedFrom(toDatetimeLocal(ws)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset.startsWith('last_')) { const d=parseInt(preset.replace('last_',''),10); const f=new Date(ts); f.setDate(f.getDate()-(d-1)); setFilterCreatedFrom(toDatetimeLocal(f)); setFilterCreatedTo(toDatetimeLocal(te)) }
  }

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true); setError('')
    try {
      // Query the order_consumption_view via a dedicated endpoint
      const params = new URLSearchParams({ tenantId, companyId })
      const { res, data } = await apiFetchJson(`/bom/order-consumption?${params}`)
      if (!res.ok) throw new Error('Failed to load consumption data')
      setRows((Array.isArray(data) ? data : []).map((r, i) => ({ ...r, _id: r.id || i })))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [tenantId, companyId])

  useEffect(() => { load() }, [load])

  const columns = [
    { field: 'orderNumber', headerName: 'Order #', width: 160,
      renderCell: ({ value }) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{value}</span> },
    { field: 'orderId', headerName: 'Order UUID', flex: 1, minWidth: 200,
      renderCell: ({ value }) => value
        ? <Tooltip title={value}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{value}</span></Tooltip>
        : '—' },
    { field: 'orderStatus', headerName: 'Order Status', width: 150,
      renderCell: ({ value }) => {
        const color = { DRAFT:'default', CONFIRMED:'primary', MATERIAL_READY:'warning',
          IN_PRODUCTION:'warning', COMPLETED:'success', DELIVERED:'success', CANCELLED:'error' }
        return <Chip label={value} size="small" color={color[value] || 'default'} />
      }},
    { field: 'deliveryDateTime', headerName: 'Delivery', width: 170,
      valueFormatter: v => dateFmt(v, '—') },
    { field: 'materialCode', headerName: 'Material Code', width: 150 },
    { field: 'materialName', headerName: 'Material Name', width: 200 },
    { field: 'materialId', headerName: 'Material UUID', flex: 1, minWidth: 200,
      renderCell: ({ value }) => value
        ? <Tooltip title={value}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{value}</span></Tooltip>
        : '—' },
    { field: 'deductedInventoryId', headerName: 'Deducted Inventory UUID', flex: 1, minWidth: 200,
      renderCell: ({ value }) => value
        ? <Tooltip title={value}><span style={{ fontFamily: 'monospace', fontSize: 11, color: '#1565c0' }}>{value}</span></Tooltip>
        : <span style={{ color: '#bbb' }}>—</span> },
    { field: 'plannedQty',   headerName: 'Planned Qty',   width: 120, type: 'number', valueFormatter: numFmt },
    { field: 'adjustedQty',  headerName: 'Adjusted Qty',  width: 130, type: 'number', valueFormatter: numFmt },
    { field: 'availableQty', headerName: 'Available Qty', width: 130, type: 'number', valueFormatter: numFmt },
    { field: 'checkResult', headerName: 'Check', width: 120,
      renderCell: ({ value }) => value
        ? <Chip label={value} size="small"
            color={value === 'SUFFICIENT' ? 'success' : 'error'}
            variant="outlined" />
        : '—' },
    { field: 'updatedBy', headerName: 'Checked By', width: 130,
      renderCell: ({ value }) => value
        ? <span style={{ fontWeight: 500 }}>{value}</span>
        : <span style={{ color: '#aaa' }}>—</span> },
    { field: 'createdAt', headerName: 'Checked At', width: 170, valueFormatter: dateFmt },
  ]

  const filteredRows = rows.filter(r => {
    const s = v => (v == null ? '' : String(v)).toLowerCase()
    if (filterOrderNumber && !s(r.orderNumber).includes(filterOrderNumber.toLowerCase())) return false
    if (filterMaterial && !s(r.materialCode).includes(filterMaterial.toLowerCase()) && !s(r.materialName).includes(filterMaterial.toLowerCase())) return false
    if (filterMaterialId && !s(r.materialId).includes(filterMaterialId.toLowerCase())) return false
    if (filterInventoryId && !s(r.deductedInventoryId).includes(filterInventoryId.toLowerCase())) return false
    if (filterCheckedBy && !s(r.updatedBy).includes(filterCheckedBy.toLowerCase())) return false
    if (filterCreatedFrom || filterCreatedTo) {
      const d = r.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d)) return false
      if (filterCreatedFrom && d < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo   && d > new Date(filterCreatedTo))   return false
    }
    return true
  })

  const filteredIds = new Set(filteredRows.map(r => r._id))
  const selectedIds = selectionModel.type === 'exclude'
    ? filteredRows.map(r => r._id).filter(id => !selectionModel.ids.has(id))
    : Array.from(selectionModel.ids ?? []).filter(id => filteredIds.has(id))

  const exportRows = selectedIds.length > 0
    ? filteredRows.filter(r => selectedIds.includes(r._id))
    : filteredRows

  const buildExportData = () => exportRows.map(r => ({
    'Order #':                 r.orderNumber ?? '',
    'Order UUID':              r.orderId ?? '',
    'Order Status':            r.orderStatus ?? '',
    'Delivery':                dateFmt(r.deliveryDateTime),
    'Material Code':           r.materialCode ?? '',
    'Material Name':           r.materialName ?? '',
    'Material UUID':           r.materialId ?? '',
    'Deducted Inventory UUID': r.deductedInventoryId ?? '',
    'Planned Qty':             r.plannedQty ?? '',
    'Adjusted Qty':            r.adjustedQty ?? '',
    'Available Qty':           r.availableQty ?? '',
    'Check Result':            r.checkResult ?? '',
    'Checked By':              r.updatedBy ?? '',
    'Checked At':              dateFmt(r.createdAt),
  }))

  const handleDownloadXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(buildExportData())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Consumption')
    XLSX.writeFile(wb, `order_consumption_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const handleDownloadCsv = () => {
    const ws = XLSX.utils.json_to_sheet(buildExportData())
    const csv = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `order_consumption_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} selected consumption record(s)? This cannot be undone.`)) return
    try {
      const { res } = await apiFetchJson(`/bom/order-consumption/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedIds),
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      setRows(prev => prev.filter(r => !selectedIds.includes(r._id)))
      setSelectionModel({ type: 'include', ids: new Set() })
    } catch (e) {
      alert('Delete failed: ' + e.message)
    }
  }

  const handleSelectionModelChange = (model) => {
    if (model && model.type === 'exclude') {
      const excluded = model.ids ?? new Set()
      setSelectionModel({ type: 'include', ids: new Set(filteredRows.map(r => r._id).filter(id => !excluded.has(id))) })
    } else { setSelectionModel(model) }
  }

  const inputStyle = { fontSize: 12, padding: '3px 6px' }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Order Consumption</Typography>
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'flex-end' }}>

        {[
          { label: 'Order #',       value: filterOrderNumber,  set: setFilterOrderNumber,  ph: 'Filter Order #',      w: 130 },
          { label: 'Material Code', value: filterMaterial,     set: setFilterMaterial,     ph: 'Code / Name',         w: 130 },
          { label: 'Material UUID', value: filterMaterialId,   set: setFilterMaterialId,   ph: 'Material UUID',       w: 160 },
          { label: 'Inventory UUID',value: filterInventoryId,  set: setFilterInventoryId,  ph: 'Order / Inv. UUID',   w: 160 },
          { label: 'Checked By',    value: filterCheckedBy,    set: setFilterCheckedBy,    ph: 'Checked By',          w: 120 },
        ].map(({ label, value, set, ph, w }) => (
          <Box key={label} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <input value={value} onChange={e => set(e.target.value)} placeholder={ph}
              style={{ ...inputStyle, width: w }} />
          </Box>
        ))}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Quick Range</Typography>
          <select value={createdRangePreset} onChange={e => applyCreatedRangePreset(e.target.value)} style={{ ...inputStyle, height: 24 }}>
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
            style={inputStyle} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Created To</Typography>
          <input type="datetime-local" value={filterCreatedTo}
            onChange={e => { setCreatedRangePreset(''); setFilterCreatedTo(e.target.value) }}
            style={inputStyle} />
        </Box>

        <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-end' }}
          onClick={() => {
            setFilterOrderNumber(''); setFilterMaterial(''); setFilterMaterialId('')
            setFilterInventoryId(''); setFilterCheckedBy('')
            setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('')
          }}>
          Clear
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'flex-end' }}>
          {filteredRows.length} / {rows.length}
        </Typography>

        {/* Export buttons */}
        <Tooltip title={selectedIds.length > 0 ? `Export ${selectedIds.length} selected rows` : `Export all ${filteredRows.length} filtered rows`}>
          <span>
            <Button size="small" variant="outlined" color="success" startIcon={<DownloadIcon />}
              onClick={handleDownloadXlsx} disabled={filteredRows.length === 0}
              sx={{ alignSelf: 'flex-end' }}>
              XLSX
            </Button>
          </span>
        </Tooltip>
        <Tooltip title={selectedIds.length > 0 ? `Export ${selectedIds.length} selected rows` : `Export all ${filteredRows.length} filtered rows`}>
          <span>
            <Button size="small" variant="outlined" color="success" startIcon={<DownloadIcon />}
              onClick={handleDownloadCsv} disabled={filteredRows.length === 0}
              sx={{ alignSelf: 'flex-end' }}>
              CSV
            </Button>
          </span>
        </Tooltip>

        <Button
          size="small" variant="outlined" color="error"
          disabled={selectedIds.length === 0}
          onClick={handleDeleteSelected}
          sx={{ alignSelf: 'flex-end' }}>
          Delete Selected ({selectedIds.length})
        </Button>
      </Box>

      {(!tenantId || !companyId) && <Alert severity="warning" sx={{ mb: 2 }}>Select Tenant and Company.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <DataGrid
        rows={filteredRows} columns={columns} getRowId={r => r._id}
        loading={loading} autoHeight
        checkboxSelection
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={handleSelectionModelChange}
        disableRowSelectionOnClick={false}
        pageSizeOptions={[20, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 20 } } }}
        sx={{ background: '#fff', borderRadius: 2 }}
      />
    </Box>
  )
}