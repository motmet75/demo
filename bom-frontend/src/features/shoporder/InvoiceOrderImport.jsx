import React, { useEffect, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { useAppContext } from '../../context/AppContext'
import { readShopInvoiceDocument } from '../../api/shopApi'
import { DocumentFileInput } from './ShopDocumentUpload'

const normalize = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim()
function matchInvoiceModel(line, models) {
  const code = normalize(line.code)
  const byCode = code ? models.filter(model => normalize(model.modelCode) === code) : []
  if (byCode.length === 1) return byCode[0]
  const byName = models.filter(model => normalize(model.modelName) === normalize(line.description))
  return byName.length === 1 ? byName[0] : null
}

export default function InvoiceOrderImport(props) {
  const { tenantId, companyId } = useAppContext()
  return <InvoiceOrderImportSession key={`${tenantId}:${companyId}`} {...props} />
}

function InvoiceOrderImportSession({ models, disabled, onApply }) {
  const { tenantId, companyId } = useAppContext()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [fillBuyer, setFillBuyer] = useState(false)
  const revision = useRef(0)
  useEffect(() => () => { revision.current++ }, [tenantId, companyId])
  const upload = async file => {
    const requestId = ++revision.current
    setBusy(true); setError(''); setDraft(null); setFillBuyer(false)
    try {
      const { res, data } = await readShopInvoiceDocument(file, { tenantId, companyId })
      if (requestId !== revision.current) return
      if (!res.ok) throw new Error(data?.message || 'Không đọc được hóa đơn.')
      setDraft({ ...data, source: file.name, rows: (data.items || []).map(line => ({ ...line, model: matchInvoiceModel(line, models), displayName: line.description || '', quantity: line.quantity || '', price: line.unitPrice || '' })) })
    } catch (err) { if (requestId === revision.current) setError(err.message) }
    finally { if (requestId === revision.current) setBusy(false) }
  }
  const change = (index, key, value) => setDraft(old => ({ ...old, rows: old.rows.map((row, i) => i === index ? { ...row, [key]: value } : row) }))
  const valid = draft?.rows?.length > 0 && draft.rows.every(row => row.model && row.displayName.trim() && row.displayName.length <= 255 && Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0 && String(row.price).trim() !== '' && Number.isFinite(Number(row.price)) && Number(row.price) >= 0)
  const apply = () => {
    onApply({ source: draft.source, items: draft.rows.map(row => ({ uid: crypto.randomUUID(), modelId: row.model.id, modelName: row.displayName.trim(), sellingPrice: row.model.sellingPrice, customPriceDigits: String(row.price), qty: Number(row.quantity), selectedOptions: {}, itemNotes: '', sideItems: [] })),
      buyer: fillBuyer ? { buyerOrganizationName: draft.fields?.buyerTaxId ? draft.fields?.buyer || '' : '', buyerTaxCode: draft.fields?.buyerTaxId || '', buyerName: draft.fields?.buyerName || draft.fields?.buyer || '', buyerAddress: draft.fields?.buyerAddress || '' } : null })
    setDraft(null)
  }
  return <Stack spacing={1}>
    <DocumentFileInput label={busy ? 'Đang đọc hóa đơn…' : 'Nhập hóa đơn để lập đơn xuất kho'} accept=".xml,.pdf,.png,.jpg,.jpeg" onFile={upload} disabled={disabled || busy} />
    <Typography variant="caption" color="text.secondary">XML, PDF hoặc ảnh. Ghép từng dòng với hàng trong cửa hàng; kiểm tra rồi thêm vào đơn. Ảnh và PDF quét được đọc bằng Google Vision.</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    <Dialog open={Boolean(draft)} onClose={() => setDraft(null)} fullWidth maxWidth="lg">
      <DialogTitle>Kiểm tra hóa đơn trước khi lập đơn xuất kho</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Alert severity="info">Đơn vẫn là bản nháp sau bước này. Kho được trừ theo luồng xác nhận/xử lý đơn hiện có. Kiểm tra đơn vị tính, số lượng và giá bán đã gồm/chưa gồm VAT.</Alert>
        {(draft?.warnings || []).map((warning, i) => <Alert key={i} severity="warning">{warning}</Alert>)}
        {draft?.rows.map((row, index) => <Box key={index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 2fr 1fr 1fr auto' }, gap: 1, alignItems: 'start' }}>
          <TextField label={`Tên trên đơn · dòng ${index + 1}`} value={row.displayName} onChange={e => change(index, 'displayName', e.target.value)} inputProps={{ maxLength: 255 }} helperText={`ĐVT hóa đơn: ${row.unit || 'chưa rõ'}`} />
          <Autocomplete options={models} value={row.model} isOptionEqualToValue={(a, b) => a.id === b.id} getOptionLabel={model => `${model.modelCode || ''} ${model.modelName}`.trim()} onChange={(_, model) => change(index, 'model', model)} renderInput={params => <TextField {...params} label="Hàng để trừ kho" error={!row.model} helperText={row.model ? `ĐVT hàng: ${row.model.unit || row.model.unitName || 'kiểm tra danh mục'}` : 'Chọn hàng tương ứng'} />} />
          <TextField label="Số lượng" type="number" value={row.quantity} onChange={e => change(index, 'quantity', e.target.value)} inputProps={{ min: 0.0001, step: 'any' }} />
          <TextField label="Đơn giá bán" type="number" value={row.price} onChange={e => change(index, 'price', e.target.value)} inputProps={{ min: 0, step: 'any' }} />
          <Button color="error" onClick={() => setDraft(old => ({ ...old, rows: old.rows.filter((_, i) => i !== index) }))}>Bỏ dòng</Button>
        </Box>)}
        {draft?.fields?.buyer && <FormControlLabel control={<Checkbox checked={fillBuyer} onChange={e => setFillBuyer(e.target.checked)} />} label={`Điền người mua từ hóa đơn: ${draft.fields.buyer}`} />}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDraft(null)}>Hủy</Button><Button variant="contained" disabled={!valid} onClick={apply}>Thêm {draft?.rows.length || 0} dòng vào đơn</Button></DialogActions>
    </Dialog>
  </Stack>
}
