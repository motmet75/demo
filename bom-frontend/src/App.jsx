import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import MaterialPage from './features/material/MaterialPage'
import ModelPage from './features/model/ModelPage'
import InventoryPage from './features/inventory/InventoryPage'
import SupplierPage from './features/supplier/SupplierPage'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ padding: 20 }}>
        <h1>BOM System</h1>

        {/* Simple navigation */}
        <nav style={{ marginBottom: 16 }}>
          <Link to="/materials" style={{ marginRight: 12 }}>Materials</Link>
          <Link to="/models" style={{ marginRight: 12 }}>Models</Link>
          <Link to="/inventory" style={{ marginRight: 12 }}>Inventory</Link>
          <Link to="/suppliers">Suppliers</Link>
        </nav>

        <Routes>
          <Route path="/" element={<MaterialPage />} />
          <Route path="/materials" element={<MaterialPage />} />
          <Route path="/models" element={<ModelPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/suppliers" element={<SupplierPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}