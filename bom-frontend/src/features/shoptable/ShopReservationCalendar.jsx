import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import TodayIcon from '@mui/icons-material/Today'
import {
  fetchStaffDaySlots, confirmReservation, seatReservation,
  completeReservation, cancelReservationStaff, markReservationNoShow, createStaffReservation, restoreReservation,
} from '../../api/shopApi'

const DAY_START_HOUR = 6
const DAY_END_HOUR = 24
const PX_PER_HOUR = 72

const STATUS_COLORS = {
  PENDING:   { bg: '#fff8e1', border: '#f59e0b', text: '#92400e' },
  CONFIRMED: { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
  SEATED:    { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' },
}

function pad(n) { return String(n).padStart(2, '0') }
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T00:00:00`)
  end.setDate(end.getDate() + 1)
  return { dayStart: start.toISOString(), dayEnd: end.toISOString() }
}
function hourOfDay(iso) {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}
function fmtTime(iso) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ShopReservationCalendar() {
  const [date, setDate] = useState(todayStr())
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null) // { reservationId, tableName, ... }
  const [createSlot, setCreateSlot] = useState(null) // { tableId, tableName, hour }
  const [busy, setBusy] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { label, run, needsReason }
  const [reasonText, setReasonText] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const { dayStart, dayEnd } = dayBounds(date)
    fetchStaffDaySlots(dayStart, dayEnd, showHidden)
        .then(({ data }) => setTables(Array.isArray(data) ? data : []))
        .catch(() => setError('Failed to load reservations'))
        .finally(() => setLoading(false))
  }, [date, showHidden])

  useEffect(() => { load() }, [load])

  const shiftDay = (delta) => {
    const d = new Date(`${date}T00:00:00`)
    d.setDate(d.getDate() + delta)
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
  }

  const hours = useMemo(() => {
    const arr = []
    for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) arr.push(h)
    return arr
  }, [])

  const totalWidth = (DAY_END_HOUR - DAY_START_HOUR) * PX_PER_HOUR

  const openReservation = (booked) => setDetail(booked)

  const runAction = async (fn) => {
    setBusy(true)
    try {
      await fn()
      setDetail(null)
      setCreateSlot(null)
      setConfirmAction(null)
      load()
    } catch (e) {
      setError(e.message || 'Action failed')
    }
    setBusy(false)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h6" fontWeight={900} sx={{ flex: 1 }}>Reservations</Typography>
        <IconButton onClick={() => shiftDay(-1)}><ChevronLeftIcon /></IconButton>
        <TextField type="date" size="small" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <IconButton onClick={() => shiftDay(1)}><ChevronRightIcon /></IconButton>
        <Button size="small" startIcon={<TodayIcon />} onClick={() => setDate(todayStr())}>Today</Button>
        <Button size="small" variant={showHidden ? 'contained' : 'outlined'} onClick={() => setShowHidden(v => !v)}>
          {showHidden ? 'Hide cancelled/no-show' : 'Show cancelled/no-show'}
        </Button>
      </Box>

      {error && <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : tables.length === 0 ? (
        <Typography color="text.secondary">No active tables configured.</Typography>
      ) : (
        <Box sx={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Box sx={{ minWidth: 140 + totalWidth }}>
            {/* Header row: hour labels */}
            <Box sx={{ display: 'flex', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, bgcolor: '#fff', zIndex: 2 }}>
              <Box sx={{ width: 140, flexShrink: 0, borderRight: '1px solid #e2e8f0' }} />
              {hours.map(h => (
                <Box key={h} sx={{ width: PX_PER_HOUR, flexShrink: 0, borderLeft: '1px solid #f1f5f9', py: 0.5, textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">{pad(h % 24)}:00</Typography>
                </Box>
              ))}
            </Box>

            {/* Table rows */}
            {tables.map(table => (
              <Box key={table.tableId} sx={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
                <Box sx={{ width: 140, flexShrink: 0, borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', px: 1.5, py: 1.5 }}>
                  <Typography variant="body2" fontWeight={800} noWrap>{table.tableName}</Typography>
                </Box>
                <Box sx={{ position: 'relative', width: totalWidth, height: 56 }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX - rect.left
                    const hour = DAY_START_HOUR + x / PX_PER_HOUR
                    const snapped = Math.round(hour * 2) / 2 // snap to 30 min
                    setCreateSlot({ tableId: table.tableId, tableName: table.tableName, hour: snapped })
                  }}
                >
                  {/* hour gridlines */}
                  {hours.map(h => (
                    <Box key={h} sx={{ position: 'absolute', left: (h - DAY_START_HOUR) * PX_PER_HOUR, top: 0, bottom: 0, borderLeft: '1px solid #f8fafc' }} />
                  ))}
                  {/* booked blocks */}
                  {(table.booked || []).map(b => {
                    const startHour = hourOfDay(b.start)
                    const endHour = Math.max(startHour + 0.25, hourOfDay(b.end) === 0 ? 24 : hourOfDay(b.end))
                    const left = Math.max(0, (startHour - DAY_START_HOUR) * PX_PER_HOUR)
                    const width = Math.max(24, (endHour - startHour) * PX_PER_HOUR)
                    const colors = STATUS_COLORS[b.status] || STATUS_COLORS.PENDING
                    return (
                        <Box key={b.reservationId}
                             onClick={(e) => { e.stopPropagation(); openReservation(b) }}
                             sx={{
                               position: 'absolute', left, width, top: 6, bottom: 6,
                               bgcolor: b.hidden ? '#f1f5f9' : colors.bg,
                               border: `1.5px solid ${b.hidden ? '#cbd5e1' : colors.border}`,
                               borderRadius: 1, px: 1, display: 'flex', alignItems: 'center', overflow: 'hidden', cursor: 'pointer',
                               opacity: b.hidden ? 0.6 : 1,
                               textDecoration: b.hidden ? 'line-through' : 'none',
                               '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' },
                             }}>
                          <Typography variant="caption" fontWeight={800} noWrap sx={{ color: b.hidden ? '#64748b' : colors.text }}>
                            {b.customerName} · {fmtTime(b.start)}
                          </Typography>
                        </Box>
                    )
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
        {Object.entries(STATUS_COLORS).map(([status, c]) => (
          <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: c.bg, border: `1.5px solid ${c.border}` }} />
            <Typography variant="caption" color="text.secondary">{status}</Typography>
          </Box>
        ))}
      </Box>

      {/* Reservation detail / status-change dialog */}
      <Dialog open={!!detail} onClose={() => setDetail(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{detail?.customerName}</DialogTitle>
        <DialogContent>
          {detail && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Typography variant="body2">Status: <b>{detail.status}</b></Typography>
                <Typography variant="body2">Time: {fmtTime(detail.start)} – {fmtTime(detail.end)}</Typography>
              </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {detail?.hidden ? (
              <Button disabled={busy} variant="contained" onClick={() => setConfirmAction({
                label: `Restore this reservation back to Pending?`,
                run: () => restoreReservation(detail.reservationId),
              })}>Recover</Button>
          ) : (
              <>
                {detail?.status === 'PENDING' && (
                    <Button disabled={busy} onClick={() => setConfirmAction({
                      label: 'Confirm this reservation?', run: () => confirmReservation(detail.reservationId),
                    })}>Confirm</Button>
                )}
                {(detail?.status === 'PENDING' || detail?.status === 'CONFIRMED') && (
                    <Button disabled={busy} onClick={() => setConfirmAction({
                      label: 'Seat this reservation now?', run: () => seatReservation(detail.reservationId),
                    })}>Seat</Button>
                )}
                {detail?.status === 'SEATED' && (
                    <Button disabled={busy} onClick={() => setConfirmAction({
                      label: 'Mark this reservation as completed?', run: () => completeReservation(detail.reservationId),
                    })}>Complete</Button>
                )}
                {detail?.status !== 'SEATED' && (
                    <Button disabled={busy} color="warning" onClick={() => setConfirmAction({
                      label: 'Mark this reservation as a no-show?', run: () => markReservationNoShow(detail.reservationId),
                    })}>No-show</Button>
                )}
                <Button disabled={busy} color="error" onClick={() => { setReasonText(''); setConfirmAction({
                  label: 'Cancel this reservation? This will email the customer if they provided one.',
                  needsReason: true,
                  run: () => cancelReservationStaff(detail.reservationId, reasonText),
                }) }}>Cancel</Button>
              </>
          )}
          <Button onClick={() => setDetail(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation step for every status change */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <Typography variant="body2">{confirmAction?.label}</Typography>
          {confirmAction?.needsReason && (
              <TextField label="Reason" value={reasonText} onChange={e => setReasonText(e.target.value)}
                         multiline minRows={2} autoFocus required />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Back</Button>
          <Button variant="contained" color="error" disabled={busy || (confirmAction?.needsReason && !reasonText.trim())}
                  onClick={() => runAction(confirmAction.run)}>
            {busy ? <CircularProgress size={18} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick create dialog (click empty slot) */}
      <QuickCreateDialog slot={createSlot} date={date} busy={busy}
        onClose={() => setCreateSlot(null)}
        onCreate={(payload) => runAction(() => createStaffReservation(payload))} />
    </Box>
  )
}

function QuickCreateDialog({ slot, date, busy, onClose, onCreate }) {
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [duration, setDuration] = useState(90)

  useEffect(() => {
    if (slot) { setCustomerName(''); setCustomerPhone(''); setPartySize(2); setDuration(90) }
  }, [slot])

  if (!slot) return null
  const h = Math.floor(slot.hour)
  const m = Math.round((slot.hour - h) * 60)
  const timeLabel = `${pad(h % 24)}:${pad(m)}`
  const reservationTime = new Date(`${date}T${pad(h % 24)}:${pad(m)}:00`).toISOString()

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>New booking — {slot.tableName} at {timeLabel}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <TextField label="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} autoFocus />
        <TextField label="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
        <TextField label="Party size" type="number" inputProps={{ min: 1 }} value={partySize} onChange={e => setPartySize(e.target.value)} />
        <TextField label="Duration (min)" type="number" inputProps={{ min: 15, step: 15 }} value={duration} onChange={e => setDuration(e.target.value)} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !customerName.trim()} onClick={() => onCreate({
          tableId: slot.tableId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim() || null,
          partySize: Number(partySize) || 1,
          reservationTime,
          durationMinutes: Number(duration) || 90,
        })}>
          {busy ? <CircularProgress size={18} /> : 'Book'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
