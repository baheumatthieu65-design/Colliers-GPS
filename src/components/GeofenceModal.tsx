import React, { useState } from 'react';
import { GeofenceZone, GPSCollar } from '../types';
import { Layers, Shield, X, Palette } from 'lucide-react';

interface GeofenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (zoneData: Partial<GeofenceZone>) => void;
  initialZone?: GeofenceZone | null;
  collars: GPSCollar[];
}

const ZONE_COLORS = [
  '#10B981', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

export const GeofenceModal: React.FC<GeofenceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialZone,
  collars,
}) => {
  const [name, setName] = useState(initialZone?.name || '');
  const [description, setDescription] = useState(initialZone?.description || '');
  const [radiusMeters, setRadiusMeters] = useState(initialZone?.radiusMeters || 500);
  const [color, setColor] = useState(initialZone?.color || '#10B981');
  const [centerLat, setCenterLat] = useState(initialZone?.centerLat || 42.8450);
  const [centerLng, setCenterLng] = useState(initialZone?.centerLng || -0.0150);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name,
      description,
      radiusMeters: Number(radiusMeters),
      color,
      centerLat: Number(centerLat),
      centerLng: Number(centerLng),
      assignedCollarIds: ['all'],
      active: true,
      alertOnExit: true,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E6DF] text-[#2C3327] rounded-2xl w-full max-w-md p-6 shadow-xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E6DF]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#D8E0D5] text-[#3E4A35] border border-[#C5D1C1] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#3E4A35]">
              {initialZone ? 'Modifier la Zone' : 'Nouvelle Clôture Virtuelle'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#7D8A74] hover:text-[#2C3327] p-1 rounded-lg hover:bg-[#F2F4F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          
          {/* Nom de la zone */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-1">
              Nom du Pâturage / Zone de Sécurité *
            </label>
            <input
              type="text"
              required
              placeholder="ex: Pâturage Haut-Plateau, Enclos Nuit, Zone Ouest"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-1">
              Description (Optionnel)
            </label>
            <input
              type="text"
              placeholder="ex: Zone d'alpage d'été réservée au troupeau"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all"
            />
          </div>

          {/* Radius slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#2C3327] flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Rayon du Rayonnement Circulaire:</span>
              </label>
              <span className="text-sm font-bold font-mono text-[#3E4A35]">{radiusMeters} mètres</span>
            </div>
            <input
              type="range"
              min="100"
              max="3000"
              step="50"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(Number(e.target.value))}
              className="w-full accent-[#5A6F4E] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#7D8A74] mt-1 font-medium">
              <span>100m (Enclos fermé)</span>
              <span>1500m (Pâturage moyen)</span>
              <span>3000m (Estive complète)</span>
            </div>
          </div>

          {/* Center Coordinates */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block font-semibold text-[#2C3327] mb-1">Latitude Centre</label>
              <input
                type="number"
                step="0.0001"
                value={centerLat}
                onChange={(e) => setCenterLat(Number(e.target.value))}
                className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3 py-2 text-[#2C3327] font-mono font-medium focus:outline-none focus:border-[#5A6F4E]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#2C3327] mb-1">Longitude Centre</label>
              <input
                type="number"
                step="0.0001"
                value={centerLng}
                onChange={(e) => setCenterLng(Number(e.target.value))}
                className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3 py-2 text-[#2C3327] font-mono font-medium focus:outline-none focus:border-[#5A6F4E]"
              />
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-2 flex items-center space-x-1">
              <Palette className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Couleur de la Zone</span>
            </label>
            <div className="flex space-x-2">
              {ZONE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer ${
                    color === c ? 'border-[#2C3327] scale-110 shadow-xs' : 'border-transparent opacity-80'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[#E2E6DF] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1] transition-all cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              {initialZone ? 'Enregistrer Zone' : 'Créer la Zone'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
