import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2, Info } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  const ua = navigator.userAgent.toLowerCase();
  const isSamsungInternet = /samsungbrowser/.test(ua);
  const browserName = isIOS
    ? 'Safari sur iPhone/iPad'
    : isSamsungInternet
      ? 'Samsung Internet'
      : /firefox/.test(ua)
        ? 'Firefox'
        : /edg\//.test(ua)
          ? 'Edge'
          : 'ton navigateur';

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className={`flex items-center justify-center gap-2 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs ${compact ? 'px-3 py-2 rounded-xl' : 'px-4 py-2.5 rounded-xl shadow-md'} transition-all active:scale-95 cursor-pointer`}
        title="Installer Pâtur'GPS sur l'écran d'accueil"
        aria-label="Installer Pâtur'GPS"
      >
        <Download className="w-4 h-4" />
        <span>Installer Pâtur'GPS</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-[#2C3327]">
            <div className="flex items-center justify-between border-b border-[#E2E6DF] pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#5A6F4E]" />
                <h2 className="font-bold">Installer Pâtur'GPS</h2>
              </div>
              <button type="button" onClick={() => setShowGuide(false)} className="p-1" aria-label="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-sm">
              {isIOS ? (
                <>
                  <p>Dans <strong>Safari</strong>, appuie sur <strong>Partager</strong>, puis <strong>Sur l'écran d'accueil</strong>.</p>
                  <p className="text-xs text-[#7D8A74]">L'ouverture depuis l'icône se fera ensuite comme une app web.</p>
                </>
              ) : isSamsungInternet ? (
                <>
                  <p>Dans <strong>Samsung Internet</strong>, ouvre le menu <strong>☰</strong>, puis <strong>Ajouter la page à → Écran d'accueil</strong>.</p>
                  <p className="text-xs text-[#7D8A74]">Samsung Internet utilise ce parcours pour ajouter l'application web.</p>
                </>
              ) : (
                <>
                  <p>Le navigateur n'a pas fourni de fenêtre d'installation directe à Pâtur'GPS.</p>
                  <p>Dans <strong>{browserName}</strong>, ouvre le menu du navigateur puis choisis <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</p>
                </>
              )}
              <div className="flex items-start gap-2 rounded-xl bg-[#F2F4F1] p-3 text-xs text-[#5E6659]">
                <Info className="w-4 h-4 flex-shrink-0 text-[#5A6F4E]" />
                <span>Un site Web ne peut pas forcer une installation contre la décision du navigateur. Le bouton lance l'installation native quand le navigateur l'autorise.</span>
              </div>
            </div>

            <button type="button" onClick={() => setShowGuide(false)} className="w-full rounded-xl bg-[#5A6F4E] py-2.5 text-sm font-bold text-white">
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
