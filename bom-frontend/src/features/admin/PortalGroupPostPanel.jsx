import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend'
import {
  cancelPortalGroupPost, fetchPortalGroupPostMembers, fetchPortalGroupPostOptions, fetchPortalGroupPosts,
  fetchPortalProducts, previewPortalGroupPosts, savePortalGroupPosts
} from '../../api/portalContentApi'
import { usePhone } from '../../components/usePhone'

// Ported from legacy Portal ProductGroupPostForm: post products into many
// Facebook groups (marketing-group members), one row per group, staggered.
// Saved rows are picked up by the Chrome add-on (legacy /api/ext/queue).

const LINK = '{{link}}'
const STATUS_COLOR = { pending: 'info', running: 'warning', retrying: 'warning', fired: 'success', done: 'success', failed: 'error', cancelled: 'default' }
const SEQUENCE_HELP = '0 name first · 1 hashtag line · 2 #brand · 3 #catalog · 4 #sub-catalog · 5 page contact line · 6 tracked link · 7 product code'
const pad = n => String(n).padStart(2, '0')
const vietnamNowPlus = minutes => {
  const d = new Date(Date.now() + (7 * 60 + minutes) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
const showTime = value => value ? value.replace('T', ' ').slice(0, 16) : '—'
const withSeconds = value => value && value.length === 16 ? `${value}:00` : value
const memberLabel = m => m.name ? `${m.name} · ${m.username}` : m.username

function GroupPostDialog({ open, tenant, onClose, onSaved }) {
  const phone = usePhone()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [groups, setGroups] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [chosenProducts, setChosenProducts] = useState([])
  const [chosenGroups, setChosenGroups] = useState([])
  const [chosenMembers, setChosenMembers] = useState([])
  const [campaign, setCampaign] = useState('')
  const [sequence, setSequence] = useState('51267')
  const [start, setStart] = useState(vietnamNowPlus(60))
  const [interval, setIntervalMinutes] = useState(10)
  const [rows, setRows] = useState([])
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true); setError(''); setRows([]); setChosenProducts([]); setChosenGroups([]); setChosenMembers([])
      setStart(vietnamNowPlus(60))
      Promise.all([fetchPortalProducts(tenant, ''), fetchPortalGroupPostOptions(tenant)])
        .then(([productRows, options]) => {
          if (cancelled) return
          setProducts(Array.isArray(productRows) ? productRows : [])
          setGroups(options?.groups || [])
          setCampaigns(options?.campaigns || [])
          setCampaign(options?.campaigns?.[0]?.code || '')
        })
        .catch(e => !cancelled && setError(e.message || 'Cannot load campaign options'))
        .finally(() => !cancelled && setLoading(false))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant])

  // Facebook groups available = members of the chosen marketing groups (all when none chosen).
  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setMembersLoading(true)
      fetchPortalGroupPostMembers(tenant, chosenGroups.map(g => g.id))
        .then(list => {
          if (cancelled) return
          const next = Array.isArray(list) ? list : []
          setMembers(next)
          // Choosing marketing groups selects all their Facebook groups (the usual intent);
          // with no marketing group chosen, start from an empty selection.
          setChosenMembers(chosenGroups.length ? next : [])
        })
        .catch(e => !cancelled && setError(e.message || 'Cannot load Facebook groups'))
        .finally(() => !cancelled && setMembersLoading(false))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant, chosenGroups])

  const generate = async () => {
    setWorking(true); setError('')
    try {
      const preview = await previewPortalGroupPosts(tenant, {
        productIds: chosenProducts.map(p => p.id), usernames: chosenMembers.map(m => m.username), sequence,
        startAt: withSeconds(start), intervalMinutes: Number(interval), timezone: 'Asia/Ho_Chi_Minh',
      })
      setRows((preview || []).map(r => ({ ...r, scheduledAt: showTime(r.scheduledAt).replace(' ', 'T') })))
    } catch (e) { setError(e.message || 'Cannot generate rows') }
    finally { setWorking(false) }
  }

  const updateRow = (index, patch) => setRows(current => current.map((r, i) => i === index ? { ...r, ...patch } : r))
  const removeRow = index => setRows(current => current.filter((_, i) => i !== index))

  const summary = useMemo(() => {
    const counts = {}
    rows.forEach(r => { counts[r.productCode] = (counts[r.productCode] || 0) + 1 })
    return Object.entries(counts).map(([code, n]) => `${code}: ${n}`).join(' · ')
  }, [rows])

  const save = async () => {
    setWorking(true); setError('')
    try {
      const result = await savePortalGroupPosts(tenant, {
        campaignCode: campaign, timezone: 'Asia/Ho_Chi_Minh',
        rows: rows.map(r => ({ username: r.username, productId: r.productId, scheduledAt: withSeconds(r.scheduledAt), message: r.message })),
      })
      onSaved(result?.saved || 0)
    } catch (e) { setError(e.message || 'Cannot save group posts') }
    finally { setWorking(false) }
  }

  const canGenerate = chosenProducts.length > 0 && chosenMembers.length > 0 && /^[0-7]*$/.test(sequence)
  const rowProblems = rows.filter(r => !r.scheduledAt || !r.message.trim()).length

  return <Dialog open={open} onClose={working ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={phone}>
    <DialogTitle>New Facebook group post campaign</DialogTitle>
    <DialogContent>
      {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> : <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Typography variant="subtitle2">1 · What to post</Typography>
        <Autocomplete multiple options={products} value={chosenProducts} onChange={(_, v) => { setChosenProducts(v); setRows([]) }}
          getOptionLabel={o => `${o.name} · ${o.code}`} isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={params => <TextField {...params} label="Products" placeholder="Search by name or code"
            helperText="Groups are split evenly across these products, in this order." />} />

        <Typography variant="subtitle2">2 · Where to post</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete multiple fullWidth options={groups} value={chosenGroups} onChange={(_, v) => { setChosenGroups(v); setRows([]) }}
            getOptionLabel={g => `${g.name} (${g.members})`} isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={params => <TextField {...params} label="Marketing groups" placeholder="Choose to fill Facebook groups" />} />
          <TextField select fullWidth label="Campaign (for click tracking)" value={campaign} onChange={e => setCampaign(e.target.value)}>
            <MenuItem value="">No campaign</MenuItem>
            {campaigns.map(c => <MenuItem key={c.code} value={c.code}>{c.name} · {c.code}</MenuItem>)}
          </TextField>
        </Stack>
        <Autocomplete multiple options={members} value={chosenMembers} loading={membersLoading} disableCloseOnSelect
          onChange={(_, v) => { setChosenMembers(v); setRows([]) }} getOptionLabel={memberLabel}
          isOptionEqualToValue={(a, b) => a.username === b.username}
          renderTags={(value, getTagProps) => value.length > 6
            ? [<Chip key="n" size="small" label={`${value.length} Facebook groups selected`} onDelete={() => setChosenMembers([])} />]
            : value.map((m, i) => <Chip size="small" {...getTagProps({ index: i })} key={m.username} label={m.name || m.username} />)}
          renderInput={params => <TextField {...params} label={`Facebook groups (${chosenMembers.length}/${members.length})`}
            helperText={<Button size="small" onClick={() => setChosenMembers(members)} disabled={!members.length}>Select all {members.length}</Button>} />} />

        <Typography variant="subtitle2">3 · When and how</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField fullWidth type="datetime-local" label="First post (Vietnam time)" value={start}
            onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth type="number" label="Minutes between posts" value={interval}
            onChange={e => setIntervalMinutes(e.target.value)} inputProps={{ min: 0, max: 1440 }} />
          <TextField fullWidth label="Message sequence" value={sequence} error={!/^[0-7]*$/.test(sequence)}
            onChange={e => setSequence(e.target.value.replace(/[^0-7]/g, ''))} helperText={SEQUENCE_HELP} />
        </Stack>
        <Box><Button variant="outlined" onClick={generate} disabled={!canGenerate || working}>
          {rows.length ? 'Regenerate rows' : 'Generate rows'}
        </Button></Box>

        {rows.length > 0 && <>
          <Alert severity="info">
            {rows.length} posts · {summary}. Review and edit each post below. <strong>{LINK}</strong> becomes the product link with a
            per-group tracking code when you save.
          </Alert>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '50vh' }}><Table stickyHeader size="small">
            <TableHead><TableRow>
              <TableCell>Facebook group</TableCell><TableCell width={200}>Product</TableCell>
              <TableCell width={190}>Time</TableCell><TableCell>Message</TableCell><TableCell width={40} />
            </TableRow></TableHead>
            <TableBody>{rows.map((r, i) => <TableRow key={r.username} sx={{ verticalAlign: 'top' }}>
              <TableCell sx={{ wordBreak: 'break-all', minWidth: 140 }}><strong>{r.name || '—'}</strong><br />
                <Typography variant="caption" color="text.secondary">{r.username}</Typography></TableCell>
              <TableCell><TextField select size="small" fullWidth value={r.productId}
                onChange={e => {
                  const p = chosenProducts.find(x => x.id === Number(e.target.value))
                  if (p) updateRow(i, { productId: p.id, productCode: p.code, productName: p.name })
                }}
                helperText="Regenerate to rebuild the message">
                {chosenProducts.map(p => <MenuItem key={p.id} value={p.id}>{p.name} · {p.code}</MenuItem>)}
              </TextField></TableCell>
              <TableCell><TextField size="small" type="datetime-local" value={r.scheduledAt}
                onChange={e => updateRow(i, { scheduledAt: e.target.value })} /></TableCell>
              <TableCell sx={{ minWidth: 260 }}><TextField size="small" fullWidth multiline minRows={2} maxRows={8}
                value={r.message} onChange={e => updateRow(i, { message: e.target.value })} error={!r.message.trim()} /></TableCell>
              <TableCell><Tooltip title="Remove this group"><Button size="small" color="error" onClick={() => removeRow(i)}>✕</Button></Tooltip></TableCell>
            </TableRow>)}</TableBody>
          </Table></TableContainer>
        </>}
      </Stack>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={working}>Cancel</Button>
      <Button variant="contained" startIcon={<ScheduleSendIcon />} onClick={save}
        disabled={working || loading || !rows.length || rowProblems > 0}>
        {working ? 'Saving…' : `Queue ${rows.length || ''} group post${rows.length === 1 ? '' : 's'}`}
      </Button>
    </DialogActions>
  </Dialog>
}

export default function PortalGroupPostPanel({ tenant, onNotice, onError }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    if (!tenant) { setRows([]); return }
    setLoading(true)
    try { setRows(await fetchPortalGroupPosts(tenant) || []) }
    catch (e) { onError(e.message || 'Cannot load group posts'); setRows([]) }
    finally { setLoading(false) }
  }, [tenant, onError])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const cancel = async row => {
    if (!window.confirm(`Cancel group post #${row.id} to ${row.groupUrl}?`)) return
    setBusyId(row.id)
    try { await cancelPortalGroupPost(tenant, row.id); onNotice(`Group post #${row.id} cancelled.`); await load() }
    catch (e) { onError(e.message || 'Cannot cancel group post') }
    finally { setBusyId(null) }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q ? rows.filter(r => `${r.groupUrl} ${r.productCode} ${r.status} ${r.createdBy}`.toLowerCase().includes(q)) : rows
  }, [rows, filter])

  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
      <TextField label="Filter group posts" value={filter} onChange={e => setFilter(e.target.value)} sx={{ flex: 1 }} />
      <Button startIcon={<RefreshIcon />} onClick={load} disabled={!tenant || loading}>Load</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} disabled={!tenant}>New group post campaign</Button>
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      Posted into Facebook groups by the Chrome add-on (it pulls pending posts from the Portal queue). Times are Vietnam time.
    </Typography>
    {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> :
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '65vh' }}><Table stickyHeader size="small">
        <TableHead><TableRow>
          <TableCell width={70}>ID</TableCell><TableCell>Post time</TableCell><TableCell>Facebook group</TableCell>
          <TableCell>Product</TableCell><TableCell>Status</TableCell><TableCell>By</TableCell><TableCell width={90} />
        </TableRow></TableHead>
        <TableBody>{visible.map(row => <TableRow key={row.id} hover>
          <TableCell>{row.id}</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>{showTime(row.scheduledAt)}</TableCell>
          <TableCell sx={{ wordBreak: 'break-all' }}><Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{row.message}</span>}><span>{row.groupUrl}</span></Tooltip></TableCell>
          <TableCell>{row.productCode}</TableCell>
          <TableCell><Tooltip title={row.lastError || ''}><Chip size="small" label={row.status} color={STATUS_COLOR[row.status] || 'default'} /></Tooltip></TableCell>
          <TableCell>{row.createdBy}</TableCell>
          <TableCell>{row.status === 'pending' &&
            <Button size="small" color="error" onClick={() => cancel(row)} disabled={busyId === row.id}>Cancel</Button>}</TableCell>
        </TableRow>)}</TableBody>
      </Table></TableContainer>}
    <GroupPostDialog open={open} tenant={tenant} onClose={() => setOpen(false)}
      onSaved={saved => { setOpen(false); onNotice(`${saved} group post(s) queued in ${tenant}.`); load() }} />
  </Box>
}
