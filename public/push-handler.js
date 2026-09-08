self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { body: event.data ? event.data.text() : '' }; }
  const danger = data.kind === 'danger' || String(data.title || '').includes('DANGER');
  event.waitUntil(self.registration.showNotification(data.title || "Pâtur'GPS", {
    body: data.body || 'Nouvelle alerte',
    tag: data.tag || 'paturgps-alert',
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    data: { url: data.url || './' },
    requireInteraction: danger || data.requireInteraction === true,
    vibrate: danger ? [700, 200, 700, 200, 1200] : [250, 150, 250]
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
