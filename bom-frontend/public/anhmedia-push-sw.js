/* Installed AnhMedia Home Screen web app: only handles push and notification taps. */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { /* invalid payload */ }
  event.waitUntil(self.registration.showNotification(
    typeof data.title === 'string' ? data.title : 'AnhMedia · Đơn hàng mới',
    {
      body: typeof data.body === 'string' ? data.body : 'Mở QR Shop để xem đơn.',
      tag: typeof data.tag === 'string' ? data.tag : 'shop-order',
      icon: '/bom-inventory/anhmedia-icon.svg',
      badge: '/bom-inventory/anhmedia-icon.svg',
      data: { url: '/bom-inventory/shop-orders' },
    }
  ))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Navigate to a fixed same-origin staff route, never a URL provided by a push sender.
  const target = new URL('/bom-inventory/shop-orders', self.location.origin).href
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of list) {
      if (client.url.startsWith(self.location.origin + '/bom-inventory/')
          && 'focus' in client) {
        await client.navigate(target)
        return client.focus()
      }
    }
    return clients.openWindow(target)
  })())
})
