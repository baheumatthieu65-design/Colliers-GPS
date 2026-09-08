(() => {
  const seenKey = 'paturgps-danger-seen-v1';
  let initialized = false;
  let seen = new Set();
  try { seen = new Set(JSON.parse(sessionStorage.getItem(seenKey) || '[]')); } catch (_) {}
  const remember = (id) => { if (!id) return; seen.add(String(id)); while (seen.size > 300) seen.delete(seen.values().next().value); try { sessionStorage.setItem(seenKey, JSON.stringify([...seen])); } catch (_) {} };
  const notify = async (row) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification('🚨 DANGER — Pâtur\'GPS', { body: `${row.sheepName || row.collarNumber || 'Collier'} : ${row.danger}`, tag: `paturgps-danger-${row.id}`, requireInteraction: true, vibrate: [600,200,600,200,1000] });
    n.onclick = () => { window.focus(); n.close(); };
  };
  async function poll() {
    try {
      const r = await fetch('/api/danger', { cache: 'no-store' }); if (!r.ok) return;
      const data = await r.json(); const rows = data.rows || [];
      if (!initialized) { rows.forEach(r => remember(r.id)); initialized = true; return; }
      for (const row of rows.slice().reverse()) { if (!seen.has(String(row.id))) { remember(row.id); await notify(row); } }
    } catch (_) {}
  }
  window.addEventListener('load', () => { poll(); setInterval(poll, 3500); });
})();
