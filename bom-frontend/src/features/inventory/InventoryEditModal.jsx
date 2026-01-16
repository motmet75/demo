import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import PropTypes from 'prop-types'
import Autocomplete from '@mui/material/Autocomplete'
import { fetchMaterials } from '../../api/materialApi'
import { fetchWarehouses } from '../../api/warehouseApi'

export default function InventoryEditModal({ open, inventory, onClose, onSave, saving }) {
  const isoToLocalDatetime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const makeInitial = (i) => ({
    // prefer explicit ids when present (editing existing row)
    materialId: i?.materialId ?? (i?.material ? (i.material.id ?? i.material.uuid ?? i.material._id) : undefined),
    materialCode: i?.material?.materialCode ?? (i?.materialCode ?? ''),
    materialName: i?.materialName ?? (i?.material?.materialName ?? ''),
    warehouseId: i?.warehouseId ?? (i?.warehouse ? (i.warehouse.id ?? i.warehouse.uuid ?? i.warehouse._id) : undefined),
    warehouseCode: i?.warehouseCode ?? (i?.warehouse?.code ?? ''),
    quantityOnHand: i?.quantityOnHand ?? '',
    quantityReserved: i?.quantityReserved ?? (i?.quantityLocked ?? ''),
    batchNo: i?.batchNo ?? '',
    expirationLocal: i?.expirationDateTime ? isoToLocalDatetime(i.expirationDateTime) : (i?.expiration_date ? isoToLocalDatetime(i.expiration_date) : ''),
    productionLocal: i?.productionDateTime ? isoToLocalDatetime(i.productionDateTime) : (i?.production_date ? isoToLocalDatetime(i.production_date) : ''),
    createdAt: i?.createdAt ?? null
  })

  const [form, setForm] = useState(() => makeInitial(inventory))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [materials, setMaterials] = useState([])
  const [warehouses, setWarehouses] = useState([])

  // reset form whenever the modal opens or the inventory prop changes
  useEffect(() => {
    // schedule update to avoid synchronous setState in effect which can trigger lint warnings
    const t = setTimeout(() => {
      setForm(makeInitial(inventory))
      setErrorMessage('')
    }, 0)
    return () => clearTimeout(t)
  }, [inventory, open])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const m = await fetchMaterials()
        if (!mounted) return
        // map to { id, code, name } with robust id extraction
        const extractId = (x) => {
          if (!x) return null
          if (x.id != null) return String(x.id)
          if (x.uuid != null) return String(x.uuid)
          if (x._id != null) return String(x._id)
          if (x.material && x.material.id != null) return String(x.material.id)
          if (x.material && x.material.uuid != null) return String(x.material.uuid)
          return null
        }
        setMaterials(Array.isArray(m) ? m.map(x => ({ id: extractId(x), code: x.materialCode ?? x.code ?? (x.material && x.material.materialCode) ?? '', name: x.materialName ?? x.name ?? (x.material && x.material.materialName) ?? '' })) : [])
      } catch (e) {
        console.error('Failed to load materials', e)
        setMaterials([])
      }
    })()
    ;(async () => {
      try {
        const w = await fetchWarehouses()
        if (!mounted) return
        const extractIdW = (x) => {
          if (!x) return null
          if (x.id != null) return String(x.id)
          if (x.uuid != null) return String(x.uuid)
          if (x._id != null) return String(x._id)
          if (x.warehouse && x.warehouse.id != null) return String(x.warehouse.id)
          if (x.warehouse && x.warehouse.uuid != null) return String(x.warehouse.uuid)
          return null
        }
        setWarehouses(Array.isArray(w) ? w.map(x => ({ id: extractIdW(x), code: x.code ?? x.warehouseCode ?? (x.warehouse && x.warehouse.code) ?? '', name: x.name ?? x.warehouseName ?? (x.warehouse && x.warehouse.name) ?? '' })) : [])
      } catch (e) {
        console.error('Failed to load warehouses', e)
        setWarehouses([])
      }
    })()
    return () => { mounted = false }
  }, [])

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  // Autocomplete handlers split: onInputChange handles typing (reason 'input')
  // and onChange handles option selection (object) so selecting won't be
  // overwritten by the subsequent input change event.
  const handleMaterialInputChange = (event, inputValue, reason) => {
    // only clear materialId when user is typing (reason === 'input')
    if (reason === 'input') {
      // if the typed value equals the selected option's code, keep the id
      const selected = materials.find(m => m.id === form.materialId)
      if (selected && selected.code === inputValue) {
        setForm(prev => ({ ...prev, materialCode: inputValue }))
      } else {
        setForm(prev => ({ ...prev, materialCode: inputValue, materialId: undefined }))
      }
    } else {
      // for other reasons (reset/blur), just update the code text
      setForm(prev => ({ ...prev, materialCode: inputValue }))
    }
  }

  const handleMaterialChange = (event, option) => {
    if (!option) {
      // cleared selection
      setForm(prev => ({ ...prev, materialCode: '', materialId: undefined }))
      return
    }
    if (typeof option === 'string') {
      setForm(prev => ({ ...prev, materialCode: option, materialId: undefined }))
    } else {
      setForm(prev => ({ ...prev, materialCode: option.code, materialId: option.id ? String(option.id) : undefined }))
    }
  }

  const handleWarehouseInputChange = (event, inputValue, reason) => {
    if (reason === 'input') {
      const selected = warehouses.find(w => w.id === form.warehouseId)
      if (selected && selected.code === inputValue) {
        setForm(prev => ({ ...prev, warehouseCode: inputValue }))
      } else {
        setForm(prev => ({ ...prev, warehouseCode: inputValue, warehouseId: undefined }))
      }
    } else {
      setForm(prev => ({ ...prev, warehouseCode: inputValue }))
    }
  }

  const handleWarehouseChange = (event, option) => {
    if (!option) {
      setForm(prev => ({ ...prev, warehouseCode: '', warehouseId: undefined }))
      return
    }
    if (typeof option === 'string') {
      setForm(prev => ({ ...prev, warehouseCode: option, warehouseId: undefined }))
    } else {
      setForm(prev => ({ ...prev, warehouseCode: option.code, warehouseId: option.id ? String(option.id) : undefined }))
    }
  }

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

    // validate batchNo required
    if (!form.batchNo || String(form.batchNo).trim() === '') { setErrorMessage('batchNo is required'); return }

    // validate expiration date if provided: must be future
    if (form.expirationLocal && String(form.expirationLocal).trim() !== '') {
      const expDate = new Date(form.expirationLocal)
      if (Number.isNaN(expDate.getTime())) { setErrorMessage('Invalid expiration date'); return }
      const now = new Date()
      if (expDate <= now) { setErrorMessage('Expiration date must be in the future'); return }
    }

    setIsSubmitting(true)

    // convert local datetime-local to ISO strings for backend Instant.parse
    const toIso = (local) => {
      if (!local) return null
      try {
        const dt = new Date(local)
        if (Number.isNaN(dt.getTime())) return null
        return dt.toISOString()
      } catch {
        return null
      }
    }

    // coerce numeric fields to numbers when possible so backend receives proper types
    const coerceNumber = (v) => {
      if (v === '' || v === null || v === undefined) return undefined
      const n = Number(v)
      return Number.isNaN(n) ? v : n
    }

    const payload = {
      ...(inventory && (inventory.id || inventory.inventoryId) ? { id: (inventory.id ?? inventory.inventoryId) } : {}),
      // include ids when available (edit flow). If creating new, backend may resolve by code.
      ...(form.materialId != null && form.materialId !== '' ? { materialId: form.materialId } : {}),
      ...(form.warehouseId != null && form.warehouseId !== '' ? { warehouseId: form.warehouseId } : {}),
      materialCode: form.materialCode,
      warehouseCode: form.warehouseCode,
      quantity: coerceNumber(form.quantityOnHand),
      quantityReserved: coerceNumber(form.quantityReserved),
      batchNo: form.batchNo,
      expirationDateTime: toIso(form.expirationLocal),
      productionDateTime: toIso(form.productionLocal)
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
            <Autocomplete
              freeSolo
              options={materials}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : (opt && opt.code ? `${opt.code}${opt.name ? ' - ' + opt.name : ''}` : ''))}
              inputValue={form.materialCode}
              value={materials.find(m => m.id === form.materialId) || materials.find(m => m.code === form.materialCode) || null}
              isOptionEqualToValue={(option, value) => {
                if (!option || !value) return false
                if (typeof value === 'string') return option.code === value
                return option.id === value.id || option.code === value.code
              }}
              onInputChange={handleMaterialInputChange}
              onChange={handleMaterialChange}
              renderInput={(params) => <TextField {...params} label="Material Code" disabled={isSubmitting || !!(inventory && (inventory.inventoryId || inventory.id))} required />}
            />

            <Autocomplete
              freeSolo
              options={warehouses}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : (opt && opt.code ? `${opt.code}${opt.name ? ' - ' + opt.name : ''}` : ''))}
              inputValue={form.warehouseCode}
              value={warehouses.find(w => w.id === form.warehouseId) || warehouses.find(w => w.code === form.warehouseCode) || null}
              isOptionEqualToValue={(option, value) => {
                if (!option || !value) return false
                if (typeof value === 'string') return option.code === value
                return option.id === value.id || option.code === value.code
              }}
              onInputChange={handleWarehouseInputChange}
              onChange={handleWarehouseChange}
              renderInput={(params) => <TextField {...params} label="Warehouse Code" disabled={isSubmitting || !!(inventory && (inventory.inventoryId || inventory.id))} required />}
            />

            <TextField label="Batch No" value={form.batchNo} onChange={handleChange('batchNo')} disabled={isSubmitting} required />

            <TextField label="Quantity On Hand" type="number" value={form.quantityOnHand} onChange={handleChange('quantityOnHand')} disabled={isSubmitting} required />
            <TextField label="Quantity Reserved" type="number" value={form.quantityReserved} onChange={handleChange('quantityReserved')} disabled={isSubmitting} />

            <TextField
              label="Expiration Date"
              type="datetime-local"
              value={form.expirationLocal}
              onChange={handleChange('expirationLocal')}
              InputLabelProps={{ shrink: true }}
              disabled={isSubmitting}
            />

            <TextField
              label="Production Date"
              type="datetime-local"
              value={form.productionLocal}
              onChange={handleChange('productionLocal')}
              InputLabelProps={{ shrink: true }}
              disabled={isSubmitting}
            />

            {form.createdAt ? <div>Created At: {String(form.createdAt)}</div> : null}

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