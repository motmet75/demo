import React, { useMemo, useState } from 'react'
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { cashTenderSuggestions, formatIntegerInput, formatVietnameseIntegerInput, moneyInputSuggestions, parseIntegerInput } from '../../utils/numberInput'

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ'
const numericValue = value => Number(String(value || '').replace(/[^0-9]/g, ''))
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function PaymentMethodConfirmDialog({ open, order, action = 'paid', busy = false, tables = [], onCancel, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('')
  const [qrInput, setQrInput] = useState('')
  const [cashReceived, setCashReceived] = useState('')
  const [showCashChange, setShowCashChange] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState(order?.tableId || '')

  const finishing = action === 'complete'
  const printing = action === 'print'
  const clearing = action === 'clear'
  const alreadyPaid = finishing && order?.paymentStatus === 'PAID'
  const payLater = paymentMethod === 'PAY_LATER'
  const total = useMemo(() => Math.max(0, Number(order?.totalAmount || 0) - Number(order?.discountAmount || 0)), [order])
  const qrAmount = numericValue(qrInput)
  const cashAmount = Math.max(0, total - qrAmount)
  const receivedAmount = numericValue(cashReceived)
  const changeAmount = receivedAmount - total
  const splitInvalid = paymentMethod === 'SPLIT' && (qrAmount <= 0 || qrAmount >= total)
  const suggestions = moneyInputSuggestions(qrInput, total)
  const availableTables = (Array.isArray(tables) ? tables : []).filter(table => table?.id && table.isActive !== false)
  const tableOptions = order?.tableId && !availableTables.some(table => String(table.id) === String(order.tableId))
    ? [{ id: order.tableId, tableName: order.tableName || `Bàn ${order.tableId}` }, ...availableTables]
    : availableTables
  const selectedTable = tableOptions.find(table => String(table.id) === String(selectedTableId)) || null

  const title = printing ? 'Chọn thanh toán trước khi in hóa đơn' : clearing ? 'Thanh toán & dọn bàn' : finishing ? 'Hoàn tất & trả món' : 'Xác nhận đã thanh toán'
  const submit = () => onConfirm(alreadyPaid
    ? { paymentMethod: null, splitCashAmount: null, tableId: selectedTableId || null }
    : { paymentMethod, splitCashAmount: paymentMethod === 'SPLIT' ? cashAmount : null, splitQrAmount: paymentMethod === 'SPLIT' ? qrAmount : null, tableId: selectedTableId || null })

  return <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="xs">
    <DialogTitle>{title}</DialogTitle>
    <DialogContent sx={{ pt: '10px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity={alreadyPaid ? 'success' : payLater ? 'warning' : 'info'}>
        {alreadyPaid
          ? 'Đơn đã thanh toán. Xác nhận hoàn tất và trả món cho khách.'
          : printing
          ? 'Chọn cách khách dự kiến thanh toán để in đúng hóa đơn. Bạn vẫn có thể đổi trước khi xác nhận đã thanh toán.'
          : payLater
          ? finishing
            ? 'Món được đánh dấu đã phục vụ nhưng đơn vẫn chưa thanh toán và tiếp tục nằm tại bàn cho đến khi khách trả tiền.'
            : 'Đơn vẫn ở trạng thái chưa thanh toán. Bạn có thể thu tiền sau.'
          : 'Chưa chọn sẵn phương thức. Nhân viên cần xác nhận đúng cách khách thanh toán.'}
      </Alert>
      <Typography fontWeight={800}>Đơn #{order?.orderNumber ?? order?.dailySeq ?? order?.orderCode ?? '-'} · {money(total)}</Typography>
      {finishing && tableOptions.length > 0 && <Autocomplete
        options={tableOptions}
        value={selectedTable}
        onChange={(_, table) => setSelectedTableId(table?.id || '')}
        getOptionLabel={table => table.tableName || ''}
        isOptionEqualToValue={(a, b) => String(a.id) === String(b.id)}
        filterOptions={(options, state) => {
          const query = normalizeSearch(state.inputValue)
          return query ? options.filter(table => normalizeSearch(table.tableName).includes(query)) : options
        }}
        autoHighlight
        disableClearable={Boolean(selectedTable)}
        disabled={busy}
        renderInput={params => <TextField {...params} label="Bàn của đơn" placeholder="Gõ tên bàn để tìm hoặc chuyển bàn" helperText={selectedTable ? `Đang chọn: ${selectedTable.tableName}` : 'Chưa chọn bàn'} />}
      />}
      {!alreadyPaid && <TextField select autoFocus fullWidth label="Hình thức thanh toán" value={paymentMethod} onChange={event => { setPaymentMethod(event.target.value); setQrInput(''); setCashReceived(''); setShowCashChange(false) }}>
        <MenuItem value="" disabled><em>Chọn phương thức</em></MenuItem>
        <MenuItem value="CASH">Tiền mặt</MenuItem>
        <MenuItem value="BANK_QR">QR / chuyển khoản</MenuItem>
        <MenuItem value="SPLIT">Chia tiền mặt + QR</MenuItem>
        {!printing && !clearing && <MenuItem value="PAY_LATER">Đã phục vụ · thanh toán sau</MenuItem>}
      </TextField>}
      {!alreadyPaid && paymentMethod === 'SPLIT' && <>
        <TextField
          autoFocus
          fullWidth
          label="Số tiền khách trả bằng QR"
          value={formatIntegerInput(qrInput)}
          onChange={event => setQrInput(parseIntegerInput(event.target.value))}
          inputProps={{ inputMode: 'numeric' }}
          error={Boolean(qrInput) && splitInvalid}
          helperText={splitInvalid && qrInput ? `Số tiền QR phải nhỏ hơn ${money(total)}` : 'Nhập tiền QR; hệ thống tự tính phần tiền mặt còn lại.'}
        />
        {suggestions.length > 0 && <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">Chọn nhanh:</Typography>
          {suggestions.map(value => <Button key={value} size="small" variant="outlined" onClick={() => setQrInput(String(value))}>{money(value)}</Button>)}
        </Stack>}
        <Stack direction="row" justifyContent="space-between" sx={{ p: 1.5, borderRadius: 1, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.light' }}>
          <Typography>QR: <strong>{money(qrAmount)}</strong></Typography>
          <Typography>Tiền mặt: <strong>{money(cashAmount)}</strong></Typography>
        </Stack>
      </>}
      {!alreadyPaid && paymentMethod === 'CASH' && <>
        <Button size="small" variant={showCashChange ? 'contained' : 'outlined'} color="warning" onClick={() => setShowCashChange(value => !value)} sx={{ alignSelf: 'flex-start', fontWeight: 800 }}>
          Tính tiền thối
        </Button>
        {showCashChange && <Stack gap={1} sx={{ p: 1.25, bgcolor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 1.5 }}>
          <Typography fontWeight={800}>Cần thu: {money(total)}</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Tiền khách đưa"
            value={formatVietnameseIntegerInput(cashReceived)}
            onChange={event => setCashReceived(parseIntegerInput(event.target.value))}
            inputProps={{ inputMode: 'numeric' }}
            placeholder="Ví dụ: 200.000"
          />
          <Stack direction="row" gap={0.5} flexWrap="wrap">
            {cashTenderSuggestions(total).map((amount, index) => <Button key={amount} size="small" variant="outlined" onClick={() => setCashReceived(String(amount))}>{index === 0 ? 'Đúng số · ' : ''}{money(amount)}</Button>)}
          </Stack>
          {receivedAmount > 0 && <Alert severity={changeAmount >= 0 ? 'success' : 'error'} sx={{ py: 0 }}>
            <Typography fontWeight={900}>{changeAmount >= 0 ? `Tiền thối: ${money(changeAmount)}` : `Còn thiếu: ${money(Math.abs(changeAmount))}`}</Typography>
          </Alert>}
        </Stack>}
      </>}
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={onCancel}>Hủy</Button>
      <Button disabled={busy || (!alreadyPaid && (!paymentMethod || splitInvalid))} variant="contained" color="success" onClick={submit}>
        {busy ? 'Đang xử lý…' : printing ? 'Lưu & in hóa đơn' : clearing ? 'Xác nhận thu tiền & dọn bàn' : alreadyPaid ? 'Hoàn tất & trả món' : payLater ? 'Đã phục vụ · thanh toán sau' : finishing ? 'Xác nhận thu tiền & trả món' : 'Xác nhận đã thu tiền'}
      </Button>
    </DialogActions>
  </Dialog>
}
