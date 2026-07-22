import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../../api/adminUserApi'
import { getTenants } from '../../api/tenantApi'
import { getCompanies } from '../../api/companyApi'
import { useI18n } from '../../i18n/I18nContext'
import AdminUserEditModal from './AdminUserEditModal'

export default function AdminUserGrid() {
  const { t, tx } = useI18n()
  const [rows, setRows] = useState([])
  const [tenants, setTenants] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  const tenantMap = Object.fromEntries(tenants.map((tenant) => [String(tenant.id), tenant]))
  const companyMap = Object.fromEntries(companies.map((company) => [String(company.id), company]))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [users, tenantList] = await Promise.all([fetchAdminUsers(), getTenants().catch(() => [])])
      setTenants(tenantList)
      setRows(users.map((user) => ({ ...user, id: user.id })))
      const tenantIds = [...new Set([
        ...tenantList.map((tenant) => String(tenant.id)),
        ...users.filter((user) => user.assignedTenantId).map((user) => String(user.assignedTenantId))
      ])]
      const companyArrays = await Promise.all(tenantIds.map((tenantId) => getCompanies(tenantId).catch(() => [])))
      setCompanies(companyArrays.flat())
    } catch (e) {
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async (payload) => {
    setSaving(true)
    try {
      if (selected?.id) {
        await updateAdminUser(selected.id, payload)
      } else {
        await createAdminUser(payload)
      }
      setDialogOpen(false)
      setSelected(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm(t('admin.users.deleteConfirm'))) return
    try {
      await deleteAdminUser(id)
      await load()
    } catch (e) {
      setError(e.message || 'Failed to delete user')
    }
  }

  const columns = [
    { field: 'username', headerName: t('admin.users.username'), flex: 1, minWidth: 140 },
    { field: 'firstName', headerName: t('admin.users.firstName'), flex: 1, minWidth: 120 },
    { field: 'lastName', headerName: t('admin.users.lastName'), flex: 1, minWidth: 120 },
    { field: 'email', headerName: t('admin.users.email'), flex: 1, minWidth: 180 },
    {
      field: 'enabled',
      headerName: t('common.status'),
      width: 110,
      renderCell: ({ value }) => <Chip label={value ? t('admin.users.enabled') : t('admin.users.disabled')} color={value ? 'success' : 'default'} size="small" />
    },
    {
      field: 'authorities',
      headerName: t('admin.users.authorities'),
      flex: 1.4,
      minWidth: 220,
      renderCell: ({ value }) => (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ py: 1 }}>
          {(value || []).map((role) => <Chip key={role} label={role} size="small" variant="outlined" />)}
        </Stack>
      )
    },
    {
      field: 'assignedTenantId',
      headerName: t('admin.users.assignedTenant'),
      flex: 1.2,
      minWidth: 180,
      renderCell: ({ value }) => {
        if (!value) return <Chip label={t('admin.users.none')} size="small" variant="outlined" color="default" />
        const tenant = tenantMap[String(value)]
        return tenant
          ? <Chip label={`${tenant.tenantName} (${tenant.tenantCode})`} size="small" color={tenant.isActive ? 'primary' : 'warning'} variant="outlined" />
          : <Chip label={value} size="small" variant="outlined" />
      }
    },
    {
      field: 'assignedCompanyId',
      headerName: t('admin.users.assignedCompany'),
      flex: 1.2,
      minWidth: 200,
      renderCell: ({ value }) => {
        if (!value) return <Chip label={t('admin.users.none')} size="small" variant="outlined" color="default" />
        const company = companyMap[String(value)]
        return company
          ? <Chip label={`${company.companyName ?? company.name} (${company.companyCode ?? company.code})`} size="small" color="secondary" variant="outlined" />
          : <Chip label={value} size="small" variant="outlined" />
      }
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: t('admin.users.actions'),
      width: 90,
      getActions: (params) => [
        <GridActionsCellItem key="edit" icon={<EditIcon />} label={t('common.edit')} onClick={() => { setSelected(params.row); setDialogOpen(true) }} />,
        <GridActionsCellItem key="delete" icon={<DeleteIcon />} label={t('common.delete')} onClick={() => handleDelete(params.id)} />
      ]
    }
  ]

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{tx(error)}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6">{t('admin.users.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('admin.users.description')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSelected(null); setDialogOpen(true) }} sx={{ flexShrink: 0 }}>
          {t('admin.users.new')}
        </Button>
      </Box>

      <DataGrid
        autoHeight
        rows={rows}
        columns={columns}
        loading={loading}
        disableRowSelectionOnClick
        pageSizeOptions={[5, 10, 25]}
        initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
        localeText={{ noRowsLabel: t('admin.users.noRows') }}
      />

      {dialogOpen ? (
        <AdminUserEditModal
          key={selected?.id || 'new'}
          open={dialogOpen}
          user={selected}
          onClose={() => { if (!saving) { setDialogOpen(false); setSelected(null) } }}
          onSave={handleSave}
          saving={saving}
        />
      ) : null}
    </Box>
  )
}
