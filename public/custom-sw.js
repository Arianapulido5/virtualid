// public/custom-sw.js
importScripts('./ngsw-worker.js');

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data  = event.data.json();
  const title = data.title || 'Nueva notificación';
  const body  = data.body  || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data:  { url: '/mensajes' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/mensajes';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});