import React, { useEffect, useState } from 'react';
import { GPSCollar } from '../types';
import { Zap, Clock, Radio, X, CheckCircle2 } from 'lucide-react';

interface PushOrderModalProps {
  isOpen: boolean; onClose: () => void; collars: GPSCollar[];
  preselectedCollarId?: string | null;
  onSendPushOrder: (collarIds: string[], durationMinutes: number, intervalSeconds: number) => void;
}

export const PushOrderModal: React.FC<PushOrderModalProps> = ({ isOpen, onClose, collars, preselectedCollarId, onSendPushOrder }) => {
  const [selectedTarget, setSelectedTarget] = useState<string>(preselectedCollarId || 'all');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(300);
  const [customCadence, setCustomCadence] = useState<string>('5');

  useEffect(() => {
    if (preselectedCollarId) setSelectedTarget(preselectedCollarId);
  }, [preselectedCollarId]);
  if (!isOpen) return null;
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSendPushOrder(selectedTarget === 'all' ? ['all'] : [selectedTarget], durationMinutes, intervalSeconds); onClose(); };
  const cadence = [{label:'Toutes les 5 min',value:300},{label:'Toutes les 10 min',value:600},{label:'Toutes les 15 min',value:900},{label:'Toutes les 30 min',value:1800}];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
      <div className="bg-white border border-[#E2E6DF] text-[#2C3327] rounded-2xl w-full max-w-lg p-6 shadow-xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-[#E2E6DF]">
          <div className="flex items-center space-x-2"><div className="w-10 h-10 rounded-xl bg-[#FDF0E2] text-[#E67E22] flex items-center justify-center"><Zap className="w-6 h-6 fill-current" /></div><div><h2 className="text-lg font-bold text-[#E67E22]">Ordre PUSH</h2><p className="text-xs text-[#7D8A74]">Cadence temporaire de transmission GPS</p></div></div>
          <button onClick={onClose} className="text-[#7D8A74] p-1"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div><label className="block text-xs font-semibold mb-1 flex items-center space-x-1"><Radio className="w-3.5 h-3.5 text-[#E67E22]" /><span>Collier(s) destinataire(s)</span></label><select value={selectedTarget} onChange={e=>setSelectedTarget(e.target.value)} className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl px-3.5 py-2.5 text-sm"><option value="all">⚡ Tout le troupeau ({collars.length} colliers)</option>{collars.map(c=><option key={c.id} value={c.id}>🐑 {c.sheepName} ({c.collarNumber})</option>)}</select></div>
          <div><label className="block text-xs font-semibold mb-2">Cadence de remontée des données GPS</label><div className="grid grid-cols-2 gap-2">{cadence.map(item=><button key={item.value} type="button" onClick={()=>setIntervalSeconds(item.value)} className={`p-3 rounded-xl border text-xs font-bold ${intervalSeconds===item.value?'bg-[#E67E22] text-white border-[#D35400]':'bg-[#F2F4F1] border-[#E2E6DF]'}`}>{item.label}</button>)}</div><div className="mt-2 p-3 rounded-xl border border-[#E2E6DF] bg-[#F2F4F1]"><label className="block text-xs font-semibold mb-1">Cadence personnalisée (minutes)</label><div className="flex items-center gap-2"><input type="number" min={1} max={1440} step={1} value={customCadence} onChange={e=>{const value=e.target.value;setCustomCadence(value);const n=Number(value);if(Number.isInteger(n)&&n>=1&&n<=1440)setIntervalSeconds(n*60);}} className="w-full bg-white border border-[#C5D1C1] rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#E67E22]/30" placeholder="ex. 5"/><span className="text-xs font-bold text-[#7D8A74]">min</span></div><p className="text-[10px] text-[#7D8A74] mt-1">Entre 1 et 1440 minutes.</p></div></div>
          <div><label className="block text-xs font-semibold mb-2 flex items-center space-x-1"><Clock className="w-3.5 h-3.5 text-[#E67E22]" /><span>Durée d'activation du PUSH</span></label><div className="grid grid-cols-4 gap-2">{[{label:'10 min',value:10},{label:'30 min',value:30},{label:'1 Heure',value:60},{label:'3 Heures',value:180}].map(item=><button key={item.value} type="button" onClick={()=>setDurationMinutes(item.value)} className={`p-2.5 rounded-xl border text-xs font-bold ${durationMinutes===item.value?'bg-[#E67E22] text-white border-[#D35400]':'bg-[#F2F4F1] border-[#E2E6DF]'}`}>{item.label}</button>)}</div></div>
          <div className="bg-[#FDF0E2] border border-[#FAD7B2] p-3.5 rounded-xl text-xs"><div className="font-bold flex items-center space-x-1 text-[#E67E22]"><CheckCircle2 className="w-4 h-4" /><span>Action immédiate</span></div><p className="text-[11px] leading-relaxed mt-1">Le collier transmettra sa position GPS toutes les <strong>{intervalSeconds < 60 ? `${intervalSeconds} s` : `${intervalSeconds / 60} min`}</strong> pendant <strong>{durationMinutes} min</strong>, puis reviendra automatiquement à la cadence standard.</p></div>
          <div className="pt-4 border-t border-[#E2E6DF] flex justify-end space-x-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-[#7D8A74]">Annuler</button><button type="submit" className="px-6 py-2.5 bg-[#E67E22] text-white font-bold text-xs rounded-xl flex items-center space-x-2"><Zap className="w-4 h-4 fill-current" /><span>Envoyer l'Ordre PUSH</span></button></div>
        </form>
      </div>
    </div>
  );
};
