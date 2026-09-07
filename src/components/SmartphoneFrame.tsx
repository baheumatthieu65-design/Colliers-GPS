import React, { useState } from 'react';
import { Smartphone, Monitor, Wifi, Battery, Signal, Radio, Compass, Zap, Download } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface SmartphoneFrameProps {
  children: React.ReactNode;
  activeTabTitle?: string;
  onOpenPushModal?: () => void;
  activeAlertsCount?: number;
}

export const SmartphoneFrame: React.FC<SmartphoneFrameProps> = ({
  children,
  activeTabTitle = "Carte & Direct",
  onOpenPushModal,
  activeAlertsCount = 0,
}) => {
  // Mobile mode toggle: 'auto' (native responsive), 'frame' (desktop device mockup), 'full' (full desktop layout)
  const [viewMode, setViewMode] = useState<'auto' | 'frame'>('auto');

  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#E8ECE5]">
      
      {/* Top Banner Control Bar for Desktop Users */}
      <div className="bg-[#2C3327] text-white py-2 px-4 shadow-md flex items-center justify-between text-xs sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-7 h-7 rounded-lg bg-[#5A6F4E] flex items-center justify-center font-bold text-white shadow-xs">
            📱
          </div>
          <div>
            <span className="font-bold text-sm text-[#D8E0D5]">Pâtur'GPS - Application Mobile</span>
            <span className="hidden sm:inline-block text-[#A1B099] ml-2 text-[11px]">
              - PWA Installable sur iOS & Android
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <PWAInstallButton compact />

          <div className="bg-[#3E4A35] p-0.5 rounded-xl border border-[#5A6F4E]/40 flex space-x-1">
            <button
              onClick={() => setViewMode('auto')}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                viewMode === 'auto'
                  ? 'bg-[#5A6F4E] text-white shadow-xs'
                  : 'text-[#A1B099] hover:text-white'
              }`}
              title="Ajustement plein écran réactif"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Vue Écran</span>
            </button>

            <button
              onClick={() => setViewMode('frame')}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center space-x-1 cursor-pointer ${
                viewMode === 'frame'
                  ? 'bg-[#5A6F4E] text-white shadow-xs'
                  : 'text-[#A1B099] hover:text-white'
              }`}
              title="Cadre Maquette Smartphone"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Simulateur Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      {viewMode === 'frame' ? (
        /* SMARTPHONE DEVICE MOCKUP CONTAINER */
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[#D2D8CD] min-h-[calc(100vh-44px)]">
          <div className="relative w-full max-w-[412px] h-[840px] bg-black rounded-[48px] p-3 shadow-2xl border-4 border-stone-800 ring-1 ring-stone-900 flex flex-col overflow-hidden">
            
            {/* Phone Speaker & Camera Notch / Dynamic Island */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-stone-900 rounded-full z-50 flex items-center justify-center space-x-2 shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-stone-800 border border-stone-700" />
              <div className="w-2 h-2 rounded-full bg-blue-900/50" />
            </div>

            {/* Simulated Mobile Operating System Window */}
            <div className="w-full h-full bg-[#F2F4F1] rounded-[38px] overflow-hidden flex flex-col relative pt-7">
              
              {/* Smartphone OS Status Bar */}
              <div className="px-5 pb-1 pt-1 flex items-center justify-between text-[11px] font-bold text-[#2C3327] bg-white/80 backdrop-blur-md border-b border-[#E2E6DF] z-40 select-none">
                <span>{currentTime}</span>
                <div className="flex items-center space-x-1.5 text-[#3E4A35]">
                  <span className="text-[9px] font-mono font-extrabold bg-[#D8E0D5] px-1 rounded">5G</span>
                  <Signal className="w-3 h-3" />
                  <Wifi className="w-3 h-3" />
                  <div className="flex items-center space-x-0.5">
                    <span className="text-[9px]">98%</span>
                    <Battery className="w-3.5 h-3.5 fill-current text-[#5A6F4E]" />
                  </div>
                </div>
              </div>

              {/* Mobile App View Content */}
              <div className="flex-1 overflow-y-auto pb-16 no-scrollbar">
                {children}
              </div>

              {/* Bottom Home Indicator Bar */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-stone-400/80 rounded-full z-50 pointer-events-none" />
            </div>
          </div>
        </div>
      ) : (
        /* NATIVE RESPONSIVE VIEW */
        <div className="flex-1 flex flex-col">
          {children}
        </div>
      )}

    </div>
  );
};
