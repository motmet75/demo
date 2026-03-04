import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'

export default function ModelEditModal({ open, model, onClose, onSave, saving: parentSaving }) {
  const makeInitialForm = (m) => ({
    modelCode: m?.modelCode ?? '',
    modelName: m?.modelName ?? '',
    isActive: m?.isActive ?? true,
    hsCode: m?.hsCode ?? '',
    coCriteria: m?.coCriteria ?? ''
  })

  const [form, setForm] = useState(() => makeInitialForm(model))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || parentSaving) return
    setErrorMessage('')
    setIsSubmitting(true)

    const payload = {
      ...(model && model.id ? { id: model.id } : {}),
      modelCode: form.modelCode,
      modelName: form.modelName,
      isActive: form.isActive,
      hsCode: form.hsCode || null,
      coCriteria: form.coCriteria || null
    }

    try {
      const result = onSave && onSave(payload)
      if (result && typeof result.then === 'function') {
        await result
      }
    } catch (err) {
      console.error('Save failed', err)
      const msg = (err && err.message) || 'Failed to save changes'
      setErrorMessage(msg)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
  }

  const isBusy = isSubmitting || !!parentSaving
  const dialogKey = open ? (model && (model.id ?? model.modelCode) ? String(model.id ?? model.modelCode) : 'new') : 'closed'

  return (
    <Dialog key={dialogKey} open={!!open} onClose={isBusy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{model ? 'Edit Model' : 'New Model'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <TextField
              label="Model Code"
              value={form.modelCode}
              onChange={handleChange('modelCode')}
              fullWidth
              disabled={isBusy}
            />

            <TextField
              label="Model Name"
              value={form.modelName}
              onChange={handleChange('modelName')}
              fullWidth
              disabled={isBusy}
              required
            />

            <TextField
              label="HS Code"
              value={form.hsCode}
              onChange={handleChange('hsCode')}
              fullWidth
              disabled={isBusy}
              placeholder="e.g. 8471.30"
            />

            <TextField
              label="CO Criteria"
              value={form.coCriteria}
              onChange={handleChange('coCriteria')}
              fullWidth
              disabled={isBusy}
              placeholder="e.g. WO, CTH"
            />

            <label>
              <input type="checkbox" checked={!!form.isActive} onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))} disabled={isBusy} /> Active
            </label>

            {errorMessage ? <div style={{ color: 'red', marginTop: 8 }}>{errorMessage}</div> : null}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={isBusy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isBusy}>
            {isBusy ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

ModelEditModal.propTypes = {
  open: PropTypes.bool,
  model: PropTypes.object,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  saving: PropTypes.bool
}
