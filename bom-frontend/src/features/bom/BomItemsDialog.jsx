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
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import PropTypes from 'prop-types'
import { fetchBomItems, addBomItem, updateBomItem, deleteBomItem } from '../../api/bomApi'
import { fetchMaterials } from '../../api/materialApi'

const EMPTY_ROW = { materialId: '', quantity: '', level: 1 }

/**
 * Inline editable row for adding / editing a BOM item.
 */
function ItemRow({ row, materials, onSave, onCancel, saving }) {
  const [form, setForm] = useState({ materialId: row.materialId ?? '', quantity: row.quantity != null ? String(row.quantity) : '', level: row.level ?? 1 })
  const [err, setErr] = useState('')

  const ch = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  function submit(e) {
    e.preventDefault()
    if (!form.materialId) { setErr('Material is required'); return }
    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty <= 0) { setErr('Quantity must be > 0'); return }
    setErr('')
    onSave({ materialId: form.materialId, quantity: qty, level: parseInt(form.level) || 1 })
  }

  return (
    <TableRow sx={{ background: '#f9fbe7' }}>
      <TableCell colSpan={2}>
        <form onSubmit={submit}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <TextField select SelectProps={{ native: true }} label="Material *" value={form.materialId}
              onChange={ch('materialId')} size="small" sx={{ minWidth: 240 }} disabled={saving}>
              <option value="">— select material —</option>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.materialCode} — {m.materialName}</option>
              ))}
            </TextField>
            <TextField label="Qty / Unit *" type="number" value={form.quantity}
              onChange={ch('quantity')} size="small" sx={{ width: 120 }}
              inputProps={{ step: 'any', min: 0.0001 }} disabled={saving} />
            <TextField label="Level" type="number" value={form.level}
              onChange={ch('level')} size="small" sx={{ width: 80 }}
              inputProps={{ min: 1, step: 1 }} disabled={saving} />
            <Tooltip title="Save"><span>
              <IconButton type="submit" color="primary" size="small" disabled={saving}>
                {saving ? <CircularProgress size={18} /> : <SaveIcon fontSize="small" />}
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Cancel">
              <IconButton size="small" onClick={onCancel} disabled={saving}><CloseIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
          {err && <Box sx={{ color: 'error.main', fontSize: 12, mt: 0.5 }}>{err}</Box>}
        </form>
      </TableCell>
      <TableCell /><TableCell /><TableCell />
    </TableRow>
  )
}

const STATUS_COLOR = { ACTIVE: 'success', ARCHIVED: 'default', DRAFT: 'warning' }

/**
 * BomItemsDialog — popup dialog that shows all bom_items for a BOM row.
 * Supports inline add / edit / delete.
 *
 * Props: open, bom { id, modelCode, modelName, version, status }, onClose
 */
export default function BomItemsDialog({ open, bom, onClose }) {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [materials, setMaterials] = useState([])
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState(null)   // itemId currently being edited
  const [savingId,  setSavingId]  = useState(null)   // itemId (or 'new') currently saving

  // Load items + materials when dialog opens
  useEffect(() => {
    if (!open || !bom?.id) { setItems([]); return }
    let active = true
    setLoading(true); setError('')
    Promise.all([fetchBomItems(bom.id), fetchMaterials()])
      .then(([its, mats]) => {
        if (!active) return
        setItems(Array.isArray(its) ? its : [])
        setMaterials(Array.isArray(mats) ? mats : [])
      })
      .catch(e => { if (active) setError(e.message || 'Load failed') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, bom])

  // ── Add new item ──────────────────────────────────────────────────
  async function handleAdd({ materialId, quantity, level }) {
    setSavingId('new'); setError('')
    try {
      const created = await addBomItem(bom.id, { materialId, quantity, level })
      setItems(prev => [...prev, created])
      setAddingNew(false)
    } catch (e) { setError('Add failed: ' + e.message) }
    finally { setSavingId(null) }
  }

  // ── Edit existing item ────────────────────────────────────────────
  async function handleEdit(id, { materialId, quantity, level }) {
    setSavingId(id); setError('')
    try {
      const updated = await updateBomItem(id, { materialId, quantity, level })
      setItems(prev => prev.map(it => it.id === id ? updated : it))
      setEditingId(null)
    } catch (e) { setError('Update failed: ' + e.message) }
    finally { setSavingId(null) }
  }

  // ── Delete item ───────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('Delete this BOM item?')) return
    setSavingId(id); setError('')
    try {
      await deleteBomItem(id)
      setItems(prev => prev.filter(it => it.id !== id))
    } catch (e) { setError('Delete failed: ' + e.message) }
    finally { setSavingId(null) }
  }

  function getMaterialLabel(materialId) {
    const m = materials.find(x => x.id === materialId)
    return m ? `${m.materialCode} — ${m.materialName}` : materialId
  }

  const busy = !!savingId

  return (
    <Dialog open={!!open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
      {/* ── Title ─────────────────────────────────────────────────── */}
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box sx={{ flex: 1 }}>
          BOM Items — <strong>{bom?.modelCode}</strong> | {bom?.modelName}
          &nbsp;
          <Chip label={`v${bom?.version}`} size="small" variant="outlined" sx={{ mr: 0.5 }} />
          <Chip label={bom?.status} size="small" color={STATUS_COLOR[bom?.status] || 'default'} />
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2 }}>
        {error   && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box>}

        {!loading && (
          <>
            {/* ── Add button ─────────────────────────────────────── */}
            {!addingNew && (
              <Button startIcon={<AddIcon />} size="small" onClick={() => { setAddingNew(true); setEditingId(null) }}
                disabled={busy} sx={{ mb: 1 }}>
                Add Item
              </Button>
            )}

            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, background: '#f5f5f5' } }}>
                  <TableCell>Material</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Qty / Unit</TableCell>
                  <TableCell align="center">Level</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* New item inline row */}
                {addingNew && (
                  <ItemRow
                    row={EMPTY_ROW}
                    materials={materials}
                    onSave={handleAdd}
                    onCancel={() => setAddingNew(false)}
                    saving={savingId === 'new'}
                  />
                )}

                {items.length === 0 && !addingNew && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                      No BOM items yet. Click "Add Item" to start.
                    </TableCell>
                  </TableRow>
                )}

                {items.map(item => (
                  editingId === item.id
                    ? (
                      <ItemRow
                        key={item.id}
                        row={{ materialId: item.materialId, quantity: item.quantity, level: item.level }}
                        materials={materials}
                        onSave={data => handleEdit(item.id, data)}
                        onCancel={() => setEditingId(null)}
                        saving={savingId === item.id}
                      />
                    ) : (
                      <TableRow key={item.id} hover>
                        <TableCell>
                          <Box sx={{ fontWeight: 500 }}>{item.materialCode}</Box>
                          <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{item.materialName}</Box>
                        </TableCell>
                        <TableCell>{item.unit ?? '—'}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{item.quantity}</TableCell>
                        <TableCell align="center">{item.level}</TableCell>
                        <TableCell align="center">
                          <Tooltip title="Edit">
                            <span>
                              <IconButton size="small" disabled={busy}
                                onClick={() => { setEditingId(item.id); setAddingNew(false) }}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <span>
                              <IconButton size="small" color="error" disabled={busy}
                                onClick={() => handleDelete(item.id)}>
                                {savingId === item.id
                                  ? <CircularProgress size={16} />
                                  : <DeleteIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Box sx={{ flex: 1, pl: 1, fontSize: 13, color: 'text.secondary' }}>
          {items.length} item{items.length !== 1 ? 's' : ''}
        </Box>
        <Button onClick={onClose} disabled={busy}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

BomItemsDialog.propTypes = {
  open:    PropTypes.bool.isRequired,
  bom:     PropTypes.object,
  onClose: PropTypes.func.isRequired
}
