const CACHE = 'meteo-shell-v3';
const SHELL = ['./', './manifest.webmanifest', './favicon.svg'];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.endsWith('/fires.json')) {
    event.respondWith(fetch(event.request).then((response) => { if (response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone())); return response; }).catch(() => caches.match(event.request).then((cached) => cached || new Response(JSON.stringify({ error: 'Sin conexión y sin datos guardados' }), { status: 503, headers: { 'Content-Type': 'application/json' } }))));
    return;
  }
  if (url.pathname.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Sin conexión' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  event.respondWith(fetch(event.request).then((response) => { if (response.ok && url.origin === self.location.origin) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone())); return response; }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./'))));
});
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || 'METEO', { body: data.body || 'Hay una actualización de seguridad cerca de tu ubicación.', icon: './favicon.svg', badge: './favicon.svg', tag: data.fireId || 'meteo-alert', renotify: true, requireInteraction: true, data: { url: data.url || './' } }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => { const existing = windows.find((window) => 'focus' in window); return existing ? existing.focus() : clients.openWindow(event.notification.data.url); }));
});
