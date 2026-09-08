(function () {
  'use strict';

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return;
  }

  let configPromise = null;

  function getBase() {
    return new URL('./', document.baseURI).href;
  }

  function decode(value) {
    const pad = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  async function getConfig() {
    if (!configPromise) {
      const base = getBase();
      configPromise = fetch(new URL('api/push-config', base), { cache: 'no-store' })
        .then((res) => {
          if (!res.ok) throw new Error('Configuration Push indisponible.');
          return res.json();
        });
    }
    return configPromise;
  }

  async function registerPushSubscription() {
    const config = await getConfig();
    if (!config.enabled || !config.publicKey) {
      throw new Error('Web Push n’est pas configuré sur Vercel.');
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decode(config.publicKey),
      });
    }

    const response = await fetch(new URL('api/push-subscribe', getBase()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });

    if (!response.ok) {
      let message = 'Impossible d’enregistrer cet appareil pour les notifications.';
      try {
        const data = await response.json();
        if (data && data.error) message = data.error;
      } catch {}
      throw new Error(message);
    }

    console.info('[PaturGPS] Notifications Push activées');
    return true;
  }

  function setButtonState(button, text, disabled) {
    button.textContent = text;
    button.disabled = !!disabled;
    button.style.opacity = disabled ? '0.7' : '1';
  }

  function removeButton(button) {
    if (button && button.parentNode) button.parentNode.removeChild(button);
  }

  async function enableNotifications(button) {
    try {
      if (Notification.permission === 'denied') {
        setButtonState(button, 'Notifications bloquées — autorisez-les dans les réglages du navigateur', true);
        return false;
      }

      setButtonState(button, 'Activation…', true);

      // IMPORTANT : this call is reached directly from the button click.
      const permission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission();

      if (permission !== 'granted') {
        setButtonState(button, 'Activer les notifications', false);
        return false;
      }

      await registerPushSubscription();

      setButtonState(button, '✓ Notifications activées', true);
      setTimeout(() => removeButton(button), 1800);
      return true;
    } catch (error) {
      console.warn('[PaturGPS] Activation Push impossible', error);
      setButtonState(button, 'Réessayer les notifications', false);
      return false;
    }
  }

  function createButton() {
    if (document.getElementById('paturgps-enable-notifications')) return;

    const button = document.createElement('button');
    button.id = 'paturgps-enable-notifications';
    button.type = 'button';
    button.textContent = '🔔 Activer les notifications';
    button.setAttribute('aria-label', 'Activer les notifications PâturGPS');

    Object.assign(button.style, {
      position: 'fixed',
      left: '50%',
      bottom: '18px',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      border: '0',
      borderRadius: '14px',
      padding: '13px 18px',
      fontSize: '15px',
      fontWeight: '700',
      lineHeight: '1.2',
      color: '#ffffff',
      background: '#1f7a4d',
      boxShadow: '0 5px 18px rgba(0,0,0,.25)',
      cursor: 'pointer',
      maxWidth: 'calc(100vw - 28px)',
    });

    button.addEventListener('click', function () {
      enableNotifications(button);
    });

    document.body.appendChild(button);

    // If permission was already granted, silently restore/register the
    // subscription without requesting permission.
    if (Notification.permission === 'granted') {
      registerPushSubscription()
        .then(() => removeButton(button))
        .catch((error) => {
          console.warn('[PaturGPS] Ré-enregistrement Push impossible', error);
          setButtonState(button, 'Réessayer les notifications', false);
        });
    }
  }

  function init() {
    if (Notification.permission === 'granted') {
      // Register silently; no permission prompt is requested.
      registerPushSubscription().catch((error) => {
        console.warn('[PaturGPS] Push indisponible', error);
        createButton();
      });
      return;
    }

    createButton();
  }

  window.PaturGPS = window.PaturGPS || {};
  window.PaturGPS.enableNotifications = enableNotifications;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
