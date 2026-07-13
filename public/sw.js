self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'METEO', {
    body: data.body || 'Hay una actualización de seguridad cerca de tu ubicación.',
    icon: './favicon.svg',
    badge: './favicon.svg',
    tag: data.fireId || 'meteo-alert',
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || './' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => 'focus' in window);
    return existing ? existing.focus() : clients.openWindow(event.notification.data.url);
  }));
});
