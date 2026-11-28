import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, ListItemText, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material'
import EventRepeatIcon from '@mui/icons-material/EventRepeat'
import RefreshIcon from '@mui/icons-material/Refresh'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend'
import {
  cancelPortalScheduleBatch, composePortalPosts, fetchPortalFacebookPages, fetchPortalScheduleBatches, schedulePortalPosts
} from '../../api/portalContentApi'

import {
  MAX_POSTS, MAX_PRODUCTS, MAX_ROUNDS, SEQUENCE_HELP, arrangeTimes, browserZone, fmt, fromLocalInput,
  imageCount, parseDayTimes, shiftRound, toLocalInput
} from './portalScheduleUtils'

const DEFAULT_SEQUENCE = '51267'
const MEDIA = [['IMAGE', 'Images'], ['VIDEO', 'Video'], ['BOTH', 'Both (video 1 min after images)']]

/** Initial state for one opening of the dialog: first post in one hour, then 30 minutes apart. */
function initialState(products) {
  const first = new Date(Date.now() + 60 * 60e3); first.setSeconds(0, 0)
  return {
    now: Date.now(),
    start: toLocalInput(first),
    rows: products.slice(0, MAX_PRODUCTS).map((product, i) => ({
      product,
      time: toLocalInput(new Date(first.getTime() + i * 30 * 60e3)),
      message: '',
      images: imageCount(product),
      hasVideo: null, // known once the server composes the message
    })),
  }
}

/** Mount only while open (the parent renders it conditionally), so every opening starts fresh. */
export function BulkScheduleDialog({ tenant, products, onClose, onScheduled }) {
  const [init] = useState(() => initialState(products))
  const [now, setNow] = useState(init.now)
  const [pages, setPages] = useState([])
  const [pageIds, setPageIds] = useState([])
  const [loadingPages, setLoadingPages] = useState(true)
  const [start, setStart] = useState(init.start)
  const [intervalValue, setIntervalValue] = useState(30)
  const [intervalUnit, setIntervalUnit] = useState('MINUTES')
  const [dayTimes, setDayTimes] = useState('')
  const [repeatTimes, setRepeatTimes] = useState(1)
  const [repeatEvery, setRepeatEvery] = useState(7)
  const [repeatUnit, setRepeatUnit] = useState('DAYS')
  const [sequence, setSequence] = useState(DEFAULT_SEQUENCE)
  const [extraLine, setExtraLine] = useState('')
  const [mediaType, setMediaType] = useState('IMAGE')
  const [composing, setComposing] = useState(false)
  const [rows, setRows] = useState(init.rows)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchPortalFacebookPages(tenant)
      .then(result => {
        if (!alive) return
        const items = Array.isArray(result) ? result : []
        setPages(items)
        setPageIds(items.length === 1 ? [items[0].id] : [])
      })
      .catch(e => { if (alive) setError(e.message || 'Cannot load Facebook Pages') })
      .finally(() => { if (alive) setLoadingPages(false) })
    // Re-check "is it still in the future" every 30 s while the dialog is open.
    const timer = window.setInterval(() => setNow(Date.now()), 30e3)
    return () => { alive = false; window.clearInterval(timer) }
  }, [tenant])

  const arrange = () => {
    const startDate = fromLocalInput(start)
    if (!startDate) { setError('Set a start time first.'); return }
    const fixed = dayTimes.trim() ? parseDayTimes(dayTimes) : []
    if (fixed === null) { setError('Times of day must look like 8,12,19 or 08:30,19:00.'); return }
    const times = arrangeTimes(rows.length, startDate, Math.max(1, Number(intervalValue) || 1), intervalUnit, fixed)
    setRows(prev => prev.map((row, i) => ({ ...row, time: toLocalInput(times[i]) })))
    setError('')
  }
  /** Same digit sequence as the Portal's bulk dialog; composed on the server from producttb + tokentb. */
  const applySequence = useCallback(async (seq, extra) => {
    if (!/^[0-7]+$/.test(seq)) { setError('Sequence may only contain digits 0-7, e.g. 51267.'); return }
    setComposing(true); setError('')
    try {
      const composed = await composePortalPosts(tenant, { sequence: seq, productIds: init.rows.map(row => row.product.id) })
      const byId = new Map((Array.isArray(composed) ? composed : []).map(post => [post.productId, post]))
      const tail = extra.trim()
      setRows(prev => prev.map(row => {
        const post = byId.get(row.product.id)
        if (!post) return row
        const message = [post.message, tail].filter(Boolean).join('\n')
        return { ...row, message, images: post.imageCount, hasVideo: post.hasVideo }
      }))
    } catch (e) { setError(e.message || 'Could not compose post messages') }
    finally { setComposing(false) }
  }, [tenant, init.rows])
  useEffect(() => {
    const timer = window.setTimeout(() => applySequence(DEFAULT_SEQUENCE, ''), 0)
    return () => window.clearTimeout(timer)
  }, [applySequence])
  const setRow = (index, key) => event => {
    const value = event.target.value
    setRows(prev => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const rounds = Math.min(MAX_ROUNDS, Math.max(1, Number(repeatTimes) || 1))
  const every = Math.max(1, Number(repeatEvery) || 1)
  const perPage = mediaType === 'BOTH' ? 2 : 1
  const total = rows.length * pageIds.length * rounds * perPage
  const times = rows.map(row => fromLocalInput(row.time)).filter(Boolean)
  const firstTime = times.length ? new Date(Math.min(...times)) : null
  const lastTime = times.length ? new Date(Math.max(...times)) : null
  const lastRoundStart = firstTime && rounds > 1 ? shiftRound(firstTime, rounds - 1, every, repeatUnit) : null

  const problems = (() => {
    const found = []
    if (!pageIds.length) found.push('Choose at least one Facebook Page.')
    rows.forEach(row => {
      const name = row.product.name || `#${row.product.id}`
      const at = fromLocalInput(row.time)
      if (!at || at.getTime() <= now) found.push(`${name}: choose a future time.`)
      if (!row.message.trim()) found.push(`${name}: post message is empty.`)
      if (mediaType !== 'VIDEO' && !row.images) found.push(`${name}: has no image (Facebook image post needs at least one).`)
      if (mediaType !== 'IMAGE' && row.hasVideo === false) found.push(`${name}: has no video (set Video in the product).`)
    })
    if (total > MAX_POSTS) found.push(`${total} posts is over the ${MAX_POSTS} limit.`)
    if (rounds > 1 && firstTime && lastTime) {
      const roundEnd = lastTime.getTime() + pageIds.length * perPage * 60e3
      if (shiftRound(firstTime, 1, every, repeatUnit).getTime() <= roundEnd)
        found.push('Repeat period is shorter than one round of posts; increase "Repeat every".')
    }
    return found
  })()

  const submit = async () => {
    if (problems.length) return
    setSaving(true); setError('')
    try {
      const result = await schedulePortalPosts(tenant, {
        pageIds, timezone: browserZone(), mediaType,
        repeat: { times: rounds, every, unit: repeatUnit },
        items: rows.map(row => ({ productId: row.product.id, scheduledTime: `${row.time}:00`, message: row.message })),
      })
      onScheduled?.(result)
    } catch (e) { setError(e.message || 'Could not schedule posts') }
    finally { setSaving(false) }
  }

  return <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xl">
    <DialogTitle>Schedule Facebook posts · {rows.length} product{rows.length === 1 ? '' : 's'}</DialogTitle>
    <DialogContent dividers>
      <Stack spacing={2}>
        {products.length > MAX_PRODUCTS && <Alert severity="warning">Only the first {MAX_PRODUCTS} selected products are used.</Alert>}
        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
          <TextField select fullWidth label="Facebook Pages" value={pageIds}
            SelectProps={{ multiple: true, renderValue: ids => ids.map(id => pages.find(p => p.id === id)?.name || id).join(', ') }}
            onChange={event => setPageIds(typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value)}
            helperText={loadingPages ? 'Loading Pages…' : pages.length ? 'Each product is posted to every chosen Page, 1 minute apart.' : 'No Facebook Page is connected in this website yet (connect it in the Portal).'}
            disabled={loadingPages || !pages.length} sx={{ maxWidth: { md: 420 } }}>
            {pages.map(page => <MenuItem key={page.id} value={page.id}>
              <Checkbox size="small" checked={pageIds.includes(page.id)} />
              <ListItemText primary={page.name} secondary={page.name === page.id ? null : page.id} />
            </MenuItem>)}
          </TextField>
          <TextField select label="Media" value={mediaType} onChange={e => setMediaType(e.target.value)} sx={{ minWidth: 260 }}
            helperText="Facebook cannot mix video and images in one post; Both queues two posts.">
            {MEDIA.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
        </Stack>

        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Post message</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
            <TextField label="Append sequence" value={sequence} sx={{ width: 180 }} placeholder={DEFAULT_SEQUENCE}
              onChange={e => setSequence(e.target.value.replace(/[^0-7]/g, ''))} helperText="Facebook = 51267" />
            <TextField label="Extra line (optional)" value={extraLine} onChange={e => setExtraLine(e.target.value)} fullWidth
              placeholder="#migiatruyen #monngon" helperText={SEQUENCE_HELP} />
            <Button variant="outlined" onClick={() => applySequence(sequence, extraLine)} disabled={composing || !sequence}
              startIcon={composing ? <CircularProgress size={14} /> : null} sx={{ whiteSpace: 'nowrap', mt: { md: 1 } }}>
              Apply to all
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Times</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField type="datetime-local" label="First post" value={start} onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField type="number" label="Then every" value={intervalValue} onChange={e => setIntervalValue(e.target.value)} inputProps={{ min: 1 }} sx={{ width: 120 }} disabled={Boolean(dayTimes.trim())} />
            <TextField select label="Unit" value={intervalUnit} onChange={e => setIntervalUnit(e.target.value)} sx={{ width: 130 }} disabled={Boolean(dayTimes.trim())}>
              <MenuItem value="MINUTES">Minutes</MenuItem><MenuItem value="HOURS">Hours</MenuItem><MenuItem value="DAYS">Days</MenuItem>
            </TextField>
            <TextField label="Or fixed times of day" value={dayTimes} onChange={e => setDayTimes(e.target.value)} placeholder="8,12,19" sx={{ width: 190 }} />
            <Button variant="outlined" onClick={arrange}>Arrange times</Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <EventRepeatIcon fontSize="small" color="primary" /><Typography variant="subtitle2">Repeat the whole group</Typography>
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <TextField type="number" label="Repeat (times)" value={repeatTimes} onChange={e => setRepeatTimes(e.target.value)}
              inputProps={{ min: 1, max: MAX_ROUNDS }} helperText="1 = post once" sx={{ width: 150 }} />
            <TextField type="number" label="Repeat every" value={repeatEvery} onChange={e => setRepeatEvery(e.target.value)}
              inputProps={{ min: 1 }} disabled={rounds < 2} sx={{ width: 130 }} />
            <TextField select label="Unit" value={repeatUnit} onChange={e => setRepeatUnit(e.target.value)} disabled={rounds < 2} sx={{ width: 130 }}>
              <MenuItem value="HOURS">Hours</MenuItem><MenuItem value="DAYS">Days</MenuItem><MenuItem value="WEEKS">Weeks</MenuItem>
            </TextField>
            <Typography variant="body2" fontWeight={700}>
              {rows.length} product{rows.length === 1 ? '' : 's'} × {pageIds.length} Page{pageIds.length === 1 ? '' : 's'}
              {rounds > 1 ? ` × ${rounds} rounds` : ''} = {total} post{total === 1 ? '' : 's'}
              {lastRoundStart ? ` · last round starts ${fmt(lastRoundStart)}` : ''}
            </Typography>
          </Stack>
        </Paper>

        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '45vh' }}>
          <Table stickyHeader size="small">
            <TableHead><TableRow>
              <TableCell width={40}>#</TableCell><TableCell width={220}>Product</TableCell>
              <TableCell width={120}>Media</TableCell><TableCell width={230}>Time (round 1)</TableCell><TableCell>Message</TableCell>
            </TableRow></TableHead>
            <TableBody>{rows.map((row, i) => <TableRow key={row.product.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell><Typography variant="body2" fontWeight={700}>{row.product.name}</Typography>
                <Typography variant="caption" color="text.secondary">{row.product.code}</Typography></TableCell>
              <TableCell><Stack direction="row" spacing={0.5}>
                <Chip size="small" label={`${row.images} img`} color={row.images ? 'success' : 'error'} variant={row.images ? 'outlined' : 'filled'} />
                {row.hasVideo !== null && <Chip size="small" label={row.hasVideo ? 'video' : 'no video'}
                  color={row.hasVideo ? 'success' : 'default'} variant="outlined" />}
              </Stack></TableCell>
              <TableCell><TextField type="datetime-local" size="small" value={row.time} onChange={setRow(i, 'time')} /></TableCell>
              <TableCell><TextField multiline minRows={2} maxRows={8} fullWidth size="small" value={row.message} onChange={setRow(i, 'message')} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </TableContainer>

        {problems.length > 0 && <Alert severity="warning">
          {problems.slice(0, 5).map(problem => <div key={problem}>{problem}</div>)}
          {problems.length > 5 && <div>…and {problems.length - 5} more.</div>}
        </Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Cancel</Button>
      <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <ScheduleSendIcon />}
        onClick={submit} disabled={saving || composing || problems.length > 0 || !rows.length}>
        {saving ? 'Scheduling…' : `Schedule ${total} post${total === 1 ? '' : 's'}`}
      </Button>
    </DialogActions>
  </Dialog>
}

export function ScheduledBatches({ tenant, reloadKey }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    if (!tenant) return
    setLoading(true); setError('')
    try { const result = await fetchPortalScheduleBatches(tenant); setRows(Array.isArray(result) ? result : []) }
    catch (e) { setError(e.message || 'Cannot load scheduled posts') }
    finally { setLoading(false) }
  }, [tenant])
  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load, reloadKey])

  const cancel = async batch => {
    if (!window.confirm(`Cancel the ${batch.waiting} waiting post(s) of batch ${batch.batchId}? Posts already published stay on Facebook.`)) return
    setBusy(batch.batchId); setError('')
    try { await cancelPortalScheduleBatch(tenant, batch.batchId); await load() }
    catch (e) { setError(e.message || 'Cannot cancel batch') }
    finally { setBusy('') }
  }

  return <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1 }}>Scheduled posts</Typography>
      <Button size="small" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
    {loading ? <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box>
      : rows.length === 0 ? <Typography variant="body2" color="text.secondary">No batches scheduled from here yet.</Typography>
        : <TableContainer sx={{ maxHeight: 260 }}><Table size="small" stickyHeader>
          <TableHead><TableRow>
            <TableCell>Batch</TableCell><TableCell>Products</TableCell><TableCell>Repeat</TableCell>
            <TableCell align="right">Waiting</TableCell><TableCell align="right">Posted</TableCell><TableCell align="right">Failed</TableCell>
            <TableCell>Next post</TableCell><TableCell>Last post</TableCell><TableCell />
          </TableRow></TableHead>
          <TableBody>{rows.map(batch => <TableRow key={batch.batchId} hover>
            <TableCell sx={{ fontFamily: 'monospace' }}>{batch.batchId}</TableCell>
            <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={batch.productCodes}>{batch.productCodes}</TableCell>
            <TableCell>{batch.repeating === 'none' ? 'Once' : batch.repeating}</TableCell>
            <TableCell align="right">{batch.waiting}</TableCell><TableCell align="right">{batch.posted}</TableCell>
            <TableCell align="right" sx={{ color: batch.failed ? 'error.main' : undefined }}>{batch.failed}</TableCell>
            <TableCell>{fmt(batch.nextTime)}</TableCell><TableCell>{fmt(batch.lastTime)}</TableCell>
            <TableCell>{batch.waiting > 0 && <Button size="small" color="error" disabled={busy === batch.batchId} onClick={() => cancel(batch)}>Cancel</Button>}</TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
  </Paper>
}
