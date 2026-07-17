import React from 'react'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TranslateIcon from '@mui/icons-material/Translate'
import { SUPPORTED_LANGUAGES } from '../i18n/translations'
import { useI18n } from '../i18n/I18nContext'

export default function LanguageSelector({ size = 'small', compact = false, variant = 'outlined' }) {
  const { language, setLanguage, t } = useI18n()

  return (
    <FormControl size={size} variant={variant} sx={{ minWidth: compact ? 82 : 150 }}>
      {!compact && <InputLabel id="language-select-label">{t('language.label')}</InputLabel>}
      <Select
        labelId="language-select-label"
        value={language}
        label={compact ? undefined : t('language.label')}
        onChange={(event) => setLanguage(event.target.value)}
        renderValue={(value) => {
          const selected = SUPPORTED_LANGUAGES.find((item) => item.code === value) || SUPPORTED_LANGUAGES[0]
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <TranslateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              {compact ? selected.code.toUpperCase() : selected.nativeLabel}
            </Box>
          )
        }}
      >
        {SUPPORTED_LANGUAGES.map((item) => (
          <MenuItem key={item.code} value={item.code}>
            {item.nativeLabel} ({item.code.toUpperCase()})
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
