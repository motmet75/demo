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
import { useAppContext } from '../../context/AppContext'
import { fetchBoms, createBom, updateBomStatus, deleteBom, syncBomFromModelBoms } from '../../api/bomApi'
import { apiFetchJson } from '../../api/client'
import BomItemsDialog from './BomItemsDialog'

const STATUS_COLOR = { ACTIVE: 'success', ARCHIVED: 'default', DRAFT: 'warning' }

// ── Create BOM dialog ─────────────────────────────────────────────────
function CreateBomDialog({ open, onClose, onCreated }) {
  const [models, setModels] = useState([])
  const [form, setForm]     = useState({ modelId: '', version: '1', status: 'DRAFT' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!open) return
    apiFetchJson('/bom/api/models').then(({ data }) => {
      const list = Array.isArray(data) ? data : (data?.content ?? [])
      setModels(list)
    }).catch(() => {})
    setForm({ modelId: '', version: '1', status: 'DRAFT' })
    setError('')
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.modelId) { setError('Model is required'); return }
    setSaving(true); setError('')
    try {
      const bom = await createBom({ modelId: form.modelId, version: parseInt(form.version) || 1, status: form.status })
      onCreated(bom)
      onClose()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const ch = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New BOM</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField select label="Model *" value={form.modelId} onChange={ch('modelId')} disabled={saving} fullWidth>
              {models.map(m => <MenuItem key={m.id} value={m.id}>{m.modelCode} — {m.modelName}</MenuItem>)}
            </TextField>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Version" type="number" value={form.version} onChange={ch('version')} disabled={saving} sx={{ flex: 1 }} inputProps={{ min: 1 }} />
              <TextField select label="Status" value={form.status} onChange={ch('status')} disabled={saving} sx={{ flex: 1 }}>
                {['DRAFT', 'ACTIVE', 'ARCHIVED'].map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null} Create
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

// ── Main BomGrid ──────────────────────────────────────────────────────
export default function BomGrid() {
  const { tenantId, companyId } = useAppContext()

  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [itemsBom,   setItemsBom]   = useState(null)  // bom row for items dialog
  const [actionLoading, setActionLoading] = useState({})

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 20 })
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

  // filter state
  const [filterModelCode, setFilterModelCode] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')

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

  // ── Load ──────────────────────────────────────────────────────────
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
    if (!window.confirm(`Activate BOM v${row.version} for ${row.modelCode}? The current ACTIVE BOM will be archived.`)) return
    setBusy(row.id, true); setError('')
    try {
      const updated = await updateBomStatus(row.id, 'ACTIVE')
      // re-load so archived row also updates
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleArchive(row) {
    if (!window.confirm(`Archive BOM v${row.version} for ${row.modelCode}?`)) return
    setBusy(row.id, true); setError('')
    try {
      const updated = await updateBomStatus(row.id, 'ARCHIVED')
      setRows(prev => prev.map(r => r.id === updated.id ? { ...updated, id: updated.id } : r))
    } catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleDelete(row) {
    if (row.status === 'ACTIVE') { setError('Cannot delete an ACTIVE BOM. Archive it first.'); return }
    if (!window.confirm(`Delete BOM v${row.version} for ${row.modelCode}?`)) return
    setBusy(row.id, true); setError('')
    try {
      await deleteBom(row.id)
      setRows(prev => prev.filter(r => r.id !== row.id))
    } catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  async function handleSync(row) {
    setBusy(row.id, true); setError('')
    try {
      const updated = await syncBomFromModelBoms(row.modelId)
      // reload so new version appears
      await load()
    } catch (e) { setError(e.message) }
    finally { setBusy(row.id, false) }
  }

  // ── Columns ───────────────────────────────────────────────────────
  const columns = [
    { field: 'modelCode', headerName: 'Model Code', width: 140 },
    { field: 'modelName', headerName: 'Model Name', flex: 1 },
    { field: 'version',   headerName: 'Version',    width: 90,  type: 'number' },
    {
      field: 'status', headerName: 'Status', width: 120,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" color={STATUS_COLOR[value] || 'default'} />
      )
    },
    {
      field: 'createdAt', headerName: 'Created At', width: 170,
      renderCell: ({ value }) => value ? new Date(value).toLocaleString() : '—'
    },
    {
      field: '_actions', headerName: 'Actions', width: 240, sortable: false,
      renderCell: ({ row }) => {
        const busy = !!actionLoading[row.id]
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {/* View/edit items */}
            <Tooltip title="Edit BOM Items">
              <IconButton size="small" onClick={() => setItemsBom(row)} disabled={busy}>
                <ListAltIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Activate (only non-ACTIVE) */}
            {row.status !== 'ACTIVE' && (
              <Tooltip title="Set ACTIVE">
                <span>
                  <IconButton size="small" color="success" onClick={() => handleActivate(row)} disabled={busy}>
                    {busy ? <CircularProgress size={16} /> : <CheckCircleIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {/* Archive (only ACTIVE or DRAFT) */}
            {row.status !== 'ARCHIVED' && (
              <Tooltip title="Archive">
                <span>
                  <IconButton size="small" color="warning" onClick={() => handleArchive(row)} disabled={busy}>
                    <ArchiveIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {/* Sync from model_bom */}
            <Tooltip title="Re-sync from ModelBOM rows (creates new version)">
              <span>
                <IconButton size="small" color="info" onClick={() => handleSync(row)} disabled={busy}>
                  <SyncIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            {/* Delete (non-ACTIVE only) */}
            {row.status !== 'ACTIVE' && (
              <Tooltip title="Delete">
                <span>
                  <IconButton size="small" color="error" onClick={() => handleDelete(row)} disabled={busy}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        )
      }
    }
  ]

  const noCtx = !tenantId || !companyId

  const filteredRows = rows.filter(r => {
    const s = v => (v==null?'':String(v)).toLowerCase()
    if (filterModelCode && !s(r.modelCode).includes(filterModelCode.toLowerCase())) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterCreatedFrom || filterCreatedTo) {
      const d = r.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d)) return false
      if (filterCreatedFrom && d < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo   && d > new Date(filterCreatedTo))   return false
    }
    return true
  })

  const filteredIds = new Set(filteredRows.map(r => r.id))
  const selectedIds = selectionModel.type === 'exclude'
    ? filteredRows.map(r => r.id).filter(id => !selectionModel.ids.has(id))
    : Array.from(selectionModel.ids ?? []).filter(id => filteredIds.has(id))

  const handleSelectionModelChange = (model) => {
    if (model && model.type === 'exclude') {
      const excluded = model.ids ?? new Set()
      setSelectionModel({ type: 'include', ids: new Set(filteredRows.map(r => r.id).filter(id => !excluded.has(id))) })
    } else { setSelectionModel(model) }
  }

  return (
    <Box>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>BOMs</Typography>
        <Tooltip title="Refresh"><IconButton onClick={load}><RefreshIcon /></IconButton></Tooltip>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} disabled={noCtx}>
          New BOM
        </Button>
      </Box>

      {/* Filter bar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2, alignItems: 'flex-end' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Model Code</Typography>
          <input value={filterModelCode} onChange={e => setFilterModelCode(e.target.value)} placeholder="Filter Model Code" style={{ fontSize: 12, padding: '3px 6px', width: 140 }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Status</Typography>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', height: 24 }}>
            <option value="">All</option>
            {['DRAFT','ACTIVE','ARCHIVED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Quick Range</Typography>
          <select value={createdRangePreset} onChange={e => applyCreatedRangePreset(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', height: 24 }}>
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
          <input type="datetime-local" value={filterCreatedFrom} onChange={e => { setCreatedRangePreset(''); setFilterCreatedFrom(e.target.value) }} style={{ fontSize: 12, padding: '3px 6px' }} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Created To</Typography>
          <input type="datetime-local" value={filterCreatedTo} onChange={e => { setCreatedRangePreset(''); setFilterCreatedTo(e.target.value) }} style={{ fontSize: 12, padding: '3px 6px' }} />
        </Box>
        <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-end' }}
          onClick={() => { setFilterModelCode(''); setFilterStatus(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('') }}>
          Clear
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'flex-end' }}>{filteredRows.length} / {rows.length}</Typography>
      </Box>

      {noCtx && <Alert severity="warning" sx={{ mb: 2 }}>Select Tenant and Company to manage BOMs.</Alert>}
      {error  && <Alert severity="error"  sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <DataGrid
        rows={filteredRows}
        columns={columns}
        loading={loading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 20, 50]}
        checkboxSelection
        rowSelectionModel={selectionModel}
        onRowSelectionModelChange={handleSelectionModelChange}
        disableRowSelectionOnClick={false}
        autoHeight
        sx={{ background: '#fff', borderRadius: 2 }}
      />

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <CreateBomDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={bom => { setRows(prev => [{ ...bom, id: bom.id }, ...prev]); setCreateOpen(false) }}
      />

      <BomItemsDialog
        open={!!itemsBom}
        bom={itemsBom}
        onClose={() => setItemsBom(null)}
      />
    </Box>
  )
}
