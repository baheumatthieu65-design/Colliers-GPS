import React, { useState } from 'react';
import { GPSCollar, GeofenceZone } from '../types';
import { Radio, Palette, Check, X, Shield } from 'lucide-react';

interface CollarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collarData: Partial<GPSCollar>) => void;
  initialCollar?: GPSCollar | null;
  zones: GeofenceZone[];
}

const PRESET_COLORS = [
  { name: 'Rouge Éclat', hex: '#EF4444' },
  { name: 'Bleu Océan', hex: '#3B82F6' },
  { name: 'Vert Estive', hex: '#10B981' },
  { name: 'Violet Royal', hex: '#8B5CF6' },
  { name: 'Ambre Soleil', hex: '#F59E0B' },
  { name: 'Rose Bonbon', hex: '#EC4899' },
  { name: 'Turquoise Lagon', hex: '#14B8A6' },
  { name: 'Orange Feu', hex: '#F97316' },
  { name: 'Indigo Profond', hex: '#6366F1' },
  { name: 'Gris Sommet', hex: '#64748B' },
];

export const CollarModal: React.FC<CollarModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCollar,
  zones,
}) => {
  const [sheepName, setSheepName] = useState(initialCollar?.sheepName || '');
  const [collarNumber, setCollarNumber] = useState(initialCollar?.collarNumber || `COL-${Math.floor(100 + Math.random() * 900)}`);
  const [color, setColor] = useState(initialCollar?.color || '#EF4444');
  const [activeZoneId, setActiveZoneId] = useState(initialCollar?.activeZoneId || zones[0]?.id || '');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheepName.trim() || !collarNumber.trim()) return;

    onSave({
      sheepName,
      collarNumber,
      color,
      activeZoneId,
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
              <Radio className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#3E4A35]">
              {initialCollar ? 'Modifier le Collier' : 'Ajouter un Collier GPS'}
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
          
          {/* Nom de la brebis */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-1">
              Nom / Identification de la Brebis *
            </label>
            <input
              type="text"
              required
              placeholder="ex: Bella, Marguerite, Brebis #102"
              value={sheepName}
              onChange={(e) => setSheepName(e.target.value)}
              className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all"
            />
          </div>

          {/* N° du collier */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-1">
              Numéro de Série du Collier GPS *
            </label>
            <input
              type="text"
              required
              placeholder="ex: COL-402"
              value={collarNumber}
              onChange={(e) => setCollarNumber(e.target.value)}
              className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm font-mono text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all"
            />
          </div>

          {/* Color Picker Palette */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-2 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Palette className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Couleur Distinctive du Collier *</span>
              </span>
              <span className="text-[#7D8A74] text-[11px]">Pour repérage visuel carte</span>
            </label>

            <div className="grid grid-cols-5 gap-2 bg-[#F2F4F1] p-3 rounded-xl border border-[#E2E6DF]">
              {PRESET_COLORS.map((c) => {
                const isSelected = color === c.hex;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-9 rounded-xl flex items-center justify-center transition-transform cursor-pointer relative shadow-xs ${
                      isSelected ? 'ring-2 ring-[#2C3327] scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                    title={c.name}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center space-x-2">
              <span className="text-xs text-[#7D8A74]">Couleur sélectionnée:</span>
              <div className="w-4 h-4 rounded-full border border-stone-300" style={{ backgroundColor: color }} />
              <span className="text-xs font-mono font-semibold text-[#2C3327]">{color}</span>
            </div>
          </div>

          {/* Zone de Pâturage Affectée */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-1 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Zone de Clôture Virtuelle Affectée</span>
            </label>
            <select
              value={activeZoneId}
              onChange={(e) => setActiveZoneId(e.target.value)}
              className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all cursor-pointer"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name} (Rayon {zone.radiusMeters}m)
                </option>
              ))}
            </select>
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
              {initialCollar ? 'Enregistrer Modifications' : 'Créer le Collier'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
