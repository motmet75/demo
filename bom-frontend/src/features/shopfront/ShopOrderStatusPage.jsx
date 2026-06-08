import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchPublicOrder } from '../../api/shopApi'

const STEPS = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed']
const STATUS_STEP = { PENDING: 0, CONFIRMED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, CANCELLED: -1 }
const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

export default function ShopOrderStatusPage() {
  const { orderCode } = useParams()
  const [params] = useSearchParams()
  const tenantId = params.get('tenantId')
  const companyId = params.get('companyId')

  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    if (!orderCode || !tenantId || !companyId) return
    fetchPublicOrder(orderCode, tenantId, companyId)
      .then(({ data }) => {
        if (data && data.orderCode) setOrder(data)
        else setError('Order not found')
      })
      .catch(() => setError('Failed to load order'))
  }, [orderCode, tenantId, companyId])

  useEffect(() => {
    load()
    const id = setInterval(load, 5000) // poll every 5s
    return () => clearInterval(id)
  }, [load])

  if (!order && !error) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
  if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>

  const step = STATUS_STEP[order.status] ?? 0
  const cancelled = order.status === 'CANCELLED'

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 2, textAlign: 'center' }}>
        Order #{order.orderCode}
      </Typography>

      {cancelled ? (
        <Alert severity="error" sx={{ mb: 2 }}>This order was cancelled.</Alert>
      ) : (
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>
      )}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary">Items</Typography>
          {(order.items || []).map(item => (
            <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2">{item.modelName} × {item.quantity}</Typography>
              <Typography variant="body2">{fmt(item.lineTotal)}</Typography>
            </Box>
          ))}
          <Divider sx={{ my: 1 }} />
          {order.deliveryFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Delivery fee</Typography>
              <Typography variant="body2">{fmt(order.deliveryFee)}</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={600}>Total</Typography>
            <Typography fontWeight={600} color="primary">{fmt(order.totalAmount)}</Typography>
          </Box>
        </CardContent>
      </Card>

      {order.status === 'READY' && order.paymentQr && (
        <Card variant="outlined" sx={{ textAlign: 'center', p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Scan to pay</Typography>
          <img
            src={`data:image/png;base64,${order.paymentQr}`}
            alt="Payment QR"
            style={{ width: 240, height: 240, display: 'block', margin: '0 auto' }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{fmt(order.totalAmount)}</Typography>
        </Card>
      )}

      {order.status === 'COMPLETED' && (
        <Alert severity="success">Your order is complete. Thank you!</Alert>
      )}
    </Box>
  )
}
