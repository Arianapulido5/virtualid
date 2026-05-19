// src/sw-push.js
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
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/dashboard'));
});