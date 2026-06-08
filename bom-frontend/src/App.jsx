import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutIcon from '@mui/icons-material/Logout'

import MaterialPage from './features/material/MaterialPage'
import ModelPage from './features/model/ModelPage'
import InventoryPage from './features/inventory/InventoryPage'
import SupplierPage from './features/supplier/SupplierPage'
import WarehousePage from './features/warehouse/WarehousePage'
import CompanyPage from './features/company/CompanyPage'
import ViettelPostPage from './features/viettelpost/ViettelPostPage'
import OrderPage from './features/order/OrderPage'
import OrderLinePage from './features/orderline/OrderLinePage'
import BomPage from './features/bom/BomPage'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { TenantListProvider } from './context/TenantListContext'
import ContextHeaderBar from './components/ContextHeaderBar'
import TenantSelector from './components/TenantSelector'
import CompanySelector from './components/CompanySelector'
import BomSelector from './components/BomSelector'
import RequireContext from './components/RequireContext'
import ContractPage from './features/contract/ContractPage'
import InventoryMovementPage from './features/inventory/InventoryMovementPage'
import InvoicePage from './features/invoice/InvoicePage'
import ConsumptionPage from './features/consumption/ConsumptionPage'
import ConsumptionLogPage from './features/consumption/ConsumptionLogPage'
import LoginForm from './components/LoginForm'
import RequireAuth from './components/RequireAuth'
import AdminPage from './features/admin/AdminPage'
import TenantsPage from './features/tenant/TenantsPage'
import ETLPage from './features/etl/ETLPage'
import ShopMenuPage from './features/shopfront/ShopMenuPage'
import ShopOrderStatusPage from './features/shopfront/ShopOrderStatusPage'
import ShopOrderPage from './features/shoporder/ShopOrderPage'
import ShopTablePage from './features/shoptable/ShopTablePage'
import ShopMenuManagePage from './features/shopmenu/ShopMenuManagePage'
import ShopBankConfigPage from './features/shopbank/ShopBankConfigPage'
import DisplayBoardPage from './features/shopboard/DisplayBoardPage'

const SIDEBAR_FULL = 200
const SIDEBAR_MINI = 52

const NAV_ITEMS = [
  { label: 'Materials',   path: '/materials',            icon: '🧱' },
  { label: 'Models',      path: '/models',               icon: '📐' },
  { label: 'BOMs',        path: '/boms',                 icon: '🧩' },
  { divider: true },
  { label: 'Inventory',   path: '/inventory',            icon: '📦' },
  { label: 'Movements',   path: '/inventory-movements',  icon: '🔄' },
  { label: 'Warehouses',  path: '/warehouses',           icon: '🏭' },
  { divider: true },
  { label: 'Suppliers',   path: '/suppliers',            icon: '🤝' },
  { label: 'Contracts',   path: '/contracts',            icon: '📄' },
  { divider: true },
  { label: 'Orders',      path: '/orders',               icon: '🛒' },
  { label: 'Order Lines', path: '/order-lines',          icon: '📋' },
  { label: 'Invoices',    path: '/invoices',             icon: '🧾' },
  { label: 'Consumption', path: '/consumption',          icon: '📊' },
  { label: 'Cons. Log',   path: '/consumption-log',      icon: '🗒️' },
  { divider: true },
  { label: 'Companies',   path: '/companies',            icon: '🏢' },
  { divider: true },
  { label: 'Shop Orders', path: '/shop-orders',           icon: '🧋' },
  { label: 'Tables',      path: '/shop-tables',           icon: '🪑' },
  { label: 'Menu Setup',  path: '/shop-menu',             icon: '🍽️' },
  { label: 'Bank Setup',  path: '/shop-bank',             icon: '🏦' },
]

const ADMIN_ITEMS = [
  { label: 'Admin',       path: '/admin',                icon: '🔧', adminOnly: true },
  { label: 'Tenants',     path: '/tenants',              icon: '🏗️',  adminOnly: true },
  { label: 'ETL',         path: '/etl',                  icon: '🔬', adminOnly: true },
]

function NavItem({ item, collapsed, active }) {
  return (
    <Tooltip title={collapsed ? item.label : ''} placement="right">
      <Link
        to={item.path}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: collapsed ? '9px 0' : '9px 14px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          textDecoration: 'none',
          borderRadius: 6,
          margin: '1px 6px',
          background: active ? 'rgba(25,118,210,0.13)' : 'transparent',
          color: active ? '#1565c0' : '#333',
          fontWeight: active ? 700 : 400,
          fontSize: 13,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
        {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
      </Link>
    </Tooltip>
  )
}

function Sidebar({ collapsed, onToggle, isAdmin }) {
  const location = useLocation()

  return (
    <Box sx={{
      width: collapsed ? SIDEBAR_MINI : SIDEBAR_FULL,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      background: '#f8f9fa',
      borderRight: '1px solid #e0e0e0',
      transition: 'width 0.2s',
      overflow: 'hidden',
      zIndex: 10,
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', px: collapsed ? 0 : 1.5, py: 1.2, borderBottom: '1px solid #e0e0e0', minHeight: 48 }}>
        {!collapsed && <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1565c0', letterSpacing: 0.5 }}>BOM System</Typography>}
        <IconButton size="small" onClick={onToggle} sx={{ flexShrink: 0 }}>
          {collapsed ? <MenuIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Nav items — scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 0.5 }}>
        {NAV_ITEMS.map((item, i) =>
          item.divider
            ? <Divider key={`d${i}`} sx={{ my: 0.5, mx: collapsed ? 0.5 : 1 }} />
            : <NavItem key={item.path} item={item} collapsed={collapsed} active={location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))} />
        )}
        {isAdmin && <>
          <Divider sx={{ my: 0.5, mx: collapsed ? 0.5 : 1 }} />
          {ADMIN_ITEMS.map(item =>
            <NavItem key={item.path} item={item} collapsed={collapsed} active={location.pathname === item.path || location.pathname.startsWith(item.path)} />
          )}
        </>}
      </Box>
    </Box>
  )
}

// Routes where tenant/company context controls should be hidden
const ADMIN_ONLY_PATHS = ['/admin', '/tenants', '/etl']

function HeaderBar({ user, logout }) {
  const location = useLocation()
  const hideContext = ADMIN_ONLY_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

  if (!user) {
    return <Link to="/login" style={{ fontSize: 14 }}>Login</Link>
  }

  return (
    <>
      {!hideContext && <ContextHeaderBar />}
      {!hideContext && <TenantSelector />}
      {!hideContext && <CompanySelector />}
      {!hideContext && <BomSelector />}
      <Box sx={{ flex: 1 }} />
      <Typography variant="body2" color="text.secondary">
        <strong>{user.username}</strong>
      </Typography>
      <Tooltip title="Logout">
        <IconButton size="small" onClick={logout}><LogoutIcon fontSize="small" /></IconButton>
      </Tooltip>
    </>
  )
}

function MainShell({ user, logout, isAdmin }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {user && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} isAdmin={isAdmin} />}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Box sx={{ flexShrink: 0, borderBottom: '1px solid #e0e0e0', px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1.5, background: '#fff', flexWrap: 'wrap' }}>
          <HeaderBar user={user} logout={logout} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/" element={<RequireAuth><RequireContext><MaterialPage /></RequireContext></RequireAuth>} />
            <Route path="/materials" element={<RequireAuth><RequireContext><MaterialPage /></RequireContext></RequireAuth>} />
            <Route path="/models" element={<RequireAuth><ModelPage /></RequireAuth>} />
            <Route path="/inventory" element={<RequireAuth><RequireContext><InventoryPage /></RequireContext></RequireAuth>} />
            <Route path="/inventory-movements" element={<RequireAuth><RequireContext><InventoryMovementPage /></RequireContext></RequireAuth>} />
            <Route path="/warehouses" element={<RequireAuth><WarehousePage /></RequireAuth>} />
            <Route path="/suppliers" element={<RequireAuth><SupplierPage /></RequireAuth>} />
            <Route path="/companies" element={<RequireAuth><CompanyPage /></RequireAuth>} />
            <Route path="/contracts" element={<RequireAuth><RequireContext><ContractPage /></RequireContext></RequireAuth>} />
            <Route path="/orders" element={<RequireAuth><RequireContext><OrderPage /></RequireContext></RequireAuth>} />
            <Route path="/order-lines" element={<RequireAuth><RequireContext><OrderLinePage /></RequireContext></RequireAuth>} />
            <Route path="/invoices" element={<RequireAuth><RequireContext><InvoicePage /></RequireContext></RequireAuth>} />
            <Route path="/consumption" element={<RequireAuth><RequireContext><ConsumptionPage /></RequireContext></RequireAuth>} />
            <Route path="/consumption-log" element={<RequireAuth><RequireContext><ConsumptionLogPage /></RequireContext></RequireAuth>} />
            <Route path="/boms" element={<RequireAuth><RequireContext><BomPage /></RequireContext></RequireAuth>} />
            <Route path="/viettelpost" element={<RequireAuth><ViettelPostPage /></RequireAuth>} />
            <Route path="/shop-orders" element={<RequireAuth><RequireContext><ShopOrderPage /></RequireContext></RequireAuth>} />
            <Route path="/shop-tables" element={<RequireAuth><RequireContext><ShopTablePage /></RequireContext></RequireAuth>} />
            <Route path="/shop-menu"   element={<RequireAuth><RequireContext><ShopMenuManagePage /></RequireContext></RequireAuth>} />
            <Route path="/shop-bank"   element={<RequireAuth><RequireContext><ShopBankConfigPage /></RequireContext></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth adminOnly><AdminPage /></RequireAuth>} />
            <Route path="/admin/users" element={<RequireAuth adminOnly><AdminPage /></RequireAuth>} />
            <Route path="/tenants" element={<RequireAuth adminOnly><TenantsPage /></RequireAuth>} />
            <Route path="/etl"     element={<RequireAuth adminOnly><ETLPage /></RequireAuth>} />
          </Routes>
        </Box>
      </Box>
    </Box>
  )
}

function AppShell() {
  const { user, logout, isAdmin } = useAuth()

  return (
    <BrowserRouter basename="/bom-inventory">
      <Routes>
        {/* Public customer-facing shop routes — no sidebar/header */}
        <Route path="/shop/menu" element={<ShopMenuPage />} />
        <Route path="/shop/order/:orderCode" element={<ShopOrderStatusPage />} />
        <Route path="/shop/board" element={<DisplayBoardPage />} />
        {/* Everything else — existing authenticated shell */}
        <Route path="/*" element={<MainShell user={user} logout={logout} isAdmin={isAdmin} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <TenantListProvider>
          <AppShell />
        </TenantListProvider>
      </AuthProvider>
    </AppProvider>
  )
}