import React, { useEffect, useState, useMemo, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Badge from '@mui/material/Badge'
import InputAdornment from '@mui/material/InputAdornment'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import PrintIcon from '@mui/icons-material/Print'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import CloseIcon from '@mui/icons-material/Close'
import TableBarIcon from '@mui/icons-material/TableBar'
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining'
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MonitorIcon from '@mui/icons-material/Monitor'
import PersonIcon from '@mui/icons-material/Person'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { fetchModels } from '../../api/modelApi'
import { fetchShopTables, createStaffOrder, fetchOrderTagQr, fetchMenuOptions, fetchCustomers, linkOrderCustomer, createCustomer, redeemVoucher } from '../../api/shopApi'
import { printOrderReceiptTracked, printOrderTagTracked } from '../../utils/printWithHistory'
import { broadcastToCounter } from '../shopboard/CounterDisplayPage'
import VoucherQrScanDialog from './VoucherQrScanDialog'

const fmt         = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const fmtDots     = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripDigits = (s) => s.replace(/[^0-9]/g, '')
const voucherLabel = (value) => {
  const raw = String(value || '').trim()
  if (raw.startsWith('BV:')) return raw.split(':')[1] || raw
  return raw.toUpperCase()
}

function extractCustomerLookup(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  const match = value.match(/(?:customerCode|customer|code)[:=]\s*([A-Za-z0-9-]+)/i)
  if (match) return match[1].trim()
  try {
    const url = new URL(value)
    return (url.searchParams.get('customerCode') || url.searchParams.get('code') || url.pathname.split('/').filter(Boolean).pop() || value).trim()
  } catch {
    return value
  }
}

const normalizeCustomerLookup = (value) => String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

const parseAllowedSideIds = (model) => {
  try {
    const ids = model?.allowedSideIds ? JSON.parse(model.allowedSideIds) : []
    return Array.isArray(ids) ? ids.map(String) : []
  } catch {
    return []
  }
}

const hasPricedChoices = (choices) =>
  choices.some(choice => typeof choice === 'object' && choice !== null && Number(choice.price || 0) > 0)

const choiceQtyFromValue = (value, label) => {
  if (!value) return 0
  if (typeof value === 'object' && !Array.isArray(value)) return Number(value[label] || 0)
  if (typeof value === 'string') return value === label ? 1 : 0
  if (Array.isArray(value)) return value.includes(label) ? 1 : 0
  return 0
}
const FULFILLMENT = [
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon fontSize="small" /> },
]

export default function ManualOrderDialog({ open, onClose, onCreated, defaultTable, defaultItems }) {
  const [models, setModels]         = useState([])
  const [tables, setTables]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  // form state
  const [manualNum, setManualNum]       = useState('')
  const [fulfillment, setFulfillment]   = useState(defaultTable ? 'DINE_IN' : 'PICKUP')
  const [tableId, setTableId]           = useState(defaultTable?.id || '')
  const [customer, setCustomer]         = useState({ name: '', phone: '' })
  const [payment, setPayment]           = useState('CASH')
  const [notes, setNotes]               = useState('')
  const [customerCash, setCustomerCash] = useState('')
  const [items, setItems]               = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [optsByModel, setOptsByModel]   = useState({})

  // customer search/link
  const [customerId, setCustomerId]         = useState(null)
  const [custOptions, setCustOptions]       = useState([])
  const [custSearching, setCustSearching]   = useState(false)
  const [customerScanOpen, setCustomerScanOpen] = useState(false)
  const custTimerRef = useRef(null)

  // new customer inline form
  const [newCustOpen, setNewCustOpen]       = useState(false)
  const [newCustForm, setNewCustForm]       = useState({ name: '', phone: '', customerCode: '' })
  const [newCustSaving, setNewCustSaving]   = useState(false)
  const [newCustError, setNewCustError]     = useState('')

  // linked customer QR
  const [linkedCustomerCode, setLinkedCustomerCode] = useState(null)
  const [custQrDialog, setCustQrDialog]             = useState(null)

  // voucher QR
  const [voucherScanOpen, setVoucherScanOpen]       = useState(false)
  const [scannedVoucherPayload, setScannedVoucherPayload] = useState('')
  const [voucherRedeeming, setVoucherRedeeming]     = useState(false)
  const [voucherResult, setVoucherResult]           = useState(null)
  const [voucherError, setVoucherError]             = useState('')

  // post-create state
  const [createdOrder, setCreatedOrder] = useState(null)
  const [tagQr, setTagQr]               = useState('')
  const [tagLoading, setTagLoading]     = useState(false)
  const [imagePreview, setImagePreview]     = useState(null)

  // counter display broadcast highlight
  const [justBroadcast, setJustBroadcast] = useState(false)
  const bcTimerRef = useRef(null)

  const tableName = useMemo(() => tables.find(t => t.id === tableId)?.tableName || '', [tableId, tables])

  const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

  const openNewCust = () => {
    setNewCustForm({ name: customer.name || '', phone: customer.phone || '', customerCode: genCode() })
    setNewCustError('')
    setNewCustOpen(true)
  }

  const saveNewCust = async () => {
    if (!newCustForm.name.trim()) { setNewCustError('Name is required'); return }
    setNewCustSaving(true); setNewCustError('')
    try {
      const { res, data } = await createCustomer({
        name: newCustForm.name.trim(),
        phone: newCustForm.phone || null,
        customerCode: newCustForm.customerCode || null,
      })
      if (!res.ok) { setNewCustError(data?.error || data?.message || 'Failed to create customer'); setNewCustSaving(false); return }
      setCustomer({ name: data.name, phone: data.phone || '' })
      setCustomerId(data.id)
      setLinkedCustomerCode(data.customerCode || newCustForm.customerCode || null)
      setCustOptions([])
      setNewCustOpen(false)
    } catch (e) { setNewCustError(e.message || 'Network error') }
    setNewCustSaving(false)
  }

  const printCustomerQr = (c) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(c.customerCode)}`
    const w = window.open('', '_blank', 'width=420,height=520')
    w.document.write(`<!DOCTYPE html><html><head><title>Customer QR — ${c.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:24px;margin:0}
      img{display:block;margin:0 auto 12px;border:1px solid #e0e0e0;border-radius:8px}
      code{font-size:22px;letter-spacing:4px;font-weight:800;display:block;margin:8px 0;font-family:monospace}
      p{margin:4px 0;color:#555;font-size:14px}@media print{button{display:none}}</style>
      </head><body>
      <img src="${qrUrl}" width="260" height="260" />
      <code>${c.customerCode}</code>
      <p><strong>${c.name}</strong></p>
      ${c.phone ? `<p>${c.phone}</p>` : ''}
      <script>document.querySelector('img').onload=()=>window.print()<\/script>
      </body></html>`)
    w.document.close()
  }

  const handleCustInput = (val) => {
    setCustomer(c => ({ ...c, name: val }))
    setCustomerId(null)
    clearTimeout(custTimerRef.current)
    if (!val || val.length < 1) { setCustOptions([]); return }
    custTimerRef.current = setTimeout(async () => {
      setCustSearching(true)
      try {
        const { data } = await fetchCustomers(val)
        setCustOptions(Array.isArray(data) ? data : [])
      } catch { setCustOptions([]) }
      setCustSearching(false)
    }, 300)
  }

  const findExactCustomer = (list, q) => {
    const lookup = normalizeCustomerLookup(q)
    if (!lookup) return null
    return (list || []).find(c =>
      normalizeCustomerLookup(c.customerCode) === lookup ||
      normalizeCustomerLookup(c.phone) === lookup
    ) || null
  }

  const selectCustomer = (c) => {
    if (!c) return
    setCustomer({ name: c.name, phone: c.phone || '' })
    setCustomerId(c.id)
    setLinkedCustomerCode(c.customerCode || null)
    setCustOptions([])
    setError('')
  }

  const handleCustomerScan = async (payload) => {
    setCustomerScanOpen(false)
    const lookup = extractCustomerLookup(payload)
    if (!lookup) return
    setCustSearching(true); setError('')
    try {
      const { data } = await fetchCustomers(lookup)
      const list = Array.isArray(data) ? data : []
      const exact = findExactCustomer(list, lookup)
      if (exact) {
        selectCustomer(exact)
      } else {
        setCustomer(c => ({ ...c, name: lookup }))
        setCustomerId(null)
        setLinkedCustomerCode(null)
        setCustOptions(list)
        setError(`No customer found for code: ${lookup}`)
      }
    } catch (e) {
      setError(e.message || 'Failed to scan customer QR')
    } finally {
      setCustSearching(false)
    }
  }
  const calcOptAddOn = (item) => {
    const groups = optsByModel[item.modelId] || []
    return groups.reduce((sum, grp) => {
      if (grp.isFree) return sum
      let choiceDefs
      try { choiceDefs = JSON.parse(grp.choices) } catch { return sum }
      const cur = item.selectedOptions[grp.groupName]
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
        const priceMap = {}
        choiceDefs.forEach(c => { if (typeof c === 'object' && c !== null) priceMap[c.label] = Number(c.price || 0) })
        return sum + Object.entries(cur).reduce((s, [label, qty]) => s + (priceMap[label] || 0) * (Number(qty) || 0), 0)
      }
      const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
      return sum + choiceDefs
        .filter(c => typeof c === 'object' && selArr.includes(c.label))
        .reduce((s, c) => s + (Number(c.price) || 0), 0)
    }, 0)
  }

  const itemBasePrice = (item) => Number(item.customPriceDigits) || 0

  const sideEffectiveQty = (item, sideItem) => (sideItem.qty || 1) * (item.qty || 1)
  const sideLineTotal = (item, sideItem) =>
    (Number(sideItem.customPriceDigits) || 0) * sideEffectiveQty(item, sideItem)

  const sidesTotal = (item) =>
    (item.sideItems || []).reduce((s, si) => s + sideLineTotal(item, si), 0)

  const total = items.reduce((s, i) => s + i.qty * (itemBasePrice(i) + calcOptAddOn(i)) + sidesTotal(i), 0)

  const mainModels = useMemo(
    () => models.filter(model => Boolean(model.isActive) !== false),
    [models]
  )

  // Load models + tables when dialog opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    if (defaultItems?.length) {
      setItems(defaultItems.map(i => ({
        uid: crypto.randomUUID(),
        modelId: i.modelId, modelName: i.modelName,
        sellingPrice: i.sellingPrice,
        imageUrl: i.imageUrl || i.thumbnailUrl || null,
        customPriceDigits: String(Math.round(Number(i.sellingPrice) || 0)),
        qty: i.qty,
        selectedOptions: i.selectedOptions || {}, itemNotes: i.itemNotes || '',
        sideItems: [],
      })))
    }
    Promise.all([fetchModels(), fetchShopTables()])
      .then(([mList, tRes]) => {
        setModels((mList || []).filter(m => m.sellingPrice != null))
        setTables(Array.isArray(tRes.data) ? tRes.data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-broadcast temp order to counter display whenever items change
  useEffect(() => {
    if (!items.length) return
    const tempItems = []
    items.forEach(i => {
      const tempId = crypto.randomUUID()
      tempItems.push({
        id: tempId,
        modelName: i.modelName,
        quantity: i.qty,
        selectedOptions: Object.keys(i.selectedOptions || {}).length > 0
          ? JSON.stringify(i.selectedOptions) : null,
        itemNotes: i.itemNotes || null,
        lineTotal: i.qty * (itemBasePrice(i) + calcOptAddOn(i)),
        parentItemId: null,
      })
      ;(i.sideItems || []).forEach(si => {
        tempItems.push({
          id: crypto.randomUUID(),
          modelName: si.modelName,
          quantity: sideEffectiveQty(i, si),
          selectedOptions: null,
          itemNotes: null,
          lineTotal: sideLineTotal(i, si),
          parentItemId: tempId,
        })
      })
    })
    const tempOrder = {
      orderNumber: null,
      orderCode: '―',
      customerName: customer.name || null,
      tableName: tableName || null,
      items: tempItems,
      totalAmount: total,
      paymentQr: null,
      tagQrBase64: null,
    }
    broadcastToCounter(tempOrder, null)
    setJustBroadcast(true)
    clearTimeout(bcTimerRef.current)
    bcTimerRef.current = setTimeout(() => setJustBroadcast(false), 3000)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(bcTimerRef.current); clearTimeout(custTimerRef.current) }, [])

  const reset = () => {
    setManualNum(''); setFulfillment(defaultTable ? 'DINE_IN' : 'PICKUP'); setTableId(defaultTable?.id || '')
    setCustomer({ name: '', phone: '' }); setCustomerId(null); setCustOptions([])
    setPayment('CASH'); setNotes('')
    setItems([]); setSelectedModel(null); setError('')
    setCreatedOrder(null); setTagQr(''); setOptsByModel({})
    setJustBroadcast(false); setCustomerCash('')
    setNewCustOpen(false); setNewCustForm({ name: '', phone: '', customerCode: '' }); setNewCustError('')
    setLinkedCustomerCode(null); setCustQrDialog(null)
    setCustomerScanOpen(false)
    setVoucherScanOpen(false); setScannedVoucherPayload(''); setVoucherRedeeming(false)
    setVoucherResult(null); setVoucherError('')
    setImagePreview(null)
  }

  const handleClose = () => { reset(); onClose() }

  // ── Side item helpers ──────────────────────────────────────────────
  const allowedSideOptionsFor = (modelId) => {
    const model = models.find(m => String(m.id) === String(modelId))
    const allowedIds = parseAllowedSideIds(model)
    return allowedIds.length ? models.filter(m => allowedIds.includes(String(m.id))) : []
  }

  const isAllowedSideModel = (parentModelId, sideModelId) =>
    allowedSideOptionsFor(parentModelId).some(m => String(m.id) === String(sideModelId))

  const changeSideOptionQty = (parentUid, option, delta) => {
    if (!option || !delta) return
    setItems(prev => prev.map(i => {
      if (i.uid !== parentUid) return i
      if (!isAllowedSideModel(i.modelId, option.id)) return i
      const sideItems = i.sideItems || []
      const existing = sideItems.find(si => String(si.modelId) === String(option.id))
      if (!existing) {
        if (delta < 1) return i
        return {
          ...i,
          sideItems: [...sideItems, {
            uid: crypto.randomUUID(),
            modelId: option.id,
            modelName: option.modelName,
            imageUrl: option.imageUrl || option.thumbnailUrl || null,
            customPriceDigits: String(Math.round(Number(option.sellingPrice) || 0)),
            qty: delta,
          }],
        }
      }
      return {
        ...i,
        sideItems: sideItems
          .map(si => si.uid === existing.uid ? { ...si, qty: (si.qty || 1) + delta } : si)
          .filter(si => si.qty > 0),
      }
    }))
  }

  const removeSideItem = (parentUid, sideUid) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : { ...i, sideItems: i.sideItems.filter(si => si.uid !== sideUid) }
    ))

  const setSideItemPrice = (parentUid, sideUid, digits) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems.map(si =>
          si.uid === sideUid ? { ...si, customPriceDigits: digits } : si
        )
      }
    ))

  const changeSideQty = (parentUid, sideUid, delta) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems
          .map(si => si.uid === sideUid ? { ...si, qty: (si.qty || 1) + delta } : si)
          .filter(si => si.qty > 0)
      }
    ))

  const changeSideModel = (parentUid, sideUid, newModel) => {
    const parent = items.find(i => i.uid === parentUid)
    if (!parent || !isAllowedSideModel(parent.modelId, newModel.id)) return
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems.map(si =>
          si.uid === sideUid ? {
            ...si,
            modelId: newModel.id,
            modelName: newModel.modelName,
            imageUrl: newModel.imageUrl || newModel.thumbnailUrl || null,
            customPriceDigits: String(Math.round(Number(newModel.sellingPrice) || 0)),
          } : si
        )
      }
    ))
  }

  const addModelToOrder = (model) => {
    if (!model) return
    const mid = model.id
    setItems(prev => [...prev, {
      uid: crypto.randomUUID(),
      modelId: mid, modelName: model.modelName,
      sellingPrice: model.sellingPrice,
      imageUrl: model.imageUrl || model.thumbnailUrl || null,
      customPriceDigits: String(Math.round(Number(model.sellingPrice) || 0)),
      qty: 1, selectedOptions: {}, itemNotes: '',
      sideItems: [],
    }])
    if (!optsByModel[mid]) {
      fetchMenuOptions(mid)
        .then(({ data }) => setOptsByModel(prev => ({ ...prev, [mid]: Array.isArray(data) ? data : [] })))
        .catch(() => setOptsByModel(prev => ({ ...prev, [mid]: [] })))
    }
  }

  const addItem = () => {
    addModelToOrder(selectedModel)
    setSelectedModel(null)
  }

  const toggleOption = (uid, groupName, value, multiSelect) => {
    setItems(prev => prev.map(item => {
      if (item.uid !== uid) return item
      const cur = item.selectedOptions[groupName]
      let next
      if (multiSelect) {
        const arr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
        next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
        if (!next.length) next = undefined
      } else {
        next = cur === value ? undefined : value
      }
      const opts = { ...item.selectedOptions }
      if (next === undefined) delete opts[groupName]
      else opts[groupName] = next
      return { ...item, selectedOptions: opts }
    }))
  }

  const changeOptionQty = (uid, groupName, label, delta) => {
    setItems(prev => prev.map(item => {
      if (item.uid !== uid) return item
      const cur = item.selectedOptions[groupName]
      const currentQty = choiceQtyFromValue(cur, label)
      const nextQty = Math.max(0, currentQty + delta)
      const qtyMap = (cur && typeof cur === 'object' && !Array.isArray(cur)) ? { ...cur } : {}
      if (nextQty === 0) delete qtyMap[label]
      else qtyMap[label] = nextQty

      const opts = { ...item.selectedOptions }
      if (Object.keys(qtyMap).length) opts[groupName] = qtyMap
      else delete opts[groupName]
      return { ...item, selectedOptions: opts }
    }))
  }

  const setItemNotes = (uid, val) => {
    setItems(prev => prev.map(i => i.uid === uid ? { ...i, itemNotes: val } : i))
  }

  const setItemPrice = (uid, digits) =>
    setItems(prev => prev.map(i => i.uid === uid ? { ...i, customPriceDigits: digits } : i))

  const changeQty = (uid, delta) => {
    setItems(prev =>
      prev.map(i => i.uid === uid ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    )
  }

  const redeemVoucherForOrder = async (payload, orderToRedeem) => {
    const clean = String(payload || '').trim()
    if (!clean || !orderToRedeem?.id) return orderToRedeem
    setVoucherRedeeming(true); setVoucherError('')
    try {
      const { res, data } = await redeemVoucher(clean, orderToRedeem.id)
      if (!res.ok) {
        setVoucherError(data?.error || data?.message || 'Invalid voucher')
        return orderToRedeem
      }
      setVoucherResult(data)
      setScannedVoucherPayload('')
      return data?.order || {
        ...orderToRedeem,
        discountAmount: data?.newDiscountTotal ?? orderToRedeem.discountAmount,
        voucherCode: data?.voucher?.code || orderToRedeem.voucherCode,
      }
    } catch (e) {
      setVoucherError(e.message || 'Network error')
      return orderToRedeem
    } finally {
      setVoucherRedeeming(false)
    }
  }

  const handleVoucherScan = async (payload) => {
    const clean = String(payload || '').trim()
    if (!clean) return
    setVoucherScanOpen(false)
    if (createdOrder?.id) {
      const updated = await redeemVoucherForOrder(clean, createdOrder)
      setCreatedOrder(updated)
      onCreated?.(updated)
      broadcastToCounter(updated, tagQr || null)
      return
    }
    setScannedVoucherPayload(clean)
    setVoucherResult(null)
    setVoucherError('')
  }

  const handleSubmit = async () => {
    if (!items.length) { setError('Add at least one item'); return }
    setSubmitting(true); setError('')
    const body = {
      fulfillmentType: fulfillment,
      tableId: fulfillment === 'DINE_IN' && tableId ? tableId : null,
      customerName: customer.name || null,
      customerPhone: customer.phone || null,
      paymentMethod: payment,
      notes: notes || null,
      manualOrderNumber: manualNum !== '' ? Number(manualNum) : null,
      items: items.map(i => ({
        modelId: i.modelId, quantity: i.qty,
        selectedOptions: Object.keys(i.selectedOptions || {}).length > 0
          ? JSON.stringify(i.selectedOptions) : null,
        itemNotes: i.itemNotes || null,
        unitPriceOverride: Number(i.customPriceDigits) || null,
        sideItems: (i.sideItems || []).map(si => ({
          modelId: si.modelId, quantity: sideEffectiveQty(i, si),
          selectedOptions: null, itemNotes: null,
          unitPriceOverride: Number(si.customPriceDigits) || null,
          sideItems: [],
        })),
      })),
    }
    try {
      const { res, data } = await createStaffOrder(body)
      if (!res.ok) { setError(data?.message || 'Failed to create order'); setSubmitting(false); return }
      let orderData = data
      if (customerId) {
        try {
          const { res: linkRes, data: linked } = await linkOrderCustomer(data.id, customerId)
          if (linkRes.ok && linked?.id) orderData = linked
        } catch { /* silent */ }
      }
      if (scannedVoucherPayload) {
        orderData = await redeemVoucherForOrder(scannedVoucherPayload, orderData)
      }
      setCreatedOrder(orderData)
      onCreated?.(orderData)
      // broadcast real order (with order number), then again once tagQr is loaded
      broadcastToCounter(orderData, null)
      setTagLoading(true)
      fetchOrderTagQr(orderData.id)
        .then(({ data: qr }) => {
          const qrB64 = qr?.qrBase64 || ''
          setTagQr(qrB64)
          broadcastToCounter(orderData, qrB64 || null)
        })
        .catch(() => {})
        .finally(() => setTagLoading(false))
    } catch (e) { setError(e.message || 'Network error') }
    setSubmitting(false)
  }

  const counterBtn = (
    <Tooltip title={justBroadcast ? 'Counter display updated!' : 'Open counter customer display'}>
      <Badge
        variant="dot"
        color="success"
        invisible={!justBroadcast}
        overlap="circular"
      >
        <Button
          size="small"
          variant={justBroadcast ? 'contained' : 'outlined'}
          color={justBroadcast ? 'success' : 'info'}
          startIcon={<MonitorIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => window.open(window.location.origin + '/bom-inventory/shop/counter', '_blank')}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 12,
            transition: 'all 0.25s',
            animation: justBroadcast ? 'counterPulse 0.7s ease-in-out infinite' : 'none',
            '@keyframes counterPulse': {
              '0%,100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
              '50%':     { boxShadow: '0 0 0 7px rgba(34,197,94,0.4)' },
            },
          }}
        >
          {justBroadcast ? '📺 Live' : 'Counter'}
        </Button>
      </Badge>
    </Tooltip>
  )

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <>
      <Dialog open={open} onClose={!submitting ? handleClose : undefined} fullWidth maxWidth="lg"
      PaperProps={{ sx: { borderRadius: { xs: 0, sm: 2 }, height: { xs: '100dvh', sm: 'calc(100vh - 48px)' }, maxHeight: { xs: '100dvh', sm: 'calc(100vh - 48px)' } } }}>

      {/* Title row — always visible */}
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={800} variant="h6">New Manual Order</Typography>
          <Typography variant="caption" color="text.secondary">Staff-created order</Typography>
        </Box>
        {counterBtn}
      </DialogTitle>

      <DialogContent sx={{ pt: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>

        {/* ── Success banner (appears after order created) ── */}
        {createdOrder && (() => {
          const num = createdOrder.orderNumber ? `#${createdOrder.orderNumber}` : createdOrder.orderCode
          const discount = Number(createdOrder.discountAmount || 0)
          const payable = Math.max(0, Number(createdOrder.totalAmount || 0) - discount)
          return (
            <Box sx={{
              bgcolor: '#1e293b', borderRadius: 2, px: 2, py: 1.5, mb: 2,
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
            }}>
              <CheckCircleIcon sx={{ color: '#4ade80', fontSize: 30, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 80 }}>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  Order Created
                </Typography>
                <Typography sx={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: '#fff', letterSpacing: -1 }}>
                  {num}
                </Typography>
                {createdOrder.tableName && (
                  <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 12 }} />}
                    label={`Table ${createdOrder.tableName}`} size="small"
                    sx={{ mt: 0.25, bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 11 }} />
                )}
                {discount > 0 && (
                  <Chip label={`Voucher -${fmt(discount)}`} size="small"
                    sx={{ mt: 0.25, ml: 0.5, bgcolor: 'rgba(74,222,128,0.18)', color: '#bbf7d0', fontSize: 11, fontWeight: 700 }} />
                )}
              </Box>
              {/* Payment QR for BANK_QR orders */}
              {createdOrder.paymentMethod === 'BANK_QR' && createdOrder.paymentQr && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 10, color: '#4ade80', fontWeight: 700, mb: 0.5 }}>Scan to Pay</Typography>
                  <img
                    src={createdOrder.paymentQr.startsWith('https://')
                      ? createdOrder.paymentQr
                      : `data:image/png;base64,${createdOrder.paymentQr}`}
                    alt="VietQR"
                    style={{ width: 90, height: 90, borderRadius: 6, background: '#fff', padding: 4 }}
                  />
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>
                    {fmt(payable)}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Button size="small" variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', textTransform: 'none', fontSize: 12 }}
                  startIcon={tagLoading ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <QrCode2Icon />}
                  disabled={tagLoading || !tagQr}
                  onClick={() => printOrderTagTracked(createdOrder, tagQr, setError)}>
                  Print Tag
                </Button>
                <Button size="small" variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', textTransform: 'none', fontSize: 12 }}
                  startIcon={<PrintIcon />}
                  onClick={() => printOrderReceiptTracked(createdOrder, null, setError)}>
                  Receipt
                </Button>
                <Button size="small" variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', textTransform: 'none', fontSize: 12 }}
                  startIcon={voucherRedeeming ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <QrCode2Icon />}
                  disabled={voucherRedeeming || !!createdOrder.voucherCode}
                  onClick={() => setVoucherScanOpen(true)}>
                  {createdOrder.voucherCode ? 'Voucher Used' : 'Voucher'}
                </Button>
              </Box>
            </Box>
          )
        })()}

        {voucherError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setVoucherError('')}>{voucherError}</Alert>}
        {voucherResult && createdOrder && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setVoucherResult(null)}>
            Voucher {voucherResult.voucher?.code} redeemed. Discount: {fmt(voucherResult.discountApplied)}
          </Alert>
        )}

        {/* ── Form (dimmed after order created) ── */}
        <Box sx={{ opacity: createdOrder ? 0.45 : 1, pointerEvents: createdOrder ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

              {/* Order number + fulfillment */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="Order # (optional)"
                  size="small" type="number" value={manualNum}
                  onChange={e => setManualNum(e.target.value)}
                  placeholder="auto" sx={{ width: 140, flexShrink: 0 }}
                  inputProps={{ min: 1 }} helperText="Leave blank for auto"
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Type</Typography>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {FULFILLMENT.map(opt => (
                      <Box key={opt.value} onClick={() => setFulfillment(opt.value)} sx={{
                        flex: 1, border: '1.5px solid', borderRadius: 1.5, py: 0.75, textAlign: 'center', cursor: 'pointer', fontSize: 11,
                        borderColor: fulfillment === opt.value ? 'primary.main' : '#e0e0e0',
                        bgcolor: fulfillment === opt.value ? '#e3f2fd' : '#fff',
                      }}>
                        <Box sx={{ color: fulfillment === opt.value ? 'primary.main' : 'text.secondary' }}>{opt.icon}</Box>
                        <Typography variant="caption" fontWeight={600}
                          color={fulfillment === opt.value ? 'primary.main' : 'text.secondary'}>{opt.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* Table */}
              {fulfillment === 'DINE_IN' && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Table</InputLabel>
                  <Select value={tableId} label="Table" onChange={e => setTableId(e.target.value)}>
                    <MenuItem value=""><em>No table</em></MenuItem>
                    {tables.map(t => <MenuItem key={t.id} value={t.id}>{t.tableName}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {/* Customer */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={custOptions}
                  getOptionLabel={opt => typeof opt === 'string' ? opt : opt.name}
                  filterOptions={x => x}
                  loading={custSearching}
                  inputValue={customer.name}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') handleCustInput(val)
                    if (reason === 'clear') {
                      setCustomer({ name: '', phone: '' }); setCustomerId(null); setCustOptions([])
                      setLinkedCustomerCode(null)
                    }
                  }}
                  onChange={(_, val) => {
                    if (val && typeof val === 'object') {
                      selectCustomer(val)
                    }
                  }}
                  renderOption={(props, opt) => (
                    <li {...props} key={opt.id}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={700}>{opt.name}</Typography>
                          {opt.customerCode && (
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#0288d1', fontWeight: 700 }}>
                              {opt.customerCode}
                            </Typography>
                          )}
                        </Box>
                        {opt.phone && <Typography variant="caption" color="text.secondary">{opt.phone}</Typography>}
                      </Box>
                    </li>
                  )}
                  renderInput={params => (
                    <TextField {...params} label={customerId ? 'Customer (linked)' : 'Customer name'}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {custSearching && <CircularProgress size={14} />}
                            {customerId && <PersonIcon sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ flex: 1 }}
                />
                <TextField size="small" label="Phone" sx={{ width: 130 }} value={customer.phone}
                  onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, flexShrink: 0, pt: 0.5 }}>
                  <Tooltip title="Scan customer QR">
                    <IconButton size="small" onClick={() => setCustomerScanOpen(true)} disabled={custSearching}
                      sx={{ bgcolor: '#f0fdf4', color: '#15803d', '&:hover': { bgcolor: '#dcfce7' }, borderRadius: 1 }}>
                      <QrCode2Icon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Register new customer">
                    <IconButton size="small" onClick={openNewCust}
                      sx={{ bgcolor: '#e3f2fd', color: '#1565c0', '&:hover': { bgcolor: '#bbdefb' }, borderRadius: 1 }}>
                      <PersonAddIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Tooltip>
                  {customerId && linkedCustomerCode && (
                    <Tooltip title="View / print customer QR">
                      <IconButton size="small"
                        onClick={() => setCustQrDialog({ name: customer.name, phone: customer.phone, customerCode: linkedCustomerCode })}
                        sx={{ color: '#0288d1' }}>
                        <QrCode2Icon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Inline new customer form */}
              {newCustOpen && (
                <Box sx={{ bgcolor: '#f0fdf4', borderRadius: 2, p: 1.5, border: '1.5px solid #4caf50' }}>
                  <Typography variant="caption" fontWeight={800} color="success.dark" sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    New Customer
                  </Typography>
                  {newCustError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setNewCustError('')}>{newCustError}</Alert>}
                  <Stack spacing={1}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField size="small" label="Name *" sx={{ flex: 1 }}
                        value={newCustForm.name}
                        onChange={e => setNewCustForm(p => ({ ...p, name: e.target.value }))}
                        autoFocus
                      />
                      <TextField size="small" label="Phone" sx={{ width: 130 }}
                        value={newCustForm.phone}
                        onChange={e => setNewCustForm(p => ({ ...p, phone: e.target.value }))}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField size="small" label="Customer Code" sx={{ flex: 1 }}
                        value={newCustForm.customerCode}
                        onChange={e => setNewCustForm(p => ({ ...p, customerCode: e.target.value.replace(/[^A-Z0-9a-z]/g, '').toUpperCase().slice(0, 8) }))}
                        inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 3, fontSize: 15 } }}
                        helperText="Unique code — used for QR scan & point tracking"
                      />
                      <Tooltip title="Regenerate code">
                        <IconButton size="small" onClick={() => setNewCustForm(p => ({ ...p, customerCode: genCode() }))}
                          sx={{ mt: 0.5, color: '#64748b' }}>
                          <AutorenewIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={() => setNewCustOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
                      <Button size="small" variant="contained" color="success" onClick={saveNewCust}
                        disabled={newCustSaving || !newCustForm.name.trim()}
                        sx={{ textTransform: 'none', fontWeight: 700 }}>
                        {newCustSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Create & Link'}
                      </Button>
                    </Box>
                  </Stack>
                </Box>
              )}

              {/* Payment */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                  <InputLabel>Payment</InputLabel>
                  <Select value={payment} label="Payment" onChange={e => setPayment(e.target.value)}>
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="BANK_QR">Bank QR</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  startIcon={voucherRedeeming ? <CircularProgress size={14} /> : <QrCode2Icon />}
                  onClick={() => setVoucherScanOpen(true)}
                  disabled={voucherRedeeming}
                  sx={{ textTransform: 'none', fontWeight: 700, height: 40, flexShrink: 0 }}>
                  {scannedVoucherPayload ? 'Replace Voucher' : 'Scan Voucher'}
                </Button>
              </Box>
              {scannedVoucherPayload && !createdOrder && (
                <Alert severity="info" onClose={() => setScannedVoucherPayload('')}>
                  Voucher {voucherLabel(scannedVoucherPayload)} scanned. It will redeem when order is created.
                </Alert>
              )}

              <Divider>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Items</Typography>
              </Divider>

              {/* Item search + add */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Autocomplete
                  size="small"
                  options={mainModels}
                  getOptionLabel={m => `${m.modelName} — ${fmt(m.sellingPrice)}`}
                  value={selectedModel}
                  onChange={(_, v) => setSelectedModel(v)}
                  renderInput={params => <TextField {...params} label="Search item…" />}
                  sx={{ flex: 1 }}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  noOptionsText="No active menu items"
                />
                <Button variant="contained" onClick={addItem} disabled={!selectedModel}
                  startIcon={<AddIcon />} sx={{ textTransform: 'none', flexShrink: 0 }}>
                  Add
                </Button>
              </Box>

              {mainModels.length > 0 && (
                <Box sx={{
                  display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                  gap: 1, maxHeight: 230, overflowY: 'auto', pr: 0.25,
                }}>
                  {mainModels.map(model => (
                    <Box key={model.id} role="button" tabIndex={0}
                      onClick={() => addModelToOrder(model)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addModelToOrder(model) }}
                      sx={{
                        minHeight: 118, border: '1px solid #dbe3ef', borderRadius: 1.5, overflow: 'hidden', bgcolor: '#fff',
                        display: 'grid', gridTemplateColumns: '72px 1fr', cursor: 'pointer', boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
                        '&:hover': { borderColor: '#1976d2', bgcolor: '#f8fbff' },
                      }}>
                      <Box sx={{ bgcolor: '#eef2f7', minHeight: 118, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {model.imageUrl ? (
                          <Box component="img" src={model.imageUrl} alt={model.modelName}
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <Typography fontWeight={900} color="text.secondary" sx={{ fontSize: 24 }}>
                            {String(model.modelName || '?').slice(0, 1)}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ p: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <Typography fontWeight={800} sx={{ fontSize: 14, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{model.modelName}</Typography>
                        <Typography color="primary" fontWeight={900} sx={{ fontSize: 14 }}>{fmt(model.sellingPrice)}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Items list */}
              {items.length > 0 ? (
                <Stack spacing={0.75}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    try {
                      const item = JSON.parse(e.dataTransfer.getData('application/json'))
                      setItems(prev => [...prev, {
                        uid: crypto.randomUUID(),
                        modelId: item.modelId, modelName: item.modelName,
                        sellingPrice: item.sellingPrice,
                        imageUrl: item.imageUrl || item.thumbnailUrl || null,
                        customPriceDigits: String(Math.round(Number(item.sellingPrice) || 0)),
                        qty: item.qty || 1,
                        selectedOptions: {}, itemNotes: '', sideItems: [],
                      }])
                      if (!optsByModel[item.modelId]) {
                        fetchMenuOptions(item.modelId)
                          .then(({ data }) => setOptsByModel(p => ({ ...p, [item.modelId]: Array.isArray(data) ? data : [] })))
                          .catch(() => setOptsByModel(p => ({ ...p, [item.modelId]: [] })))
                      }
                    } catch { /* ignore */ }
                  }}
                >
                  {items.map((item, itemIdx) => {
                    const modelOpts = optsByModel[item.modelId] || []
                    const allowedSideOptions = allowedSideOptionsFor(item.modelId)
                    const itemModel = models.find(m => String(m.id) === String(item.modelId))
                    const itemImage = item.imageUrl || item.thumbnailUrl || itemModel?.imageUrl || itemModel?.thumbnailUrl || ''
                    const mainSubtotal = item.qty * (itemBasePrice(item) + calcOptAddOn(item))
                    const blockTotal = mainSubtotal + sidesTotal(item)
                    return (
                      <Box key={item.uid} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>

                        {/* ── Main item ─────────────────────────────────────── */}
                        <Box sx={{ bgcolor: '#f8faff', px: 1.5, pt: 1, pb: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, minWidth: 18, flexShrink: 0, fontSize: 11 }}>
                              {itemIdx + 1}.
                            </Typography>
                            <Box onClick={() => itemImage && setImagePreview({ imageUrl: itemImage, modelName: item.modelName })} sx={{ width: 64, height: 64, flexShrink: 0, borderRadius: 1.25, bgcolor: '#eef2f7', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: itemImage ? 'pointer' : 'default' }}>
                              {itemImage ? (
                                <Box component="img" src={itemImage} alt={item.modelName}
                                  onError={e => { e.target.style.display = 'none' }}
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: 18 }}>
                                  {String(item.modelName || '?').slice(0, 1)}
                                </Typography>
                              )}
                            </Box>
                            <Typography variant="body2" fontWeight={800} sx={{ flex: 1, minWidth: 100, fontSize: 15 }} noWrap>
                              {item.modelName}
                            </Typography>
                            <TextField
                              size="small" type="text" inputMode="numeric" placeholder="0"
                              value={fmtDots(item.customPriceDigits || '')}
                              onChange={e => setItemPrice(item.uid, stripDigits(e.target.value))}
                              inputProps={{ maxLength: 12, style: { fontSize: 12, fontWeight: 700, textAlign: 'right', width: 68 } }}
                              InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                              sx={{ width: 106, '& .MuiInputBase-root': { height: 30 } }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                              <IconButton size="small" onClick={() => changeQty(item.uid, -1)} sx={{ p: 0.25 }}>
                                <RemoveIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>
                                {item.qty}
                              </Typography>
                              <IconButton size="small" onClick={() => changeQty(item.uid, 1)}
                                sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', borderRadius: 0.75, '&:hover': { bgcolor: '#1565c0' } }}>
                                <AddIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                            <Typography variant="body2" color="primary" fontWeight={800}
                              sx={{ minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                              {fmt(mainSubtotal)}
                            </Typography>
                            <IconButton size="small" color="error"
                              onClick={() => setItems(prev => prev.filter(i => i.uid !== item.uid))}
                              sx={{ p: 0.25 }}>
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>

                          {/* Option chips */}
                          {modelOpts.map(grp => {
                            const rawChoices = (() => { try { return JSON.parse(grp.choices) } catch { return [] } })()
                            const choices = rawChoices.map(c => typeof c === 'object' ? c : { label: String(c), price: 0 })
                            if (!choices.length) return null
                            const priced = !grp.isFree && hasPricedChoices(choices)
                            const curVal = item.selectedOptions[grp.groupName]
                            const selArr = Array.isArray(curVal) ? curVal : (curVal ? [curVal] : [])
                            return (
                              <Box key={grp.id} sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary"
                                  sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  {grp.groupName}{grp.isFree ? ' (free)' : ''}
                                </Typography>
                                {priced ? (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.35 }}>
                                    {choices.map(choice => {
                                      const cQty = choiceQtyFromValue(curVal, choice.label)
                                      const price = Number(choice.price || 0)
                                      return (
                                        <Box key={choice.label} sx={{
                                          display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.5,
                                          border: `1.5px solid ${cQty > 0 ? '#6366f1' : '#dbe3ef'}`,
                                          borderRadius: 1.25, bgcolor: cQty > 0 ? '#eef2ff' : '#fff',
                                        }}>
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography fontWeight={800} sx={{ fontSize: 14, lineHeight: 1.25, overflowWrap: 'anywhere' }}>
                                              {choice.label}
                                            </Typography>
                                            {price > 0 && (
                                              <Typography color="primary" fontWeight={900} sx={{ fontSize: 13 }}>
                                                +{fmt(price)}{cQty > 0 ? ` = ${fmt(price * cQty * item.qty)}` : ''}
                                              </Typography>
                                            )}
                                          </Box>
                                          {cQty === 0 ? (
                                            <IconButton size="small" onClick={() => changeOptionQty(item.uid, grp.groupName, choice.label, 1)}
                                              sx={{ p: 0.55, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                              <AddIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                          ) : (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexShrink: 0 }}>
                                              <IconButton size="small" onClick={() => changeOptionQty(item.uid, grp.groupName, choice.label, -1)}
                                                sx={{ p: 0.5, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                                                <RemoveIcon sx={{ fontSize: 16 }} />
                                              </IconButton>
                                              <Typography fontWeight={900} sx={{ minWidth: 24, textAlign: 'center', color: '#4f46e5', fontSize: 15 }}>
                                                {cQty * item.qty}
                                              </Typography>
                                              <IconButton size="small" onClick={() => changeOptionQty(item.uid, grp.groupName, choice.label, 1)}
                                                sx={{ p: 0.5, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                                <AddIcon sx={{ fontSize: 16 }} />
                                              </IconButton>
                                            </Box>
                                          )}
                                        </Box>
                                      )
                                    })}
                                  </Box>
                                ) : (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                                    {choices.map(choice => {
                                      const active = selArr.includes(choice.label)
                                      return (
                                        <Chip key={choice.label} label={choice.label} size="small"
                                          onClick={() => toggleOption(item.uid, grp.groupName, choice.label, grp.multiSelect)}
                                          sx={{
                                            height: 22, fontSize: 11, cursor: 'pointer',
                                            bgcolor: active ? '#1976d2' : '#fff', color: active ? '#fff' : '#555',
                                            border: `1px solid ${active ? '#1976d2' : '#ddd'}`, fontWeight: active ? 700 : 400,
                                            '&:hover': { bgcolor: active ? '#1565c0' : '#f0f4ff' },
                                          }} />
                                      )
                                    })}
                                  </Box>
                                )}
                              </Box>
                            )
                          })}

                          <TextField size="small" variant="standard" fullWidth
                            placeholder="Item note (e.g. no sugar, extra spicy…)"
                            value={item.itemNotes || ''}
                            onChange={e => setItemNotes(item.uid, e.target.value)}
                            InputProps={{ disableUnderline: false, sx: { fontSize: 12 } }}
                            sx={{ mt: 0.5 }}
                          />
                        </Box>

                        {/* ── Children (tree) ─────────────────────────────────── */}
                        <Box sx={{ bgcolor: '#f0f4ff', borderTop: '1px solid #e2e8f0' }}>
                          <Box sx={{ ml: 1.5, borderLeft: '2px solid #c7d2fe' }}>

                            {/* Side item rows */}
                            {(item.sideItems || []).map(si => {
                              const sideModel = models.find(m => String(m.id) === String(si.modelId))
                              const sideImage = si.imageUrl || si.thumbnailUrl || sideModel?.imageUrl || sideModel?.thumbnailUrl || ''
                              const effectiveQty = sideEffectiveQty(item, si)
                              const effectiveTotal = sideLineTotal(item, si)
                              return (
                                <Box key={si.uid} sx={{ borderBottom: '1px solid #e8eaf6', pt: 0.5, pb: 0.4, pr: 0.75 }}>
                                  {/* Row 1: connector + editable name + delete */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Box sx={{ width: 14, height: 2, bgcolor: '#c7d2fe', flexShrink: 0 }} />
                                    <Box onClick={() => sideImage && setImagePreview({ imageUrl: sideImage, modelName: si.modelName })} sx={{ width: 50, height: 50, flexShrink: 0, borderRadius: 1, bgcolor: '#e8eaf6', overflow: 'hidden', border: '1px solid #dbe3ef', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: sideImage ? 'pointer' : 'default' }}>
                                      {sideImage ? (
                                        <Box component="img" src={sideImage} alt={si.modelName}
                                          onError={e => { e.target.style.display = 'none' }}
                                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <Typography fontWeight={900} sx={{ color: '#94a3b8', fontSize: 15 }}>
                                          {String(si.modelName || '?').slice(0, 1)}
                                        </Typography>
                                      )}
                                    </Box>
                                    <Autocomplete
                                      size="small" disableClearable options={allowedSideOptions}
                                      getOptionLabel={m => m.modelName}
                                      value={allowedSideOptions.find(m => String(m.id) === String(si.modelId)) || { id: si.modelId, modelName: si.modelName, sellingPrice: si.customPriceDigits }}
                                      onChange={(_, v) => v && changeSideModel(item.uid, si.uid, v)}
                                      isOptionEqualToValue={(a, b) => a.id === b.id}
                                      renderInput={params => (
                                        <TextField {...params} variant="standard"
                                          InputProps={{ ...params.InputProps, disableUnderline: true,
                                            sx: { fontSize: 15, fontWeight: 800, p: 0 } }}
                                          inputProps={{ ...params.inputProps, style: { fontSize: 15, fontWeight: 800, padding: '1px 0' } }}
                                        />
                                      )}
                                      sx={{ flex: 1, '& .MuiAutocomplete-endAdornment': { top: 'calc(50% - 10px)' } }}
                                      noOptionsText="No configured sides"
                                    />
                                    <IconButton size="small" onClick={() => removeSideItem(item.uid, si.uid)}
                                      sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                                      <CloseIcon sx={{ fontSize: 13 }} />
                                    </IconButton>
                                  </Box>
                                  {/* Row 2: qty, price, total */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, ml: 2.75 }}>
                                    <IconButton size="small" onClick={() => changeSideQty(item.uid, si.uid, -1)} sx={{ p: 0.2 }}>
                                      <RemoveIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 18, textAlign: 'center', fontSize: 13 }}>
                                      {effectiveQty}
                                    </Typography>
                                    <IconButton size="small" onClick={() => changeSideQty(item.uid, si.uid, 1)}
                                      sx={{ p: 0.2, bgcolor: '#6366f1', color: '#fff', borderRadius: 0.5, '&:hover': { bgcolor: '#4f46e5' } }}>
                                      <AddIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>x</Typography>
                                    <TextField
                                      size="small" type="text" inputMode="numeric" placeholder="0"
                                      value={fmtDots(si.customPriceDigits || '')}
                                      onChange={e => setSideItemPrice(item.uid, si.uid, stripDigits(e.target.value))}
                                      inputProps={{ maxLength: 12, style: { fontSize: 12, fontWeight: 700, textAlign: 'right', width: 56 } }}
                                      InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                                      sx={{ width: 94, '& .MuiInputBase-root': { height: 26 } }}
                                    />
                                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>=</Typography>
                                    <Typography variant="caption" color="primary" fontWeight={800} sx={{ fontSize: 12 }}>
                                      {fmt(effectiveTotal)}
                                    </Typography>
                                  </Box>
                                </Box>
                              )
                            })}

                            {/* Block total row — only when there are side items */}
                            {(item.sideItems || []).length > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.4, borderBottom: '1px solid #e8eaf6' }}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>Block total</Typography>
                                <Typography variant="caption" fontWeight={800} color="primary" sx={{ fontSize: 12 }}>
                                  {fmt(blockTotal)}
                                </Typography>
                              </Box>
                            )}

                            {allowedSideOptions.length > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, py: 0.75, pr: 0.75 }}>
                                <Box sx={{ width: 14, height: 2, bgcolor: '#a5b4fc', flexShrink: 0, mt: 4.25 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ display: 'block', mb: 0.5 }}>
                                    Topping / Side
                                  </Typography>
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                    {allowedSideOptions.map(option => {
                                      const selectedSide = (item.sideItems || []).find(si => String(si.modelId) === String(option.id))
                                      const optionQty = selectedSide?.qty || 0
                                      const effectiveQty = optionQty * (item.qty || 1)
                                      const unitPrice = Number(selectedSide?.customPriceDigits ?? option.sellingPrice ?? 0) || 0
                                      const optionTotal = unitPrice * effectiveQty
                                      const optionImage = option.imageUrl || option.thumbnailUrl || ''
                                      return (
                                        <Box key={option.id} sx={{
                                          display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75,
                                          border: `1.5px solid ${optionQty > 0 ? '#6366f1' : '#dbe3ef'}`,
                                          borderRadius: 1.5, bgcolor: optionQty > 0 ? '#eef2ff' : '#fff',
                                        }}>
                                          <Box onClick={() => optionImage && setImagePreview({ imageUrl: optionImage, modelName: option.modelName })} sx={{ width: 64, height: 64, flexShrink: 0, borderRadius: 1.25, bgcolor: '#eef2f7', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: optionImage ? 'pointer' : 'default' }}>
                                            {optionImage ? (
                                              <Box component="img" src={optionImage} alt={option.modelName}
                                                onError={e => { e.target.style.display = 'none' }}
                                                sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                              <Typography fontWeight={900} color="text.secondary" sx={{ fontSize: 18 }}>
                                                {String(option.modelName || '?').slice(0, 1)}
                                              </Typography>
                                            )}
                                          </Box>
                                          <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography fontWeight={800} sx={{ fontSize: 13, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{option.modelName}</Typography>
                                            <Typography color="primary" fontWeight={900} sx={{ fontSize: 12 }}>
                                              +{fmt(unitPrice)}{optionQty > 0 ? ` = ${fmt(optionTotal)}` : ''}
                                            </Typography>
                                          </Box>
                                          {optionQty === 0 ? (
                                            <IconButton size="small" onClick={() => changeSideOptionQty(item.uid, option, 1)}
                                              sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                              <AddIcon sx={{ fontSize: 20 }} />
                                            </IconButton>
                                          ) : (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexShrink: 0 }}>
                                              <IconButton size="small" onClick={() => changeSideOptionQty(item.uid, option, -1)} sx={{ p: 0.6, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                                                <RemoveIcon sx={{ fontSize: 18 }} />
                                              </IconButton>
                                              <Typography fontWeight={900} sx={{ minWidth: 28, textAlign: 'center', color: '#4f46e5', fontSize: 16 }}>
                                                {effectiveQty}
                                              </Typography>
                                              <IconButton size="small" onClick={() => changeSideOptionQty(item.uid, option, 1)}
                                                sx={{ p: 0.6, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                                                <AddIcon sx={{ fontSize: 18 }} />
                                              </IconButton>
                                            </Box>
                                          )}
                                        </Box>
                                      )
                                    })}
                                  </Box>
                                </Box>
                              </Box>
                            )}

                          </Box>
                        </Box>

                      </Box>
                    )
                  })}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, px: 1 }}>
                    <Typography fontWeight={800}>Total</Typography>
                    <Typography fontWeight={800} color="primary">{fmt(total)}</Typography>
                  </Box>
                  {payment === 'CASH' && (
                    <Box sx={{ bgcolor: '#fff8e1', borderRadius: 1.5, px: 1.25, py: 1, mt: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          label="Customer cash" type="text" inputMode="numeric" size="small" sx={{ flex: 1 }}
                          value={fmtDots(customerCash)}
                          onChange={e => setCustomerCash(stripDigits(e.target.value))}
                          placeholder="0"
                          inputProps={{ maxLength: 15, style: { fontSize: 15, fontWeight: 700 } }}
                          InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>đ</Typography> }}
                        />
                        {customerCash !== '' && Number(customerCash) > 0 && (
                          <Box sx={{ minWidth: 120, textAlign: 'right' }}>
                            {Number(customerCash) >= total ? (
                              <>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 13 }}>Change</Typography>
                                <Typography fontWeight={800} color="#2e7d32" sx={{ fontSize: 18, lineHeight: 1.1 }}>
                                  {fmt(Number(customerCash) - total)}
                                </Typography>
                              </>
                            ) : (
                              <>
                                <Typography variant="caption" color="error" sx={{ fontSize: 13 }}>Short</Typography>
                                <Typography fontWeight={800} color="error.main" sx={{ fontSize: 18, lineHeight: 1.1 }}>
                                  {fmt(total - Number(customerCash))}
                                </Typography>
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 1 }}>
                  No items added yet
                </Typography>
              )}

              {/* Notes */}
              <TextField size="small" fullWidth multiline rows={2} label="Notes (optional)"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </Stack>
          )}
        </Box>
      </DialogContent>

      {/* Customer QR dialog */}
      <Dialog open={!!custQrDialog} onClose={() => setCustQrDialog(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={800}>Customer QR Code</Typography>
          {custQrDialog && (
            <Typography variant="caption" color="text.secondary">
              {custQrDialog.name}{custQrDialog.phone ? ` · ${custQrDialog.phone}` : ''}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 2 }}>
          {custQrDialog?.customerCode ? (
            <Box>
              <Box
                component="img"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(custQrDialog.customerCode)}`}
                alt="Customer QR"
                sx={{ width: 220, height: 220, borderRadius: 2, border: '1px solid #e0e0e0', display: 'block', mx: 'auto', mb: 1.5 }}
              />
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 22, letterSpacing: 5, color: '#1e293b' }}>
                {custQrDialog.customerCode}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Scan to identify customer or add points
              </Typography>
            </Box>
          ) : (
            <Typography color="text.secondary">No customer code available for this customer.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setCustQrDialog(null)} sx={{ textTransform: 'none' }}>Close</Button>
          {custQrDialog?.customerCode && (
            <Button variant="contained" startIcon={<PrintIcon />}
              onClick={() => printCustomerQr(custQrDialog)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
              Print QR
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <VoucherQrScanDialog
        open={customerScanOpen}
        onClose={() => setCustomerScanOpen(false)}
        onScan={handleCustomerScan}
        title="Scan Customer QR"
        manualLabel="Customer code, phone, or QR payload"
        scannerLabel="Customer code scanner"
      />

      <VoucherQrScanDialog
        open={voucherScanOpen}
        onClose={() => setVoucherScanOpen(false)}
        onScan={handleVoucherScan}
      />

      {/* Actions */}
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        {createdOrder ? (
          <>
            <Button onClick={reset} sx={{ textTransform: 'none' }}>New Order</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleClose}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 100 }}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} disabled={submitting} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleSubmit}
              disabled={submitting || !items.length}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 160 }}>
              {submitting
                ? <CircularProgress size={18} />
                : `Create Order${total ? ' · ' + fmt(total) : ''}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>

      <Dialog open={Boolean(imagePreview)} onClose={() => setImagePreview(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        {imagePreview && (
          <>
            <Box sx={{ position: 'relative', bgcolor: '#f0f0f0', lineHeight: 0 }}>
              <Box component="img" src={imagePreview.imageUrl} alt={imagePreview.modelName}
                sx={{ width: '100%', maxHeight: 460, objectFit: 'contain', display: 'block' }}
                onError={e => { e.target.style.display = 'none' }} />
              <IconButton size="small" onClick={() => setImagePreview(null)}
                sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' } }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ px: 2.5, py: 2 }}>
              <Typography fontWeight={800} sx={{ fontSize: 22 }}>{imagePreview.modelName}</Typography>
            </Box>
          </>
        )}
      </Dialog>
    </>
  )
}
