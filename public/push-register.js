/* Pâtur'GPS — Web Push activation for installed PWA / browser.
   Permission is requested only from a real user click.
   Alerts are delivered by the existing Vercel Web Push endpoints; no deployment is created per alert. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

  const base = new URL('./', document.baseURI).href;
  const configUrl = new URL('api/push-config', base).href;
  const subscribeUrl = new URL('api/push-subscribe', base).href;

  function decodeVapid(value) {
    const pad = '='.repeat((4 - (value.length % 4)) % 4);
    const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function removeButton() {
    document.getElementById('paturgps-notification-button')?.remove();
  }

  function showButton(text, disabled) {
    let button = document.getElementById('paturgps-notification-button');
    if (!button) {
      button = document.createElement('button');
      button.id = 'paturgps-notification-button';
      button.type = 'button';
      Object.assign(button.style, {
        position: 'fixed', right: '14px', bottom: '82px', zIndex: '2147483647',
        border: '0', borderRadius: '14px', padding: '12px 16px',
        background: '#5A6F4E', color: '#fff', font: '700 14px system-ui,sans-serif',
        boxShadow: '0 5px 18px rgba(0,0,0,.28)', cursor: 'pointer'
      });
      document.body.appendChild(button);
      button.addEventListener('click', enableNotifications);
    }
    button.textContent = text;
    button.disabled = !!disabled;
    button.style.opacity = disabled ? '0.7' : '1';
  }

  async function enableNotifications() {
    const button = document.getElementById('paturgps-notification-button');
    if (button) { button.disabled = true; button.textContent = 'Activation…'; }
    try {
      const configRes = await fetch(configUrl, { cache: 'no-store' });
      const config = await configRes.json().catch(() => ({}));
      if (!configRes.ok || !config.enabled || !config.publicKey) {
        throw new Error(config.error || 'Web Push non configuré.');
      }

      // This call happens directly inside the click handler.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        showButton(permission === 'denied' ? '🔔 Autoriser les notifications dans le navigateur' : '🔔 Activer les notifications', false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapid(config.publicKey)
        });
      }

      const saveRes = await fetch(subscribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
      const save = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !save.ok) throw new Error(save.error || 'Enregistrement de l’appareil impossible.');

      removeButton();
      console.info('[PaturGPS] Notifications activées et appareil enregistré.');
    } catch (error) {
      console.warn('[PaturGPS] Activation notifications impossible:', error);
      showButton('🔔 Réessayer les notifications', false);
    }
  }

  async function init() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (Notification.permission === 'granted' && existing) {
        const saveRes = await fetch(subscribeUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: existing.toJSON() })
        });
        if (saveRes.ok) { removeButton(); return; }
      }
      if (Notification.permission === 'denied') {
        showButton('🔔 Autoriser les notifications dans le navigateur', false);
      } else {
        showButton('🔔 Activer les notifications', false);
      }
    } catch (error) {
      console.warn('[PaturGPS] Push indisponible:', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
