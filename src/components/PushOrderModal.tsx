import React, { useState } from 'react';
import { GPSCollar } from '../types';
import { Zap, Clock, Radio, X, CheckCircle2 } from 'lucide-react';

interface PushOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  collars: GPSCollar[];
  preselectedCollarId?: string | null;
  onSendPushOrder: (collarIds: string[], durationMinutes: number, intervalSeconds: number) => void;
}

export const PushOrderModal: React.FC<PushOrderModalProps> = ({
  isOpen,
  onClose,
  collars,
  preselectedCollarId,
  onSendPushOrder,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>(preselectedCollarId || 'all');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(30);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetIds = selectedTarget === 'all' ? ['all'] : [selectedTarget];
    onSendPushOrder(targetIds, durationMinutes, intervalSeconds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[#E2E6DF] text-[#2C3327] rounded-2xl w-full max-w-lg p-6 shadow-xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E6DF]">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-[#FDF0E2] text-[#E67E22] border border-[#FAD7B2] flex items-center justify-center shadow-xs">
              <Zap className="w-6 h-6 fill-current animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#E67E22]">
                Ordre PUSH : Transmission Haute Fréquence
              </h2>
              <p className="text-xs text-[#7D8A74]">
                Outrepasser le rythme standard de 30 min
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#7D8A74] hover:text-[#2C3327] p-1 rounded-lg hover:bg-[#F2F4F1] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          
          {/* Target Collar Selection */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-1 flex items-center space-x-1">
              <Radio className="w-3.5 h-3.5 text-[#E67E22]" />
              <span>Collier(s) Destinataire(s) de l'Ordre</span>
            </label>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm text-[#2C3327] font-medium focus:outline-none focus:border-[#E67E22] transition-all cursor-pointer"
            >
              <option value="all">⚡ Tout le troupeau ({collars.length} colliers activement)</option>
              {collars.map((c) => (
                <option key={c.id} value={c.id}>
                  🐑 {c.sheepName} ({c.collarNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Cadence de Transmission */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-2">
              Cadence de Remontée des Données GPS (Par défaut : 30 min)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Toutes les 15s', value: 15 },
                { label: 'Toutes les 30s', value: 30 },
                { label: 'Toutes les 60s (1 min)', value: 60 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setIntervalSeconds(item.value)}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    intervalSeconds === item.value
                      ? 'bg-[#E67E22] text-white border-[#D35400] shadow-xs scale-[1.02]'
                      : 'bg-[#F2F4F1] text-[#2C3327] border-[#E2E6DF] hover:bg-[#E2E6DF]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Durée de la période PUSH */}
          <div>
            <label className="block text-xs font-semibold text-[#2C3327] mb-2 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-[#E67E22]" />
              <span>Période / Durée d'Activation du PUSH</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '10 min', value: 10 },
                { label: '30 min', value: 30 },
                { label: '1 Heure', value: 60 },
                { label: '3 Heures', value: 180 },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setDurationMinutes(item.value)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    durationMinutes === item.value
                      ? 'bg-[#E67E22] text-white border-[#D35400] shadow-xs scale-[1.02]'
                      : 'bg-[#F2F4F1] text-[#2C3327] border-[#E2E6DF] hover:bg-[#E2E6DF]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Explanation Callout */}
          <div className="bg-[#FDF0E2] border border-[#FAD7B2] p-3.5 rounded-xl text-xs text-[#2C3327] space-y-1">
            <div className="font-bold flex items-center space-x-1 text-[#E67E22]">
              <CheckCircle2 className="w-4 h-4 text-[#E67E22]" />
              <span>Action Immédiate en Cloud :</span>
            </div>
            <p className="text-[11px] text-[#2C3327] leading-relaxed">
              Dès l'envoi, un signal Push est transmis à la base de données. Le collier émettra sa position GPS toutes les <strong>{intervalSeconds} secondes</strong> pendant une durée de <strong>{durationMinutes} minutes</strong>, puis reviendra automatiquement à la cadence d'économie d'énergie (30 min).
            </p>
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
              className="px-6 py-2.5 bg-[#E67E22] hover:bg-[#D35400] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center space-x-2"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Envoyer l'Ordre PUSH</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
