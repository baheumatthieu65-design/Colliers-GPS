/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GPSCollar, GeofenceZone, GeofenceAlert, GPSPositionLog } from './types';
import { Navbar } from './components/Navbar';
import { InteractiveMap } from './components/InteractiveMap';
import { CollarManager } from './components/CollarManager';
import { CollarModal } from './components/CollarModal';
import { PushOrderModal } from './components/PushOrderModal';
import { ZonesManager } from './components/ZonesManager';
import { GeofenceModal } from './components/GeofenceModal';
import { AlertsTable } from './components/AlertsTable';
import { TrackHistory } from './components/TrackHistory';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SmartphoneFrame } from './components/SmartphoneFrame';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Radio, ShieldAlert, Zap, Compass, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'map' | 'collars' | 'zones' | 'alerts' | 'history'>('map');

  // Application Data States
  const [collars, setCollars] = useState<GPSCollar[]>([]);
  const [zones, setZones] = useState<GeofenceZone[]>([]);
  const [alerts, setAlerts] = useState<GeofenceAlert[]>([]);
  const [historyLogs, setHistoryLogs] = useState<GPSPositionLog[]>([]);

  // Selection & Modal States
  const [selectedCollarId, setSelectedCollarId] = useState<string | null>(null);

  const [isCollarModalOpen, setIsCollarModalOpen] = useState(false);
  const [editingCollar, setEditingCollar] = useState<GPSCollar | null>(null);

  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [pushModalCollarId, setPushModalCollarId] = useState<string | null>(null);

  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null);

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => {
      setNotificationMsg(null);
    }, 4000);
  };

  // API Loaders
  const fetchCollars = useCallback(async () => {
    try {
      const res = await fetch('/api/collars');
      if (res.ok) {
        const data = await res.json();
        setCollars(data);
      }
    } catch (err) {
      console.error('Error fetching collars:', err);
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/zones');
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch (err) {
      console.error('Error fetching zones:', err);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  }, []);

  // Initial Load & Real-Time Polling Loop (Every 3.5s)
  useEffect(() => {
    fetchCollars();
    fetchZones();
    fetchAlerts();

    const interval = setInterval(() => {
      fetchCollars();
      fetchAlerts();
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchCollars, fetchZones, fetchAlerts]);

  // Handlers for Collars
  const handleSaveCollar = async (collarData: Partial<GPSCollar>) => {
    try {
      if (editingCollar) {
        // Edit existing collar
        const res = await fetch(`/api/collars/${editingCollar.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collarData),
        });
        if (res.ok) {
          showNotification(`Collier de ${collarData.sheepName} mis à jour avec succès.`);
        }
      } else {
        // Add new collar
        const res = await fetch('/api/collars', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(collarData),
        });
        if (res.ok) {
          showNotification(`Nouveau collier pour ${collarData.sheepName} créé avec succès.`);
        }
      }
      fetchCollars();
    } catch (err) {
      console.error('Error saving collar:', err);
    }
  };

  const handleDeleteCollar = async (id: string) => {
    try {
      const res = await fetch(`/api/collars/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('Collier supprimé du système.');
        fetchCollars();
      }
    } catch (err) {
      console.error('Error deleting collar:', err);
    }
  };

  // Handlers for Push Command
  const handleSendPushOrder = async (
    collarIds: string[],
    durationMinutes: number,
    intervalSeconds: number
  ) => {
    try {
      const res = await fetch('/api/push-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collarIds, durationMinutes, intervalSeconds }),
      });
      if (res.ok) {
        const data = await res.json();
        showNotification(data.message || 'Ordre PUSH activé.');
        fetchCollars();
      }
    } catch (err) {
      console.error('Error sending push order:', err);
    }
  };

  const handleStopPushForCollar = async (id: string) => {
    try {
      const res = await fetch(`/api/collars/${id}/push`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('Mode PUSH arrêté. Retour au rythme standard (30 min).');
        fetchCollars();
      }
    } catch (err) {
      console.error('Error stopping push:', err);
    }
  };

  // Handlers for Geofence Zones
  const handleSaveZone = async (zoneData: Partial<GeofenceZone>) => {
    try {
      if (editingZone) {
        const res = await fetch(`/api/zones/${editingZone.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zoneData),
        });
        if (res.ok) {
          showNotification(`Zone "${zoneData.name}" mise à jour.`);
        }
      } else {
        const res = await fetch('/api/zones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zoneData),
        });
        if (res.ok) {
          showNotification(`Nouvelle zone de clôture "${zoneData.name}" créée.`);
        }
      }
      fetchZones();
    } catch (err) {
      console.error('Error saving zone:', err);
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      const res = await fetch(`/api/zones/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification('Zone de clôture supprimée.');
        fetchZones();
      }
    } catch (err) {
      console.error('Error deleting zone:', err);
    }
  };

  // Handlers for Alerts
  const handleResolveAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, { method: 'PUT' });
      if (res.ok) {
        showNotification('Alerte acquittée.');
        fetchAlerts();
      }
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  // Handler for Track History Query
  const handleFetchHistory = async (collarId: string, startDate: string, endDate: string) => {
    try {
      const url = `/api/history?collarId=${collarId}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
        showNotification(`Parcours chargé (${data.length} points GPS).`);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  // Trigger simulated out of zone alert
  const handleTriggerSimulatedAlert = async () => {
    try {
      const res = await fetch('/api/simulation/trigger-out-of-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collarId: collars[0]?.id }),
      });
      if (res.ok) {
        showNotification('⚠️ ALERTE DÉCLENCHÉE: La brebis a franchi la clôture virtuelle !');
        fetchCollars();
        fetchAlerts();
        setActiveTab('map');
      }
    } catch (err) {
      console.error('Error triggering alert simulation:', err);
    }
  };

  const activeAlertsCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
    <SmartphoneFrame
      onOpenPushModal={() => {
        setPushModalCollarId(null);
        setIsPushModalOpen(true);
      }}
      activeAlertsCount={activeAlertsCount}
    >
      <div className="min-h-screen bg-[#F2F4F1] text-[#2C3327] flex flex-col font-sans selection:bg-[#5A6F4E] selection:text-white relative">
        
        {/* Offline Indicator Toast */}
        <OfflineIndicator />

        {/* Toast Notification Banner */}
        {notificationMsg && (
          <div className="fixed top-20 right-6 z-50 bg-white border border-[#5A6F4E] text-[#3E4A35] px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-bounce max-w-sm">
            <CheckCircle2 className="w-5 h-5 text-[#5A6F4E] flex-shrink-0" />
            <span className="text-xs font-semibold">{notificationMsg}</span>
          </div>
        )}

        {/* Main Top Navigation */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collars={collars}
          alerts={alerts}
          onOpenAddCollar={() => {
            setEditingCollar(null);
            setIsCollarModalOpen(true);
          }}
          onOpenPushModal={() => {
            setPushModalCollarId(null);
            setIsPushModalOpen(true);
          }}
          onTriggerSimulatedAlert={handleTriggerSimulatedAlert}
        />

        {/* Main Application Canvas View */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 space-y-2 sm:space-y-3 pb-20 md:pb-4">
          
          {/* Compact Active Alert Banner */}
          {activeAlertsCount > 0 && activeTab !== 'alerts' && (
            <div className="bg-red-600 text-white py-1.5 px-3 rounded-xl flex items-center justify-between shadow-xs text-xs">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-white animate-bounce flex-shrink-0" />
                <span className="font-bold">
                  ALERTE : {activeAlertsCount} Brebis hors zone !
                </span>
                <span className="text-[11px] opacity-90 hidden md:inline">
                  — {alerts.find(a => a.status === 'ACTIVE')?.message}
                </span>
              </div>

              <button
                onClick={() => setActiveTab('alerts')}
                className="bg-white text-red-700 hover:bg-red-50 font-bold text-[11px] px-2.5 py-0.5 rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap ml-2"
              >
                Voir
              </button>
            </div>
          )}

          {/* TAB 1: INTERACTIVE MAP & REAL TIME TRACKING */}
          {activeTab === 'map' && (
            <div className="space-y-2">
              <InteractiveMap
                collars={collars}
                zones={zones}
                selectedCollarId={selectedCollarId}
                onSelectCollar={setSelectedCollarId}
                trackHistoryLogs={historyLogs}
                onOpenPushModalForCollar={(id) => {
                  setPushModalCollarId(id);
                  setIsPushModalOpen(true);
                }}
                onSaveZone={handleSaveZone}
              />
            </div>
          )}

          {/* TAB 2: COLLAR & FLOCK MANAGEMENT */}
          {activeTab === 'collars' && (
            <CollarManager
              collars={collars}
              zones={zones}
              onOpenAddCollar={() => {
                setEditingCollar(null);
                setIsCollarModalOpen(true);
              }}
              onEditCollar={(collar) => {
                setEditingCollar(collar);
                setIsCollarModalOpen(true);
              }}
              onDeleteCollar={handleDeleteCollar}
              onOpenPushModalForCollar={(id) => {
                setPushModalCollarId(id);
                setIsPushModalOpen(true);
              }}
              onStopPushForCollar={handleStopPushForCollar}
            />
          )}

          {/* TAB 3: GEOFENCE ZONES MANAGEMENT */}
          {activeTab === 'zones' && (
            <ZonesManager
              zones={zones}
              collars={collars}
              onOpenAddZone={() => {
                setEditingZone(null);
                setIsZoneModalOpen(true);
              }}
              onEditZone={(zone) => {
                setEditingZone(zone);
                setIsZoneModalOpen(true);
              }}
              onDeleteZone={handleDeleteZone}
            />
          )}

          {/* TAB 4: ALERTS LOGS & TABLE */}
          {activeTab === 'alerts' && (
            <AlertsTable
              alerts={alerts}
              onResolveAlert={handleResolveAlert}
              onLocateOnMap={(lat, lng) => {
                setActiveTab('map');
              }}
            />
          )}

          {/* TAB 5: HISTORICAL TRACK RECONSTRUCTION */}
          {activeTab === 'history' && (
            <TrackHistory
              collars={collars}
              onFetchHistory={handleFetchHistory}
              historyLogs={historyLogs}
              onClearTrack={() => setHistoryLogs([])}
              onSelectMapTab={() => setActiveTab('map')}
            />
          )}

        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          alerts={alerts}
        />

        {/* Add / Edit Collar Modal */}
        <CollarModal
          isOpen={isCollarModalOpen}
          onClose={() => setIsCollarModalOpen(false)}
          onSave={handleSaveCollar}
          initialCollar={editingCollar}
          zones={zones}
        />

        {/* Push High Frequency Order Modal */}
        <PushOrderModal
          isOpen={isPushModalOpen}
          onClose={() => setIsPushModalOpen(false)}
          collars={collars}
          preselectedCollarId={pushModalCollarId}
          onSendPushOrder={handleSendPushOrder}
        />

        {/* Geofence Zone Modal */}
        <GeofenceModal
          isOpen={isZoneModalOpen}
          onClose={() => setIsZoneModalOpen(false)}
          onSave={handleSaveZone}
          initialZone={editingZone}
          collars={collars}
        />

        {/* Footer */}
        <footer className="bg-white border-t border-[#E2E6DF] py-3 text-center text-[11px] text-[#7D8A74] hidden sm:block">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-medium text-[#3E4A35]">Pâtur'GPS App Mobile © 2026 - PWA Pastorale</span>
            <span className="text-[#7D8A74]">
              Cadence standard : 30 min | Cadence Push : 15s-60s | Synchronisation Cloud BDD
            </span>
          </div>
        </footer>

      </div>
    </SmartphoneFrame>
  );
}
