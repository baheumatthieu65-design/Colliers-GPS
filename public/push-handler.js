self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || "Pâtur'GPS", {
    body: data.body || 'Nouvelle alerte',
    tag: data.tag || 'paturgps-alert',
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    data: { url: data.url || './' },
    requireInteraction: true
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
    for (const client of list) { if ('focus' in client) { client.navigate(target); return client.focus(); } }
    if (clients.openWindow) return clients.openWindow(target);
  }));
});
