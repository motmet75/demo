import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'

export default function WarehouseEditModal({ open, warehouse, onClose, onSave, saving }) {
  const makeInitial = (w) => {
    const coerceEmpty = (v, defaultValue) => {
      if (v === null || v === undefined) return defaultValue
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase()
        if (s === 'null' || s === 'undefined' || s === '') return defaultValue
        return v
      }
      return v
    }

    return ({
      warehouseCode: coerceEmpty(w?.code ?? w?.code, ''),
      warehouseName: coerceEmpty(w?.name ?? w?.name, ''),
      location: coerceEmpty(w?.location, ''),
      isActive: w?.isActive ?? true
    })
  }

  const [form, setForm] = useState(() => makeInitial(warehouse))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || saving) return
    setErrorMessage('')
    setIsSubmitting(true)

    const payload = {
      ...(warehouse && warehouse.id ? { id: warehouse.id } : {}),
      code: form.warehouseCode || null,
      name: form.warehouseName || null,
      location: form.location || null,
      isActive: form.isActive
    }

    try {
      const res = onSave && onSave(payload)
      if (res && typeof res.then === 'function') await res
    } catch (err) {
      console.error('Save failed', err)
      setErrorMessage((err && err.message) || 'Failed to save')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
  }

  const key = open ? (warehouse && (warehouse.id ?? warehouse.id) ? String(warehouse.code ?? warehouse.code) : 'new') : 'closed'

  return (
    <Dialog key={key} open={!!open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{warehouse ? 'Edit Warehouse' : 'New Warehouse'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <TextField label="Code" value={form.warehouseCode} onChange={handleChange('warehouseCode')} disabled={isSubmitting} required />
            <TextField label="Name" value={form.warehouseName} onChange={handleChange('warehouseName')} disabled={isSubmitting} required />
            <TextField label="Location" value={form.location} onChange={handleChange('location')} disabled={isSubmitting} />
            <div>
              <label>
                <input type="checkbox" checked={!!form.isActive} onChange={handleChange('isActive')} disabled={isSubmitting} /> Active
              </label>
            </div>
            {errorMessage ? <div style={{ color: 'red' }}>{errorMessage}</div> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

WarehouseEditModal.propTypes = {
  open: PropTypes.bool,
  warehouse: PropTypes.object,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  saving: PropTypes.bool
}