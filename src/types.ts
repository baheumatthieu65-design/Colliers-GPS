
/** Identifiant court affichable, dérivé de l'identifiant interne immuable. */
export function shortId(id: string | null | undefined, length = 10): string {
  if (!id) return '';
  return id.replace(/[^a-zA-Z0-9]/g, '').slice(0, length);
}

export interface PushModeConfig {
  active: boolean;
  intervalSeconds: number;
  expiresAt: string | null;
  durationMinutes: number;
}

export interface GPSCollar {
  id: string;
  sheepName: string;
  collarNumber: string;
  animalNumber?: string;
  color: string;
  batteryLevel: number;
  signalQuality: 'Excellent' | 'Bon' | 'Moyen' | 'Faible' | 'Inconnu';
  lastUpdate: string;
  currentLat: number;
  currentLng: number;
  status: 'inside_zone' | 'out_of_zone' | 'no_signal' | 'offline';
  activeZoneId?: string;
  pushMode: PushModeConfig;
  imei?: string;
  iccid?: string;
  simPhone?: string;
  mode?: 'simulation' | 'real';
  notes?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  description?: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  polygonCoords?: Array<[number, number]>;
  assignedCollarIds: string[];
  color: string;
  active: boolean;
  alertOnExit: boolean;
  fillVisible?: boolean;
}

export interface GPSPositionLog {
  id: string;
  collarId: string;
  sheepName: string;
  collarNumber: string;
  color: string;
  lat: number;
  lng: number;
  timestamp: string;
  speedKmH: number;
  battery: number;
  inZone: boolean;
  zoneId?: string;
}

export type AlertType = 'EXIT_ZONE' | 'LOW_BATTERY' | 'NO_SIGNAL';
export type AlertStatus = 'ACTIVE' | 'RESOLVED' | 'DISMISSED';

export interface GeofenceAlert {
  id: string;
  collarId: string;
  sheepName: string;
  collarNumber: string;
  zoneId?: string;
  zoneName?: string;
  timestamp: string;
  lat: number;
  lng: number;
  type: AlertType;
  status: AlertStatus;
  message: string;
  resolvedAt?: string;
}

export interface PushCommandRequest {
  collarIds: string[];
  durationMinutes: number;
  intervalSeconds: number;
}

export interface SimulationSettings {
  isSimulating: boolean;
  speedFactor: number;
}
