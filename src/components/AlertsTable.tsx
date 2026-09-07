import React, { useState } from 'react';
import { GeofenceAlert } from '../types';
import { 
  ShieldAlert, 
  CheckCircle, 
  Search, 
  Download, 
  Clock, 
  Radio, 
  Filter
} from 'lucide-react';

interface AlertsTableProps {
  alerts: GeofenceAlert[];
  onResolveAlert: (alertId: string) => void;
  onLocateOnMap?: (lat: number, lng: number) => void;
}

export const AlertsTable: React.FC<AlertsTableProps> = ({
  alerts,
  onResolveAlert,
  onLocateOnMap,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = 
      alert.sheepName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.collarNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (alert.zoneName && alert.zoneName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = 
      statusFilter === 'ALL' || alert.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const exportCSV = () => {
    const headers = ['ID', 'Date/Heure', 'Brebis', 'Collier', 'Type', 'Statut', 'Zone', 'Message', 'Lat', 'Lng'];
    const rows = filteredAlerts.map(a => [
      a.id,
      new Date(a.timestamp).toLocaleString('fr-FR'),
      a.sheepName,
      a.collarNumber,
      a.type,
      a.status,
      a.zoneName || 'N/A',
      `"${a.message.replace(/"/g, '""')}"`,
      a.lat,
      a.lng
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `export_alertes_paturgps_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      
      {/* Filters & Export Toolbar */}
      <div className="bg-white border border-[#E2E6DF] p-4 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#7D8A74] absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Rechercher par nom de brebis, N° collier ou zone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F2F4F1] border border-[#E2E6DF] rounded-xl pl-10 pr-4 py-2 text-xs text-[#2C3327] placeholder-[#7D8A74] focus:outline-none focus:border-[#5A6F4E] transition-all font-medium"
          />
        </div>

        {/* Status Filter & Export Button */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-[#F2F4F1] p-1 rounded-xl border border-[#E2E6DF] text-xs">
            <Filter className="w-3.5 h-3.5 text-[#7D8A74] ml-1.5" />
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                statusFilter === 'ALL' ? 'bg-[#5A6F4E] text-white shadow-2xs' : 'text-[#7D8A74] hover:text-[#2C3327]'
              }`}
            >
              Toutes ({alerts.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                statusFilter === 'ACTIVE' ? 'bg-red-600 text-white shadow-2xs' : 'text-[#7D8A74] hover:text-[#2C3327]'
              }`}
            >
              Actives ({alerts.filter(a => a.status === 'ACTIVE').length})
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-medium ${
                statusFilter === 'RESOLVED' ? 'bg-[#3E4A35] text-white shadow-2xs' : 'text-[#7D8A74] hover:text-[#2C3327]'
              }`}
            >
              Acquittées
            </button>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center space-x-1.5 bg-[#D8E0D5] hover:bg-[#C5D1C1] text-[#3E4A35] border border-[#C5D1C1] px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="Exporter l'historique en CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#5A6F4E]" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>

      </div>

      {/* Alerts Table */}
      <div className="bg-white border border-[#E2E6DF] rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F9FAF9] text-[#7D8A74] uppercase tracking-wider font-semibold text-[10px] border-b border-[#E2E6DF]">
                <th className="py-3.5 px-4">Date & Horodatage</th>
                <th className="py-3.5 px-4">Brebis / Collier</th>
                <th className="py-3.5 px-4">Type d'Alerte</th>
                <th className="py-3.5 px-4">Zone Concernée</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Détails Message</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6DF] text-[#2C3327]">
              {filteredAlerts.map((alert) => {
                const isActive = alert.status === 'ACTIVE';

                return (
                  <tr 
                    key={alert.id}
                    className={`hover:bg-[#F2F4F1] transition-colors ${
                      isActive ? 'bg-red-50/70' : ''
                    }`}
                  >
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[#5A6F4E]">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#7D8A74]" />
                        <span>{new Date(alert.timestamp).toLocaleString('fr-FR')}</span>
                      </div>
                    </td>

                    {/* Sheep Name & Collar */}
                    <td className="py-3.5 px-4 font-semibold text-[#2C3327] whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">🐑</span>
                        <div>
                          <span>{alert.sheepName}</span>
                          <span className="block text-[10px] text-[#7D8A74] font-mono">
                            {alert.collarNumber}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Alert Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-bold text-[11px] border border-red-200">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Sortie de zone</span>
                      </span>
                    </td>

                    {/* Zone Name */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-[#5A6F4E]">
                      {alert.zoneName || 'Zone Principale'}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isActive ? (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                          Active !
                        </span>
                      ) : (
                        <span className="bg-[#D8E0D5] text-[#3E4A35] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#C5D1C1]">
                          Acquittée
                        </span>
                      )}
                    </td>

                    {/* Message Details */}
                    <td className="py-3.5 px-4 max-w-xs text-stone-600 truncate" title={alert.message}>
                      {alert.message}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right space-x-2">
                      {onLocateOnMap && (
                        <button
                          onClick={() => onLocateOnMap(alert.lat, alert.lng)}
                          className="bg-[#F2F4F1] hover:bg-[#E2E6DF] text-[#3E4A35] px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#E2E6DF] transition-all cursor-pointer"
                          title="Localiser l'événement sur la carte"
                        >
                          📍 Carte
                        </button>
                      )}

                      {isActive && (
                        <button
                          onClick={() => onResolveAlert(alert.id)}
                          className="bg-[#5A6F4E] hover:bg-[#4A5E3E] text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          title="Acquitter l'alerte"
                        >
                          Acquitter
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredAlerts.length === 0 && (
          <div className="p-10 text-center text-[#7D8A74] text-xs font-medium">
            Aucun historique d'alerte correspondant à vos critères.
          </div>
        )}
      </div>

    </div>
  );
};
