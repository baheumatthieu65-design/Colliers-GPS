self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    try { data = event.data ? { body: event.data.text() } : {}; } catch (_) {}
  }

  const title = data.title || "Pâtur'GPS";
  const body = data.body || "Nouvelle alerte";
  const kind = String(data.kind || "").toLowerCase();
  const isDanger = kind === "danger" || /danger/i.test(title);

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [1200, 500, 1200, 500, 1200],
    requireInteraction: true,
    renotify: true,
    silent: false,
    data: { url: data.url || "/" }
  };

  if (!isDanger) {
    // Notification normale : exactement les mêmes paramètres qu'un DANGER,
    // mais une seule notification.
    await self.registration.showNotification(title, {
      ...options,
      tag: data.tag || `paturgps-normal-${data.id || Date.now()}`
    });
    return;
  }

  // DANGER : 10 notifications distinctes, espacées de 2 secondes.
  for (let i = 1; i <= 10; i++) {
    await self.registration.showNotification(`🚨 ${title}`, {
      ...options,
      tag: `paturgps-danger-${data.id || Date.now()}-${i}`
    });

    if (i < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(url) : undefined;
    })
  );
});
