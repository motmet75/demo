import React, { useEffect, useState, useCallback, useRef } from 'react'
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
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import PropTypes from 'prop-types'
import { fetchMaterials } from '../../api/materialApi'
import { fetchBomsByModel } from '../../api/modelApi'
import { apiFetchJson } from '../../api/client'

const ORDER_TYPES = ['SALES', 'PRODUCTION', 'TRANSFER', 'INTERNAL']
const LINE_TYPES  = ['MODEL', 'MATERIAL']

function makeEmptyLine() {
  return {
    lineType: 'MODEL',
    modelId: '',
    materialId: '',
    bomId: '',          // '' = use ACTIVE
    quantityOrdered: '1',
    unit: 'pcs',
    unitPrice: '',
    notes: '',
    remark: '',
  }
}

function makeEmptyHeader() {
  return {
    orderNumber: '', orderType: 'SALES', customerId: '',
    plannedStartDate: '', plannedEndDate: '', notes: '', createdBy: 'system'
  }
}

/** Status chip color for a BOM */
function bomStatusColor(status) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'ARCHIVED') return 'default'
  return 'warning'
}

/**
 * Per-line BOM selector component.
 * Loads BOMs when modelId changes, shows selector with bomName / version / status.
 * Default (empty string) = use ACTIVE BOM.
 */
function BomSelector({ modelId, value, onChange, disabled }) {
  const [boms, setBoms] = useState([])
  const [loading, setLoading] = useState(false)
  const prevModelId = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!modelId) {
      Promise.resolve().then(() => { if (!cancelled) { setBoms([]); setLoading(false) } })
      return () => { cancelled = true }
    }
    if (modelId === prevModelId.current) return
    prevModelId.current = modelId
    fetchBomsByModel(modelId)
      .then(list => {
        if (cancelled) return
        setLoading(false)
        setBoms(list)
        if (value && !list.some(b => b.id === value)) {
          onChange('')
        }
      })
      .catch(() => { if (!cancelled) setBoms([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [modelId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!modelId) return null

  const serverActiveBom = boms.find(b => b.status === 'ACTIVE')

  return (
    <TextField
      select
      label={loading ? 'Loading BOMs…' : 'BOM Version'}
      value={value}
      onChange={e => {
          const selectedId = e.target.value
          const selectedBomObj = selectedId ? boms.find(b => b.id === selectedId) : serverActiveBom
          onChange(selectedId, selectedBomObj)
        }}
      disabled={disabled || loading || boms.length === 0}
      size="small"
      fullWidth
      helperText={boms.length === 0 && !loading ? 'No BOMs found for this model' : undefined}
      SelectProps={{
        displayEmpty: true,
        renderValue: (selected) => {
          const displayed = selected
            ? boms.find(b => b.id === selected)
            : serverActiveBom
          if (!displayed) return <Typography variant="body2">Default (Active BOM)</Typography>
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip label="ACTIVE" color="success" size="small" />
              <Typography variant="body2">
                {displayed.bomName || 'BOM'} ({displayed.modelCode || ''}) — v{displayed.version}
              </Typography>
            </Box>
          )
        }
      }}
    >
      {/* Default = server-side ACTIVE BOM */}
      <MenuItem value="">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label="ACTIVE" color="success" size="small" />
          <Typography variant="body2">
            {serverActiveBom
              ? `${serverActiveBom.bomName || 'BOM'} (${serverActiveBom.modelCode || ''}) — v${serverActiveBom.version}`
              : 'Default (Active BOM)'}
          </Typography>
        </Box>
      </MenuItem>
      {boms.filter(b => b.status !== 'ACTIVE').map(b => (
        <MenuItem key={b.id} value={b.id}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={b.status} color={bomStatusColor(b.status)} size="small" />
            <Typography variant="body2">
              {b.bomName || 'BOM'} ({b.modelCode || ''}) — v{b.version}
            </Typography>
          </Box>
        </MenuItem>
      ))}
    </TextField>
  )
}

export default function OrderCreateModal({ open, onClose, onCreated }) {
  const [header, setHeader]     = useState(makeEmptyHeader)
  const [lines, setLines]       = useState([makeEmptyLine()])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [materials, setMaterials] = useState([])
  const [models, setModels]     = useState([])

  // Reset on open
  useEffect(() => {
    if (open) {
      setHeader(makeEmptyHeader())
      setLines([makeEmptyLine()])
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

  const handleHeaderChange = (field) => (e) =>
    setHeader(prev => ({ ...prev, [field]: e.target.value }))

  const handleLineChange = useCallback((idx, field) => (e) => {
    const val = e.target.value
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      const updated = { ...l, [field]: val }
      // Reset bomId when model changes
      if (field === 'modelId') updated.bomId = ''
      return updated
    }))
  }, [])

  const handleLineBomChange = useCallback((idx, bomId, bomObj) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      // Build BOM tag to append: "BOM: {name} v{version}"
      const bomTag = bomObj
        ? `BOM: ${bomObj.bomName || 'BOM'} v${bomObj.version}`
        : ''
      // Strip any previous BOM tag then append new one
      const prevNotes = (l.notes || '').replace(/\s*\|\s*BOM:[^|]*/g, '').trim()
      const newNotes = bomTag
        ? (prevNotes ? `${prevNotes} | ${bomTag}` : bomTag)
        : prevNotes
      return { ...l, bomId, notes: newNotes }
    }))
  }, [])

  const addLine = () => setLines(prev => [...prev, makeEmptyLine()])
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setError('')

    if (!header.orderNumber.trim()) { setError('Order number is required'); return }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      if (l.lineType === 'MODEL' && !l.modelId)    { setError(`Line ${i + 1}: model is required`); return }
      if (l.lineType === 'MATERIAL' && !l.materialId) { setError(`Line ${i + 1}: material is required`); return }
      if (!l.quantityOrdered || isNaN(parseFloat(l.quantityOrdered)) || parseFloat(l.quantityOrdered) <= 0) {
        setError(`Line ${i + 1}: quantity must be a positive number`); return
      }
    }

    setSaving(true)
    try {
      // Build notes for each line by combining user notes + purpose/size/sugar attributes
      const buildLineNotes = (l) => {
        const parts = []
        if (l.purpose) parts.push(`Purpose: ${l.purpose}`)
        if (l.size)    parts.push(`Size: ${l.size}`)
        if (l.sugar)   parts.push(`Sugar: ${l.sugar}`)
        if (l.notes)   parts.push(l.notes)
        return parts.join(' | ') || null
      }

      const payload = {
        orderNumber:      header.orderNumber.trim(),
        orderType:        header.orderType,
        customerId:       header.customerId || null,
        plannedStartDate: header.plannedStartDate || null,
        plannedEndDate:   header.plannedEndDate || null,
        notes:            header.notes || null,
        createdBy:        header.createdBy || 'system',
        lines: lines.map(l => ({
          lineType:        l.lineType,
          modelId:         l.lineType === 'MODEL'     ? (l.modelId || null)    : null,
          materialId:      l.lineType === 'MATERIAL'  ? (l.materialId || null) : null,
          bomId:           l.lineType === 'MODEL' && l.bomId ? l.bomId : null,
          quantityOrdered: parseFloat(l.quantityOrdered),
          unit:            l.unit || 'pcs',
          unitPrice:       l.unitPrice ? parseFloat(l.unitPrice) : null,
          notes:           [l.remark, l.notes].filter(Boolean).join(' | ') || null,
        }))
      }

      const { res, data } = await apiFetchJson('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`)
      onCreated && onCreated(data)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to create order')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>Create New Order</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* ── Header ─────────────────────────────────────────────── */}
          <Typography variant="subtitle2" gutterBottom>Order Header</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <TextField label="Order Number *" value={header.orderNumber}
              onChange={handleHeaderChange('orderNumber')} disabled={saving} fullWidth />
            <TextField select label="Order Type *" value={header.orderType}
              onChange={handleHeaderChange('orderType')} disabled={saving} fullWidth>
              {ORDER_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField label="Planned Start Date" type="date" value={header.plannedStartDate}
              onChange={handleHeaderChange('plannedStartDate')} disabled={saving} fullWidth
              InputLabelProps={{ shrink: true }} />
            <TextField label="Planned End Date" type="date" value={header.plannedEndDate}
              onChange={handleHeaderChange('plannedEndDate')} disabled={saving} fullWidth
              InputLabelProps={{ shrink: true }} />
            <TextField label="Customer ID (UUID)" value={header.customerId}
              onChange={handleHeaderChange('customerId')} disabled={saving} fullWidth />
            <TextField label="Created By" value={header.createdBy}
              onChange={handleHeaderChange('createdBy')} disabled={saving} fullWidth />
            <TextField label="Notes" value={header.notes}
              onChange={handleHeaderChange('notes')} disabled={saving} fullWidth
              multiline minRows={1} sx={{ gridColumn: 'span 2' }} />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* ── Order Lines ─────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">Order Lines</Typography>
            <Button startIcon={<AddIcon />} size="small" onClick={addLine} disabled={saving}>
              Add Line
            </Button>
          </Box>

          {lines.map((line, idx) => (
            <Box key={idx} sx={{ mb: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {/* Row 1 — type / model or material / qty / unit / price / delete */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px 90px 110px 40px', gap: 1, alignItems: 'flex-start', mb: 1 }}>
                <TextField select label="Type" value={line.lineType}
                  onChange={handleLineChange(idx, 'lineType')} size="small" disabled={saving}>
                  {LINE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>

                {line.lineType === 'MODEL' ? (
                  <TextField select label="Model *" value={line.modelId}
                    onChange={handleLineChange(idx, 'modelId')} size="small" disabled={saving}>
                    {models.map(m => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.modelCode} – {m.modelName}
                      </MenuItem>
                    ))}
                  </TextField>
                ) : (
                  <TextField select label="Material *" value={line.materialId}
                    onChange={handleLineChange(idx, 'materialId')} size="small" disabled={saving}>
                    {materials.map(m => (
                      <MenuItem key={m.id} value={m.id}>
                        {m.materialCode} – {m.materialName}
                      </MenuItem>
                    ))}
                  </TextField>
                )}

                <TextField label="Planned Qty *" type="number" value={line.quantityOrdered}
                  onChange={handleLineChange(idx, 'quantityOrdered')} size="small"
                  disabled={saving} inputProps={{ min: 0, step: 'any' }} />
                <TextField label="Unit *" value={line.unit}
                  onChange={handleLineChange(idx, 'unit')} size="small" disabled={saving} />
                <TextField label="Unit Price" type="number" value={line.unitPrice}
                  onChange={handleLineChange(idx, 'unitPrice')} size="small"
                  disabled={saving} inputProps={{ min: 0, step: 'any' }} />
                <Tooltip title="Remove line">
                  <span>
                    <IconButton size="small" color="error"
                      onClick={() => removeLine(idx)}
                      disabled={saving || lines.length === 1}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>

              {/* Row 2 — BOM selector (MODEL only) + remark + notes */}
              <Box sx={{ display: 'grid', gridTemplateColumns: line.lineType === 'MODEL' ? '1fr 1fr 2fr' : '1fr 2fr', gap: 1, alignItems: 'flex-start' }}>
                {line.lineType === 'MODEL' && (
                  <BomSelector
                    modelId={line.modelId}
                    value={line.bomId}
                    onChange={(bomId, bomObj) => handleLineBomChange(idx, bomId, bomObj)}
                    disabled={saving}
                  />
                )}
                <TextField label="Remark" value={line.remark}
                  onChange={handleLineChange(idx, 'remark')} size="small"
                  disabled={saving} />
                <TextField label="Notes" value={line.notes}
                  onChange={handleLineChange(idx, 'notes')} size="small"
                  disabled={saving} fullWidth />
              </Box>
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