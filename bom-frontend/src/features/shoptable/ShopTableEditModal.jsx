import React, { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import { createShopTable, updateShopTable } from '../../api/shopApi'

export default function ShopTableEditModal({ open, table, onClose, onSaved }) {
  const [name, setName] = useState(table?.tableName || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Table name is required'); return }
    setSaving(true); setError('')
    try {
      if (table?.id) {
        await updateShopTable(table.id, { tableName: name })
      } else {
        await createShopTable(name.trim())
      }
      onSaved && onSaved()
    } catch (e) { setError(e.message || 'Save failed'); setSaving(false) }
  }

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{table?.id ? 'Edit Table' : 'New Table'}</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <TextField label="Table Name" value={name} onChange={e => setName(e.target.value)} fullWidth disabled={saving} />
          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}
