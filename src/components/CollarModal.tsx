import React, { useEffect, useState } from 'react';
import { GPSCollar, GeofenceZone } from '../types';
import { Radio, Palette, Check, X, Shield, Settings2, Smartphone, Cpu } from 'lucide-react';

interface CollarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collarData: Partial<GPSCollar>) => Promise<boolean>;
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
  const [sheepName, setSheepName] = useState('');
  const [animalNumber, setAnimalNumber] = useState('');
  const [collarNumber, setCollarNumber] = useState('');
  const [color, setColor] = useState('#EF4444');
  const [activeZoneId, setActiveZoneId] = useState('');
  const [imei, setImei] = useState('');
  const [iccid, setIccid] = useState('');
  const [simPhone, setSimPhone] = useState('');
  const [mode, setMode] = useState<'simulation' | 'real'>('simulation');
  const [status, setStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [notes, setNotes] = useState('');
  const [baseTransmissionValue, setBaseTransmissionValue] = useState<string>('30');
  const [baseTransmissionUnit, setBaseTransmissionUnit] = useState<'minutes' | 'heures'>('minutes');
  const [dangerActive, setDangerActive] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSheepName(initialCollar?.sheepName || '');
    setAnimalNumber(initialCollar?.animalNumber || '');
    setCollarNumber(
      initialCollar?.collarNumber ||
      `COL-${Math.floor(100 + Math.random() * 900)}`
    );
    setColor(initialCollar?.color || '#EF4444');
    setActiveZoneId(initialCollar?.activeZoneId || zones[0]?.id || '');
    setImei(initialCollar?.imei || '');
    setIccid(initialCollar?.iccid || '');
    setSimPhone(initialCollar?.simPhone || '');
    setMode(initialCollar?.mode === 'real' ? 'real' : 'simulation');
    setStatus(
      initialCollar?.status === 'offline' ? 'inactive' :
      initialCollar?.status === 'no_signal' ? 'inactive' :
      'active'
    );
    setNotes(initialCollar?.notes || '');
    const baseMinutes = initialCollar?.baseTransmissionMinutes || 30;
    if (baseMinutes % 60 === 0) {
      setBaseTransmissionValue(String(baseMinutes / 60));
      setBaseTransmissionUnit('heures');
    } else {
      setBaseTransmissionValue(String(baseMinutes));
      setBaseTransmissionUnit('minutes');
    }
    setDangerActive(false);
    if (initialCollar?.collarNumber) {
      fetch(`/api/collar-danger?collarNumber=${encodeURIComponent(initialCollar.collarNumber)}`, { cache: 'no-store' })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => setDangerActive(Boolean(data?.dangerActive)))
        .catch(() => setDangerActive(false));
    }
  }, [isOpen, initialCollar, zones]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheepName.trim() || !collarNumber.trim() || saving) return;

    const rawBase = Number(baseTransmissionValue);
    const baseTransmissionMinutes = Number.isFinite(rawBase) && rawBase > 0
      ? Math.max(1, Math.round(baseTransmissionUnit === 'heures' ? rawBase * 60 : rawBase))
      : 30;

    setSaving(true);
    try {
      const saved = await onSave({
        sheepName: sheepName.trim(),
        collarNumber: collarNumber.trim(),
        animalNumber: animalNumber.trim() || undefined,
        color,
        activeZoneId: activeZoneId || undefined,
        imei: imei.trim() || undefined,
        iccid: iccid.trim() || undefined,
        simPhone: simPhone.trim() || undefined,
        mode,
        status,
        notes: notes.trim() || undefined,
        baseTransmissionMinutes,
      });

      if (saved) {
        await fetch('/api/collar-danger', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collarNumber: collarNumber.trim(), dangerActive }),
        });
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#5A6F4E] transition-all';
  const labelClass = 'block text-xs font-semibold text-[#2C3327] mb-1';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E6DF] text-[#2C3327] rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E6DF] sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[#D8E0D5] text-[#3E4A35] border border-[#C5D1C1] flex items-center justify-center">
              <Radio className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-[#3E4A35]">
              {initialCollar ? 'Modifier le Collier' : 'Ajouter un Collier GPS'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#7D8A74] hover:text-[#2C3327] p-1 rounded-lg hover:bg-[#F2F4F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className={labelClass}>Nom / Identification de la Brebis *</label>
            <input
              type="text"
              required
              placeholder="ex: Fanny, Marguerite..."
              value={sheepName}
              onChange={(e) => setSheepName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>N° de l'animal / boucle</label>
            <input
              type="text"
              placeholder="ex: 628"
              value={animalNumber}
              onChange={(e) => setAnimalNumber(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Numéro de Série du Collier GPS *</label>
            <input
              type="text"
              required
              placeholder="ex: COL-628"
              value={collarNumber}
              onChange={(e) => setCollarNumber(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div>
            <label className={labelClass}>Identifiants du matériel</label>
            <div className="space-y-2">
              <div className="relative">
                <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D8A74]" />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="IMEI — à renseigner quand le BG95 arrive"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                  className={`${inputClass} pl-9 font-mono`}
                />
              </div>
              <div className="relative">
                <Radio className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D8A74]" />
                <input
                  type="text"
                  placeholder="ICCID de la SIM"
                  value={iccid}
                  onChange={(e) => setIccid(e.target.value)}
                  className={`${inputClass} pl-9 font-mono`}
                />
              </div>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7D8A74]" />
                <input
                  type="tel"
                  placeholder="N° de téléphone de la SIM"
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'simulation' | 'real')}
                className={inputClass}
              >
                <option value="simulation">Simulation</option>
                <option value="real">Réel / BG95</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>État du collier</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as 'active' | 'inactive' | 'maintenance')
                }
                className={inputClass}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`${labelClass} flex items-center justify-between`}>
              <span className="flex items-center space-x-1">
                <Palette className="w-3.5 h-3.5 text-[#5A6F4E]" />
                <span>Couleur Distinctive du Collier *</span>
              </span>
              <span className="text-[#7D8A74] text-[11px]">Repérage sur la carte</span>
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
                      isSelected
                        ? 'ring-2 ring-[#2C3327] scale-110'
                        : 'opacity-80 hover:opacity-100 hover:scale-105'
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
              <div
                className="w-4 h-4 rounded-full border border-stone-300"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-mono font-semibold text-[#2C3327]">{color}</span>
            </div>
          </div>

          <div>
            <label className={`${labelClass} flex items-center space-x-1`}>
              <Shield className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Zone de Clôture Virtuelle Affectée</span>
            </label>
            <select
              value={activeZoneId}
              onChange={(e) => setActiveZoneId(e.target.value)}
              className={inputClass}
            >
              <option value="">Aucune zone</option>
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                  {zone.polygonCoords?.length
                    ? ' (patatoïde)'
                    : ` (rayon ${zone.radiusMeters} m)`}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className={`${labelClass} mb-0 flex items-center space-x-1`}>
                  <Shield className="w-3.5 h-3.5 text-[#C2410C]" />
                  <span>Danger actif</span>
                </label>
                <p className="text-[10px] text-[#9A3412] mt-1">Une donnée dans la colonne DANGER déclenche une notification.</p>
              </div>
              <select
                value={dangerActive ? 'oui' : 'non'}
                onChange={(e) => setDangerActive(e.target.value === 'oui')}
                className={`${inputClass} w-auto min-w-[100px]`}
              >
                <option value="non">Non</option>
                <option value="oui">Oui</option>
              </select>
            </div>
          </div>

          <div className="bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl p-3">
            <label className={`${labelClass} flex items-center space-x-1`}>
              <Radio className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Cadence standard d’émission</span>
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="number"
                min={1}
                step={1}
                value={baseTransmissionValue}
                onChange={(e) => setBaseTransmissionValue(e.target.value)}
                className={inputClass}
                placeholder="30"
              />
              <select
                value={baseTransmissionUnit}
                onChange={(e) => setBaseTransmissionUnit(e.target.value as 'minutes' | 'heures')}
                className={inputClass}
              >
                <option value="minutes">minutes</option>
                <option value="heures">heures</option>
              </select>
            </div>
            <p className="text-[10px] text-[#7D8A74] mt-1">Cadence utilisée par défaut quand aucun PUSH temporaire n’est actif.</p>
          </div>

          <div>
            <label className={`${labelClass} flex items-center space-x-1`}>
              <Settings2 className="w-3.5 h-3.5 text-[#5A6F4E]" />
              <span>Notes</span>
            </label>
            <textarea
              rows={3}
              placeholder="Informations utiles sur le collier, la brebis ou la SIM..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="pt-4 border-t border-[#E2E6DF] flex items-center justify-end space-x-3 sticky bottom-0 bg-white pb-1">
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
              {saving ? 'Enregistrement…' : initialCollar ? 'Enregistrer Modifications' : 'Créer le Collier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
