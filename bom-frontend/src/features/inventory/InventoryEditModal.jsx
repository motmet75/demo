import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'

export default function InventoryEditModal({ open, inventory, onClose, onSave, saving }) {
  const makeInitial = (i) => ({
    materialCode: i?.material?.materialCode ?? (i?.materialCode ?? ''),
    warehouseCode: i?.warehouseCode ?? (i?.warehouse?.code ?? ''),
    quantityOnHand: i?.quantityOnHand ?? '',
    quantityReserved: i?.quantityReserved ?? (i?.quantityLocked ?? '')
  })

  const [form, setForm] = useState(() => makeInitial(inventory))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const validateNumber = (val) => {
    if (val === '' || val === null || val === undefined) return true
    return !Number.isNaN(Number(val))
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || saving) return
    setErrorMessage('')

    // validate numeric
    if (!validateNumber(form.quantityOnHand)) { setErrorMessage('quantityOnHand must be numeric'); return }
    if (form.quantityReserved !== '' && !validateNumber(form.quantityReserved)) { setErrorMessage('quantityReserved must be numeric'); return }

    setIsSubmitting(true)
    const payload = {
      ...(inventory && inventory.id ? { id: inventory.id } : {}),
      materialCode: form.materialCode,
      warehouseCode: form.warehouseCode,
      quantity: form.quantityOnHand
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

  const key = open ? (inventory && (inventory.id ?? inventory.materialCode) ? String(inventory.id ?? inventory.materialCode) : 'new') : 'closed'

  return (
    <Dialog key={key} open={!!open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{inventory ? 'Edit Inventory' : 'Add Inventory'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <TextField label="Material Code" value={form.materialCode} onChange={handleChange('materialCode')} disabled={isSubmitting} required />
            <TextField label="Warehouse Code" value={form.warehouseCode} onChange={handleChange('warehouseCode')} disabled={isSubmitting} required />
            <TextField label="Quantity On Hand" value={form.quantityOnHand} onChange={handleChange('quantityOnHand')} disabled={isSubmitting} required />
            <TextField label="Quantity Reserved" value={form.quantityReserved} onChange={handleChange('quantityReserved')} disabled={isSubmitting} />
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

InventoryEditModal.propTypes = {
  open: PropTypes.bool,
  inventory: PropTypes.object,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  saving: PropTypes.bool
}
