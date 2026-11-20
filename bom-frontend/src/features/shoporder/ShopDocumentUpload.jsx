import React, { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useAppContext } from '../../context/AppContext'
import { readShopBuyerDocument, convertShopBuyerAddress } from '../../api/shopApi'

export function DocumentFileInput({ label, accept, disabled, onFile, onFiles, maxFiles = 1 }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const pick = files => {
    setDragging(false)
    if (disabled) return
    const selected = Array.from(files)
    if (!selected.length || selected.length > maxFiles) { setError(maxFiles === 1 ? 'Chọn một tệp mỗi lần.' : `Chọn từ 1 đến ${maxFiles} tệp của cùng một CCCD.`); return }
    if (selected.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) { setError('Tổng dung lượng tối đa 10 MB.'); return }
    setError(''); if (onFiles) onFiles(selected); else onFile(selected[0])
  }
  return <Box onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files) }} sx={{ p: 1.5, border: '2px dashed', borderColor: dragging ? 'primary.main' : 'divider', borderRadius: 1.5, bgcolor: dragging ? 'action.hover' : 'transparent' }}>
    <Button component="label" disabled={disabled} variant="outlined">{label}<input hidden type="file" accept={accept} multiple={maxFiles > 1} disabled={disabled} onChange={e => { if (e.target.files.length) pick(e.target.files); e.target.value = '' }} /></Button>
    <Typography variant="caption" sx={{ ml: 1 }}>Chọn tệp hoặc kéo thả vào đây · {maxFiles > 1 ? `tối đa ${maxFiles} tệp, tổng 10 MB` : 'tối đa 10 MB'}</Typography>
    {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
  </Box>
}

export default function BuyerCardImport(props) {
  const { tenantId, companyId } = useAppContext()
  return <BuyerCardImportSession key={`${tenantId}:${companyId}`} {...props} />
}

function BuyerCardImportSession({ disabled = false, onApply }) {
  const { tenantId, companyId } = useAppContext()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)
  const [newAddress, setNewAddress] = useState('')
  const [addressMessage, setAddressMessage] = useState('')
  const revision = useRef(0)
  useEffect(() => () => { revision.current++ }, [tenantId, companyId])
  const upload = async files => {
    const requestId = ++revision.current
    setBusy(true); setError(''); setDraft(null); setNewAddress(''); setAddressMessage('')
    try {
      const { res, data } = await readShopBuyerDocument(files, { tenantId, companyId })
      if (requestId !== revision.current) return
      if (!res.ok) throw new Error(data?.message || 'Không đọc được CCCD.')
      setDraft(data)
    } catch (err) { if (requestId === revision.current) setError(err.message) }
    finally { if (requestId === revision.current) setBusy(false) }
  }
  const convert = async () => {
    const requestId = ++revision.current
    setBusy(true); setAddressMessage(''); setNewAddress('')
    try {
      const { res, data } = await convertShopBuyerAddress(draft.buyerAddress, { tenantId, companyId })
      if (requestId !== revision.current) return
      if (!res.ok) throw new Error(data?.message || 'Không chuyển đổi được địa chỉ.')
      setNewAddress(data.converted || '')
      setAddressMessage(data.message || (data.notSure ? 'Địa chỉ có thể chưa chính xác; kiểm tra trước khi dùng.' : 'Kết quả từ diachi.io.'))
    } catch (err) { if (requestId === revision.current) setAddressMessage(err.message) }
    finally { if (requestId === revision.current) setBusy(false) }
  }
  const field = key => e => { setDraft(old => ({ ...old, [key]: e.target.value })); if (key === 'buyerAddress') { setNewAddress(''); setAddressMessage('') } }
  return <Stack spacing={1}>
    <DocumentFileInput label={busy ? 'Đang đọc CCCD…' : 'Đính kèm CCCD để điền người mua'} accept=".docx,.pdf,.png,.jpg,.jpeg" disabled={disabled || busy} onFiles={upload} maxFiles={4} />
    <Typography variant="caption" color="text.secondary">Chọn hoặc kéo thả mặt trước và mặt sau cùng lúc. Nơi thường trú/cư trú có thể ở mặt sau. Ảnh, PDF hoặc Word có ảnh CCCD được gửi đến Google Vision để đọc thông tin.</Typography>
    {busy && <CircularProgress size={22} />}
    {error && <Alert severity="error">{error}</Alert>}
    <Dialog open={Boolean(draft)} onClose={busy ? undefined : () => setDraft(null)} fullWidth maxWidth="sm">
      <DialogTitle>Kiểm tra thông tin từ CCCD</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {(draft?.warnings || []).map((warning, i) => <Alert key={i} severity="warning">{warning}</Alert>)}
        <TextField label="Số CCCD / định danh cá nhân" value={draft?.buyerIdentityNumber || ''} onChange={field('buyerIdentityNumber')} disabled={busy} inputProps={{ maxLength: 12, inputMode: 'numeric' }} />
        <TextField label="Họ tên (CHỮ HOA)" value={draft?.buyerName || ''} onChange={field('buyerName')} disabled={busy} />
        <TextField label="Nơi thường trú / cư trú" value={draft?.buyerAddress || ''} onChange={field('buyerAddress')} disabled={busy} multiline minRows={2} />
        <Stack direction="row" spacing={1}><Button onClick={convert} disabled={busy || !draft?.buyerAddress}>Đổi địa chỉ qua diachi.io</Button><Button component="a" href="https://diachi.io/" target="_blank" rel="noopener noreferrer">Mở diachi.io</Button></Stack>
        {addressMessage && <Alert severity="info">{addressMessage}</Alert>}
        {newAddress && <><TextField label="Địa chỉ mới đề xuất" value={newAddress} onChange={e => setNewAddress(e.target.value)} multiline /><Button onClick={() => { setDraft(old => ({ ...old, buyerAddress: newAddress })); setNewAddress('') }}>Dùng địa chỉ mới</Button></>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setDraft(null)} disabled={busy}>Hủy</Button><Button variant="contained" disabled={busy || !draft?.buyerName?.trim() || !/^\d{12}$/.test(draft?.buyerIdentityNumber || '') || !draft?.buyerAddress?.trim()} onClick={() => { onApply({ buyerName: draft.buyerName.trim().toLocaleUpperCase('vi-VN'), buyerIdentityNumber: draft.buyerIdentityNumber, buyerAddress: draft.buyerAddress.trim() }); setDraft(null) }}>Dùng thông tin người mua</Button></DialogActions>
    </Dialog>
  </Stack>
}
