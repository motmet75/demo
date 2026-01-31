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
  // Helpers to convert between JS Date and the input[type=datetime-local] value (local time, no seconds)
  const toInputLocal = (val) => {
    if (!val) return ''
    try {
      const d = new Date(val)
      if (Number.isNaN(d.getTime())) return ''
      const pad = (n) => String(n).padStart(2, '0')
      const YYYY = d.getFullYear()
      const MM = pad(d.getMonth() + 1)
      const DD = pad(d.getDate())
      const hh = pad(d.getHours())
      const mm = pad(d.getMinutes())
      return `${YYYY}-${MM}-${DD}T${hh}:${mm}`
    } catch { return '' }
  }

  const fromInputLocalToISOString = (inputVal) => {
    if (!inputVal) return null
    // inputVal expected like 'YYYY-MM-DDTHH:mm'
    try {
      const [datePart, timePart] = inputVal.split('T')
      if (!datePart) return null
      const [y, m, d] = datePart.split('-').map((v) => parseInt(v, 10))
      const [hh = '0', mm = '0'] = (timePart || '').split(':')
      const date = new Date(y, (m || 1) - 1, d, parseInt(hh, 10), parseInt(mm, 10))
      if (Number.isNaN(date.getTime())) return null
      return date.toISOString()
    } catch { return null }
  }

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

    const nowLocalInput = toInputLocal(new Date())

    // createdAt may be an ISO string or epoch -- normalize to input-local string for editing
    const createdAtVal = w?.createdAt ?? w?.__raw?.createdAt
    const createdAtInput = createdAtVal ? toInputLocal(createdAtVal) : nowLocalInput

    return ({
      id: coerceEmpty(w?.id, ''),
      warehouseCode: coerceEmpty(w?.code ?? w?.warehouseCode, ''),
      warehouseName: coerceEmpty(w?.name ?? w?.warehouseName, ''),
      location: coerceEmpty(w?.location, ''),
      isActive: w?.isActive ?? true,
      createdAt: createdAtInput,
      contactName: coerceEmpty(w?.contactName ?? w?.contact_name ?? w?.__raw?.contact_name, ''),
      phone: coerceEmpty(w?.phone ?? w?.__raw?.phone, ''),
      email: coerceEmpty(w?.email ?? w?.__raw?.email, ''),
      capacity: coerceEmpty(w?.capacity ?? (w?.__raw && w.__raw.capacity), ''),
      note: coerceEmpty(w?.note ?? w?.__raw?.note, '')
    })
  }

  const [form, setForm] = useState(() => makeInitial(warehouse))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const readAppContext = () => {
    try {
      const raw = localStorage.getItem('bom_app_context_v1')
      if (!raw) return {}
      return JSON.parse(raw) || {}
    } catch {
      return {}
    }
  }

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || saving) return
    setErrorMessage('')
    setIsSubmitting(true)

    const appCtx = readAppContext()

    const payload = {
      ...(warehouse && warehouse.id ? { id: warehouse.id } : (form.id ? { id: form.id } : {})),
      code: form.warehouseCode || null,
      name: form.warehouseName || null,
      location: form.location || null,
      isActive: form.isActive,
      ...(form.createdAt ? { createdAt: fromInputLocalToISOString(form.createdAt) } : {}),
      contactName: form.contactName || null,
      phone: form.phone || null,
      email: form.email || null,
      capacity: (form.capacity === '' || form.capacity == null) ? null : form.capacity,
      note: form.note || null,
      // include tenant/company from local storage context when available so backend can persist tenant_id/company_id
      ...(appCtx.tenantId ? { tenantId: appCtx.tenantId } : {}),
      ...(appCtx.companyId ? { companyId: appCtx.companyId } : {})
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
            {/* ID (read-only when editing) - hidden when adding */}
            {form.id ? (
              <TextField label="UUID" value={form.id} InputProps={{ readOnly: true }} disabled={isSubmitting} />
            ) : null}

            {/* Created At as datetime selection (local). defaulted to now on new form */}
            <TextField
              label="Created At"
              type="datetime-local"
              value={form.createdAt}
              onChange={handleChange('createdAt')}
              disabled={isSubmitting}
              InputLabelProps={{ shrink: true }}
            />

            <TextField label="Code" value={form.warehouseCode} onChange={handleChange('warehouseCode')} disabled={isSubmitting} required />
            <TextField label="Name" value={form.warehouseName} onChange={handleChange('warehouseName')} disabled={isSubmitting} required />
            <TextField label="Location" value={form.location} onChange={handleChange('location')} disabled={isSubmitting} />

            <TextField label="Contact Name" value={form.contactName} onChange={handleChange('contactName')} disabled={isSubmitting} />
            <TextField label="Phone" value={form.phone} onChange={handleChange('phone')} disabled={isSubmitting} />
            <TextField label="Email" value={form.email} onChange={handleChange('email')} disabled={isSubmitting} />
            <TextField label="Capacity" type="number" inputProps={{ step: '0.01' }} value={form.capacity} onChange={handleChange('capacity')} disabled={isSubmitting} />
            <TextField label="Note" multiline rows={3} value={form.note} onChange={handleChange('note')} disabled={isSubmitting} />
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