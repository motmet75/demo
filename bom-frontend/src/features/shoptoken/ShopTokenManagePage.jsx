import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid } from '@mui/x-data-grid'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import RefreshIcon from '@mui/icons-material/Refresh'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import ToggleOnIcon from '@mui/icons-material/ToggleOn'
import ToggleOffIcon from '@mui/icons-material/ToggleOff'
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet'
import { fetchTokens, enableToken, disableToken, deleteToken, fetchAllowedPublicIps, updateAllowedPublicIps, refreshAllowedPublicIps } from '../../api/shopApi'

const dateFmt = (v) => v ? new Date(v).toLocaleString('vi-VN') : '-'

const splitIps = (value) => String(value || '')
  .split(/[,;\r\n]+/)
  .map(ip => ip.trim())
  .filter(Boolean)
  .filter((ip, index, arr) => arr.findIndex(other => other.toLowerCase() === ip.toLowerCase()) === index)

const normalizeIpValue = (value) => String(value || '').trim().toLowerCase()

export default function ShopTokenManagePage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ipInfo, setIpInfo] = useState({ counterNetworkRules: [], counterPublicIp: '', counterPublicIpUpdatedAt: null })
  const [ipLoading, setIpLoading] = useState(false)
  const [ipSaving, setIpSaving] = useState(false)

  const normalizeRule = useCallback((rule) => {
    const counterPublicIp = String(rule?.counterPublicIp || '').trim()
    return {
      counterPublicIp,
      allowedPublicIps: splitIps(Array.isArray(rule?.allowedPublicIps) ? rule.allowedPublicIps.join('\n') : rule?.allowedPublicIps),
      allowAllNetworks: Boolean(rule?.allowAllNetworks),
    }
  }, [])

  const applyIpInfo = useCallback((data) => {
    const counterPublicIp = data?.counterPublicIp || ''
    let rules = Array.isArray(data?.counterNetworkRules) ? data.counterNetworkRules.map(normalizeRule).filter(r => r.counterPublicIp) : []
    if (!rules.length && counterPublicIp) {
      rules = [{
        counterPublicIp,
        allowedPublicIps: Array.isArray(data?.allowedPublicIps) && data.allowedPublicIps.length ? data.allowedPublicIps : [counterPublicIp],
        allowAllNetworks: Boolean(data?.allowAllNetworks),
      }]
    }
    setIpInfo({
      counterNetworkRules: rules,
      counterPublicIp,
      counterPublicIpUpdatedAt: data?.counterPublicIpUpdatedAt || null,
    })
  }, [normalizeRule])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchTokens()
      setRows(Array.isArray(data) ? data : [])
    } catch { setError('Failed to load tokens') }
    setLoading(false)
  }, [])

  const loadIpInfo = useCallback(async () => {
    setIpLoading(true)
    try {
      const { res, data } = await fetchAllowedPublicIps()
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load allowed IPs')
      applyIpInfo(data)
    } catch (e) {
      setError(e.message || 'Failed to load allowed IPs')
    } finally {
      setIpLoading(false)
    }
  }, [applyIpInfo])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadIpInfo() }, [loadIpInfo])

  const handleRefreshIp = async () => {
    setIpLoading(true); setError('')
    try {
      const { res, data } = await refreshAllowedPublicIps()
      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to refresh counter IP')
      applyIpInfo(data)
    } catch (e) {
      setError(e.message || 'Failed to refresh counter IP')
    } finally {
      setIpLoading(false)
    }
  }

  const currentCounterKey = normalizeIpValue(ipInfo.counterPublicIp)
  const currentRuleIndex = currentCounterKey
    ? ipInfo.counterNetworkRules.findIndex(rule => normalizeIpValue(rule.counterPublicIp) === currentCounterKey)
    : -1
  const currentRule = currentRuleIndex >= 0 ? ipInfo.counterNetworkRules[currentRuleIndex] : null

  const updateRule = (index, patch) => {
    setIpInfo(prev => ({
      ...prev,
      counterNetworkRules: prev.counterNetworkRules.map((rule, i) => i === index ? normalizeRule({ ...rule, ...patch }) : rule),
    }))
  }

  const removeRule = (index) => {
    setIpInfo(prev => ({ ...prev, counterNetworkRules: prev.counterNetworkRules.filter((_, i) => i !== index) }))
  }

  const addRule = (counterPublicIp = '') => {
    const clean = String(counterPublicIp || '').trim()
    setIpInfo(prev => {
      if (clean && prev.counterNetworkRules.some(rule => normalizeIpValue(rule.counterPublicIp) === normalizeIpValue(clean))) return prev
      return {
        ...prev,
        counterNetworkRules: [...prev.counterNetworkRules, {
          counterPublicIp: clean,
          allowedPublicIps: clean ? [clean] : [],
          allowAllNetworks: false,
        }],
      }
    })
  }

  const handleAddCurrentIp = () => {
    if (!ipInfo.counterPublicIp) return
    if (currentRuleIndex < 0) addRule(ipInfo.counterPublicIp)
    else updateRule(currentRuleIndex, {
      allowedPublicIps: splitIps(`${currentRule.allowedPublicIps.join('\n')}\n${ipInfo.counterPublicIp}`),
    })
  }

  const currentRuleFrom = (rules) => {
    if (!currentCounterKey) return null
    return rules.find(rule => normalizeIpValue(rule.counterPublicIp) === currentCounterKey) || null
  }

  const withCurrentRule = (rulesInput) => {
    const rules = rulesInput.map(normalizeRule).filter(rule => rule.counterPublicIp)
    if (!ipInfo.counterPublicIp || currentRuleFrom(rules)) return rules
    return [...rules, normalizeRule({
      counterPublicIp: ipInfo.counterPublicIp,
      allowedPublicIps: [ipInfo.counterPublicIp],
      allowAllNetworks: false,
    })]
  }

  const persistNetworkRules = async (rulesInput) => {
    const rules = withCurrentRule(rulesInput)
    const activeRule = currentRuleFrom(rules)
    const { res, data } = await updateAllowedPublicIps(
      activeRule?.allowedPublicIps || [],
      Boolean(activeRule?.allowAllNetworks),
      rules,
      activeRule?.counterPublicIp || ipInfo.counterPublicIp || null,
    )
    if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to save network rules')
    applyIpInfo(data)
  }

  const handleSaveIps = async () => {
    setIpSaving(true); setError('')
    try {
      await persistNetworkRules(ipInfo.counterNetworkRules)
    } catch (e) {
      setError(e.message || 'Failed to save network rules')
    } finally {
      setIpSaving(false)
    }
  }

  const handleAllowAnyCurrentIp = async () => {
    if (!ipInfo.counterPublicIp || ipSaving) return
    const rules = withCurrentRule(ipInfo.counterNetworkRules).map(rule => (
      normalizeIpValue(rule.counterPublicIp) === currentCounterKey
        ? { ...rule, allowAllNetworks: true }
        : rule
    ))
    setIpSaving(true); setError('')
    try {
      await persistNetworkRules(rules)
    } catch (e) {
      setError(e.message || 'Failed to save network rules')
    } finally {
      setIpSaving(false)
    }
  }

  const handleAllowAllChange = async (index, checked) => {
    const rules = ipInfo.counterNetworkRules.map((rule, i) => (
      i === index ? normalizeRule({ ...rule, allowAllNetworks: checked }) : rule
    ))
    setIpInfo(prev => ({ ...prev, counterNetworkRules: rules }))
    setIpSaving(true); setError('')
    try {
      await persistNetworkRules(rules)
    } catch (e) {
      setError(e.message || 'Failed to save network rules')
    } finally {
      setIpSaving(false)
    }
  }

  const handleToggle = async (row) => {
    try {
      if (row.enabled) await disableToken(row.id)
      else await enableToken(row.id)
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
      renderCell: ({ value }) => <Typography variant="body2" noWrap>{value || '-'}</Typography>,
    },
    {
      field: 'token',
      headerName: 'Token',
      width: 200,
      renderCell: ({ value }) => (
        <Tooltip title={value}>
          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }} noWrap>
            {value?.slice(0, 8)}...{value?.slice(-4)}
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
      renderCell: ({ value }) => <Typography variant="caption" color="text.secondary">{dateFmt(value)}</Typography>,
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 160,
      renderCell: ({ value }) => <Typography variant="caption" color="text.secondary">{dateFmt(value)}</Typography>,
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
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">Refresh Tokens</Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        Walk-up QR tokens are automatically disabled when their order is completed or picked up.
        Table QR tokens remain active permanently. You can manually enable or disable any token here.
      </Typography>

      <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1, p: 1.5, bgcolor: '#f8fafc' }}>
        <Stack spacing={1.25}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <SettingsEthernetIcon color="primary" fontSize="small" />
            <Typography fontWeight={800}>Shop Network Access</Typography>
            <Chip
              size="small"
              label={ipInfo.counterPublicIp || 'Counter IP not captured'}
              color={ipInfo.counterPublicIp ? 'success' : 'warning'}
              variant="outlined"
              sx={{ maxWidth: 240, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
            />
            <Chip
              size="small"
              label={currentRule?.allowAllNetworks ? 'Current: all networks' : currentRule ? `Current: ${currentRule.allowedPublicIps.length} network${currentRule.allowedPublicIps.length === 1 ? '' : 's'}` : 'No current rule'}
              color={currentRule?.allowAllNetworks ? 'warning' : currentRule ? 'info' : 'default'}
              variant={currentRule ? 'outlined' : 'filled'}
            />
            {ipInfo.counterPublicIpUpdatedAt && (
              <Typography variant="caption" color="text.secondary">Updated {dateFmt(ipInfo.counterPublicIpUpdatedAt)}</Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Button startIcon={<RefreshIcon />} onClick={handleRefreshIp} disabled={ipLoading} size="small" variant="outlined">
              {ipLoading ? 'Refreshing...' : 'Refresh IP'}
            </Button>
          </Box>

          <Stack spacing={1}>
            {ipInfo.counterNetworkRules.map((rule, index) => (
              <Box key={`${rule.counterPublicIp || 'new'}-${index}`} sx={{ border: '1px solid #e2e8f0', borderRadius: 1, p: 1.25, bgcolor: '#fff' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
                  <TextField
                    label="Counter IP"
                    value={rule.counterPublicIp}
                    onChange={e => updateRule(index, { counterPublicIp: e.target.value })}
                    size="small"
                    sx={{ width: 190 }}
                  />
                  <FormControlLabel
                    control={(
                      <Switch
                        checked={Boolean(rule.allowAllNetworks)}
                        disabled={ipSaving || !rule.counterPublicIp}
                        onChange={e => handleAllowAllChange(index, e.target.checked)}
                      />
                    )}
                    label="Allow any network"
                  />
                  {normalizeIpValue(rule.counterPublicIp) === currentCounterKey && <Chip size="small" label="Current counter" color="success" variant="outlined" />}
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Remove counter rule">
                    <IconButton size="small" color="error" onClick={() => removeRule(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
                {!rule.allowAllNetworks && (
                  <TextField
                    label="Networks allowed to order"
                    value={rule.allowedPublicIps.join('\n')}
                    onChange={e => updateRule(index, { allowedPublicIps: splitIps(e.target.value) })}
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="One public IP per line"
                    helperText="Customers can order only from these public IPs when this counter IP is active."
                  />
                )}
              </Box>
            ))}
            {!ipInfo.counterNetworkRules.length && (
              <Alert severity="info">Refresh IP or add a counter rule to start controlling ordering networks.</Alert>
            )}
          </Stack>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button startIcon={<AddIcon />} onClick={() => addRule()} disabled={ipSaving} size="small" variant="outlined" sx={{ textTransform: 'none' }}>Add counter rule</Button>
            <Button onClick={handleAddCurrentIp} disabled={!ipInfo.counterPublicIp || ipSaving} size="small" variant="outlined" sx={{ textTransform: 'none' }}>Use current IP</Button>
            <Button onClick={handleAllowAnyCurrentIp} disabled={!ipInfo.counterPublicIp || ipSaving} size="small" variant="outlined" sx={{ textTransform: 'none' }}>Allow any for current IP</Button>
            <Button onClick={handleSaveIps} disabled={ipSaving} size="small" variant="contained" sx={{ textTransform: 'none', fontWeight: 700 }}>
              {ipSaving ? 'Saving...' : 'Save Network Rules'}
            </Button>
          </Box>
        </Stack>
      </Box>

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