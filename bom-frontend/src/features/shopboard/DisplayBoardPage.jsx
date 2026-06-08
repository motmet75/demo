import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchDisplayBoard } from '../../api/shopApi'

const POLL_MS = 4000
const BOARD_CHANNEL = 'shop_display_board'

const STATUS_LABEL = { PENDING: 'Placed', CONFIRMED: 'Confirmed', PREPARING: 'Preparing' }

function OrderCard({ order, side }) {
  const isReady = side === 'ready'
  return (
    <Box sx={{
      bgcolor: isReady ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.10)',
      border: `2px solid ${isReady ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)'}`,
      borderRadius: 3,
      p: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.75,
      animation: isReady ? 'pulse 2s ease-in-out infinite' : 'none',
    }}>
      {/* Order number + table */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 52, height: 52, borderRadius: '50%',
          bgcolor: isReady ? '#fff' : 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Typography sx={{
            fontSize: 22, fontWeight: 900,
            color: isReady ? '#1b5e20' : '#fff',
            lineHeight: 1,
          }}>
            {order.orderNumber ?? '?'}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>
            {order.tableName
              ? `Table ${order.tableName}`
              : order.customerName || (order.fulfillmentType === 'PICKUP' ? 'Pickup' : 'Order')}
          </Typography>
          {!isReady && (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, mt: 0.25 }}>
              {STATUS_LABEL[order.status] || order.status}
            </Typography>
          )}
        </Box>
      </Box>

      {/* Items */}
      {order.items && order.items.length > 0 && (
        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.2)', pt: 0.75 }}>
          {order.items.map((item, i) => (
            <Typography key={i} sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 1.6 }}>
              {item.quantity}× {item.modelName}
            </Typography>
          ))}
        </Box>
      )}

      {/* Notes */}
      {order.notes && (
        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.15)', pt: 0.5 }}>
          📝 {order.notes}
        </Typography>
      )}
    </Box>
  )
}

function HalfPanel({ title, emoji, color, orders, side }) {
  return (
    <Box sx={{
      flex: 1,
      background: color,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        px: 3, py: 2,
        borderBottom: '2px solid rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', gap: 1.5,
        flexShrink: 0,
      }}>
        <Typography sx={{ fontSize: 28, lineHeight: 1 }}>{emoji}</Typography>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 20, lineHeight: 1, textTransform: 'uppercase', letterSpacing: 2 }}>
            {title}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </Box>

      {/* Orders grid */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        p: 2,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 1.5,
        alignContent: 'start',
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.3)', borderRadius: 3 },
      }}>
        {orders.length === 0 ? (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 6 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 48 }}>
              {side === 'ready' ? '🎉' : '🕐'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 1 }}>
              {side === 'ready' ? 'No orders ready yet' : 'All caught up!'}
            </Typography>
          </Box>
        ) : (
          orders.map(o => <OrderCard key={o.id} order={o} side={side} />)
        )}
      </Box>
    </Box>
  )
}

export default function DisplayBoardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')

  const [preparing, setPreparing] = useState([])
  const [ready, setReady]         = useState([])
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const channelRef = useRef(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const { res, data } = await fetchDisplayBoard(token)
      if (res.status === 410 || res.status === 404) {
        setError(data?.error || 'Token expired or not found. Ask staff to regenerate the display board URL.')
        return
      }
      if (!res.ok) { setError('Failed to load orders'); return }
      setPreparing(Array.isArray(data.preparing) ? data.preparing : [])
      setReady(Array.isArray(data.ready) ? data.ready : [])
      setLastUpdate(new Date())
      setLoading(false)
    } catch {
      setError('Network error')
    }
  }, [token])

  // Initial load + polling
  useEffect(() => {
    if (!token) { setError('Missing display board token in URL (?t=...)'); setLoading(false); return }
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load, token])

  // Cross-tab refresh via BroadcastChannel
  useEffect(() => {
    if (!window.BroadcastChannel) return
    const ch = new BroadcastChannel(BOARD_CHANNEL)
    channelRef.current = ch
    ch.onmessage = () => load()
    return () => ch.close()
  }, [load])

  const [clock, setClock] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#1a1a2e' }}>
      <CircularProgress sx={{ color: '#fff' }} />
    </Box>
  )

  if (error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#1a1a2e', p: 4, textAlign: 'center' }}>
      <Box>
        <Typography sx={{ color: '#ef9a9a', fontSize: 18, mb: 1 }}>⚠ {error}</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Ask staff to reopen Shop Orders and click "Display Board".</Typography>
      </Box>
    </Box>
  )

  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0.3); }
          50% { transform: scale(1.01); box-shadow: 0 0 16px 4px rgba(255,255,255,0.15); }
        }
      `}</style>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0d1117', overflow: 'hidden' }}>

        {/* Top bar */}
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 3, py: 1.25, bgcolor: '#161b22', borderBottom: '1px solid #30363d', flexShrink: 0,
        }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: 2, textTransform: 'uppercase' }}>
            Order Display
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {lastUpdate && (
              <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                Updated {lastUpdate.toLocaleTimeString('vi-VN')}
              </Typography>
            )}
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
              {clock.toLocaleTimeString('vi-VN')}
            </Typography>
          </Box>
        </Box>

        {/* Split panels */}
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <HalfPanel
            title="In Progress"
            emoji="⏳"
            color="linear-gradient(160deg, #1a237e 0%, #283593 100%)"
            orders={preparing}
            side="preparing"
          />
          {/* Divider */}
          <Box sx={{ width: 3, bgcolor: '#0d1117', flexShrink: 0 }} />
          <HalfPanel
            title="Ready to Pickup"
            emoji="✅"
            color="linear-gradient(160deg, #1b5e20 0%, #2e7d32 100%)"
            orders={ready}
            side="ready"
          />
        </Box>
      </Box>
    </>
  )
}
