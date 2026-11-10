import React, { useCallback, useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import Stack from '@mui/material/Stack'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import FlipCameraIosIcon from '@mui/icons-material/FlipCameraIos'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import { useI18n } from '../../i18n/I18nContext'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {qrRecoveryCandidates} from '../../utils/qrImageRecovery'
import {decodeFaintQrWithZbar} from '../../utils/cccdQrZbar'

/**
 * Shared QR reader. Image uploads are decoded in the browser by html5-qrcode:
 * they are not sent to the invoice/CCCD APIs.
 *
 * enableZoom is opt-in for CCCD QR use; capability-driven controls are shown
 * only for cameras that actually support hardware zoom.
 */
export default function VoucherQrScanDialog({
  open, onClose, onScan, continuous = false, enableZoom = false,
  title = 'Scan Voucher QR',
  manualLabel = 'Voucher code or QR payload',
  scannerLabel = 'Camera or image scanner',
}) {
  const { t } = useI18n()
  const shownTitle = title === 'Scan Voucher QR' ? t('shopOrder.scanner.voucherTitle') : title
  const shownManualLabel = manualLabel === 'Voucher code or QR payload' ? t('shopOrder.scanner.voucherInput') : manualLabel
  const shownScannerLabel = scannerLabel === 'Camera or image scanner' ? t('shopOrder.scanner.cameraOrImage') : scannerLabel
  const scannerRef = useRef(null)
  const detectedRef = useRef(false)
  const readerIdRef = useRef(`voucher-qr-reader-${Math.random().toString(36).slice(2)}`)
  const onScanRef = useRef(onScan)
  const openRef = useRef(open)
  onScanRef.current = onScan
  openRef.current = open
  const runIdRef = useRef(0)
  const facingModeRef = useRef('environment')

  const [manualValue, setManualValue] = useState('')
  const [starting, setStarting] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [decodingFile, setDecodingFile] = useState(false)
  const [decodeProgress, setDecodeProgress] = useState('')
  const [error, setError] = useState('')
  const [facingMode, setFacingMode] = useState('environment')
  const [zoomRange, setZoomRange] = useState(null)
  const [zoom, setZoom] = useState(1)

  const cameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const stopCamera = useCallback(async () => {
    runIdRef.current += 1
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop()
      } catch {
        // Ignore stop errors caused by browser camera teardown timing.
      }
      try {
        await scanner.clear()
      } catch {
        // The element may already be cleared during dialog close.
      }
    }
    setStreaming(false)
    setStarting(false)
    setDecodingFile(false)
    setDecodeProgress('')
    setZoomRange(null)
  }, [])

  // Keep callback identity stable when the invoice form rerenders while a
  // camera session is active; otherwise the dialog keeps restarting the camera.
  const handleDetected = useCallback(rawValue => {
    const value = String(rawValue || '').trim()
    if (!value || detectedRef.current) return
    detectedRef.current = true
    if (!continuous) void stopCamera()
    onScanRef.current?.(value)
    if (continuous) window.setTimeout(() => { detectedRef.current = false }, 1200)
  }, [continuous, stopCamera])

  const createScanner = useCallback(() => new Html5Qrcode(readerIdRef.current, {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    verbose: false,
  }), [])

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      setError('Trình duyệt không cấp quyền camera. Có thể chọn ảnh QR từ thư viện.')
      return
    }
    setError('')
    detectedRef.current = false
    await stopCamera()
    if (!openRef.current) return
    const runId = ++runIdRef.current
    setStarting(true)

    try {
      const scanner = createScanner()
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: facingModeRef.current },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.72)
            return { width: size, height: size }
          },
        },
        decodedText => handleDetected(decodedText),
        () => {}
      )
      if (runId !== runIdRef.current) {
        // Closed/switching before permissions were granted. Never leave
        // an old stream running behind the dialog.
        try { if (scanner.isScanning) await scanner.stop() } catch {}
        try { await scanner.clear() } catch {}
        return
      }
      setStreaming(true)
      if (enableZoom) {
        try {
          const capabilities = scanner.getRunningTrackCapabilities?.()
          const supported = capabilities?.zoom
          const min = Number(supported?.min)
          const max = Number(supported?.max)
          if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
            const settings = scanner.getRunningTrackSettings?.()
            const current = Number(settings?.zoom)
            setZoomRange({ min, max, step: Number(supported?.step) > 0 ? Number(supported.step) : 0.1 })
            setZoom(Number.isFinite(current) ? current : min)
          } else {
            setZoomRange(null)
          }
        } catch {
          setZoomRange(null)
        }
      }
    } catch (e) {
      if (runId === runIdRef.current) {
        setError(e?.message || 'Không mở được camera. Hãy thử chọn ảnh QR.')
        setStarting(false)
        await stopCamera()
      }
    } finally {
      if (runId === runIdRef.current) setStarting(false)
    }
  }, [cameraSupported, createScanner, enableZoom, handleDetected, stopCamera])

  const changeZoom = async next => {
    const scanner = scannerRef.current
    if (!scanner?.isScanning || !zoomRange) return
    const zoomValue = Math.max(zoomRange.min, Math.min(zoomRange.max, Number(next)))
    try {
      // Hardware-only camera zoom. iOS devices/browsers may not expose it.
      await scanner.applyVideoConstraints({ advanced: [{ zoom: zoomValue }] })
      setZoom(zoomValue)
      setError('')
    } catch {
      setError('Camera hoặc trình duyệt không cho điều chỉnh zoom. Dùng nút Chọn ảnh QR để quét ảnh chụp rõ nét.')
    }
  }

  const switchCamera = () => {
    facingModeRef.current = facingModeRef.current === 'environment' ? 'user' : 'environment'
    setFacingMode(facingModeRef.current)
    void startCamera()
  }

  const decodeImageFile = async file => {
    if (!file) return
    if (!file.type?.startsWith('image/')) {
      setError('Chỉ hỗ trợ ảnh QR. Hãy chọn ảnh JPG hoặc PNG từ thư viện.')
      return
    }
    setError('')
    setDecodeProgress('Đang đọc QR từ ảnh gốc…')
    detectedRef.current = false
    await stopCamera()
    if (!openRef.current) return
    const runId = ++runIdRef.current
    setDecodingFile(true)
    const scanner = createScanner()
    scannerRef.current = scanner
    let decodedText = ''
    let tried = 0
    try {
      try {
        // The first attempt always preserves the original unmodified photo.
        decodedText = await scanner.scanFile(file, false)
      } catch {
        // Not a fatal error. Faint ID-card QRs can need image enhancement.
      }
      if (!decodedText && enableZoom && runId === runIdRef.current) {
        // The CCCD QR may be heavily overprinted with security guilloche.
        // A supplied real-world sample decoded with native ZBar only after
        // a GREEN-channel median3 crop, while ZXing and thresholding failed.
        try {
          decodedText = await decodeFaintQrWithZbar(file, {
            isCancelled: () => runId !== runIdRef.current || !openRef.current,
            onProgress: setDecodeProgress
          }) || ''
        } catch {
          // ZBar unavailable on this device? Continue with existing ZXing
          // enhancement attempts. Never print sensitive QR payloads.
        }
      }
      if (!decodedText && runId === runIdRef.current) {
        try {
          for await (const candidate of qrRecoveryCandidates(file)) {
            if (runId !== runIdRef.current || !openRef.current) break
            tried++
            setDecodeProgress(`Đang tăng tương phản và thử đọc QR (${tried}/6)…`)
            try {
              decodedText = await scanner.scanFile(candidate.file, false)
            } catch {
              // Try the next locally generated image, without showing a
              // raw ZXing/Html5Qrcode error to an invoice operator.
            }
            if (decodedText) break
          }
        } catch {
          // Image-processing unsupported/failed. Keep a useful Vietnamese
          // instruction rather than exposing a browser exception.
        }
      }
      if (decodedText && runId === runIdRef.current) {
        handleDetected(decodedText)
      } else if (runId === runIdRef.current) {
        setError(
          'Chưa đọc được mã QR, kể cả sau khi thử ZBar và xử lý nhiễu. ' +
          'Ảnh có thể bị mờ, lóa hoặc mất nét. Hãy chụp lại với camera sau, ' +
          'đủ sáng, giữ điện thoại đứng yên và để toàn bộ mã QR trong ảnh. ' +
          'Bạn cũng có thể dùng nút Tải 1–2 ảnh CCCD để nhận dạng tên/địa chỉ.'
        )
      }
    } finally {
      if (runId === runIdRef.current) {
        scannerRef.current = null
        try { await scanner.clear() } catch {
          // Closing the dialog can detach its DOM element.
        }
        setDecodingFile(false)
        setDecodeProgress('')
      }
    }
  }

  useEffect(() => {
    if (!open) return undefined
    setManualValue('')
    setError('')
    detectedRef.current = false
    facingModeRef.current = 'environment'
    setFacingMode('environment')
    void startCamera()
    return () => { void stopCamera() }
  }, [open, startCamera, stopCamera])

  const submitManual = () => {
    const value = manualValue.trim()
    if (!value) return
    handleDetected(value)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, m: { xs: 1, sm: 2 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
        <QrCode2Icon color="primary" /> {shownTitle}
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {error && <Alert severity="warning">{error}</Alert>}

        <Box sx={{
          position: 'relative', bgcolor: '#0f172a', borderRadius: 2,
          overflow: 'hidden', aspectRatio: '4 / 3', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          '& video': { width: '100% !important', height: '100% !important', objectFit: 'cover' },
          '& img': { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
        }}>
          <Box id={readerIdRef.current} sx={{ position: 'absolute', inset: 0 }} />
          {!streaming && !starting && !decodingFile && (
            <Box sx={{ textAlign: 'center', color: '#e2e8f0', px: 2, zIndex: 1, pointerEvents: 'none' }}>
              <QrCode2Icon sx={{ fontSize: 42, mb: 1 }} />
              <Typography variant="body2">{shownScannerLabel}</Typography>
            </Box>
          )}
          {(starting || decodingFile) && (
            <Box sx={{ textAlign: 'center', color: '#e2e8f0', zIndex: 1 }}>
              <CircularProgress size={28} sx={{ color: '#fff' }} />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {decodingFile ? (decodeProgress || 'Đang đọc ảnh QR…') : t('shopOrder.scanner.starting')}
              </Typography>
            </Box>
          )}
          <Chip size="small"
            label={streaming ? t('shopOrder.scanner.cameraActive') : t('shopOrder.scanner.scanner')}
            color={streaming ? 'success' : 'default'}
            sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 700, zIndex: 2 }} />
        </Box>

        {enableZoom && streaming && (
          zoomRange ? <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1 }}>
            <ZoomInIcon fontSize="small" color="primary" />
            <Typography variant="caption" sx={{ minWidth: 42 }}>Zoom</Typography>
            <Slider aria-label="Zoom camera" min={zoomRange.min} max={zoomRange.max}
              step={zoomRange.step} value={zoom} onChange={(_, value) => setZoom(value)}
              onChangeCommitted={(_, value) => { void changeZoom(value) }}
              valueLabelDisplay="auto" sx={{ flex: 1 }} />
            <Typography variant="caption">{Number(zoom).toFixed(1)}×</Typography>
          </Stack> : <Typography variant="caption" color="text.secondary">
            Zoom không được camera/trình duyệt hỗ trợ. Có thể chọn ảnh QR từ thư viện.
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined"
            startIcon={starting ? <CircularProgress size={14} /> : <CameraAltIcon />}
            onClick={startCamera} disabled={starting || decodingFile || !cameraSupported}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {t('shopOrder.scanner.startCamera')}
          </Button>
          {enableZoom && <Button size="small" variant="outlined"
            startIcon={<FlipCameraIosIcon />} onClick={switchCamera}
            disabled={starting || decodingFile || !cameraSupported}
            sx={{ textTransform: 'none' }}>
            {facingMode === 'environment' ? 'Đổi camera' : 'Camera sau'}
          </Button>}
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button size="small" variant="contained" component="label" fullWidth
            startIcon={<UploadFileIcon />} disabled={decodingFile}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Chọn ảnh QR từ thư viện
            <input hidden type="file" accept="image/*"
              onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void decodeImageFile(file)
              }} />
          </Button>
          <Button size="small" variant="outlined" component="label" fullWidth
            startIcon={<CameraAltIcon />} disabled={decodingFile}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            Chụp ảnh QR
            <input hidden type="file" accept="image/*" capture="environment"
              onChange={event => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void decodeImageFile(file)
              }} />
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Ảnh QR được đọc ngay trong trình duyệt, không tải ảnh lên server.
          Nếu mã in nhạt trên nền xanh của CCCD, ứng dụng sẽ tự thử xử lý
          tương phản trước khi báo không đọc được.
        </Typography>

        <TextField label={shownManualLabel} size="small" fullWidth
          value={manualValue} onChange={e => setManualValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitManual() }} />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={() => { void stopCamera(); onClose?.() }}
          sx={{ textTransform: 'none' }}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={submitManual}
          disabled={!manualValue.trim()} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {t('shopOrder.scanner.use')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
