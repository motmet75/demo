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
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
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
import { fetchMaterials, createMaterial } from '../../api/materialApi'
import { listReceivingDocuments, getReceivingDocument, uploadReceivingPdf, confirmPdfReceiving } from '../../api/invoicePdfReceiveApi'
import { formatVnNumber, parseVnNumber, parseMachineNumber } from '../../utils/vietnameseNumbers'
import { fetchWarehouses } from '../../api/warehouseApi'
import { useAppContext } from '../../context/AppContext'
import { fmtNum } from '../../utils/format'
import { formatIntegerInput, formatQuantityInput, parseIntegerInput, parseQuantityInput } from '../../utils/numberInput'

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
  notes: '',
  invoiceItemName: '',
  pdfLineIndex: null,
  pdfUnit: '',
  newMaterial: false,
  newMaterialCode: '',
  newMaterialName: '',
  newMaterialUnit: '',
  newMaterialType: 'MATERIAL',
  vatRate: '0'
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
  const [validationIssue, setValidationIssue] = useState(null)
  const [form, setForm] = useState({ invoiceNumber: invoiceNumberSeed(), partyName: '', invoiceDate: todayLocalDate(), notes: '' })
  const [lines, setLines] = useState([newLine()])
  const [sharedLocation, setSharedLocation] = useState({ warehouse: null, batchNo: '' })
  const [pdfDocuments, setPdfDocuments] = useState([])
  const [pdfDocument, setPdfDocument] = useState(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [materialCreateId, setMaterialCreateId] = useState(null)
  const [pdfMismatchAcknowledged, setPdfMismatchAcknowledged] = useState(false)
  const [pdfSerial, setPdfSerial] = useState('')
  const [pdfSupplierTaxId, setPdfSupplierTaxId] = useState('')
  const [pdfCurrency, setPdfCurrency] = useState('VND')

  const currency = pdfDocument ? pdfCurrency : (defaultCurrency === 'USD' ? 'USD' : 'VND')
  const materialOptions = useMemo(() => materials.filter(m => m.materialCode || m.materialName), [materials])
  const enteredLines = lines.filter(hasLineInput)
  const computeLine = line => pdfDocument
      ? lineCalc({...line,
          warehouseImportQuantity:parseVnNumber(line.warehouseImportQuantity),
          warehouseImportUnitPrice:parseVnNumber(line.warehouseImportUnitPrice),
          bomUnitPerWarehouseUnit:parseVnNumber(line.bomUnitPerWarehouseUnit)})
      : lineCalc(line)
  const invoiceTotal = enteredLines.reduce((sum, line) => sum + computeLine(line).total, 0)
  const pdfSubtotal = pdfDocument ? parseMachineNumber(pdfDocument.subtotal) : NaN
  const pdfVat = pdfDocument ? parseMachineNumber(pdfDocument.vat) : NaN
  const pdfTotal = pdfDocument ? parseMachineNumber(pdfDocument.total) : NaN
  const computedVat = enteredLines.reduce((sum,line)=>
      sum+computeLine(line).total*(Number(line.vatRate)||0)/100,0)
  const pdfDifference = Boolean(pdfDocument) && (
    (Number.isFinite(pdfSubtotal) && Math.abs(invoiceTotal-pdfSubtotal)>1) ||
    (Number.isFinite(pdfVat) && Math.abs(computedVat-pdfVat)>1) ||
    (Number.isFinite(pdfTotal) && Math.abs(invoiceTotal+computedVat-pdfTotal)>1)
  )

  useEffect(() => {
    if (!open) return
    setError('')
    setValidationIssue(null)
    setScannerOpen(false)
    setScanLineId(null)
    setPaymentDialogOpen(false)
    setPayment({ method: 'CASH', createPaymentNote: true, notes: '' })
    setSavedInvoice(null)
    setPdfDocument(null)
    setPdfBusy(false)
    setMaterialCreateId(null)
    setPdfMismatchAcknowledged(false)
    setPdfSerial('')
    setPdfSupplierTaxId('')
    setPdfCurrency('VND')
    setPdfDocuments([])
    setForm({ invoiceNumber: invoiceNumberSeed(), partyName: '', invoiceDate: todayLocalDate(), notes: '' })
    try { remembered.current = JSON.parse(sessionStorage.getItem(sessionKey) || '{}') } catch { remembered.current = {} }
    setSharedLocation({ warehouse: null, batchNo: remembered.current.batchNo || '' })
    setLines([{ ...newLine(), batchNo: remembered.current.batchNo || '' }])
  }, [open, sessionKey])

  useEffect(() => {
    if (!open) return undefined
    let mounted = true
    setLoadingRefs(true)
    ;(async () => {
      try {
        const [materialList, warehouseList, inventoryList, bomList, documents] = await Promise.all([
          fetchMaterials(), fetchWarehouses(), fetchInventoryView(), fetchModelBoms(),
          listReceivingDocuments().catch(() => [])
        ])
        if (!mounted) return
        setInventory(inventoryList)
        setPdfDocuments(Array.isArray(documents) ? documents : [])
        setBoms(bomList.filter(row => String(row.tenantId ?? row.tenant?.id) === String(tenantId) && String(row.companyId ?? row.company?.id) === String(companyId)))
        setMaterials(Array.isArray(materialList) ? materialList.map(normalizeMaterial) : [])
        const options=Array.isArray(warehouseList) ? warehouseList.map(normalizeWarehouseOption) : []
        setWarehouses(options)
        const initialWarehouse=options.find(w=>w.id===remembered.current.warehouseId) || (options.length===1?options[0]:null)
        setSharedLocation({ warehouse: initialWarehouse, batchNo: remembered.current.batchNo || '' })
        setLines(prev=>prev.map(line=>line.warehouse?line:{...line,warehouse:initialWarehouse}))
      } catch (e) {
        if (mounted) setError(e?.message || 'Không tải được danh sách vật tư hoặc kho.')
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
  const clearValidation = () => { setValidationIssue(null); setError('') }
  const setFormField = field => event => { clearValidation(); setForm(prev => ({ ...prev, [field]: event.target.value })) }
  const updateLine = (id, patch) => { clearValidation(); setLines(prev => prev.map(line => line.id === id ? { ...line, ...patch } : line)) }
  const applyWarehouseToAll = warehouse => {
    clearValidation()
    rememberDefaults({ warehouseId: warehouse?.id || '' })
    setSharedLocation(prev => ({ ...prev, warehouse }))
    setLines(prev => prev.map(line => ({
      ...line,
      warehouse,
      ...(pdfDocument || line.newMaterial ? {} :
          receivingDefaults(line.material, warehouse, inventory, boms, currency)),
    })))
  }
  const applyBatchToAll = batchNo => {
    clearValidation()
    rememberDefaults({ batchNo })
    setSharedLocation(prev => ({ ...prev, batchNo }))
    setLines(prev => prev.map(line => ({ ...line, batchNo })))
  }
  const addLine = (afterId = lines.at(-1)?.id) => {
    if (pdfDocument) return // All PDF lines must be matched exactly once.
    const index = lines.findIndex(line => line.id === afterId)
    const existing = lines[index + 1]
    const defaults = {
      warehouse: sharedLocation.warehouse || warehouses.find(w=>w.id===remembered.current.warehouseId) || lines[index]?.warehouse || (warehouses.length === 1 ? warehouses[0] : null),
      batchNo: sharedLocation.batchNo,
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
    const warehouse = sharedLocation.warehouse || line.warehouse || warehouses.find(w=>w.id===remembered.current.warehouseId) || (warehouses.length === 1 ? warehouses[0] : null)
    const defaults=receivingDefaults(material, warehouse, inventory, boms, currency)
    const pdf=Boolean(pdfDocument)
    const invoiceUnit=line.pdfUnit||line.warehouseImportUnit
    const choice=defaults.options.find(option=>option.unit===invoiceUnit)
    updateLine(line.id, {
      material, warehouse, newMaterial:false,
      materialInput: material ? `${material.materialCode} - ${material.materialName}` : '',
      batchNo: line.batchNo||sharedLocation.batchNo,
      ...(pdf ? {
        warehouseImportUnit:invoiceUnit || defaults.warehouseImportUnit || '',
        bomUnitPerWarehouseUnit: choice?.ratio ||
          (material?.unit===invoiceUnit ? 1 : ''),
        warehouseImportQuantity:line.warehouseImportQuantity,
        warehouseImportUnitPrice:line.warehouseImportUnitPrice,
      } : defaults)
    })
  }
  const useNewMaterial = line => {
    clearValidation()
    const unit=line.pdfUnit||line.warehouseImportUnit||'cái'
    updateLine(line.id,{
      newMaterial:true,material:null,materialInput:'',
      newMaterialCode:line.newMaterialCode||'',
      newMaterialName:line.newMaterialName||line.invoiceItemName||'',
      newMaterialUnit:line.newMaterialUnit||unit,
      newMaterialType:line.newMaterialType||'MATERIAL',
      warehouseImportUnit:line.warehouseImportUnit||unit,
      bomUnitPerWarehouseUnit:line.bomUnitPerWarehouseUnit||'1',
    })
  }
  const applyPdfDocument = doc => {
    if(!doc)return
    if(!doc.items?.length) {
      setError('Invoice Desk chưa đọc được dòng hàng. Vui lòng mở Invoice Desk để sửa PDF.')
      return
    }
    const nextRows=doc.items.map((item,index)=>{
      const normalizedUnit=String(item.unit||'').trim()||'cái'
      const unitPrice=parseMachineNumber(item.unitPrice)
      const qty=parseMachineNumber(item.quantity)
      return {
        ...newLine(),pdfLineIndex:index,
        invoiceItemName:item.description||'',pdfUnit:normalizedUnit,
        warehouse:sharedLocation.warehouse || (warehouses.length===1?warehouses[0]:null),
        batchNo:sharedLocation.batchNo||'',
        warehouseImportQuantity:formatVnNumber(qty,6),
        warehouseImportUnit:normalizedUnit,
        bomUnitPerWarehouseUnit:'1',
        warehouseImportUnitPrice:formatVnNumber(unitPrice,4),
        vatRate:(String(doc.vatRate||'').match(/\d+(?:[.,]\d+)?/)||[])[0]?.replace(',','.')||'0'
      }
    })
    setPdfDocument(doc)
    setPdfSerial(doc.serial||'')
    setPdfSupplierTaxId(doc.sellerTaxId||'')
    setPdfCurrency(doc.currency||'VND')
    setPdfMismatchAcknowledged(false)
    setForm(prev=>({
      ...prev,invoiceNumber:doc.number||'',partyName:doc.seller||'',
      invoiceDate:doc.date||'',notes:prev.notes
    }))
    setLines(nextRows)
    setError('')
  }
  const loadPdfDocument = async id => {
    if(!id)return
    setPdfBusy(true);setError('')
    try {applyPdfDocument(await getReceivingDocument(id))}
    catch(error){setError(error.message||'Không thể tải hóa đơn OCR.')}
    finally{setPdfBusy(false)}
  }
  const handlePdfUpload = async event => {
    const file=event.target.files?.[0]
    event.target.value=''
    if(!file)return
    setPdfBusy(true);setError('')
    try{
      const document=await uploadReceivingPdf(file)
      setPdfDocuments(prev=>[document,...prev.filter(x=>x.id!==document.id)])
      applyPdfDocument(document)
    }catch(error){setError(error.message||'Không đọc được PDF.')}
    finally{setPdfBusy(false)}
  }
  const rowKeyDown = (event, line) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.target.tagName !== 'INPUT' || event.target.getAttribute('aria-expanded') === 'true') return
    if (pdfDocument) return
    event.preventDefault()
    addLine(line.id)
  }
  const cellProps = (line, field, label) => ({ size: 'small', fullWidth: true, inputRef: node => { cells.current[`${line.id}:${field}`] = node }, inputProps: { 'aria-label': `${label} dòng ${lines.indexOf(line)+1}` } })
  const removeLine = id => {
    if(pdfDocument)return
    setLines(prev => prev.length <= 1 ? prev : prev.filter(line => line.id !== id))
  }

  const openScannerForLine = id => {
    setScanLineId(id)
    setScannerOpen(true)
  }

  const handleScan = raw => {
    const material = findMaterialFromScan(raw, materialOptions)
    setScannerOpen(false)
    if (!material) {
      setError(`Không tìm thấy vật tư khớp với QR: ${String(raw).slice(0, 120)}`)
      return
    }
    const targetId = scanLineId || lines[0]?.id
    selectMaterial(lines.find(line => line.id === targetId), material)
    nextFocus.current = `${targetId}:quantity`
    setError('')
  }

  const validateLine = (line, index) => {
    const { warehouseQty, warehouseUnitPrice, ratio, bomQty } = computeLine(line)
    const prefix = `Dòng ${index + 1}`
    const issue = (field, message) => ({ lineId: line.id, field, message: `${prefix}: ${message}` })
    if (line.newMaterial && pdfDocument) {
      if (!line.newMaterialCode.trim() || line.newMaterialCode.length>50) return issue('material', 'nhập mã vật tư mới (≤ 50 ký tự).')
      if (!line.newMaterialName.trim()) return issue('material', 'nhập tên nguyên vật liệu gốc.')
      if (!line.newMaterialUnit.trim()) return issue('unit', 'nhập đơn vị vật tư mới.')
    } else if (!line.material) return issue('material',
      line.newMaterial ? 'Bấm Tạo vật tư tại dòng này trước khi lưu hóa đơn nhập tay.' :
        'bắt buộc chọn vật tư gốc hoặc Tạo mới tại dòng.')
    if (line.material && !line.material.unit) return issue('material', 'vật tư chưa có đơn vị BOM.')
    if (!line.warehouse) return issue('warehouse', 'bắt buộc chọn kho.')
    if (!line.batchNo.trim()) return issue('batch', 'bắt buộc nhập số lô.')
    if (!line.warehouseImportUnit.trim()) return issue('unit', 'bắt buộc nhập đơn vị trên hóa đơn.')
    if (warehouseQty === null || warehouseQty <= 0 || !Number.isFinite(warehouseQty)) return issue('quantity', 'số lượng nhập không hợp lệ.')
    if (warehouseUnitPrice === null || warehouseUnitPrice < 0 || !Number.isFinite(warehouseUnitPrice)) return issue('price', 'đơn giá không hợp lệ.')
    if (ratio === null || ratio <= 0 || !Number.isFinite(ratio) || !Number.isFinite(bomQty)) return issue('unit', 'hệ số quy đổi không hợp lệ.')
    if (pdfDocument) {
      const quantityFromPdf=parseMachineNumber(pdfDocument.items[line.pdfLineIndex]?.quantity)
      if (!Number.isFinite(quantityFromPdf) || Math.abs(quantityFromPdf-warehouseQty)>0.000001)
        return issue('quantity', 'SL phải trùng PDF; hãy sửa số lượng trong Invoice Desk nếu OCR sai.')
      if (!Number.isFinite(Number(line.vatRate)) || Number(line.vatRate)<0 || Number(line.vatRate)>100)
        return issue('price', 'VAT phải nằm trong khoảng 0–100%.')
    }
    return null
  }

  const validate = () => {
    if (!tenantId || !companyId) return { message: 'Vui lòng chọn đơn vị và công ty trước.' }
    if (!form.invoiceNumber.trim()) return { field: 'invoiceNumber', message: 'Bắt buộc nhập số hóa đơn.' }
    if (!enteredLines.length) return { message: 'Nhập ít nhất một dòng hàng.' }
    if (pdfDocument && (
      !pdfSerial.trim() || !form.partyName.trim() || !form.invoiceDate ||
      enteredLines.length!==pdfDocument.items.length
    )) return { message:'PDF chưa đủ thông tin ký hiệu, ngày, nhà cung cấp hoặc dòng hàng.' }
    if (pdfDifference && !pdfMismatchAcknowledged)
      return { message:'Tiền hàng/VAT khác PDF. Vui lòng đối chiếu và xác nhận chênh lệch.' }
    for (let i = 0; i < enteredLines.length; i++) {
      const issue = validateLine(enteredLines[i], i)
      if (issue) return issue
    }
    return null
  }

  const showValidation = issue => {
    setValidationIssue(issue)
    setError(issue.message)
    if (issue.lineId && issue.field) {
      window.requestAnimationFrame(() => cells.current[`${issue.lineId}:${issue.field}`]?.focus())
    }
  }

  const requestSave = () => {
    const validation = validate()
    if (validation) { showValidation(validation); return }
    setValidationIssue(null)
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

  const createMaterialInline = async line => {
    if(pdfDocument)return // PDF materials are created atomically on confirmation.
    const code=line.newMaterialCode.trim()
    const name=line.newMaterialName.trim()
    const unit=line.newMaterialUnit.trim()
    if(!code||!name||!unit){setError('Cần nhập mã, tên và đơn vị cho nguyên vật liệu mới.');return}
    if(materialOptions.some(m=>m.materialCode===code)){
      setError('Mã vật tư đã có. Hãy chọn mã có sẵn.');return
    }
    setMaterialCreateId(line.id);setError('')
    try{
      const saved=normalizeMaterial(await createMaterial({
        materialCode:code,materialName:name,unit,materialType:line.newMaterialType||'MATERIAL',
        isActive:true
      }))
      setMaterials(prev=>[...prev,saved])
      selectMaterial(line,saved)
    }catch(e){setError(e?.message||'Không tạo được vật tư.')}
    finally{setMaterialCreateId(null)}
  }

  const handleSave = async () => {
    if (savingRef.current) return
    const validation = validate()
    if (validation) { showValidation(validation); return }
    setValidationIssue(null)
    savingRef.current = true
    setSaving(true)
    setError('')
    let createdInvoice = savedInvoice
    let inventoryCreatedCount = 0
    let pdfCommitted = false
    try {
      if (!createdInvoice && pdfDocument) {
        const receipt=await confirmPdfReceiving({
          documentId:pdfDocument.id,invoiceDate:form.invoiceDate,
          invoiceSerial:pdfSerial,invoiceNumber:form.invoiceNumber,
          supplierName:form.partyName,supplierTaxId:pdfSupplierTaxId,
          currency,acknowledgeMismatch:pdfMismatchAcknowledged,
          lines:enteredLines.map(line=>{
            const calculation=computeLine(line)
            return {
              invoiceLineIndex:line.pdfLineIndex,
              materialId:line.newMaterial?null:line.material?.id||null,
              newMaterialCode:line.newMaterial?line.newMaterialCode:null,
              newMaterialName:line.newMaterial?line.newMaterialName:null,
              newMaterialUnit:line.newMaterial?line.newMaterialUnit:null,
              newMaterialType:line.newMaterial?line.newMaterialType:null,
              warehouseId:line.warehouse.id,batchNo:line.batchNo,
              quantity:calculation.warehouseQty,invoiceUnit:line.warehouseImportUnit,
              bomUnitPerInvoiceUnit:calculation.ratio,
              unitPrice:calculation.warehouseUnitPrice,
              vatRate:Number(line.vatRate),
            }
          })
        })
        createdInvoice={id:receipt.invoiceId}
        pdfCommitted=true
        setSavedInvoice(createdInvoice)
      }
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
          const { warehouseQty, warehouseUnitPrice, ratio, bomQty, bomUnitPrice } = computeLine(line)
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
      const receiptReady = Boolean(savedInvoice) || pdfCommitted || (inventoryCreatedCount===enteredLines.length && !pdfDocument)
      if (createdInvoice?.id && inventoryCreatedCount === 0 && !savedInvoice && !pdfCommitted) {
        try { await deleteInvoice(createdInvoice.id, { tenantId, companyId }) } catch { /* best-effort rollback */ }
      }
      if (receiptReady) setSavedInvoice(createdInvoice)
      setError(receiptReady
          ? `Hóa đơn và hàng nhập đã được lưu. Thanh toán chưa ghi được: ${e?.message || 'thử lại hoặc chọn Chưa thanh toán.'}`
          : e?.message || 'Không lưu được hóa đơn và các dòng nhập kho.')
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
            <Box sx={{p:1.5,border:'1px solid #bae6fd',borderRadius:1.5,bgcolor:'#f0f9ff'}}>
              <Stack direction={{xs:'column',sm:'row'}} gap={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={800}>Nhập kho từ hóa đơn PDF (OCR)</Typography>
                <Button variant="contained" size="small" component="label"
                  disabled={saving||pdfBusy||Boolean(savedInvoice)}>
                  {pdfBusy?'Đang đọc PDF...':'Tải PDF vào hóa đơn này'}
                  <input hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp"
                    onChange={e=>void handlePdfUpload(e)} />
                </Button>
                <TextField size="small" select label="Hoặc chọn PDF đã đọc bằng Invoice Desk"
                  value={pdfDocument?.id||''} sx={{minWidth:250,flex:1}}
                  disabled={saving||pdfBusy||Boolean(savedInvoice)}
                  onChange={e=>void loadPdfDocument(e.target.value)}>
                  <MenuItem value="">Chọn hóa đơn</MenuItem>
                  {pdfDocuments.map(doc=><MenuItem key={doc.id} value={doc.id}>
                    {[doc.serial,doc.number,doc.seller||doc.source].filter(Boolean).join(' · ')}
                  </MenuItem>)}
                </TextField>
                {pdfBusy&&<CircularProgress size={20}/>}
                {pdfDocument&&<Button size="small" variant="outlined" disabled={saving||Boolean(savedInvoice)}
                  onClick={()=>{setPdfDocument(null);setPdfMismatchAcknowledged(false);setLines([newLine()]);setForm({invoiceNumber:invoiceNumberSeed(),partyName:'',invoiceDate:todayLocalDate(),notes:''})}}>
                  Nhập tay thay vì PDF
                </Button>}
              </Stack>
              {pdfDocument&&<Alert severity="info" sx={{mt:1}}>
                Giữ tên hàng theo PDF, chọn <strong>vật tư gốc</strong> đã có hoặc <strong>Tạo mới ngay tại dòng</strong>.
                Chỉ xác nhận mới cộng tồn kho.
                {pdfDocument.warnings?.length>0&&<Typography variant="caption" display="block">
                  Cần kiểm tra OCR: {pdfDocument.warnings.slice(0,4).join(' · ')}
                </Typography>}
              </Alert>}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 130px' }, gap: 1.5 }}>
              <TextField label="Số hóa đơn" size="small" value={form.invoiceNumber} onChange={setFormField('invoiceNumber')} required error={validationIssue?.field==='invoiceNumber'} helperText={validationIssue?.field==='invoiceNumber'?'Bắt buộc nhập số hóa đơn.':''} />
              <TextField label="Nhà cung cấp" size="small" value={form.partyName} onChange={setFormField('partyName')} />
              <TextField label="Ngày hóa đơn" type="date" size="small" value={form.invoiceDate} onChange={setFormField('invoiceDate')} InputLabelProps={{ shrink: true }} />
            </Box>
            {pdfDocument&&<Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',sm:'1fr 1fr 1fr'},gap:1}}>
              <TextField label="Ký hiệu hóa đơn" size="small" value={pdfSerial} onChange={e=>setPdfSerial(e.target.value)}/>
              <TextField label="MST nhà cung cấp" size="small" value={pdfSupplierTaxId} onChange={e=>setPdfSupplierTaxId(e.target.value)}/>
              <TextField select label="Tiền tệ PDF" size="small" value={pdfCurrency}
                onChange={e=>setPdfCurrency(e.target.value)}>
                {['VND','USD','EUR','JPY','CNY'].map(c=><MenuItem value={c} key={c}>{c}</MenuItem>)}
              </TextField>
            </Box>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(260px, 1fr) minmax(220px, 1fr)' }, gap: 1.5, p: 1.5, border: '1px solid #bfdbfe', borderRadius: 1, bgcolor: '#eff6ff' }}>
              <TextField size="small" select SelectProps={{ native: true }} label="Kho chung · áp dụng tất cả dòng" value={sharedLocation.warehouse?.id || ''} onChange={e => applyWarehouseToAll(warehouses.find(w => w.id === e.target.value) || null)}>
                <option value="">Chọn kho</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
              </TextField>
              <TextField size="small" label="Số lô chung · áp dụng tất cả dòng" value={sharedLocation.batchNo} onChange={e => applyBatchToAll(e.target.value)} />
            </Box>

            <Alert severity="info">Kho và số lô phía trên là mặc định chung.
              {pdfDocument?' Đối chiếu tên PDF với tên vật tư gốc; giá sử dụng định dạng Việt Nam (1.000.000,50).':' Tab / Shift+Tab chuyển ô · Enter thêm dòng.'}
            </Alert>
            <Box component="fieldset" disabled={saving || loadingRefs || pdfBusy || Boolean(savedInvoice)} sx={{border:0,p:0,m:0,minWidth:0}}>
              <TableContainer sx={{maxHeight:'55vh',border:'1px solid #cbd5e1',borderRadius:1}}>
                <Table stickyHeader size="small" sx={{minWidth:pdfDocument?2050:1600,'& th':{fontWeight:800,bgcolor:'#eff6ff',whiteSpace:'nowrap'},'& td':{p:0.5,verticalAlign:'top'},'& .MuiOutlinedInput-root':{borderRadius:0.5}}}>
                  <TableHead><TableRow>{['#','QR / Xóa',...(pdfDocument?['Tên hàng theo PDF']:[]),'Mã / Tên vật tư gốc','SL nhập','Đơn vị kho','Hệ số → BOM','Đơn vị BOM','SL quy đổi','Đơn giá nhập','Thành tiền','Kho','Số lô','Ghi chú'].map((label,index)=><TableCell key={index}>{label}</TableCell>)}</TableRow></TableHead>
                  <TableBody>{lines.map((line,index)=>{
                    const calc=computeLine(line)
                    const defaults=receivingDefaults(line.material,line.warehouse,inventory,boms,currency)
                    const materialQuery=normalizeSearch(line.materialInput)
                    const matches=materialOptions.filter(m=>normalizeSearch(`${m.materialCode} ${m.materialName}`).includes(materialQuery)).slice(0,80)
                    const conversionKey=defaults.options.find(o=>o.unit===line.warehouseImportUnit && o.ratio===Number(line.bomUnitPerWarehouseUnit))?.key || ''
                    return <TableRow key={line.id} onKeyDown={e=>rowKeyDown(e,line)} sx={{'&:focus-within':{bgcolor:'#f0f9ff'}}}>
                      <TableCell>{index+1}</TableCell>
                      <TableCell sx={{whiteSpace:'nowrap'}}><IconButton tabIndex={-1} aria-label={`Quét QR dòng ${index+1}`} size="small" onClick={()=>openScannerForLine(line.id)}><QrCode2Icon fontSize="small"/></IconButton><IconButton tabIndex={-1} aria-label={`Xóa dòng ${index+1}`} size="small" color="error" disabled={saving || Boolean(pdfDocument) || lines.length<=1} onClick={()=>removeLine(line.id)}><DeleteIcon fontSize="small"/></IconButton></TableCell>
                      {pdfDocument&&<TableCell sx={{minWidth:265}}>
                        <Typography variant="body2" fontWeight={800} sx={{whiteSpace:'normal'}}>{line.invoiceItemName||'Chưa có tên OCR'}</Typography>
                        <Typography variant="caption">SL PDF: {formatVnNumber(parseMachineNumber(pdfDocument.items[line.pdfLineIndex]?.quantity),6)} {line.pdfUnit}</Typography>
                      </TableCell>}
                      <TableCell sx={{minWidth:320}}>
                        {line.newMaterial?<Box sx={{display:'flex',flexDirection:'column',gap:0.7}}>
                          <Chip color="primary" size="small" label="Tạo nguyên vật liệu mới tại đây" sx={{alignSelf:'flex-start'}}/>
                          <TextField size="small" label="Mã vật tư mới" value={line.newMaterialCode} onChange={e=>updateLine(line.id,{newMaterialCode:e.target.value})}/>
                          <TextField size="small" label="Tên nguyên vật liệu gốc" value={line.newMaterialName} onChange={e=>updateLine(line.id,{newMaterialName:e.target.value})}/>
                          <Stack direction="row" spacing={0.5}>
                            <TextField size="small" label="Đơn vị vật tư" value={line.newMaterialUnit} sx={{flex:1}}
                              onChange={e=>updateLine(line.id,{newMaterialUnit:e.target.value})}/>
                            <TextField select size="small" label="Loại" value={line.newMaterialType} sx={{minWidth:110}}
                              onChange={e=>updateLine(line.id,{newMaterialType:e.target.value})}>
                              {['MATERIAL','MACHINE','RAW','SEMI','FINISHED','OTHER'].map(t=><MenuItem key={t} value={t}>{t}</MenuItem>)}
                            </TextField>
                          </Stack>
                          {pdfDocument?<Typography variant="caption">Vật tư mới tạo cùng phiếu nhập kho khi xác nhận.</Typography>:
                            <Button size="small" variant="contained" disabled={materialCreateId===line.id}
                              onClick={()=>void createMaterialInline(line)}>{materialCreateId===line.id?'Đang tạo...':'Tạo vật tư'}</Button>}
                          <Button size="small" onClick={()=>updateLine(line.id,{newMaterial:false})}>Chọn mã có sẵn</Button>
                        </Box>:<>

                        <Autocomplete autoHighlight options={materialOptions} loading={loadingRefs} value={line.material} inputValue={line.materialInput}
                                      onInputChange={(_,value,reason)=>{if(reason==='input') updateLine(line.id,{
  materialInput:value,material:null,
  ...(pdfDocument?{}:{warehouseImportUnit:'',bomUnitPerWarehouseUnit:'',warehouseImportUnitPrice:''})
})}}
                                      onChange={(_,option)=>selectMaterial(line,option)}
                                      filterOptions={()=>line.material ? materialOptions.slice(0,80) : matches}
                                      getOptionLabel={option=>`${option.materialCode} - ${option.materialName}`}
                                      isOptionEqualToValue={(a,b)=>a.id===b.id}
                                      slotProps={{clearIndicator:{tabIndex:-1},popupIndicator:{tabIndex:-1}}}
                                      renderOption={(props,option)=><Box component="li" {...props} key={option.id} sx={{gap:1}}><MaterialThumb material={option} size={32}/><Box><Typography variant="body2">{option.materialCode} · {option.materialName}</Typography><Typography variant="caption">Đơn vị BOM: {option.unit || 'Chưa cấu hình'}</Typography></Box></Box>}
                                      renderInput={params=><TextField {...params} size="small" placeholder="Gõ mã / tên, không cần dấu" error={validationIssue?.lineId===line.id&&validationIssue?.field==='material'} helperText={validationIssue?.lineId===line.id&&validationIssue?.field==='material'?'Bắt buộc':''} inputRef={node=>{cells.current[`${line.id}:material`]=node}}
                                                                      inputProps={{...params.inputProps,'aria-label':`Vật tư dòng ${index+1}`}}
                                                                      onKeyDown={event=>{if(event.key==='Tab' && !event.shiftKey && !line.material && matches[0]) {event.preventDefault();event.defaultMuiPrevented=true;selectMaterial(line,matches[0]);cells.current[`${line.id}:quantity`]?.focus()}}}/>}/>
                      
                        <Button size="small" variant="outlined" onClick={()=>useNewMaterial(line)}>+ Tạo mới tại dòng</Button>
                        {line.material&&<Typography variant="caption" display="block">Tên gốc: {line.material.materialName} · Mã: {line.material.materialCode}</Typography>}
                        </>}
                      </TableCell>
                      <TableCell sx={{minWidth:110}}><TextField {...cellProps(line,'quantity','SL nhập')} type="text" value={pdfDocument?line.warehouseImportQuantity:formatQuantityInput(line.warehouseImportQuantity)} error={validationIssue?.lineId===line.id&&validationIssue?.field==='quantity'} helperText={validationIssue?.lineId===line.id&&validationIssue?.field==='quantity'?'Bắt buộc':''} onChange={e=>updateLine(line.id,{warehouseImportQuantity:pdfDocument?e.target.value:parseQuantityInput(e.target.value)})} inputProps={{...cellProps(line,'quantity','SL nhập').inputProps,inputMode:'decimal',min:0,step:'any'}}/></TableCell>
                      <TableCell sx={{minWidth:170}}>
                        {pdfDocument?<Box sx={{display:'flex',flexDirection:'column',gap:0.5}}>
                          <TextField size="small" label="Đơn vị theo HĐ" value={line.warehouseImportUnit}
                            onChange={e=>updateLine(line.id,{warehouseImportUnit:e.target.value})}/>
                          <TextField size="small" label="Đơn vị gốc / 1 ĐV HĐ" value={line.bomUnitPerWarehouseUnit}
                            onChange={e=>updateLine(line.id,{bomUnitPerWarehouseUnit:e.target.value})}/>
                        </Box>:<TextField {...cellProps(line,'unit','Đơn vị kho')} select value={conversionKey}
                          error={validationIssue?.lineId===line.id&&validationIssue?.field==='unit'} SelectProps={{native:true}}
                          onChange={e=>{const option=defaults.options.find(o=>o.key===e.target.value);if(option)updateLine(line.id,{
                            warehouseImportUnit:option.unit,bomUnitPerWarehouseUnit:option.ratio,warehouseImportUnitPrice:defaults.priceFor(option.unit,option.ratio)
                          })}}>
                          <option value="" disabled>{defaults.options.length?'Chọn quy đổi':'Chọn vật tư'}</option>
                          {defaults.options.map(option=><option key={option.key} value={option.key}>{option.unit} · ×{option.ratio} ({option.source})</option>)}
                        </TextField>}
                      </TableCell>
                      <TableCell sx={{minWidth:95}}><Typography sx={{pt:1}}>{line.bomUnitPerWarehouseUnit || '—'}</Typography></TableCell>
                      <TableCell><Typography sx={{pt:1}}>{line.material?.unit || (line.newMaterial?line.newMaterialUnit:'—')}</Typography></TableCell>
                      <TableCell><Typography sx={{pt:1}}>{calc.bomQty==null?'—':formatVnNumber(calc.bomQty,6)}</Typography></TableCell>
                      <TableCell sx={{minWidth:130}}><TextField {...cellProps(line,'price','Đơn giá nhập')} type="text" value={pdfDocument?line.warehouseImportUnitPrice:formatQuantityInput(line.warehouseImportUnitPrice, 2)} error={validationIssue?.lineId===line.id&&validationIssue?.field==='price'} helperText={validationIssue?.lineId===line.id&&validationIssue?.field==='price'?'Không hợp lệ':''} onChange={e=>updateLine(line.id,{warehouseImportUnitPrice:pdfDocument?e.target.value:parseQuantityInput(e.target.value,{maximumFractionDigits:2})})} inputProps={{...cellProps(line,'price','Đơn giá nhập').inputProps,inputMode:'decimal',min:0,step:'any'}}/></TableCell>
                      <TableCell><Typography sx={{pt:1,whiteSpace:'nowrap'}}>{pdfDocument?formatVnNumber(calc.total,2):fmtNum(calc.total,2)}</Typography></TableCell>
                      <TableCell sx={{minWidth:190}}><TextField {...cellProps(line,'warehouse','Kho')} select SelectProps={{native:true}} value={line.warehouse?.id || ''} error={validationIssue?.lineId===line.id&&validationIssue?.field==='warehouse'} helperText={validationIssue?.lineId===line.id&&validationIssue?.field==='warehouse'?'Bắt buộc':''} onChange={e=>applyWarehouseToAll(warehouses.find(w=>w.id===e.target.value)||null)}><option value="">Chọn kho</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}</TextField></TableCell>
                      <TableCell sx={{minWidth:170}}><TextField {...cellProps(line,'batch','Số lô')} required value={line.batchNo} error={validationIssue?.lineId===line.id&&validationIssue?.field==='batch'} helperText={validationIssue?.lineId===line.id&&validationIssue?.field==='batch'?'Bắt buộc nhập số lô':''} onChange={e=>applyBatchToAll(e.target.value)}/></TableCell>
                      <TableCell sx={{minWidth:170}}><TextField {...cellProps(line,'notes','Ghi chú')} value={line.notes} onChange={e=>updateLine(line.id,{notes:e.target.value})}/></TableCell>
                    </TableRow>
                  })}</TableBody>
                </Table>
              </TableContainer>
            </Box>

            <Button variant="outlined" startIcon={<AddIcon />} onClick={()=>addLine()} disabled={saving || Boolean(pdfDocument)} sx={{ alignSelf: 'flex-start', fontWeight: 800 }}>Thêm dòng · Enter</Button>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap:'wrap',gap:1 }}>
              <Chip label={`Tiền hàng ${formatVnNumber(invoiceTotal,2)} ${currency}`} color="primary" sx={{fontWeight:800}}/>
              {pdfDocument&&<>
                <Chip label={`VAT ${formatVnNumber(computedVat,2)} ${currency}`}/>
                <Chip label={`Tổng ${formatVnNumber(invoiceTotal+computedVat,2)} ${currency}`} color="success"/>
                <Chip label={`PDF: ${formatVnNumber(pdfTotal,2)} ${currency}`} variant="outlined"/>
              </>}
            </Box>
            {pdfDifference&&<Alert severity="warning">
              Tổng tiền hoặc VAT tính lại khác PDF. Kiểm tra đơn giá, VAT, đơn vị quy đổi và số lượng.
              <FormControlLabel control={<Switch checked={pdfMismatchAcknowledged}
                onChange={e=>setPdfMismatchAcknowledged(e.target.checked)}/>}
                label="Đã kiểm tra và đồng ý chênh lệch với PDF"/>
            </Alert>}
            <TextField label="Ghi chú hóa đơn" size="small" value={form.notes} onChange={setFormField('notes')} multiline minRows={2} />
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose} disabled={saving}>Hủy</Button>
            <Button variant="contained" onClick={requestSave} disabled={saving || loadingRefs}>
              {saving ? 'Đang lưu...' : savedInvoice ? 'Tiếp tục ghi thanh toán' : pdfDocument ? 'Đối chiếu xong · Lưu PDF & nhập kho' : 'Lưu hóa đơn & nhập kho'}
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