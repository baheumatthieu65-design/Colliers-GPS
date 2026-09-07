export interface PushModeConfig {
  active: boolean;
  intervalSeconds: number; // e.g. 30 seconds vs normal 1800s (30 min)
  expiresAt: string | null; // ISO timestamp
  durationMinutes: number;
}

export interface GPSCollar {
  id: string;
  sheepName: string;
  collarNumber: string;
  color: string;
  batteryLevel: number;
  signalQuality: 'Excellent' | 'Bon' | 'Moyen' | 'Faible';
  lastUpdate: string;
  currentLat: number;
  currentLng: number;
  status: 'inside_zone' | 'out_of_zone' | 'no_signal';
  activeZoneId?: string;
  pushMode: PushModeConfig;
}

export interface GeofenceZone {
  id: string;
  name: string;
  description?: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  polygonCoords?: Array<[number, number]>; // Optional polygon coordinates [lat, lng]
  assignedCollarIds: string[]; // empty or contains collar ids ('all' means applies to all)
  color: string;
  active: boolean;
  alertOnExit: boolean;
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
  collarIds: string[]; // ['all'] or array of IDs
  durationMinutes: number;
  intervalSeconds: number;
}

export interface SimulationSettings {
  isSimulating: boolean;
  speedFactor: number; // 1x, 5x, 10x for live demo
}
