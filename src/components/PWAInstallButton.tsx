import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, X, CheckCircle2 } from 'lucide-react';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed, don't display
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center space-x-1.5 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs ${
          compact ? 'px-2.5 py-1.5 rounded-lg' : 'px-3.5 py-2 rounded-xl shadow-sm'
        } transition-all active:scale-95 cursor-pointer`}
        title="Installer l'application Pâtur'GPS sur votre téléphone"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installer l'App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center space-x-1.5 bg-[#D8E0D5] hover:bg-[#C5D1C1] text-[#3E4A35] font-semibold text-xs ${
            compact ? 'px-2.5 py-1.5 rounded-lg' : 'px-3.5 py-2 rounded-xl border border-[#C5D1C1]'
          } transition-all cursor-pointer`}
          title="Installer sur iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#5A6F4E]" />
          <span>App iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-2xl bg-white border border-[#E2E6DF] p-6 shadow-xl text-[#2C3327]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E6DF]">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-5 h-5 text-[#5A6F4E]" />
                  <h3 className="font-bold text-base text-[#3E4A35]">Installer sur iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-[#7D8A74] hover:text-[#2C3327] p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="my-4 space-y-3 text-xs text-[#2C3327]">
                <div className="flex items-start space-x-2 bg-[#F2F4F1] p-3 rounded-xl border border-[#E2E6DF]">
                  <span className="font-bold text-[#5A6F4E] bg-[#D8E0D5] px-2 py-0.5 rounded-md">1</span>
                  <p>Dans Safari, appuyez sur le bouton <strong>Partager</strong> en bas de l'écran.</p>
                </div>
                <div className="flex items-start space-x-2 bg-[#F2F4F1] p-3 rounded-xl border border-[#E2E6DF]">
                  <span className="font-bold text-[#5A6F4E] bg-[#D8E0D5] px-2 py-0.5 rounded-md">2</span>
                  <p>Défilez vers le bas et sélectionnez <strong>Sur l'écran d'accueil</strong>.</p>
                </div>
                <div className="flex items-center space-x-2 text-[#5A6F4E] font-medium text-[11px] pt-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Accès instantané hors-ligne et notifications pastorales.</span>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-[#5A6F4E] py-2.5 text-xs font-bold text-white hover:bg-[#4A5E3E] transition cursor-pointer"
              >
                J'ai compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default fallback for desktop/other browsers: show install prompt modal
  return (
    <button
      onClick={() => setShowIOSGuide(true)}
      className={`flex items-center space-x-1.5 bg-[#D8E0D5] hover:bg-[#C5D1C1] text-[#3E4A35] font-semibold text-xs ${
        compact ? 'px-2.5 py-1.5 rounded-lg' : 'px-3.5 py-2 rounded-xl border border-[#C5D1C1]'
      } transition-all cursor-pointer`}
      title="Installer Pâtur'GPS en Application Mobile"
    >
      <Smartphone className="w-3.5 h-3.5 text-[#5A6F4E]" />
      <span>App Mobile</span>
    </button>
  );
};
