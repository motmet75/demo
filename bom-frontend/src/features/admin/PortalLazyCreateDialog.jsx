import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, FormGroup, FormLabel, InputAdornment, MenuItem, Stack, Switch, TextField, Typography
} from '@mui/material'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import VideoFileIcon from '@mui/icons-material/VideoFile'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { createPortalLazyProduct, fetchPortalFacebookPages, fetchPortalLazyCreateChannels, suggestPortalProductCode } from '../../api/portalContentApi'
import { usePhone } from '../../components/usePhone'
import { useAuth } from '../../context/useAuth'
import VideoFrameCapture from './VideoFrameCapture'

// Port of legacy Portal "lazy create" (portal-live schedule-product page,
// AdminLazyCreateProductController): one form creates the product and queues
// its social posts. Files are uploaded by Portal (Google Drive / Dailymotion)
// through the server-side bridge; the product code comes from Portal too.

const PLATFORMS = [
  { value: 'post_facebook_multi_image', label: 'Facebook · ảnh', image: true },
  { value: 'post_facebook_video', label: 'Facebook · video', video: true },
  { value: 'post_tiktok_image', label: 'TikTok · ảnh', image: true },
  { value: 'post_tiktok_video', label: 'TikTok · video', video: true },
  { value: 'post_youtube_video', label: 'YouTube · video', video: true },
]
const PRIVACY = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Công khai' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Bạn bè' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Người theo dõi' },
  { value: 'SELF_ONLY', label: 'Chỉ mình tôi' },
]
const SEQUENCE_HELP = 'Để trống nội dung = tự tạo theo dãy: 1 hashtag · 2 #thương hiệu · 3 #danh mục · 5 dòng liên hệ · 6 link · 7 mã. Có thể gõ {{TRACKED_URL}} và {{PRODUCT_CODE}}.'
const pad = n => String(n).padStart(2, '0')
const vietnamNowPlus = minutes => {
  const d = new Date(Date.now() + (7 * 60 + minutes) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const nameFor = (list, code) => list.find(o => o.code === code)?.name || code || ''

// Last-used choices, per signed-in user and website (several people share one browser/app),
// kept in a cookie so that user's next form starts from them.
const REMEMBER = ['catalog', 'brand', 'groupCodes', 'actions', 'immediate', 'facebookPageId', 'facebookSequence',
  'tiktokSequence', 'youtubeSequence', 'tiktokPrivacy', 'tiktokAllowComment', 'tiktokAllowDuet', 'tiktokAllowStitch', 'tiktokAutoAddMusic']
const cookieName = scope => `lazy_create_${String(scope).replace(/[^A-Za-z0-9]/g, '_')}`
const readChoices = scope => {
  try {
    const raw = document.cookie.split('; ').find(c => c.startsWith(`${cookieName(scope)}=`))
    const parsed = raw ? JSON.parse(decodeURIComponent(raw.slice(raw.indexOf('=') + 1))) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch { return {} }
}
const writeChoices = (scope, form) => {
  const next = { ...readChoices(scope) }
  REMEMBER.forEach(k => { if (form[k] !== '' && form[k] !== undefined) next[k] = form[k] })
  document.cookie = `${cookieName(scope)}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=31536000; SameSite=Lax`
}
// The form remembers whose choices it holds, so a leftover form never saves into another user's cookie.
const withScope = (scope, form) => ({ ...form, scope })
const restoreChoices = (saved, defaults, { catalogs, brands, groups }) => {
  const out = { ...defaults }
  REMEMBER.forEach(k => { if (saved[k] !== undefined && typeof saved[k] === typeof defaults[k]) out[k] = saved[k] })
  if (!catalogs.some(c => c.code === out.catalog)) out.catalog = ''
  if (!brands.some(b => b.code === out.brand)) out.brand = ''
  out.groupCodes = Array.isArray(out.groupCodes) ? out.groupCodes.filter(g => groups.some(o => o.code === g)) : []
  out.actions = Array.isArray(out.actions) ? out.actions.filter(a => PLATFORMS.some(p => p.value === a)) : defaults.actions
  if (!PRIVACY.some(p => p.value === out.tiktokPrivacy)) out.tiktokPrivacy = defaults.tiktokPrivacy
  return out
}

// Channel status line under the platform checkboxes: null = still loading.
function ChannelStatus({ label, channel, unknown }) {
  const text = unknown ? 'không kiểm tra được' : !channel ? 'đang kiểm tra…'
    : channel.connected ? `đã kết nối${channel.name ? `: ${channel.name}` : ''}` : 'chưa kết nối'
  const color = unknown || !channel ? 'text.secondary' : channel.connected ? 'success.main' : 'warning.main'
  return <Typography variant="caption" sx={{ color }}>{label} · {text}</Typography>
}

function CodePick({ label, options, value, onChange, multiple = false }) {
  const selected = multiple ? options.filter(o => value.includes(o.code)) : options.find(o => o.code === value) || null
  return <Autocomplete multiple={multiple} fullWidth options={options} value={selected}
    getOptionLabel={o => o.name || o.code} isOptionEqualToValue={(a, b) => a.code === b.code}
    onChange={(_, next) => onChange(multiple ? next.map(o => o.code) : next?.code || '')}
    renderInput={params => <TextField {...params} label={label} />} />
}

function MessageField({ label, message, onMessage, sequence, onSequence }) {
  return <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
    <TextField fullWidth multiline minRows={2} label={label} value={message} onChange={e => onMessage(e.target.value)}
      placeholder="Để trống để tự tạo" />
    <TextField sx={{ width: { md: 160 } }} label="Dãy" value={sequence}
      onChange={e => onSequence(e.target.value.replace(/[^0-7]/g, ''))} />
  </Stack>
}

export default function PortalLazyCreateDialog({ open, tenant, brands, catalogs, groups, onClose, onCreated }) {
  const phone = usePhone()
  const { user } = useAuth()
  const scope = `${user?.id ?? user?.username ?? 'anon'}__${tenant}`
  const [pages, setPages] = useState([])
  // { tiktok: {connected, name, privacyOptions}, youtube: {connected, name}, linkedin: {connected, authors}, error? } | null
  const [channels, setChannels] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState(null)
  const [images, setImages] = useState([])
  const [thumbnail, setThumbnail] = useState(null)
  const [video, setVideo] = useState(null)
  // code check result for the current name / typed code: null | { checking } | { ok, path } | { suggestion, reason }
  const [codeCheck, setCodeCheck] = useState(null)

  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setError(''); setImages([]); setThumbnail(null); setVideo(null); setChannels(null)
      const saved = readChoices(scope)
      setF(withScope(scope, restoreChoices(saved, {
        name: '', code: '', codeEdited: false, price: '', catalog: '', brand: '', groupCodes: [], dailymotionVideoAddress: '',
        actions: ['post_facebook_multi_image'], immediate: false, scheduledAt: vietnamNowPlus(30), facebookPageId: '',
        facebookMessage: '', facebookSequence: '51267', tiktokMessage: '', tiktokSequence: '127',
        youtubeDescription: '', youtubeSequence: '5127', tiktokPrivacy: 'PUBLIC_TO_EVERYONE',
        tiktokAllowComment: true, tiktokAllowDuet: false, tiktokAllowStitch: false, tiktokAutoAddMusic: true,
        tiktokMusicConsent: true,
      }, { catalogs, brands, groups })))
      fetchPortalFacebookPages(tenant).then(list => {
        if (cancelled) return
        const found = Array.isArray(list) ? list : []
        setPages(found)
        const remembered = found.find(p => p.pageId === saved.facebookPageId)
        setF(cur => cur && ({ ...cur, facebookPageId: (remembered || found[0])?.pageId || '' }))
      }).catch(() => !cancelled && setPages([]))
      fetchPortalLazyCreateChannels(tenant).then(c => !cancelled && setChannels(c || { error: 'empty' }))
        .catch(e => !cancelled && setChannels({ error: e.message || 'error' }))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lists are read once when the dialog opens
  }, [open, tenant, scope])

  // Remember the option controls as they change (not the name, code, price or files).
  const remembered = f ? JSON.stringify(REMEMBER.map(k => f[k])) : ''
  useEffect(() => {
    if (open && tenant && f?.scope === scope) writeChoices(scope, f)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `remembered` is the serialized subset of f
  }, [open, tenant, scope, remembered])

  // Auto code: from the name, or the code typed by hand; always checked against existing codes and links.
  const codeSource = f ? (f.codeEdited ? f.code : f.name).trim() : ''
  const codeEdited = !!f?.codeEdited
  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (!codeSource) { setCodeCheck(null); if (!codeEdited) setF(cur => cur && ({ ...cur, code: '' })); return }
      setCodeCheck({ checking: true })
      suggestPortalProductCode(tenant, codeSource).then(s => {
        if (cancelled) return
        if (!codeEdited) { setF(cur => cur && ({ ...cur, code: s.code })); setCodeCheck({ ok: true, path: s.path, changed: s.changed }) }
        else if (s.code === codeSource) setCodeCheck({ ok: true, path: s.path })
        else setCodeCheck({ suggestion: s.code, reason: s.base !== codeSource
          ? 'Mã chỉ gồm chữ thường không dấu, số, - và _'
          : `Đã có sản phẩm dùng mã hoặc link ${codeSource}.html` })
      }).catch(e => !cancelled && setCodeCheck({ reason: e.message || 'Không kiểm tra được mã' }))
    }, 400)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant, codeSource, codeEdited])

  const previews = useMemo(() => images.map(file => ({ file, url: URL.createObjectURL(file) })), [images])
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews])
  const thumbnailUrl = useMemo(() => thumbnail ? URL.createObjectURL(thumbnail) : '', [thumbnail])
  useEffect(() => () => { if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl) }, [thumbnailUrl])

  if (!f) return null
  const set = key => value => setF(cur => ({ ...cur, [key]: value }))
  const toggle = value => e => set('actions')(e.target.checked ? [...f.actions, value] : f.actions.filter(a => a !== value))
  const chosen = PLATFORMS.filter(p => f.actions.includes(p.value))
  const wantsImages = chosen.some(p => p.image)
  const wantsVideo = chosen.some(p => p.video)
  const wantsFacebook = f.actions.some(a => a.startsWith('post_facebook'))
  const wantsTikTok = f.actions.some(a => a.startsWith('post_tiktok'))
  const wantsYouTube = f.actions.includes('post_youtube_video')

  // Catalog and brand first; the button puts "<catalog> <brand>" at the start of the name, only when asked.
  const namePrefix = [nameFor(catalogs, f.catalog), nameFor(brands, f.brand)].filter(Boolean).join(' ')
  const hasPrefix = !!namePrefix && f.name.trimStart().toLowerCase().startsWith(namePrefix.toLowerCase())
  const addPrefix = () => setF(cur => ({ ...cur, name: `${namePrefix} ${cur.name.trimStart()}` }))
  const readyForName = !!(f.catalog && f.brand)
  const tiktokPrivacyChoices = channels?.tiktok?.privacyOptions?.length
    ? PRIVACY.filter(p => channels.tiktok.privacyOptions.includes(p.value)) : PRIVACY
  const channelUnknown = !!channels?.error
  const notConnected = channels && !channelUnknown ? [
    wantsTikTok && channels.tiktok && !channels.tiktok.connected && 'TikTok',
    wantsYouTube && channels.youtube && !channels.youtube.connected && 'YouTube',
  ].filter(Boolean) : []

  const problems = []
  if (!f.catalog) problems.push('Chọn danh mục')
  if (!f.brand) problems.push('Chọn thương hiệu')
  if (readyForName && !f.name.trim()) problems.push('Nhập tên sản phẩm')
  if (f.name.trim() && (!f.code || !codeCheck?.ok)) problems.push(codeCheck?.checking ? 'Đang kiểm tra mã…' : 'Mã sản phẩm chưa hợp lệ')
  if (wantsImages && !images.length && !thumbnail) problems.push('Chọn ảnh để đăng ảnh')
  if (wantsVideo && !video && !f.dailymotionVideoAddress.trim()) problems.push('Chọn video hoặc nhập Dailymotion')
  if (wantsFacebook && !f.facebookPageId) problems.push('Chọn Facebook Page')
  if (wantsTikTok && !f.tiktokMusicConsent) problems.push('Xác nhận điều khoản nhạc TikTok')
  if (chosen.length && !f.immediate && !f.scheduledAt) problems.push('Chọn giờ đăng')
  if (images.some(i => i.size > 20 * 1048576) || (thumbnail && thumbnail.size > 20 * 1048576)) problems.push('Ảnh tối đa 20 MB')
  if (video && video.size > 250 * 1048576) problems.push('Video tối đa 250 MB')

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const form = {
        ...f, codeEdited: undefined, scope: undefined, name: f.name.trim(), code: f.code.trim(), price: f.price === '' ? null : Number(f.price),
        scheduledAt: f.immediate ? null : (f.scheduledAt.length === 16 ? `${f.scheduledAt}:00` : f.scheduledAt),
      }
      const body = new FormData()
      body.append('form', new Blob([JSON.stringify(form)], { type: 'application/json' }))
      images.forEach(file => body.append('images', file))
      if (thumbnail) body.append('thumbnail', thumbnail)
      if (video) body.append('video', video)
      const result = await createPortalLazyProduct(tenant, body)
      onCreated(result)
    } catch (e) { setError(e.message || 'Không tạo được sản phẩm') }
    finally { setSaving(false) }
  }

  const totalUpload = images.reduce((s, i) => s + i.size, 0) + (thumbnail?.size || 0) + (video?.size || 0)

  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md" fullScreen={phone}>
    <DialogTitle>Tạo nhanh sản phẩm + lên lịch đăng</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>{error}</Alert>}

        <Typography variant="subtitle2">1 · Sản phẩm</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <CodePick label="Danh mục *" options={catalogs} value={f.catalog} onChange={set('catalog')} />
          <CodePick label="Thương hiệu *" options={brands} value={f.brand} onChange={set('brand')} />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField fullWidth required label="Tên sản phẩm" value={f.name} onChange={e => set('name')(e.target.value)}
            onFocus={() => { if (/^\s/.test(f.name)) set('name')(f.name.trimStart()) }}
            disabled={!readyForName} autoFocus={readyForName}
            InputProps={{ endAdornment: readyForName && !hasPrefix && <InputAdornment position="end">
              <Button size="small" sx={{ whiteSpace: 'nowrap' }} onClick={addPrefix} title={`Thêm “${namePrefix}” vào đầu tên`}>
                + {namePrefix}
              </Button>
            </InputAdornment> }}
            helperText={readyForName ? 'Bấm nút để thêm danh mục và thương hiệu vào đầu tên.' : 'Chọn danh mục và thương hiệu trước.'} />
          <TextField sx={{ width: { md: 200 } }} type="number" label="Giá (VND)" value={f.price} onChange={e => set('price')(e.target.value)} />
        </Stack>
        {f.name.trim() && <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-start' }}>
          <TextField fullWidth label={f.codeEdited ? 'Mã sản phẩm (tự nhập)' : 'Mã sản phẩm (tự tạo từ tên)'} value={f.code}
            onChange={e => setF(cur => ({ ...cur, code: e.target.value.toLowerCase(), codeEdited: true }))}
            error={!!codeCheck && !codeCheck.ok && !codeCheck.checking}
            InputProps={{ endAdornment: codeCheck?.checking ? <CircularProgress size={18} /> : null }}
            helperText={codeCheck?.ok ? `Link: ${codeCheck.path} · chưa có sản phẩm nào dùng${codeCheck.changed ? ' (đã thêm số vì mã gốc đã có)' : ''}`
              : codeCheck?.reason ? `${codeCheck.reason}${codeCheck.suggestion ? `. Gợi ý: ${codeCheck.suggestion}` : ''}` : 'Đang kiểm tra mã và link trong Portal…'} />
          {codeCheck?.suggestion && <Button sx={{ whiteSpace: 'nowrap', mt: { md: 1 } }}
            onClick={() => setF(cur => ({ ...cur, code: codeCheck.suggestion }))}>Dùng {codeCheck.suggestion}</Button>}
          {f.codeEdited && <Button sx={{ whiteSpace: 'nowrap', mt: { md: 1 } }}
            onClick={() => setF(cur => ({ ...cur, codeEdited: false }))}>Tự tạo lại</Button>}
        </Stack>}
        <CodePick label="Nhóm sản phẩm" multiple options={groups} value={f.groupCodes} onChange={set('groupCodes')} />

        <Typography variant="subtitle2">2 · Ảnh và video</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
          <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateIcon />}>
            Thêm ảnh ({images.length})
            <input hidden multiple type="file" accept="image/*"
              onChange={e => { const list = Array.from(e.target.files || []); setImages(cur => [...cur, ...list].slice(0, 35)); e.target.value = '' }} />
          </Button>
          {images.length > 0 && <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateIcon />}>
            Ảnh bìa{thumbnail ? `: ${thumbnail.name}` : ''}
            <input hidden type="file" accept="image/*" onChange={e => { setThumbnail(e.target.files?.[0] || null); e.target.value = '' }} />
          </Button>}
          <Button component="label" variant="outlined" startIcon={<VideoFileIcon />}>
            {video ? `Video: ${video.name} (${mb(video.size)})` : 'Chọn video'}
            <input hidden type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0] || null)} />
          </Button>
          {(images.length > 0 || thumbnail || video) && <Button color="inherit" onClick={() => { setImages([]); setThumbnail(null); setVideo(null) }}>Xoá file</Button>}
        </Stack>
        {thumbnailUrl && <Stack direction="row" spacing={1} alignItems="center">
          <Box component="img" src={thumbnailUrl} alt="" sx={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 1, border: 2, borderColor: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary">Ảnh bìa: {thumbnail.name}</Typography>
          <Button size="small" color="inherit" onClick={() => setThumbnail(null)}>Bỏ</Button>
        </Stack>}
        {previews.length > 0 && <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
          {previews.map((p, i) => <Box key={p.url} sx={{ position: 'relative', flex: '0 0 auto' }}>
            <Box component="img" src={p.url} alt="" sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider' }} />
            <Button size="small" onClick={() => setImages(cur => cur.filter((_, j) => j !== i))}
              sx={{ position: 'absolute', top: 0, right: 0, minWidth: 0, p: '0 6px', bgcolor: 'rgba(255,255,255,.85)' }}>✕</Button>
          </Box>)}
        </Stack>}
        {video && <VideoFrameCapture key={`${video.name}-${video.size}-${video.lastModified}`} file={video} baseName={f.code || 'video'} galleryFull={images.length >= 35}
          onGallery={shot => setImages(cur => [...cur, shot].slice(0, 35))} onThumbnail={setThumbnail} />}
        {!video && <TextField fullWidth label="Hoặc video Dailymotion (id hoặc link)" value={f.dailymotionVideoAddress}
          onChange={e => set('dailymotionVideoAddress')(e.target.value)} />}

        <Typography variant="subtitle2">3 · Đăng mạng xã hội</Typography>
        <Box>
          <FormLabel>Đăng lên</FormLabel>
          <FormGroup row>
            {PLATFORMS.map(p => <FormControlLabel key={p.value} label={p.label}
              control={<Checkbox checked={f.actions.includes(p.value)} onChange={toggle(p.value)} />} />)}
          </FormGroup>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0, sm: 2 }} flexWrap="wrap" useFlexGap>
            <ChannelStatus label="TikTok" channel={channels?.tiktok} unknown={channelUnknown} />
            <ChannelStatus label="YouTube" channel={channels?.youtube} unknown={channelUnknown} />
            <ChannelStatus label="LinkedIn" unknown={channelUnknown} channel={channels?.linkedin && {
              connected: channels.linkedin.connected, name: (channels.linkedin.authors || []).join(', ') }} />
          </Stack>
        </Box>
        {notConnected.length > 0 && <Alert severity="warning">
          {notConnected.join(', ')} chưa kết nối trong Portal; bài đăng lên kênh này sẽ không chạy được.
        </Alert>}
        {chosen.length > 0 && <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControlLabel control={<Switch checked={f.immediate} onChange={e => set('immediate')(e.target.checked)} />}
              label="Đăng ngay (sau 1 phút)" />
            {!f.immediate && <TextField fullWidth type="datetime-local" label="Giờ đăng (giờ Việt Nam)" value={f.scheduledAt}
              onChange={e => set('scheduledAt')(e.target.value)} InputLabelProps={{ shrink: true }}
              helperText="Sản phẩm được duyệt hiển thị khi bài đăng chạy." />}
          </Stack>
          {wantsFacebook && <>
            <TextField select fullWidth label="Facebook Page" value={f.facebookPageId} onChange={e => set('facebookPageId')(e.target.value)}
              helperText={pages.length ? '' : 'Website này chưa kết nối Facebook Page'}>
              {pages.map(p => <MenuItem key={p.pageId} value={p.pageId}>{p.name || p.pageId} · {p.pageId}</MenuItem>)}
            </TextField>
            <MessageField label="Nội dung Facebook" message={f.facebookMessage} onMessage={set('facebookMessage')}
              sequence={f.facebookSequence} onSequence={set('facebookSequence')} />
          </>}
          {wantsTikTok && <>
            <MessageField label="Nội dung TikTok" message={f.tiktokMessage} onMessage={set('tiktokMessage')}
              sequence={f.tiktokSequence} onSequence={set('tiktokSequence')} />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
              <TextField select sx={{ minWidth: 200 }} label="Quyền riêng tư TikTok" value={f.tiktokPrivacy} onChange={e => set('tiktokPrivacy')(e.target.value)}>
                {tiktokPrivacyChoices.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </TextField>
              <FormControlLabel label="Bình luận" control={<Checkbox checked={f.tiktokAllowComment} onChange={e => set('tiktokAllowComment')(e.target.checked)} />} />
              <FormControlLabel label="Duet" control={<Checkbox checked={f.tiktokAllowDuet} onChange={e => set('tiktokAllowDuet')(e.target.checked)} />} />
              <FormControlLabel label="Stitch" control={<Checkbox checked={f.tiktokAllowStitch} onChange={e => set('tiktokAllowStitch')(e.target.checked)} />} />
              <FormControlLabel label="Tự thêm nhạc" control={<Checkbox checked={f.tiktokAutoAddMusic} onChange={e => set('tiktokAutoAddMusic')(e.target.checked)} />} />
            </Stack>
            <FormControlLabel label="Tôi đồng ý chính sách sử dụng nhạc/nội dung của TikTok"
              control={<Checkbox checked={f.tiktokMusicConsent} onChange={e => set('tiktokMusicConsent')(e.target.checked)} />} />
          </>}
          {wantsYouTube && <MessageField label="Mô tả YouTube" message={f.youtubeDescription} onMessage={set('youtubeDescription')}
            sequence={f.youtubeSequence} onSequence={set('youtubeSequence')} />}
          <Typography variant="caption" color="text.secondary">{SEQUENCE_HELP}</Typography>
        </>}
        {problems.length > 0 && (f.catalog || f.brand) && <Alert severity="info">{problems.join(' · ')}</Alert>}
        {saving && <Alert severity="info" icon={<CircularProgress size={18} />}>
          Đang tải {mb(totalUpload)} lên Portal và tạo sản phẩm… video lớn có thể mất vài phút, đừng đóng trang.
        </Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Huỷ</Button>
      <Button variant="contained" startIcon={<RocketLaunchIcon />} onClick={submit} disabled={saving || problems.length > 0}>
        {saving ? 'Đang tạo…' : chosen.length ? `Tạo + lên lịch ${chosen.length} bài` : 'Tạo sản phẩm'}
      </Button>
    </DialogActions>
  </Dialog>
}
