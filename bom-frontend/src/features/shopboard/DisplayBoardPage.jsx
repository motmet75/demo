import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import { fetchDisplayBoard } from '../../api/shopApi'

const POLL_MS = 4000
const BOARD_CHANNEL = 'shop_display_board'

function parseOpts(str) {
  if (!str) return []
  try {
    const obj = JSON.parse(str)
    return Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
  } catch { return [] }
}

function buildChildMap(items) {
  const map = {}
  for (const item of (items || [])) {
    if (item.parentItemId) {
      const key = String(item.parentItemId)
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
  }
  return map
}

function OrderCard({ order, colStyle }) {
  const num = order.orderNumber ?? order.orderCode ?? '?'
  const label = order.tableName
    ? `Table ${order.tableName}`
    : order.customerName || (order.fulfillmentType === 'PICKUP' ? 'Pickup' : '')

  const allItems = order.items || []
  const childMap = buildChildMap(allItems)
  const rootItems = allItems.filter(it => !it.parentItemId)

  return (
    <Box sx={{
      bgcolor: colStyle.cardBg,
      border: `2px solid ${colStyle.border}`,
      borderRadius: 2,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      animation: colStyle.glow ? 'glow 2.5s ease-in-out infinite' : 'none',
      '@keyframes glow': {
        '0%,100%': { boxShadow: `0 0 0 0 ${colStyle.glowColor}00` },
        '50%':     { boxShadow: `0 0 0 8px ${colStyle.glowColor}28` },
      },
    }}>

      {/* Card header — order number + label */}
      <Box sx={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 0.5,
        px: 1.25,
        pt: 1,
        pb: 0.5,
        borderBottom: `1.5px solid ${colStyle.border}`,
        bgcolor: colStyle.headerBg,
      }}>
        <Typography sx={{
          fontSize: { xs: 28, md: 36, lg: 44 },
          fontWeight: 900,
          lineHeight: 1,
          color: colStyle.numColor,
          letterSpacing: -2,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {typeof num === 'number' ? `#${num}` : num}
        </Typography>
        {label && (
          <Typography sx={{
            fontSize: { xs: 10, md: 11 },
            fontWeight: 700,
            color: colStyle.labelColor,
            textAlign: 'right',
            lineHeight: 1.2,
            maxWidth: 72,
            wordBreak: 'break-word',
          }}>
            {label}
          </Typography>
        )}
      </Box>

      {/* Items list */}
      <Box sx={{ px: 1, pt: 0.75, pb: 0.75, flex: 1 }}>
        {rootItems.length === 0 ? (
          <Typography sx={{ fontSize: 10, color: colStyle.labelColor, fontStyle: 'italic' }}>No items</Typography>
        ) : (
          rootItems.map((item, idx) => {
            const children = childMap[String(item.id)] || []
            const opts = parseOpts(item.selectedOptions)
            const rowNum = idx + 1
            return (
              <Box key={item.id || idx} sx={{ mb: children.length > 0 ? 0.75 : 0.4 }}>
                {/* Root item row: "1.  2× Matcha Naoki  opt1 · opt2" */}
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, flexWrap: 'wrap' }}>
                  <Typography sx={{
                    fontSize: { xs: 9, md: 10 },
                    fontWeight: 700,
                    color: colStyle.labelColor,
                    flexShrink: 0,
                    lineHeight: 1.4,
                    minWidth: 16,
                  }}>
                    {rowNum}.
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: 10, md: 11 },
                    fontWeight: 900,
                    color: colStyle.qtyColor,
                    flexShrink: 0,
                    lineHeight: 1.4,
                  }}>
                    {Number(item.quantity)}×
                  </Typography>
                  <Typography sx={{
                    fontSize: { xs: 11, md: 12 },
                    fontWeight: 700,
                    color: colStyle.itemColor,
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}>
                    {item.modelName}
                  </Typography>
                  {opts.length > 0 && (
                    <Typography sx={{
                      fontSize: { xs: 9, md: 10 },
                      fontWeight: 600,
                      color: colStyle.optColor,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}>
                      {opts.join(' · ')}
                    </Typography>
                  )}
                </Box>

                {/* Note */}
                {item.itemNotes && (
                  <Typography sx={{
                    fontSize: { xs: 9, md: 10 },
                    color: '#f59e0b',
                    fontWeight: 700,
                    pl: 2.5,
                    fontStyle: 'italic',
                    lineHeight: 1.4,
                  }}>
                    ⚠ {item.itemNotes}
                  </Typography>
                )}

                {/* Child / topping rows: "  1.1  1× Top Cheese-Boba" */}
                {children.map((child, ci) => (
                  <Box key={child.id || ci} sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 0.4,
                    pl: 2.5,
                    mt: 0.2,
                    borderLeft: `2px solid ${colStyle.childBorder}`,
                    ml: 1,
                  }}>
                    <Typography sx={{
                      fontSize: { xs: 9, md: 10 },
                      fontWeight: 700,
                      color: colStyle.labelColor,
                      flexShrink: 0,
                      lineHeight: 1.4,
                      minWidth: 24,
                    }}>
                      {rowNum}.{ci + 1}
                    </Typography>
                    <Typography sx={{
                      fontSize: { xs: 9, md: 10 },
                      fontWeight: 900,
                      color: colStyle.childColor,
                      flexShrink: 0,
                      lineHeight: 1.4,
                    }}>
                      {Number(child.quantity)}×
                    </Typography>
                    <Typography sx={{
                      fontSize: { xs: 9, md: 10 },
                      color: colStyle.childColor,
                      lineHeight: 1.3,
                      fontWeight: 600,
                      wordBreak: 'break-word',
                    }}>
                      {child.modelName}
                    </Typography>
                    {child.itemNotes && (
                      <Typography sx={{ fontSize: 9, color: '#f59e0b', fontStyle: 'italic', ml: 0.25 }}>
                        ⚠ {child.itemNotes}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )
          })
        )}
      </Box>

      {/* Ready badge */}
      {colStyle.readyBadge && (
        <Box sx={{
          bgcolor: colStyle.border,
          textAlign: 'center',
          py: 0.4,
        }}>
          <Typography sx={{
            fontSize: { xs: 9, md: 10 },
            fontWeight: 900,
            color: '#fff',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}>
            Ready ✓
          </Typography>
        </Box>
      )}
    </Box>
  )
}

const COL_QUEUED = {
  cardBg: '#fefce8', headerBg: '#fef9c3', border: '#fbbf24',
  numColor: '#92400e', labelColor: '#78350f', qtyColor: '#d97706',
  itemColor: '#1c1917', optBg: '#fde68a', optColor: '#92400e',
  childBorder: '#fcd34d', childColor: '#b45309',
  glow: false, glowColor: '#fbbf24', readyBadge: false,
}
const COL_MAKING = {
  cardBg: '#eff6ff', headerBg: '#dbeafe', border: '#3b82f6',
  numColor: '#1d4ed8', labelColor: '#1e40af', qtyColor: '#2563eb',
  itemColor: '#1e293b', optBg: '#bfdbfe', optColor: '#1e40af',
  childBorder: '#93c5fd', childColor: '#1d4ed8',
  glow: false, glowColor: '#3b82f6', readyBadge: false,
}
const COL_READY = {
  cardBg: '#f0fdf4', headerBg: '#dcfce7', border: '#22c55e',
  numColor: '#15803d', labelColor: '#166534', qtyColor: '#16a34a',
  itemColor: '#1c1917', optBg: '#bbf7d0', optColor: '#166534',
  childBorder: '#86efac', childColor: '#15803d',
  glow: true, glowColor: '#22c55e', readyBadge: true,
}

function Column({ title, emoji, subtitle, orders, colStyle, emptyEmoji, emptyText, headerBg, headerColor, borderColor }) {
  return (
    <Box sx={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      bgcolor: colStyle.cardBg,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Column header */}
      <Box sx={{
        px: { xs: 1.5, md: 3 },
        py: { xs: 1.25, md: 2 },
        bgcolor: headerBg,
        borderBottom: `3px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexShrink: 0,
      }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{
            fontSize: { xs: 14, md: 18, lg: 22 },
            fontWeight: 900,
            color: headerColor,
            textTransform: 'uppercase',
            letterSpacing: 2,
            lineHeight: 1,
          }}>
            {emoji}&nbsp;{title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: { xs: 10, md: 12 }, color: headerColor, opacity: 0.65, mt: 0.4 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{
          bgcolor: headerColor,
          color: headerBg,
          borderRadius: 99,
          px: 1.75, py: 0.4,
          fontWeight: 900,
          fontSize: { xs: 18, md: 26 },
          minWidth: 40,
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
        p: { xs: 1, md: 1.5 },
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(auto-fill, minmax(120px, 1fr))',
          md: 'repeat(auto-fill, minmax(160px, 1fr))',
          lg: 'repeat(auto-fill, minmax(185px, 1fr))',
        },
        gap: { xs: 1, md: 1.25 },
        alignContent: 'start',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: borderColor, borderRadius: 4 },
      }}>
        {orders.length === 0 ? (
          <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: { xs: 5, md: 10 } }}>
            <Typography sx={{ fontSize: { xs: 32, md: 48 }, mb: 1 }}>{emptyEmoji}</Typography>
            <Typography sx={{ color: headerColor, opacity: 0.4, fontSize: { xs: 12, md: 15 }, fontWeight: 600 }}>
              {emptyText}
            </Typography>
          </Box>
        ) : (
          orders.map(o => <OrderCard key={o.id} order={o} colStyle={colStyle} />)
        )}
      </Box>
    </Box>
  )
}

export default function DisplayBoardPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t')

  const [confirmed,  setConfirmed]  = useState([])
  const [processing, setProcessing] = useState([])
  const [ready,      setReady]      = useState([])
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(true)
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
      setConfirmed(Array.isArray(data.confirmed)   ? data.confirmed   : [])
      setProcessing(Array.isArray(data.processing) ? data.processing  : [])
      setReady(Array.isArray(data.ready)           ? data.ready       : [])
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#f1f5f9', overflow: 'hidden' }}>

      {/* Top bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: { xs: 2, md: 5 },
        py: { xs: 0.75, md: 1.25 },
        bgcolor: '#0f172a',
        borderBottom: '2px solid #1e293b',
        flexShrink: 0,
      }}>
        <Typography sx={{
          fontWeight: 900,
          fontSize: { xs: 13, md: 18 },
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#f1f5f9',
        }}>
          Order Status
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 4 } }}>
          {lastUpdate && (
            <Typography sx={{ color: '#475569', fontSize: { xs: 10, md: 12 }, display: { xs: 'none', sm: 'block' } }}>
              Updated {lastUpdate.toLocaleTimeString('vi-VN')}
            </Typography>
          )}
          <Typography sx={{
            fontWeight: 900,
            fontSize: { xs: 14, md: 20 },
            color: '#64748b',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: 1,
          }}>
            {clock.toLocaleTimeString('vi-VN')}
          </Typography>
        </Box>
      </Box>

      {/* Three-column layout */}
      <Box sx={{
        flex: 1,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        minHeight: 0,
        overflow: 'hidden',
        gap: '2px',
        bgcolor: '#cbd5e1',
      }}>

        {/* 1. Queued (confirmed, waiting to start) */}
        <Column
          title="Queued"
          emoji="🕐"
          subtitle="Waiting to start"
          orders={confirmed}
          colStyle={COL_QUEUED}
          emptyEmoji="✓"
          emptyText="No orders queued"
          headerBg="#fef3c7"
          headerColor="#92400e"
          borderColor="#fbbf24"
        />

        {/* 2. Making (in preparation) */}
        <Column
          title="Making"
          emoji="🍳"
          subtitle="Being prepared now"
          orders={processing}
          colStyle={COL_MAKING}
          emptyEmoji="☕"
          emptyText="Nothing in progress"
          headerBg="#dbeafe"
          headerColor="#1e40af"
          borderColor="#3b82f6"
        />

        {/* 3. Ready for pickup */}
        <Column
          title="Ready"
          emoji="✅"
          subtitle="Please come pick up"
          orders={ready}
          colStyle={COL_READY}
          emptyEmoji="🎉"
          emptyText="Nothing ready yet"
          headerBg="#dcfce7"
          headerColor="#15803d"
          borderColor="#22c55e"
        />

      </Box>
    </Box>
  )
}
