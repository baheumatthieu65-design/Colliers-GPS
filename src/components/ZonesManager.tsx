import React from 'react';
import { GeofenceZone, GPSCollar } from '../types';
import { Plus, Trash2, Edit3, Shield, MapPin, Radio, Layers } from 'lucide-react';

interface ZonesManagerProps {
  zones: GeofenceZone[];
  collars: GPSCollar[];
  onOpenAddZone: () => void;
  onEditZone: (zone: GeofenceZone) => void;
  onDeleteZone: (zoneId: string) => void;
}

export const ZonesManager: React.FC<ZonesManagerProps> = ({
  zones,
  collars,
  onOpenAddZone,
  onEditZone,
  onDeleteZone,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-[#E2E6DF] p-6 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#3E4A35] flex items-center space-x-2">
            <Layers className="w-6 h-6 text-[#5A6F4E]" />
            <span>Gestion des Clôtures Virtuelles & Zones de Pâturage</span>
          </h2>
          <p className="text-xs text-[#7D8A74] mt-1 font-medium">
            Définissez les périmètres de sécurité. Une alerte instantanée est déclenchée dès qu'une brebis franchit ces limites.
          </p>
        </div>

        <button
          onClick={onOpenAddZone}
          className="flex items-center justify-center space-x-2 bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white font-bold text-xs px-4 py-3 rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Créer une Clôture Virtuelle</span>
        </button>
      </div>

      {/* Grid of Geofence Zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {zones.map((zone) => {
          const assignedCollars = zone.assignedCollarIds.includes('all')
            ? collars
            : collars.filter(c => zone.assignedCollarIds.includes(c.id));

          return (
            <div 
              key={zone.id}
              className="bg-white border border-[#E2E6DF] rounded-2xl p-5 shadow-sm hover:border-[#C5D1C1] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-sm"
                      style={{ backgroundColor: zone.color }}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2C3327] text-base">{zone.name}</h3>
                      {zone.description && (
                        <p className="text-xs text-[#7D8A74]">{zone.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onEditZone(zone)}
                      className="p-2 text-[#7D8A74] hover:text-[#2C3327] hover:bg-[#F2F4F1] rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Voulez-vous supprimer la zone "${zone.name}" ?`)) {
                          onDeleteZone(zone.id);
                        }
                      }}
                      className="p-2 text-[#7D8A74] hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Zone Details */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                  <div className="bg-[#F2F4F1] p-2.5 rounded-xl border border-[#E2E6DF]">
                    <span className="text-[#7D8A74] block text-[10px]">Type & Périmètre</span>
                    <span className="font-bold text-[#5A6F4E] font-mono text-sm">
                      {zone.polygonCoords && zone.polygonCoords.length >= 3
                        ? `Patatoïde (${zone.polygonCoords.length} sommets)`
                        : `${zone.radiusMeters} m (Cercle)`}
                    </span>
                  </div>

                  <div className="bg-[#F2F4F1] p-2.5 rounded-xl border border-[#E2E6DF]">
                    <span className="text-[#7D8A74] block text-[10px]">Centre GPS</span>
                    <span className="font-mono text-[#2C3327] text-[11px]">
                      {zone.centerLat.toFixed(4)}, {zone.centerLng.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Assigned Collars list */}
                <div className="mt-3 bg-[#F9FAF9] p-3 rounded-xl border border-[#E2E6DF]">
                  <span className="text-xs text-[#7D8A74] block mb-1.5 font-semibold">
                    Colliers rattachés à cette zone:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {assignedCollars.map(c => (
                      <span 
                        key={c.id} 
                        className="bg-white text-[#2C3327] text-[11px] px-2 py-0.5 rounded-md border border-[#E2E6DF] flex items-center space-x-1 shadow-2xs"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="font-medium">🐑 {c.sheepName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E2E6DF] flex items-center justify-between text-xs">
                <span className="text-[#7D8A74]">Alerte automatique si franchissement:</span>
                <span className="bg-[#D8E0D5] text-[#3E4A35] font-bold px-2 py-0.5 rounded-md border border-[#C5D1C1]">
                  ✓ ACTIVÉE
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
