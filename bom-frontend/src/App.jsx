import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'
import MenuIcon from '@mui/icons-material/Menu'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import LogoutIcon from '@mui/icons-material/Logout'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'

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
import ShopQueuePage from './features/shopfront/ShopQueuePage'
import ShopOrderStatusPage from './features/shopfront/ShopOrderStatusPage'
import ShopOrderPage from './features/shoporder/ShopOrderPage'
import ShopTablePage from './features/shoptable/ShopTablePage'
import ShopMenuManagePage from './features/shopmenu/ShopMenuManagePage'
import ShopBankConfigPage from './features/shopbank/ShopBankConfigPage'
import ShopMaterialPage from './features/shopmaterials/ShopMaterialPage'
import DisplayBoardPage from './features/shopboard/DisplayBoardPage'
import CounterDisplayPage from './features/shopboard/CounterDisplayPage'
import CustomerBoardPage from './features/shopboard/CustomerBoardPage'
import CustomerPickupPage from './features/shopboard/CustomerPickupPage'
import ShopTokenManagePage from './features/shoptoken/ShopTokenManagePage'
import ShopCustomerPage from './features/shopcustomer/ShopCustomerPage'
import ShopVoucherPage from './features/shopvoucher/ShopVoucherPage'
import ShopPrintingCenterPage from './features/shopprinting/ShopPrintingCenterPage'
import ProfilePage from './features/profile/ProfilePage'
import { I18nProvider, useI18n } from './i18n/I18nContext'
import LanguageSelector from './components/LanguageSelector'

const SIDEBAR_FULL = 210
const SIDEBAR_MINI = 52

// ── Page title ────────────────────────────────────────────────────────────────

const PATH_TITLES = {
  '/':                   'Materials',
  '/materials':          'Materials',
  '/models':             'Models',
  '/boms':               'BOMs',
  '/inventory':          'Inventory',
  '/inventory-movements':'Movements',
  '/warehouses':         'Warehouses',
  '/suppliers':          'Suppliers',
  '/contracts':          'Contracts',
  '/orders':             'Orders',
  '/order-lines':        'Order Lines',
  '/invoices':           'Invoices',
  '/consumption':        'Consumption',
  '/consumption-log':    'Consumption Log',
  '/companies':          'Companies',
  '/shop-orders':        'Shop Orders',
  '/shop-tables':        'Tables',
  '/shop-menu':          'Menu Setup',
  '/shop-bank':          'Bank Setup',
  '/shop-materials':     'Shop Materials',
  '/shop-tokens':        'QR Tokens',
  '/shop-customers':     'Customers',
  '/shop-vouchers':      'Vouchers',
  '/shop-printing':      'Printing Center',
  '/profile':            'Profile',
  '/admin':              'Admin',
  '/admin/users':        'Admin Users',
  '/tenants':            'Tenants',
  '/etl':                'ETL',
  '/login':              'Login',
  '/shop/menu':          'Shop Menu',
  '/shop/queue':         'Queue QR',
  '/shop/board':         'Display Board',
  '/shop/customer-board':'Customer Board',
  '/shop/counter':       'Counter Display',
}

function PageTitleUpdater() {
  const { pathname } = useLocation()
  const { t, tx } = useI18n()
  useEffect(() => {
    const label = PATH_TITLES[pathname] ?? 'BOM System'
    const translatedLabel = tx(label)
    const appName = t('app.name')
    document.title = label === 'BOM System' ? appName : `${translatedLabel} | ${appName}`
  }, [pathname, tx, t])
  return null
}

// ── Nav data ──────────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    key: 'bom',
    label: 'BOM',
    icon: '🧩',
    items: [
      { label: 'Materials', path: '/materials',           icon: '🧱' },
      { label: 'Models',    path: '/models',              icon: '📐' },
      { label: 'BOMs',      path: '/boms',                icon: '🧩' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: '📦',
    items: [
      { label: 'Inventory',  path: '/inventory',          icon: '📦' },
      { label: 'Movements',  path: '/inventory-movements',icon: '🔄' },
      { label: 'Warehouses', path: '/warehouses',         icon: '🏭' },
    ],
  },
  {
    key: 'procurement',
    label: 'Procurement',
    icon: '🤝',
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: '🤝' },
      { label: 'Contracts', path: '/contracts', icon: '📄' },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: '🛒',
    items: [
      { label: 'Orders',      path: '/orders',          icon: '🛒' },
      { label: 'Order Lines', path: '/order-lines',     icon: '📋' },
      { label: 'Invoices',    path: '/invoices',        icon: '🧾' },
      { label: 'Consumption', path: '/consumption',     icon: '📊' },
      { label: 'Cons. Log',   path: '/consumption-log', icon: '🗒️' },
    ],
  },
  {
    key: 'companies',
    label: 'Companies',
    icon: '🏢',
    items: [
      { label: 'Companies', path: '/companies', icon: '🏢' },
    ],
  },
  {
    key: 'shop',
    label: 'Shop',
    icon: '🧋',
    items: [
      { label: 'Shop Orders', path: '/shop-orders', icon: '🧋' },
      { label: 'Tables',      path: '/shop-tables', icon: '🪑' },
      { label: 'Menu Setup',  path: '/shop-menu',   icon: '🍽️' },
      { label: 'Shop Materials', path: '/shop-materials', icon: '📦' },
      { label: 'Bank Setup',  path: '/shop-bank',   icon: '🏦' },
      { label: 'QR Tokens',   path: '/shop-tokens',    icon: '🔑' },
      { label: 'Customers',   path: '/shop-customers', icon: '👤' },
      { label: 'Vouchers',    path: '/shop-vouchers',  icon: '🎫' },
      { label: 'Printing',    path: '/shop-printing',  icon: '🖨️' },
    ],
  },
]

const BOTTOM_ITEMS = [
  { label: 'Profile', path: '/profile', icon: '👤' },
]

const ADMIN_ITEMS = [
  { label: 'Admin',   path: '/admin',   icon: '🔧' },
  { label: 'Tenants', path: '/tenants', icon: '🏗️' },
  { label: 'ETL',     path: '/etl',     icon: '🔬' },
]

// ── Nav components ────────────────────────────────────────────────────────────

function isActive(path, pathname) {
  return pathname === path || (path !== '/' && pathname.startsWith(path))
}

function NavItem({ item, collapsed, indent = false }) {
  const { pathname } = useLocation()
  const { tx } = useI18n()
  const label = tx(item.label)
  const active = isActive(item.path, pathname)
  return (
    <Tooltip title={collapsed ? label : ''} placement="right">
      <Link
        to={item.path}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: collapsed ? '8px 0' : indent ? '7px 14px 7px 28px' : '8px 14px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          textDecoration: 'none',
          borderRadius: 6,
          margin: '1px 6px',
          background: active ? 'rgba(25,118,210,0.13)' : 'transparent',
          color: active ? '#1565c0' : '#444',
          fontWeight: active ? 700 : 400,
          fontSize: 13,
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
        {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      </Link>
    </Tooltip>
  )
}

function NavGroup({ group, collapsed }) {
  const { pathname } = useLocation()
  const { tx } = useI18n()

  const storageKey = `nav-group-${group.key}`
  const hasActiveChild = group.items.some(item => isActive(item.path, pathname))

  const [expanded, setExpanded] = useState(() => {
    const stored = sessionStorage.getItem(storageKey)
    if (stored !== null) return stored === 'true'
    return hasActiveChild
  })

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    sessionStorage.setItem(storageKey, String(next))
  }

  // Mini mode: show all items as icons without group wrapper
  if (collapsed) {
    return (
      <>
        {group.items.map(item => <NavItem key={item.path} item={item} collapsed={true} />)}
      </>
    )
  }

  return (
    <Box>
      {/* Group header */}
      <Box
        onClick={toggle}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mx: '6px', px: '8px', py: '6px',
          borderRadius: 1, cursor: 'pointer', userSelect: 'none',
          color: hasActiveChild ? '#1565c0' : '#666',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{group.icon}</span>
        <Typography sx={{
          flex: 1, fontSize: 11, fontWeight: 700,
          letterSpacing: 0.6, textTransform: 'uppercase',
          color: 'inherit',
        }}>
          {tx(group.label)}
        </Typography>
        {expanded
          ? <ExpandLessIcon sx={{ fontSize: 14, color: 'inherit' }} />
          : <ExpandMoreIcon sx={{ fontSize: 14, color: 'inherit' }} />}
      </Box>

      {/* Items */}
      <Collapse in={expanded} timeout={150}>
        {group.items.map(item => <NavItem key={item.path} item={item} collapsed={false} indent />)}
      </Collapse>
    </Box>
  )
}

function Sidebar({ collapsed, onToggle, isAdmin }) {
  const { t } = useI18n()
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
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        px: collapsed ? 0 : 1.5, py: 1.2,
        borderBottom: '1px solid #e0e0e0', minHeight: 48,
      }}>
        {!collapsed && (
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#1565c0', letterSpacing: 0.5 }}>
            BOM System
          </Typography>
        )}
        <IconButton size="small" onClick={onToggle} sx={{ flexShrink: 0 }}>
          {collapsed ? <MenuIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Scrollable nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 0.5 }}>
        {NAV_GROUPS.map((group, i) => (
          <React.Fragment key={group.key}>
            {i > 0 && <Divider sx={{ my: 0.5, mx: collapsed ? 0.5 : 1 }} />}
            <NavGroup group={group} collapsed={collapsed} />
          </React.Fragment>
        ))}

        <Divider sx={{ my: 0.5, mx: collapsed ? 0.5 : 1 }} />
        {BOTTOM_ITEMS.map(item => <NavItem key={item.path} item={item} collapsed={collapsed} />)}

        {isAdmin && (
          <>
            <Divider sx={{ my: 0.5, mx: collapsed ? 0.5 : 1 }} />
            {ADMIN_ITEMS.map(item => <NavItem key={item.path} item={item} collapsed={collapsed} />)}
          </>
        )}
      </Box>
    </Box>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

const ADMIN_ONLY_PATHS = ['/admin', '/tenants', '/etl']

function HeaderBar({ user, logout }) {
  const location = useLocation()
  const { t } = useI18n()
  const hideContext = ADMIN_ONLY_PATHS.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

  if (!user) {
    return <><LanguageSelector compact /><Link to="/login" style={{ fontSize: 14 }}>{t('common.login')}</Link></>
  }

  return (
    <>
      {!hideContext && <TenantSelector />}
      {!hideContext && <CompanySelector />}
      {!hideContext && <BomSelector />}
      <Box sx={{ flex: 1 }} />
      <Typography variant="body2" color="text.secondary">
        <strong>{user.username}</strong>
      </Typography>
      <Tooltip title={t('common.logout')}>
        <IconButton size="small" onClick={logout}><LogoutIcon fontSize="small" /></IconButton>
      </Tooltip>
    </>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────────

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
            <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
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
            <Route path="/shop-materials" element={<RequireAuth><RequireContext><ShopMaterialPage /></RequireContext></RequireAuth>} />
            <Route path="/shop-bank"   element={<RequireAuth><RequireContext><ShopBankConfigPage /></RequireContext></RequireAuth>} />
            <Route path="/shop-tokens"    element={<RequireAuth><RequireContext><ShopTokenManagePage /></RequireContext></RequireAuth>} />
            <Route path="/shop-customers" element={<RequireAuth><RequireContext><ShopCustomerPage /></RequireContext></RequireAuth>} />
            <Route path="/shop-vouchers"  element={<RequireAuth><RequireContext><ShopVoucherPage /></RequireContext></RequireAuth>} />
            <Route path="/shop-printing"  element={<RequireAuth><RequireContext><ShopPrintingCenterPage /></RequireContext></RequireAuth>} />
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

// ── App root ──────────────────────────────────────────────────────────────────

function AppShell() {
  const { user, logout, isAdmin } = useAuth()
  return (
    <BrowserRouter basename="/bom-inventory">
      <PageTitleUpdater />
      <Routes>
        {/* Public customer-facing shop routes — no sidebar/header */}
        <Route path="/shop/menu" element={<ShopMenuPage />} />
        <Route path="/shop/queue" element={<ShopQueuePage />} />
        <Route path="/shop/order/:orderCode" element={<ShopOrderStatusPage />} />
        <Route path="/shop/board" element={<DisplayBoardPage />} />
        <Route path="/shop/customer-board" element={<CustomerBoardPage />} />
        <Route path="/shop/pickup/:orderCode" element={<CustomerPickupPage />} />
        <Route path="/shop/counter" element={<CounterDisplayPage />} />
        <Route path="/*" element={<MainShell user={user} logout={logout} isAdmin={isAdmin} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <AuthProvider>
          <TenantListProvider>
            <AppShell />
          </TenantListProvider>
        </AuthProvider>
      </AppProvider>
    </I18nProvider>
  )
}
