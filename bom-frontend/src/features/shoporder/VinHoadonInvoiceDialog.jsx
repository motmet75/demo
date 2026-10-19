import React, { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import DownloadIcon from '@mui/icons-material/Download'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SettingsIcon from '@mui/icons-material/Settings'
import {
  downloadVinHoadonInvoice, fetchVinHoadonConfig, fetchVinHoadonInvoiceStatuses, issueVinHoadonInvoice,
  previewVinHoadonInvoice, retryVinHoadonInvoice, saveVinHoadonConfig, syncVinHoadonInvoice,
} from '../../api/shopApi'

const VAT_OPTIONS = [
  { value: -2, label: 'Không kê khai' }, { value: -1, label: 'Không chịu thuế' },
  { value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 8, label: '8%' }, { value: 10, label: '10%' },
]
const PAYMENT_OPTIONS = [
  { value: 1, label: 'Tiền mặt' }, { value: 2, label: 'Chuyển khoản' },
  { value: 3, label: 'Tiền mặt / Chuyển khoản' }, { value: 4, label: 'Thẻ tín dụng' },
  { value: 5, label: 'Đối trừ công nợ' },
]
const money = value => Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' ₫'
const messageOf = (res, data, fallback) => data?.message || data?.error || (typeof data === 'string' ? data : '') || `${fallback} (${res?.status || '?'})`

function ConfigForm({ config, onSaved, onCancel }) {
  const [form, setForm] = useState({
    enabled: config?.enabled || false, taxCode: config?.taxCode || '', apiUsername: config?.apiUsername || '', apiPassword: '',
    invoiceTemplateCode: config?.invoiceTemplateCode || '', invoiceSeries: config?.invoiceSeries || '',
    defaultVatRate: config?.defaultVatRate ?? 8, pricesIncludeVat: config?.pricesIncludeVat !== false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const change = key => event => setForm(old => ({ ...old, [key]: event.target.value }))
  const save = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await saveVinHoadonConfig(form)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể lưu cấu hình'))
      onSaved(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Stack spacing={2} sx={{ pt: 1 }}>
    {!config?.encryptionConfigured && <Alert severity="error">Máy chủ chưa có VIN_HOADON_MASTER_KEY (tối thiểu 32 ký tự). Không thể lưu mật khẩu an toàn.</Alert>}
    {!config?.gatewayEnabled && <Alert severity="warning">VIN_HOADON_ENABLED đang là false trên máy chủ. Có thể lưu cấu hình trước, nhưng chưa thể phát hành hóa đơn.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <FormControlLabel control={<Switch checked={form.enabled} onChange={e => setForm(old => ({ ...old, enabled: e.target.checked }))} />} label="Bật VIN-HOADON cho công ty này" />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <TextField label="Mã số thuế người bán" value={form.taxCode} onChange={change('taxCode')} required inputProps={{ maxLength: 14 }} />
      <TextField label="Tên đăng nhập VIN-HOADON" value={form.apiUsername} onChange={change('apiUsername')} required />
      <TextField label={config?.passwordConfigured ? 'Mật khẩu mới (để trống để giữ nguyên)' : 'Mật khẩu VIN-HOADON'} value={form.apiPassword} onChange={change('apiPassword')} type="password" required={!config?.passwordConfigured} />
      <TextField label="Mã mẫu hóa đơn" value={form.invoiceTemplateCode} onChange={change('invoiceTemplateCode')} required inputProps={{ maxLength: 11 }} />
      <TextField label="Ký hiệu hóa đơn" value={form.invoiceSeries} onChange={change('invoiceSeries')} required inputProps={{ maxLength: 8 }} />
      <TextField select label="Thuế suất mặc định" value={form.defaultVatRate} onChange={e => setForm(old => ({ ...old, defaultVatRate: Number(e.target.value) }))}>
        {VAT_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </TextField>
    </Box>
    <FormControlLabel control={<Switch checked={form.pricesIncludeVat} onChange={e => setForm(old => ({ ...old, pricesIncludeVat: e.target.checked }))} />} label="Giá bán trong đơn đã bao gồm VAT" />
    <Typography variant="caption" color="text.secondary">Mật khẩu được mã hóa AES-GCM theo công ty và không bao giờ trả lại trình duyệt.</Typography>
    <DialogActions sx={{ px: 0 }}>
      {onCancel && <Button onClick={onCancel}>Quay lại</Button>}
      <Button variant="contained" onClick={save} disabled={busy || !config?.encryptionConfigured}>{busy ? <CircularProgress size={20} /> : 'Lưu cấu hình'}</Button>
    </DialogActions>
  </Stack>
}

export default function VinHoadonInvoiceDialog({ open, onClose, orders = [], configOnly = false, isAdmin = false, onIssued }) {
  const [config, setConfig] = useState(null)
  const [showConfig, setShowConfig] = useState(configOnly)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [invoice, setInvoice] = useState(null)
  const [existingConflict, setExistingConflict] = useState(false)
  const first = orders[0] || {}
  const [buyer, setBuyer] = useState({ buyerTaxCode: '', buyerOrganizationName: '', buyerName: '', buyerAddress: '', buyerPhone: '', buyerEmail: '', paymentMethod: 3, vatRate: 8 })
  const orderIds = useMemo(() => orders.map(order => order.id).filter(Boolean), [orders])
  const ineligible = orders.filter(order => order.paymentStatus !== 'PAID' || !['COMPLETED', 'PICKED_UP'].includes(order.status))

  useEffect(() => {
    if (!open) return
    setLoading(true); setError(''); setPreview(null); setInvoice(null); setExistingConflict(false); setShowConfig(configOnly)
    setBuyer(old => ({ ...old, buyerName: first.customerName || '', buyerAddress: first.deliveryAddress || '', buyerPhone: first.customerPhone || '' }))
    Promise.all([fetchVinHoadonConfig(), configOnly || !orderIds.length ? Promise.resolve(null) : fetchVinHoadonInvoiceStatuses(orderIds)]).then(([{ res, data }, statuses]) => {
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể tải cấu hình VIN-HOADON'))
      setConfig(data); setBuyer(old => ({ ...old, vatRate: data.defaultVatRate ?? 8 }))
      if (statuses && !statuses.res.ok) throw new Error(messageOf(statuses.res, statuses.data, 'Không thể tải trạng thái hóa đơn'))
      const existing = Object.values(statuses?.data || {})
      if (existing.length && existing.length === orderIds.length && existing.every(item => item.id === existing[0].id)) setInvoice(existing[0])
      else if (existing.length) { setExistingConflict(true); setError('Một số đơn đã thuộc hóa đơn VIN-HOADON khác. Chọn riêng các đơn thuộc cùng một hóa đơn.') }
      if (configOnly || !data.configured) setShowConfig(true)
    }).catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [open, configOnly, first.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const payload = () => ({ orderIds, ...buyer, paymentMethod: Number(buyer.paymentMethod), vatRate: Number(buyer.vatRate) })
  const runPreview = async () => {
    setBusy(true); setError(''); setInvoice(null)
    try {
      const { res, data } = await previewVinHoadonInvoice(payload())
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể xem trước hóa đơn'))
      setPreview(data)
    } catch (err) { setError(err.message); setPreview(null) } finally { setBusy(false) }
  }
  const issue = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await issueVinHoadonInvoice(payload())
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể phát hành hóa đơn'))
      setInvoice(data); setPreview(null); onIssued?.(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const retry = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await retryVinHoadonInvoice(invoice.id)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể thử lại'))
      setInvoice(data); onIssued?.(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const sync = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await syncVinHoadonInvoice(invoice.id)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể tra cứu hóa đơn'))
      setInvoice(data); onIssued?.(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const field = key => event => { setBuyer(old => ({ ...old, [key]: event.target.value })); setPreview(null) }
  const usable = config?.configured && config?.enabled && config?.gatewayEnabled && config?.encryptionConfigured

  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
    <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {showConfig ? <SettingsIcon color="primary" /> : <ReceiptLongIcon color="primary" />}
      {showConfig ? 'Cấu hình VIN-HOADON' : `Xuất hóa đơn điện tử · ${orders.length} đơn`}
    </DialogTitle>
    <DialogContent dividers>
      {loading ? <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box> : <>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {showConfig ? (
          isAdmin ? <ConfigForm config={config || {}} onSaved={saved => { setConfig(saved); if (!configOnly) setShowConfig(false) }} onCancel={!configOnly && config?.configured ? () => setShowConfig(false) : null} />
            : <Alert severity="warning">Chỉ quản trị viên hoặc người dùng nghiệp vụ đầy đủ có thể cấu hình VIN-HOADON.</Alert>
        ) : invoice ? (
          <Stack spacing={2}>
            <Alert severity={invoice.status === 'ISSUED' ? 'success' : invoice.status === 'FAILED' ? 'error' : 'warning'}>
              {invoice.status === 'ISSUED' ? 'Hóa đơn đã được ký.' : invoice.status === 'PENDING' ? 'VIN-HOADON đã nhận hóa đơn; đang chờ ký hoặc cấp số.' : invoice.status === 'RECONCILE' ? 'Chưa xác nhận được kết quả. Tra cứu trước khi thử gửi lại.' : `Phát hành chưa thành công: ${invoice.resultMessage || 'Lỗi VIN-HOADON'}`}
            </Alert>
            <Box><Chip label={invoice.status} color={invoice.status === 'ISSUED' ? 'success' : 'error'} /> <b>{invoice.invoiceSeries || ''} {invoice.invoiceNumber || invoice.externalInvoiceId}</b></Box>
            <Typography>Tổng thanh toán: <b>{money(invoice.totalAmount)}</b></Typography>
            {invoice.taxAuthorityStatus != null && <Typography>Trạng thái cơ quan thuế: {({ 0: 'Chờ xác nhận', 1: 'Đã xác nhận', 2: 'Từ chối' })[invoice.taxAuthorityStatus] || invoice.taxAuthorityStatus}</Typography>}
            {invoice.status === 'ISSUED' ? <Stack direction="row" spacing={1}>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => downloadVinHoadonInvoice(invoice.id, 'pdf').catch(err => setError(err.message))}>Tải PDF</Button>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => downloadVinHoadonInvoice(invoice.id, 'xml').catch(err => setError(err.message))}>Tải XML</Button>
              <Button variant="outlined" onClick={sync} disabled={busy}>Cập nhật trạng thái thuế</Button>
            </Stack> : <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={sync} disabled={busy}>Tra cứu hóa đơn</Button>
              {invoice.status !== 'PENDING' && <Button variant="contained" color="warning" onClick={retry} disabled={busy}>Thử lại cùng mã hóa đơn</Button>}
            </Stack>}
          </Stack>
        ) : <Stack spacing={2}>
          {!usable && <Alert severity="warning" action={isAdmin ? <Button color="inherit" onClick={() => setShowConfig(true)}>Cấu hình</Button> : null}>VIN-HOADON chưa sẵn sàng cho công ty này.</Alert>}
          {ineligible.length > 0 && <Alert severity="error">Chỉ được chọn đơn đã thanh toán và có trạng thái Hoàn tất/Đã giao. Có {ineligible.length} đơn chưa đủ điều kiện.</Alert>}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{orders.map(order => <Chip key={order.id} label={`#${order.orderNumber || order.orderCode} · ${money(Number(order.totalAmount || 0) - Number(order.discountAmount || 0))}`} />)}</Box>
          <Divider />
          <Typography fontWeight={800}>Thông tin người mua</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField label="Mã số thuế người mua" value={buyer.buyerTaxCode} onChange={field('buyerTaxCode')} inputProps={{ maxLength: 14 }} />
            <TextField label="Tên đơn vị / tổ chức" value={buyer.buyerOrganizationName} onChange={field('buyerOrganizationName')} />
            <TextField label="Người mua hàng" value={buyer.buyerName} onChange={field('buyerName')} />
            <TextField label="Địa chỉ" value={buyer.buyerAddress} onChange={field('buyerAddress')} />
            <TextField label="Số điện thoại" value={buyer.buyerPhone} onChange={field('buyerPhone')} />
            <TextField label="Email nhận hóa đơn" value={buyer.buyerEmail} onChange={field('buyerEmail')} type="email" />
            <TextField select label="Hình thức thanh toán" value={buyer.paymentMethod} onChange={field('paymentMethod')}>{PAYMENT_OPTIONS.map(x => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</TextField>
            <TextField select label="Thuế suất" value={buyer.vatRate} onChange={field('vatRate')}>{VAT_OPTIONS.map(x => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</TextField>
          </Box>
          {preview && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1, p: 1, bgcolor: 'grey.100', fontWeight: 800 }}><span>Hàng hóa</span><span>SL</span><span>Thành tiền</span></Box>
            {preview.lines.map((line, index) => <Box key={`${line.code}-${index}`} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 1, p: 1, borderTop: '1px solid', borderColor: 'divider' }}><span>{line.name}</span><span>{line.quantity}</span><b>{money(line.total)}</b></Box>)}
            <Stack sx={{ p: 1.5, borderTop: '2px solid', borderColor: 'divider', alignItems: 'flex-end' }}>
              <Typography>Tiền trước thuế: {money(preview.subtotal)}</Typography><Typography>Thuế: {money(preview.taxAmount)}</Typography><Typography variant="h6" fontWeight={900}>Tổng: {money(preview.totalAmount)}</Typography>
            </Stack>
          </Box>}
        </Stack>}
      </>}
    </DialogContent>
    {!showConfig && !invoice && <DialogActions>
      <Button onClick={onClose} disabled={busy}>Hủy</Button>
      <Button variant="outlined" onClick={runPreview} disabled={busy || !usable || existingConflict || ineligible.length > 0 || !orderIds.length}>Xem trước</Button>
      <Button variant="contained" color="success" onClick={issue} disabled={busy || existingConflict || !preview}>{busy ? <CircularProgress size={20} /> : 'Phát hành & ký HSM'}</Button>
    </DialogActions>}
    {(invoice || (showConfig && (!isAdmin || configOnly))) && <DialogActions><Button onClick={onClose} disabled={busy}>Đóng</Button></DialogActions>}
  </Dialog>
}
