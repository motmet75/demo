import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import PropTypes from 'prop-types'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { createInvoice, deleteInvoice } from '../../api/invoiceApi'
import { addStock } from '../../api/inventoryApi'
import { fetchMaterials } from '../../api/materialApi'
import { fetchWarehouses } from '../../api/warehouseApi'
import { useAppContext } from '../../context/AppContext'
import { fmtNum } from '../../utils/format'

const todayLocalDate = () => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const invoiceNumberSeed = () => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `PINV-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

const toNumberOrNull = value => {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const normalizeMaterial = item => {
  const id = item?.id ?? item?.uuid ?? item?._id ?? null
  return {
    ...item,
    id: id != null ? String(id) : '',
    materialCode: item?.materialCode ?? item?.code ?? item?.material?.materialCode ?? '',
    materialName: item?.materialName ?? item?.name ?? item?.material?.materialName ?? '',
    unit: item?.unit ?? item?.material?.unit ?? 'pcs',
    thumbnailUrl: item?.thumbnailUrl ?? item?.thumbnail_url ?? item?.imageUrl ?? ''
  }
}

const normalizeWarehouseOption = item => ({
  ...item,
  id: item?.id != null ? String(item.id) : '',
  code: item?.code ?? item?.warehouseCode ?? '',
  name: item?.name ?? item?.warehouseName ?? ''
})

function MaterialThumb({ material, size = 40 }) {
  const src = material?.thumbnailUrl || ''
  if (!src) {
    return (
      <Box sx={{ width: size, height: size, borderRadius: 1, bgcolor: '#eef2f7', border: '1px solid #d8dee8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, fontWeight: 800 }}>
        {String(material?.materialCode || '?').slice(0, 2).toUpperCase()}
      </Box>
    )
  }
  return (
    <Box
      component="img"
      src={src}
      alt={material?.materialName || material?.materialCode || 'Material'}
      onError={e => { e.currentTarget.style.display = 'none' }}
      sx={{ width: size, height: size, borderRadius: 1, objectFit: 'cover', border: '1px solid #d8dee8', bgcolor: '#f8fafc' }}
    />
  )
}

MaterialThumb.propTypes = {
  material: PropTypes.object,
  size: PropTypes.number
}

function extractQrCandidates(raw) {
  const value = String(raw || '').trim()
  if (!value) return []
  const candidates = new Set([value])
  try { candidates.add(decodeURIComponent(value)) } catch { /* ignore */ }
  try {
    const parsed = JSON.parse(value)
    ;['materialCode', 'code', 'materialName', 'name', 'id', 'materialId'].forEach(key => {
      if (parsed?.[key]) candidates.add(String(parsed[key]))
    })
  } catch { /* ignore */ }
  value.split(/[\s,;|?&=#/]+/).forEach(part => { if (part) candidates.add(part) })
  return Array.from(candidates).map(x => String(x).trim()).filter(Boolean)
}

function findMaterialFromScan(raw, materials) {
  const candidates = extractQrCandidates(raw)
  const lowerCandidates = candidates.map(x => x.toLowerCase())
  return materials.find(material => {
    const id = String(material.id || '').toLowerCase()
    const code = String(material.materialCode || '').toLowerCase()
    const name = String(material.materialName || '').toLowerCase()
    return lowerCandidates.some(candidate =>
      candidate === id ||
      candidate === code ||
      candidate === name ||
      (code && candidate.includes(code)) ||
      (code && String(raw || '').toLowerCase().includes(code)) ||
      (name && String(raw || '').toLowerCase().includes(name))
    )
  }) || null
}

function MaterialQrScanDialog({ open, onClose, onScan }) {
  const readerIdRef = useRef(`material-qr-reader-${Math.random().toString(36).slice(2)}`)
  const scannerRef = useRef(null)
  const detectedRef = useRef(false)
  const [manualValue, setManualValue] = useState('')
  const [starting, setStarting] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const cameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try { if (scanner.isScanning) await scanner.stop() } catch { /* ignore */ }
      try { await scanner.clear() } catch { /* ignore */ }
    }
    setStreaming(false)
  }, [])

  const handleDetected = useCallback((rawValue) => {
    const value = String(rawValue || '').trim()
    if (!value || detectedRef.current) return
    detectedRef.current = true
    void stopCamera()
    onScan?.(value)
  }, [onScan, stopCamera])

  const createScanner = useCallback(() => new Html5Qrcode(readerIdRef.current, {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    verbose: false,
  }), [])

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      setError('Camera is not available. Use image upload or manual QR text.')
      return
    }
    setStarting(true)
    setError('')
    detectedRef.current = false
    await stopCamera()
    try {
      const scanner = createScanner()
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (width, height) => ({ width: Math.floor(Math.min(width, height) * 0.72), height: Math.floor(Math.min(width, height) * 0.72) }) },
        decodedText => handleDetected(decodedText),
        () => {}
      )
      setStreaming(true)
    } catch (e) {
      setError(e?.message || 'Unable to start camera.')
      await stopCamera()
    } finally {
      setStarting(false)
    }
  }, [cameraSupported, createScanner, handleDetected, stopCamera])

  const decodeImageFile = async file => {
    if (!file) return
    setError('')
    detectedRef.current = false
    await stopCamera()
    const scanner = createScanner()
    scannerRef.current = scanner
    try {
      const decodedText = await scanner.scanFile(file, true)
      handleDetected(decodedText)
    } catch (e) {
      setError(e?.message || 'No QR code found in image.')
      try { await scanner.clear() } catch { /* ignore */ }
      if (scannerRef.current === scanner) scannerRef.current = null
    }
  }

  useEffect(() => {
    if (!open) return undefined
    setManualValue('')
    setError('')
    detectedRef.current = false
    void startCamera()
    return () => { void stopCamera() }
  }, [open, startCamera, stopCamera])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
        <QrCode2Icon color="primary" /> Scan Material QR
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
        {error && <Alert severity="warning">{error}</Alert>}
        <Box sx={{ position: 'relative', bgcolor: '#0f172a', borderRadius: 2, overflow: 'hidden', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center', '& video': { width: '100% !important', height: '100% !important', objectFit: 'cover' } }}>
          <Box id={readerIdRef.current} sx={{ position: 'absolute', inset: 0 }} />
          {!streaming && !starting && (
            <Box sx={{ textAlign: 'center', color: '#e2e8f0', px: 2, zIndex: 1, pointerEvents: 'none' }}>
              <QrCode2Icon sx={{ fontSize: 42, mb: 1 }} />
              <Typography variant="body2">Camera or image scanner</Typography>
            </Box>
          )}
          {starting && <CircularProgress size={30} sx={{ color: '#fff', zIndex: 1 }} />}
          <Chip size="small" label={streaming ? 'Camera active' : 'Scanner'} color={streaming ? 'success' : 'default'} sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 700, zIndex: 2 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={starting ? <CircularProgress size={14} /> : <CameraAltIcon />} onClick={startCamera} disabled={starting || !cameraSupported}>Start Camera</Button>
          <Button size="small" variant="outlined" component="label" startIcon={<UploadFileIcon />}>Scan Image<input hidden type="file" accept="image/*" onChange={e => { void decodeImageFile(e.target.files?.[0]); e.target.value = '' }} /></Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField fullWidth size="small" label="QR text or material code" value={manualValue} onChange={e => setManualValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleDetected(manualValue) }} />
          <Button variant="contained" onClick={() => handleDetected(manualValue)} disabled={!manualValue.trim()}>Use</Button>
        </Box>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  )
}

MaterialQrScanDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onScan: PropTypes.func
}

export default function InventoryInvoiceReceiveDialog({ open, defaultCurrency = 'VND', onClose, onComplete }) {
  const { tenantId, companyId } = useAppContext()
  const [materials, setMaterials] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [materialInput, setMaterialInput] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    invoiceNumber: invoiceNumberSeed(),
    partyName: '',
    invoiceDate: todayLocalDate(),
    batchNo: '',
    warehouseImportQuantity: '',
    warehouseImportUnit: '',
    warehouseImportUnitPrice: '',
    bomUnitPerWarehouseUnit: '',
    notes: ''
  })

  const currency = defaultCurrency === 'USD' ? 'USD' : 'VND'
  const warehouseQty = toNumberOrNull(form.warehouseImportQuantity)
  const warehouseUnitPrice = toNumberOrNull(form.warehouseImportUnitPrice)
  const ratio = toNumberOrNull(form.bomUnitPerWarehouseUnit)
  const bomQty = warehouseQty !== null && ratio !== null ? warehouseQty * ratio : null
  const bomUnitPrice = warehouseUnitPrice !== null && ratio !== null && ratio > 0 ? warehouseUnitPrice / ratio : null
  const invoiceTotal = warehouseQty !== null && warehouseUnitPrice !== null ? warehouseQty * warehouseUnitPrice : 0

  const selectedMaterialCode = selectedMaterial?.materialCode || ''
  const selectedMaterialUnit = selectedMaterial?.unit || 'unit'

  useEffect(() => {
    if (!open) return
    setError('')
    setSelectedMaterial(null)
    setSelectedWarehouse(null)
    setMaterialInput('')
    setForm({
      invoiceNumber: invoiceNumberSeed(),
      partyName: '',
      invoiceDate: todayLocalDate(),
      batchNo: '',
      warehouseImportQuantity: '',
      warehouseImportUnit: '',
      warehouseImportUnitPrice: '',
      bomUnitPerWarehouseUnit: '',
      notes: ''
    })
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    let mounted = true
    setLoadingRefs(true)
    ;(async () => {
      try {
        const [materialList, warehouseList] = await Promise.all([fetchMaterials(), fetchWarehouses()])
        if (!mounted) return
        setMaterials(Array.isArray(materialList) ? materialList.map(normalizeMaterial) : [])
        setWarehouses(Array.isArray(warehouseList) ? warehouseList.map(normalizeWarehouseOption) : [])
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load material or warehouse data')
      } finally {
        if (mounted) setLoadingRefs(false)
      }
    })()
    return () => { mounted = false }
  }, [open])

  const materialOptions = useMemo(() => materials.filter(m => m.materialCode || m.materialName), [materials])

  const setField = field => event => setForm(prev => ({ ...prev, [field]: event.target.value }))

  const handleMaterialInputChange = (_, value, reason) => {
    setMaterialInput(value)
    if (reason === 'input') {
      const lower = String(value || '').trim().toLowerCase()
      const exact = materialOptions.find(m => String(m.materialCode || '').toLowerCase() === lower || String(m.materialName || '').toLowerCase() === lower)
      if (exact) setSelectedMaterial(exact)
    }
  }

  const handleScan = raw => {
    const material = findMaterialFromScan(raw, materialOptions)
    setScannerOpen(false)
    if (!material) {
      setError(`No material matched QR: ${String(raw).slice(0, 120)}`)
      return
    }
    setSelectedMaterial(material)
    setMaterialInput(`${material.materialCode} - ${material.materialName}`)
    setError('')
  }

  const validate = () => {
    if (!tenantId || !companyId) return 'Select tenant and company first.'
    if (!form.invoiceNumber.trim()) return 'Invoice number is required.'
    if (!selectedMaterial) return 'Select a material by code, name, or QR.'
    if (!selectedWarehouse) return 'Select a warehouse.'
    if (!form.batchNo.trim()) return 'Batch number is required.'
    if (!form.warehouseImportUnit.trim()) return 'Warehouse unit is required.'
    if (warehouseQty === null || warehouseQty <= 0) return 'Warehouse qty must be positive.'
    if (warehouseUnitPrice === null || warehouseUnitPrice < 0) return 'Warehouse unit price cannot be negative.'
    if (ratio === null || ratio <= 0) return 'Ratio must be positive.'
    return ''
  }

  const handleSave = async () => {
    const validation = validate()
    if (validation) { setError(validation); return }
    setSaving(true)
    setError('')
    let createdInvoice = null
    try {
      createdInvoice = await createInvoice({
        invoiceType: 'PURCHASE',
        invoiceNumber: form.invoiceNumber.trim(),
        partyName: form.partyName.trim() || null,
        invoiceDate: form.invoiceDate || todayLocalDate(),
        currency,
        subtotal: invoiceTotal,
        taxAmount: 0,
        totalAmount: invoiceTotal,
        notes: form.notes || `Inventory receiving for ${selectedMaterialCode}`,
        createdBy: 'inventory'
      }, { tenantId, companyId })

      await addStock({
        materialId: selectedMaterial.id || undefined,
        materialCode: selectedMaterial.materialCode,
        warehouseId: selectedWarehouse.id || undefined,
        warehouseCode: selectedWarehouse.code,
        batchNo: form.batchNo.trim(),
        quantity: bomQty,
        unitPrice: bomUnitPrice,
        currency,
        warehouseImportUnit: form.warehouseImportUnit.trim(),
        warehouseImportQuantity: warehouseQty,
        warehouseImportUnitPrice: warehouseUnitPrice,
        bomUnitPerWarehouseUnit: ratio,
        invoiceId: createdInvoice.id,
        reason: `Invoice receiving ${form.invoiceNumber.trim()}`,
        createdBy: 'inventory',
        notes: form.notes || null
      })

      onComplete?.(createdInvoice)
      onClose?.()
    } catch (e) {
      if (createdInvoice?.id) {
        try { await deleteInvoice(createdInvoice.id, { tenantId, companyId }) } catch { /* best-effort rollback */ }
      }
      setError(e?.message || 'Failed to save invoice and inventory input')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <span>New Invoice</span>
          <Chip label={`Currency ${currency}`} color="primary" variant="outlined" sx={{ fontWeight: 800 }} />
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 130px' }, gap: 1.5 }}>
            <TextField label="Invoice Number" size="small" value={form.invoiceNumber} onChange={setField('invoiceNumber')} required />
            <TextField label="Supplier / Party" size="small" value={form.partyName} onChange={setField('partyName')} />
            <TextField label="Invoice Date" type="date" size="small" value={form.invoiceDate} onChange={setField('invoiceDate')} InputLabelProps={{ shrink: true }} />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.5fr) minmax(220px, 0.8fr)' }, gap: 1.5 }}>
            <Autocomplete
              options={materialOptions}
              loading={loadingRefs}
              value={selectedMaterial}
              inputValue={materialInput}
              onInputChange={handleMaterialInputChange}
              onChange={(_, option) => {
                setSelectedMaterial(option)
                setMaterialInput(option ? `${option.materialCode} - ${option.materialName}` : '')
              }}
              filterOptions={(options, state) => {
                const q = state.inputValue.trim().toLowerCase()
                if (!q) return options.slice(0, 80)
                return options.filter(m => `${m.materialCode} ${m.materialName}`.toLowerCase().includes(q)).slice(0, 80)
              }}
              getOptionLabel={option => option ? `${option.materialCode || ''}${option.materialName ? ' - ' + option.materialName : ''}` : ''}
              isOptionEqualToValue={(option, value) => option.id === value.id || option.materialCode === value.materialCode}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', py: 0.75 }}>
                  <MaterialThumb material={option} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={800} noWrap>{option.materialCode || '-'}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{option.materialName || '-'}</Typography>
                  </Box>
                  <Chip label={option.unit || 'unit'} size="small" variant="outlined" sx={{ ml: 'auto' }} />
                </Box>
              )}
              renderInput={params => <TextField {...params} label="Material code or name" size="small" required />}
            />
            <Button variant="outlined" startIcon={<QrCode2Icon />} onClick={() => setScannerOpen(true)} sx={{ minHeight: 40, fontWeight: 800 }}>Scan Material QR</Button>
          </Box>

          {selectedMaterial && (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 1, border: '1px solid #d8dee8', borderRadius: 1, bgcolor: '#f8fafc' }}>
              <MaterialThumb material={selectedMaterial} size={64} />
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={900}>{selectedMaterial.materialCode}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedMaterial.materialName}</Typography>
              </Box>
              <Chip label={`BOM unit ${selectedMaterialUnit}`} variant="outlined" sx={{ ml: 'auto', fontWeight: 800 }} />
            </Box>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <Autocomplete
              options={warehouses}
              loading={loadingRefs}
              value={selectedWarehouse}
              onChange={(_, option) => setSelectedWarehouse(option)}
              getOptionLabel={option => option ? `${option.code || ''}${option.name ? ' - ' + option.name : ''}` : ''}
              isOptionEqualToValue={(option, value) => option.id === value.id || option.code === value.code}
              renderInput={params => <TextField {...params} label="Warehouse" size="small" required />}
            />
            <TextField label="Batch No" size="small" value={form.batchNo} onChange={setField('batchNo')} required />
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr 1fr' }, gap: 1.5 }}>
            <TextField label="Warehouse Qty" type="number" size="small" value={form.warehouseImportQuantity} onChange={setField('warehouseImportQuantity')} inputProps={{ step: 'any', min: 0 }} required />
            <TextField label="Warehouse Unit" size="small" value={form.warehouseImportUnit} onChange={setField('warehouseImportUnit')} placeholder="box" required />
            <TextField label="Unit Price" type="number" size="small" value={form.warehouseImportUnitPrice} onChange={setField('warehouseImportUnitPrice')} inputProps={{ step: 'any', min: 0 }} required />
            <TextField label="Ratio to BOM Unit" type="number" size="small" value={form.bomUnitPerWarehouseUnit} onChange={setField('bomUnitPerWarehouseUnit')} inputProps={{ step: 'any', min: 0 }} required />
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', p: 1, borderRadius: 1, bgcolor: '#eef6ff', border: '1px solid #bfdbfe' }}>
            <Typography variant="caption" fontWeight={900}>Converted</Typography>
            <Chip label={`BOM qty ${bomQty !== null ? fmtNum(bomQty, 9) : '-'} ${selectedMaterialUnit}`} size="small" />
            <Chip label={`BOM unit price ${bomUnitPrice !== null ? fmtNum(bomUnitPrice, 10) : '-'} ${currency}`} size="small" />
            <Chip label={`Invoice total ${fmtNum(invoiceTotal, 2)} ${currency}`} size="small" color="primary" variant="outlined" />
          </Box>

          <TextField label="Notes" size="small" value={form.notes} onChange={setField('notes')} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || loadingRefs}>
            {saving ? 'Saving...' : 'Save Invoice + Inventory'}
          </Button>
        </DialogActions>
      </Dialog>
      <MaterialQrScanDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </>
  )
}

InventoryInvoiceReceiveDialog.propTypes = {
  open: PropTypes.bool,
  defaultCurrency: PropTypes.string,
  onClose: PropTypes.func,
  onComplete: PropTypes.func
}
