import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'
import { pickupScan, fetchPublicOrder } from '../../api/shopApi'

function fmt(n) {
  return Number(n || 0).toLocaleString('vi-VN') + ' đ'
}

export default function CustomerPickupPage() {
  const { orderCode } = useParams()

  const [order, setOrder] = useState(null)
  const [scanned, setScanned] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!orderCode) { setError('Invalid link'); return }
    try {
      const { data } = await fetchPublicOrder(orderCode)
      setOrder(data)
    } catch (e) { setError(e.message || 'Order not found') }
  }, [orderCode])

  useEffect(() => { load() }, [load])

  // Auto-trigger pickup scan on mount — counter display will auto-show
  useEffect(() => {
    if (!order || scanned || scanning) return
    setScanning(true)
    pickupScan(orderCode)
      .then(() => setScanned(true))
      .catch(() => {})
      .finally(() => setScanning(false))
  }, [order, scanned, scanning, orderCode])

  if (error) return (
    <Box sx={{ height: '100vh', bgcolor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Typography sx={{ color: '#f87171', fontSize: 18, textAlign: 'center' }}>⚠ {error}</Typography>
    </Box>
  )

  if (!order) return (
    <Box sx={{ height: '100vh', bgcolor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#3b82f6' }} />
    </Box>
  )

  const roots = (order.items || []).filter(it => !it.parentItemId)
  const childMap = {}
  ;(order.items || []).filter(it => it.parentItemId).forEach(it => {
    const k = String(it.parentItemId)
    if (!childMap[k]) childMap[k] = []
    childMap[k].push(it)
  })

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#0f172a',
      color: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      p: 3,
      gap: 3,
    }}>

      {/* Order badge */}
      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', mb: 0.5 }}>
          Order
        </Typography>
        <Typography sx={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: '#f59e0b', letterSpacing: -4 }}>
          {order.dailySeq ?? order.orderNumber ?? '—'}
        </Typography>
        <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.75 }}>
          {order.orderNumber ? `Đơn #${order.orderNumber}` : ''}{order.orderCode ? ` · ${order.orderCode}` : ''}
        </Typography>
        {order.tableName && (
          <Typography sx={{ fontSize: 16, color: '#fde68a', mt: 0.5 }}>
            Table {order.tableName}
          </Typography>
        )}
        <Box sx={{
          mt: 1.5,
          display: 'inline-block',
          px: 2,
          py: 0.5,
          borderRadius: 99,
          bgcolor: order.status === 'READY' ? '#166534' : '#1e3a5f',
          color: order.status === 'READY' ? '#4ade80' : '#93c5fd',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 1,
        }}>
          {order.status === 'READY' ? '✓ Ready for pickup' : order.status}
        </Box>
      </Box>

      {/* Items summary */}
      <Box sx={{ width: '100%', maxWidth: 400, bgcolor: '#1e293b', borderRadius: 3, p: 2, gap: 1, display: 'flex', flexDirection: 'column' }}>
        {roots.map((root, ri) => {
          const children = childMap[String(root.id)] || []
          const parentQty = Number(root.quantity || 1)
          return (
            <Box key={root.id}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontSize: 13, color: '#94a3b8', minWidth: 22 }}>{ri + 1}.</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', flex: 1 }}>
                  {parentQty}× {root.modelName}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                  {fmt(root.lineTotal)}
                </Typography>
              </Box>
              {children.map((ch, ci) => (
                <Box key={ch.id} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, ml: 3, pl: 1, borderLeft: '2px solid #334155' }}>
                  <Typography sx={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>{ri + 1}.{ci + 1}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>
                    {parentQty}×{Number(ch.quantity || 1)} {ch.modelName}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                    {fmt(Number(ch.lineTotal || 0) * parentQty)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )
        })}
        <Box sx={{ borderTop: '1px solid #334155', pt: 1, mt: 0.5, display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Total</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>
            {fmt(order.totalAmount)}
          </Typography>
        </Box>
      </Box>

      {/* Payment QR — show directly on phone for QR pay orders */}
      {(() => {
        const isQr = order.paymentMethod === 'BANK_QR'
        const isSplit = order.paymentMethod === 'SPLIT'
        const payQrSrc = order.paymentQr?.startsWith('https://')
          ? order.paymentQr
          : order.paymentQr ? `data:image/png;base64,${order.paymentQr}` : null
        if (!(isQr || isSplit) || !payQrSrc) return null
        const splitCash = isSplit ? Number(order.splitCashAmount || 0) : 0
        const qrAmount = isSplit ? Number(order.totalAmount || 0) - splitCash : Number(order.totalAmount || 0)
        return (
          <Box sx={{
            width: '100%',
            maxWidth: 400,
            bgcolor: '#0a1f0a',
            border: '3px solid #4ade80',
            borderRadius: 3,
            p: 2.5,
            textAlign: 'center',
          }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#4ade80', letterSpacing: 2, textTransform: 'uppercase', mb: 1.5 }}>
              💳 Show this QR to the cashier
            </Typography>
            <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 1, display: 'inline-block', border: '3px solid #4ade80' }}>
              <img src={payQrSrc} alt="Payment QR" style={{ width: 220, height: 220, display: 'block' }} />
            </Box>
            <Typography sx={{ mt: 1.5, fontSize: 22, fontWeight: 900, color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(qrAmount)}
            </Typography>
            {isSplit && splitCash > 0 && (
              <Typography sx={{ mt: 0.5, fontSize: 13, color: '#fbbf24' }}>
                + {fmt(splitCash)} cash
              </Typography>
            )}
          </Box>
        )
      })()}

      {/* Counter notice */}
      <Box sx={{
        width: '100%',
        maxWidth: 400,
        bgcolor: scanned ? '#052e16' : '#1c1403',
        border: `2px solid ${scanned ? '#22c55e' : '#f59e0b'}`,
        borderRadius: 3,
        p: 2.5,
        textAlign: 'center',
      }}>
        {scanned ? (
          <>
            <Typography sx={{ fontSize: 28, mb: 1 }}>✅</Typography>
            <Typography sx={{ fontWeight: 800, color: '#4ade80', fontSize: 16 }}>
              Payment QR is now on the counter screen
            </Typography>
            <Typography sx={{ color: '#86efac', fontSize: 13, mt: 1 }}>
              Please proceed to the counter to complete payment
            </Typography>
          </>
        ) : scanning ? (
          <>
            <CircularProgress size={28} sx={{ color: '#f59e0b', mb: 1 }} />
            <Typography sx={{ color: '#fde68a', fontSize: 14 }}>Notifying counter…</Typography>
          </>
        ) : (
          <>
            <Typography sx={{ fontSize: 24, mb: 1 }}>📲</Typography>
            <Typography sx={{ color: '#fbbf24', fontSize: 14 }}>
              Tap below to notify the counter screen
            </Typography>
            <Button
              variant="contained"
              onClick={() => {
                setScanning(true)
                pickupScan(orderCode)
                  .then(() => setScanned(true))
                  .catch(() => {})
                  .finally(() => setScanning(false))
              }}
              sx={{ mt: 2, bgcolor: '#f59e0b', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#d97706' } }}
            >
              Notify Counter
            </Button>
          </>
        )}
      </Box>

    </Box>
  )
}
