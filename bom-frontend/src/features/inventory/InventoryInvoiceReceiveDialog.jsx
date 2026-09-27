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
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import PropTypes from 'prop-types'
import AddIcon from '@mui/icons-material/Add'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import DeleteIcon from '@mui/icons-material/Delete'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { createInvoice, deleteInvoice, recordInvoicePayment } from '../../api/invoiceApi'
import { addStock, fetchInventoryView } from '../../api/inventoryApi'
import { fetchModelBoms } from '../../api/modelApi'
import { receivingDefaults, lineCalc, hasLineInput } from './invoiceEntry'
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

const normalizeSearch = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
  .trim()

const newLine = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  material: null,
  materialInput: '',
  warehouse: null,
  batchNo: '',
  warehouseImportQuantity: '',
  warehouseImportUnit: '',
  warehouseImportUnitPrice: '',
  bomUnitPerWarehouseUnit: '',
  notes: ''
})

const normalizeMaterial = item => {
  const id = item?.id ?? item?.uuid ?? item?._id ?? null
  return {
    ...item,
    id: id != null ? String(id) : '',
    materialCode: item?.materialCode ?? item?.code ?? item?.material?.materialCode ?? '',
    materialName: item?.materialName ?? item?.name ?? item?.material?.materialName ?? '',
    unit: item?.unit ?? item?.material?.unit ?? '',
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
      <Box sx={{ width: size, height: size, borderRadius: 1, bgcolor: '#eef2f7', border: '1px solid #d8dee8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
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
      sx={{ width: size, height: size, borderRadius: 1, objectFit: 'cover', border: '1px solid #d8dee8', bgcolor: '#f8fafc', flexShrink: 0 }}
    />
  )
}

MaterialThumb.propTypes = { material: PropTypes.object, size: PropTypes.number }

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
  const rawLower = String(raw || '').toLowerCase()
  return materials.find(material => {
    const id = String(material.id || '').toLowerCase()
    const code = String(material.materialCode || '').toLowerCase()
    const name = String(material.materialName || '').toLowerCase()
    return lowerCandidates.some(candidate =>
      candidate === id ||
      candidate === code ||
      candidate === name ||
      (code && candidate.includes(code)) ||
      (code && rawLower.includes(code)) ||
      (name && rawLower.includes(name))
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

MaterialQrScanDialog.propTypes = { open: PropTypes.bool, onClose: PropTypes.func, onScan: PropTypes.func }

export default function InventoryInvoiceReceiveDialog({ open, defaultCurrency = 'VND', onClose, onComplete }) {
  const { tenantId, companyId } = useAppContext()
  const [materials, setMaterials] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [inventory, setInventory] = useState([]), [boms, setBoms] = useState([])
  const remembered = useRef({})
  const sessionKey = `inventory.invoice.defaults:${tenantId}:${companyId}`
  const cells = useRef({}), nextFocus = useRef(null), savingRef = useRef(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanLineId, setScanLineId] = useState(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [payment, setPayment] = useState({ method: 'CASH', createPaymentNote: true, notes: '' })
  const [savedInvoice, setSavedInvoice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ invoiceNumber: invoiceNumberSeed(), partyName: '', invoiceDate: todayLocalDate(), notes: '' })
  const [lines, setLines] = useState([newLine()])

  const currency = defaultCurrency === 'USD' ? 'USD' : 'VND'
  const materialOptions = useMemo(() => materials.filter(m => m.materialCode || m.materialName), [materials])
  const enteredLines = lines.filter(hasLineInput)
  const invoiceTotal = enteredLines.reduce((sum, line) => sum + lineCalc(line).total, 0)

  useEffect(() => {
    if (!open) return
    setError('')
    setScannerOpen(false)
    setScanLineId(null)
    setPaymentDialogOpen(false)
    setPayment({ method: 'CASH', createPaymentNote: true, notes: '' })
    setSavedInvoice(null)
    setForm({ invoiceNumber: invoiceNumberSeed(), partyName: '', invoiceDate: todayLocalDate(), notes: '' })
    try { remembered.current = JSON.parse(sessionStorage.getItem(sessionKey) || '{}') } catch { remembered.current = {} }
    setLines([{ ...newLine(), batchNo: remembered.current.batchNo || '' }])
  }, [open, sessionKey])

  useEffect(() => {
    if (!open) return undefined
    let mounted = true
    setLoadingRefs(true)
    ;(async () => {
      try {
        const [materialList, warehouseList, inventoryList, bomList] = await Promise.all([fetchMaterials(), fetchWarehouses(), fetchInventoryView(), fetchModelBoms()])
        if (!mounted) return
        setInventory(inventoryList)
        setBoms(bomList.filter(row => String(row.tenantId ?? row.tenant?.id) === String(tenantId) && String(row.companyId ?? row.company?.id) === String(companyId)))
        setMaterials(Array.isArray(materialList) ? materialList.map(normalizeMaterial) : [])
        const options=Array.isArray(warehouseList) ? warehouseList.map(normalizeWarehouseOption) : []
        setWarehouses(options)
        const initialWarehouse=options.find(w=>w.id===remembered.current.warehouseId) || (options.length===1?options[0]:null)
        setLines(prev=>prev.map(line=>line.warehouse?line:{...line,warehouse:initialWarehouse}))
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load material or warehouse data')
      } finally {
        if (mounted) setLoadingRefs(false)
      }
    })()
    return () => { mounted = false }
  }, [open, tenantId, companyId])

  useEffect(() => {
    if (nextFocus.current) { cells.current[nextFocus.current]?.focus(); nextFocus.current = null }
  }, [lines])

  const rememberDefaults = patch => {
    remembered.current = { ...remembered.current, ...patch }
    try { sessionStorage.setItem(sessionKey, JSON.stringify(remembered.current)) } catch { /* memory still works */ }
  }
  const setFormField = field => event => setForm(prev => ({ ...prev, [field]: event.target.value }))
  const updateLine = (id, patch) => setLines(prev => prev.map(line => line.id === id ? { ...line, ...patch } : line))
  const addLine = (afterId = lines.at(-1)?.id) => {
    const index = lines.findIndex(line => line.id === afterId)
    const existing = lines[index + 1]
    const defaults = {
      warehouse: warehouses.find(w=>w.id===remembered.current.warehouseId) || lines[index]?.warehouse || (warehouses.length === 1 ? warehouses[0] : null),
      batchNo: remembered.current.batchNo ?? lines[index]?.batchNo ?? '',
    }
    if (existing && !hasLineInput(existing)) {
      nextFocus.current = `${existing.id}:material`
      updateLine(existing.id, defaults)
      return
    }
    const row = { ...newLine(), ...defaults }
    nextFocus.current = `${row.id}:material`
    setLines(prev => [...prev.slice(0,index + 1), row, ...prev.slice(index + 1)])
  }
  const selectMaterial = (line, material) => {
    const warehouse = line.warehouse || warehouses.find(w=>w.id===remembered.current.warehouseId) || (warehouses.length === 1 ? warehouses[0] : null)
    updateLine(line.id, { material, warehouse, materialInput: material ? `${material.materialCode} - ${material.materialName}` : '', batchNo: line.batchNo || remembered.current.batchNo || '',
      ...receivingDefaults(material, warehouse, inventory, boms, currency) })
  }
  const rowKeyDown = (event, line) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.target.tagName !== 'INPUT' || event.target.getAttribute('aria-expanded') === 'true') return
    event.preventDefault()
    addLine(line.id)
  }
  const cellProps = (line, field, label) => ({ size: 'small', fullWidth: true, inputRef: node => { cells.current[`${line.id}:${field}`] = node }, inputProps: { 'aria-label': `${label} dòng ${lines.indexOf(line)+1}` } })
  const removeLine = id => setLines(prev => prev.length <= 1 ? prev : prev.filter(line => line.id !== id))

  const openScannerForLine = id => {
    setScanLineId(id)
    setScannerOpen(true)
  }

  const handleScan = raw => {
    const material = findMaterialFromScan(raw, materialOptions)
    setScannerOpen(false)
    if (!material) {
      setError(`No material matched QR: ${String(raw).slice(0, 120)}`)
      return
    }
    const targetId = scanLineId || lines[0]?.id
    selectMaterial(lines.find(line => line.id === targetId), material)
    nextFocus.current = `${targetId}:quantity`
    setError('')
  }

  const validateLine = (line, index) => {
    const { warehouseQty, warehouseUnitPrice, ratio } = lineCalc(line)
    const prefix = `Item ${index + 1}`
    if (!line.material?.unit) return `${prefix}: vật tư chưa cấu hình đơn vị BOM.`
    if (!line.material) return `${prefix}: select material by code, name, or QR.`
    if (!line.warehouse) return `${prefix}: select warehouse.`
    if (!line.batchNo.trim()) return `${prefix}: batch number is required.`
    if (!line.warehouseImportUnit.trim()) return `${prefix}: warehouse unit is required.`
    if (warehouseQty === null || warehouseQty <= 0) return `${prefix}: warehouse qty must be positive.`
    if (warehouseUnitPrice === null || warehouseUnitPrice < 0) return `${prefix}: unit price cannot be negative.`
    if (ratio === null || ratio <= 0) return `${prefix}: ratio must be positive.`
    return ''
  }

  const validate = () => {
    if (!tenantId || !companyId) return 'Select tenant and company first.'
    if (!form.invoiceNumber.trim()) return 'Invoice number is required.'
    if (!enteredLines.length) return 'Nhập ít nhất một dòng hàng.'
    for (let i = 0; i < enteredLines.length; i++) {
      const message = validateLine(enteredLines[i], i)
      if (message) return message
    }
    return ''
  }

  const requestSave = () => {
    const validation = validate()
    if (validation) { setError(validation); return }
    setError('')
    if (!savedInvoice) {
      setPayment({
        method: 'CASH',
        createPaymentNote: true,
        notes: `Thanh toán hóa đơn nhập kho ${form.invoiceNumber.trim()}${form.partyName.trim() ? ` · ${form.partyName.trim()}` : ''}`,
      })
    }
    setPaymentDialogOpen(true)
  }

  const handleSave = async () => {
    if (savingRef.current) return
    const validation = validate()
    if (validation) { setError(validation); return }
    savingRef.current = true
    setSaving(true)
    setError('')
    let createdInvoice = savedInvoice
    let inventoryCreatedCount = 0
    try {
      if (!createdInvoice) {
        createdInvoice = await createInvoice({
          invoiceType: 'PURCHASE',
          invoiceNumber: form.invoiceNumber.trim(),
          partyName: form.partyName.trim() || null,
          invoiceDate: form.invoiceDate || todayLocalDate(),
          currency,
          subtotal: invoiceTotal,
          taxAmount: 0,
          totalAmount: invoiceTotal,
          notes: form.notes || `Inventory receiving bill with ${enteredLines.length} item(s)`,
        }, { tenantId, companyId })

        for (const [index, line] of enteredLines.entries()) {
          const { warehouseQty, warehouseUnitPrice, ratio, bomQty, bomUnitPrice } = lineCalc(line)
          await addStock({
            materialId: line.material.id || undefined,
            materialCode: line.material.materialCode,
            warehouseId: line.warehouse.id || undefined,
            warehouseCode: line.warehouse.code,
            batchNo: line.batchNo.trim(),
            quantity: bomQty,
            unitPrice: bomUnitPrice,
            currency,
            warehouseImportUnit: line.warehouseImportUnit.trim(),
            warehouseImportQuantity: warehouseQty,
            warehouseImportUnitPrice: warehouseUnitPrice,
            bomUnitPerWarehouseUnit: ratio,
            invoiceId: createdInvoice.id,
            reason: `Invoice receiving ${form.invoiceNumber.trim()} item ${index + 1}`,
            notes: line.notes || form.notes || null
          })
          inventoryCreatedCount += 1
        }
        setSavedInvoice(createdInvoice)
      }

      if (payment.method !== 'NONE') {
        createdInvoice = await recordInvoicePayment(createdInvoice.id, {
          paymentMethod: payment.method,
          createPaymentNote: payment.createPaymentNote,
          paymentNotes: payment.notes.trim() || null,
        }, { tenantId, companyId })
      }

      onComplete?.(createdInvoice)
      setPaymentDialogOpen(false)
      onClose?.()
    } catch (e) {
      const receiptReady = Boolean(savedInvoice) || inventoryCreatedCount === enteredLines.length
      if (createdInvoice?.id && inventoryCreatedCount === 0 && !savedInvoice) {
        try { await deleteInvoice(createdInvoice.id, { tenantId, companyId }) } catch { /* best-effort rollback */ }
      }
      if (receiptReady) setSavedInvoice(createdInvoice)
      setError(receiptReady
        ? `Hóa đơn và hàng nhập đã được lưu. Thanh toán chưa ghi được: ${e?.message || 'thử lại hoặc chọn Chưa thanh toán.'}`
        : e?.message || 'Failed to save invoice and inventory items')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={saving || paymentDialogOpen ? undefined : onClose} maxWidth="xl" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <span>Hóa đơn mới · Nhập kho</span>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label={`${enteredLines.length} dòng hàng`} variant="outlined" sx={{ fontWeight: 800 }} />
            <Chip label={`Currency ${currency}`} color="primary" variant="outlined" sx={{ fontWeight: 800 }} />
          </Box>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 130px' }, gap: 1.5 }}>
            <TextField label="Số hóa đơn" size="small" value={form.invoiceNumber} onChange={setFormField('invoiceNumber')} required />
            <TextField label="Nhà cung cấp" size="small" value={form.partyName} onChange={setFormField('partyName')} />
            <TextField label="Ngày hóa đơn" type="date" size="small" value={form.invoiceDate} onChange={setFormField('invoiceDate')} InputLabelProps={{ shrink: true }} />
          </Box>

          <Alert severity="info">Tab / Shift+Tab chuyển ô · Tab chọn vật tư đầu tiên · Enter thêm dòng và chuyển đến mã hàng. Đơn vị BOM lấy từ vật tư; quy đổi lấy từ cấu hình kho / BOM. Kho và số lô được nhớ trong phiên làm việc cho dòng tiếp theo. Dòng trống cuối bảng không được lưu.</Alert>
          <Box component="fieldset" disabled={saving || loadingRefs} sx={{border:0,p:0,m:0,minWidth:0}}>
          <TableContainer sx={{maxHeight:'55vh',border:'1px solid #cbd5e1',borderRadius:1}}>
            <Table stickyHeader size="small" sx={{minWidth:1600,'& th':{fontWeight:800,bgcolor:'#eff6ff',whiteSpace:'nowrap'},'& td':{p:0.5,verticalAlign:'top'},'& .MuiOutlinedInput-root':{borderRadius:0.5}}}>
              <TableHead><TableRow>{['#','QR / Xóa','Mã / tên vật tư','SL nhập','Đơn vị kho','Hệ số → BOM','Đơn vị BOM','SL quy đổi','Đơn giá nhập','Thành tiền','Kho','Số lô','Ghi chú'].map((label,index)=><TableCell key={index}>{label}</TableCell>)}</TableRow></TableHead>
              <TableBody>{lines.map((line,index)=>{
                const calc=lineCalc(line)
                const defaults=receivingDefaults(line.material,line.warehouse,inventory,boms,currency)
                const materialQuery=normalizeSearch(line.materialInput)
                const matches=materialOptions.filter(m=>normalizeSearch(`${m.materialCode} ${m.materialName}`).includes(materialQuery)).slice(0,80)
                const conversionKey=defaults.options.find(o=>o.unit===line.warehouseImportUnit && o.ratio===Number(line.bomUnitPerWarehouseUnit))?.key || ''
                return <TableRow key={line.id} onKeyDown={e=>rowKeyDown(e,line)} sx={{'&:focus-within':{bgcolor:'#f0f9ff'}}}>
                  <TableCell>{index+1}</TableCell>
                  <TableCell sx={{whiteSpace:'nowrap'}}><IconButton tabIndex={-1} aria-label={`Quét QR dòng ${index+1}`} size="small" onClick={()=>openScannerForLine(line.id)}><QrCode2Icon fontSize="small"/></IconButton><IconButton tabIndex={-1} aria-label={`Xóa dòng ${index+1}`} size="small" color="error" disabled={saving || lines.length<=1} onClick={()=>removeLine(line.id)}><DeleteIcon fontSize="small"/></IconButton></TableCell>
                  <TableCell sx={{minWidth:280}}>
                    <Autocomplete autoHighlight options={materialOptions} loading={loadingRefs} value={line.material} inputValue={line.materialInput}
                      onInputChange={(_,value,reason)=>{if(reason==='input') updateLine(line.id,{materialInput:value,material:null,warehouseImportUnit:'',bomUnitPerWarehouseUnit:'',warehouseImportUnitPrice:''})}}
                      onChange={(_,option)=>selectMaterial(line,option)}
                      filterOptions={()=>line.material ? materialOptions.slice(0,80) : matches}
                      getOptionLabel={option=>`${option.materialCode} - ${option.materialName}`}
                      isOptionEqualToValue={(a,b)=>a.id===b.id}
                      slotProps={{clearIndicator:{tabIndex:-1},popupIndicator:{tabIndex:-1}}}
                      renderOption={(props,option)=><Box component="li" {...props} key={option.id} sx={{gap:1}}><MaterialThumb material={option} size={32}/><Box><Typography variant="body2">{option.materialCode} · {option.materialName}</Typography><Typography variant="caption">Đơn vị BOM: {option.unit || 'Chưa cấu hình'}</Typography></Box></Box>}
                      renderInput={params=><TextField {...params} size="small" placeholder="Gõ mã / tên, không cần dấu" inputRef={node=>{cells.current[`${line.id}:material`]=node}}
                        inputProps={{...params.inputProps,'aria-label':`Vật tư dòng ${index+1}`}}
                        onKeyDown={event=>{if(event.key==='Tab' && !event.shiftKey && !line.material && matches[0]) {event.preventDefault();event.defaultMuiPrevented=true;selectMaterial(line,matches[0]);cells.current[`${line.id}:quantity`]?.focus()}}}/>}/>
                  </TableCell>
                  <TableCell sx={{minWidth:110}}><TextField {...cellProps(line,'quantity','SL nhập')} type="number" value={line.warehouseImportQuantity} onChange={e=>updateLine(line.id,{warehouseImportQuantity:e.target.value})} inputProps={{...cellProps(line,'quantity','SL nhập').inputProps,min:0,step:'any'}}/></TableCell>
                  <TableCell sx={{minWidth:170}}><TextField {...cellProps(line,'unit','Đơn vị kho')} select value={conversionKey} SelectProps={{native:true}} onChange={e=>{const option=defaults.options.find(o=>o.key===e.target.value);if(option)updateLine(line.id,{warehouseImportUnit:option.unit,bomUnitPerWarehouseUnit:option.ratio,warehouseImportUnitPrice:defaults.priceFor(option.unit,option.ratio)})}}>
                    <option value="" disabled>{defaults.options.length?'Chọn quy đổi':'Chọn vật tư'}</option>{defaults.options.map(option=><option key={option.key} value={option.key}>{option.unit} · ×{option.ratio} ({option.source})</option>)}
                  </TextField></TableCell>
                  <TableCell sx={{minWidth:95}}><Typography sx={{pt:1}}>{line.bomUnitPerWarehouseUnit || '—'}</Typography></TableCell>
                  <TableCell><Typography sx={{pt:1}}>{line.material?.unit || '—'}</Typography></TableCell>
                  <TableCell><Typography sx={{pt:1}}>{calc.bomQty==null?'—':fmtNum(calc.bomQty,9)}</Typography></TableCell>
                  <TableCell sx={{minWidth:130}}><TextField {...cellProps(line,'price','Đơn giá nhập')} type="number" value={line.warehouseImportUnitPrice} onChange={e=>updateLine(line.id,{warehouseImportUnitPrice:e.target.value})} inputProps={{...cellProps(line,'price','Đơn giá nhập').inputProps,min:0,step:'any'}}/></TableCell>
                  <TableCell><Typography sx={{pt:1,whiteSpace:'nowrap'}}>{fmtNum(calc.total,2)}</Typography></TableCell>
                  <TableCell sx={{minWidth:190}}><TextField {...cellProps(line,'warehouse','Kho')} select SelectProps={{native:true}} value={line.warehouse?.id || ''} onChange={e=>{const warehouse=warehouses.find(w=>w.id===e.target.value)||null;rememberDefaults({warehouseId:warehouse?.id || ''});updateLine(line.id,{warehouse,...receivingDefaults(line.material,warehouse,inventory,boms,currency)})}}><option value="">Chọn kho</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</TextField></TableCell>
                  <TableCell sx={{minWidth:170}}><TextField {...cellProps(line,'batch','Số lô')} value={line.batchNo} onChange={e=>{rememberDefaults({batchNo:e.target.value});updateLine(line.id,{batchNo:e.target.value})}}/></TableCell>
                  <TableCell sx={{minWidth:170}}><TextField {...cellProps(line,'notes','Ghi chú')} value={line.notes} onChange={e=>updateLine(line.id,{notes:e.target.value})}/></TableCell>
                </TableRow>
              })}</TableBody>
            </Table>
          </TableContainer>
          </Box>

          <Button variant="outlined" startIcon={<AddIcon />} onClick={()=>addLine()} disabled={saving} sx={{ alignSelf: 'flex-start', fontWeight: 800 }}>Thêm dòng · Enter</Button>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Chip label={`Tổng hóa đơn ${fmtNum(invoiceTotal, 2)} ${currency}`} color="primary" sx={{ fontWeight: 900 }} />
          </Box>
          <TextField label="Ghi chú hóa đơn" size="small" value={form.notes} onChange={setFormField('notes')} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Hủy</Button>
          <Button variant="contained" onClick={requestSave} disabled={saving || loadingRefs}>
            {saving ? 'Đang lưu...' : savedInvoice ? 'Tiếp tục ghi thanh toán' : 'Lưu hóa đơn & nhập kho'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={paymentDialogOpen} onClose={saving ? undefined : () => setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Thanh toán hóa đơn nhập kho</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '10px !important' }}>
          {error && <Alert severity="warning">{error}</Alert>}
          <Alert severity="info"><strong>Có tạo phiếu chi hay không?</strong> Chọn cách đã trả cho nhà cung cấp. Phiếu chi tiền mặt được tính vào tiền ra của ca thu ngân; QR được lưu riêng.</Alert>
          <ToggleButtonGroup exclusive fullWidth color="primary" value={payment.method} onChange={(_, method) => method && setPayment(prev => ({ ...prev, method }))}>
            <ToggleButton value="NONE">Chưa thanh toán</ToggleButton>
            <ToggleButton value="CASH">Tiền mặt</ToggleButton>
            <ToggleButton value="BANK_QR">QR / chuyển khoản</ToggleButton>
          </ToggleButtonGroup>
          {payment.method !== 'NONE' && <>
            <FormControlLabel control={<Switch checked={payment.createPaymentNote} onChange={e => setPayment(prev => ({ ...prev, createPaymentNote: e.target.checked }))} />} label="Tạo phiếu chi" />
            <TextField autoFocus label="Ghi chú thanh toán / lý do chi" size="small" value={payment.notes} onChange={e => setPayment(prev => ({ ...prev, notes: e.target.value }))} multiline minRows={2} />
            <Chip color={payment.method === 'CASH' ? 'success' : 'primary'} label={`${payment.method === 'CASH' ? 'Tiền mặt' : 'QR'} · ${fmtNum(invoiceTotal, 2)} ${currency}`} sx={{ alignSelf: 'flex-start', fontWeight: 800 }} />
          </>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)} disabled={saving}>Quay lại</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : payment.method === 'NONE' ? 'Lưu chưa thanh toán' : payment.createPaymentNote ? 'Lưu & tạo phiếu chi' : 'Lưu đã thanh toán'}
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
