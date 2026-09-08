self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

async function handlePush(event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    try {
      data = event.data ? { body: event.data.text() } : {};
    } catch (_) {}
  }

  const title = data.title || "Pâtur'GPS";
  const body = data.body || "Nouvelle alerte";
  const kind = String(data.kind || "").toLowerCase();
  const isDanger = kind === "danger" || /danger/i.test(title);

  const baseOptions = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: isDanger ? [1200, 500, 1200, 500, 1200] : [250],
    requireInteraction: isDanger,
    renotify: true,
    data: { url: data.url || "/" }
  };

  if (!isDanger) {
    await self.registration.showNotification(title, {
      ...baseOptions,
      tag: data.tag || "paturgps-alert-normal",
      silent: true
    });
    return;
  }

  // DANGER : 10 notifications distinctes pour rendre l'alerte impossible à confondre.
  // Les tags sont uniques afin que le navigateur ne remplace pas la notification précédente.
  for (let i = 1; i <= 10; i++) {
    await self.registration.showNotification(`🚨 ${title}`, {
      ...baseOptions,
      tag: `paturgps-danger-${data.id || Date.now()}-${i}`,
      silent: false
    });

    if (i < 10) {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
