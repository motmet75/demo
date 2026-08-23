import React from 'react'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TranslateIcon from '@mui/icons-material/Translate'
import { SUPPORTED_LANGUAGES } from '../i18n/translations'
import { useI18n } from '../i18n/I18nContext'

const FLAG_SVGS = {
  en: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#fff"/><g fill="#b22234"><rect width="36" height="2" y="0"/><rect width="36" height="2" y="4"/><rect width="36" height="2" y="8"/><rect width="36" height="2" y="12"/><rect width="36" height="2" y="16"/><rect width="36" height="2" y="20"/></g><rect width="15" height="13" fill="#3c3b6e"/><g fill="#fff"><circle cx="3" cy="3" r="0.7"/><circle cx="7" cy="3" r="0.7"/><circle cx="11" cy="3" r="0.7"/><circle cx="5" cy="6" r="0.7"/><circle cx="9" cy="6" r="0.7"/><circle cx="3" cy="9" r="0.7"/><circle cx="7" cy="9" r="0.7"/><circle cx="11" cy="9" r="0.7"/></g></svg>',
  cn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#de2910"/><polygon points="7,3 8.1,6.2 11.4,6.2 8.7,8.1 9.7,11.3 7,9.3 4.3,11.3 5.3,8.1 2.6,6.2 5.9,6.2" fill="#ffde00"/><circle cx="14" cy="5" r="1.1" fill="#ffde00"/><circle cx="17" cy="8" r="1.1" fill="#ffde00"/><circle cx="17" cy="12" r="1.1" fill="#ffde00"/><circle cx="14" cy="15" r="1.1" fill="#ffde00"/></svg>',
  tw: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#fe0000"/><rect width="18" height="12" fill="#000095"/><circle cx="9" cy="6" r="3.5" fill="#fff"/><circle cx="9" cy="6" r="2" fill="#000095"/></svg>',
  ja: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#fff"/><circle cx="18" cy="12" r="6" fill="#bc002d"/></svg>',
  ko: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#fff"/><path d="M18 6a6 6 0 0 1 0 12a3 3 0 0 1 0-6a3 3 0 0 0 0-6" fill="#cd2e3a"/><path d="M18 6a3 3 0 0 1 0 6a3 3 0 0 0 0 6a6 6 0 0 1 0-12" fill="#0047a0"/><g stroke="#111" stroke-width="1.2"><path d="M8 5l4 2M7 7l4 2M24 15l4 2M25 17l4 2M25 5l4-2M24 7l4-2M7 17l4-2M8 19l4-2"/></g></svg>',
  es: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#aa151b"/><rect y="6" width="36" height="12" fill="#f1bf00"/><rect x="9" y="9" width="3" height="5" fill="#aa151b"/></svg>',
  dv: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#d21034"/><rect x="7" y="5" width="22" height="14" fill="#007e3a"/><path d="M20 7a5 5 0 1 0 0 10a4 4 0 1 1 0-10" fill="#fff"/></svg>',
  ms: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#fff"/><g fill="#cc0001"><rect width="36" height="2" y="0"/><rect width="36" height="2" y="4"/><rect width="36" height="2" y="8"/><rect width="36" height="2" y="12"/><rect width="36" height="2" y="16"/><rect width="36" height="2" y="20"/></g><rect width="18" height="12" fill="#010066"/><circle cx="8" cy="6" r="4" fill="#ffcc00"/><circle cx="10" cy="6" r="4" fill="#010066"/><polygon points="14,3 14.8,5.2 17,5.2 15.2,6.5 15.9,8.7 14,7.4 12.1,8.7 12.8,6.5 11,5.2 13.2,5.2" fill="#ffcc00"/></svg>',
  id: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="12" fill="#ce1126"/><rect y="12" width="36" height="12" fill="#fff"/></svg>',
  vi: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#da251d"/><polygon points="18,5 20,10 25,10 21,13 23,18 18,15 13,18 15,13 11,10 16,10" fill="#ff0"/></svg>',
  th: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 24"><rect width="36" height="24" fill="#a51931"/><rect y="4" width="36" height="16" fill="#fff"/><rect y="8" width="36" height="8" fill="#2d2a4a"/></svg>',
}

const FLAG_IMAGES = Object.fromEntries(
  Object.entries(FLAG_SVGS).map(([code, svg]) => [code, `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`])
)

export function LanguageFlag({ code, label, sx }) {
  return (
    <Box
      component="img"
      src={FLAG_IMAGES[code] || FLAG_IMAGES.en}
      alt={label}
      sx={{
        width: 24,
        height: 18,
        borderRadius: 0.5,
        objectFit: 'cover',
        display: 'block',
        boxShadow: '0 0 0 1px rgba(15, 23, 42, 0.22)',
        ...sx,
      }}
    />
  )
}

export default function LanguageSelector({ size = 'small', compact = false, variant = 'outlined', languageCodes, onLanguageChange }) {
  const { language, setLanguage, t } = useI18n()
  const languages = React.useMemo(() => {
    const source = (!Array.isArray(languageCodes) || languageCodes.length === 0)
      ? SUPPORTED_LANGUAGES
      : languageCodes
      .map(code => SUPPORTED_LANGUAGES.find(item => item.code === code))
      .filter(Boolean)
    return [...source].sort((a, b) => a.label.localeCompare(b.label, 'en'))
  }, [languageCodes])

  const handleChange = React.useCallback((event) => {
    const nextLanguage = event.target.value
    setLanguage(nextLanguage)
    onLanguageChange?.(nextLanguage)
  }, [onLanguageChange, setLanguage])

  return (
    <FormControl size={size} variant={variant} sx={{ minWidth: compact ? 54 : 150 }}>
      {!compact && <InputLabel id="language-select-label">{t('language.label')}</InputLabel>}
      <Select
        labelId="language-select-label"
        value={language}
        label={compact ? undefined : t('language.label')}
        onChange={handleChange}
        MenuProps={{
          PaperProps: {
            sx: compact
              ? { mt: 1, p: 1, borderRadius: 2, maxWidth: 292 }
              : { mt: 1, borderRadius: 2 },
          },
          MenuListProps: compact
            ? {
                sx: {
                  p: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 62px)',
                  gap: 0.75,
                },
              }
            : undefined,
        }}
        sx={compact ? { '& .MuiSelect-select': { display: 'flex', justifyContent: 'center', alignItems: 'center', py: 0.75, px: 1 } } : undefined}
        renderValue={(value) => {
          const selected = languages.find((item) => item.code === value)
            || SUPPORTED_LANGUAGES.find((item) => item.code === value)
            || languages[0]
            || SUPPORTED_LANGUAGES[0]
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'flex-start', gap: compact ? 0 : 0.75 }}>
              {compact ? (
                <LanguageFlag code={selected.code} label={selected.label} sx={{ width: 28, height: 20 }} />
              ) : (
                <>
                  <TranslateIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  {selected.nativeLabel}
                </>
              )}
            </Box>
          )
        }}
      >
        {languages.map((item) => (
          <MenuItem key={item.code} value={item.code} aria-label={item.label} sx={compact ? {
            width: 62,
            height: 62,
            minHeight: 62,
            p: 0.5,
            borderRadius: 1.5,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0.35,
            border: '1px solid #e2e8f0',
            '&.Mui-selected': { bgcolor: '#e0f2fe', borderColor: '#0284c7' },
            '&.Mui-selected:hover': { bgcolor: '#bae6fd' },
          } : undefined}>
            {compact ? (
              <>
                <LanguageFlag code={item.code} label={item.label} sx={{ width: 30, height: 22 }} />
                <Box component="span" sx={{ fontSize: 10, fontWeight: 900, lineHeight: 1, color: 'text.secondary' }}>
                  {item.code.toUpperCase()}
                </Box>
              </>
            ) : `${item.nativeLabel} (${item.code.toUpperCase()})`}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
