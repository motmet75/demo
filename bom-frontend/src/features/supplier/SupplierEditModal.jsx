import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'

export default function SupplierEditModal({ open, supplier, onClose, onSave, saving }) {
  const makeInitial = (s) => ({
    code: s?.code ?? '',
    name: s?.name ?? '',
    contactName: s?.contactName ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? ''
  })

  const [form, setForm] = useState(() => makeInitial(supplier))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || saving) return
    setErrorMessage('')
    setIsSubmitting(true)

    const payload = {
      ...(supplier && supplier.id ? { id: supplier.id } : {}),
      // keep legacy keys for UI compatibility
      code: form.code,
      name: form.name,
      // include canonical keys expected by backend Supplier entity
      supplierCode: form.code,
      supplierName: form.name,
      contactName: form.contactName,
      phone: form.phone,
      email: form.email
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

  const key = open ? (supplier && (supplier.id ?? supplier.code) ? String(supplier.id ?? supplier.code) : 'new') : 'closed'

  return (
    <Dialog key={key} open={!!open} onClose={isSubmitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{supplier ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <TextField label="Code" value={form.code} onChange={handleChange('code')} disabled={isSubmitting} required />
            <TextField label="Name" value={form.name} onChange={handleChange('name')} disabled={isSubmitting} required />
            <TextField label="Contact Name" value={form.contactName} onChange={handleChange('contactName')} disabled={isSubmitting} />
            <TextField label="Phone" value={form.phone} onChange={handleChange('phone')} disabled={isSubmitting} />
            <TextField label="Email" value={form.email} onChange={handleChange('email')} disabled={isSubmitting} />
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

SupplierEditModal.propTypes = {
  open: PropTypes.bool,
  supplier: PropTypes.object,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  saving: PropTypes.bool
}