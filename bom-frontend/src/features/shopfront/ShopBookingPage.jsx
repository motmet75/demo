import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import TableBarIcon from '@mui/icons-material/TableBar'
import { useI18n } from '../../i18n/I18nContext'
import { fetchDaySlots, createReservation } from '../../api/shopApi'

const DURATION_OPTIONS = [60, 90, 120, 180]
const TIME_STEP_MINUTES = 30

function pad(n) { return String(n).padStart(2, '0') }

function localDayBounds(dateStr) {
  // dateStr: 'YYYY-MM-DD' in the browser's local time zone
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T00:00:00`)
  end.setDate(end.getDate() + 1)
  return { dayStart: start.toISOString(), dayEnd: end.toISOString() }
}

function timeOptionsForDate(dateStr) {
  const now = new Date()
  const isToday = dateStr === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const options = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += TIME_STEP_MINUTES) {
      const d = new Date(`${dateStr}T${pad(h)}:${pad(m)}:00`)
      if (isToday && d.getTime() < now.getTime() + 15 * 60000) continue // at least 15 min lead time
      options.push(`${pad(h)}:${pad(m)}`)
    }
  }
  return options
}

export default function ShopBookingPage() {
  const [params] = useSearchParams()
  const tenantId = params.get('tenantId')
  const companyId = params.get('companyId')
  const { language, setLanguage, t } = useI18n()
  const rawLanguage = params.get('lang') || params.get('language') || ''
  useEffect(() => { if (rawLanguage) setLanguage(rawLanguage) }, [rawLanguage, setLanguage])

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  const [date, setDate] = useState(today)
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState(90)
  const [partySize, setPartySize] = useState(2)
  const [daySlots, setDaySlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedTableId, setSelectedTableId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(null)

  const timeOptions = useMemo(() => timeOptionsForDate(date), [date])

  useEffect(() => {
    if (!timeOptions.includes(time)) setTime(timeOptions[0] || '')
  }, [timeOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDaySlots = useCallback(() => {
    if (!tenantId || !companyId || !date) return
    setLoadingSlots(true)
    const { dayStart, dayEnd } = localDayBounds(date)
    fetchDaySlots(tenantId, companyId, dayStart, dayEnd)
      .then(({ data }) => setDaySlots(Array.isArray(data) ? data : []))
      .catch(() => setError(t('booking.loadFailed') || 'Failed to load availability'))
      .finally(() => setLoadingSlots(false))
  }, [tenantId, companyId, date]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadDaySlots() }, [loadDaySlots])

  const selectedStart = useMemo(() => {
    if (!date || !time) return null
    return new Date(`${date}T${time}:00`)
  }, [date, time])

  const availableTables = useMemo(() => {
    if (!selectedStart) return []
    const start = selectedStart.getTime()
    const end = start + duration * 60000
    return daySlots.filter(table => {
      const booked = table.booked || []
      return !booked.some(b => {
        const bStart = new Date(b.start).getTime()
        const bEnd = new Date(b.end).getTime()
        return bStart < end && bEnd > start
      })
    })
  }, [daySlots, selectedStart, duration])

  useEffect(() => {
    if (selectedTableId && !availableTables.some(t => t.tableId === selectedTableId)) {
      setSelectedTableId('')
    }
  }, [availableTables, selectedTableId])

  const handleSubmit = async () => {
    setError('')
    if (!selectedTableId) { setError(t('booking.selectTable') || 'Please select a table'); return }
    if (!customerName.trim()) { setError(t('booking.nameRequired') || 'Name is required'); return }
    if (!selectedStart) { setError(t('booking.timeRequired') || 'Please select a time'); return }
    setSubmitting(true)
    try {
      const { res, data } = await createReservation(tenantId, companyId, {
        tableId: selectedTableId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || null,
        customerEmail: customerEmail.trim() || null,
        partySize: Number(partySize) || 1,
        reservationTime: selectedStart.toISOString(),
        durationMinutes: duration,
        note: note.trim() || null,
      })
      if (!res.ok) { setError(data?.error || t('booking.submitFailed') || 'Booking failed'); setSubmitting(false); return }
      setConfirmed(data)
    } catch {
      setError(t('booking.submitFailed') || 'Booking failed')
    }
    setSubmitting(false)
  }

  if (!tenantId || !companyId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Missing shop reference — please use the link provided by the shop.</Typography>
      </Box>
    )
  }

  if (confirmed) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 3, mt: 4, textAlign: 'center' }}>
        <EventAvailableIcon sx={{ fontSize: 56, color: '#2e7d32', mb: 1 }} />
        <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
          {t('booking.confirmedTitle') || 'Reservation requested'}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('booking.confirmedBody') || 'We\'ve received your booking. The shop will confirm it shortly.'}
        </Typography>
        <Box sx={{ textAlign: 'left', bgcolor: '#f8fafc', borderRadius: 2, p: 2, border: '1px solid #e2e8f0' }}>
          <Typography variant="body2"><b>{t('booking.table') || 'Table'}:</b> {confirmed.tableName}</Typography>
          <Typography variant="body2"><b>{t('booking.time') || 'Time'}:</b> {new Date(confirmed.reservationTime).toLocaleString()}</Typography>
          <Typography variant="body2"><b>{t('booking.partySize') || 'Party size'}:</b> {confirmed.partySize}</Typography>
          <Typography variant="body2"><b>{t('booking.status') || 'Status'}:</b> {confirmed.status}</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', p: 2, pb: 6 }}>
      <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventAvailableIcon color="primary" /> {t('booking.title') || 'Book a table'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label={t('booking.date') || 'Date'}
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: today }}
          sx={{ flex: 1, minWidth: 150 }}
        />
        <TextField
          label={t('booking.time') || 'Time'}
          select
          SelectProps={{ native: true }}
          value={time}
          onChange={e => setTime(e.target.value)}
          sx={{ flex: 1, minWidth: 110 }}
        >
          {timeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </TextField>
        <TextField
          label={t('booking.duration') || 'Duration'}
          select
          SelectProps={{ native: true }}
          value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          sx={{ flex: 1, minWidth: 110 }}
        >
          {DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} {t('booking.minutes') || 'min'}</option>)}
        </TextField>
      </Box>

      <TextField
        label={t('booking.partySize') || 'Party size'}
        type="number"
        inputProps={{ min: 1, max: 50 }}
        value={partySize}
        onChange={e => setPartySize(e.target.value)}
        sx={{ mb: 2, width: 140 }}
      />

      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
        {t('booking.availableTables') || 'Available tables'}
      </Typography>

      {loadingSlots ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
      ) : availableTables.length === 0 ? (
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('booking.noTables') || 'No tables available for this time — try a different time or date.'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {availableTables.map(table => (
            <Chip
              key={table.tableId}
              icon={<TableBarIcon />}
              label={table.tableName}
              clickable
              color={selectedTableId === table.tableId ? 'primary' : 'default'}
              variant={selectedTableId === table.tableId ? 'filled' : 'outlined'}
              onClick={() => setSelectedTableId(table.tableId)}
            />
          ))}
        </Box>
      )}

      <TextField
        label={t('booking.customerName') || 'Your name'}
        value={customerName}
        onChange={e => setCustomerName(e.target.value)}
        fullWidth
        sx={{ mb: 1.5 }}
      />
      <TextField
        label={t('booking.customerPhone') || 'Phone number'}
        value={customerPhone}
        onChange={e => setCustomerPhone(e.target.value)}
        fullWidth
        sx={{ mb: 1.5 }}
      />
      <TextField
          label={t('booking.customerEmail') || 'Email (optional, for confirmation)'}
          type="email"
          value={customerEmail}
          onChange={e => setCustomerEmail(e.target.value)}
          fullWidth
          sx={{ mb: 1.5 }}
      />
      <TextField
        label={t('booking.note') || 'Note (optional)'}
        value={note}
        onChange={e => setNote(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        sx={{ mb: 2 }}
      />

      {error && <Typography color="error" sx={{ mb: 1.5 }}>{error}</Typography>}

      <Button
        variant="contained"
        fullWidth
        size="large"
        disabled={submitting}
        onClick={handleSubmit}
        sx={{ borderRadius: 20, fontWeight: 800, textTransform: 'none', py: 1.25 }}
      >
        {submitting ? <CircularProgress size={20} color="inherit" /> : (t('booking.submit') || 'Request booking')}
      </Button>
    </Box>
  )
}
