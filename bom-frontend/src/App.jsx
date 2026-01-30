import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import MaterialPage from './features/material/MaterialPage'
import ModelPage from './features/model/ModelPage'
import InventoryPage from './features/inventory/InventoryPage'
import SupplierPage from './features/supplier/SupplierPage'
import WarehousePage from './features/warehouse/WarehousePage'
import CompanyPage from './features/company/CompanyPage'
import { AppProvider } from './context/AppContext'

import ContextHeaderBar from './components/ContextHeaderBar'
import TenantSelector from './components/TenantSelector'
import CompanySelector from './components/CompanySelector'
import BomSelector from './components/BomSelector'
import RequireContext from './components/RequireContext'
import TenantList from './components/TenantList'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div style={{ padding: 20 }}>
          <h1>BOM System</h1>

          <ContextHeaderBar />

          <div style={{ marginBottom: 12 }}>
            <TenantSelector />
            <CompanySelector />
            <BomSelector />
          </div>

          {/* Simple navigation */}
          <nav style={{ marginBottom: 16 }}>
            <Link to="/materials" style={{ marginRight: 12 }}>Materials</Link>
            <Link to="/models" style={{ marginRight: 12 }}>Models</Link>
            <Link to="/inventory" style={{ marginRight: 12 }}>Inventory</Link>
            <Link to="/warehouses" style={{ marginRight: 12 }}>Warehouses</Link>
            <Link to="/suppliers" style={{ marginRight: 12 }}>Suppliers</Link>
            <Link to="/tenants" style={{ marginLeft: 12 }}>Tenants</Link>
            <Link to="/companies" style={{ marginLeft: 12 }}>Companies</Link>
          </nav>

          <Routes>
            <Route path="/" element={<RequireContext><MaterialPage /></RequireContext>} />
            <Route path="/materials" element={<RequireContext><MaterialPage /></RequireContext>} />
            <Route path="/models" element={<ModelPage />} />
            <Route path="/inventory" element={<RequireContext><InventoryPage /></RequireContext>} />
            <Route path="/warehouses" element={<WarehousePage />} />
            <Route path="/suppliers" element={<SupplierPage />} />
            {/* Tenant management is public (no tenant context required) */}
            <Route path="/tenants" element={<TenantList />} />
            <Route path="/companies" element={<CompanyPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}