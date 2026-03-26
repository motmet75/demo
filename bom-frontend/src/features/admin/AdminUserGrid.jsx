import React, { useEffect, useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { createAdminUser, deleteAdminUser, fetchAdminUsers, updateAdminUser } from '../../api/adminUserApi'
import { getTenants } from '../../api/tenantApi'
import { getCompanies } from '../../api/companyApi'
import AdminUserEditModal from './AdminUserEditModal'

export default function AdminUserGrid() {
  const [rows, setRows] = useState([])
  const [tenants, setTenants] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selected, setSelected] = useState(null)

  const tenantMap = Object.fromEntries(tenants.map((t) => [String(t.id), t]))
  const companyMap = Object.fromEntries(companies.map((c) => [String(c.id), c]))

  const load = async () => {
    setLoading(true)
    try {
      const [users, tenantList] = await Promise.all([fetchAdminUsers(), getTenants().catch(() => [])])
      setTenants(tenantList)
      setRows(users.map((user) => ({ ...user, id: user.id })))
      // load companies for all tenants that appear in users or tenant list
      const tenantIds = [...new Set([
        ...tenantList.map((t) => String(t.id)),
        ...users.filter((u) => u.assignedTenantId).map((u) => String(u.assignedTenantId))
      ])]
      const companyArrays = await Promise.all(tenantIds.map((tid) => getCompanies(tid).catch(() => [])))
      const allCompanies = companyArrays.flat()
      setCompanies(allCompanies)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

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
    if (!window.confirm('Delete this user?')) return
    await deleteAdminUser(id)
    await load()
  }

  const columns = [
    { field: 'username', headerName: 'Username', flex: 1, minWidth: 140 },
    { field: 'firstName', headerName: 'First Name', flex: 1, minWidth: 120 },
    { field: 'lastName', headerName: 'Last Name', flex: 1, minWidth: 120 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 180 },
    {
      field: 'enabled',
      headerName: 'Status',
      width: 110,
      renderCell: ({ value }) => <Chip label={value ? 'Enabled' : 'Disabled'} color={value ? 'success' : 'default'} size="small" />
    },
    {
      field: 'authorities',
      headerName: 'Authorities',
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
      headerName: 'Assigned Tenant',
      flex: 1.2,
      minWidth: 180,
      renderCell: ({ value }) => {
        if (!value) return <Chip label="— None —" size="small" variant="outlined" color="default" />
        const t = tenantMap[String(value)]
        return t
          ? <Chip label={`${t.tenantName} (${t.tenantCode})`} size="small" color={t.isActive ? 'primary' : 'warning'} variant="outlined" />
          : <Chip label={value} size="small" variant="outlined" />
      }
    },
    {
      field: 'assignedCompanyId',
      headerName: 'Assigned Company',
      flex: 1.2,
      minWidth: 200,
      renderCell: ({ value }) => {
        if (!value) return <Chip label="— None —" size="small" variant="outlined" color="default" />
        const c = companyMap[String(value)]
        return c
          ? <Chip label={`${c.companyName ?? c.name} (${c.companyCode ?? c.code})`} size="small" color="secondary" variant="outlined" />
          : <Chip label={value} size="small" variant="outlined" />
      }
    },
    {
      field: 'actions',
      type: 'actions',
      width: 90,
      getActions: (params) => [
        <GridActionsCellItem icon={<EditIcon />} label="Edit" onClick={() => { setSelected(params.row); setDialogOpen(true) }} />,
        <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDelete(params.id)} />
      ]
    }
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Users</Typography>
          <Typography variant="body2" color="text.secondary">Admin-only CRUD for Spring Boot users and roles.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setSelected(null); setDialogOpen(true) }}>
          New User
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
      />

      <AdminUserEditModal
        open={dialogOpen}
        user={selected}
        onClose={() => { if (!saving) { setDialogOpen(false); setSelected(null) } }}
        onSave={handleSave}
        saving={saving}
      />
    </Box>
  )
}
