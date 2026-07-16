import React, { useState } from 'react'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import InventoryGrid from './InventoryGrid'
import InventoryShiftReport from './InventoryShiftReport'
import InventoryAlertReport from './InventoryAlertReport'

export default function InventoryPage() {
  const [tab, setTab] = useState(0)
  const handleTabChange = (event, value) => {
    void event
    setTab(value)
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#fff' }}>
        <Tabs value={tab} onChange={handleTabChange}>
          <Tab label="Inventory" />
          <Tab label="Shift Report" />
          <Tab label="Alerts" />
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 0 && <InventoryGrid />}
        {tab === 1 && <InventoryShiftReport />}
        {tab === 2 && <InventoryAlertReport />}
      </Box>
    </Box>
  )
}
