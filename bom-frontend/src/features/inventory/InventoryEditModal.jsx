import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import PropTypes from 'prop-types'
import Autocomplete from '@mui/material/Autocomplete'
import { fetchMaterials } from '../../api/materialApi'
import { fetchWarehouses } from '../../api/warehouseApi'
import { fetchAllInvoices } from '../../api/invoiceApi'
import { useAppContext } from '../../context/AppContext'

export default function InventoryEditModal({ open, inventory, onClose, onSave, saving }) {
  const { tenantId, companyId } = useAppContext()
  const isoToLocalDatetime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const localNow = () => {
    const d = new Date()
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  // Freeze the original server values in state — initialised once at mount.
  // Because InventoryGrid passes key={modalKey}, this component is fully remounted
  // on every dialog open, so useState(() => ...) always captures the correct snapshot.
  const [origQtyOnHand] = useState(() => inventory != null ? Number(inventory.quantityOnHand ?? 0) : null)
  // Keep original reserved/locked as info-only for display — NOT used as a hard constraint.
  const [origReserved]  = useState(() => inventory != null ? Number(inventory.quantityReserved ?? 0) : 0)
  const [origLocked]    = useState(() => inventory != null ? Number(inventory.quantityLocked   ?? 0) : 0)

  const makeInitial = (i) => ({
    materialId: i?.materialId ?? (i?.material ? (i.material.id ?? i.material.uuid ?? i.material._id) : undefined),
    materialCode: i?.material?.materialCode ?? (i?.materialCode ?? ''),
    materialName: i?.materialName ?? (i?.material?.materialName ?? ''),
    warehouseId: i?.warehouseId ?? (i?.warehouse ? (i.warehouse.id ?? i.warehouse.uuid ?? i.warehouse._id) : undefined),
    warehouseCode: i?.warehouseCode ?? (i?.warehouse?.code ?? ''),
    quantityOnHand: i?.quantityOnHand ?? '',
    quantityTotal: i?.quantityTotal ?? '',
    quantityReserved: i?.quantityReserved ?? '',
    quantityLocked: i?.quantityLocked ?? '',
    batchNo: i?.batchNo ?? '',
    contractCode: i?.contractCode ?? '',
    unit: i?.unit ?? 'pcs',
    unitPrice: i?.unitPrice ?? '0',
    currency: i?.currency ?? 'USD',
    hsCode: i?.hsCode ?? '',
    originType: i?.originType ?? '',
    originCountry: i?.originCountry ?? '',
    orderToDeduction: i?.orderToDeduction ?? '',
    userName: i?.userName ?? 'system',
    reason: i ? 'Manual adjustment' : 'Manual add stock',
    createdBy: i?.userName ?? 'system',
    notes: '',
    expirationLocal: i?.expirationDateTime ? isoToLocalDatetime(i.expirationDateTime) : (i?.expiration_date ? isoToLocalDatetime(i.expiration_date) : localNow()),
    productionLocal: i?.productionDateTime ? isoToLocalDatetime(i.productionDateTime) : (i?.production_date ? isoToLocalDatetime(i.production_date) : localNow()),
    createdAt: i?.createdAt ? isoToLocalDatetime(i.createdAt) : localNow(),
    visible: i?.visible ?? true,
    approved: i?.approved ?? false,
    locked: i?.locked ?? false,
    invoiceId: ''
  })

  const [form, setForm] = useState(() => makeInitial(inventory))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [materials, setMaterials] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [invoices, setInvoices] = useState([])

  // Note: no reset effect needed — InventoryGrid passes key={modalKey} which fully
  // remounts this component on every open, so useState initialisers always run fresh.

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
    ;(async () => {
      try {
        if (!tenantId || !companyId) return
        const inv = await fetchAllInvoices({ tenantId, companyId })
        if (!mounted) return
        setInvoices(Array.isArray(inv) ? inv : [])
      } catch { setInvoices([]) }
    })()
    return () => { mounted = false }
  }, [tenantId, companyId])

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

  // Compute adjustment delta (new - original), only when editing
  const isEditing = !!(inventory && (inventory.id || inventory.inventoryId))
  const newQty = form.quantityOnHand !== '' ? Number(form.quantityOnHand) : null
  // origQtyOnHand / origReserved / origLocked come directly from the inventory prop (declared above)
  const origQty = origQtyOnHand  // alias for readability in JSX below
  const delta = (isEditing && newQty !== null && origQty !== null && !Number.isNaN(newQty) && !Number.isNaN(origQty))
    ? newQty - origQty
    : null
  const deltaLabel = delta === null ? null
    : delta === 0 ? 'No change'
    : delta > 0 ? `+${Number(delta).toLocaleString(undefined, { maximumFractionDigits: 9 })} (stock increase)`
    : `${Number(delta).toLocaleString(undefined, { maximumFractionDigits: 9 })} (stock decrease)`
  const deltaColor = delta === null || delta === 0 ? 'default' : delta > 0 ? 'success' : 'error'

  // Constraint: only block if new on-hand would be negative (< 0).
  // Reserved/locked are shown as info but do NOT block — the backend handles reconciliation.
  const fmtN = (n) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 9 })
  const availableAfter = (isEditing && newQty !== null && !Number.isNaN(newQty))
    ? newQty - origReserved - origLocked
    : null
  // Only truly invalid if the user literally types a negative on-hand value
  const isNegativeOnHand = newQty !== null && !Number.isNaN(newQty) && newQty < 0

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (isSubmitting || saving) return
    setErrorMessage('')

    // validate numeric
    if (!validateNumber(form.quantityOnHand)) { setErrorMessage('Quantity On Hand must be numeric'); return }
    if (form.quantityReserved !== '' && !validateNumber(form.quantityReserved)) { setErrorMessage('Quantity Reserved must be numeric'); return }
    if (form.quantityLocked !== '' && !validateNumber(form.quantityLocked)) { setErrorMessage('Quantity Locked must be numeric'); return }

    // validate new on-hand is not negative
    const newQtyVal = Number(form.quantityOnHand)
    if (!Number.isNaN(newQtyVal) && newQtyVal < 0) {
      setErrorMessage('Quantity On Hand cannot be negative')
      return
    }

    // validate batchNo required
    if (!form.batchNo || String(form.batchNo).trim() === '') { setErrorMessage('batchNo is required'); return }

    // validate expiration date if provided
    if (form.expirationLocal && String(form.expirationLocal).trim() !== '') {
      const expDate = new Date(form.expirationLocal)
      if (Number.isNaN(expDate.getTime())) { setErrorMessage('Invalid expiration date'); return }
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
      ...(isEditing ? { id: (inventory.id ?? inventory.inventoryId) } : {}),
      ...(form.materialId != null && form.materialId !== '' ? { materialId: form.materialId } : {}),
      ...(form.warehouseId != null && form.warehouseId !== '' ? { warehouseId: form.warehouseId } : {}),
      materialCode: form.materialCode,
      warehouseCode: form.warehouseCode,
      quantity: coerceNumber(form.quantityOnHand),
      quantityTotal: coerceNumber(form.quantityTotal),
      // When editing, do NOT send quantityReserved / quantityLocked back to the backend.
      // Those fields are managed exclusively by the reserve/release system.
      // Sending the current values triggers the backend constraint check against the new
      // (lower) quantityOnHand and causes a false-positive rejection.
      ...(!isEditing ? {
        quantityReserved: coerceNumber(form.quantityReserved),
        quantityLocked: coerceNumber(form.quantityLocked),
      } : {}),
      batchNo: form.batchNo,
      contractCode: form.contractCode || null,
      unit: form.unit || 'pcs',
      unitPrice: coerceNumber(form.unitPrice) || 0,
      currency: form.currency || 'USD',
      hsCode: form.hsCode || null,
      originType: form.originType || null,
      originCountry: form.originCountry || null,
      orderToDeduction: form.orderToDeduction || null,
      expirationDateTime: toIso(form.expirationLocal),
      productionDateTime: toIso(form.productionLocal),
      reason: form.reason || (isEditing ? 'Manual adjustment' : 'Manual add stock'),
      createdBy: form.createdBy || 'system',
      notes: form.notes || null,
      ...(!isEditing && form.invoiceId ? { invoiceId: form.invoiceId } : {})
    }

    try {
      const res = onSave && onSave(payload)
      if (res && typeof res.then === 'function') await res
      // Movement is recorded atomically by the backend updateStock — no separate call needed.
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
      <DialogTitle>{isEditing ? 'Edit Inventory' : 'Add Inventory'}</DialogTitle>
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
              renderInput={(params) => <TextField {...params} label="Material Code" disabled={isSubmitting || isEditing} required />}
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
              renderInput={(params) => <TextField {...params} label="Warehouse Code" disabled={isSubmitting || isEditing} required />}
            />

            <TextField label="Batch No" value={form.batchNo} onChange={handleChange('batchNo')} disabled={isSubmitting} required />

            {/* Quantity on Hand — with adjustment preview when editing */}
            {isEditing && origQty !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, bgcolor: 'grey.50', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>Original Qty:</Typography>
                <Typography variant="body2" fontWeight={600} fontFamily="monospace">
                  {Number(origQty).toLocaleString(undefined, { maximumFractionDigits: 9 })}
                </Typography>
              </Box>
            )}

            <TextField
              label="Quantity On Hand"
              type="number"
              value={form.quantityOnHand}
              onChange={handleChange('quantityOnHand')}
              disabled={isSubmitting}
              required
              inputProps={{ step: 'any' }}
              helperText={isEditing ? 'Enter the new stock quantity — adjustment will be recorded automatically' : 'Current stock on hand'}
            />

            {/* Live adjustment delta */}
            {isEditing && delta !== null && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, bgcolor: delta === 0 ? 'grey.50' : delta > 0 ? 'success.50' : 'error.50', borderRadius: 1, border: '1px solid', borderColor: delta === 0 ? 'grey.200' : delta > 0 ? 'success.200' : 'error.200' }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>Adjustment:</Typography>
                <Chip
                  label={deltaLabel}
                  size="small"
                  color={deltaColor}
                  variant={delta === 0 ? 'outlined' : 'filled'}
                  sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                />
              </Box>
            )}

            {/* Live constraint violation warning — only when literally negative */}
            {isEditing && isNegativeOnHand && (
              <Box sx={{ px: 1.5, py: 1, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.300', borderRadius: 1 }}>
                <Typography variant="caption" color="error.main" fontWeight={700} display="block">
                  ⚠ Quantity On Hand cannot be negative
                </Typography>
              </Box>
            )}

            {/* Info: projected available after adjustment */}
            {isEditing && availableAfter !== null && !isNegativeOnHand && (origReserved > 0 || origLocked > 0) && (
              <Box sx={{ px: 1.5, py: 0.75, bgcolor: availableAfter < 0 ? 'warning.50' : 'info.50', border: '1px solid', borderColor: availableAfter < 0 ? 'warning.300' : 'info.200', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  After adjustment — Reserved: <strong>{fmtN(origReserved)}</strong> · Locked: <strong>{fmtN(origLocked)}</strong> · Available: <strong style={{ color: availableAfter < 0 ? '#ed6c02' : 'inherit' }}>{fmtN(availableAfter)}</strong>
                  {availableAfter < 0 && ' ⚠ available will go negative — backend will reconcile'}
                </Typography>
              </Box>
            )}

            <Divider />

            <TextField label="Total Qty" type="number" value={form.quantityTotal} disabled
              helperText="Total quantity ever received — set at import/creation, not editable" InputProps={{ readOnly: true }} />
            <TextField label="Quantity Reserved" type="number" value={form.quantityReserved}
              onChange={isEditing ? undefined : handleChange('quantityReserved')}
              disabled={isSubmitting || isEditing}
              InputProps={{ readOnly: isEditing }}
              helperText={isEditing ? 'Managed by reserve/release — not editable here' : undefined} />
            <TextField label="Quantity Locked" type="number" value={form.quantityLocked}
              onChange={isEditing ? undefined : handleChange('quantityLocked')}
              disabled={isSubmitting || isEditing}
              InputProps={{ readOnly: isEditing }}
              helperText={isEditing ? 'Managed by reserve/release — not editable here' : undefined} />

            <TextField label="Contract Code" value={form.contractCode} onChange={handleChange('contractCode')} disabled={isSubmitting} />
            <TextField label="Unit" value={form.unit} onChange={handleChange('unit')} disabled={isSubmitting} />
            <TextField label="Unit Price" type="number" value={form.unitPrice} onChange={handleChange('unitPrice')} disabled={isSubmitting} />
            <TextField label="Currency" value={form.currency} onChange={handleChange('currency')} disabled={isSubmitting} />

            <TextField label="HS Code" value={form.hsCode} onChange={handleChange('hsCode')} disabled={isSubmitting} />
            <TextField label="Origin Type" value={form.originType} onChange={handleChange('originType')} disabled={isSubmitting} />
            <TextField label="Origin Country" value={form.originCountry} onChange={handleChange('originCountry')} disabled={isSubmitting} />
            <TextField label="Order/Deduction" value={form.orderToDeduction} onChange={handleChange('orderToDeduction')} disabled={isSubmitting} />

            <TextField label="Expiration Date" type="datetime-local" value={form.expirationLocal}
              onChange={handleChange('expirationLocal')} InputLabelProps={{ shrink: true }} disabled={isSubmitting} />
            <TextField label="Production Date" type="datetime-local" value={form.productionLocal}
              onChange={handleChange('productionLocal')} InputLabelProps={{ shrink: true }} disabled={isSubmitting} />

            <Divider />

            {/* Movement audit fields */}
            <TextField label="Reason" value={form.reason} onChange={handleChange('reason')} disabled={isSubmitting}
              helperText={isEditing ? 'Recorded in the ADJUSTMENT movement entry' : 'Recorded in Inventory Movements log'} />
            <TextField label="Created By" value={form.createdBy} onChange={handleChange('createdBy')} disabled={isSubmitting} />
            <TextField label="Notes" value={form.notes} onChange={handleChange('notes')} disabled={isSubmitting}
              multiline minRows={2} />

            {/* Invoice picker — only relevant when adding new stock */}
            {!isEditing && (
              <Autocomplete
                options={invoices}
                getOptionLabel={inv => inv.invoiceNumber ? `${inv.invoiceNumber} — ${inv.invoiceType} — ${inv.partyName || ''}` : ''}
                value={invoices.find(inv => inv.id === form.invoiceId) || null}
                onChange={(_, val) => setForm(f => ({ ...f, invoiceId: val ? val.id : '' }))}
                renderInput={(params) => <TextField {...params} label="Link to Invoice (optional)" placeholder="Select purchase/sale invoice…" size="small" />}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
                disabled={isSubmitting}
              />
            )}

            {form.createdAt ? <div style={{ fontSize: 12, color: '#888' }}>Created At: {String(form.createdAt)}</div> : null}

            {errorMessage ? <div style={{ color: 'red' }}>{errorMessage}</div> : null}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || saving || isNegativeOnHand}
            color={isEditing && delta !== null && delta !== 0 ? (delta > 0 ? 'success' : 'error') : 'primary'}>
            {isSubmitting ? 'Saving...' : isEditing && delta !== null && delta !== 0
              ? `Save & Record Adjustment (${delta > 0 ? '+' : ''}${Number(delta).toLocaleString(undefined, { maximumFractionDigits: 9 })})`
              : 'Save'}
          </Button>
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