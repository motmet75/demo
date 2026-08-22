import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PrintIcon from '@mui/icons-material/Print'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant'
import ShareIcon from '@mui/icons-material/Share'
import { generateQueueQr, generateWalkUpQr } from '../../api/shopApi'
import { printQueueQrTracked, printWalkUpQrTracked } from '../../utils/printWithHistory'
import { useI18n } from '../../i18n/I18nContext'
import { ORDERING_LANGUAGE_CODES, SUPPORTED_LANGUAGES } from '../../i18n/translations'

function fmtDate(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) } catch { return '' }
}

export default function QrOrderDialog({ open, onClose }) {
  const { t } = useI18n()
  const [seq, setSeq] = useState('')
  const [maxOrders, setMaxOrders] = useState('12')
  const [queueDays, setQueueDays] = useState('30')
  const [queueLanguage, setQueueLanguage] = useState('vi')
  const [shareDone, setShareDone] = useState(false)
  const [loadingType, setLoadingType] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const loading = Boolean(loadingType)
  const isQueue = result?.type === 'QUEUE'

  const handleGenerateOrder = async () => {
    setLoadingType('order'); setError('')
    try {
      const seqVal = seq !== '' ? Number(seq) : null
      if (seqVal != null && (!Number.isFinite(seqVal) || seqVal < 1)) {
        setError(t('shopOrder.qr.invalidOrderNumber'))
        return
      }
      const maxOrdersRaw = maxOrders !== '' ? Number(maxOrders) : 12
      if (!Number.isFinite(maxOrdersRaw) || maxOrdersRaw < 1) {
        setError(t('shopOrder.qr.invalidMaxOrders'))
        return
      }
      const maxOrdersLimit = Math.min(Math.floor(maxOrdersRaw), 500)
      const { res, data } = await generateWalkUpQr(seqVal, maxOrdersLimit)
      if (!res.ok) { setError(data?.message || t('shopOrder.qr.generateFailed')); return }
      setResult({
        type: 'ORDER',
        qrBase64: data.qrBase64,
        seq: data.seq ?? null,
        qrUrl: data.qrUrl ?? null,
        token: data.token ?? null,
        maxOrders: data.maxOrders ?? maxOrdersLimit,
      })
    } catch (e) {
      setError(e.message || t('shopOrder.common.networkError'))
    } finally {
      setLoadingType('')
    }
  }

  const handleGenerateQueue = async () => {
    setLoadingType('queue'); setError('')
    try {
      const daysRaw = Number(queueDays)
      if (!Number.isFinite(daysRaw) || daysRaw < 1) {
        setError(t('shopOrder.qr.invalidDays'))
        return
      }
      const validDays = Math.min(Math.floor(daysRaw), 366)
      const { res, data } = await generateQueueQr(validDays, queueLanguage)
      if (!res.ok) { setError(data?.message || data?.error || t('shopOrder.qr.generateQueueFailed')); return }
      setResult({
        type: 'QUEUE',
        qrBase64: data.qrBase64,
        qrUrl: data.qrUrl,
        token: data.token,
        expiresAt: data.expiresAt,
        validDays: data.validDays ?? validDays,
        language: data.language || queueLanguage,
      })
    } catch (e) {
      setError(e.message || t('shopOrder.common.networkError'))
    } finally {
      setLoadingType('')
    }
  }

  const handleReset = () => { setResult(null); setSeq(''); setMaxOrders('12'); setError('') }
  const handleClose = () => { handleReset(); onClose() }

  const handleShare = async () => {
    if (!result?.qrUrl) return
    const selected = SUPPORTED_LANGUAGES.find(item => item.code === result.language)
    const title = `Queue QR Code - ${selected?.nativeLabel || result.language?.toUpperCase() || 'Tiếng Việt'}`
    try {
      if (navigator.share) await navigator.share({ title, url: result.qrUrl })
      else await navigator.clipboard.writeText(result.qrUrl)
      setShareDone(true)
      window.setTimeout(() => setShareDone(false), 2500)
    } catch (e) {
      if (e?.name !== 'AbortError') setError('Could not share QR Code link')
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCode2Icon color="primary" />
          <Typography fontWeight={800} variant="h6">{t('shopOrder.qr.title')}</Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}

        {!result ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <Typography fontWeight={800} sx={{ mb: 0.5 }}>{t('shopOrder.qr.slipTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('shopOrder.qr.slipHelp')}
              </Typography>
              <TextField
                label={t('shopOrder.qr.orderNumberOptional')}
                placeholder={t('shopOrder.qr.leaveBlankAuto')}
                type="number"
                size="small"
                fullWidth
                value={seq}
                onChange={e => setSeq(e.target.value)}
                inputProps={{ min: 1 }}
                helperText={seq ? t('shopOrder.qr.assignedNumber', { number: seq }) : t('shopOrder.qr.nextNumber')}
              />
              <TextField
                label={t('shopOrder.qr.maxOrders')}
                type="number"
                size="small"
                fullWidth
                value={maxOrders}
                onChange={e => setMaxOrders(e.target.value)}
                inputProps={{ min: 1, max: 500 }}
                helperText={t('shopOrder.qr.maxOrdersHelp')}
                sx={{ mt: 1.5 }}
              />
            </Box>

            <Divider />

            <Box>
              <Typography fontWeight={800} sx={{ mb: 0.5 }}>{t('shopOrder.qr.queueTitle')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {t('shopOrder.qr.queueHelp')}
              </Typography>
              <TextField
                label={t('shopOrder.qr.validDays')}
                type="number"
                size="small"
                fullWidth
                value={queueDays}
                onChange={e => setQueueDays(e.target.value)}
                inputProps={{ min: 1, max: 366 }}
                helperText={t('shopOrder.qr.validDaysHelp')}
              />
              <Box sx={{ mt: 1.5, p: 1.5, border: '2px solid #1976d2', borderRadius: 2, bgcolor: '#f5f9ff' }}>
                <Typography fontWeight={800} color="primary" sx={{ mb: 1 }}>
                  Select language before generating Queue QR
                </Typography>
                <TextField
                  select
                  required
                  label="QR Code language"
                  size="small"
                  fullWidth
                  value={queueLanguage}
                  onChange={e => setQueueLanguage(e.target.value)}
                  helperText="The ordering shop opens automatically in this language when the QR is scanned."
                >
                  {ORDERING_LANGUAGE_CODES.map(code => SUPPORTED_LANGUAGES.find(item => item.code === code)).filter(Boolean).map(item => (
                    <MenuItem key={item.code} value={item.code}>
                      {item.nativeLabel} ({item.code.toUpperCase()})
                    </MenuItem>
                  ))}
                </TextField>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', pt: 1 }}>
            {isQueue ? (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
                  Queue QR
                </Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, color: '#ff5722' }}>
                  {t('shopOrder.qr.seatOrder')}
                </Typography>
                <Chip icon={<TableRestaurantIcon />} label={t('shopOrder.qr.validForDays', { days: result.validDays || queueDays })} size="small" sx={{ mt: 1, fontWeight: 700 }} />
                <Chip
                  label={`Language: ${SUPPORTED_LANGUAGES.find(item => item.code === result.language)?.nativeLabel || result.language?.toUpperCase()}`}
                  size="small" color="primary" variant="outlined" sx={{ mt: 1, ml: 1, fontWeight: 700 }}
                />
              </Box>
            ) : result.seq != null && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0, fontSize: 10 }}>
                  {t('shopOrder.qr.orderNumber')}
                </Typography>
                <Typography sx={{ fontSize: 72, fontWeight: 900, lineHeight: 1, color: '#1976d2', letterSpacing: 0 }}>
                  #{result.seq}
                </Typography>
              </Box>
            )}
            {!isQueue && (
              <Chip
                label={t('shopOrder.qr.maxOrderCount', { count: result.maxOrders || 12 })}
                size="small"
                sx={{ mb: 1.5, fontWeight: 700 }}
              />
            )}

            <Box sx={{
              display: 'inline-block', p: 1.5, bgcolor: '#fff',
              borderRadius: 2, border: '2px solid #e3f2fd', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            }}>
              <img
                src={`data:image/png;base64,${result.qrBase64}`}
                alt={isQueue ? 'Queue QR' : 'Order QR'}
                style={{ width: 200, height: 200, display: 'block' }}
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontWeight: 500 }}>
              {isQueue ? t('shopOrder.qr.queueScanHelp') : t('shopOrder.qr.orderScanHelp')}
            </Typography>
            {isQueue && result.expiresAt && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('shopOrder.qr.validUntil')} {fmtDate(result.expiresAt)}
              </Typography>
            )}
            {!isQueue && result.seq == null && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {t('shopOrder.qr.autoAssign')}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2, pt: 0.5, gap: 1, flexWrap: 'wrap' }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={loading}>{t('common.cancel')}</Button>
            <Button
              variant="outlined" onClick={handleGenerateOrder} disabled={loading}
              startIcon={loadingType === 'order' ? <CircularProgress size={16} /> : <QrCode2Icon />}
              sx={{ fontWeight: 700, textTransform: 'none' }}
            >
              {loadingType === 'order' ? t('shopOrder.qr.generating') : t('shopOrder.qr.orderQr')}
            </Button>
            <Button
              variant="contained" onClick={handleGenerateQueue} disabled={loading}
              startIcon={loadingType === 'queue' ? <CircularProgress size={16} /> : <TableRestaurantIcon />}
              sx={{ fontWeight: 700, textTransform: 'none', flex: '1 1 140px' }}
            >
              {loadingType === 'queue' ? t('shopOrder.qr.generating') : `${t('shopOrder.qr.queueTitle')} · ${queueLanguage.toUpperCase()}`}
            </Button>
          </>
        ) : (
          <>
            <Tooltip title={t('shopOrder.qr.generateNew')}>
              <Button startIcon={<RefreshIcon />} onClick={handleReset}
                sx={{ textTransform: 'none' }}>
                {t('shopOrder.qr.new')}
              </Button>
            </Tooltip>
            {isQueue && (
              <Button variant="outlined" startIcon={<ShareIcon />} onClick={handleShare}
                sx={{ fontWeight: 700, textTransform: 'none' }}>
                {shareDone ? 'Link copied' : 'Share QR Code'}
              </Button>
            )}
            <Button
              variant="contained" startIcon={<PrintIcon />}
              onClick={() => isQueue ? printQueueQrTracked(result, setError) : printWalkUpQrTracked(result, setError)}
              sx={{ fontWeight: 700, textTransform: 'none', flex: 1 }}
            >
              {isQueue ? t('shopOrder.qr.printQueue') : t('shopOrder.qr.printSlip')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
