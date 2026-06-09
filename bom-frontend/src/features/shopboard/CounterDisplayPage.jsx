import React, { useEffect, useState, useRef } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export const COUNTER_CHANNEL = 'shop_counter_display'
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // clear after 5 min idle

export function broadcastToCounter(order, tagQrBase64 = null) {
  const payload = order
    ? { ...order, tagQrBase64, _ts: Date.now() }
    : null
  const msg = { type: 'COUNTER_DISPLAY_ORDER', payload }
  try {
    if (window.BroadcastChannel) new BroadcastChannel(COUNTER_CHANNEL).postMessage(msg)
    if (payload) localStorage.setItem('shop_counter_order', JSON.stringify(payload))
    else localStorage.removeItem('shop_counter_order')
  } catch { /* non-fatal */ }
}

function parseOpts(str) {
  if (!str) return []
  try {
    const obj = JSON.parse(str)
    return Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
  } catch { return [] }
}

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '0 đ'

function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return t.toLocaleTimeString('vi-VN')
}

function IdleScreen() {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
    }}>
      <Typography sx={{ fontSize: { xs: 60, md: 100 }, lineHeight: 1 }}>🍵</Typography>
      <Typography sx={{
        fontSize: { xs: 28, md: 48 },
        fontWeight: 900,
        color: '#f1f5f9',
        letterSpacing: 2,
        textTransform: 'uppercase',
      }}>
        Welcome!
      </Typography>
      <Typography sx={{ fontSize: { xs: 14, md: 20 }, color: '#64748b', fontWeight: 500 }}>
        Chào mừng quý khách
      </Typography>
    </Box>
  )
}

function ItemRow({ item }) {
  const opts = parseOpts(item.selectedOptions)
  return (
    <Box sx={{
      bgcolor: '#1e293b',
      borderRadius: 2,
      p: { xs: 1.5, md: 2 },
      mb: 1.5,
      borderLeft: '4px solid #3b82f6',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Typography sx={{
          fontSize: { xs: 16, md: 22 },
          fontWeight: 800,
          color: '#f1f5f9',
          lineHeight: 1.2,
          flex: 1,
        }}>
          <Box component="span" sx={{ color: '#60a5fa', fontWeight: 900, mr: 1 }}>
            {Number(item.quantity)}×
          </Box>
          {item.modelName}
        </Typography>
        <Typography sx={{
          fontSize: { xs: 14, md: 18 },
          fontWeight: 700,
          color: '#38bdf8',
          flexShrink: 0,
        }}>
          {fmt(item.lineTotal)}
        </Typography>
      </Box>

      {opts.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {opts.map((o, i) => (
            <Box key={i} sx={{
              bgcolor: '#334155',
              color: '#94a3b8',
              borderRadius: 99,
              px: 1.25,
              py: 0.25,
              fontSize: { xs: 11, md: 13 },
              fontWeight: 600,
            }}>
              {o}
            </Box>
          ))}
        </Box>
      )}

      {item.itemNotes && (
        <Typography sx={{
          mt: 0.75,
          fontSize: { xs: 12, md: 14 },
          color: '#fbbf24',
          fontStyle: 'italic',
          fontWeight: 600,
        }}>
          ⚠ {item.itemNotes}
        </Typography>
      )}
    </Box>
  )
}

function ActiveOrder({ order }) {
  const num = order.orderNumber ? `#${order.orderNumber}` : order.orderCode
  const hasPayQr = !!order.paymentQr
  const hasTrackQr = !!order.tagQrBase64

  const payQrSrc = order.paymentQr?.startsWith('https://')
    ? order.paymentQr
    : order.paymentQr ? `data:image/png;base64,${order.paymentQr}` : null

  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: { xs: 'column', md: 'row' },
      minHeight: 0,
      overflow: 'hidden',
      gap: '2px',
      bgcolor: '#0f172a',
    }}>
      {/* Left — order items */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: '#0f172a',
      }}>
        {/* Order number banner */}
        <Box sx={{
          bgcolor: '#1e3a5f',
          borderBottom: '3px solid #3b82f6',
          px: { xs: 2, md: 4 },
          py: { xs: 1.5, md: 2 },
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
        }}>
          <Typography sx={{
            fontSize: { xs: 48, md: 72 },
            fontWeight: 900,
            color: '#60a5fa',
            lineHeight: 1,
            letterSpacing: -3,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {num}
          </Typography>
          <Box>
            <Typography sx={{ color: '#94a3b8', fontSize: { xs: 11, md: 14 }, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
              Order
            </Typography>
            {order.customerName && (
              <Typography sx={{ color: '#f1f5f9', fontSize: { xs: 14, md: 18 }, fontWeight: 700 }}>
                {order.customerName}
              </Typography>
            )}
            {order.tableName && (
              <Typography sx={{ color: '#93c5fd', fontSize: { xs: 12, md: 15 }, fontWeight: 600 }}>
                Table {order.tableName}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Items list */}
        <Box sx={{
          flex: 1,
          overflowY: 'auto',
          p: { xs: 1.5, md: 3 },
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#334155', borderRadius: 4 },
        }}>
          {(order.items || []).map((item, i) => <ItemRow key={i} item={item} />)}

          {/* Total */}
          <Box sx={{
            bgcolor: '#1e293b',
            borderRadius: 2,
            px: { xs: 2, md: 3 },
            py: { xs: 1.5, md: 2 },
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '2px solid #3b82f6',
          }}>
            <Typography sx={{ fontSize: { xs: 16, md: 22 }, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>
              Total
            </Typography>
            <Typography sx={{ fontSize: { xs: 24, md: 36 }, fontWeight: 900, color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(order.totalAmount)}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Right — QR codes */}
      {(hasPayQr || hasTrackQr) && (
        <Box sx={{
          width: { xs: '100%', md: 280 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: { xs: 'row', md: 'column' },
          bgcolor: '#0c1525',
          borderLeft: { md: '2px solid #1e293b' },
          borderTop: { xs: '2px solid #1e293b', md: 'none' },
          p: { xs: 2, md: 3 },
          gap: 3,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          {hasPayQr && payQrSrc && (
            <Box sx={{ textAlign: 'center', flex: { xs: 1, md: 'unset' } }}>
              <Typography sx={{
                fontSize: { xs: 11, md: 13 },
                fontWeight: 800,
                color: '#4ade80',
                letterSpacing: 2,
                textTransform: 'uppercase',
                mb: 1,
              }}>
                Scan to Pay
              </Typography>
              <Box sx={{
                bgcolor: '#fff',
                borderRadius: 2,
                p: 1,
                display: 'inline-block',
                border: '3px solid #4ade80',
              }}>
                <img
                  src={payQrSrc}
                  alt="VietQR"
                  style={{ width: 180, height: 180, display: 'block' }}
                />
              </Box>
              <Typography sx={{ mt: 1, fontSize: { xs: 11, md: 12 }, color: '#4ade80', fontWeight: 600 }}>
                {fmt(order.totalAmount)}
              </Typography>
            </Box>
          )}

          {hasTrackQr && (
            <Box sx={{ textAlign: 'center', flex: { xs: 1, md: 'unset' } }}>
              <Typography sx={{
                fontSize: { xs: 11, md: 13 },
                fontWeight: 800,
                color: '#94a3b8',
                letterSpacing: 2,
                textTransform: 'uppercase',
                mb: 1,
              }}>
                Track Order
              </Typography>
              <Box sx={{
                bgcolor: '#fff',
                borderRadius: 2,
                p: 1,
                display: 'inline-block',
                border: '3px solid #475569',
              }}>
                <img
                  src={`data:image/png;base64,${order.tagQrBase64}`}
                  alt="Track"
                  style={{ width: 160, height: 160, display: 'block' }}
                />
              </Box>
              <Typography sx={{ mt: 1, fontSize: { xs: 11, md: 12 }, color: '#64748b', fontWeight: 600 }}>
                {order.orderCode}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}

export default function CounterDisplayPage() {
  const [order, setOrder] = useState(null)
  const idleTimerRef = useRef(null)

  const resetIdleTimer = (ord) => {
    clearTimeout(idleTimerRef.current)
    if (ord) {
      idleTimerRef.current = setTimeout(() => setOrder(null), IDLE_TIMEOUT_MS)
    }
  }

  // Listen for BroadcastChannel from admin
  useEffect(() => {
    if (!window.BroadcastChannel) return
    const ch = new BroadcastChannel(COUNTER_CHANNEL)
    ch.onmessage = (e) => {
      if (e.data?.type === 'COUNTER_DISPLAY_ORDER') {
        const ord = e.data.payload || null
        setOrder(ord)
        resetIdleTimer(ord)
        if (ord) localStorage.setItem('shop_counter_order', JSON.stringify(ord))
        else localStorage.removeItem('shop_counter_order')
      }
    }
    return () => ch.close()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore from localStorage on load (same-device but tab was refreshed)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('shop_counter_order')
      if (saved) {
        const ord = JSON.parse(saved)
        // Only restore if it's less than 10 minutes old
        if (ord._ts && Date.now() - ord._ts < 10 * 60 * 1000) {
          setOrder(ord)
          resetIdleTimer(ord)
        } else {
          localStorage.removeItem('shop_counter_order')
        }
      }
    } catch { localStorage.removeItem('shop_counter_order') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0f172a', overflow: 'hidden' }}>

      {/* Top bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 2, md: 4 },
        py: { xs: 1, md: 1.5 },
        bgcolor: '#1e293b',
        borderBottom: '2px solid #334155',
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontWeight: 900,
          fontSize: { xs: 14, md: 20 },
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#f1f5f9',
        }}>
          {order ? '🧋 Your Order' : '🍵 Order Counter'}
        </Typography>
        <Typography sx={{
          fontWeight: 900,
          fontSize: { xs: 16, md: 22 },
          color: '#475569',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 1,
        }}>
          <Clock />
        </Typography>
      </Box>

      {order ? <ActiveOrder order={order} /> : <IdleScreen />}
    </Box>
  )
}
