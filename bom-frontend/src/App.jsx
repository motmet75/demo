import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'

import MaterialPage from './features/material/MaterialPage'
import ModelPage from './features/model/ModelPage'
import InventoryPage from './features/inventory/InventoryPage'
import SupplierPage from './features/supplier/SupplierPage'
import WarehousePage from './features/warehouse/WarehousePage'
import CompanyPage from './features/company/CompanyPage'
import ViettelPostPage from './features/viettelpost/ViettelPostPage'
import OrderPage from './features/order/OrderPage'
import BomPage from './features/bom/BomPage'
import { AppProvider } from './context/AppContext'

import ContextHeaderBar from './components/ContextHeaderBar'
import TenantSelector from './components/TenantSelector'
import CompanySelector from './components/CompanySelector'
import BomSelector from './components/BomSelector'
import RequireContext from './components/RequireContext'
import TenantList from './components/TenantList'
import ContractPage from './features/contract/ContractPage'
import InventoryMovementPage from './features/inventory/InventoryMovementPage'
import InvoicePage from './features/invoice/InvoicePage'
import ConsumptionPage from './features/consumption/ConsumptionPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter basename="/bom-inventory">
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
            <Link to="/boms" style={{ marginRight: 12, color: '#6a1b9a', fontWeight: 'bold' }}>🧩 BOMs</Link>
            <Link to="/inventory" style={{ marginRight: 12 }}>Inventory</Link>
            <Link to="/inventory-movements" style={{ marginRight: 12 }}>Movements</Link>
            <Link to="/warehouses" style={{ marginRight: 12 }}>Warehouses</Link>
            <Link to="/suppliers" style={{ marginRight: 12 }}>Suppliers</Link>
            <Link to="/contracts" style={{ marginRight: 12 }}>Contracts</Link>
            <Link to="/orders" style={{ marginRight: 12, color: '#1565c0', fontWeight: 'bold' }}>📦 Orders</Link>
            <Link to="/invoices" style={{ marginRight: 12, color: '#6d4c41', fontWeight: 'bold' }}>🧾 Invoices</Link>
            <Link to="/consumption" style={{ marginRight: 12, color: '#37474f', fontWeight: 'bold' }}>📊 Consumption</Link>
            <Link to="/tenants" style={{ marginLeft: 12 }}>Tenants</Link>
            <Link to="/companies" style={{ marginLeft: 12 }}>Companies</Link>
            <Link to="/viettelpost" style={{ marginRight: 12, color: '#e74c3c', fontWeight: 'bold' }}>🚚 Shipping</Link>
          </nav>

          <Routes>
            <Route path="/" element={<RequireContext><MaterialPage /></RequireContext>} />
            <Route path="/materials" element={<RequireContext><MaterialPage /></RequireContext>} />
            <Route path="/models" element={<ModelPage />} />
            <Route path="/inventory" element={<RequireContext><InventoryPage /></RequireContext>} />
            <Route path="/inventory-movements" element={<RequireContext><InventoryMovementPage /></RequireContext>} />
            <Route path="/warehouses" element={<WarehousePage />} />
            <Route path="/suppliers" element={<SupplierPage />} />
            {/* Tenant management is public (no tenant context required) */}
            <Route path="/tenants" element={<TenantList />} />
            <Route path="/companies" element={<CompanyPage />} />
            <Route path="/contracts" element={<RequireContext><ContractPage /></RequireContext>} />
            <Route path="/orders" element={<RequireContext><OrderPage /></RequireContext>} />
            <Route path="/invoices" element={<RequireContext><InvoicePage /></RequireContext>} />
            <Route path="/consumption" element={<RequireContext><ConsumptionPage /></RequireContext>} />
            <Route path="/boms"   element={<RequireContext><BomPage /></RequireContext>} />
            {/* Viettel Post shipping calculator (no context required) */}
            <Route path="/viettelpost" element={<ViettelPostPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}