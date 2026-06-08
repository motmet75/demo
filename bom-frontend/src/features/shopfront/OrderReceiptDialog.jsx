import React from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import PrintIcon from '@mui/icons-material/Print'
import TrackChangesIcon from '@mui/icons-material/TrackChanges'
import { printOrderReceipt } from '../../utils/printOrderReceipt'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

function parseOpts(str) {
  if (!str) return null
  try {
    const obj = JSON.parse(str)
    return Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
  } catch { return null }
}

export default function OrderReceiptDialog({ open, order, onClose, onTrack }) {
  if (!order) return null

  const isBankQr   = order.paymentMethod === 'BANK_QR'
  const isQrUrl    = order.paymentQr?.startsWith('https://')
  const qrSrc      = order.paymentQr
    ? (isQrUrl ? order.paymentQr : `data:image/png;base64,${order.paymentQr}`)
    : null
  const displayNum = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const bankCode   = isQrUrl ? order.paymentQr.split('/image/')[1]?.split('-')[0] : null
  const bankLogoUrl = bankCode ? `https://img.vietqr.io/img/${bankCode}.png` : null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

      {/* Header */}
      <Box sx={{
        bgcolor: '#1e293b', color: '#fff', px: 3, py: 2.5, textAlign: 'center',
      }}>
        <Typography variant="caption" sx={{ letterSpacing: 2, opacity: 0.6, textTransform: 'uppercase' }}>
          Order Placed
        </Typography>
        <Typography sx={{ fontSize: 56, fontWeight: 900, lineHeight: 1, mt: 0.5 }}>
          {displayNum}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5 }}>{order.orderCode}</Typography>
      </Box>

      <DialogContent sx={{ p: 0 }}>

        {/* Payment QR section — shown for BANK_QR prepayment */}
        {isBankQr && qrSrc && (
          <Box sx={{ textAlign: 'center', bgcolor: '#f0fdf4', borderBottom: '1px solid #bbf7d0', px: 2, py: 2 }}>
            {bankLogoUrl && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                <img src={bankLogoUrl} alt="Bank"
                  style={{ height: 36, maxWidth: 120, objectFit: 'contain', borderRadius: 4 }} />
              </Box>
            )}
            <Typography variant="subtitle2" fontWeight={800} color="#15803d" sx={{ mb: 1 }}>
              Scan to Pay Now
            </Typography>
            <img src={qrSrc} alt="Payment QR"
              style={{ width: 180, height: 180, display: 'block', margin: '0 auto', borderRadius: 8 }} />
            <Typography variant="h6" fontWeight={900} color="primary" sx={{ mt: 1.25 }}>
              {fmt(order.totalAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Transfer exact amount · ref: {order.orderCode}
            </Typography>
          </Box>
        )}

        {isBankQr && !qrSrc && (
          <Box sx={{ bgcolor: '#fff8e1', px: 2, py: 1.5, borderBottom: '1px solid #ffe082', textAlign: 'center' }}>
            <Typography variant="body2" color="#e65100" fontWeight={700}>
              Bank transfer · {fmt(order.totalAmount)}
            </Typography>
            <Typography variant="caption" color="text.secondary">ref: {order.orderCode}</Typography>
          </Box>
        )}

        {/* Items */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10, display: 'block', mb: 1 }}>
            Your order
          </Typography>

          {(order.items || []).map(item => {
            const optsStr = parseOpts(item.selectedOptions)
            const noteStr = item.itemNotes
            return (
              <Box key={item.id} sx={{ mb: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" fontWeight={600}>
                    {Number(item.quantity)}× {item.modelName}
                  </Typography>
                  <Typography variant="body2" color="primary" fontWeight={600}>
                    {fmt(item.lineTotal)}
                  </Typography>
                </Box>
                {optsStr && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>
                    {optsStr}
                  </Typography>
                )}
                {noteStr && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block', fontStyle: 'italic' }}>
                    {noteStr}
                  </Typography>
                )}
              </Box>
            )
          })}

          {order.deliveryFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">Delivery fee</Typography>
              <Typography variant="body2">{fmt(order.deliveryFee)}</Typography>
            </Box>
          )}

          <Divider sx={{ my: 1 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={800}>Total</Typography>
            <Typography fontWeight={800} color="primary">{fmt(order.totalAmount)}</Typography>
          </Box>

          {!isBankQr && (
            <Chip label="Cash on delivery" size="small" variant="outlined"
              sx={{ mt: 1, fontSize: 11 }} />
          )}

          {order.notes && (
            <Typography variant="caption" color="text.secondary"
              sx={{ display: 'block', mt: 1, fontStyle: 'italic', borderTop: '1px solid #f0f0f0', pt: 0.75 }}>
              📝 {order.notes}
            </Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0, gap: 1, flexDirection: 'column' }}>
        <Button
          variant="outlined" fullWidth startIcon={<PrintIcon />}
          onClick={() => printOrderReceipt(order)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Print Receipt
        </Button>
        <Button
          variant="contained" fullWidth startIcon={<TrackChangesIcon />}
          onClick={onTrack}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
        >
          Track Order
        </Button>
      </DialogActions>
    </Dialog>
  )
}
