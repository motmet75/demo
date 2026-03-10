import React, { useState } from 'react'
import MaterialGrid from './MaterialGrid'
import MaterialImport from './MaterialImport'

export default function MaterialPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div>
      <MaterialImport onImportComplete={() => setRefreshKey(k => k + 1)} />
      <MaterialGrid refreshKey={refreshKey} />
    </div>
  )
}