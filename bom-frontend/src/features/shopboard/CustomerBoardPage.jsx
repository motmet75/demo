import React, { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchDisplayBoard } from '../../api/shopApi'

const POLL_MS = 4000

function useClock() {
  const [clock, setClock] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t) }, [])
  return clock
}

function OrderChip({ order, ready }) {
  const num   = order.orderNumber ?? order.orderCode ?? '?'
  const label = order.tableName
    ? `Table ${order.tableName}`
    : order.customerName || (order.fulfillmentType === 'PICKUP' ? 'Pickup' : null)

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: { xs: 110, sm: 130, md: 150 },
      height: { xs: 110, sm: 130, md: 150 },
      borderRadius: 3,
      border: ready ? '3px solid #22c55e' : '3px solid #f59e0b',
      bgcolor: ready ? '#052e16' : '#1c1403',
      boxShadow: ready
        ? '0 0 0 0 #22c55e44, 0 4px 24px #22c55e33'
        : '0 4px 16px #0004',
      animation: ready ? 'chipGlow 2.5s ease-in-out infinite' : 'none',
      '@keyframes chipGlow': {
        '0%,100%': { boxShadow: '0 0 0 0 #22c55e44, 0 4px 24px #22c55e22' },
        '50%':     { boxShadow: '0 0 0 10px #22c55e22, 0 4px 32px #22c55e44' },
      },
      cursor: 'default',
      flexShrink: 0,
    }}>
      <Typography sx={{
        fontSize: { xs: 42, sm: 52, md: 64 },
        fontWeight: 900,
        lineHeight: 1,
        color: ready ? '#4ade80' : '#fbbf24',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: -2,
      }}>
        {typeof num === 'number' ? num : num}
      </Typography>
      {label && (
        <Typography sx={{
          fontSize: { xs: 11, sm: 12, md: 13 },
          fontWeight: 700,
          color: ready ? '#86efac' : '#fde68a',
          mt: 0.5,
          textAlign: 'center',
          px: 1,
          lineHeight: 1.2,
        }}>
          {label}
        </Typography>
      )}
    </Box>
  )
}

function Section({ title, subtitle, emoji, orders, ready, emptyText }) {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      borderRight: ready ? 'none' : '2px solid #1e293b',
    }}>
      {/* Section header */}
      <Box sx={{
        px: { xs: 2, md: 4 },
        py: { xs: 1.5, md: 2 },
        bgcolor: ready ? '#052e16' : '#1c1403',
        borderBottom: `3px solid ${ready ? '#22c55e' : '#f59e0b'}`,
        flexShrink: 0,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: { xs: 22, md: 28 } }}>{emoji}</Typography>
          <Box>
            <Typography sx={{
              fontSize: { xs: 16, md: 22 },
              fontWeight: 900,
              color: ready ? '#4ade80' : '#fbbf24',
              letterSpacing: 1,
              textTransform: 'uppercase',
              lineHeight: 1,
            }}>
              {title}
            </Typography>
            <Typography sx={{
              fontSize: { xs: 11, md: 13 },
              color: ready ? '#86efac' : '#fde68a',
              fontWeight: 500,
              opacity: 0.8,
            }}>
              {subtitle}
            </Typography>
          </Box>
          {orders.length > 0 && (
            <Box sx={{
              ml: 'auto',
              bgcolor: ready ? '#166534' : '#78350f',
              color: ready ? '#4ade80' : '#fbbf24',
              fontWeight: 900,
              fontSize: { xs: 18, md: 24 },
              borderRadius: 99,
              px: 1.5,
              py: 0.25,
              lineHeight: 1.4,
              minWidth: 36,
              textAlign: 'center',
            }}>
              {orders.length}
            </Box>
          )}
        </Box>
      </Box>

      {/* Order chips grid */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        p: { xs: 2, md: 3 },
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: { xs: 1.5, md: 2 },
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#334155', borderRadius: 4 },
      }}>
        {orders.length === 0 ? (
          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, opacity: 0.3 }}>
            <Typography sx={{ fontSize: 48 }}>{ready ? '🎉' : '⏳'}</Typography>
            <Typography sx={{ color: '#475569', fontSize: 14, mt: 1 }}>{emptyText}</Typography>
          </Box>
        ) : (
          orders.map(o => <OrderChip key={o.id} order={o} ready={ready} />)
        )}
      </Box>
    </Box>
  )
}

export default function CustomerBoardPage() {
  const [params]      = useSearchParams()
  const token         = params.get('token')
  const [data, setData]       = useState(null)
  const [error, setError]     = useState('')
  const [lastUpdate, setLastUpdate] = useState(null)
  const clock = useClock()

  const load = useCallback(async () => {
    if (!token) { setError('No token — ask staff to share the Customer Display link.'); return }
    try {
      const { data: d } = await fetchDisplayBoard(token)
      setData(d)
      setLastUpdate(new Date())
      setError('')
    } catch (e) { setError(e.message || 'Failed to load') }
  }, [token])

  useEffect(() => { load(); const t = setInterval(load, POLL_MS); return () => clearInterval(t) }, [load])

  // Combine confirmed + processing into "preparing"
  const preparing = [...(data?.confirmed || []), ...(data?.processing || [])]
  const ready     = data?.ready || []

  if (!token || error) return (
    <Box sx={{ height: '100vh', bgcolor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ color: '#f87171', fontSize: 20, mb: 1 }}>⚠ {error || 'No token'}</Typography>
        <Typography sx={{ color: '#475569', fontSize: 14 }}>Ask staff to share the Customer Display link.</Typography>
      </Box>
    </Box>
  )

  if (!data) return (
    <Box sx={{ height: '100vh', bgcolor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#3b82f6' }} />
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0f172a', overflow: 'hidden' }}>

      {/* Top bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 2, md: 5 },
        py: { xs: 0.75, md: 1.25 },
        bgcolor: '#020617',
        borderBottom: '2px solid #1e293b',
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontWeight: 900,
          fontSize: { xs: 14, md: 20 },
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#f1f5f9',
        }}>
          Order Status
        </Typography>
        <Typography sx={{
          fontWeight: 900,
          fontSize: { xs: 16, md: 24 },
          color: '#64748b',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 2,
        }}>
          {clock.toLocaleTimeString('vi-VN')}
        </Typography>
      </Box>

      {/* Two sections */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <Section
          title="Being Prepared"
          subtitle="Your order is on the way"
          emoji="🍳"
          orders={preparing}
          ready={false}
          emptyText="No orders in progress"
        />
        <Section
          title="Ready!"
          subtitle="Please come collect your order"
          emoji="✅"
          orders={ready}
          ready={true}
          emptyText="Nothing ready yet"
        />
      </Box>

    </Box>
  )
}
