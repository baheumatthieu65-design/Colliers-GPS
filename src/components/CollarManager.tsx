import React from 'react';
import { GPSCollar, GeofenceZone, shortId } from '../types';
import { Plus, Trash2, Edit3, Zap, Battery, Signal, Shield, Radio, ShieldAlert } from 'lucide-react';

interface CollarManagerProps {
  collars: GPSCollar[];
  zones: GeofenceZone[];
  onOpenAddCollar: () => void;
  onEditCollar: (collar: GPSCollar) => void;
  onDeleteCollar: (id: string) => void | Promise<boolean>;
  onOpenPushModalForCollar: (collarId: string) => void;
  onStopPushForCollar: (collarId: string) => void;
}

export const CollarManager: React.FC<CollarManagerProps> = ({
  collars,
  zones,
  onOpenAddCollar,
  onEditCollar,
  onDeleteCollar,
  onOpenPushModalForCollar,
  onStopPushForCollar,
}) => {
  const handleEdit = (collar: GPSCollar) => {
    console.log('[PaturGPS] Modifier collier:', shortId(collar.id));
    onEditCollar(collar);
  };

  const handleDelete = async (collar: GPSCollar) => {
    const ok = window.confirm(
      `Voulez-vous vraiment supprimer le collier de ${collar.sheepName} (${collar.collarNumber}) ?`
    );
    if (!ok) return;
    console.log('[PaturGPS] Supprimer collier:', shortId(collar.id));
    await onDeleteCollar(collar.id);
  };

  // Capture au niveau du conteneur : fonctionne même si l'icône SVG reçoit le clic.
  const handleActionCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button[data-collar-action]') as HTMLButtonElement | null;
    if (!button) return;
    const action = button.dataset.collarAction;
    const collarId = button.dataset.collarId;
    if (!collarId) return;
    const collar = collars.find((item) => item.id === collarId);
    if (!collar) return;
    e.preventDefault();
    e.stopPropagation();
    if (action === 'edit') {
      console.log('[PaturGPS] CAPTURE EDIT', shortId(collar.id));
      onEditCollar(collar);
    } else if (action === 'delete') {
      console.log('[PaturGPS] CAPTURE DELETE', shortId(collar.id));
      void handleDelete(collar);
    }
  };

  return (
    <div className="space-y-6" onClickCapture={handleActionCapture}>
      <div className="bg-white border border-[#E2E6DF] p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#3E4A35] flex items-center space-x-2">
            <Radio className="w-6 h-6 text-[#5A6F4E]" />
            <span>Gestion du Troupeau & Colliers GPS</span>
          </h2>
          <p className="text-xs text-[#7D8A74] mt-1 font-medium">
            Gérez la flotte de colliers, affectez les couleurs distinctives et contrôlez la cadence de transmission.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAddCollar}
          className="flex items-center justify-center space-x-2 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs px-4 py-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer touch-manipulation"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Collier GPS</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collars.map((collar) => {
          const assignedZone = zones.find(z => z.id === collar.activeZoneId);
          const isOutOfZone = collar.status === 'out_of_zone';

          return (
            <div
              key={collar.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm transition-all relative flex flex-col justify-between ${
                isOutOfZone
                  ? 'border-red-400 bg-red-50/50'
                  : 'border-[#E2E6DF] hover:border-[#C5D1C1]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-sm border-2 border-white/50"
                      style={{ backgroundColor: collar.color }}
                    >
                      🐑
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#2C3327] text-base truncate">{collar.sheepName}</h3>
                      <span className="text-xs font-mono text-[#5A6F4E] bg-[#F2F4F1] px-2 py-0.5 rounded-md border border-[#E2E6DF]">
                        {collar.collarNumber}
                      </span>
                    </div>
                  </div>

                  {/* ACTIONS: large, explicit buttons. No parent click handler, no overlay. */}
                  <div className="flex shrink-0 items-center gap-1 z-[100]">
                    <button
                      type="button"
                      title="Modifier le collier"
                      data-collar-action="edit"
                      data-collar-id={collar.id}
                      aria-label={`Modifier ${collar.sheepName}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(collar);
                      }}
                      className="relative z-[101] inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-[#C5D1C1] bg-white text-[#5A6F4E] hover:bg-[#F2F4F1] font-bold text-[11px] cursor-pointer touch-manipulation select-none"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span className="hidden sm:inline">Modifier</span>
                    </button>

                    <button
                      type="button"
                      title="Supprimer le collier"
                      data-collar-action="delete"
                      data-collar-id={collar.id}
                      aria-label={`Supprimer ${collar.sheepName}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDelete(collar);
                      }}
                      className="relative z-[101] inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 font-bold text-[11px] cursor-pointer touch-manipulation select-none"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Supprimer</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[#F2F4F1] p-2 rounded-xl border border-[#E2E6DF] flex items-center space-x-2">
                    <Battery className={`w-4 h-4 ${collar.batteryLevel < 30 ? 'text-red-500' : 'text-[#5A6F4E]'}`} />
                    <div>
                      <span className="text-[#7D8A74] block text-[10px]">Batterie</span>
                      <span className="font-semibold text-[#2C3327]">{collar.batteryLevel}%</span>
                    </div>
                  </div>
                  <div className="bg-[#F2F4F1] p-2 rounded-xl border border-[#E2E6DF] flex items-center space-x-2">
                    <Signal className="w-4 h-4 text-[#5A6F4E]" />
                    <div>
                      <span className="text-[#7D8A74] block text-[10px]">Signal GPS</span>
                      <span className="font-semibold text-[#2C3327]">{collar.signalQuality}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 bg-[#F9FAF9] p-2.5 rounded-xl border border-[#E2E6DF] flex items-center justify-between text-xs">
                  <span className="text-[#7D8A74] flex items-center space-x-1">
                    <Shield className="w-3.5 h-3.5 text-[#7D8A74]" />
                    <span>Zone affectée:</span>
                  </span>
                  <span className="font-semibold text-[#5A6F4E] truncate max-w-[140px]">
                    {assignedZone ? assignedZone.name : 'Toutes les zones'}
                  </span>
                </div>

                <div className="mt-2">
                  {isOutOfZone ? (
                    <div className="bg-red-100 text-red-800 border border-red-300 p-2 rounded-xl text-xs font-bold flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
                      <span>HORS ZONE DE SÉCURITÉ !</span>
                    </div>
                  ) : (
                    <div className="bg-[#D8E0D5]/50 text-[#3E4A35] border border-[#C5D1C1] p-2 rounded-xl text-xs font-medium flex items-center justify-between">
                      <span className="font-semibold">✓ En zone de pâturage</span>
                      <span className="text-[10px] text-[#7D8A74]">Période std: {collar.baseTransmissionMinutes >= 60 && collar.baseTransmissionMinutes % 60 === 0 ? `${collar.baseTransmissionMinutes / 60} h` : `${collar.baseTransmissionMinutes || 30} min`}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E6DF]">
                {collar.pushMode.active ? (
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-amber-900">
                      <Zap className="w-4 h-4 text-[#E67E22] animate-bounce" />
                      <div>
                        <span className="font-bold block text-[#D35400]">PUSH Actif ({collar.pushMode.intervalSeconds >= 60 ? `${collar.pushMode.intervalSeconds / 60} min` : `${collar.pushMode.intervalSeconds}s`})</span>
                        <span className="text-[10px] text-stone-600">{collar.pushMode.durationMinutes} min ordonnées</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onStopPushForCollar(collar.id)}
                      className="text-[10px] font-bold bg-white hover:bg-stone-100 text-stone-700 px-2.5 py-1.5 rounded-lg border border-stone-200 cursor-pointer touch-manipulation"
                    >
                      Arrêter
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenPushModalForCollar(collar.id)}
                    className="w-full py-2 bg-[#F2F4F1] hover:bg-[#E67E22] text-[#E67E22] hover:text-white border border-[#E2E6DF] font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer touch-manipulation"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Lancer PUSH Haute Fréquence</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {collars.length === 0 && (
        <div className="bg-white border border-[#E2E6DF] rounded-2xl p-12 text-center text-[#7D8A74]">
          <Radio className="w-12 h-12 mx-auto text-[#7D8A74] mb-3" />
          <h3 className="text-lg font-bold text-[#2C3327]">Aucun collier GPS configuré</h3>
          <p className="text-xs text-[#7D8A74] max-w-sm mx-auto mt-1">
            Cliquez sur le bouton "Ajouter un Collier GPS" ci-dessus pour associer un nouveau collier à une brebis.
          </p>
        </div>
      )}
    </div>
  );
};
