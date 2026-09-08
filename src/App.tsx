/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GPSCollar, GeofenceZone, GeofenceAlert, GPSPositionLog, shortId } from './types';
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
import { OfflineIndicator } from './components/OfflineIndicator';
import { Radio, ShieldAlert, Zap, Compass, CheckCircle2, Bell as BellIcon } from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';

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
  const [isAlertsPopupOpen, setIsAlertsPopupOpen] = useState(false);
  const [patatoideRequest, setPatatoideRequest] = useState(0);
  const [patatoideEditZoneId, setPatatoideEditZoneId] = useState<string | null>(null);

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
  const formatApiError = (data: any, status: number) => {
    const asText = (value: any): string => {
      if (value == null) return '';
      if (typeof value === 'string') return value.trim();
      if (value instanceof Error) return value.message || '';
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      try {
        const json = JSON.stringify(value);
        return json && json !== '{}' ? json : '';
      } catch {
        return '';
      }
    };

    const details = data?.details;
    const candidates = [
      details?.message,
      details?.details,
      details?.hint,
      data?.error,
      data?.message,
      details,
      data,
    ];

    for (const candidate of candidates) {
      const text = asText(candidate);
      if (text && text !== '[object Object]') return text;
    }

    return `Erreur HTTP ${status}`;
  };
  const handleSaveCollar = async (collarData: Partial<GPSCollar>): Promise<boolean> => {
    try {
      const isEditing = Boolean(editingCollar?.id);
      const endpoint = isEditing
        ? `/api/collars/${encodeURIComponent(editingCollar!.id)}`
        : '/api/collars';

      const res = await fetch(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        body: JSON.stringify(collarData),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(formatApiError(data, res.status));
      }

      await fetchCollars();
      showNotification(
        isEditing
          ? `Collier de ${collarData.sheepName || editingCollar?.sheepName || ''} mis à jour. Cadence standard mise en file pour le BG95 au prochain réveil.`
          : `Nouveau collier pour ${collarData.sheepName || ''} créé. Cadence standard mise en file pour le BG95 au prochain réveil.`
      );
      return true;
    } catch (err: any) {
      console.error('Error saving collar:', err);
      showNotification(`Erreur : ${err?.message || 'Impossible d’enregistrer le collier.'}`);
      return false;
    }
  };

  const handleDeleteCollar = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collars/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(formatApiError(data, res.status));
      }

      if (editingCollar?.id === id) {
        setEditingCollar(null);
        setIsCollarModalOpen(false);
      }
      if (selectedCollarId === id) setSelectedCollarId(null);
      await fetchCollars();
      showNotification('Collier supprimé du système.');
      return true;
    } catch (err: any) {
      console.error('Error deleting collar:', err);
      showNotification(`Erreur : ${err?.message || 'Impossible de supprimer le collier.'}`);
      return false;
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
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(formatApiError(data, res.status));
      showNotification(data?.message || 'Ordre PUSH mis en file pour le prochain réveil.');
      await fetchCollars();
    } catch (err: any) {
      console.error('Error sending push order:', err);
      showNotification(`Erreur PUSH : ${err?.message || 'Impossible de créer la commande.'}`);
    }
  };

  const handleStopPushForCollar = async (id: string) => {
    try {
      const res = await fetch(`/api/collars/${id}/push`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(formatApiError(data, res.status));
      showNotification('Arrêt PUSH mis en file pour le prochain réveil.');
      await fetchCollars();
    } catch (err: any) {
      console.error('Error stopping push:', err);
      showNotification(`Erreur : ${err?.message || 'Impossible d’arrêter le PUSH.'}`);
    }
  };

  // Handlers for Geofence Zones
  const handleSaveZone = async (zoneData: Partial<GeofenceZone>) => {
    try {
      const targetZoneId = zoneData.id || editingZone?.id;
      const isEditing = Boolean(targetZoneId);
      const res = await fetch(
        isEditing ? `/api/zones/${encodeURIComponent(targetZoneId!)}` : '/api/zones',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(zoneData),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(formatApiError(data, res.status));
      showNotification(
        isEditing
          ? `Zone "${zoneData.name || editingZone?.name || ''}" mise à jour.`
          : `Nouvelle zone de clôture "${zoneData.name || ''}" créée.`
      );
      await fetchZones();
      setEditingZone(null);
    } catch (err: any) {
      console.error('Error saving zone:', err);
      showNotification(`Erreur : ${err?.message || 'Impossible d’enregistrer la clôture.'}`);
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

  const handleClearResolvedAlerts = async () => {
    if (!window.confirm('Supprimer définitivement toutes les alertes acquittées ?')) return;
    try {
      const res = await fetch('/api/alerts/cleanup', { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(formatApiError(data, res.status));
      showNotification(`${data?.deleted || 0} alerte(s) acquittée(s) supprimée(s).`);
      await fetchAlerts();
    } catch (err: any) {
      console.error('Error cleaning alerts:', err);
      showNotification(`Erreur : ${err?.message || 'Impossible de nettoyer les alertes.'}`);
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

  // Sécurité des actions collier : capture native au niveau document.
  // Cela évite qu'un conteneur/une couche responsive intercepte le clic avant React.
  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest('button[data-collar-action]') as HTMLButtonElement | null;
      if (!button) return;

      const collarId = button.dataset.collarId;
      const action = button.dataset.collarAction;
      if (!collarId || !action) return;

      const collar = collars.find((item) => item.id === collarId);
      if (!collar) return;

      event.preventDefault();
      event.stopPropagation();

      if (action === 'edit') {
        console.log('[PaturGPS] NATIVE EDIT', shortId(collar.id));
        setEditingCollar(collar);
        setIsCollarModalOpen(true);
      }

      if (action === 'delete') {
        console.log('[PaturGPS] NATIVE DELETE', shortId(collar.id));
        void handleDeleteCollar(collar.id);
      }
    };

    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  }, [collars, handleDeleteCollar]);

  const activeAlertsCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
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
          zones={zones}
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
          onOpenAlerts={() => setIsAlertsPopupOpen(true)}
        />

        {/* PWA installation shortcut */}
        <div className="fixed right-3 bottom-20 md:bottom-4 z-[60]">
          <PWAInstallButton compact />
        </div>

        {/* Main Application Canvas View */}
        <main className={`flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 pb-20 md:pb-4 ${activeTab === 'map' ? 'space-y-2 overflow-hidden' : 'space-y-2 sm:space-y-3'}`}>
          
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
                startPatatoideRequest={patatoideRequest}
                patatoideEditZone={zones.find((zone) => zone.id === patatoideEditZoneId) || null}
                onPatatoideRequestHandled={() => {
                  setPatatoideRequest(0);
                }}
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
              onCreatePatatoide={() => {
                setEditingZone(null);
                setPatatoideEditZoneId(null);
                setActiveTab('map');
                setPatatoideRequest(prev => prev + 1);
              }}
              onRetracePatatoide={(zone) => {
                setEditingZone(zone);
                setPatatoideEditZoneId(zone.id);
                setActiveTab('map');
                setPatatoideRequest(prev => prev + 1);
              }}
            />
          )}

          {/* TAB 4: ALERTS LOGS & TABLE */}
          {activeTab === 'alerts' && (
            <AlertsTable
              alerts={alerts}
              onResolveAlert={handleResolveAlert}
              onClearResolvedAlerts={handleClearResolvedAlerts}
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

        {/* Alert popup from the bell - stays over the map without changing page */}
        {isAlertsPopupOpen && (
          <div className="fixed inset-0 z-[1200] bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3 sm:p-4" onClick={() => setIsAlertsPopupOpen(false)}>
            <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2E6DF] shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E6DF]">
                <div className="flex items-center gap-2">
                  <BellIcon className="w-4 h-4 text-[#5A6F4E]" />
                  <h3 className="font-bold text-[#2C3327]">Alertes</h3>
                  {activeAlertsCount > 0 && <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeAlertsCount}</span>}
                </div>
                <button onClick={() => setIsAlertsPopupOpen(false)} className="text-[#7D8A74] hover:text-[#2C3327] text-lg leading-none px-2">×</button>
              </div>
              <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2">
                {alerts.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#7D8A74]">Aucune alerte enregistrée.</div>
                ) : alerts.slice(0, 8).map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-xl border ${alert.status === 'ACTIVE' ? 'border-red-200 bg-red-50' : 'border-[#E2E6DF] bg-[#F9FAF9]'}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${alert.status === 'ACTIVE' ? 'bg-red-500' : 'bg-[#5A6F4E]'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-xs text-[#2C3327] truncate">{alert.type || 'Alerte'}</strong>
                          <span className="text-[10px] text-[#7D8A74] whitespace-nowrap">{new Date(alert.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-[11px] text-[#5E6659] mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-[#E2E6DF]">
                <button onClick={() => { setIsAlertsPopupOpen(false); setActiveTab('alerts'); }} className="w-full py-2.5 rounded-xl bg-[#5A6F4E] text-white text-xs font-bold">Voir toutes les alertes</button>
              </div>
            </div>
          </div>
        )}

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
            <span className="font-medium text-[#3E4A35]">Pâtur'GPS App Mobile © 2026 - PWA Pastorale - By Matth tous droits réservés</span>
            <span className="text-[#7D8A74]">
              Cadence standard : selon le collier | Cadence Push : 5-30 min + personnalisée | Synchronisation Cloud BDD
            </span>
          </div>
        </footer>

    </div>
  );
}
