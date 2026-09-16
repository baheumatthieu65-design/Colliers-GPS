import React, { useEffect, useState } from 'react';
import { GPSCollar } from '../types';
import { MapPin, X, Battery, CheckCircle2 } from 'lucide-react';

interface ManualPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collar: GPSCollar | null;
  onSubmit: (
    collarId: string,
    data: { latitude: number; longitude: number; batteryPercent: number | null }
  ) => Promise<{ zoneCheck?: any; batteryCheck?: any } | null>;
}

/**
 * Formulaire de saisie manuelle d'une position GPS pour un collier.
 *
 * Pourquoi ce composant existe : jusqu'ici, les positions reçues par SMS/appel
 * du collier étaient recopiées directement dans la table Supabase `positions`
 * depuis l'éditeur de table. Ça enregistre bien la position, mais ça
 * contourne complètement l'API Vercel : le contrôle hors-zone et le contrôle
 * batterie faible ne s'exécutent QUE lors d'un passage par l'API (routes
 * `/api/telemetry` ou `/api/collars/:id/position`). En passant par ce
 * formulaire, la position suit le même chemin que la télémétrie MQTT et
 * déclenche donc bien les alertes/notifications.
 */
export const ManualPositionModal: React.FC<ManualPositionModalProps> = ({ isOpen, onClose, collar, onSubmit }) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [batteryPercent, setBatteryPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ zoneCheck?: any; batteryCheck?: any } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLatitude(collar?.currentLat != null ? String(collar.currentLat) : '');
    setLongitude(collar?.currentLng != null ? String(collar.currentLng) : '');
    setBatteryPercent(collar?.batteryLevel != null ? String(collar.batteryLevel) : '');
    setResult(null);
  }, [isOpen, collar]);

  if (!isOpen || !collar) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const battery = batteryPercent.trim() === '' ? null : Number(batteryPercent);
    if (battery != null && (!Number.isFinite(battery) || battery < 0 || battery > 100)) return;

    setSaving(true);
    try {
      const response = await onSubmit(collar.id, { latitude: lat, longitude: lng, batteryPercent: battery });
      setResult(response);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all';
  const labelClass = 'block text-xs font-semibold text-[#2C3327] mb-1';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E6DF] text-[#2C3327] rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E6DF]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#D8E0D5] text-[#3E4A35] border border-[#C5D1C1] flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#3E4A35]">Signaler une position</h2>
              <p className="text-[11px] text-[#7D8A74]">{collar.sheepName} ({collar.collarNumber})</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#7D8A74] hover:text-[#2C3327] p-1 rounded-lg hover:bg-[#F2F4F1]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Latitude *</label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="ex: 42.94123"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className={labelClass}>Longitude *</label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="ex: 0.38765"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className={`${inputClass} font-mono`}
              />
            </div>
          </div>

          <div>
            <label className={`${labelClass} flex items-center space-x-1`}>
              <Battery className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Batterie (%)</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="ex: 82"
              value={batteryPercent}
              onChange={(e) => setBatteryPercent(e.target.value)}
              className={inputClass}
            />
            <p className="text-[10px] text-[#7D8A74] mt-1">Laisser vide si inconnue. Une alerte est créée automatiquement en dessous de 15 %.</p>
          </div>

          {result && (
            <div className="bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl p-3 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-semibold text-[#3E4A35]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Position enregistrée</span>
              </div>
              {result.zoneCheck?.alerted && <p className="text-red-700">🚨 Hors zone détecté — alerte créée.</p>}
              {result.zoneCheck && !result.zoneCheck.alerted && result.zoneCheck.inside === false && (
                <p className="text-[#7D8A74]">Toujours hors zone, alerte déjà envoyée pour cet épisode (pas de répétition).</p>
              )}
              {result.batteryCheck?.alerted && <p className="text-red-700">🔋 Batterie faible détectée — alerte créée.</p>}
            </div>
          )}

          <div className="pt-4 border-t border-[#E2E6DF] flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1]">
              Fermer
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-60"
            >
              {saving ? 'Envoi…' : 'Enregistrer la position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
