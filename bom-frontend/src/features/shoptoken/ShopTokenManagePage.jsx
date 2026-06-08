import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import ToggleOffIcon from '@mui/icons-material/ToggleOff'
import { fetchTokens, enableToken, disableToken, deleteToken } from '../../api/shopApi'

const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN') : '—'

export default function ShopTokenManagePage() {
  const [rows, setRows]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchTokens()
      setRows(Array.isArray(data) ? data : [])
    } catch { setError('Failed to load tokens') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (row) => {
    try {
      if (row.enabled) {
        await disableToken(row.id)
      } else {
        await enableToken(row.id)
      }
      load()
    } catch (e) { setError(e.message || 'Failed to update token') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this token? Any QR code using it will stop working.')) return
    try {
      await deleteToken(id)
      load()
    } catch (e) { setError(e.message || 'Failed to delete token') }
  }

  const columns = [
    {
      field: 'tokenType',
      headerName: 'Type',
      width: 120,
      renderCell: ({ value }) => {
        const color = value === 'TABLE_QR' ? 'primary' : 'secondary'
        const label = value === 'TABLE_QR' ? 'Table QR' : value === 'DISPLAY_BOARD' ? 'Board' : value
        return <Chip label={label} size="small" color={color} variant="outlined" />
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 160,
      renderCell: ({ value }) => (
        <Typography variant="body2" noWrap>{value || '—'}</Typography>
      ),
    },
    {
      field: 'token',
      headerName: 'Token',
      width: 200,
      renderCell: ({ value }) => (
        <Tooltip title={value}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }} noWrap>
            {value?.slice(0, 8)}…{value?.slice(-4)}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'enabled',
      headerName: 'Status',
      width: 100,
      renderCell: ({ value }) => (
        <Chip
          label={value ? 'Active' : 'Disabled'}
          size="small"
          color={value ? 'success' : 'default'}
          variant={value ? 'filled' : 'outlined'}
        />
      ),
    },
    { field: 'accessCount', headerName: 'Uses', width: 70, type: 'number' },
    {
      field: 'lastAccessedAt',
      headerName: 'Last Used',
      width: 160,
      renderCell: ({ value }) => (
        <Typography variant="caption" color="text.secondary">{dateFmt(value)}</Typography>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 160,
      renderCell: ({ value }) => (
        <Typography variant="caption" color="text.secondary">{dateFmt(value)}</Typography>
      ),
    },
    {
      field: 'expiresAt',
      headerName: 'Expires',
      width: 160,
      renderCell: ({ value }) => (
        <Typography variant="caption" color={value && new Date(value) < new Date() ? 'error' : 'text.secondary'}>
          {dateFmt(value)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip title={row.enabled ? 'Disable token' : 'Enable token'}>
            <IconButton size="small" onClick={() => handleToggle(row)} color={row.enabled ? 'success' : 'default'}>
              {row.enabled ? <ToggleOnIcon /> : <ToggleOffIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete token">
            <IconButton size="small" color="error" onClick={() => handleDelete(row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={700}>QR Token Management</Typography>
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh</Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Walk-up QR tokens are automatically disabled when their order is completed or picked up.
        Table QR tokens remain active permanently. You can manually enable or disable any token here.
      </Typography>

      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ flex: 1, minHeight: 400 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={r => r.id}
          pageSizeOptions={[25, 50, 100]}
          density="compact"
          sx={{ '& .MuiDataGrid-row:hover': { bgcolor: '#f5f9ff' } }}
        />
      </Box>
    </Box>
  )
}
