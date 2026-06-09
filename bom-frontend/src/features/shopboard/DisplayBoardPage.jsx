import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchDisplayBoard } from '../../api/shopApi'

const POLL_MS = 4000
const BOARD_CHANNEL = 'shop_display_board'

function OrderCard({ order, ready }) {
  const num = order.orderNumber ?? '?'
  const label = order.tableName
    ? `Table ${order.tableName}`
    : order.customerName || (order.fulfillmentType === 'PICKUP' ? 'Pickup' : '')

  return (
    <Box sx={{
      bgcolor: ready ? '#f0fdf4' : '#fff',
      border: `2px solid ${ready ? '#4ade80' : '#e2e8f0'}`,
      borderRadius: { xs: 2, md: 3 },
      p: { xs: 1.5, md: 2 },
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.25,
      animation: ready ? 'glow 2.5s ease-in-out infinite' : 'none',
      '@keyframes glow': {
        '0%,100%': { boxShadow: '0 0 0 0 rgba(74,222,128,0)' },
        '50%': { boxShadow: '0 0 0 10px rgba(74,222,128,0.15)' },
      },
    }}>
      <Typography sx={{
        fontSize: { xs: 52, md: 80, lg: 100 },
        fontWeight: 900,
        lineHeight: 1,
        color: ready ? '#15803d' : '#1e293b',
        letterSpacing: -3,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {num}
      </Typography>
      {label && (
        <Typography sx={{
          fontSize: { xs: 11, md: 13, lg: 14 },
          fontWeight: 600,
          color: ready ? '#16a34a' : '#64748b',
          lineHeight: 1.2,
        }}>
          {label}
        </Typography>
      )}
      {ready && (
        <Typography sx={{
          fontSize: { xs: 10, md: 11 },
          color: '#4ade80',
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: 'uppercase',
          mt: 0.25,
        }}>
          Pick up ✓
        </Typography>
      )}
    </Box>
  )
}

function Column({ title, emoji, subtitle, orders, ready, emptyText, headerBg, headerColor, panelBg, borderColor }) {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: panelBg,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <Box sx={{
        px: { xs: 2, md: 4 },
        py: { xs: 1.5, md: 2.5 },
        bgcolor: headerBg,
        borderBottom: `3px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexShrink: 0,
      }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{
            fontSize: { xs: 16, md: 22, lg: 28 },
            fontWeight: 900,
            color: headerColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            lineHeight: 1,
          }}>
            {emoji}&nbsp;{title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: { xs: 11, md: 13 }, color: headerColor, opacity: 0.65, mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{
          bgcolor: headerColor,
          color: headerBg,
          borderRadius: 99,
          px: 2, py: 0.5,
          fontWeight: 900,
          fontSize: { xs: 16, md: 24 },
          minWidth: 44,
          textAlign: 'center',
          lineHeight: 1.4,
        }}>
          {orders.length}
        </Box>
      </Box>

      {/* Cards grid */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        p: { xs: 1.5, md: 2.5 },
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(auto-fill, minmax(80px,  1fr))',
          md: 'repeat(auto-fill, minmax(130px, 1fr))',
          lg: 'repeat(auto-fill, minmax(155px, 1fr))',
        },
        gap: { xs: 1, md: 1.5 },
        alignContent: 'start',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: borderColor, borderRadius: 4 },
      }}>
        {orders.length === 0 ? (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: { xs: 5, md: 12 } }}>
            <Typography sx={{ fontSize: { xs: 36, md: 52 }, mb: 1 }}>
              {ready ? '🎉' : '☕'}
            </Typography>
            <Typography sx={{ color: headerColor, opacity: 0.45, fontSize: { xs: 13, md: 16 }, fontWeight: 600 }}>
              {emptyText}
            </Typography>
          </Box>
        ) : (
          orders.map(o => <OrderCard key={o.id} order={o} ready={ready} />)
        )}
      </Box>
    </Box>
  )
}

export default function DisplayBoardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')

  const [inProgress, setInProgress] = useState([])
  const [ready, setReady]           = useState([])
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const channelRef = useRef(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const { res, data } = await fetchDisplayBoard(token)
      if (res.status === 410 || res.status === 404) {
        setError(data?.error || 'Token expired. Ask staff to regenerate the display board URL.')
        return
      }
      if (!res.ok) { setError('Failed to load orders'); return }
      // Merge confirmed + processing → "In Progress"; drop pickedUp from customer view
      const confirmed  = Array.isArray(data.confirmed)  ? data.confirmed  : []
      const processing = Array.isArray(data.processing) ? data.processing : []
      setInProgress([...confirmed, ...processing])
      setReady(Array.isArray(data.ready) ? data.ready : [])
      setLastUpdate(new Date())
      setLoading(false)
    } catch { setError('Network error') }
  }, [token])

  useEffect(() => {
    if (!token) { setError('Missing display board token (?t=...)'); setLoading(false); return }
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load, token])

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
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#0f172a' }}>
      <CircularProgress sx={{ color: '#94a3b8' }} />
    </Box>
  )

  if (error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#0f172a', p: 4, textAlign: 'center' }}>
      <Box>
        <Typography sx={{ color: '#f87171', fontSize: 20, mb: 1 }}>⚠ {error}</Typography>
        <Typography sx={{ color: '#475569', fontSize: 14 }}>Ask staff to click "Display Board" in Shop Orders.</Typography>
      </Box>
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
        py: { xs: 1, md: 1.75 },
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
          Order Status
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 } }}>
          {lastUpdate && (
            <Typography sx={{ color: '#475569', fontSize: { xs: 11, md: 13 }, display: { xs: 'none', sm: 'block' } }}>
              Updated {lastUpdate.toLocaleTimeString('vi-VN')}
            </Typography>
          )}
          <Typography sx={{
            fontWeight: 900,
            fontSize: { xs: 16, md: 22 },
            color: '#64748b',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 1,
          }}>
            {clock.toLocaleTimeString('vi-VN')}
          </Typography>
        </Box>
      </Box>

      {/*
        Desktop: side-by-side 50/50 (flex row, both panels flex:1)
        Mobile:  stacked — Ready on TOP, In Progress below
                 achieved with column-reverse so second JSX child (Ready) renders at top
      */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: { xs: 'column-reverse', md: 'row' },
        minHeight: 0,
        overflow: 'hidden',
        gap: { xs: 0, md: '3px' },
        bgcolor: '#334155', // shows as thin divider on desktop
      }}>

        {/* Left (desktop) / Bottom (mobile): In Progress */}
        <Column
          title="In Progress"
          emoji="🍳"
          subtitle="Your order is being prepared"
          orders={inProgress}
          ready={false}
          emptyText="No orders in progress"
          headerBg="#1e3a5f"
          headerColor="#60a5fa"
          panelBg="#f8fafc"
          borderColor="#bfdbfe"
        />

        {/* Right (desktop) / Top (mobile): Ready for pickup */}
        <Column
          title="Ready"
          emoji="✅"
          subtitle="Please come pick up your order"
          orders={ready}
          ready={true}
          emptyText="Nothing ready yet"
          headerBg="#14532d"
          headerColor="#4ade80"
          panelBg="#f0fdf4"
          borderColor="#86efac"
        />

      </Box>
    </Box>
  )
}
