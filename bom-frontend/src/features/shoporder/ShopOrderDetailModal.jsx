import React from 'react'
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

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '—'
const pct = (sell, raw) => {
  if (!sell || !raw || Number(raw) === 0) return '—'
  return ((Number(sell) - Number(raw)) / Number(sell) * 100).toFixed(1) + '%'
}

const STATUS_COLOR = { PENDING: 'default', CONFIRMED: 'primary', PREPARING: 'warning', READY: 'success', COMPLETED: 'success', CANCELLED: 'error' }

export default function ShopOrderDetailModal({ open, order, onClose }) {
  if (!order) return null
  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        Order #{order.orderCode}
        <Chip label={order.status} color={STATUS_COLOR[order.status] || 'default'} size="small" sx={{ ml: 1 }} />
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
          <Typography variant="body2"><strong>Customer:</strong> {order.customerName || '—'}</Typography>
          <Typography variant="body2"><strong>Phone:</strong> {order.customerPhone || '—'}</Typography>
          <Typography variant="body2"><strong>Type:</strong> {order.fulfillmentType}</Typography>
          <Typography variant="body2"><strong>Table:</strong> {order.tableName || '—'}</Typography>
          <Typography variant="body2"><strong>Payment:</strong> {order.paymentMethod} / {order.paymentStatus}</Typography>
          <Typography variant="body2"><strong>Delivery fee:</strong> {fmt(order.deliveryFee)}</Typography>
        </Box>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell align="right">Sell Price</TableCell>
              <TableCell align="right">Raw Cost</TableCell>
              <TableCell align="right">Margin</TableCell>
              <TableCell align="right">Line Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(order.items || []).map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.modelName}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">{fmt(item.unitPrice)}</TableCell>
                <TableCell align="right">{fmt(item.unitRawCost)}</TableCell>
                <TableCell align="right">{pct(item.unitPrice, item.unitRawCost)}</TableCell>
                <TableCell align="right">{fmt(item.lineTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box sx={{ mt: 1, textAlign: 'right' }}>
          <Typography variant="body2">Raw Cost: {fmt(order.totalRawCost)}</Typography>
          <Typography fontWeight={600}>Total: {fmt(order.totalAmount)}</Typography>
        </Box>

        {order.paymentQr && (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2">Payment QR</Typography>
            <img src={`data:image/png;base64,${order.paymentQr}`} alt="Payment QR" style={{ width: 200, height: 200 }} />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
