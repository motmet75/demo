import React, { useState } from 'react'
import ModelGrid from './ModelGrid'
import ModelImport from './ModelImport'
import ModelBomImportDialog from './ModelBomImportDialog'

export default function ModelPage() {
  const [importOpen, setImportOpen] = useState(false)
  const [reloadSignal, setReloadSignal] = useState(0)

  function handleOpenImport() { setImportOpen(true) }
  function handleCloseImport() { setImportOpen(false) }
  function handleImportSuccess() { setReloadSignal(s => s + 1) }

  return (
    <div>
      <ModelImport onImportSuccess={handleImportSuccess} />

      <div style={{ marginBottom: 12 }}>
        <button type="button" onClick={handleOpenImport}>Import BOM</button>
      </div>

      <ModelBomImportDialog open={importOpen} onClose={handleCloseImport} onSuccess={handleImportSuccess} />

      <ModelGrid reloadSignal={reloadSignal} />
    </div>
  )
}