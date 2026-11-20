import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n/I18nContext'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import ShopMenuPage from './features/shopfront/ShopMenuPage'
import ShopBookingPage from './features/shopfront/ShopBookingPage'
import ShopQueuePage from './features/shopfront/ShopQueuePage'
import ShopOrderStatusPage from './features/shopfront/ShopOrderStatusPage'
import CustomerPickupPage from './features/shopboard/CustomerPickupPage'
import CustomerBoardPage from './features/shopboard/CustomerBoardPage'
import DisplayBoardPage from './features/shopboard/DisplayBoardPage'
import CounterDisplayPage from './features/shopboard/CounterDisplayPage'

/**
 * Public-only entry point. Preserves existing QR URLs under /bom-inventory/shop/*
 * without importing the BOM / inventory / admin screens from App.jsx.
 * The customer bundle can be deployed separately while Demo admin rebuilds.
 */
export default function CustomerApp() {
  return (
    <I18nProvider>
      <AppProvider>
        <AuthProvider>
          <BrowserRouter basename="/bom-inventory">
            <Routes>
              <Route path="/shop/menu" element={<ShopMenuPage />} />
              <Route path="/shop/booking" element={<ShopBookingPage />} />
              <Route path="/shop/queue" element={<ShopQueuePage />} />
              <Route path="/shop/order/:orderCode" element={<ShopOrderStatusPage />} />
              <Route path="/shop/board" element={<DisplayBoardPage />} />
              <Route path="/shop/customer-board" element={<CustomerBoardPage />} />
              <Route path="/shop/pickup/:orderCode" element={<CustomerPickupPage />} />
              <Route path="/shop/counter" element={<CounterDisplayPage />} />
              <Route path="*" element={<Navigate to="/shop/menu" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AppProvider>
    </I18nProvider>
  )
}
