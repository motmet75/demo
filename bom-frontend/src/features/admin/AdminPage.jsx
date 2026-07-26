import React from 'react'
import { Alert, Box } from '@mui/material'
import { useAuth } from '../../context/useAuth'
import { useI18n } from '../../i18n/I18nContext'
import AdminUserGrid from './AdminUserGrid'
import AdminShopValidityPanel from './AdminShopValidityPanel'

export default function AdminPage() {
  const { user } = useAuth()
  const { t } = useI18n()

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        {t('admin.accessNotice', { username: user?.username || t('common.notAvailable') })}
      </Alert>
      <AdminShopValidityPanel />
      <AdminUserGrid />
    </Box>
  )
}
