import React, { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material'

export default function PaymentMethodConfirmDialog({ open, order, action = 'paid', busy = false, onCancel, onConfirm }) {
  const [paymentMethod, setPaymentMethod] = useState('')

  const finishing = action === 'complete'
  const alreadyPaid = finishing && order?.paymentStatus === 'PAID'
  const payLater = paymentMethod === 'PAY_LATER'
  return <Dialog open={open} onClose={busy ? undefined : onCancel} fullWidth maxWidth="xs">
    <DialogTitle>{finishing ? 'Hoàn tất & trả món' : 'Xác nhận đã thanh toán'}</DialogTitle>
    <DialogContent sx={{ pt: '10px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity={alreadyPaid ? 'success' : payLater ? 'warning' : 'info'}>
        {alreadyPaid
          ? 'Đơn đã thanh toán. Xác nhận hoàn tất và trả món cho khách.'
          : payLater
          ? 'Đơn vẫn ở trạng thái chưa thanh toán. Bạn có thể chọn lại Tiền mặt hoặc QR / chuyển khoản trước khi hoàn tất.'
          : 'Chưa chọn sẵn phương thức. Nhân viên cần xác nhận đúng cách khách thanh toán.'}
      </Alert>
      <Typography fontWeight={800}>Đơn #{order?.orderNumber ?? order?.dailySeq ?? order?.orderCode ?? '-'} · {Number(order?.totalAmount || 0).toLocaleString('vi-VN')}đ</Typography>
      {!alreadyPaid && <TextField select autoFocus fullWidth label="Hình thức thanh toán" value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>
        <MenuItem value="" disabled><em>Chọn phương thức</em></MenuItem>
        <MenuItem value="CASH">Tiền mặt</MenuItem>
        <MenuItem value="BANK_QR">QR / chuyển khoản</MenuItem>
        {!finishing && <MenuItem value="PAY_LATER">Trả sau · chưa thu tiền</MenuItem>}
      </TextField>}
    </DialogContent>
    <DialogActions>
      <Button disabled={busy} onClick={onCancel}>Hủy</Button>
      <Button disabled={busy || (!alreadyPaid && !paymentMethod)} variant="contained" color="success" onClick={() => onConfirm(alreadyPaid ? null : paymentMethod)}>
        {busy ? 'Đang xử lý…' : alreadyPaid ? 'Hoàn tất & trả món' : payLater ? 'Xác nhận trả sau' : finishing ? 'Xác nhận thu tiền & trả món' : 'Xác nhận đã thu tiền'}
      </Button>
    </DialogActions>
  </Dialog>
}
