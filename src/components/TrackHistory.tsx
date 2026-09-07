import React, { useState } from 'react';
import { GPSCollar, GPSPositionLog } from '../types';
import { 
  History, 
  Calendar, 
  Play, 
  Pause, 
  MapPin, 
  TrendingUp, 
  Clock, 
  Compass, 
  Radio, 
  Filter
} from 'lucide-react';

interface TrackHistoryProps {
  collars: GPSCollar[];
  onFetchHistory: (collarId: string, startDate: string, endDate: string) => void;
  historyLogs: GPSPositionLog[];
  onClearTrack: () => void;
  onSelectMapTab: () => void;
}

export const TrackHistory: React.FC<TrackHistoryProps> = ({
  collars,
  onFetchHistory,
  historyLogs,
  onClearTrack,
  onSelectMapTab,
}) => {
  const [selectedCollarId, setSelectedCollarId] = useState<string>(collars[0]?.id || 'all');
  const [periodPreset, setPeriodPreset] = useState<'today' | 'yesterday' | '3days' | '7days' | 'custom'>('today');
  
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 16);
  });

  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const handleApplyPreset = (preset: 'today' | 'yesterday' | '3days' | '7days') => {
    setPeriodPreset(preset);
    const now = new Date();
    let start = new Date();

    if (preset === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (preset === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      now.setDate(now.getDate() - 1);
      now.setHours(23, 59, 59, 999);
    } else if (preset === '3days') {
      start.setDate(now.getDate() - 3);
    } else if (preset === '7days') {
      start.setDate(now.getDate() - 7);
    }

    const startIso = start.toISOString().slice(0, 16);
    const endIso = now.toISOString().slice(0, 16);

    setStartDate(startIso);
    setEndDate(endIso);

    onFetchHistory(selectedCollarId, startIso, endIso);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPeriodPreset('custom');
    onFetchHistory(selectedCollarId, startDate, endDate);
  };

  // Calculate stats from loaded logs
  const totalPoints = historyLogs.length;
  
  // Estimate distance (Haversine total)
  let totalDistanceKm = 0;
  for (let i = 1; i < historyLogs.length; i++) {
    const p1 = historyLogs[i - 1];
    const p2 = historyLogs[i];
    const R = 6371;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    totalDistanceKm += R * c;
  }

  const selectedCollar = collars.find(c => c.id === selectedCollarId);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Filter Form */}
      <div className="bg-white border border-[#E2E6DF] p-6 rounded-2xl shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#D8E0D5] text-[#3E4A35] border border-[#C5D1C1] flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#3E4A35]">
              Retracer le Parcours & Ligne de Déplacement
            </h2>
            <p className="text-xs text-[#7D8A74] font-medium">
              Sélectionnez une brebis et une période par date pour tracer sa trajectoire exacte sur la carte interactive.
            </p>
          </div>
        </div>

        <form onSubmit={handleCustomSearch} className="space-y-4 pt-2 border-t border-[#E2E6DF]">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Sheep / Collar Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#2C3327] mb-1 flex items-center space-x-1">
                <Radio className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Choix de la Brebis / Collier</span>
              </label>
              <select
                value={selectedCollarId}
                onChange={(e) => setSelectedCollarId(e.target.value)}
                className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-xs text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all cursor-pointer"
              >
                <option value="all">🐑 Toutes les brebis (Vue globale)</option>
                {collars.map((c) => (
                  <option key={c.id} value={c.id}>
                    🐑 {c.sheepName} ({c.collarNumber})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Début */}
            <div>
              <label className="block text-xs font-semibold text-[#2C3327] mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Date & Heure de Début</span>
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2 text-xs text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all"
              />
            </div>

            {/* Date Fin */}
            <div>
              <label className="block text-xs font-semibold text-[#2C3327] mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Date & Heure de Fin</span>
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2 text-xs text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all"
              />
            </div>

          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
              <span className="text-[#7D8A74] text-xs mr-1 font-semibold">Périodes rapides:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('today')}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                  periodPreset === 'today' ? 'bg-[#5A6F4E] text-white border-[#5A6F4E]' : 'bg-[#F2F4F1] text-[#3E4A35] border-[#E2E6DF] hover:bg-[#E2E6DF]'
                }`}
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('yesterday')}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                  periodPreset === 'yesterday' ? 'bg-[#5A6F4E] text-white border-[#5A6F4E]' : 'bg-[#F2F4F1] text-[#3E4A35] border-[#E2E6DF] hover:bg-[#E2E6DF]'
                }`}
              >
                Hier
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('3days')}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                  periodPreset === '3days' ? 'bg-[#5A6F4E] text-white border-[#5A6F4E]' : 'bg-[#F2F4F1] text-[#3E4A35] border-[#E2E6DF] hover:bg-[#E2E6DF]'
                }`}
              >
                3 Derniers Jours
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('7days')}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer font-medium ${
                  periodPreset === '7days' ? 'bg-[#5A6F4E] text-white border-[#5A6F4E]' : 'bg-[#F2F4F1] text-[#3E4A35] border-[#E2E6DF] hover:bg-[#E2E6DF]'
                }`}
              >
                7 Derniers Jours
              </button>
            </div>

            <button
              type="submit"
              className="bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm transition-all cursor-pointer flex items-center space-x-2"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Charger le Parcours</span>
            </button>
          </div>

        </form>
      </div>

      {/* Track Results & Summary Stats */}
      {historyLogs.length > 0 ? (
        <div className="space-y-4">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white border border-[#E2E6DF] p-4 rounded-2xl flex items-center space-x-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[#D8E0D5] text-[#5A6F4E] flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[#7D8A74] text-xs block">Distance Totale</span>
                <span className="text-lg font-bold text-[#2C3327] font-mono">
                  {totalDistanceKm.toFixed(2)} km
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#E2E6DF] p-4 rounded-2xl flex items-center space-x-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[#D8E0D5] text-[#3E4A35] flex items-center justify-center font-bold">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[#7D8A74] text-xs block">Points GPS Horodatés</span>
                <span className="text-lg font-bold text-[#2C3327] font-mono">
                  {totalPoints} enregistrements
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#E2E6DF] p-4 rounded-2xl flex items-center space-x-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-[#E2E6DF] text-[#5A6F4E] flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[#7D8A74] text-xs block">Plage Horaire</span>
                <span className="text-xs font-semibold text-[#2C3327]">
                  {new Date(historyLogs[0]?.timestamp).toLocaleDateString()} au {new Date(historyLogs[historyLogs.length - 1]?.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>

          </div>

          {/* Action Bar for Map Visualization */}
          <div className="bg-white border border-[#E2E6DF] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center space-x-2 text-xs text-[#2C3327] font-medium">
              <span className="w-3 h-3 rounded-full bg-[#5A6F4E] animate-pulse" />
              <span>
                Ligne de parcours prêt à être affiché sur la carte interactive.
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onClearTrack}
                className="px-3 py-2 bg-[#F2F4F1] hover:bg-[#E2E6DF] text-[#3E4A35] text-xs rounded-xl border border-[#E2E6DF] font-semibold transition-all cursor-pointer"
              >
                Effacer la ligne
              </button>

              <button
                onClick={onSelectMapTab}
                className="px-5 py-2 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center space-x-2 cursor-pointer active:scale-95"
              >
                <Compass className="w-4 h-4" />
                <span>Voir le Tracé sur la Carte 🗺️</span>
              </button>
            </div>
          </div>

          {/* Logs Table Sample */}
          <div className="bg-white border border-[#E2E6DF] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-[#E2E6DF] font-bold text-xs text-[#3E4A35]">
              Journal des Positions Horodatées ({historyLogs.length})
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F9FAF9] text-[#7D8A74] font-mono border-b border-[#E2E6DF]">
                  <tr>
                    <th className="p-3">Horodatage</th>
                    <th className="p-3">Brebis</th>
                    <th className="p-3">Coordonnées GPS</th>
                    <th className="p-3">Batterie</th>
                    <th className="p-3">Statut Zone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E6DF] font-mono text-[#2C3327]">
                  {historyLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F2F4F1]">
                      <td className="p-3 text-[#5A6F4E]">{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                      <td className="p-3 font-semibold text-[#2C3327]">🐑 {log.sheepName}</td>
                      <td className="p-3 text-[#3E4A35] font-semibold">{log.lat.toFixed(5)}, {log.lng.toFixed(5)}</td>
                      <td className="p-3">{log.battery}%</td>
                      <td className="p-3">
                        {log.inZone ? (
                          <span className="text-[#5A6F4E] font-semibold">✓ En Zone</span>
                        ) : (
                          <span className="text-red-600 font-bold">⚠️ Hors Zone</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-12 text-center text-[#7D8A74]">
          <History className="w-12 h-12 mx-auto text-[#7D8A74] mb-3" />
          <h3 className="text-lg font-bold text-[#2C3327]">Aucun parcours chargé</h3>
          <p className="text-xs text-[#7D8A74] max-w-sm mx-auto mt-1">
            Sélectionnez une brebis et cliquez sur "Charger le Parcours" pour retracer son cheminement.
          </p>
        </div>
      )}

    </div>
  );
};
