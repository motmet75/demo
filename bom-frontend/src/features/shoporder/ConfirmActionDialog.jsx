import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { useI18n } from '../../i18n/I18nContext'

/**
 * Reusable confirmation dialog.
 *
 * Props:
 *   open          boolean
 *   title         string
 *   message       string
 *   confirmLabel  string  (default "Confirm")
 *   confirmColor  "error"|"warning"|"primary"|"success"
 *   requireReason boolean — shows a required text field; confirm is blocked until filled
 *   reasonLabel   string  (default "Reason for cancellation")
 *   onConfirm(reason?: string) — called with reason string (or undefined if !requireReason)
 *   onCancel()
 */
export default function ConfirmActionDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmColor = 'primary',
  requireReason = false,
  reasonLabel = 'Reason for cancellation',
  onConfirm,
  onCancel,
}) {
  const { language } = useI18n()
  const vi = language === 'vi'
  const [reason, setReason]   = useState('')
  const [busy, setBusy]       = useState(false)

  // reset every time dialog opens
  useEffect(() => {
    if (open) { setReason(''); setBusy(false) }
  }, [open])

  const canConfirm = !busy && (!requireReason || reason.trim().length > 0)

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm(requireReason ? reason.trim() : undefined)
    } finally {
      setBusy(false)
    }
  }

  const isDestructive = confirmColor === 'error'
  const Icon = isDestructive ? ErrorOutlineIcon : WarningAmberIcon
  const iconColor = { error: '#c62828', warning: '#e65100', primary: '#1565c0', success: '#2e7d32' }[confirmColor] || '#1565c0'

  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ pb: 0.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Icon sx={{ color: iconColor, fontSize: 26 }} />
        <Typography fontWeight={800} sx={{ fontSize: 16 }}>{title}</Typography>
      </DialogTitle>
      <DialogContent>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: requireReason ? 2 : 0, whiteSpace: 'pre-line' }}>
            {message}
          </Typography>
        )}
        {requireReason && (
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label={reasonLabel}
            placeholder="Required — describe why this order is being cancelled…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            size="small"
            error={reason.trim().length === 0}
            helperText={reason.trim().length === 0 ? (vi ? 'Vui lòng nhập lý do' : 'A reason is required') : ' '}
            sx={{ mt: 0.5 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} disabled={busy} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={handleConfirm}
          disabled={!canConfirm}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, minWidth: 100 }}
        >
          {busy ? 'Please wait…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
