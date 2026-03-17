import React, { useEffect, useState, useCallback } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import PropTypes from 'prop-types'
import { fetchMaterials } from '../../api/materialApi'
import { apiFetchJson } from '../../api/client'

const ORDER_TYPES = ['SALES', 'PRODUCTION', 'TRANSFER', 'INTERNAL']
const LINE_TYPES  = ['MODEL', 'MATERIAL']

const EMPTY_LINE = { lineType: 'MODEL', modelId: '', materialId: '', quantityOrdered: '', unit: 'pcs', unitPrice: '', notes: '' }

function makeEmptyHeader() {
  return { orderNumber: '', orderType: 'SALES', customerId: '', plannedStartDate: '', plannedEndDate: '', notes: '', createdBy: 'system' }
}

/**
 * Modal for creating a new order (header + lines).
 * Props:
 *   open, onClose, onCreated(order)
 */
export default function OrderCreateModal({ open, onClose, onCreated }) {
  const [header, setHeader]   = useState(makeEmptyHeader)
  const [lines, setLines]     = useState([{ ...EMPTY_LINE }])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [materials, setMaterials] = useState([])
  const [models, setModels]   = useState([])

  // Reset on open
  useEffect(() => {
    if (open) {
      setHeader(makeEmptyHeader())
      setLines([{ ...EMPTY_LINE }])
      setError('')
    }
  }, [open])

  // Load materials + models for dropdowns
  useEffect(() => {
    if (!open) return
    fetchMaterials().then(d => setMaterials(Array.isArray(d) ? d : [])).catch(() => {})
    apiFetchJson('/bom/models').then(({ data }) => {
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.content) ? data.content : [])
      setModels(list)
    }).catch(() => {})
  }, [open])

  const handleHeaderChange = (field) => (e) => setHeader(prev => ({ ...prev, [field]: e.target.value }))

  const handleLineChange = (idx, field) => (e) => {
    const val = e.target.value
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  const addLine = () => setLines(prev => [...prev, { ...EMPTY_LINE }])
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setError('')

    // Basic validation
    if (!header.orderNumber.trim()) { setError('Order number is required'); return }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (l.lineType === 'MODEL' && !l.modelId) { setError(`Line ${i + 1}: modelId is required for MODEL type`); return }
      if (l.lineType === 'MATERIAL' && !l.materialId) { setError(`Line ${i + 1}: materialId is required for MATERIAL type`); return }
      if (!l.quantityOrdered || isNaN(parseFloat(l.quantityOrdered)) || parseFloat(l.quantityOrdered) <= 0) {
        setError(`Line ${i + 1}: quantityOrdered must be a positive number`); return
      }
    }

    setSaving(true)
    try {
      const payload = {
        orderNumber:     header.orderNumber.trim(),
        orderType:       header.orderType,
        customerId:      header.customerId || null,
        plannedStartDate: header.plannedStartDate || null,
        plannedEndDate:   header.plannedEndDate || null,
        notes:           header.notes || null,
        createdBy:       header.createdBy || 'system',
        lines: lines.map(l => ({
          lineType:       l.lineType,
          modelId:        l.lineType === 'MODEL' ? (l.modelId || null) : null,
          materialId:     l.lineType === 'MATERIAL' ? (l.materialId || null) : null,
          quantityOrdered: parseFloat(l.quantityOrdered),
          unit:           l.unit || 'pcs',
          unitPrice:      l.unitPrice ? parseFloat(l.unitPrice) : null,
          notes:          l.notes || null
        }))
      }
      const { res, data } = await apiFetchJson('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`)
      onCreated && onCreated(data)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Create New Order</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* ── Header ─────────────────────────────────────────── */}
          <Typography variant="subtitle2" gutterBottom>Order Header</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <TextField label="Order Number *" value={header.orderNumber} onChange={handleHeaderChange('orderNumber')} disabled={saving} fullWidth />
            <TextField select label="Order Type *" value={header.orderType} onChange={handleHeaderChange('orderType')} disabled={saving} fullWidth>
              {ORDER_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField label="Planned Start Date" type="date" value={header.plannedStartDate} onChange={handleHeaderChange('plannedStartDate')} disabled={saving} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Planned End Date" type="date" value={header.plannedEndDate} onChange={handleHeaderChange('plannedEndDate')} disabled={saving} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Customer ID (UUID)" value={header.customerId} onChange={handleHeaderChange('customerId')} disabled={saving} fullWidth />
            <TextField label="Created By" value={header.createdBy} onChange={handleHeaderChange('createdBy')} disabled={saving} fullWidth />
            <TextField label="Notes" value={header.notes} onChange={handleHeaderChange('notes')} disabled={saving} fullWidth multiline minRows={1} sx={{ gridColumn: 'span 2' }} />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* ── Order Lines ─────────────────────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">Order Lines</Typography>
            <Button startIcon={<AddIcon />} size="small" onClick={addLine} disabled={saving}>Add Line</Button>
          </Box>

          {lines.map((line, idx) => (
            <Box key={idx} sx={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 120px 100px 100px auto', gap: 1, alignItems: 'center', mb: 1.5, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              <TextField select label="Type" value={line.lineType} onChange={handleLineChange(idx, 'lineType')} size="small" disabled={saving}>
                {LINE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>

              {line.lineType === 'MODEL' ? (
                <TextField select label="Model *" value={line.modelId} onChange={handleLineChange(idx, 'modelId')} size="small" disabled={saving} sx={{ gridColumn: 'span 1' }}>
                  {models.map(m => <MenuItem key={m.id} value={m.id}>{m.modelCode} – {m.modelName}</MenuItem>)}
                </TextField>
              ) : (
                <TextField select label="Material *" value={line.materialId} onChange={handleLineChange(idx, 'materialId')} size="small" disabled={saving} sx={{ gridColumn: 'span 1' }}>
                  {materials.map(m => <MenuItem key={m.id} value={m.id}>{m.materialCode} – {m.materialName}</MenuItem>)}
                </TextField>
              )}

              {/* Filler when one of model/material is shown */}
              <TextField label="Notes" value={line.notes} onChange={handleLineChange(idx, 'notes')} size="small" disabled={saving} />
              <TextField label="Unit *" value={line.unit} onChange={handleLineChange(idx, 'unit')} size="small" disabled={saving} />
              <TextField label="Qty *" type="number" value={line.quantityOrdered} onChange={handleLineChange(idx, 'quantityOrdered')} size="small" disabled={saving} inputProps={{ min: 0, step: 'any' }} />
              <TextField label="Unit Price" type="number" value={line.unitPrice} onChange={handleLineChange(idx, 'unitPrice')} size="small" disabled={saving} inputProps={{ min: 0, step: 'any' }} />
              <IconButton size="small" onClick={() => removeLine(idx)} disabled={saving || lines.length === 1} color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            Create Order
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

OrderCreateModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func
}
