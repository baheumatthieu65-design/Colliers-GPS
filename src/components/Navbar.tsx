import React from 'react';
import { 
  Radio, 
  ShieldAlert, 
  Compass, 
  History, 
  Sliders, 
  Activity, 
  MapPin, 
  Layers,
  Zap
} from 'lucide-react';
import { GPSCollar, GeofenceAlert } from '../types';

interface NavbarProps {
  activeTab: 'map' | 'collars' | 'zones' | 'alerts' | 'history';
  setActiveTab: (tab: 'map' | 'collars' | 'zones' | 'alerts' | 'history') => void;
  collars: GPSCollar[];
  alerts: GeofenceAlert[];
  onOpenAddCollar: () => void;
  onOpenPushModal: () => void;
  onTriggerSimulatedAlert: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  collars,
  alerts,
  onOpenPushModal,
  onTriggerSimulatedAlert,
}) => {
  const activeAlertsCount = alerts.filter(a => a.status === 'ACTIVE').length;
  const outOfZoneCount = collars.filter(c => c.status === 'out_of_zone').length;
  const activePushCount = collars.filter(c => c.pushMode.active).length;

  return (
    <header className="bg-white/95 backdrop-blur-md text-[#2C3327] border-b border-[#E2E6DF] sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-13 py-1">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#5A6F4E] flex items-center justify-center text-white shadow-xs">
              <Compass className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-bold text-base tracking-tight text-[#3E4A35]">Pâtur'GPS</h1>
                <span className="bg-[#D8E0D5] text-[#3E4A35] text-[10px] px-2 py-0.2 rounded-full font-bold border border-[#C5D1C1]">
                  Brebis
                </span>
              </div>
            </div>
          </div>

          {/* Flock Quick Stats */}
          <div className="hidden lg:flex items-center space-x-3 bg-[#F2F4F1] px-3 py-1 rounded-xl border border-[#E2E6DF] text-xs text-[#3E4A35]">
            <div className="flex items-center space-x-1">
              <Radio className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Colliers: <strong className="text-[#2C3327] font-bold">{collars.length}</strong></span>
            </div>
            <div className="h-3.5 w-[1px] bg-[#E2E6DF]" />
            <div className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#5A6F4E]" />
              <span>En zone: <strong className="text-[#5A6F4E] font-bold">{collars.length - outOfZoneCount}</strong></span>
            </div>
            {outOfZoneCount > 0 && (
              <>
                <div className="h-3.5 w-[1px] bg-[#E2E6DF]" />
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-red-700 font-bold">Hors zone: {outOfZoneCount}</span>
                </div>
              </>
            )}
            {activePushCount > 0 && (
              <>
                <div className="h-3.5 w-[1px] bg-[#E2E6DF]" />
                <div className="flex items-center space-x-1 text-[#E67E22] font-bold">
                  <Zap className="w-3 h-3 animate-bounce" />
                  <span>PUSH ({activePushCount})</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons: Push Command & Alert Simulator */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={onOpenPushModal}
              className="flex items-center space-x-1 bg-[#E67E22] hover:bg-[#D35400] text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Transmettre à cadences rapprochées"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Bouton PUSH</span>
            </button>

            <button
              onClick={onTriggerSimulatedAlert}
              className="hidden sm:flex items-center space-x-1 bg-[#F2F4F1] hover:bg-[#E2E6DF] text-[#3E4A35] text-xs px-2.5 py-1.5 rounded-xl border border-[#E2E6DF] font-medium transition-all cursor-pointer"
              title="Tester une alerte de sortie de zone"
            >
              <Activity className="w-3.5 h-3.5 text-red-500" />
              <span>Test Alerte</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Single line layout without horizontal scroll) */}
        <div className="hidden sm:grid grid-cols-5 gap-1 py-1.5 border-t border-[#E2E6DF]">
          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'map'
                ? 'bg-[#5A6F4E] text-white shadow-xs'
                : 'text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Carte & Direct</span>
          </button>

          <button
            onClick={() => setActiveTab('collars')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'collars'
                ? 'bg-[#5A6F4E] text-white shadow-xs'
                : 'text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1]'
            }`}
          >
            <Radio className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Colliers ({collars.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('zones')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'zones'
                ? 'bg-[#5A6F4E] text-white shadow-xs'
                : 'text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Clôtures</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'alerts'
                ? 'bg-[#5A6F4E] text-white shadow-xs'
                : 'text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Alertes</span>
            {activeAlertsCount > 0 && (
              <span className="bg-red-600 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full animate-pulse ml-0.5">
                {activeAlertsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center justify-center space-x-1.5 px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[#5A6F4E] text-white shadow-xs'
                : 'text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1]'
            }`}
          >
            <History className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">Parcours</span>
          </button>
        </div>

      </div>
    </header>
  );
};
