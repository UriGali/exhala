// Service Worker for Exhala Web Push Notifications
self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json()
      const title = data.title || '🚨 Exhala — Alerta SOS'
      const options = {
        body: data.body || 'Un amigo necesita tu apoyo urgente en este momento.',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/dashboard/friends',
        },
      }
      event.waitUntil(self.registration.showNotification(title, options))
    } catch (e) {
      const text = event.data.text()
      event.waitUntil(
        self.registration.showNotification('🚨 Exhala — Alerta SOS', {
          body: text || 'Un amigo necesita tu apoyo urgente.',
          icon: '/favicon.ico',
        })
      )
    }
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/dashboard/friends'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
