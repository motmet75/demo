import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, FormGroup, FormLabel, MenuItem, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend'
import {
  cancelPortalSchedule, createPortalSchedule, fetchPortalFacebookPages,
  fetchPortalProducts, fetchPortalSchedules
} from '../../api/portalContentApi'

const ACTIONS = [
  { value: 'post_facebook_multi_image', label: 'Facebook · images', video: false, facebook: true },
  { value: 'post_facebook_video', label: 'Facebook · video', video: true, facebook: true },
  { value: 'post_youtube_video', label: 'YouTube · video', video: true },
  { value: 'post_tiktok_video', label: 'TikTok · video', video: true, tiktok: true },
  { value: 'post_tiktok_image', label: 'TikTok · images', video: false, tiktok: true },
]
const PRIVACY = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Public' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Friends' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Followers' },
  { value: 'SELF_ONLY', label: 'Only me' },
]
const STATUS_COLOR = { pending: 'info', running: 'warning', retrying: 'warning', fired: 'success', done: 'success', failed: 'error', cancelled: 'default' }

const pad = n => String(n).padStart(2, '0')
/** Current time in Asia/Ho_Chi_Minh (UTC+7, no DST) as a datetime-local value. */
const vietnamNowPlus = minutes => {
  const d = new Date(Date.now() + (7 * 60 + minutes) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
const showTime = value => value ? value.replace('T', ' ').slice(0, 16) : '—'
const lines = text => (text || '').split('\n').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'none')
const videoIdOf = url => (url || '').match(/(?:video=|\/video\/|dai\.ly\/)([A-Za-z0-9]+)/)?.[1] || ''

function defaultMessage(product, page, tenant) {
  const parts = [product?.name || '']
  if (page?.contactLine && page.contactLine !== 'none') parts.push(page.contactLine)
  parts.push(`https://${tenant}/${product?.path || ''}`)
  return parts.filter(Boolean).join('\n')
}

function ScheduleDialog({ open, tenant, onClose, onCreated }) {
  const [products, setProducts] = useState([])
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [product, setProduct] = useState(null)
  const [actions, setActions] = useState(['post_facebook_multi_image', 'post_facebook_video'])
  const [pageId, setPageId] = useState('')
  const [message, setMessage] = useState('')
  const [images, setImages] = useState('')
  const [videoId, setVideoId] = useState('')
  const [privacy, setPrivacy] = useState('PUBLIC_TO_EVERYONE')
  const [when, setWhen] = useState(vietnamNowPlus(5))

  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    // Reset and load after the dialog opens (deferred, like PortalContentPage's tenant load).
    const timer = window.setTimeout(() => {
      setLoading(true); setError(''); setProduct(null); setMessage(''); setImages(''); setVideoId('')
      setWhen(vietnamNowPlus(5))
      Promise.all([fetchPortalProducts(tenant, ''), fetchPortalFacebookPages(tenant)])
        .then(([productRows, pageRows]) => {
          if (cancelled) return
          setProducts(Array.isArray(productRows) ? productRows : [])
          setPages(Array.isArray(pageRows) ? pageRows : [])
          setPageId(pageRows?.[0]?.pageId || '')
        })
        .catch(e => !cancelled && setError(e.message || 'Cannot load products'))
        .finally(() => !cancelled && setLoading(false))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant])

  const page = pages.find(p => p.pageId === pageId)
  const chooseProduct = (_, value) => {
    setProduct(value)
    setImages(lines(value?.imageUrl).join('\n'))
    setVideoId(videoIdOf(value?.videoUrl))
    setMessage(value ? defaultMessage(value, page, tenant) : '')
  }
  const toggle = value => event => setActions(current => event.target.checked
    ? [...current, value] : current.filter(a => a !== value))

  const chosen = ACTIONS.filter(a => actions.includes(a.value))
  const needsVideo = chosen.some(a => a.video)
  const needsImages = chosen.some(a => !a.video)
  const needsPage = chosen.some(a => a.facebook)
  const imageList = lines(images)
  const problems = []
  if (!product) problems.push('Choose a product')
  if (!chosen.length) problems.push('Choose at least one platform')
  if (!message.trim()) problems.push('Write the post message')
  if (needsVideo && !videoId.trim()) problems.push('Video posts need a Dailymotion video id')
  if (needsImages && !imageList.length) problems.push('Image posts need at least one image URL')
  if (needsPage && !pageId) problems.push('Choose a Facebook Page')

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const created = await createPortalSchedule(tenant, {
        productId: product.id, actions, message, title: product.name, imageUrls: imageList,
        videoId: videoId.trim(), facebookPageId: pageId, tiktokPrivacyLevel: privacy,
        scheduledAt: when.length === 16 ? `${when}:00` : when, timezone: 'Asia/Ho_Chi_Minh',
      })
      onCreated(created)
    } catch (e) { setError(e.message || 'Cannot create schedule') }
    finally { setSaving(false) }
  }

  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md">
    <DialogTitle>Schedule media post</DialogTitle>
    <DialogContent>
      {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> : <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <Autocomplete options={products} value={product} onChange={chooseProduct}
          getOptionLabel={option => `${option.name} · ${option.code}`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={params => <TextField {...params} required label="Product" placeholder="Search by name or code" />} />

        <Box>
          <FormLabel>Post to</FormLabel>
          <FormGroup row>
            {ACTIONS.map(a => <FormControlLabel key={a.value} label={a.label}
              control={<Checkbox checked={actions.includes(a.value)} onChange={toggle(a.value)} />} />)}
          </FormGroup>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {needsPage && <TextField select fullWidth required label="Facebook Page" value={pageId}
            onChange={event => setPageId(event.target.value)}
            helperText={pages.length ? 'Pages connected in the Portal' : 'No Facebook Page token found for this website'}>
            {pages.map(p => <MenuItem key={p.pageId} value={p.pageId}>{p.name || p.pageId} · {p.pageId}</MenuItem>)}
          </TextField>}
          {chosen.some(a => a.tiktok) && <TextField select fullWidth label="TikTok privacy" value={privacy}
            onChange={event => setPrivacy(event.target.value)}>
            {PRIVACY.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </TextField>}
          <TextField fullWidth required type="datetime-local" label="Post time (Vietnam time)" value={when}
            onChange={event => setWhen(event.target.value)} InputLabelProps={{ shrink: true }} />
        </Stack>

        <TextField fullWidth required multiline minRows={4} label="Post message" value={message}
          onChange={event => setMessage(event.target.value)}
          helperText={product ? <Button size="small" onClick={() => setMessage(defaultMessage(product, page, tenant))}>Reset to default message</Button> : ' '} />

        {needsImages && <TextField fullWidth multiline minRows={3} label={`Image URLs (${imageList.length})`}
          value={images} onChange={event => setImages(event.target.value)}
          helperText="One URL per line. Filled from the product gallery." />}
        {needsImages && imageList.length > 0 && <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
          {imageList.slice(0, 12).map(url => <Box key={url} component="img" src={url} alt=""
            sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider', flex: '0 0 auto' }} />)}
        </Stack>}
        {needsVideo && <TextField fullWidth label="Dailymotion video id" value={videoId}
          onChange={event => setVideoId(videoIdOf(event.target.value) || event.target.value.trim())}
          helperText="Filled from the product video. Paste an id or a Dailymotion URL." />}

        {problems.length > 0 && product && <Alert severity="info">{problems.join(' · ')}</Alert>}
      </Stack>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Cancel</Button>
      <Button variant="contained" startIcon={<ScheduleSendIcon />} onClick={submit}
        disabled={saving || loading || problems.length > 0}>
        {saving ? 'Scheduling…' : `Schedule ${chosen.length || ''} post${chosen.length === 1 ? '' : 's'}`}
      </Button>
    </DialogActions>
  </Dialog>
}

export default function PortalMediaSchedulePanel({ tenant, onNotice, onError }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    if (!tenant) { setRows([]); return }
    setLoading(true)
    try { setRows(await fetchPortalSchedules(tenant) || []) }
    catch (e) { onError(e.message || 'Cannot load schedules'); setRows([]) }
    finally { setLoading(false) }
  }, [tenant, onError])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const cancel = async row => {
    if (!window.confirm(`Cancel "${row.name}"?`)) return
    setBusyId(row.id)
    try { await cancelPortalSchedule(tenant, row.id); onNotice(`Schedule #${row.id} cancelled.`); await load() }
    catch (e) { onError(e.message || 'Cannot cancel schedule') }
    finally { setBusyId(null) }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? rows.filter(r => `${r.name} ${r.productCode} ${r.status}`.toLowerCase().includes(q)) : rows
  }, [rows, filter])

  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
      <TextField label="Filter schedules" value={filter} onChange={event => setFilter(event.target.value)} sx={{ flex: 1 }} />
      <Button startIcon={<RefreshIcon />} onClick={load} disabled={!tenant || loading}>Load</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} disabled={!tenant}>New media schedule</Button>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Posts are published by the Portal scheduler (checks every minute). Times are Vietnam time.
    </Typography>
    {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> :
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '65vh' }}><Table stickyHeader size="small">
        <TableHead><TableRow>
          <TableCell width={70}>ID</TableCell><TableCell>Post time</TableCell><TableCell>Schedule</TableCell>
          <TableCell>Product</TableCell><TableCell>Media</TableCell><TableCell>Status</TableCell>
          <TableCell>By</TableCell><TableCell width={90} />
        </TableRow></TableHead>
        <TableBody>{visible.map(row => <TableRow key={row.id} hover>
          <TableCell>{row.id}</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>{showTime(row.startTime)}</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>{row.name}</TableCell>
          <TableCell>{row.productCode}</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.mediaType === 'video' ? `video ${row.videoId}` : `${row.imageCount} images`}</TableCell>
          <TableCell><Tooltip title={row.lastError || ''}><Chip size="small" label={row.status} color={STATUS_COLOR[row.status] || 'default'} /></Tooltip></TableCell>
          <TableCell>{row.createdBy}</TableCell>
          <TableCell>{row.enabled && ['pending', 'retrying'].includes(row.status) &&
            <Button size="small" color="error" onClick={() => cancel(row)} disabled={busyId === row.id}>Cancel</Button>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer>}
    <ScheduleDialog open={open} tenant={tenant} onClose={() => setOpen(false)}
      onCreated={created => { setOpen(false); onNotice(`${created?.length || 0} post(s) scheduled in ${tenant}.`); load() }} />
  </Box>
}
