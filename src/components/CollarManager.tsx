import React from 'react';
import { GPSCollar, GeofenceZone } from '../types';
import { Plus, Trash2, Edit3, Zap, Battery, Signal, Shield, Radio, ShieldAlert } from 'lucide-react';

interface CollarManagerProps {
  collars: GPSCollar[];
  zones: GeofenceZone[];
  onOpenAddCollar: () => void;
  onEditCollar: (collar: GPSCollar) => void;
  onDeleteCollar: (id: string) => void;
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
  return (
    <div className="space-y-6">
      
      {/* Top Banner & Add Button */}
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
          onClick={onOpenAddCollar}
          className="flex items-center justify-center space-x-2 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs px-4 py-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un Collier GPS</span>
        </button>
      </div>

      {/* Grid of Collars */}
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
              {/* Header with Sheep Name & Color Indicator */}
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-sm border-2 border-white/50"
                      style={{ backgroundColor: collar.color }}
                    >
                      🐑
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2C3327] text-base flex items-center space-x-2">
                        <span>{collar.sheepName}</span>
                      </h3>
                      <span className="text-xs font-mono text-[#5A6F4E] bg-[#F2F4F1] px-2 py-0.5 rounded-md border border-[#E2E6DF]">
                        {collar.collarNumber}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onEditCollar(collar)}
                      className="p-2 text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1] rounded-lg transition-all cursor-pointer"
                      title="Modifier le collier"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Voulez-vous vraiment supprimer le collier de ${collar.sheepName} (${collar.collarNumber}) ?`)) {
                          onDeleteCollar(collar.id);
                        }
                      }}
                      className="p-2 text-[#7D8A74] hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title="Supprimer le collier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status Badges */}
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

                {/* Zone Info */}
                <div className="mt-3 bg-[#F9FAF9] p-2.5 rounded-xl border border-[#E2E6DF] flex items-center justify-between text-xs">
                  <span className="text-[#7D8A74] flex items-center space-x-1">
                    <Shield className="w-3.5 h-3.5 text-[#7D8A74]" />
                    <span>Zone affectée:</span>
                  </span>
                  <span className="font-semibold text-[#5A6F4E] truncate max-w-[140px]">
                    {assignedZone ? assignedZone.name : 'Toutes les zones'}
                  </span>
                </div>

                {/* Geofence Status */}
                <div className="mt-2">
                  {isOutOfZone ? (
                    <div className="bg-red-100 text-red-800 border border-red-300 p-2 rounded-xl text-xs font-bold flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-red-600 animate-pulse" />
                      <span>HORS ZONE DE SÉCURITÉ !</span>
                    </div>
                  ) : (
                    <div className="bg-[#D8E0D5]/50 text-[#3E4A35] border border-[#C5D1C1] p-2 rounded-xl text-xs font-medium flex items-center justify-between">
                      <span className="font-semibold">✓ En zone de pâturage</span>
                      <span className="text-[10px] text-[#7D8A74]">Période std: 30 min</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Push Control Section per Collar */}
              <div className="mt-4 pt-3 border-t border-[#E2E6DF]">
                {collar.pushMode.active ? (
                  <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-amber-900">
                      <Zap className="w-4 h-4 text-[#E67E22] animate-bounce" />
                      <div>
                        <span className="font-bold block text-[#D35400]">PUSH Actif ({collar.pushMode.intervalSeconds}s)</span>
                        <span className="text-[10px] text-stone-600">
                          {collar.pushMode.durationMinutes} min ordonnées
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onStopPushForCollar(collar.id)}
                      className="text-[10px] font-bold bg-white hover:bg-stone-100 text-stone-700 px-2.5 py-1.5 rounded-lg border border-stone-200 cursor-pointer"
                    >
                      Arrêter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onOpenPushModalForCollar(collar.id)}
                    className="w-full py-2 bg-[#F2F4F1] hover:bg-[#E67E22] text-[#E67E22] hover:text-white border border-[#E2E6DF] font-bold text-xs rounded-xl transition-all flex items-center justify-center space-x-2 cursor-pointer"
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
