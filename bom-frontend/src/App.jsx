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
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'

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
import LoginForm from './components/LoginForm'
import RequireAuth from './components/RequireAuth'
import AdminPage from './features/admin/AdminPage'

function AppShell() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <BrowserRouter basename="/bom-inventory">
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1>BOM System</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {user ? (
              <>
                <span>Signed in as <strong>{user.username}</strong></span>
                <button type="button" onClick={logout}>Logout</button>
              </>
            ) : (
              <Link to="/login">Login</Link>
            )}
          </div>
        </div>

        {user ? (
          <>
            <ContextHeaderBar />

            <div style={{ marginBottom: 12 }}>
              <TenantSelector />
              <CompanySelector />
              <BomSelector />
            </div>
          </>
        ) : null}

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
          {isAdmin && <Link to="/tenants" style={{ marginLeft: 12 }}>Tenants</Link>}
          <Link to="/companies" style={{ marginLeft: 12 }}>Companies</Link>
          <Link to="/viettelpost" style={{ marginRight: 12, color: '#e74c3c', fontWeight: 'bold' }}>🚚 Shipping</Link>
          {isAdmin ? <Link to="/admin/users" style={{ marginLeft: 12, fontWeight: 'bold', color: '#b71c1c' }}>Admin</Link> : null}
        </nav>

        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/" element={<RequireAuth><RequireContext><MaterialPage /></RequireContext></RequireAuth>} />
          <Route path="/materials" element={<RequireAuth><RequireContext><MaterialPage /></RequireContext></RequireAuth>} />
          <Route path="/models" element={<RequireAuth><ModelPage /></RequireAuth>} />
          <Route path="/inventory" element={<RequireAuth><RequireContext><InventoryPage /></RequireContext></RequireAuth>} />
          <Route path="/inventory-movements" element={<RequireAuth><RequireContext><InventoryMovementPage /></RequireContext></RequireAuth>} />
          <Route path="/warehouses" element={<RequireAuth><WarehousePage /></RequireAuth>} />
          <Route path="/suppliers" element={<RequireAuth><SupplierPage /></RequireAuth>} />
          <Route path="/tenants" element={<RequireAuth adminOnly><TenantList /></RequireAuth>} />
          <Route path="/companies" element={<RequireAuth><CompanyPage /></RequireAuth>} />
          <Route path="/contracts" element={<RequireAuth><RequireContext><ContractPage /></RequireContext></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><RequireContext><OrderPage /></RequireContext></RequireAuth>} />
          <Route path="/invoices" element={<RequireAuth><RequireContext><InvoicePage /></RequireContext></RequireAuth>} />
          <Route path="/consumption" element={<RequireAuth><RequireContext><ConsumptionPage /></RequireContext></RequireAuth>} />
          <Route path="/boms" element={<RequireAuth><RequireContext><BomPage /></RequireContext></RequireAuth>} />
          <Route path="/viettelpost" element={<RequireAuth><ViettelPostPage /></RequireAuth>} />
          <Route path="/admin/users" element={<RequireAuth adminOnly><AdminPage /></RequireAuth>} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </AppProvider>
  )
}