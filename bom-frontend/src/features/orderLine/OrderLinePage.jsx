import React from 'react'
import OrderLineGrid from './OrderLineGrid'

/**
 * OrderLinePage
 *
 * Standalone page for browsing and managing ALL order lines across orders.
 * If you want order-scoped lines (e.g. inside an order detail view), mount
 * <OrderLineGrid orderId={someId} /> directly instead of this page.
 */
export default function OrderLinePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <OrderLineGrid />
    </div>
  )
}
