import React, { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import PropTypes from 'prop-types'
import { useAppContext } from '../../context/AppContext'
import { fetchModelBomsByModel, createModelBom, updateModelBom, deleteModelBom } from '../../api/modelApi'
import { fetchMaterials } from '../../api/materialApi'
import { syncBomFromModelBoms } from '../../api/bomApi'

// Inline form for add/edit a BOM item row
function BomItemForm({ initial, materials, onSave, onCancel, saving }) {
  const [materialId, setMaterialId] = useState(initial?.materialId ?? '')
  const [qtyPerUnit, setQtyPerUnit] = useState(initial?.qtyPerUnit != null ? String(initial.qtyPerUnit) : '')
  const [warehouseQty, setWarehouseQty] = useState(initial?.warehouseQty != null ? String(initial.warehouseQty) : '')
  const [warehouseUnit, setWarehouseUnit] = useState(initial?.warehouseUnit ?? '')
  const [bomUnitPerWarehouseUnit, setBomUnitPerWarehouseUnit] = useState(initial?.bomUnitPerWarehouseUnit != null ? String(initial.bomUnitPerWarehouseUnit) : '')
  const [err, setErr] = useState('')

  const toNumberOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  const warehouseQtyNumber = toNumberOrNull(warehouseQty)
  const ratioNumber = toNumberOrNull(bomUnitPerWarehouseUnit)
  const hasWarehouseConversion = warehouseQty !== '' || bomUnitPerWarehouseUnit !== ''
  const convertedQty = warehouseQtyNumber !== null && ratioNumber !== null && warehouseQtyNumber > 0 && ratioNumber > 0
    ? warehouseQtyNumber * ratioNumber
    : null

  function handleSubmit(e) {
    e.preventDefault()
    if (!materialId) { setErr('Material is required'); return }
    if (hasWarehouseConversion) {
      if (warehouseQtyNumber === null || warehouseQtyNumber <= 0) { setErr('Warehouse qty must be positive'); return }
      if (ratioNumber === null || ratioNumber <= 0) { setErr('BOM qty / warehouse unit must be positive'); return }
    }
    const qty = convertedQty !== null ? convertedQty : parseFloat(qtyPerUnit)
    if (isNaN(qty) || qty <= 0) { setErr('Qty per unit must be a positive number'); return }
    setErr('')
    onSave({
      materialId,
      qtyPerUnit: qty,
      warehouseQty: warehouseQtyNumber,
      warehouseUnit: warehouseUnit.trim() || null,
      bomUnitPerWarehouseUnit: ratioNumber
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mt: 1 }}>
        <TextField
          select
          SelectProps={{ native: true }}
          label="Material"
          value={materialId}
          onChange={e => setMaterialId(e.target.value)}
          size="small"
          sx={{ minWidth: 220 }}
          disabled={saving}
        >
          <option value="">-- select --</option>
          {materials.map(m => (
            <option key={m.id} value={m.id}>{m.materialCode} — {m.materialName}</option>
          ))}
        </TextField>
        <TextField
          label="Warehouse Qty"
          value={warehouseQty}
          onChange={e => setWarehouseQty(e.target.value)}
          size="small"
          sx={{ width: 130 }}
          disabled={saving}
          inputProps={{ step: 'any', min: 0 }}
          type="number"
        />
        <TextField
          label="Warehouse Unit"
          value={warehouseUnit}
          onChange={e => setWarehouseUnit(e.target.value)}
          size="small"
          sx={{ width: 130 }}
          disabled={saving}
        />
        <TextField
          label="BOM Qty / Wh Unit"
          value={bomUnitPerWarehouseUnit}
          onChange={e => setBomUnitPerWarehouseUnit(e.target.value)}
          size="small"
          sx={{ width: 150 }}
          disabled={saving}
          inputProps={{ step: 'any', min: 0 }}
          type="number"
        />
        <TextField
          label="Qty / Unit"
          value={convertedQty !== null ? String(convertedQty) : qtyPerUnit}
          onChange={convertedQty !== null ? undefined : e => setQtyPerUnit(e.target.value)}
          size="small"
          sx={{ width: 120 }}
          disabled={saving || convertedQty !== null}
          inputProps={{ step: 'any', min: 0 }}
          type="number"
        />
        <Button type="submit" variant="contained" size="small" disabled={saving}>
          {saving ? <CircularProgress size={16} /> : (initial ? 'Update' : 'Add')}
        </Button>
        <Button size="small" onClick={onCancel} disabled={saving}>Cancel</Button>
      </Box>
      {err && <Box sx={{ color: 'error.main', fontSize: 12, mt: 0.5 }}>{err}</Box>}
    </form>
  )
}

export default function ModelBomDialog({ open, onClose, model }) {
  const { tenantId, companyId } = useAppContext()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [syncStatus, setSyncStatus] = useState(null) // { ok, msg }
  const [syncing, setSyncing]       = useState(false)

  // Load BOM items when dialog opens
  useEffect(() => {
    if (!open || !model?.id) return
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [bomRows, mats] = await Promise.all([
          fetchModelBomsByModel(model.id, { tenantId, companyId }),
          fetchMaterials ? fetchMaterials() : Promise.resolve([])
        ])
        if (!mounted) return
        setItems(Array.isArray(bomRows) ? bomRows : [])
        setMaterials(Array.isArray(mats) ? mats : [])
      } catch (e) {
        if (mounted) setError('Failed to load BOM items: ' + (e?.message || e))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [open, model, tenantId, companyId])

  async function handleAdd({ materialId, qtyPerUnit }) {
    setSavingId('new')
    setError('')
    try {
      const created = await createModelBom({ modelId: model.id, materialId, qtyPerUnit }, { tenantId, companyId })
      setItems(prev => [...prev, created])
      setShowAddForm(false)
    } catch (e) {
      setError('Add failed: ' + (e?.message || e))
    } finally {
      setSavingId(null)
    }
  }

  async function handleUpdate(id, { materialId, qtyPerUnit }) {
    setSavingId(id)
    setError('')
    try {
      const updated = await updateModelBom(id, { materialId, qtyPerUnit }, { tenantId, companyId })
      setItems(prev => prev.map(it => it.id === id ? updated : it))
      setEditingId(null)
    } catch (e) {
      setError('Update failed: ' + (e?.message || e))
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this BOM item?')) return
    setSavingId(id)
    setError('')
    try {
      await deleteModelBom(id)
      setItems(prev => prev.filter(it => it.id !== id))
    } catch (e) {
      setError('Delete failed: ' + (e?.message || e))
    } finally {
      setSavingId(null)
    }
  }

  function downloadCsv() {
    if (!items.length) { alert('No BOM data to download'); return }
    const header = ['modelCode', 'modelName', 'materialCode', 'materialName', 'warehouseQty', 'warehouseUnit', 'bomUnitPerWarehouseUnit', 'qtyPerUnit', 'hsCode', 'coCriteria']
    const rows = items.map(it => [
      model?.modelCode ?? '',
      model?.modelName ?? '',
      it.materialCode ?? '',
      it.materialName ?? '',
      it.warehouseQty ?? '',
      it.warehouseUnit ?? '',
      it.bomUnitPerWarehouseUnit ?? '',
      it.qtyPerUnit ?? '',
      model?.hsCode ?? '',
      model?.coCriteria ?? ''
    ])
    const csv = [header.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model?.modelCode ?? 'model'}-bom.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  async function handleSync() {
    if (!model?.id) return
    setSyncing(true); setSyncStatus(null); setError('')
    try {
      const bom = await syncBomFromModelBoms(model.id)
      setSyncStatus({ ok: true, msg: `BOM v${bom.version} synced as ACTIVE ✓` })
    } catch (e) {
      setSyncStatus({ ok: false, msg: e.message || 'Sync failed' })
    } finally {
      setSyncing(false)
    }
  }

  const isBusy = !!savingId

  return (
    <Dialog open={!!open} onClose={isBusy ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>BOM Items — {model?.modelCode} | {model?.modelName}</span>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {model?.hsCode && <Chip label={`HS: ${model.hsCode}`} size="small" variant="outlined" />}
          {model?.coCriteria && <Chip label={`CO: ${model.coCriteria}`} size="small" variant="outlined" color="primary" />}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && <Box sx={{ color: 'error.main', mb: 1, fontSize: 13 }}>{error}</Box>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Material Code</TableCell>
                  <TableCell>Material Name</TableCell>
                  <TableCell align="right">Warehouse Qty</TableCell>
                  <TableCell>Warehouse Unit</TableCell>
                  <TableCell align="right">BOM Qty / Wh Unit</TableCell>
                  <TableCell align="right">Qty / Unit</TableCell>
                  <TableCell align="center" width={100}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 3 }}>No BOM items. Use Add to create one.</TableCell></TableRow>
                )}
                {items.map(it => (
                  <React.Fragment key={it.id}>
                    <TableRow hover>
                      <TableCell>{it.materialCode}</TableCell>
                      <TableCell>{it.materialName}</TableCell>
                      <TableCell align="right">{it.warehouseQty ?? ''}</TableCell>
                      <TableCell>{it.warehouseUnit ?? ''}</TableCell>
                      <TableCell align="right">{it.bomUnitPerWarehouseUnit ?? ''}</TableCell>
                      <TableCell align="right">{it.qtyPerUnit}</TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => { setEditingId(it.id); setShowAddForm(false) }} disabled={isBusy}><EditIcon fontSize="inherit" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(it.id)} disabled={isBusy || savingId === it.id}>{savingId === it.id ? <CircularProgress size={14} /> : <DeleteIcon fontSize="inherit" />}</IconButton>
                      </TableCell>
                    </TableRow>
                    {editingId === it.id && (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ background: '#f9f9f9' }}>
                          <BomItemForm
                            initial={it}
                            materials={materials}
                            saving={savingId === it.id}
                            onSave={(payload) => handleUpdate(it.id, payload)}
                            onCancel={() => setEditingId(null)}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>

            {showAddForm && (
              <Box sx={{ mt: 2, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <BomItemForm
                  materials={materials}
                  saving={savingId === 'new'}
                  onSave={handleAdd}
                  onCancel={() => setShowAddForm(false)}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button startIcon={<AddIcon />} onClick={() => { setShowAddForm(true); setEditingId(null) }} disabled={isBusy || showAddForm}>Add Item</Button>
        <Button onClick={downloadCsv} disabled={isBusy || items.length === 0}>Download CSV</Button>
        <Box sx={{ flex: 1 }} />
        {syncStatus && (
          <Chip
            label={syncStatus.msg}
            color={syncStatus.ok ? 'success' : 'error'}
            size="small"
            onDelete={() => setSyncStatus(null)}
            sx={{ mr: 1 }}
          />
        )}
        <Button
          variant="outlined"
          color="secondary"
          onClick={handleSync}
          disabled={isBusy || syncing || items.length === 0}
          startIcon={syncing ? <CircularProgress size={16} /> : null}
        >
          {syncing ? 'Syncing…' : 'Sync → BOM'}
        </Button>
        <Button onClick={onClose} disabled={isBusy}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

ModelBomDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  model: PropTypes.object
}