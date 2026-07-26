import React, { useEffect, useState, useMemo } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import PrintIcon from '@mui/icons-material/Print'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import EditIcon from '@mui/icons-material/Edit'
import UndoIcon from '@mui/icons-material/Undo'
import LabelIcon from '@mui/icons-material/Label'
import MonitorIcon from '@mui/icons-material/Monitor'
import { fetchOrderTagQr, revertShopOrder, switchToQrPayment, splitPayment, revertToCash, patchOrderDiscount, redeemVoucher, fetchVoucherDetail, removeOrderVoucher, linkOrderCustomer, fetchCustomers, fetchCustomerHistory, earnOrderPoints, fetchBankConfig, undoMergeBills } from '../../api/shopApi'
import { printOrderReceiptTracked, printOrderTagTracked, printCupLabelsTracked } from '../../utils/printWithHistory'
import { broadcastToCounter } from '../shopboard/CounterDisplayPage'
import EditOrderDialog from './EditOrderDialog'
import ConfirmActionDialog from './ConfirmActionDialog'
import SplitBillDialog from './SplitBillDialog'
import VoucherQrScanDialog from './VoucherQrScanDialog'
import { useI18n } from '../../i18n/I18nContext'

const fmt     = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'
const payableAmount = (order) => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0))
const splitCashPortion = (order) => Math.max(0, Math.min(Number(order?.splitCashAmount || 0), payableAmount(order)))
const splitQrPortion = (order) => Math.max(0, payableAmount(order) - splitCashPortion(order))
const fmtDots = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripNonDigits = (s) => s.replace(/[^0-9]/g, '')
const pct = (sell, raw) => {
  if (!sell || !raw || Number(raw) === 0) return '—'
  return ((Number(sell) - Number(raw)) / Number(sell) * 100).toFixed(1) + '%'
}
const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '—'

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

const normalizeLookup = (value) => String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()

function customerDiscountPercent(customer, config) {
  const percent = Number(config?.loyaltyDiscountPercent || 0)
  const threshold = Number(config?.loyaltyDiscountPointThreshold || 0)
  const points = Number(customer?.points || 0)
  return percent > 0 && points >= threshold ? percent : 0
}

function customerDiscountAmount(order, percent) {
  const total = Number(order?.totalAmount || 0)
  if (!total || !percent) return 0
  return Math.max(0, Math.min(total, Math.round(total * percent / 100)))
}
const STATUS_COLOR = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', PICKED_UP: 'success', COMPLETED: 'success', CANCELLED: 'error' }

function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

function OptionsDisplay({ selectedOptions }) {
  const opts = parseOpts(selectedOptions)
  const entries = Object.entries(opts)
  if (!entries.length) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
      {entries.map(([group, val]) => {
        let chips
        if (Array.isArray(val)) {
          chips = val.map(v => ({ key: `${group}:${v}`, label: `${group}: ${v}` }))
        } else if (typeof val === 'object' && val !== null) {
          // priced option: {label: qty}
          chips = Object.entries(val).map(([lbl, qty]) => ({
            key: `${group}:${lbl}`,
            label: `${group}: ${qty > 1 ? `${lbl}×${qty}` : lbl}`,
          }))
        } else {
          chips = [{ key: `${group}:${val}`, label: `${group}: ${val}` }]
        }
        return chips.map(c => (
          <Chip key={c.key} label={c.label} size="small" color="primary" variant="outlined"
            sx={{ height: 20, fontSize: 10, fontWeight: 600 }} />
        ))
      })}
    </Box>
  )
}

// ── Change calculator ───────────────────────────────────────────────────────
function ChangeCalc({ label, due, color = '#e65100', bg = '#fff7ed', borderColor = '#f59e0b' }) {
  const [digits, setDigits] = useState('')
  const cashNum = digits ? Number(digits) : 0
  const change  = cashNum - due
  return (
    <Box sx={{ bgcolor: bg, border: `1.5px solid ${borderColor}`, borderRadius: 1.5, p: 1.25 }}>
      <Typography variant="caption" fontWeight={800} color={color}
        sx={{ display: 'block', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <TextField
          type="text"
          inputMode="numeric"
          size="small"
          label="Customer cash"
          value={fmtDots(digits)}
          onChange={e => setDigits(stripNonDigits(e.target.value))}
          placeholder="0"
          inputProps={{ maxLength: 15, style: { fontSize: 18, fontWeight: 700 } }}
          InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
          sx={{ width: 180 }}
        />
        {digits !== '' && cashNum > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              {change >= 0 ? 'Change' : 'Short'}
            </Typography>
            <Typography fontWeight={900} sx={{
              fontSize: 26, lineHeight: 1, color: change >= 0 ? '#2e7d32' : '#c62828',
            }}>
              {fmt(Math.abs(change))}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function buildItemGroups(items) {
  const roots = [...(items || []).filter(it => !it.parentItemId)].sort((a, b) => {
    const bill = Number(a.billNumber || 0) - Number(b.billNumber || 0)
    if (bill) return bill
    return Number(a.sourceOrderNumber || 0) - Number(b.sourceOrderNumber || 0)
  })
  return roots.map((root, rIdx) => {
    const children = (items || [])
      .filter(it => it.parentItemId === root.id)
      .map((child, cIdx) => ({
        ...child,
        _label: `${rIdx + 1}.${cIdx + 1}`,
      }))
    const rootTotal     = Number(root.lineTotal || 0)
    const childrenTotal = children.reduce((s, c) => s + Number(c.lineTotal || 0), 0)
    return { root: { ...root, _label: `${rIdx + 1}.` }, children, subtotal: rootTotal + childrenTotal }
  })
}

export default function ShopOrderDetailModal({ open, order, onClose, onRefresh, displaySize = 'normal' }) {
  const { t } = useI18n()
  const large = displaySize === 'large'
  const [tagQr, setTagQr]           = useState(null)
  const [qrLoading, setQrLoading]   = useState(false)
  const [reverting, setReverting]   = useState(false)
  const [switching, setSwitching]   = useState(false)
  const [splitOpen, setSplitOpen]   = useState(false)
  const [cashInput, setCashInput]   = useState('')
  const [splitting, setSplitting]   = useState(false)
  const [reverting2, setReverting2] = useState(false)
  const [error, setError]           = useState('')
  const [editOpen, setEditOpen]       = useState(false)
  const [confirmDlg, setConfirmDlg]   = useState(null)
  const [splitBillOpen, setSplitBillOpen]     = useState(false)
  const [selectedBillId, setSelectedBillId]   = useState(null)
  const [discountAmt, setDiscountAmt]         = useState('')
  const [voucherCode, setVoucherCode]         = useState('')
  const [discountSaving, setDiscountSaving]   = useState(false)
  const [custSearch, setCustSearch]           = useState('')
  const [custResults, setCustResults]         = useState([])
  const [custSearching, setCustSearching]     = useState(false)
  const [linkedCustomer, setLinkedCustomer]   = useState(null)
  const [custLinking, setCustLinking]         = useState(false)
  const [ptsSaving, setPtsSaving]             = useState(false)
  const [bankCfg, setBankCfg]                 = useState(null)
  const [undoMerging, setUndoMerging]         = useState(false)
  const [custHistory, setCustHistory]         = useState(null)
  const [custHistoryLoading, setCustHistoryLoading] = useState(false)
  const [voucherScanOpen, setVoucherScanOpen] = useState(false)
  const [customerScanOpen, setCustomerScanOpen] = useState(false)
  const [voucherDetailOpen, setVoucherDetailOpen] = useState(false)
  const [voucherDetail, setVoucherDetail]     = useState(null)
  const [voucherLoading, setVoucherLoading]   = useState(false)
  const [voucherRemoving, setVoucherRemoving] = useState(false)

  const askConfirm = (cfg, fn) => setConfirmDlg({ ...cfg, onConfirm: async (reason) => { setConfirmDlg(null); await fn(reason) } })

  useEffect(() => {
    if (!open || !order?.id) { setTagQr(null); return }
    setQrLoading(true)
    fetchOrderTagQr(order.id)
      .then(({ data }) => setTagQr(data?.qrBase64 || null))
      .catch(() => setTagQr(null))
      .finally(() => setQrLoading(false))
  }, [open, order?.id])

  useEffect(() => {
    if (!open || !order) return
    const active = (order.bills || []).filter(b => b.status === 'ACTIVE')
    const targetBill = active[0] || null
    setSelectedBillId(targetBill?.id || null)
    setDiscountAmt(targetBill?.discountAmount ? String(targetBill.discountAmount) : (order.discountAmount ? String(order.discountAmount) : ''))
    setVoucherCode(targetBill?.voucherCode || order.voucherCode || '')
    setLinkedCustomer(null); setCustSearch(''); setCustResults([]); setCustHistory(null); setVoucherDetail(null); setVoucherDetailOpen(false)
    if (order.customerId) {
      fetchCustomers().then(({ data }) => {
        const c = (data || []).find(x => x.id === order.customerId)
        if (c) setLinkedCustomer(c)
      }).catch(() => {})
    }
    if (!bankCfg) fetchBankConfig().then(({ data }) => setBankCfg(data)).catch(() => {})
  }, [open, order?.id])

  const handleRevert = async () => {
    setReverting(true); setError('')
    try {
      await revertShopOrder(order.id)
      onRefresh?.()
      onClose()
    } catch (e) { setError(e.message || 'Failed to revert order') }
    setReverting(false)
  }

  const handleSwitchAndPrint = async () => {
    setSwitching(true); setError('')
    try {
      const { res, data } = await switchToQrPayment(order.id)
      if (!res.ok) { setError(data?.message || 'Failed to switch payment method'); return }
      printOrderReceiptTracked(data)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Failed to switch payment method') }
    setSwitching(false)
  }

  const handleSplit = async () => {
    const cash = Number(cashInput)
    setSplitting(true); setError('')
    try {
      const { res, data } = await splitPayment(order.id, cash)
      if (!res.ok) { setError(data?.message || 'Failed to set split payment'); setSplitting(false); return }
      broadcastToCounter(data, tagQr || null)
      setSplitOpen(false)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Failed to set split payment') }
    setSplitting(false)
  }

  const handleRevertToCash = async () => {
    setReverting2(true); setError('')
    try {
      const { res, data } = await revertToCash(order.id)
      if (!res.ok) { setError(data?.message || 'Failed to revert payment'); setReverting2(false); return }
      onRefresh?.()
    } catch (e) { setError(e.message || 'Failed to revert payment') }
    setReverting2(false)
  }

  const handleApplyDiscount = async () => {
    setDiscountSaving(true); setError('')
    try {
      const { res, data } = await patchOrderDiscount(order.id, discountAmt ? Number(discountAmt) : 0, voucherCode || null, selectedBill?.id || null)
      if (!res.ok) { setError(data?.error || data?.message || 'Failed to apply discount'); setDiscountSaving(false); return }
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setDiscountSaving(false)
  }

  const handleVoucherScan = async (payload) => {
    const clean = String(payload || '').trim()
    setVoucherScanOpen(false)
    if (!clean) return
    setDiscountSaving(true); setError('')
    try {
      const { res, data } = await redeemVoucher(clean, order.id, selectedBill?.id || null)
      if (!res.ok) { setError(data?.error || data?.message || 'Voucher could not be applied'); setDiscountSaving(false); return }
      const nextOrder = data?.order
      if (nextOrder) {
        setDiscountAmt(nextOrder.discountAmount ? String(nextOrder.discountAmount) : '')
        setVoucherCode(nextOrder.voucherCode || '')
      }
      setVoucherDetail(data?.voucher || null)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setDiscountSaving(false)
  }

  const handleViewVoucher = async () => {
    const code = selectedBill?.voucherCode || order.voucherCode || voucherCode
    if (!code) return
    setVoucherLoading(true); setError('')
    try {
      const { res, data } = await fetchVoucherDetail(code)
      if (!res.ok) { setError(data?.error || data?.message || 'Voucher not found'); setVoucherLoading(false); return }
      setVoucherDetail(data)
      setVoucherDetailOpen(true)
    } catch (e) { setError(e.message || 'Network error') }
    setVoucherLoading(false)
  }

  const handleRemoveVoucher = async () => {
    setVoucherRemoving(true); setError('')
    try {
      const { res, data } = await removeOrderVoucher(order.id, selectedBill?.id || null)
      if (!res.ok) { setError(data?.error || data?.message || 'Failed to remove voucher'); setVoucherRemoving(false); return }
      setVoucherCode('')
      setDiscountAmt(data?.discountAmount ? String(data.discountAmount) : '')
      setVoucherDetail(null)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setVoucherRemoving(false)
  }

  const handleUndoMerge = async () => {
    const batchId = (order.bills || []).find(b => b.status === 'MERGED' && b.mergeBatchId)?.mergeBatchId || null
    setUndoMerging(true); setError('')
    try {
      const { res, data } = await undoMergeBills(order.id, batchId)
      if (!res.ok) { setError(data?.error || 'Failed to undo merge'); setUndoMerging(false); return }
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setUndoMerging(false)
  }

  const findExactCustomer = (list, q) => {
    const lookup = normalizeLookup(q)
    if (!lookup) return null
    return (list || []).find(c => normalizeLookup(c.customerCode) === lookup || normalizeLookup(c.phone) === lookup) || null
  }

  const handleSearchCust = async (q) => {
    setCustSearch(q)
    if (!q.trim()) { setCustResults([]); return [] }
    setCustSearching(true)
    try {
      const { data } = await fetchCustomers(q)
      const list = data || []
      setCustResults(list)
      return list
    } catch {
      return []
    } finally {
      setCustSearching(false)
    }
  }

  const handleCustomerLookupSubmit = async () => {
    const list = await handleSearchCust(custSearch)
    const exact = findExactCustomer(list, custSearch)
    if (exact) handleLinkCustomer(exact)
  }

  const handleCustomerScan = async (payload) => {
    setCustomerScanOpen(false)
    const lookup = extractCustomerLookup(payload)
    if (!lookup) return
    const list = await handleSearchCust(lookup)
    const exact = findExactCustomer(list, lookup)
    if (exact) handleLinkCustomer(exact)
    else setError(`No customer found for code: ${lookup}`)
  }

  const handleLinkCustomer = async (c) => {
    setCustLinking(true); setError('')
    try {
      const { res } = await linkOrderCustomer(order.id, c.id)
      if (!res.ok) { setError('Failed to link customer'); setCustLinking(false); return }
      setLinkedCustomer(c); setCustSearch(''); setCustResults([])
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setCustLinking(false)
  }

  const handleUnlinkCustomer = async () => {
    setCustLinking(true); setError('')
    try {
      const { res } = await linkOrderCustomer(order.id, null)
      if (!res.ok) { setError('Failed to unlink customer'); setCustLinking(false); return }
      setLinkedCustomer(null); onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setCustLinking(false)
  }

  const handleEarnPoints = async () => {
    setPtsSaving(true); setError('')
    try {
      const { res, data } = await earnOrderPoints(order.id)
      if (!res.ok) { setError(data?.error || 'Failed to earn points'); setPtsSaving(false); return }
      setLinkedCustomer(data)
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setPtsSaving(false)
  }

  const handleApplyCustomerDiscount = async () => {
    const percent = customerDiscountPercent(linkedCustomer, bankCfg)
    const amount = customerDiscountAmount(order, percent)
    if (!percent || !amount) return
    setDiscountSaving(true); setError('')
    try {
      const { res, data } = await patchOrderDiscount(order.id, amount, null, selectedBill?.id || null)
      if (!res.ok) { setError(data?.error || data?.message || 'Failed to apply customer discount'); setDiscountSaving(false); return }
      setDiscountAmt(data?.discountAmount ? String(data.discountAmount) : String(amount))
      onRefresh?.()
    } catch (e) { setError(e.message || 'Network error') }
    setDiscountSaving(false)
  }


  const renderCustomerHistory = () => {
    if (!linkedCustomer && !order.customerId) return null
    const purchases = custHistory?.purchases || []
    const vouchers = custHistory?.vouchers || []
    const appliedOrders = custHistory?.appliedOrders || []
    return (
      <Box sx={{ mt: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
        <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
          <Box sx={{ px: 1, py: 0.75, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" fontWeight={800} sx={{ flex: 1 }}>{t('shopOrder.detail.purchaseHistory')}</Typography>
            <Chip size="small" label={`${purchases.length} bills`} sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
          </Box>
          {custHistoryLoading ? (
            <Box sx={{ p: 1.5, textAlign: 'center' }}><CircularProgress size={18} /></Box>
          ) : purchases.length ? (
            <Table size={large ? "medium" : "small"}>
              <TableBody>
                {purchases.slice(0, 5).map(p => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ py: 0.6 }}>
                      <Typography variant="body2" fontWeight={700}>#{p.orderNumber ?? p.orderCode}</Typography>
                      <Typography variant="caption" color="text.secondary">{dateFmt(p.createdAt)}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.6 }}><Chip size="small" label={p.status} color={STATUS_COLOR[p.status] || 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                    <TableCell align="right" sx={{ py: 0.6, fontWeight: 700 }}>{fmt(p.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.25 }}>{t('shopOrder.detail.noPurchases')}</Typography>
          )}
        </Box>

        <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
          <Box sx={{ px: 1, py: 0.75, bgcolor: '#f8fafc', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" fontWeight={800} sx={{ flex: 1 }}>{t('shopOrder.detail.voucherHistory')}</Typography>
            <Chip size="small" label={`${vouchers.length + appliedOrders.length} records`} sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
          </Box>
          {custHistoryLoading ? (
            <Box sx={{ p: 1.5, textAlign: 'center' }}><CircularProgress size={18} /></Box>
          ) : vouchers.length || appliedOrders.length ? (
            <Table size={large ? "medium" : "small"}>
              <TableBody>
                {vouchers.slice(0, 4).map(v => (
                  <TableRow key={v.id}>
                    <TableCell sx={{ py: 0.6 }}>
                      <Typography variant="body2" fontWeight={700}>{v.code}</Typography>
                      <Typography variant="caption" color="text.secondary">{v.redeemedAt ? `Used ${dateFmt(v.redeemedAt)}` : `Issued ${dateFmt(v.createdAt)}`}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.6 }}><Chip size="small" label={v.status} color={v.status === 'USED' ? 'success' : v.status === 'ACTIVE' ? 'primary' : 'default'} sx={{ height: 18, fontSize: 10 }} /></TableCell>
                    <TableCell align="right" sx={{ py: 0.6, fontWeight: 700 }}>{fmt(v.faceValue)}</TableCell>
                  </TableRow>
                ))}
                {appliedOrders.slice(0, Math.max(0, 5 - Math.min(vouchers.length, 4))).map(a => (
                  <TableRow key={`${a.orderId}:${a.voucherCode}`}>
                    <TableCell sx={{ py: 0.6 }}>
                      <Typography variant="body2" fontWeight={700}>{a.voucherCode}</Typography>
                      <Typography variant="caption" color="text.secondary">Applied on #{a.orderNumber ?? a.orderCode}</Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.6 }}><Chip size="small" label="APPLIED" color="warning" sx={{ height: 18, fontSize: 10 }} /></TableCell>
                    <TableCell align="right" sx={{ py: 0.6, fontWeight: 700 }}>-{fmt(a.discountAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', p: 1.25 }}>{t('shopOrder.detail.noVoucherActivity')}</Typography>
          )}
        </Box>
      </Box>
    )
  }
  if (!order) return null

  const isPending     = order.status === 'PENDING'
  const isConfirmed   = order.status === 'CONFIRMED'
  const isFinal       = ['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)
  const canSwitchToQr = order.paymentMethod === 'CASH' && !isFinal
  const canSplit      = !isFinal && order.paymentMethod !== 'SPLIT'
  const canRevertCash = !isFinal && (order.paymentMethod === 'BANK_QR' || order.paymentMethod === 'SPLIT')
  const total         = payableAmount(order)
  const cashNum       = Number(cashInput) || 0
  const qrPortion     = Math.max(0, total - cashNum)

  const splitCash = splitCashPortion(order)
  const splitQr   = splitQrPortion(order)

  const payQrSrc = order.paymentQr?.startsWith('https://')
    ? order.paymentQr
    : order.paymentQr ? `data:image/png;base64,${order.paymentQr}` : null

  const bills = order.bills || []
  const activeBills = bills.filter(b => b.status === 'ACTIVE')
  const selectedBill = activeBills.find(b => b.id === selectedBillId) || activeBills[0] || null
  const mergedBills = bills.filter(b => b.status === 'MERGED' && b.mergedIntoBillId)
  const showBillSummary = activeBills.length > 1 || mergedBills.length > 0

  return (
    <>
      <Dialog open={!!open} onClose={onClose} fullWidth maxWidth={large ? "lg" : "md"}
        PaperProps={{ sx: { borderRadius: 2 } }}>

        {/* ── Title ─────────────────────────────────────────────────── */}
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
              <Typography fontWeight={800} variant={large ? "h5" : "h6"}>
                Order #{order.orderNumber ?? '?'}
              </Typography>
              {/* orderCode shown prominently for QR tracking */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: '#1e293b', borderRadius: 1, px: 1, py: 0.25 }}>
                <QrCode2Icon sx={{ fontSize: large ? 16 : 13, color: '#94a3b8' }} />
                <Typography sx={{ fontFamily: 'monospace', fontSize: large ? 14 : 12, fontWeight: 700, letterSpacing: 1, color: '#e2e8f0' }}>
                  {order.orderCode}
                </Typography>
              </Box>
            </Box>
            {order.staffName && (
              <Typography variant="caption" color="text.secondary">{t('shopOrder.detail.by')} {order.staffName}</Typography>
            )}
          </Box>
          <Chip label={order.status} color={STATUS_COLOR[order.status] || 'default'} size="small" sx={{ fontWeight: 700 }} />
        </DialogTitle>

        <DialogContent sx={{ pt: 0, '& .MuiTableCell-root': { fontSize: large ? 15 : undefined }, '& .MuiTypography-body2': { fontSize: large ? 16 : undefined }, '& .MuiTypography-caption': { fontSize: large ? 13 : undefined }, '& .MuiChip-label': { fontSize: large ? 12 : undefined } }}>
          {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1 }}>{error}</Alert>}

          {/* ── Info grid ─────────────────────────────────────────── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: large ? 1 : 0.75, mb: 1.5, p: large ? 1.5 : 1.25, bgcolor: '#f8f9fa', borderRadius: 1.5 }}>
            <Typography variant="body2"><strong>{t('common.customer')}:</strong> {order.customerName || '—'}</Typography>
            <Typography variant="body2"><strong>{t('common.phone')}:</strong> {order.customerPhone || '—'}</Typography>
            <Typography variant="body2"><strong>{t('shopOrder.manual.type')}:</strong> {order.fulfillmentType}</Typography>
            <Typography variant="body2"><strong>{t('common.table')}:</strong> {order.tableName || '—'}</Typography>
            <Typography variant="body2"><strong>{t('shopOrder.detail.deliveryFee')}</strong> {fmt(order.deliveryFee)}</Typography>
            <Typography variant="body2"><strong>{t('shopOrder.detail.created')}</strong> {dateFmt(order.createdAt)}</Typography>
            {order.confirmedAt && <Typography variant="body2"><strong>{t('shopOrder.detail.confirmed')}</strong> {dateFmt(order.confirmedAt)}</Typography>}
            {order.notes && <Typography variant="body2" sx={{ gridColumn: '1/-1', fontStyle: 'italic', color: 'text.secondary' }}>{t('shopOrder.detail.note')} {order.notes}</Typography>}
          </Box>

          {showBillSummary && (
            <Box sx={{ mb: 1.5, p: 1, bgcolor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mr: 0.5 }}>{t('shopOrder.detail.bills')}</Typography>
                {activeBills.map(b => {
                  const billNet = b.netAmount != null ? b.netAmount : Math.max(0, Number(b.totalAmount || 0) - Number(b.discountAmount || 0))
                  const selected = selectedBill?.id === b.id
                  const linked = (b.linkedOrders || []).map(x => x.orderNumber ? `#${x.orderNumber}` : x.orderCode).filter(Boolean).join(', ')
                  return (
                  <Chip key={b.id} size="small" color={selected ? "primary" : "default"} variant={selected ? "filled" : "outlined"}
                    onClick={() => { setSelectedBillId(b.id); setDiscountAmt(b.discountAmount ? String(b.discountAmount) : ''); setVoucherCode(b.voucherCode || '') }}
                    label={`Bill #${b.billNumber || '?'} · ${fmt(billNet)}${linked ? ` · ${linked}` : ''}`}
                    sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
                  )
                })}
                {mergedBills.map(b => (
                  <Chip key={b.id} size="small" color="warning"
                    label={`Merged #${b.orderNumber ?? b.orderCode}`}
                    sx={{ height: 22, fontSize: 11, fontWeight: 700 }} />
                ))}
              </Box>
            </Box>
          )}

          {/* ── Items ─────────────────────────────────────────────── */}
          <Table size={large ? "medium" : "small"}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: large ? 14 : 12, bgcolor: '#f0f4ff' } }}>
                <TableCell>{t('shopOrder.detail.itemOptions')}</TableCell>
                <TableCell align="center" width={52}>{t('shopOrder.detail.qty')}</TableCell>
                <TableCell align="right" width={100}>{t('shopOrder.detail.price')}</TableCell>
                <TableCell align="right" width={80}>{t('shopOrder.detail.raw')}</TableCell>
                <TableCell align="right" width={72}>{t('shopOrder.detail.margin')}</TableCell>
                <TableCell align="right" width={110}>{t('common.total')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {buildItemGroups(order.items || []).map(({ root, children, subtotal }) => [
                /* ── Root item row ── */
                <TableRow key={root.id} sx={{ verticalAlign: 'top' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{root._label}</Typography>
                      <Box>
                        <Typography variant="body2" fontWeight={700} fontSize={large ? 17 : 14}>{root.modelName}</Typography>
                        {(root.billNumber || (root.sourceOrderId && String(root.sourceOrderId) !== String(order.id))) && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.35 }}>
                            {root.billNumber && <Chip size="small" label={`Bill #${root.billNumber}`} sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
                            {root.sourceOrderId && String(root.sourceOrderId) !== String(order.id) && (
                              <Chip size="small" color="warning" variant="outlined" label={`From #${root.sourceOrderNumber ?? root.sourceOrderCode}`} sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />
                            )}
                          </Box>
                        )}
                        <OptionsDisplay selectedOptions={root.selectedOptions} />
                        {root.itemNotes && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.25 }}>{root.itemNotes}</Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="center"><Typography fontWeight={700} fontSize={large ? 17 : 14}>{Number(root.quantity)}</Typography></TableCell>
                  <TableCell align="right">{fmt(root.unitPrice)}</TableCell>
                  <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmt(root.unitRawCost)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="caption" color="success.main">{pct(root.unitPrice, root.unitRawCost)}</Typography></TableCell>
                  <TableCell align="right"><Typography fontWeight={700} fontSize={large ? 17 : 14} color="primary">{fmt(root.lineTotal)}</Typography></TableCell>
                </TableRow>,

                /* ── Child rows ── */
                ...children.map(child => {
                  const effectiveQty   = Number(child.quantity || 1)
                  const effectiveTotal = Number(child.lineTotal || 0)
                  return (
                    <TableRow key={child.id} sx={{ verticalAlign: 'top', bgcolor: '#f8f9ff' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, pl: 1.5, borderLeft: '2px solid #c7d2fe' }}>
                          <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{child._label}</Typography>
                          <Box>
                            <Typography variant="body2" fontWeight={600} fontSize={large ? 16 : 13} color="#4338ca">{child.modelName}</Typography>
                            {child.itemNotes && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>{child.itemNotes}</Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="center"><Typography fontWeight={800} fontSize={large ? 16 : 13} color="#6366f1">{effectiveQty}</Typography></TableCell>
                      <TableCell align="right"><Typography fontSize={large ? 15 : 13} color="text.secondary">{fmt(child.unitPrice)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="caption" color="text.secondary">{fmt(child.unitRawCost)}</Typography></TableCell>
                      <TableCell align="right"><Typography variant="caption" color="success.main">{pct(child.unitPrice, child.unitRawCost)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700} fontSize={large ? 16 : 13} color="#6366f1">{fmt(effectiveTotal)}</Typography></TableCell>
                    </TableRow>
                  )
                }),

                /* ── Subtotal row (only when children exist) ── */
                children.length > 0 && (
                  <TableRow key={`sub-${root.id}`} sx={{ bgcolor: '#f0f4ff' }}>
                    <TableCell colSpan={5} align="right">
                      <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic' }}>
                        subtotal ({root._label.replace('.', '')} {root.modelName})
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={900} fontSize={large ? 17 : 14} color="primary">{fmt(subtotal)}</Typography>
                    </TableCell>
                  </TableRow>
                ),
              ])}
            </TableBody>
          </Table>

          {(() => {
            const groups = buildItemGroups(order.items || [])
            const itemsTotal = groups.reduce((s, g) => s + g.subtotal, 0)
            const delivery   = Number(order.deliveryFee || 0)
            const discount   = Number(order.discountAmount || 0)
            const grandTotal = Math.max(0, itemsTotal + delivery - discount)
            const totalMainQty = groups.reduce((s, g) => s + Number(g.root.quantity || 1), 0)
            const totalLines   = groups.length
            return (
            <Box sx={{ mt: 0.75, pr: 1, mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {totalLines} line{totalLines !== 1 ? 's' : ''}
                </Typography>
                <Box sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 900, fontSize: 12, borderRadius: 99, px: 1, py: 0.1, lineHeight: 1.6 }}>
                  {totalMainQty} item{totalMainQty !== 1 ? 's' : ''} total
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">{t('shopOrder.detail.rawCost')} {fmt(order.totalRawCost)}</Typography>
                {delivery > 0 && (
                  <Typography variant="body2" color="text.secondary">{t('shopOrder.common.items')}: {fmt(itemsTotal)} + {t('shopOrder.detail.delivery')} {fmt(delivery)}</Typography>
                )}
                {discount > 0 && (
                  <Typography variant="body2" color="error.main">
                    Discount: -{fmt(discount)}{order.voucherCode ? ` (${order.voucherCode})` : ''}
                  </Typography>
                )}
                {(selectedBill?.voucherCode || order.voucherCode) && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                    <Chip size="small" color={voucherDetail?.expired ? 'error' : 'warning'} label={order.voucherCode} sx={{ fontWeight: 700 }} />
                    <Button size="small" variant="outlined" onClick={handleViewVoucher}
                      disabled={voucherLoading} sx={{ textTransform: 'none', py: 0.15 }}>
                      {voucherLoading ? t('common.loading') : t('shopOrder.detail.viewVoucher')}
                    </Button>
                  </Box>
                )}
                <Typography fontWeight={900} variant="h5" color="primary">{t('shopOrder.detail.grandTotal')} {fmt(grandTotal)}</Typography>
              </Box>
            </Box>
            )
          })()}

          {/* ── Discount / Voucher ────────────────────────────────── */}
          {!isFinal && (
            <Box sx={{ mb: 1.5, p: 1.25, bgcolor: '#fff9f0', border: '1px solid #ffe0b2', borderRadius: 1.5 }}>
              <Typography variant="caption" fontWeight={800} color="#e65100"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                Discount / Voucher
              </Typography>
              {activeBills.length > 1 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
                  {activeBills.map(b => {
                    const selected = selectedBill?.id === b.id
                    return (
                      <Chip key={b.id} size="small" color={selected ? "warning" : "default"} variant={selected ? "filled" : "outlined"}
                        onClick={() => { setSelectedBillId(b.id); setDiscountAmt(b.discountAmount ? String(b.discountAmount) : ''); setVoucherCode(b.voucherCode || '') }}
                        label={`Apply to Bill #${b.billNumber || '?'}`}
                        sx={{ height: 22, fontSize: 11, fontWeight: 800 }} />
                    )
                  })}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <TextField
                  label={t('shopOrder.detail.discountAmount')} size="small" type="text" inputMode="numeric"
                  value={fmtDots(discountAmt)}
                  onChange={e => setDiscountAmt(stripNonDigits(e.target.value))}
                  InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                  sx={{ width: 180 }}
                />
                <TextField
                  label={t('shopOrder.detail.voucherCode')} size="small"
                  value={voucherCode}
                  onChange={e => setVoucherCode(e.target.value)}
                  sx={{ flex: 1, minWidth: 120 }}
                />
                <Button variant="contained" color="warning" size="small"
                  onClick={handleApplyDiscount} disabled={discountSaving || voucherRemoving}
                  startIcon={discountSaving ? <CircularProgress size={14} /> : null}
                  sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                  Apply
                </Button>
                <Button variant="outlined" color="primary" size="small"
                  onClick={() => setVoucherScanOpen(true)} disabled={discountSaving || voucherRemoving}
                  startIcon={<QrCode2Icon />}
                  sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                  Scan Voucher
                </Button>
                {(selectedBill?.voucherCode || order.voucherCode || voucherCode) && (
                  <Button variant="outlined" size="small" onClick={handleViewVoucher}
                    disabled={voucherLoading || discountSaving || voucherRemoving}
                    sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                    {voucherLoading ? 'Loading...' : 'View'}
                  </Button>
                )}
                {(selectedBill?.voucherCode || order.voucherCode) && (
                  <Button variant="outlined" color="error" size="small" onClick={handleRemoveVoucher}
                    disabled={voucherRemoving || discountSaving}
                    startIcon={voucherRemoving ? <CircularProgress size={14} /> : null}
                    sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                    {t('shopOrder.detail.removeVoucher')}
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {/* ── Customer Link ──────────────────────────────────────── */}
          <Box sx={{ mb: 1.5, p: 1.25, bgcolor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 1.5 }}>
            <Typography variant="caption" fontWeight={800} color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
              Customer (points)
            </Typography>
            {linkedCustomer ? (() => {
              const rate = bankCfg?.pointsConversionRate || 10000
              const roundUp = bankCfg?.pointsRoundUp || false
              const net = payableAmount(order)
              const preview = roundUp ? Math.ceil(net / rate) : Math.floor(net / rate)
              const discountPct = customerDiscountPercent(linkedCustomer, bankCfg)
              const discountValue = customerDiscountAmount(order, discountPct)
              const threshold = Number(bankCfg?.loyaltyDiscountPointThreshold || 0)
              return (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: (preview > 0 || discountPct > 0) && !isFinal ? 1 : 0 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700}>{linkedCustomer.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      {linkedCustomer.customerCode && <Chip label={linkedCustomer.customerCode} size="small" color="primary" variant="outlined" sx={{ height: 18, fontWeight: 800, fontSize: 10, fontFamily: 'monospace' }} />}
                      {linkedCustomer.phone && <Typography variant="caption" color="text.secondary">{linkedCustomer.phone}</Typography>}
                      <Chip label={`${linkedCustomer.points ?? 0} pts`} size="small" color="warning" variant="outlined" sx={{ height: 18, fontWeight: 700, fontSize: 10 }} />
                      {discountPct > 0 && <Chip label={`${discountPct}% discount`} size="small" color="success" sx={{ height: 18, fontWeight: 800, fontSize: 10 }} />}
                    </Box>
                  </Box>
                  {!isFinal && (
                    <Button size="small" color="error" onClick={handleUnlinkCustomer} disabled={custLinking}
                      sx={{ textTransform: 'none', flexShrink: 0 }}>
                      Unlink
                    </Button>
                  )}
                </Box>
                {discountPct > 0 && !isFinal && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 1, px: 1.25, py: 0.75, mb: preview > 0 ? 0.75 : 0 }}>
                    <Typography variant="body2" sx={{ flex: 1, color: '#047857', fontWeight: 700 }}>
                      Loyalty discount {discountPct}% = -{fmt(discountValue)}{threshold > 0 ? ` (${threshold}+ pts)` : ''}
                    </Typography>
                    <Button size="small" variant="contained" color="success"
                      onClick={handleApplyCustomerDiscount} disabled={discountSaving || !discountValue}
                      startIcon={discountSaving ? <CircularProgress size={12} /> : null}
                      sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0, fontSize: 11 }}>
                      {t('shopOrder.detail.applyDiscount')}
                    </Button>
                  </Box>
                )}
                {preview > 0 && !isFinal && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#fffde7', border: '1px solid #ffe082', borderRadius: 1, px: 1.25, py: 0.75 }}>
                    <Typography variant="body2" sx={{ flex: 1, color: '#e65100', fontWeight: 600 }}>
                      +{preview} pts from this bill ({fmt(rate)} = 1 pt)
                    </Typography>
                    <Button size="small" variant="contained" color="warning"
                      onClick={handleEarnPoints} disabled={ptsSaving}
                      startIcon={ptsSaving ? <CircularProgress size={12} /> : null}
                      sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0, fontSize: 11 }}>
                      Earn Points
                    </Button>
                  </Box>
                )}
              </Box>
              )
            })() : (
              <Box sx={{ position: 'relative' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    label={t('shopOrder.detail.customerLookup')} size="small" fullWidth
                    value={custSearch}
                    onChange={e => handleSearchCust(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCustomerLookupSubmit() } }}
                    InputProps={{ endAdornment: custSearching ? <InputAdornment position="end"><CircularProgress size={14} /></InputAdornment> : null }}
                    disabled={isFinal}
                  />
                  <Button size="small" variant="outlined" onClick={handleCustomerLookupSubmit} disabled={isFinal || custSearching || !custSearch.trim()}
                    sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0, mt: 0.25 }}>
                    Find
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<QrCode2Icon />} onClick={() => setCustomerScanOpen(true)} disabled={isFinal}
                    sx={{ textTransform: 'none', fontWeight: 700, flexShrink: 0, mt: 0.25 }}>
                    Scan
                  </Button>
                </Box>
                {custResults.length > 0 && (
                  <Box sx={{
                    position: 'absolute', zIndex: 10, left: 0, right: 0, top: '100%',
                    bgcolor: '#fff', border: '1px solid #e0e0e0', borderRadius: 1.5,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', mt: 0.5, maxHeight: 220, overflowY: 'auto',
                  }}>
                    {custResults.map(c => {
                      const discountPct = customerDiscountPercent(c, bankCfg)
                      return (
                      <Box key={c.id} onClick={() => handleLinkCustomer(c)}
                        sx={{ px: 1.5, py: 1, cursor: 'pointer', '&:hover': { bgcolor: '#f0f4ff' },
                          display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={700}>{c.name}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                            {c.customerCode && <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 800, color: '#0288d1' }}>{c.customerCode}</Typography>}
                            {c.phone && <Typography variant="caption" color="text.secondary">{c.phone}</Typography>}
                          </Box>
                        </Box>
                        <Chip label={`${c.points ?? 0} pts`} size="small" color="warning" variant="outlined" sx={{ height: 18, fontWeight: 700, fontSize: 10 }} />
                        {discountPct > 0 && <Chip label={`${discountPct}%`} size="small" color="success" sx={{ height: 18, fontWeight: 800, fontSize: 10 }} />}
                      </Box>
                      )
                    })}
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* ── Payment Panel ─────────────────────────────────────── */}
          <Divider sx={{ mb: 1.5 }} />

          {/* CASH order */}
          {order.paymentMethod === 'CASH' && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tracking QR */}
              {(qrLoading || tagQr) && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t('shopOrder.common.trackingQr')}</Typography>
                  {qrLoading ? <CircularProgress size={24} /> : (
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  )}
                </Box>
              )}
              {/* Cash block */}
              <Box sx={{ flex: 1, minWidth: 260, bgcolor: '#fff8e1', border: '2px solid #f59e0b', borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="#e65100"
                  sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  💵 Cash Payment
                </Typography>
                <Typography fontWeight={900} sx={{ fontSize: 32, color: '#e65100', lineHeight: 1.1, mb: 1 }}>
                  {fmt(total)}
                </Typography>
                <ChangeCalc label={t('shopOrder.detail.cashCalculator')} due={total}
                  color="#e65100" bg="#fff" borderColor="#f59e0b" />
              </Box>
            </Box>
          )}

          {/* BANK_QR order */}
          {order.paymentMethod === 'BANK_QR' && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tracking QR */}
              {(qrLoading || tagQr) && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t('shopOrder.common.trackingQr')}</Typography>
                  {qrLoading ? <CircularProgress size={24} /> : (
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  )}
                </Box>
              )}
              {/* Payment QR */}
              {payQrSrc && (
                <Box sx={{ bgcolor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={800} color="#15803d"
                    sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                    💳 Scan to Pay
                  </Typography>
                  <img src={payQrSrc} alt="Payment QR"
                    style={{ width: 180, height: 180, borderRadius: 10, border: '2px solid #bbf7d0', display: 'block' }} />
                  <Typography fontWeight={900} sx={{ fontSize: 28, color: '#15803d', mt: 0.75, lineHeight: 1 }}>
                    {fmt(total)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    ref: {order.orderCode}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* SPLIT order */}
          {order.paymentMethod === 'SPLIT' && (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Tracking QR */}
              {(qrLoading || tagQr) && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t('shopOrder.common.trackingQr')}</Typography>
                  {qrLoading ? <CircularProgress size={24} /> : (
                    <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                      style={{ width: 90, height: 90, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  )}
                </Box>
              )}

              {/* QR block */}
              {payQrSrc && (
                <Box sx={{ bgcolor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={800} color="#15803d"
                    sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                    💳 QR Portion
                  </Typography>
                  <img src={payQrSrc} alt="Payment QR"
                    style={{ width: 160, height: 160, borderRadius: 10, border: '2px solid #bbf7d0', display: 'block' }} />
                  <Typography fontWeight={900} sx={{ fontSize: 28, color: '#15803d', mt: 0.75, lineHeight: 1 }}>
                    {fmt(splitQr)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    ref: {order.orderCode}
                  </Typography>
                </Box>
              )}

              {/* Cash block */}
              <Box sx={{ flex: 1, minWidth: 220, bgcolor: '#fff8e1', border: '2px solid #f59e0b', borderRadius: 2, p: 1.5 }}>
                <Typography variant="caption" fontWeight={800} color="#e65100"
                  sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                  💵 Cash Portion
                </Typography>
                <Typography fontWeight={900} sx={{ fontSize: 32, color: '#e65100', lineHeight: 1.1, mb: 1.25 }}>
                  {fmt(splitCash)}
                </Typography>
                <ChangeCalc label={t('shopOrder.detail.cashCalculator')} due={splitCash}
                  color="#e65100" bg="#fff" borderColor="#f59e0b" />
              </Box>
            </Box>
          )}

          {/* Fallback: tracking QR only (no payment QR) — for any method not handled above */}
          {!['CASH','BANK_QR','SPLIT'].includes(order.paymentMethod) && (qrLoading || tagQr) && (
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{t('shopOrder.common.trackingQr')}</Typography>
              {qrLoading ? <CircularProgress size={24} /> : (
                <img src={`data:image/png;base64,${tagQr}`} alt="Tracking QR"
                  style={{ width: 120, height: 120, borderRadius: 8, border: '1px solid #e0e0e0' }} />
              )}
            </Box>
          )}

        </DialogContent>

        <DialogActions sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 0.75, justifyContent: 'space-between' }}>
          {/* ── Left: mutating actions ─────────────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {isPending && (
              <Tooltip title={t('shopOrder.detail.editTooltip')}>
                <Button variant="outlined" startIcon={<EditIcon />}
                  onClick={() => setEditOpen(true)} sx={{ textTransform: 'none' }}>
                  Edit Order
                </Button>
              </Tooltip>
            )}
            {!isFinal && (order.items || []).filter(i => !i.parentItemId).length > 1 && (
              <Tooltip title={t('shopOrder.detail.splitTooltip')}>
                <Button variant="outlined" color="secondary" startIcon={<CallSplitIcon />}
                  onClick={() => setSplitBillOpen(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Split Bill
                </Button>
              </Tooltip>
            )}
            {!isFinal && mergedBills.length > 0 && (
              <Tooltip title={t('shopOrder.detail.undoTooltip')}>
                <Button variant="outlined" color="warning"
                  startIcon={undoMerging ? <CircularProgress size={14} /> : <UndoIcon />}
                  onClick={handleUndoMerge} disabled={undoMerging}
                  sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Undo Merge
                </Button>
              </Tooltip>
            )}
            {canSwitchToQr && (
              <Tooltip title={t('shopOrder.detail.switchQrTooltip')}>
                <Button variant="contained" color="success" startIcon={<QrCode2Icon />}
                  onClick={() => askConfirm({ title: 'Switch to QR Payment?', message: 'Switch this order to Bank QR payment and print the receipt?', confirmLabel: 'Switch & Print', confirmColor: 'success' }, handleSwitchAndPrint)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}>
                  QR + Print
                </Button>
              </Tooltip>
            )}
            {canSplit && (
              <Tooltip title={t('shopOrder.detail.splitPaymentTooltip')}>
                <Button variant="outlined" color="secondary" startIcon={<CallSplitIcon />}
                  onClick={() => { setCashInput(String(Math.round(total / 2))); setSplitOpen(true) }}
                  sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Split
                </Button>
              </Tooltip>
            )}
            {canRevertCash && (
              <Tooltip title={t('shopOrder.detail.revertCashTooltip')}>
                <Button variant="outlined" color="warning" startIcon={<CurrencyExchangeIcon />}
                  onClick={() => askConfirm({ title: 'Revert to Cash?', message: 'Change this order\'s payment method back to cash?', confirmLabel: '→ Cash', confirmColor: 'warning' }, handleRevertToCash)}
                  sx={{ textTransform: 'none' }}>
                  → Cash
                </Button>
              </Tooltip>
            )}
          </Box>

          {/* ── Right: print actions + close ──────────────── */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Tooltip title={t('shopOrder.detail.counterTooltip')}>
              <Button variant="outlined" color="info" startIcon={<MonitorIcon />}
                onClick={() => broadcastToCounter(order, tagQr || null)} sx={{ textTransform: 'none' }}>
                Counter Display
              </Button>
            </Tooltip>
            <Tooltip title="Print order tag with tracking QR — give to customer to track order status">
              <Button variant="outlined" color="secondary"
                startIcon={qrLoading ? <CircularProgress size={14} /> : <QrCode2Icon />}
                onClick={() => tagQr && printOrderTagTracked(order, tagQr)}
                disabled={qrLoading || !tagQr} sx={{ textTransform: 'none' }}>
                Print · Track
              </Button>
            </Tooltip>
            <Button variant="outlined" color="primary" startIcon={<PrintIcon />}
              onClick={() => printOrderReceiptTracked(order, tagQr)} sx={{ textTransform: 'none' }}>
              Print · Pay
            </Button>
            <Tooltip title={t('shopOrder.detail.cupTooltip')}>
              <Button variant="outlined" color="secondary" startIcon={<LabelIcon />}
                onClick={() => printCupLabelsTracked(order)} sx={{ textTransform: 'none' }}>
                Cup Labels
              </Button>
            </Tooltip>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>{t('common.close')}</Button>
          </Box>
        </DialogActions>
      </Dialog>

      {editOpen && (
        <EditOrderDialog open={editOpen} order={order}
          onClose={() => setEditOpen(false)}
          onUpdated={(updated) => { setEditOpen(false); onRefresh?.(updated) }} />
      )}

      {confirmDlg && (
        <ConfirmActionDialog
          open
          title={confirmDlg.title}
          message={confirmDlg.message}
          confirmLabel={confirmDlg.confirmLabel}
          confirmColor={confirmDlg.confirmColor}
          requireReason={confirmDlg.requireReason}
          reasonLabel={confirmDlg.reasonLabel}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}

      {splitBillOpen && (
        <SplitBillDialog open={splitBillOpen} order={order}
          onClose={() => setSplitBillOpen(false)}
          onSplit={(result) => { setSplitBillOpen(false); onRefresh?.(result?.original || result); onClose() }} />
      )}

      {/* ── Split Payment Dialog ──────────────────────────────────── */}
      <Dialog open={splitOpen} onClose={() => setSplitOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={800}>{t('shopOrder.detail.splitPayment')}</Typography>
          <Typography variant="caption" color="text.secondary">
            Total: <strong>{fmt(total)}</strong> — type in either box, the other adjusts automatically
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 1, alignItems: 'center', mb: 2 }}>
            {/* Cash box */}
            <Box sx={{ bgcolor: '#fff7ed', border: '2px solid #f59e0b', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" fontWeight={800} color="warning.dark"
                sx={{ display: 'block', textAlign: 'center', mb: 1, letterSpacing: 1, textTransform: 'uppercase' }}>
                💵 Tiền mặt
              </Typography>
              <TextField type="text" inputMode="numeric" size="small" fullWidth
                value={fmtDots(cashInput)}
                onChange={e => {
                  const v = Math.max(0, Math.min(Math.round(total), Number(stripNonDigits(e.target.value)) || 0))
                  setCashInput(String(v))
                }}
                inputProps={{ maxLength: 15, style: { textAlign: 'center', fontSize: 22, fontWeight: 900, padding: '8px 4px' } }}
                InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', '& fieldset': { borderColor: '#f59e0b' }, '&:hover fieldset': { borderColor: '#d97706' }, '&.Mui-focused fieldset': { borderColor: '#d97706' } } }}
              />
            </Box>
            <Typography sx={{ color: '#94a3b8', fontWeight: 900, fontSize: 20, userSelect: 'none' }}>⇄</Typography>
            {/* QR box */}
            <Box sx={{ bgcolor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 2, p: 1.5 }}>
              <Typography variant="caption" fontWeight={800} color="success.dark"
                sx={{ display: 'block', textAlign: 'center', mb: 1, letterSpacing: 1, textTransform: 'uppercase' }}>
                💳 Bank QR
              </Typography>
              <TextField type="text" inputMode="numeric" size="small" fullWidth
                value={fmtDots(String(qrPortion))}
                onChange={e => {
                  const qr = Math.max(0, Math.min(Math.round(total), Number(stripNonDigits(e.target.value)) || 0))
                  setCashInput(String(Math.round(total) - qr))
                }}
                inputProps={{ maxLength: 15, style: { textAlign: 'center', fontSize: 22, fontWeight: 900, padding: '8px 4px' } }}
                InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', '& fieldset': { borderColor: '#22c55e' }, '&:hover fieldset': { borderColor: '#16a34a' }, '&.Mui-focused fieldset': { borderColor: '#16a34a' } } }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button size="small" variant="outlined" color="warning" onClick={() => setCashInput(String(Math.round(total / 2)))}>{t('shopOrder.detail.half')}</Button>
            <Button size="small" variant="outlined" color="success" onClick={() => setCashInput('0')}>{t('shopOrder.detail.allQr')}</Button>
            <Button size="small" variant="outlined" onClick={() => setCashInput(String(Math.round(total)))}>{t('shopOrder.detail.allCash')}</Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setSplitOpen(false)} sx={{ textTransform: 'none' }}>{t('common.cancel')}</Button>
          <Button variant="contained" color="success"
            startIcon={splitting ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <CallSplitIcon />}
            onClick={handleSplit} disabled={splitting || cashNum < 0 || cashNum > total}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <VoucherQrScanDialog
        open={voucherScanOpen}
        onClose={() => setVoucherScanOpen(false)}
        onScan={handleVoucherScan}
      />

      <VoucherQrScanDialog
        open={customerScanOpen}
        onClose={() => setCustomerScanOpen(false)}
        onScan={handleCustomerScan}
        title={t('shopOrder.manual.scanCustomerQr')}
        manualLabel={t('shopOrder.manual.customerScanInput')}
        scannerLabel={t('shopOrder.manual.customerScanner')}
      />

      <Dialog open={voucherDetailOpen} onClose={() => setVoucherDetailOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 0.5 }}>
          <Typography fontWeight={800}>{t('shopOrder.detail.voucherDetail')}</Typography>
          <Typography variant="caption" color="text.secondary">{voucherDetail?.code || selectedBill?.voucherCode || order.voucherCode || voucherCode}</Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          {voucherDetail ? (
            <Stack spacing={1.1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip size="small" label={voucherDetail.status || 'UNKNOWN'}
                  color={voucherDetail.expired ? 'error' : voucherDetail.status === 'USED' ? 'success' : voucherDetail.status === 'ACTIVE' ? 'primary' : 'default'}
                  sx={{ fontWeight: 800 }} />
                {voucherDetail.expired && <Chip size="small" color="error" label={t('shopOrder.detail.expired')} sx={{ fontWeight: 800 }} />}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Typography variant="body2"><strong>{t('shopOrder.detail.faceValue')}:</strong> {fmt(voucherDetail.faceValue)}</Typography>
                <Typography variant="body2"><strong>{t('shopOrder.detail.salePrice')}:</strong> {fmt(voucherDetail.salePrice)}</Typography>
                <Typography variant="body2"><strong>{t('shopOrder.detail.expiry')}:</strong> {voucherDetail.expiryDate || '—'}</Typography>
                <Typography variant="body2"><strong>{t('shopOrder.detail.issued')}:</strong> {dateFmt(voucherDetail.createdAt)}</Typography>
              </Box>
              <Divider />
              <Typography variant="body2"><strong>{t('shopOrder.detail.redeemedOrder')}:</strong> {voucherDetail.redeemedOrderNumber ? `#${voucherDetail.redeemedOrderNumber}` : voucherDetail.redeemedOrderCode || '—'}</Typography>
              <Typography variant="body2"><strong>{t('shopOrder.detail.redeemedAt')}:</strong> {dateFmt(voucherDetail.redeemedAt)}</Typography>
              <Typography variant="body2"><strong>{t('common.customer')}:</strong> {voucherDetail.redeemedCustomerName || voucherDetail.customerId || '—'}</Typography>
              {voucherDetail.notes && <Typography variant="body2"><strong>{t('shopOrder.detail.notes')}:</strong> {voucherDetail.notes}</Typography>}
            </Stack>
          ) : (
            <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={22} /></Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          {(selectedBill?.voucherCode || order.voucherCode) && !isFinal && (
            <Button color="error" onClick={handleRemoveVoucher} disabled={voucherRemoving}
              startIcon={voucherRemoving ? <CircularProgress size={14} /> : null}
              sx={{ textTransform: 'none' }}>
              Remove Voucher
            </Button>
          )}
          <Button onClick={() => setVoucherDetailOpen(false)} sx={{ textTransform: 'none' }}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
