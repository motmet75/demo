import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'
import Autocomplete from '@mui/material/Autocomplete'
import { useAppContext } from '../../context/AppContext'

/**
 * MaterialEditModal
 *
 * Props:
 * - open: boolean
 * - material: object (may be null)
 * - onClose: () => void
 * - onSave: (updatedMaterial) => void
 * - saving: boolean (parent saving flag)
 */
export default function MaterialEditModal({ open, material, onClose, onSave, saving: parentSaving }) {
  const makeInitialForm = (m) => ({
    materialCode: m?.materialCode ?? '',
    materialName: m?.materialName ?? '',
    materialType: m?.materialType ?? 'RAW',
    unit: m?.unit ?? '',
    price: m?.price != null ? String(m.price) : '',
    description: m?.description ?? ''
  })

  // Initialize form from props. Component will be remounted when dialog `key` changes
  const [form, setForm] = useState(() => makeInitialForm(material))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // Get tenant and company context
  const { tenantId, companyId } = useAppContext()

  // Note: removed useEffect that called setForm synchronously to satisfy react-hooks/set-state-in-effect.
  // We rely on remounting (see Dialog `key`) to reset local state when opening with a different material.

  const handleChange = (field) => (e) => {
    const value = e?.target ? e.target.value : e
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || parentSaving) return // prevent double submission
    setErrorMessage('')
    setIsSubmitting(true)

    // Build payload only from form values. Include id only when editing an existing material.
    const payload = {
      ...(material && material.id ? { id: material.id } : {}),
      materialCode: form.materialCode,
      materialName: form.materialName,
      materialType: form.materialType,
      unit: form.unit,
      price: form.price === '' ? null : Number(form.price),
      description: form.description
      // attach tenant & company from context when available
      , ...(tenantId ? { tenantId } : {}),
      ...(companyId ? { companyId } : {})
    }

    try {
      // If onSave returns a Promise, await it. Allow parent to manage saving state too.
      const result = onSave && onSave(payload)
      if (result && typeof result.then === 'function') {
        await result
      }
      // onSave may already close the modal. If not, call onClose here.
    } catch (err) {
      console.error('Save failed', err)
      const msg = (err && err.message) || 'Failed to save changes'
      setErrorMessage(msg)
      // keep modal open so user can retry
      setIsSubmitting(false)
      return
    }

    // on success, reset submitting (modal likely closed by parent)
    setIsSubmitting(false)
  }

  const styles = {
    formBox: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 },
    error: { color: 'red', marginTop: 8 }
  }

  const isBusy = isSubmitting || !!parentSaving

  const materialTypeOptions = ['RAW', 'SEMI', 'FINISHED']

  // Use a key so the dialog (and local state) is remounted when opening for a different material or when closed
  const dialogKey = open ? (material && (material.id ?? material.materialCode) ? String(material.id ?? material.materialCode) : 'new') : 'closed'

  return (
    <Dialog key={dialogKey} open={!!open} onClose={isBusy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{material ? 'Edit Material' : 'New Material'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Box sx={styles.formBox}>
            <TextField
              label="Material Code"
              value={form.materialCode}
              onChange={handleChange('materialCode')}
              fullWidth
              disabled={isBusy}
            />

            <TextField
              label="Material Name"
              value={form.materialName}
              onChange={handleChange('materialName')}
              fullWidth
              disabled={isBusy}
              required
            />

            <Autocomplete
              freeSolo
              options={materialTypeOptions}
              value={form.materialType || ''}
              inputValue={form.materialType || ''}
              onChange={(e, val) => setForm(prev => ({ ...prev, materialType: val || '' }))}
              onInputChange={(e, val) => setForm(prev => ({ ...prev, materialType: val || '' }))}
              disabled={isBusy}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Material Type"
                  fullWidth
                  disabled={isBusy}
                />
              )}
            />

            <TextField
              label="Unit"
              value={form.unit}
              onChange={handleChange('unit')}
              fullWidth
              disabled={isBusy}
            />

            <TextField
              label="Price"
              type="number"
              value={form.price}
              onChange={handleChange('price')}
              fullWidth
              inputProps={{ step: 'any' }}
              disabled={isBusy}
            />

            <TextField
              label="Description"
              value={form.description}
              onChange={handleChange('description')}
              fullWidth
              multiline
              minRows={3}
              disabled={isBusy}
            />

            {errorMessage ? <div style={styles.error}>{errorMessage}</div> : null}
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

MaterialEditModal.propTypes = {
  open: PropTypes.bool,
  material: PropTypes.object,
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  saving: PropTypes.bool
}