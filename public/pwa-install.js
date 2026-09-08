(function () {
  'use strict';

  var deferredPrompt = null;
  var button = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function createButton() {
    if (button || isStandalone()) return;

    button = document.createElement('button');
    button.type = 'button';
    button.id = 'pwa-install-button';
    button.textContent = '📱 Installer Pâtur’GPS';
    button.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:18px',
      'transform:translateX(-50%)',
      'z-index:2147483647',
      'border:0',
      'border-radius:14px',
      'padding:13px 18px',
      'font:600 15px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#fff',
      'background:#111',
      'box-shadow:0 6px 20px rgba(0,0,0,.28)',
      'cursor:pointer'
    ].join(';');

    button.addEventListener('click', function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null;

        promptEvent.prompt();

        promptEvent.userChoice.finally(function () {
          if (button) button.remove();
          button = null;
        });
        return;
      }

      // Chrome only exposes the install prompt when the site is eligible.
      // Keep the button useful by explaining the fallback action.
      alert(
        'Chrome ne propose pas encore l’installation directe.\\n\\n' +
        'Ouvre le menu ⋮ de Chrome puis choisis « Installer l’application » ' +
        'ou « Ajouter à l’écran d’accueil ».'
      );
    });

    document.body.appendChild(button);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    createButton();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    if (button) button.remove();
    button = null;
  });

  window.addEventListener('load', function () {
    // If the browser already knows the app is installable, show the button.
    // If beforeinstallprompt has not fired yet, the button will appear only
    // if the event arrives later.
    if (!isStandalone() && deferredPrompt) createButton();
  });
})();
