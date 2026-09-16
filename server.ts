import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GPSCollar, GeofenceZone, GPSPositionLog, GeofenceAlert, PushCommandRequest } from './src/types.js';

const app = express();
app.use(express.json());

const PORT = 3000;

// Base center location: Pyrenean Pastoral Valley (e.g., Luz-Saint-Sauveur / Estive de Saugué)
const BASE_LAT = 42.8450;
const BASE_LNG = -0.0150;

// Initial Default Geofence Zones
let zones: GeofenceZone[] = [
  {
    id: 'zone-1',
    name: 'Estive Principale - Le Saugué (Patatoïde)',
    description: 'Zone de pâturage haute montagne tracée sur carte',
    centerLat: BASE_LAT,
    centerLng: BASE_LNG,
    radiusMeters: 650,
    polygonCoords: [
      [BASE_LAT + 0.0035, BASE_LNG - 0.0035],
      [BASE_LAT + 0.0045, BASE_LNG + 0.0015],
      [BASE_LAT + 0.0020, BASE_LNG + 0.0055],
      [BASE_LAT - 0.0025, BASE_LNG + 0.0050],
      [BASE_LAT - 0.0045, BASE_LNG - 0.0005],
      [BASE_LAT - 0.0035, BASE_LNG - 0.0050],
      [BASE_LAT + 0.0000, BASE_LNG - 0.0060],
    ],
    assignedCollarIds: ['all'],
    color: '#5A6F4E', // Sage green
    active: true,
    alertOnExit: true,
  },
  {
    id: 'zone-2',
    name: 'Enclos Bergerie & Repli',
    description: 'Zone sécurisée de nuit et repli météo',
    centerLat: BASE_LAT + 0.003,
    centerLng: BASE_LNG - 0.004,
    radiusMeters: 250,
    assignedCollarIds: [],
    color: '#3B82F6', // Blue
    active: true,
    alertOnExit: true,
  }
];

// Initial Collars
let collars: GPSCollar[] = [
  {
    id: 'col-1',
    sheepName: 'Bella (Mère)',
    collarNumber: 'COL-101',
    color: '#EF4444', // Red
    batteryLevel: 92,
    signalQuality: 'Excellent',
    lastUpdate: new Date().toISOString(),
    currentLat: BASE_LAT + 0.0012,
    currentLng: BASE_LNG + 0.0008,
    status: 'inside_zone',
    activeZoneId: 'zone-1',
    pushMode: {
      active: false,
      intervalSeconds: 1800, // 30 min default
      expiresAt: null,
      durationMinutes: 0
    }
  },
  {
    id: 'col-2',
    sheepName: 'Marguerite',
    collarNumber: 'COL-102',
    color: '#3B82F6', // Blue
    batteryLevel: 84,
    signalQuality: 'Bon',
    lastUpdate: new Date().toISOString(),
    currentLat: BASE_LAT - 0.0015,
    currentLng: BASE_LNG - 0.0010,
    status: 'inside_zone',
    activeZoneId: 'zone-1',
    pushMode: {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0
    }
  },
  {
    id: 'col-3',
    sheepName: 'Blanchette',
    collarNumber: 'COL-103',
    color: '#10B981', // Green
    batteryLevel: 78,
    signalQuality: 'Excellent',
    lastUpdate: new Date().toISOString(),
    currentLat: BASE_LAT + 0.0025,
    currentLng: BASE_LNG - 0.0020,
    status: 'inside_zone',
    activeZoneId: 'zone-1',
    pushMode: {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0
    }
  },
  {
    id: 'col-4',
    sheepName: 'Noiraude',
    collarNumber: 'COL-104',
    color: '#8B5CF6', // Purple
    batteryLevel: 65,
    signalQuality: 'Moyen',
    lastUpdate: new Date().toISOString(),
    currentLat: BASE_LAT + 0.0055, // Intentionally near boundary or slightly outside to test alerts
    currentLng: BASE_LNG + 0.0060,
    status: 'out_of_zone',
    activeZoneId: 'zone-1',
    pushMode: {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0
    }
  },
  {
    id: 'col-5',
    sheepName: 'Eclair',
    collarNumber: 'COL-105',
    color: '#F59E0B', // Amber
    batteryLevel: 96,
    signalQuality: 'Excellent',
    lastUpdate: new Date().toISOString(),
    currentLat: BASE_LAT - 0.0005,
    currentLng: BASE_LNG + 0.0018,
    status: 'inside_zone',
    activeZoneId: 'zone-1',
    pushMode: {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0
    }
  }
];

// Historical position logs
let positionLogs: GPSPositionLog[] = [];

// Alerts database
let alertsHistory: GeofenceAlert[] = [];

// Distance calculation helper (Haversine formula in meters)
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Ray-casting algorithm for testing if point is inside a polygon (patatoïde)
function isPointInPolygon(lat: number, lng: number, polygon: Array<[number, number]>): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Helper to check if point is in zone (supports circle or patatoïde polygon)
function isPointInZone(lat: number, lng: number, zone: GeofenceZone): boolean {
  if (!zone.active) return true;
  if (zone.polygonCoords && zone.polygonCoords.length >= 3) {
    return isPointInPolygon(lat, lng, zone.polygonCoords);
  }
  const dist = getDistanceMeters(lat, lng, zone.centerLat, zone.centerLng);
  return dist <= zone.radiusMeters;
}

// Generate rich seed history for past 7 days (every 30 mins)
function generateSeedHistory() {
  console.log('Generating seed GPS history for pastoral collars...');
  const now = new Date();
  
  collars.forEach(collar => {
    // Generate ~100 points over past 3 days
    let lat = collar.currentLat;
    let lng = collar.currentLng;

    for (let i = 100; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000).toISOString();
      
      // Wander around base coordinates with small natural variations
      const angle = (Math.sin(i * 0.3) + Math.cos(i * 0.7)) * Math.PI;
      const step = 0.0003 + (Math.sin(i * 0.5) * 0.0002);
      lat += Math.cos(angle) * step;
      lng += Math.sin(angle) * step;

      // Keep within realistic bounds of valley
      if (Math.abs(lat - BASE_LAT) > 0.015) lat = BASE_LAT + (lat > BASE_LAT ? 0.008 : -0.008);
      if (Math.abs(lng - BASE_LNG) > 0.015) lng = BASE_LNG + (lng > BASE_LNG ? 0.008 : -0.008);

      const assignedZone = zones.find(z => z.id === collar.activeZoneId) || zones[0];
      const inZone = assignedZone ? isPointInZone(lat, lng, assignedZone) : true;

      positionLogs.push({
        id: `log-${collar.id}-${i}-${Date.now()}`,
        collarId: collar.id,
        sheepName: collar.sheepName,
        collarNumber: collar.collarNumber,
        color: collar.color,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        timestamp,
        speedKmH: Number((Math.random() * 2.5).toFixed(1)),
        battery: Math.max(20, Math.min(100, Math.round(collar.batteryLevel - (i * 0.2)))),
        inZone,
        zoneId: assignedZone?.id
      });
    }
  });

  // Add initial alert for Noiraude
  alertsHistory.push({
    id: 'alert-init-1',
    collarId: 'col-4',
    sheepName: 'Noiraude',
    collarNumber: 'COL-104',
    zoneId: 'zone-1',
    zoneName: 'Estive Principale - Le Saugué',
    timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    lat: BASE_LAT + 0.0055,
    lng: BASE_LNG + 0.0060,
    type: 'EXIT_ZONE',
    status: 'ACTIVE',
    message: 'Brebis Noiraude a quitté la zone Estive Principale ! (Distance: 780m du centre)'
  });
}

generateSeedHistory();

// Background simulator loop for live updates & Push mode expiration check
setInterval(() => {
  const now = new Date();
  
  collars.forEach(collar => {
    // Check if push mode has expired
    if (collar.pushMode.active && collar.pushMode.expiresAt) {
      if (new Date(collar.pushMode.expiresAt) <= now) {
        collar.pushMode.active = false;
        collar.pushMode.intervalSeconds = 1800; // back to 30 min
        collar.pushMode.expiresAt = null;
        collar.pushMode.durationMinutes = 0;
        console.log(`Push mode expired for collar ${collar.collarNumber} (${collar.sheepName})`);
      }
    }

    // Small realistic drift step
    const deltaLat = (Math.random() - 0.49) * 0.0003;
    const deltaLng = (Math.random() - 0.49) * 0.0003;
    collar.currentLat = Number((collar.currentLat + deltaLat).toFixed(6));
    collar.currentLng = Number((collar.currentLng + deltaLng).toFixed(6));
    collar.lastUpdate = now.toISOString();

    // Check geofence status
    const assignedZone = zones.find(z => z.id === collar.activeZoneId) || zones.find(z => z.assignedCollarIds.includes('all') || z.assignedCollarIds.includes(collar.id));
    if (assignedZone && assignedZone.active) {
      const inside = isPointInZone(collar.currentLat, collar.currentLng, assignedZone);
      
      if (!inside && collar.status === 'inside_zone') {
        collar.status = 'out_of_zone';
        // Create new Alert
        const dist = Math.round(getDistanceMeters(collar.currentLat, collar.currentLng, assignedZone.centerLat, assignedZone.centerLng));
        const newAlert: GeofenceAlert = {
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          collarId: collar.id,
          sheepName: collar.sheepName,
          collarNumber: collar.collarNumber,
          zoneId: assignedZone.id,
          zoneName: assignedZone.name,
          timestamp: now.toISOString(),
          lat: collar.currentLat,
          lng: collar.currentLng,
          type: 'EXIT_ZONE',
          status: 'ACTIVE',
          message: `ALERTE: La brebis ${collar.sheepName} (${collar.collarNumber}) a franchi la zone "${assignedZone.name}" (${dist}m du centre)!`
        };
        alertsHistory.unshift(newAlert);
      } else if (inside && collar.status === 'out_of_zone') {
        collar.status = 'inside_zone';
      }
    }

    // Save to position log
    positionLogs.unshift({
      id: `log-${collar.id}-${Date.now()}`,
      collarId: collar.id,
      sheepName: collar.sheepName,
      collarNumber: collar.collarNumber,
      color: collar.color,
      lat: collar.currentLat,
      lng: collar.currentLng,
      timestamp: now.toISOString(),
      speedKmH: Number((Math.random() * 2).toFixed(1)),
      battery: collar.batteryLevel,
      inZone: collar.status === 'inside_zone',
      zoneId: assignedZone?.id
    });
  });

  // Limit history buffer to 2000 logs
  if (positionLogs.length > 2000) {
    positionLogs = positionLogs.slice(0, 2000);
  }
}, 8000); // simulation heartbeat every 8 seconds

// API ROUTES

// 1. Get all collars
app.get('/api/collars', (req, res) => {
  res.json(collars);
});

// 2. Add new collar
app.post('/api/collars', (req, res) => {
  const { sheepName, collarNumber, color, activeZoneId } = req.body;
  if (!sheepName || !collarNumber) {
    return res.status(400).json({ error: 'Nom de brebis et numéro de collier requis.' });
  }

  const newCollar: GPSCollar = {
    id: `col-${Date.now()}`,
    sheepName,
    collarNumber,
    color: color || '#10B981',
    batteryLevel: 100,
    signalQuality: 'Excellent',
    lastUpdate: new Date().toISOString(),
    currentLat: BASE_LAT + (Math.random() - 0.5) * 0.003,
    currentLng: BASE_LNG + (Math.random() - 0.5) * 0.003,
    status: 'inside_zone',
    activeZoneId: activeZoneId || zones[0]?.id,
    pushMode: {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0
    }
  };

  collars.push(newCollar);
  res.status(201).json(newCollar);
});

// 3. Update collar (e.g., change color, name, active zone)
app.put('/api/collars/:id', (req, res) => {
  const { id } = req.params;
  const index = collars.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Collier non trouvé' });
  }

  collars[index] = {
    ...collars[index],
    ...req.body
  };

  res.json(collars[index]);
});

// 4. Delete collar
app.delete('/api/collars/:id', (req, res) => {
  const { id } = req.params;
  collars = collars.filter(c => c.id !== id);
  res.json({ success: true, id });
});

// 5. Push command (Bouton Push: order collar(s) to send high frequency data for a period)
app.post('/api/push-order', (req, res) => {
  const { collarIds, durationMinutes, intervalSeconds }: PushCommandRequest = req.body;

  if (!durationMinutes || durationMinutes <= 0) {
    return res.status(400).json({ error: 'Durée valide requise en minutes' });
  }

  const targetInterval = intervalSeconds || 30; // default 30s
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

  let updatedCount = 0;
  collars.forEach(collar => {
    if (collarIds.includes('all') || collarIds.includes(collar.id)) {
      collar.pushMode = {
        active: true,
        intervalSeconds: targetInterval,
        expiresAt,
        durationMinutes
      };
      updatedCount++;
    }
  });

  res.json({
    success: true,
    message: `Ordre PUSH activé pour ${updatedCount} collier(s) pendant ${durationMinutes} min (cadence ${targetInterval}s)`,
    collars
  });
});

// 6. Stop Push order for collar
app.delete('/api/collars/:id/push', (req, res) => {
  const { id } = req.params;
  const collar = collars.find(c => c.id === id);
  if (collar) {
    collar.pushMode = {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0
    };
  }
  res.json({ success: true, collar });
});

// 7. Get Geofence Zones
app.get('/api/zones', (req, res) => {
  res.json(zones);
});

// 8. Create Geofence Zone
app.post('/api/zones', (req, res) => {
  const { name, description, centerLat, centerLng, radiusMeters, polygonCoords, color, assignedCollarIds } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Nom de la zone requis.' });
  }

  // Calculate centerLat/Lng if polygonCoords provided
  let calcLat = Number(centerLat) || BASE_LAT;
  let calcLng = Number(centerLng) || BASE_LNG;
  if (polygonCoords && polygonCoords.length > 0) {
    const lats = polygonCoords.map((p: [number, number]) => p[0]);
    const lngs = polygonCoords.map((p: [number, number]) => p[1]);
    calcLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
    calcLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
  }

  const newZone: GeofenceZone = {
    id: `zone-${Date.now()}`,
    name,
    description: description || '',
    centerLat: calcLat,
    centerLng: calcLng,
    radiusMeters: Number(radiusMeters) || 500,
    polygonCoords: polygonCoords || undefined,
    color: color || '#5A6F4E',
    assignedCollarIds: assignedCollarIds || ['all'],
    active: true,
    alertOnExit: true
  };

  zones.push(newZone);
  res.status(201).json(newZone);
});

// 9. Update Geofence Zone
app.put('/api/zones/:id', (req, res) => {
  const { id } = req.params;
  const index = zones.findIndex(z => z.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Zone introuvable' });
  }

  zones[index] = {
    ...zones[index],
    ...req.body
  };

  res.json(zones[index]);
});

// 10. Delete Geofence Zone
app.delete('/api/zones/:id', (req, res) => {
  const { id } = req.params;
  zones = zones.filter(z => z.id !== id);
  res.json({ success: true, id });
});

// 11. Get Alerts History
app.get('/api/alerts', (req, res) => {
  res.json(alertsHistory);
});

// 12. Resolve/Dismiss alert
app.put('/api/alerts/:id/resolve', (req, res) => {
  const { id } = req.params;
  const alert = alertsHistory.find(a => a.id === id);
  if (alert) {
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
  }
  res.json({ success: true, alert });
});

// 13. Get Position History for Track Tracing
app.get('/api/history', (req, res) => {
  const { collarId, startDate, endDate } = req.query;

  let filtered = [...positionLogs];

  if (collarId && collarId !== 'all') {
    filtered = filtered.filter(log => log.collarId === collarId);
  }

  if (startDate) {
    const start = new Date(startDate as string).getTime();
    filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start);
  }

  if (endDate) {
    const end = new Date(endDate as string).getTime();
    filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end);
  }

  // Sort chronologically ascending for drawing polylines
  filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  res.json(filtered);
});

// 14. Manual Simulation trigger to move sheep outside zone (for live user demo)
app.post('/api/simulation/trigger-out-of-zone', (req, res) => {
  const { collarId } = req.body;
  const collar = collars.find(c => c.id === collarId) || collars[0];
  
  if (collar) {
    // Offset significantly outside
    collar.currentLat = BASE_LAT + 0.012;
    collar.currentLng = BASE_LNG + 0.012;
    collar.status = 'out_of_zone';
    
    const assignedZone = zones.find(z => z.id === collar.activeZoneId) || zones[0];
    const newAlert: GeofenceAlert = {
      id: `alert-manual-${Date.now()}`,
      collarId: collar.id,
      sheepName: collar.sheepName,
      collarNumber: collar.collarNumber,
      zoneId: assignedZone?.id,
      zoneName: assignedZone?.name || 'Estive',
      timestamp: new Date().toISOString(),
      lat: collar.currentLat,
      lng: collar.currentLng,
      type: 'EXIT_ZONE',
      status: 'ACTIVE',
      message: `ALERTE DÉCLENCHÉE: La brebis ${collar.sheepName} a dépassé la limite de clôture virtuelle (${assignedZone?.name || 'Zone'})!`
    };
    alertsHistory.unshift(newAlert);
  }

  res.json({ success: true, collar, alerts: alertsHistory });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
