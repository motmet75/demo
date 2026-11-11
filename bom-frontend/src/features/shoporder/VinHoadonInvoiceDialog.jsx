import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import VoucherQrScanDialog from './VoucherQrScanDialog'
import {parseCccdBuyerQr} from '../../utils/cccdQr'
import { useAppContext } from '../../context/AppContext'
import { lookupBusinessTaxCode } from '../../api/businessTaxApi'
import {
  downloadVinHoadonInvoice, fetchVinHoadonConfig, fetchVinHoadonInvoiceStatuses, fetchVinHoadonTemplates, issueVinHoadonInvoice,
  previewVinHoadonInvoice, retryVinHoadonInvoice, saveVinHoadonConfig, syncVinHoadonInvoice,
  createVinHoadonRelayPairCode,
  readVinHoadonCccdName, suggestVnInvoiceAddress,
  getVnAddressDirectoryStatus, syncVnAddressDirectory,
  listViettelPostAddressProvinces, syncViettelPostAddressProvince,
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
const hasCurrentInvoiceYear = series => {
  const match = String(series || '').match(/^\d?[A-Z](\d{2})/i)
  return !match || match[1] === String(new Date().getFullYear()).slice(-2)
}

function ConfigForm({ config, scope, onSaved, onCancel }) {
  const [form, setForm] = useState({
    enabled: config?.enabled || false, apiEnvironment: config?.apiEnvironment || 'PRODUCTION',
    taxCode: config?.taxCode || '', apiUsername: config?.apiUsername || '', apiPassword: '',
    invoiceTemplateCode: config?.invoiceTemplateCode || '', invoiceSeries: config?.invoiceSeries || '',
    posInvoiceTemplateCode: config?.posInvoiceTemplateCode || '',
    posInvoiceSeries: config?.posInvoiceSeries || '',
    normalInvoiceTemplateCode: config?.normalInvoiceTemplateCode || '',
    normalInvoiceSeries: config?.normalInvoiceSeries || '',
    defaultVatRate: config?.defaultVatRate ?? 8, pricesIncludeVat: config?.pricesIncludeVat !== false,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [relayPair, setRelayPair] = useState(null)
  const change = key => event => setForm(old => ({ ...old, [key]: event.target.value }))
  const clearPair = type => setForm(old => type === 'POS'
    ? { ...old, posInvoiceTemplateCode: '', posInvoiceSeries: '' }
    : { ...old, normalInvoiceTemplateCode: '', normalInvoiceSeries: '' })
  const pairRelay = async () => {
    setBusy(true); setError(''); setRelayPair(null)
    try {
      const { res, data } = await createVinHoadonRelayPairCode()
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể tạo mã ghép VIN-HOADON relay'))
      setRelayPair(data)
      try { await navigator.clipboard.writeText(data.code) } catch { /* Copy manually if browser denies clipboard. */ }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await saveVinHoadonConfig(form, scope)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể lưu cấu hình'))
      onSaved(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Stack spacing={2} sx={{ pt: 1 }}>
    {!config?.encryptionConfigured && <Alert severity="error">Máy chủ chưa có VIN_HOADON_MASTER_KEY (tối thiểu 32 ký tự). Không thể lưu mật khẩu an toàn.</Alert>}
    {!config?.gatewayEnabled && <Alert severity="warning">VIN_HOADON_ENABLED đang là false trên máy chủ. Có thể lưu cấu hình trước, nhưng chưa thể phát hành hóa đơn.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    <FormControlLabel control={<Switch checked={form.enabled} onChange={e => setForm(old => ({ ...old, enabled: e.target.checked }))} />} label="Bật VIN-HOADON cho công ty này" />
    <TextField select label="Môi trường VIN-HOADON" value={form.apiEnvironment} onChange={change('apiEnvironment')}>
      <MenuItem value="PRODUCTION">Thật (ws.vin-hoadon.com)</MenuItem>
      <MenuItem value="DEMO">Demo (demows.vin-hoadon.com)</MenuItem>
    </TextField>
    {form.apiEnvironment === 'DEMO' && <Alert severity="warning">
      Chế độ DEMO: dữ liệu chỉ gửi đến hệ thống thử nghiệm, không phải hóa đơn thật.
    </Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <TextField label="Mã số thuế người bán" value={form.taxCode} onChange={change('taxCode')} required inputProps={{ maxLength: 14 }} />
      <TextField label="Tên đăng nhập VIN-HOADON" value={form.apiUsername} onChange={change('apiUsername')} required />
      <TextField label={config?.passwordConfigured ? 'Mật khẩu mới (để trống để giữ nguyên)' : 'Mật khẩu VIN-HOADON'} value={form.apiPassword} onChange={change('apiPassword')} type="password" required={!config?.passwordConfigured} />
    </Box>
    <Alert severity="info">Một công ty dùng chung tài khoản VIN-HOADON nhưng lưu riêng 2 loại hóa đơn. Ký hiệu thay đổi theo năm và phải được VIN-HOADON đăng ký trước khi sử dụng. Không tự đổi C26 thành C27.</Alert>
    <Typography fontWeight={800}>Hóa đơn khởi tạo từ máy tính tiền (POS)</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <TextField label="Mẫu số POS" value={form.posInvoiceTemplateCode} onChange={change('posInvoiceTemplateCode')} inputProps={{ maxLength: 11 }} helperText="Mẫu số tại VIN-HOADON (ví dụ 1)" />
      <TextField label="Ký hiệu POS" value={form.posInvoiceSeries} onChange={change('posInvoiceSeries')} inputProps={{ maxLength: 8 }} placeholder="2C26MAM" helperText="Nhập nguyên ký hiệu VIN-HOADON cung cấp; hệ thống không giới hạn mẫu ký tự" />
    </Box>
    <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => clearPair('POS')}>Không dùng hóa đơn máy tính tiền</Button>
    <Typography fontWeight={800}>Hóa đơn điện tử thông thường</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
      <TextField label="Mẫu số thông thường" value={form.normalInvoiceTemplateCode} onChange={change('normalInvoiceTemplateCode')} inputProps={{ maxLength: 11 }} helperText="Có thể khác mẫu số POS" />
      <TextField label="Ký hiệu thông thường" value={form.normalInvoiceSeries} onChange={change('normalInvoiceSeries')} inputProps={{ maxLength: 8 }} placeholder="C26TMC" helperText="Nhập đúng ký hiệu đã đăng ký tại VIN-HOADON" />
      <TextField select label="Thuế suất mặc định" value={form.defaultVatRate} onChange={e => setForm(old => ({ ...old, defaultVatRate: Number(e.target.value) }))}>
        {VAT_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </TextField>
    </Box>
    <Button size="small" sx={{ alignSelf: 'flex-start' }} onClick={() => clearPair('NORMAL')}>Không dùng hóa đơn thông thường</Button>
    <Typography variant="caption" color="text.secondary">Cách tính VAT được chọn riêng khi tạo từng hóa đơn, không phụ thuộc cấu hình công ty.</Typography>
    <Typography variant="caption" color="text.secondary">Mật khẩu được mã hóa AES-GCM theo công ty và không bao giờ trả lại trình duyệt.</Typography>
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
      <Typography fontWeight={700}>VIN-HOADON Vietnam Relay</Typography>
      <Typography variant="body2" color="text.secondary">Bấm tạo mã, sau đó mở extension VIN-HOADON Relay trên Chrome tại Việt Nam và dán 8 chữ số.</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
        <Button variant="outlined" onClick={pairRelay} disabled={busy}>Tạo và sao chép mã ghép relay</Button>
        <Button component="a" href="/sapi/downloads/vin-hoadon-relay.zip" download
          startIcon={<DownloadIcon />} variant="outlined">Tải addon Chrome (.zip)</Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Giải nén ZIP, mở chrome://extensions, bật Developer mode rồi chọn Load unpacked và thư mục vừa giải nén.
      </Typography>
      {relayPair?.code && <Alert severity="success" sx={{ mt: 1 }}>
        Mã ghép: <b style={{ letterSpacing: 2 }}>{relayPair.code}</b> · hết hạn lúc {new Date(relayPair.expiresAt * 1000).toLocaleTimeString('vi-VN')}
      </Alert>}
    </Box>
    <DialogActions sx={{ px: 0 }}>
      {onCancel && <Button onClick={onCancel}>Quay lại</Button>}
      <Button variant="contained" onClick={save} disabled={busy || !config?.encryptionConfigured}>{busy ? <CircularProgress size={20} /> : 'Lưu cấu hình'}</Button>
    </DialogActions>
    <AddressDirectoryAdminTools scope={scope} />
  </Stack>
}

function AddressDirectoryAdminTools({ scope }) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [provinces, setProvinces] = useState([])
  const [selectedProvince, setSelectedProvince] = useState('')
  const refreshStatus = async () => {
    const { res, data } = await getVnAddressDirectoryStatus(scope)
    if (!res.ok) throw new Error(messageOf(res, data, 'Chưa tạo bảng danh mục hành chính'))
    setStatus((data?.counts || []).map(x => `${x.source} ${x.type}: ${x.count}`).join(' · ') || 'Danh mục chưa có dữ liệu.')
  }
  const work = async action => {
    setBusy(true); setError(''); setStatus('')
    try {
      const { res, data } = await action()
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể cập nhật danh mục'))
      await refreshStatus()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mt: 2 }}>
    <Typography fontWeight={700}>Danh mục địa chỉ Việt Nam (dùng chung)</Typography>
    <Typography variant="caption" color="text.secondary">
      Chỉ SUPER_ADMIN được nạp dữ liệu. Danh mục hiện hành (2 cấp) tách biệt với dữ liệu giao hàng ViettelPost (3 cấp cũ). Chỉ gợi ý, không tự sửa địa chỉ trên CCCD.
    </Typography>
    {error && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
    {status && <Alert severity="info" sx={{ my: 1 }}>{status}</Alert>}
    <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
      <Button variant="outlined" disabled={busy} onClick={() => work(() => syncVnAddressDirectory(scope))}>
        Nạp tỉnh/phường xã hiện hành
      </Button>
      <Button variant="outlined" disabled={busy} onClick={() => work(async () => {
        const result = await listViettelPostAddressProvinces(scope)
        if (!result.res.ok) return result
        setProvinces(Array.isArray(result.data) ? result.data : [])
        setStatus('Đã tải danh sách tỉnh ViettelPost. Chọn một tỉnh để nhập dữ liệu lịch sử.')
        return result
      })}>
        Chọn tỉnh ViettelPost cũ
      </Button>
      <Button disabled={busy} onClick={() => work(async () => {
        await refreshStatus()
        return { res: { ok: true }, data: {} }
      })}>Kiểm tra dữ liệu</Button>
    </Stack>
    {provinces.length > 0 && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
      <TextField select size="small" label="Tỉnh ViettelPost" sx={{ minWidth: 220 }}
        value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)}>
        {provinces.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
      </TextField>
      <Button disabled={busy || !selectedProvince} onClick={() => work(() => syncViettelPostAddressProvince(selectedProvince, scope))}>
        Nạp dữ liệu tỉnh
      </Button>
    </Stack>}
  </Box>
}

export default function VinHoadonInvoiceDialog({ open, onClose, orders = [], configOnly = false, isAdmin = false, onIssued }) {
  const { tenantId, companyId, companyName } = useAppContext()
  const scope = { tenantId, companyId }
  const [config, setConfig] = useState(null)
  const [showConfig, setShowConfig] = useState(configOnly)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [itemNames, setItemNames] = useState({})
  const [templates, setTemplates] = useState([])
  const [invoiceSeries, setInvoiceSeries] = useState('')
  const [invoiceType, setInvoiceType] = useState('POS')
  const [pricesIncludeVat, setPricesIncludeVat] = useState(true)
  const [templateError, setTemplateError] = useState('')
  const [taxLookupBusy, setTaxLookupBusy] = useState(false)
  const [taxLookupError, setTaxLookupError] = useState('')
  const [cccdBusy, setCccdBusy] = useState(false)
  const [cccdQrOpen,setCccdQrOpen] = useState(false)
  const [cccdError, setCccdError] = useState('')
  const [cccdSuccess, setCccdSuccess] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const lastTaxLookup = useRef('')
  const [invoice, setInvoice] = useState(null)
  const [existingConflict, setExistingConflict] = useState(false)
  const first = orders[0] || {}
  const [buyer, setBuyer] = useState({ buyerTaxCode: '', buyerOrganizationName: '', buyerName: '', buyerAddress: '', buyerPhone: '', buyerEmail: '', paymentMethod: 3, vatRate: 8 })
  const orderIds = useMemo(() => orders.map(order => order.id).filter(Boolean), [orders])
  const orderKey = orderIds.join(',')
  const ineligible = orders.filter(order => order.paymentStatus !== 'PAID' || !['COMPLETED', 'PICKED_UP'].includes(order.status))

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true); setError(''); setConfig(null); setPreview(null); setItemNames({}); setTemplates([]); setInvoiceSeries(''); setInvoiceType('POS'); setPricesIncludeVat(true); setTemplateError(''); setTaxLookupError(''); lastTaxLookup.current = ''; setInvoice(null); setExistingConflict(false); setCccdError(''); setCccdSuccess(''); setShowConfig(configOnly)
    if (!tenantId || !companyId) {
      setError('Chọn tenant và công ty trước khi cấu hình VIN-HOADON.')
      setLoading(false)
      return
    }
    setBuyer({ buyerTaxCode: first.buyerTaxCode || '', buyerOrganizationName: first.buyerOrganizationName || '', buyerName: first.customerName || '', buyerAddress: first.buyerAddress || first.deliveryAddress || '', buyerPhone: first.buyerPhone || first.customerPhone || '', buyerEmail: first.buyerEmail || '', paymentMethod: 3, vatRate: 8 })
    const currentScope = { tenantId, companyId }
    Promise.all([fetchVinHoadonConfig(currentScope), configOnly || !orderIds.length ? Promise.resolve(null) : fetchVinHoadonInvoiceStatuses(orderIds, currentScope)]).then(([{ res, data }, statuses]) => {
      if (!active) return
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể tải cấu hình VIN-HOADON'))
      setConfig(data);
      setInvoiceType(data.posInvoiceSeries ? 'POS' : 'NORMAL');
      setInvoiceSeries(data.posInvoiceSeries || data.normalInvoiceSeries || '');
      setBuyer(old => ({ ...old, vatRate: data.defaultVatRate ?? 8 }))
      if (data.configured && data.enabled && data.gatewayEnabled) fetchVinHoadonTemplates(currentScope).then(result => {
        if (!active) return
        if (!result.res.ok) throw new Error(messageOf(result.res, result.data, 'Không thể tải ký hiệu hóa đơn'))
        setTemplates(Array.isArray(result.data) ? result.data : [])
      }).catch(err => { if (active) setTemplateError(err.message) })
      if (statuses && !statuses.res.ok) throw new Error(messageOf(statuses.res, statuses.data, 'Không thể tải trạng thái hóa đơn'))
      const existing = Object.values(statuses?.data || {})
      if (existing.length && existing.length === orderIds.length && existing.every(item => item.id === existing[0].id)) setInvoice(existing[0])
      else if (existing.length) { setExistingConflict(true); setError('Một số đơn đã thuộc hóa đơn VIN-HOADON khác. Chọn riêng các đơn thuộc cùng một hóa đơn.') }
      if (configOnly || !data.configured) setShowConfig(true)
    }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, configOnly, first.id, orderKey, tenantId, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const payload = () => ({ orderIds, ...buyer, paymentMethod: Number(buyer.paymentMethod), vatRate: Number(buyer.vatRate), itemNames, invoiceSeries, invoiceType, pricesIncludeVat })
  const invalidItemName = Object.values(itemNames).some(name => !name.trim() || name.length > 255)
  const lineIdsAvailable = !preview || preview.lines.every(line => Boolean(line.lineId))
  const runPreview = async () => {
    setBusy(true); setError(''); setInvoice(null)
    try {
      const { res, data } = await previewVinHoadonInvoice(payload(), scope)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể xem trước hóa đơn'))
      setPreview(data)
    } catch (err) { setError(err.message); setPreview(null) } finally { setBusy(false) }
  }
  const issue = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await issueVinHoadonInvoice(payload(), scope)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể gửi hóa đơn sang VIN-HOADON'))
      setInvoice(data); setPreview(null); onIssued?.(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const retry = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await retryVinHoadonInvoice(invoice.id, invoiceType, scope)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể thử lại'))
      setInvoice(data); onIssued?.(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const sync = async () => {
    setBusy(true); setError('')
    try {
      const { res, data } = await syncVinHoadonInvoice(invoice.id, scope)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể tra cứu hóa đơn'))
      setInvoice(data); onIssued?.(data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const field = key => event => { setBuyer(old => ({ ...old, [key]: event.target.value })); setPreview(null) }
  // Debounced local PostgreSQL lookup; does not send customer address to
  // third-party providers. Suggestions are only applied after a user click.
  useEffect(() => {
    const value = buyer.buyerAddress.trim()
    if (!open || value.length < 6 || !tenantId || !companyId) {
      setAddressSuggestions([])
      return
    }
    let cancelled = false
    const timeout = setTimeout(async () => {
      try {
        const { res, data } = await suggestVnInvoiceAddress(value, { tenantId, companyId })
        if (!cancelled) setAddressSuggestions(res.ok && Array.isArray(data)
          ? data.filter(item => item.suggestedAddress && item.suggestedAddress !== value).slice(0, 5) : [])
      } catch { if (!cancelled) setAddressSuggestions([]) }
    }, 450)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [open, buyer.buyerAddress, tenantId, companyId])
  const onCccdQrScan = raw => {
    setCccdQrOpen(false)
    const decoded = parseCccdBuyerQr(raw)
    if (!decoded) {
      setCccdSuccess('')
      setCccdError('Mã QR không đúng cấu trúc CCCD/Căn cước Việt Nam. Không tự điền thông tin. Vui lòng chụp ảnh CCCD hoặc nhập thủ công.')
      return
    }
    setBuyer(old => ({
      ...old, buyerName: decoded.fullName,
      buyerAddress: decoded.buyerAddress,
    }))
    setPreview(null)
    setCccdError('')
    setCccdSuccess('Đã điền tên và địa chỉ từ QR CCCD. Hãy kiểm tra trước khi gửi hóa đơn.')
  }

  const scanCccd = async event => {
    const images = Array.from(event.target.files || [])
    event.target.value = ''
    if (!images.length) return
    setCccdError(''); setCccdSuccess('')
    if (images.length > 2 || images.some(image =>
      !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024)) {
      setCccdError('Chọn tối đa 2 ảnh JPG, PNG hoặc WebP (mặt trước + mặt sau), mỗi ảnh tối đa 5 MB.')
      return
    }
    setCccdBusy(true)
    try {
      const { res, data } = await readVinHoadonCccdName(images, scope)
      if (!res.ok) throw new Error(messageOf(res, data, 'Không thể nhận dạng CCCD'))
      const fullName = String(data?.fullName || '').trim()
      const address = String(data?.buyerAddress || '').trim()
      if (!data?.recognized || (!fullName && !address)) {
        setCccdError('Không đọc được họ tên hoặc nơi thường trú/cư trú. Chụp rõ hai mặt và kiểm tra thủ công.')
        return
      }
      setBuyer(old => ({
        ...old,
        buyerName: fullName || old.buyerName,
        buyerAddress: address || old.buyerAddress,
      }))
      setPreview(null)
      setCccdSuccess('Đã nhận dạng ' + [
        fullName ? 'họ tên' : '',
        address ? 'địa chỉ thường trú/cư trú' : '',
      ].filter(Boolean).join(' và ') + '. Vui lòng kiểm tra thông tin trước khi gửi hóa đơn.')
      if (address && data?.addressComplete === false) {
        setCccdError('OCR chưa xác định được tỉnh/thành phố ở cuối địa chỉ. Có thể còn thiếu một dòng: vui lòng kiểm tra và bổ sung trước khi xuất hóa đơn.')
      }
    } catch (error) {
      setCccdError(error.message || 'Không thể nhận dạng ảnh CCCD.')
    } finally {
      setCccdBusy(false)
    }
  }

  const lookupTax = async (force = false) => {
    const taxCode = buyer.buyerTaxCode.trim()
    if (!taxCode || (!force && taxCode === lastTaxLookup.current)) return
    if (!/^\d{10}(?:-\d{3})?$/.test(taxCode)) {
      if (force) setTaxLookupError('Nhập mã số thuế hợp lệ để tra cứu.')
      return
    }
    setTaxLookupBusy(true); setTaxLookupError('')
    try {
      const result = await lookupBusinessTaxCode(taxCode)
      setBuyer(old => old.buyerTaxCode.trim() === taxCode ? { ...old, buyerOrganizationName: result.name, buyerAddress: result.address } : old)
      if (result.status && !/đang hoạt động/i.test(result.status)) setTaxLookupError(`Trạng thái MST: ${result.status}. Kiểm tra với người mua trước khi gửi hóa đơn.`)
      lastTaxLookup.current = taxCode
      setPreview(null)
    } catch (err) { setTaxLookupError(err.message) } finally { setTaxLookupBusy(false) }
  }
  const usable = config?.configured && config?.enabled && config?.gatewayEnabled && config?.encryptionConfigured
  const validYear = Boolean(invoiceSeries && hasCurrentInvoiceYear(invoiceSeries))
  const selectedConfigured = Boolean(invoiceSeries && (
    (invoiceType === 'POS' && invoiceSeries === config?.posInvoiceSeries && config?.posInvoiceTemplateCode) ||
    (invoiceType === 'NORMAL' && invoiceSeries === config?.normalInvoiceSeries && config?.normalInvoiceTemplateCode)
  ))
  const registeredMatch = !templates.length || templates.some(option =>
    option.series === invoiceSeries && option.templateCode === (invoiceType === 'POS' ? config?.posInvoiceTemplateCode : config?.normalInvoiceTemplateCode))
  const readyToSend = usable && selectedConfigured && validYear && registeredMatch

  return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
    <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      {showConfig ? <SettingsIcon color="primary" /> : <ReceiptLongIcon color="primary" />}
      {showConfig ? 'Cấu hình VIN-HOADON' : `NGƯỜI MUA HÀNG · ${orders.length} đơn`}
    </DialogTitle>
    <DialogContent dividers>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Cấu hình riêng cho công ty: {companyName || companyId || 'chưa chọn'}</Typography>
      {loading ? <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress /></Box> : <>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {showConfig ? (
          isAdmin ? <ConfigForm config={config || {}} scope={scope} onSaved={saved => {
              setConfig(saved)
              const nextType = saved.posInvoiceSeries ? 'POS' : 'NORMAL'
              setInvoiceType(nextType)
              setInvoiceSeries(nextType === 'POS' ? saved.posInvoiceSeries : saved.normalInvoiceSeries || '')
              setPreview(null)
              if (!configOnly) setShowConfig(false)
            }} onCancel={!configOnly && config?.configured ? () => setShowConfig(false) : null} />
            : <Alert severity="warning">Chỉ quản trị viên hoặc người dùng nghiệp vụ đầy đủ có thể cấu hình VIN-HOADON.</Alert>
        ) : invoice ? (
          <Stack spacing={2}>
            <Alert severity={invoice.status === 'ISSUED' ? 'success' : invoice.status === 'FAILED' ? 'error' : 'warning'}>
              {invoice.status === 'ISSUED' ? 'Hóa đơn đã được ký.' : invoice.status === 'DRAFT' ? 'Đã gửi hóa đơn chưa ký lên VIN-HOADON. Kiểm tra danh sách hóa đơn trên VIN-HOADON và ký tại đó khi sẵn sàng.' : invoice.status === 'PENDING' ? 'VIN-HOADON đã nhận hóa đơn; đang chờ ký hoặc cấp số.' : invoice.status === 'RECONCILE' ? 'Chưa xác nhận được kết quả. Tra cứu trước khi thử gửi lại.' : `Gửi hóa đơn chưa thành công: ${invoice.resultMessage || 'Lỗi VIN-HOADON'}`}
            </Alert>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip label={invoice.status} color={invoice.status === 'ISSUED' ? 'success' : invoice.status === 'DRAFT' ? 'info' : 'warning'} />
              <Chip label={invoice.apiEnvironment === 'DEMO' ? 'DEMO' : 'THẬT'} color={invoice.apiEnvironment === 'DEMO' ? 'warning' : 'primary'} variant="outlined" />
              <b>{invoice.invoiceSeries || ''} {invoice.invoiceNumber || invoice.externalInvoiceId}</b>
            </Box>
            <Typography variant="body2">Mẫu số đã gửi: <b>{invoice.invoiceTemplateCode || '—'}</b> · Ký hiệu: <b>{invoice.invoiceSeries || '—'}</b></Typography>
            <Typography>Tổng thanh toán: <b>{money(invoice.totalAmount)}</b></Typography>
            {invoice.taxAuthorityStatus != null && <Typography>Trạng thái cơ quan thuế: {({ 0: 'Chờ xác nhận', 1: 'Đã xác nhận', 2: 'Từ chối' })[invoice.taxAuthorityStatus] || invoice.taxAuthorityStatus}</Typography>}
            {invoice.status === 'ISSUED' ? <Stack direction="row" spacing={1}>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => downloadVinHoadonInvoice(invoice.id, 'pdf', scope).catch(err => setError(err.message))}>Tải PDF</Button>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => downloadVinHoadonInvoice(invoice.id, 'xml', scope).catch(err => setError(err.message))}>Tải XML</Button>
              <Button variant="outlined" onClick={sync} disabled={busy}>Cập nhật trạng thái thuế</Button>
            </Stack> : <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={sync} disabled={busy}>Tra cứu hóa đơn</Button>
              {!['PENDING', 'DRAFT'].includes(invoice.status) && <Button variant="contained" color="warning" onClick={retry} disabled={busy}>Thử lại cùng mã hóa đơn</Button>}
            </Stack>}
          </Stack>
        ) : <Stack spacing={2}>
          {config?.apiEnvironment === 'DEMO' && <Alert severity="warning">Đang dùng VIN-HOADON DEMO cho công ty này. Hóa đơn sẽ không được gửi sang hệ thống thật.</Alert>}
          {!usable && <Alert severity="warning" action={isAdmin ? <Button color="inherit" onClick={() => setShowConfig(true)}>Cấu hình</Button> : null}>VIN-HOADON chưa sẵn sàng cho công ty này.</Alert>}
          {templateError && <Alert severity="warning">{templateError}. Kiểm tra ký hiệu đã đăng ký trên VIN-HOADON trước khi gửi.</Alert>}
          {!readyToSend && usable && <Alert severity="warning">Chưa cấu hình ký hiệu {invoiceType === 'POS' ? 'máy tính tiền' : 'thông thường'} hợp lệ cho năm hiện tại. Cần cập nhật cấu hình trước khi lập hóa đơn.</Alert>}
          {ineligible.length > 0 && <Alert severity="error">Chỉ được chọn đơn đã thanh toán và có trạng thái Hoàn tất/Đã giao. Có {ineligible.length} đơn chưa đủ điều kiện.</Alert>}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{orders.map(order => <Chip key={order.id} label={`#${order.orderNumber || order.orderCode} · ${money(Number(order.totalAmount || 0) - Number(order.discountAmount || 0))}`} />)}</Box>
          <Divider />
          <Typography fontWeight={800}>Thông tin người mua</Typography>
          <TextField select label="Loại hóa đơn" value={invoiceType} onChange={event => {
            const type = event.target.value
            setInvoiceType(type)
            setInvoiceSeries(type === 'POS' ? config?.posInvoiceSeries || '' : config?.normalInvoiceSeries || '')
            setPreview(null)
          }} helperText="Loại hóa đơn được chọn theo nghiệp vụ POS hoặc thông thường, không theo người mua.">
            <MenuItem value="POS">Máy tính tiền (POS) · {config?.posInvoiceSeries || 'Chưa cấu hình'}</MenuItem>
            <MenuItem value="NORMAL">Hóa đơn thông thường · {config?.normalInvoiceSeries || 'Chưa cấu hình'}</MenuItem>
          </TextField>
          <Typography variant="body2">Mẫu số: <b>{invoiceType === 'POS' ? config?.posInvoiceTemplateCode || '—' : config?.normalInvoiceTemplateCode || '—'}</b> · Ký hiệu: <b>{invoiceSeries || '—'}</b></Typography>
          {Array.isArray(templates) && templates.length > 0 && invoiceSeries && !templates.some(option => option.series === invoiceSeries && option.templateCode === (invoiceType === 'POS' ? config?.posInvoiceTemplateCode : config?.normalInvoiceTemplateCode)) &&
            <Alert severity="warning">Ký hiệu hoặc Mẫu số đã lưu chưa khớp với danh sách VIN-HOADON. Vui lòng kiểm tra trước khi gửi.</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <TextField label="Mã số thuế người mua" fullWidth value={buyer.buyerTaxCode} onChange={field('buyerTaxCode')} inputProps={{ maxLength: 14 }} />
              <Button variant="outlined" onClick={() => lookupTax(true)} disabled={taxLookupBusy || !buyer.buyerTaxCode.trim()} sx={{ whiteSpace: 'nowrap', mt: 1 }}>{taxLookupBusy ? 'Đang tra...' : 'Tra cứu MST'}</Button>
            </Box>
            <TextField label="Tên đơn vị / tổ chức" fullWidth multiline minRows={2} maxRows={4}
              value={buyer.buyerOrganizationName} onChange={field('buyerOrganizationName')} />
            <Box sx={{gridColumn:'1 / -1',minWidth:0}}>
              <TextField label="Người mua hàng" fullWidth multiline minRows={2} maxRows={5}
                value={buyer.buyerName} onChange={field('buyerName')}
                inputProps={{maxLength:255}}
                helperText="Tên dài sẽ xuống dòng, có thể sửa trực tiếp." />
              <Stack direction={{xs:'column',sm:'row'}} gap={1} sx={{mt:1}}>
                <Button variant="outlined" fullWidth startIcon={<QrCodeScannerIcon/>}
                  onClick={()=>setCccdQrOpen(true)} disabled={busy||cccdBusy}
                  sx={{minHeight:46,textTransform:'none'}}>Quét QR CCCD bằng camera</Button>
                <Button component="label" fullWidth variant="outlined"
                  startIcon={cccdBusy?<CircularProgress size={16}/>:<BadgeOutlinedIcon/>}
                  disabled={busy||cccdBusy} sx={{minHeight:46,textTransform:'none'}}>
                  {cccdBusy?'Đang đọc...':'Tải 1–2 ảnh CCCD'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={scanCccd}/>
                </Button>
              </Stack>
            </Box>
            <TextField label="Địa chỉ xuất hóa đơn" value={buyer.buyerAddress} onChange={field('buyerAddress')} multiline minRows={2} />
            {addressSuggestions.length > 0 && <Box sx={{ gridColumn: '1 / -1' }}>
              <Typography variant="caption" color="text.secondary">
                Gợi ý chuẩn hóa địa chỉ (không dấu / TP / HCM). Bấm để áp dụng, giữ nguyên phần thôn/đường đã nhận dạng.
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {addressSuggestions.map(item => <Button key={item.source + ':' + item.wardCode}
                  variant="outlined" size="small" sx={{ justifyContent: 'flex-start', textTransform: 'none', whiteSpace: 'normal', textAlign: 'left' }}
                  onClick={() => { setBuyer(old => ({ ...old, buyerAddress: item.suggestedAddress })); setPreview(null); setAddressSuggestions([]) }}>
                  {item.suggestedAddress}{item.historical ? ' (ViettelPost - địa chỉ cũ)' : ' (Danh mục 2 cấp)'}
                </Button>)}
              </Stack>
            </Box>}
            <TextField label="Số điện thoại" value={buyer.buyerPhone} onChange={field('buyerPhone')} />
            <TextField label="Email nhận hóa đơn" value={buyer.buyerEmail} onChange={field('buyerEmail')} type="email" />
            <TextField select label="Hình thức thanh toán" value={buyer.paymentMethod} onChange={field('paymentMethod')}>{PAYMENT_OPTIONS.map(x => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</TextField>
            <TextField select label="Thuế suất" value={buyer.vatRate} onChange={field('vatRate')}>{VAT_OPTIONS.map(x => <MenuItem key={x.value} value={x.value}>{x.label}</MenuItem>)}</TextField>
          </Box>
          <FormControlLabel control={<Switch checked={pricesIncludeVat} onChange={event => { setPricesIncludeVat(event.target.checked); setPreview(null) }} />} label="Giá trị đơn hàng đã bao gồm VAT" />
          <Alert severity={pricesIncludeVat ? 'info' : 'warning'} sx={{ mb: 1 }}>
            {pricesIncludeVat
              ? 'Giá đã bao gồm VAT: tách VAT từ số tiền đơn hàng, giữ nguyên tổng tiền thanh toán.'
              : 'Giá chưa bao gồm VAT: tính VAT cộng thêm vào giá trị đơn hàng; tổng tiền trên hóa đơn có thể cao hơn số tiền khách đã thanh toán. Vui lòng xác nhận với khách trước khi gửi.'}
          </Alert>
          <Typography variant="caption" color="text.secondary">Chọn một hoặc hai ảnh mặt trước/mặt sau của CÙNG một CCCD. Google Vision gợi ý họ tên và nơi thường trú/cư trú (có thể trải trên hai dòng). Ảnh không được lưu cùng hóa đơn. Kiểm tra kỹ trước khi gửi.</Typography>
          {cccdError && <Alert severity="warning">{cccdError}</Alert>}
          {cccdSuccess && <Alert severity="success">{cccdSuccess}</Alert>}
          {taxLookupError && <Alert severity="warning">{taxLookupError}. Bạn có thể nhập tên và địa chỉ thủ công.</Alert>}
          {preview && !lineIdsAvailable && <Alert severity="error">Máy chủ cần cập nhật để sửa tên hàng trước khi gửi hóa đơn.</Alert>}
          {preview && <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ p: 1.5, bgcolor: 'grey.50' }}>
              <Typography fontWeight={800}>Hóa đơn nháp · Mẫu số {preview.invoiceTemplateCode} · Ký hiệu {preview.invoiceSeries}</Typography>
              <Typography variant="body2">Người mua: {buyer.buyerOrganizationName || buyer.buyerName || '—'}{buyer.buyerTaxCode ? ` · MST ${buyer.buyerTaxCode}` : ''}</Typography>
              <Typography variant="body2">Địa chỉ: {buyer.buyerAddress || '—'}</Typography>
              <Typography variant="body2">Điện thoại: {buyer.buyerPhone || '—'} · Email: {buyer.buyerEmail || '—'}</Typography>
            </Box>
            {/* On narrow screens, avoid a 930px-wide table: the product name
                must wrap and remain fully editable without horizontal clipping. */}
            <Stack spacing={1} sx={{ p: 1, display: { xs: 'flex', md: 'none' } }}>
              {preview.lines.map((line, index) => <Box key={line.lineId || index}
                sx={{ minWidth: 0, p: 1.5, border: '1px solid', borderColor: 'divider',
                  borderRadius: 1.5, bgcolor: 'background.paper' }}>
                <TextField size="small" fullWidth multiline minRows={3} maxRows={10}
                  label="Tên hàng trên hóa đơn"
                  disabled={!line.lineId}
                  value={itemNames[line.lineId] ?? line.name}
                  onChange={event => setItemNames(old => ({
                    ...old, [line.lineId]: event.target.value
                  }))}
                  error={itemNames[line.lineId] != null && !itemNames[line.lineId].trim()}
                  inputProps={{ maxLength: 255 }}
                  helperText="Tên dài tự xuống dòng. Bạn có thể sửa trước khi gửi hóa đơn."
                  sx={{ minWidth: 0, '& textarea': {
                    overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                  } }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  columnGap: 2, rowGap: 1, mt: 1.5, minWidth: 0 }}>
                  <Box><Typography variant="caption" color="text.secondary">Số lượng</Typography>
                    <Typography fontWeight={700}>{line.quantity}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Đơn giá trước thuế</Typography>
                    <Typography fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{money(line.unitPriceBeforeTax)}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">VAT</Typography>
                    <Typography>{line.vatRate < 0
                      ? VAT_OPTIONS.find(option => option.value === line.vatRate)?.label
                      : `${line.vatRate}%`}</Typography></Box>
                  <Box><Typography variant="caption" color="text.secondary">Tiền thuế</Typography>
                    <Typography sx={{ overflowWrap: 'anywhere' }}>{money(line.taxAmount)}</Typography></Box>
                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <Typography variant="caption" color="text.secondary">Thành tiền</Typography>
                    <Typography fontWeight={800}>{money(line.total)}</Typography>
                  </Box>
                </Box>
              </Box>)}
            </Stack>
            {/* Keep the existing wide invoice grid on desktop, with a multiline
                product editor for names up to the 255-character invoice limit. */}
            <Box sx={{ overflowX: 'auto', display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ minWidth: 930, display: 'grid',
                gridTemplateColumns: 'minmax(250px, 2fr) 70px 120px 90px 120px 130px',
                gap: 1, p: 1, bgcolor: 'grey.100', fontWeight: 800 }}>
                <span>Hàng hóa</span><span>SL</span><span>Đơn giá trước thuế</span>
                <span>VAT</span><span>Tiền thuế</span><span>Thành tiền</span>
              </Box>
              {preview.lines.map((line, index) => <Box key={line.lineId || index}
                sx={{ minWidth: 930, display: 'grid',
                  gridTemplateColumns: 'minmax(250px, 2fr) 70px 120px 90px 120px 130px',
                  gap: 1, p: 1, alignItems: 'start', borderTop: '1px solid',
                  borderColor: 'divider' }}>
                <TextField size="small" fullWidth multiline minRows={2} maxRows={7}
                  disabled={!line.lineId} label="Tên hàng trên hóa đơn"
                  value={itemNames[line.lineId] ?? line.name}
                  onChange={event => setItemNames(old => ({
                    ...old, [line.lineId]: event.target.value
                  }))}
                  error={itemNames[line.lineId] != null && !itemNames[line.lineId].trim()}
                  inputProps={{ maxLength: 255 }}
                  sx={{ minWidth: 0, '& textarea': { overflowWrap: 'anywhere',
                    wordBreak: 'break-word' } }} />
                <span>{line.quantity}</span><span>{money(line.unitPriceBeforeTax)}</span>
                <span>{line.vatRate < 0
                  ? VAT_OPTIONS.find(option => option.value === line.vatRate)?.label
                  : `${line.vatRate}%`}</span>
                <span>{money(line.taxAmount)}</span><b>{money(line.total)}</b>
              </Box>)}
            </Box>
            <Stack sx={{ p: 1.5, borderTop: '2px solid', borderColor: 'divider', alignItems: 'flex-end' }}>
              <Typography>Giá đầu vào: {preview.pricesIncludeVat ? 'Đã gồm VAT' : 'Chưa gồm VAT'}</Typography>
              <Typography>Tiền trước thuế: {money(preview.subtotal)}</Typography><Typography>Thuế: {money(preview.taxAmount)}</Typography><Typography variant="h6" fontWeight={900}>Tổng tiền hóa đơn: {money(preview.totalAmount)}</Typography>
            </Stack>
          </Box>}
        </Stack>}
      </>}
    </DialogContent>
    {!showConfig && !invoice && <DialogActions>
      <Button onClick={onClose} disabled={busy}>Hủy</Button>
      <Button variant="outlined" onClick={runPreview} disabled={busy || !readyToSend || existingConflict || ineligible.length > 0 || !orderIds.length}>Xem trước</Button>
      <Button variant="contained" color="success" onClick={issue} disabled={busy || !readyToSend || existingConflict || !preview || !lineIdsAvailable || invalidItemName}>{busy ? <CircularProgress size={20} /> : 'Gửi sang VIN-HOADON (chưa ký)'}</Button>
    </DialogActions>}
    {(invoice || (showConfig && (!isAdmin || configOnly))) && <DialogActions><Button onClick={onClose} disabled={busy}>Đóng</Button></DialogActions>}
    <VoucherQrScanDialog open={cccdQrOpen} enableZoom
      title="Quét QR trên CCCD / Căn cước"
      scannerLabel="Hướng camera vào mã QR trên thẻ; cũng có thể chọn ảnh từ thư viện"
      manualLabel="Dán nội dung QR CCCD nếu camera không quét được"
      onClose={()=>setCccdQrOpen(false)}
      onScan={onCccdQrScan}/>
  </Dialog>
}
