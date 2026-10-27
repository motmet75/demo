import Box from '@mui/material/Box'

export default function InvoiceDeskPage() {
  return (
    <Box component="iframe" title="Invoice Desk" src="/sapi/invoice-desk/"
      sx={{ width: '100%', height: 'calc(100vh - 100px)', minHeight: 600, border: 0, display: 'block' }} />
  )
}
