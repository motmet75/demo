import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchDisplayBoard } from '../../api/shopApi'

const POLL_MS = 4000
const BOARD_CHANNEL = 'shop_display_board'

function OrderCard({ order, ready }) {
  const num   = order.orderNumber ?? '?'
  const label = order.tableName
    ? `Table ${order.tableName}`
    : order.customerName || (order.fulfillmentType === 'PICKUP' ? 'Pickup' : 'Order')

  return (
    <Box sx={{
      bgcolor: ready ? '#f0fdf4' : '#fff',
      border: `2px solid ${ready ? '#86efac' : '#e5e7eb'}`,
      borderRadius: 3,
      p: { xs: 2, md: 3 },
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.5,
      animation: ready ? 'glow 2.5s ease-in-out infinite' : 'none',
      '@keyframes glow': {
        '0%,100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
        '50%': { boxShadow: '0 0 0 6px rgba(34,197,94,0.12)' },
      },
    }}>
      <Typography sx={{
        fontSize: { xs: 56, md: 80, lg: 96 },
        fontWeight: 900,
        lineHeight: 1,
        color: ready ? '#16a34a' : '#374151',
        letterSpacing: -3,
      }}>
        {num}
      </Typography>
      <Typography sx={{
        fontSize: { xs: 13, md: 15 },
        fontWeight: 600,
        color: ready ? '#15803d' : '#6b7280',
        mt: 0.5,
      }}>
        {label}
      </Typography>
      {ready && (
        <Typography sx={{ fontSize: 11, color: '#86efac', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
          Pick up now
        </Typography>
      )}
    </Box>
  )
}

function Panel({ title, count, ready, orders, emptyText }) {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: ready ? '#f0fdf4' : '#f8fafc',
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <Box sx={{
        px: { xs: 2, md: 4 },
        py: { xs: 1.5, md: 2 },
        bgcolor: ready ? '#dcfce7' : '#f1f5f9',
        borderBottom: `2px solid ${ready ? '#bbf7d0' : '#e2e8f0'}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontSize: { xs: 18, md: 22, lg: 26 },
          fontWeight: 900,
          color: ready ? '#15803d' : '#374151',
          textTransform: 'uppercase',
          letterSpacing: 1,
          flex: 1,
        }}>
          {title}
        </Typography>
        <Box sx={{
          bgcolor: ready ? '#16a34a' : '#94a3b8',
          color: '#fff',
          borderRadius: 99,
          px: 1.75, py: 0.25,
          fontWeight: 800,
          fontSize: { xs: 14, md: 16 },
          minWidth: 32,
          textAlign: 'center',
        }}>
          {count}
        </Box>
      </Box>

      {/* Cards grid */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',
        p: { xs: 1.5, md: 2.5 },
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(auto-fill, minmax(100px, 1fr))',
          md: 'repeat(auto-fill, minmax(140px, 1fr))',
          lg: 'repeat(auto-fill, minmax(160px, 1fr))',
        },
        gap: { xs: 1, md: 1.5 },
        alignContent: 'start',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 4 },
      }}>
        {orders.length === 0 ? (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: 40, mb: 1 }}>{ready ? '✓' : '🕐'}</Typography>
            <Typography sx={{ color: '#9ca3af', fontSize: 15 }}>{emptyText}</Typography>
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
        setError(data?.error || 'Token expired. Ask staff to regenerate the display board URL.')
        return
      }
      if (!res.ok) { setError('Failed to load orders'); return }
      setPreparing(Array.isArray(data.preparing) ? data.preparing : [])
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
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f8fafc' }}>
      <CircularProgress />
    </Box>
  )

  if (error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#f8fafc', p: 4, textAlign: 'center' }}>
      <Box>
        <Typography sx={{ color: '#ef4444', fontSize: 18, mb: 1 }}>⚠ {error}</Typography>
        <Typography sx={{ color: '#94a3b8', fontSize: 14 }}>Ask staff to click "Display Board" in Shop Orders.</Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f8fafc', overflow: 'hidden' }}>

      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: { xs: 2, md: 4 }, py: { xs: 1, md: 1.5 },
        bgcolor: '#fff',
        borderBottom: '1.5px solid #e2e8f0',
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <Typography sx={{
          fontWeight: 900, fontSize: { xs: 14, md: 18 },
          letterSpacing: 2, textTransform: 'uppercase', color: '#1e293b',
        }}>
          Order Display
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 } }}>
          {lastUpdate && (
            <Typography sx={{ color: '#94a3b8', fontSize: { xs: 11, md: 12 }, display: { xs: 'none', sm: 'block' } }}>
              Updated {lastUpdate.toLocaleTimeString('vi-VN')}
            </Typography>
          )}
          <Typography sx={{
            fontWeight: 800, fontSize: { xs: 15, md: 20 },
            color: '#374151', fontVariantNumeric: 'tabular-nums',
          }}>
            {clock.toLocaleTimeString('vi-VN')}
          </Typography>
        </Box>
      </Box>

      {/* Split panels */}
      <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Panel
          title="In Progress"
          count={preparing.length}
          ready={false}
          orders={preparing}
          emptyText="All orders are ready!"
        />
        <Box sx={{ width: 2, bgcolor: '#e2e8f0', flexShrink: 0 }} />
        <Panel
          title="Ready ✓"
          count={ready.length}
          ready={true}
          orders={ready}
          emptyText="Nothing ready yet"
        />
      </Box>
    </Box>
  )
}
