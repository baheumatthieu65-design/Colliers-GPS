(() => {
  const seenKey = 'paturgps-danger-seen-v1';
  let initialized = false;
  let seen = new Set();
  try { seen = new Set(JSON.parse(sessionStorage.getItem(seenKey) || '[]')); } catch (_) {}
  const remember = (id) => {
    if (!id) return;
    seen.add(String(id));
    while (seen.size > 300) seen.delete(seen.values().next().value);
    try { sessionStorage.setItem(seenKey, JSON.stringify([...seen])); } catch (_) {}
  };

  const notify = async (row) => {
    const title = '🚨 DANGER — Pâtur\'GPS';
    const body = `${row.sheepName || row.collarNumber || 'Collier'} : ${row.danger || 'Danger détecté'}`;

    // Android natif : la WebView expose PaturGPSAndroid.notifyAlert().
    // On l'utilise en priorité et on ne demande aucune permission Web Push ici.
    try {
      if (window.PaturGPSAndroid && typeof window.PaturGPSAndroid.notifyAlert === 'function') {
        window.PaturGPSAndroid.notifyAlert(title, body, true);
        return;
      }
    } catch (_) {}

    // Version Web classique : comportement inchangé.
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        body,
        tag: `paturgps-danger-${row.id}`,
        requireInteraction: true,
        vibrate: [600, 200, 600, 200, 1000]
      });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (_) {}
  };

  async function poll() {
    try {
      const r = await fetch('/api/danger', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const rows = data.rows || [];
      if (!initialized) {
        rows.forEach(r => remember(r.id));
        initialized = true;
        return;
      }
      for (const row of rows.slice().reverse()) {
        if (!seen.has(String(row.id))) {
          remember(row.id);
          await notify(row);
        }
      }
    } catch (_) {}
  }

  window.addEventListener('load', () => {
    poll();
    setInterval(poll, 3500);
  });
})();
