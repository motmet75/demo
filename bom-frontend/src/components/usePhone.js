import { useMediaQuery, useTheme } from '@mui/material'

/** True on phone-width screens; dialogs use it to open full screen. */
export function usePhone() {
  const theme = useTheme()
  return useMediaQuery(theme.breakpoints.down('sm'))
}
