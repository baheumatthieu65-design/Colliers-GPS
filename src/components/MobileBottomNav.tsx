import React from 'react';
import { 
  MapPin, 
  Layers, 
  ShieldAlert, 
  History 
} from 'lucide-react';
import { GeofenceAlert } from '../types';

interface MobileBottomNavProps {
  activeTab: 'map' | 'collars' | 'zones' | 'alerts' | 'history';
  setActiveTab: (tab: 'map' | 'collars' | 'zones' | 'alerts' | 'history') => void;
  alerts: GeofenceAlert[];
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  alerts,
}) => {
  const activeAlertsCount = alerts.filter(a => a.status === 'ACTIVE').length;

  const navItems = [
    {
      id: 'map',
      label: 'Carte',
      icon: MapPin,
      badge: null,
    },
    {
      id: 'collars',
      label: 'Colliers',
      icon: null,
      badge: null,
    },
    {
      id: 'zones',
      label: 'Clôtures',
      icon: Layers,
      badge: null,
    },
    {
      id: 'alerts',
      label: 'Alertes',
      icon: ShieldAlert,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
    },
    {
      id: 'history',
      label: 'Parcours',
      icon: History,
      badge: null,
    },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E6DF] px-2 py-1.5 shadow-lg md:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all relative cursor-pointer min-w-[56px] min-h-[48px] ${
                isActive
                  ? 'text-[#5A6F4E] font-bold bg-[#F2F4F1]'
                  : 'text-[#7D8A74] hover:text-[#2C3327]'
              }`}
            >
              <div className="relative">
                {Icon ? (
                  <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                ) : (
                  <span className={`inline-flex items-center justify-center w-5 h-5 ${isActive ? 'scale-110' : ''}`} aria-hidden="true">
                    <span className="w-5 h-2.5 rounded-full border-[2px] border-current relative after:content-[''] after:absolute after:-right-1 after:top-1/2 after:-translate-y-1/2 after:w-1 after:h-1 after:rounded-full after:bg-current" />
                  </span>
                )}
                {item.badge !== null && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-600 text-white font-extrabold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse border border-white">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold text-[#3E4A35]' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#5A6F4E]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
