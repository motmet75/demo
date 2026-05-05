import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import ListAltIcon from '@mui/icons-material/ListAlt'
import SyncIcon from '@mui/icons-material/Sync'
import ArchiveIcon from '@mui/icons-material/Archive'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import * as XLSX from 'xlsx' // Ensure you have installed: npm install xlsx
import { useAppContext } from '../../context/AppContext'
import { fetchBoms, createBom, updateBomName, updateBomStatus, deleteBom, syncBomFromModelBoms } from '../../api/bomApi'
import { dateFmt } from '../../utils/format'
import { apiFetchJson } from '../../api/client'
import BomItemsDialog from './BomItemsDialog'

const STATUS_COLOR = { ACTIVE: 'success', ARCHIVED: 'default', DRAFT: 'warning' }

// ... (CreateBomDialog code remains unchanged)

export default function BomGrid() {
  const { tenantId, companyId } = useAppContext()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [itemsBom,   setItemsBom]   = useState(null)  
  const [actionLoading, setActionLoading] = useState({})
  const [renameRow,  setRenameRow]  = useState(null)  
  const [renameName, setRenameName] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState('')

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 })
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  // Filters
  const [filterModelCode, setFilterModelCode] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')

  const load = useCallback(async () => {
    if (!tenantId || !companyId) return
    setLoading(true); setError('')
    try {
      const data = await fetchBoms()
      setRows(data.map(r => ({ ...r, id: r.id })))
    } catch (e) { setError(e.message || 'Failed to load BOMs') }
    finally { setLoading(false) }
  }, [tenantId, companyId])

  useEffect(() => { load() }, [load])

  // ── Action helpers ────────────────────────────────────────────────
  function setBusy(id, val) { setActionLoading(p => ({ ...p, [id]: val })) }

  async function handleActivate(row) {
    if (!window.confirm(`Activate BOM v${row.version} for ${row.modelCode}?`)) return
    setBusy(row.id, true); setError('')
    try { await updateBomStatus(row.id, 'ACTIVE'); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleArchive(row) {
    if (!window.confirm(`Archive BOM v${row.version}?`)) return
    setBusy(row.id, true); setError('')
    try {
      const updatedBom = await updateBomStatus(row.id, 'ARCHIVED')
      setRows(prev => prev.map(r => r.id === updatedBom.id ? { ...updatedBom, id: updatedBom.id } : r))
    } catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleDelete(row) {
    if (row.status === 'ACTIVE') { setError('Cannot delete an ACTIVE BOM.'); return }
    if (!window.confirm(`Delete BOM v${row.version}?`)) return
    setBusy(row.id, true); setError('')
    try { await deleteBom(row.id); setRows(prev => prev.filter(r => r.id !== row.id)) }
    catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleSync(row) {
    setBusy(row.id, true); setError('')
    try { await syncBomFromModelBoms(row.modelId); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleRenameSubmit(e) {
    e.preventDefault()
    if (!renameRow || renameSaving) return
    setRenameSaving(true); setRenameError('')
    try {
      const updated = await updateBomName(renameRow.id, renameName.trim() || null)
      setRows(prev => prev.map(r => r.id === updated.id ? { ...r, bomName: updated.bomName } : r))
      setRenameRow(null)
    } catch (e) { setRenameError(e.message || 'Rename failed') }
    finally { setRenameSaving(false) }
  }

  // ── Export Logic (Based on InventoryMovementPage.jsx) ──────────────[cite: 1]
  const filteredRows = rows.filter(r => {
    const s = v => (v == null ? '' : String(v)).toLowerCase()
    if (filterModelCode && !s(r.modelCode).includes(filterModelCode.toLowerCase())) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  })

  const selectedIds = Array.from(selectionModel.ids ?? [])

  const buildExportRows = (ids) => {
    const idSet = new Set(ids)
    return filteredRows.filter(r => idSet.has(r.id)).map(r => ({
      'UUID': r.id ?? '',
      'Model Code': r.modelCode ?? '',
      'BOM Name': r.bomName ?? '',
      'Version': r.version ?? '',
      'Status': r.status ?? '',
      'Created At': dateFmt(r.createdAt, '—')
    }))
  }

  const handleExportXlsx = () => {
    const data = buildExportRows(selectedIds.length > 0 ? selectedIds : filteredRows.map(r => r.id))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'BOMs')
    XLSX.writeFile(wb, `boms_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // ── Columns ───────────────────────────────────────────────────────
  const columns = [
    {
      field: 'id',
      headerName: 'BOM UUID',
      width: 200,
      renderCell: ({ value }) => (
        <span 
          title="Click to copy" 
          style={{ fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', color: '#666' }}
          onClick={() => navigator.clipboard?.writeText(value)}
        >
          {value}
        </span>
      )
    },
    { field: 'modelCode', headerName: 'Model Code', width: 140 },
    { field: 'bomName', headerName: 'BOM Name', flex: 1, minWidth: 140 },
    { field: 'version', headerName: 'Version', width: 90, type: 'number' },
    { field: 'status', headerName: 'Status', width: 110, renderCell: ({ value }) => <Chip label={value} size="small" color={STATUS_COLOR[value] || 'default'} /> },
    { field: 'createdAt', headerName: 'Created At', width: 160, renderCell: ({ value }) => dateFmt(value, '—') },
    {
      field: '_actions',
      headerName: 'Actions',
      width: 240,
      sortable: false,
      renderCell: ({ row }) => {
        const busy = !!actionLoading[row.id]
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Edit Items"><IconButton size="small" onClick={() => setItemsBom(row)} disabled={busy}><ListAltIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Rename"><IconButton size="small" color="primary" onClick={() => { setRenameRow(row); setRenameName(row.bomName || ''); }} disabled={busy}><EditIcon fontSize="small" /></IconButton></Tooltip>
            {row.status !== 'ACTIVE' && (
              <Tooltip title="Activate"><IconButton size="small" color="success" onClick={() => handleActivate(row)} disabled={busy}>{busy ? <CircularProgress size={16} /> : <CheckCircleIcon fontSize="small" />}</IconButton></Tooltip>
            )}
            <Tooltip title="Archive"><IconButton size="small" color="warning" onClick={() => handleArchive(row)} disabled={busy}><ArchiveIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Sync"><IconButton size="small" color="info" onClick={() => handleSync(row)} disabled={busy}><SyncIcon fontSize="small" /></IconButton></Tooltip>
            {row.status !== 'ACTIVE' && (
              <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(row)} disabled={busy}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
            )}
          </Box>
        )
      }
    }
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>BOM Management</Typography>
        <Button variant="outlined" color="success" size="small" onClick={handleExportXlsx}>Export XLSX {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</Button>
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New BOM</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <DataGrid
        rows={filteredRows}
        columns={columns}
        loading={loading}
        checkboxSelection
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={setSelectionModel}
        autoHeight
        sx={{ background: '#fff', borderRadius: 2 }}
      />

      {/* Dialogs remain exactly as per your source logic */}
      <BomItemsDialog open={!!itemsBom} bom={itemsBom} onClose={() => setItemsBom(null)} />
      {/* ... (Rename dialog) */}
    </Box>
  )
}