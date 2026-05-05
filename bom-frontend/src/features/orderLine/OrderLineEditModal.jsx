import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Autocomplete from '@mui/material/Autocomplete'
import PropTypes from 'prop-types'
import { fetchMaterials } from '../../api/materialApi'

const LINE_TYPES   = ['MODEL', 'MATERIAL']
const LINE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

const STATUS_COLOR = {
  PENDING:     'default',
  IN_PROGRESS: 'info',
  COMPLETED:   'success',
  CANCELLED:   'error',
}

const makeEmpty = (orderId) => ({
  orderId:           orderId ?? '',
  lineNumber:        '',
  lineType:          'MODEL',
  modelId:           '',
  materialId:        '',
  quantityOrdered:   '',
  quantityProduced:  '0',
  quantityDelivered: '0',
  quantityCancelled: '0',
  unit:              'pcs',
  unitPrice:         '',
  lineStatus:        'PENDING',
  bomCalculationId:  '',
  notes:             '',
})

export default function OrderLineEditModal({ open, orderLine, orderId, onClose, onSave, saving }) {
  const isEditing = !!orderLine

  const [form, setForm]         = useState(() => isEditing ? mapToForm(orderLine) : makeEmpty(orderId))
  const [submitting, setSubmit] = useState(false)
  const [error, setError]       = useState('')
  const [materials, setMaterials] = useState([])
  const [models,    setModels]    = useState([])

  // Reset form when dialog opens with a new orderLine
  useEffect(() => {
    setForm(isEditing ? mapToForm(orderLine) : makeEmpty(orderId))
    setError('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Load materials / models for autocomplete
  useEffect(() => {
    if (!open) return
    let mounted = true
    fetchMaterials()
      .then(list => {
        if (!mounted) return
        const all = Array.isArray(list) ? list : []
        const toRow = x => ({
          id:   String(x.id ?? x.uuid ?? x._id ?? ''),
          code: x.materialCode ?? x.code ?? '',
          name: x.materialName ?? x.name ?? '',
          type: x.itemType ?? x.type ?? '',   // 'MODEL' | 'MATERIAL' or similar
        })
        const mapped = all.map(toRow)
        setMaterials(mapped.filter(m => m.type !== 'MODEL'))
        setModels(mapped.filter(m => m.type === 'MODEL').length > 0
          ? mapped.filter(m => m.type === 'MODEL')
          : mapped)          // fallback: show all if no MODEL type distinction
      })
      .catch(() => {})
    return () => { mounted = false }
  }, [open])

  function mapToForm(ol) {
    return {
      orderId:           String(ol.orderId  ?? ol.order?.id ?? orderId ?? ''),
      lineNumber:        ol.lineNumber  ?? '',
      lineType:          ol.lineType    ?? 'MODEL',
      modelId:           String(ol.modelId    ?? ''),
      materialId:        String(ol.materialId ?? ''),
      quantityOrdered:   ol.quantityOrdered   ?? '',
      quantityProduced:  ol.quantityProduced  ?? '0',
      quantityDelivered: ol.quantityDelivered ?? '0',
      quantityCancelled: ol.quantityCancelled ?? '0',
      unit:              ol.unit        ?? 'pcs',
      unitPrice:         ol.unitPrice   ?? '',
      lineStatus:        ol.lineStatus  ?? 'PENDING',
      bomCalculationId:  String(ol.bomCalculationId ?? ''),
      notes:             ol.notes ?? '',
    }
  }

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting || saving) return
    setError('')

    // validation
    if (!form.lineNumber || isNaN(Number(form.lineNumber))) {
      setError('Line Number must be a valid integer'); return
    }
    if (!form.quantityOrdered || isNaN(Number(form.quantityOrdered)) || Number(form.quantityOrdered) < 0) {
      setError('Quantity Ordered must be a non-negative number'); return
    }
    if (form.lineType === 'MODEL' && !form.modelId.trim()) {
      setError('Model ID is required when Line Type is MODEL'); return
    }
    if (form.lineType === 'MATERIAL' && !form.materialId.trim()) {
      setError('Material is required when Line Type is MATERIAL'); return
    }

    setSubmit(true)
    try {
      const payload = {
        ...form,
        lineNumber:        Number(form.lineNumber),
        quantityOrdered:   Number(form.quantityOrdered),
        quantityProduced:  Number(form.quantityProduced  || 0),
        quantityDelivered: Number(form.quantityDelivered || 0),
        quantityCancelled: Number(form.quantityCancelled || 0),
        unitPrice:         form.unitPrice !== '' ? Number(form.unitPrice) : undefined,
        modelId:           form.lineType === 'MODEL'     ? form.modelId    || undefined : undefined,
        materialId:        form.lineType === 'MATERIAL'  ? form.materialId || undefined : undefined,
        bomCalculationId:  form.bomCalculationId || undefined,
      }
      await onSave(payload, orderLine?.id)
    } catch (ex) {
      setError(ex?.message || 'Save failed')
    } finally {
      setSubmit(false)
    }
  }

  const busy = submitting || saving
  const qtyOrdered   = Number(form.quantityOrdered  || 0)
  const qtyProduced  = Number(form.quantityProduced  || 0)
  const qtyDelivered = Number(form.quantityDelivered || 0)
  const qtyCancelled = Number(form.quantityCancelled || 0)
  const remaining    = qtyOrdered - qtyProduced - qtyCancelled

  // selected material object for autocomplete
  const selMaterial = materials.find(m => m.id === form.materialId) ?? null
  const selModel    = models.find(m => m.id === form.modelId) ?? null

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box>
          {isEditing ? 'Edit Order Line' : 'Add Order Line'}
          {isEditing && (
            <Chip
              label={form.lineStatus}
              color={STATUS_COLOR[form.lineStatus] ?? 'default'}
              size="small"
              sx={{ ml: 1.5, fontWeight: 700, fontSize: 11 }}
            />
          )}
        </Box>
        {isEditing && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            #{orderLine.id}
          </Typography>
        )}
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* ── Identity ─────────────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Line Number"
              type="number"
              value={form.lineNumber}
              onChange={set('lineNumber')}
              required
              disabled={busy}
              inputProps={{ min: 1, step: 1 }}
              sx={{ width: 120 }}
            />
            <TextField
              select
              label="Line Type"
              value={form.lineType}
              onChange={set('lineType')}
              required
              disabled={busy || isEditing}
              sx={{ flex: 1 }}
              helperText={isEditing ? 'Cannot change line type after creation' : undefined}
            >
              {LINE_TYPES.map(t => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Box>

          {/* ── Model / Material ─────────────────────────── */}
          {form.lineType === 'MODEL' ? (
            <Autocomplete
              options={models}
              getOptionLabel={m => m.code ? `${m.code} — ${m.name}` : m.name}
              value={selModel}
              onChange={(_, v) => setForm(f => ({ ...f, modelId: v?.id ?? '' }))}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              disabled={busy}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Model *"
                  required={form.lineType === 'MODEL'}
                  helperText="Finished-product model (triggers BOM explosion)"
                />
              )}
            />
          ) : (
            <Autocomplete
              options={materials}
              getOptionLabel={m => m.code ? `${m.code} — ${m.name}` : m.name}
              value={selMaterial}
              onChange={(_, v) => setForm(f => ({ ...f, materialId: v?.id ?? '' }))}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              disabled={busy}
              renderInput={params => (
                <TextField
                  {...params}
                  label="Material *"
                  required={form.lineType === 'MATERIAL'}
                  helperText="Direct raw/trading material consumed from inventory"
                />
              )}
            />
          )}

          <Divider />

          {/* ── Quantities ───────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Quantities</Typography>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Qty Ordered"
              type="number"
              value={form.quantityOrdered}
              onChange={set('quantityOrdered')}
              required
              disabled={busy}
              inputProps={{ step: 'any', min: 0 }}
              sx={{ flex: 1, minWidth: 130 }}
            />
            <TextField
              label="Unit"
              value={form.unit}
              onChange={set('unit')}
              required
              disabled={busy}
              sx={{ width: 100 }}
            />
          </Box>

          {isEditing && (
            <>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="Qty Produced"
                  type="number"
                  value={form.quantityProduced}
                  onChange={set('quantityProduced')}
                  disabled={busy}
                  inputProps={{ step: 'any', min: 0 }}
                  sx={{ flex: 1, minWidth: 130 }}
                  helperText="Updated by production process"
                />
                <TextField
                  label="Qty Delivered"
                  type="number"
                  value={form.quantityDelivered}
                  onChange={set('quantityDelivered')}
                  disabled={busy}
                  inputProps={{ step: 'any', min: 0 }}
                  sx={{ flex: 1, minWidth: 130 }}
                />
                <TextField
                  label="Qty Cancelled"
                  type="number"
                  value={form.quantityCancelled}
                  onChange={set('quantityCancelled')}
                  disabled={busy}
                  inputProps={{ step: 'any', min: 0 }}
                  sx={{ flex: 1, minWidth: 130 }}
                />
              </Box>

              {/* Remaining qty chip */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.75,
                bgcolor: remaining < 0 ? 'error.50' : remaining === 0 ? 'success.50' : 'info.50',
                border: '1px solid', borderRadius: 1,
                borderColor: remaining < 0 ? 'error.200' : remaining === 0 ? 'success.200' : 'info.200' }}>
                <Typography variant="caption" color="text.secondary">Remaining to produce:</Typography>
                <Chip
                  label={remaining < 0 ? `Overrun by ${Math.abs(remaining)}` : remaining}
                  size="small"
                  color={remaining < 0 ? 'error' : remaining === 0 ? 'success' : 'info'}
                  sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                />
              </Box>
            </>
          )}

          <Divider />

          {/* ── Pricing & Status ─────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Unit Price"
              type="number"
              value={form.unitPrice}
              onChange={set('unitPrice')}
              disabled={busy}
              inputProps={{ step: 'any', min: 0 }}
              sx={{ flex: 1, minWidth: 130 }}
            />
            {isEditing && (
              <TextField
                select
                label="Line Status"
                value={form.lineStatus}
                onChange={set('lineStatus')}
                disabled={busy}
                sx={{ flex: 1, minWidth: 160 }}
              >
                {LINE_STATUSES.map(s => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          <Divider />

          {/* ── Advanced ─────────────────────────────────── */}
          {isEditing && (
            <TextField
              label="BOM Calculation ID"
              value={form.bomCalculationId}
              onChange={set('bomCalculationId')}
              disabled={busy}
              helperText="UUID of the BOM calculation record created during explosion"
              inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
            />
          )}

          <TextField
            label="Notes"
            value={form.notes}
            onChange={set('notes')}
            disabled={busy}
            multiline
            minRows={2}
          />

          {error && (
            <Box sx={{ color: 'error.main', fontSize: 13, px: 1, py: 0.5,
              bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200', borderRadius: 1 }}>
              {error}
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={busy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            {isEditing ? 'Save Changes' : 'Add Line'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

OrderLineEditModal.propTypes = {
  open:      PropTypes.bool.isRequired,
  orderLine: PropTypes.object,       // undefined → create mode
  orderId:   PropTypes.string,       // pre-fill order id when creating
  onClose:   PropTypes.func.isRequired,
  onSave:    PropTypes.func.isRequired, // (payload, id?) => Promise
  saving:    PropTypes.bool,
}
