/**
 * Pâtur'GPS — logique partagée de contrôle hors-zone / batterie faible.
 *
 * Utilisée par deux points d'entrée :
 * - api/[...path].ts → POST /api/telemetry et POST /api/collars/:id/position
 *   (positions qui arrivent EN PASSANT par l'API, insérées ici même).
 * - api/positions-check.ts → appelée par un Database Webhook Supabase sur
 *   INSERT dans `positions`, donc déclenchée aussi pour les positions
 *   écrites directement dans Supabase par l'automatisation (Zapier/Make/n8n)
 *   qui relaie les trames du collier LTE/BG9x. C'est ce deuxième chemin qui
 *   permet aux alertes hors-zone/batterie de fonctionner sans rien changer
 *   à cette automatisation existante.
 */

const githubToken = process.env.GITHUB_TOKEN;
const githubOwner = process.env.GITHUB_REPO_OWNER || 'baheumatthieu65-design';
const githubRepo = process.env.GITHUB_REPO_NAME || 'Colliers-GPS';
const githubBranch = process.env.GITHUB_BRANCH || 'main';
const githubApiBase = 'https://api.github.com';

const ZONES_CONFIG_PATH = 'config/zones.json';

function githubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${githubToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function githubContentsUrl(path: string) {
  return `${githubApiBase}/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}?ref=${encodeURIComponent(githubBranch)}`;
}

function decodeGithubContent(encoded: string) {
  return Buffer.from(encoded.replace(/\n/g, ''), 'base64').toString('utf8');
}

type GithubJsonCacheEntry = {
  data: unknown;
  sha: string | null;
  expiresAt: number;
};

// Même cache/mêmes règles que dans api/[...path].ts (voir ce fichier pour le
// détail) : évite de consommer la limite API GitHub à chaque appel, et sert
// la dernière configuration connue en cas de rate-limit.
export const githubJsonCache = new Map<string, GithubJsonCacheEntry>();
export const GITHUB_READ_CACHE_MS = 60_000;

export async function githubReadJson<T>(path: string, fallback: T): Promise<{ data: T; sha: string | null; fromGithub: boolean }> {
  if (!githubToken) return { data: fallback, sha: null, fromGithub: false };

  const cached = githubJsonCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data as T, sha: cached.sha, fromGithub: true };
  }

  try {
    const response = await fetch(githubContentsUrl(path), {
      headers: githubHeaders(),
      cache: 'no-store',
    });

    if (response.status === 404) return { data: fallback, sha: null, fromGithub: true };

    if (!response.ok) {
      if (cached) {
        console.warn(`[PaturGPS API] GitHub ${path} indisponible (${response.status}), utilisation de la dernière configuration valide.`);
        return { data: cached.data as T, sha: cached.sha, fromGithub: true };
      }
      console.warn(`[PaturGPS API] GitHub ${path} indisponible (${response.status}), utilisation de la configuration locale de secours.`);
      return { data: fallback, sha: null, fromGithub: false };
    }

    const payload = await response.json();
    const raw = decodeGithubContent(String(payload.content || ''));
    const data = JSON.parse(raw) as T;

    githubJsonCache.set(path, {
      data,
      sha: payload.sha || null,
      expiresAt: Date.now() + GITHUB_READ_CACHE_MS,
    });

    return { data, sha: payload.sha || null, fromGithub: true };
  } catch (err) {
    if (cached) {
      console.warn(`[PaturGPS API] Lecture GitHub ${path} échouée, utilisation de la dernière configuration valide.`);
      return { data: cached.data as T, sha: cached.sha, fromGithub: true };
    }
    console.warn(`[PaturGPS API] Lecture GitHub ${path} échouée, utilisation de la configuration locale de secours.`);
    return { data: fallback, sha: null, fromGithub: false };
  }
}

export type GithubZoneConfig = {
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
};

export type ZonesConfigFile = { version: number; zones: GithubZoneConfig[] };

const fallbackZonesConfig: ZonesConfigFile = {
  version: 1,
  zones: [{
    id: '6db4ea95-c17a-47f5-92d6-5c66e2892c0f',
    name: 'Montaut',
    description: 'Zone patatoïde tracée manuellement avec 11 sommets',
    centerLat: 42.970209500724984,
    centerLng: 0.4217509643785659,
    radiusMeters: 500,
    polygonCoords: [
      [42.977274252378116, 0.40263175964355474],
      [42.980043184528625, 0.41312319189415364],
      [42.977180059557256, 0.4258978532817893],
      [42.97419718096634, 0.4343032836914063],
      [42.96672365223365, 0.44108390808105474],
      [42.96163610904843, 0.4411697387695313],
      [42.95849544028007, 0.43627738952636724],
      [42.96521627589293, 0.4228878021240235],
      [42.966346811611274, 0.4134464263916016],
      [42.97118275764097, 0.40640830993652344],
      [42.974008783837114, 0.40203094482421875],
    ],
    assignedCollarIds: ['ff843b96-8b9d-46e8-95bb-253e40f94d97'],
    color: '#10B981',
    active: true,
    alertOnExit: true,
    fillVisible: false,
  }],
};

export async function readZonesConfig() {
  return githubReadJson<ZonesConfigFile>(ZONES_CONFIG_PATH, fallbackZonesConfig);
}

export function pointInPolygon(latitude: number, longitude: number, polygon: Array<[number, number]>) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = Number(polygon[i][0]);
    const xi = Number(polygon[i][1]);
    const yj = Number(polygon[j][0]);
    const xj = Number(polygon[j][1]);
    const intersects = ((yi > latitude) !== (yj > latitude))
      && (longitude < ((xj - xi) * (latitude - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function pointInsideZone(latitude: number, longitude: number, zone: any) {
  if (!zone || zone.enabled === false) return false;
  if (zone.type === 'polygon') {
    const raw = Array.isArray(zone.polygon_coords) ? zone.polygon_coords : [];
    const polygon = raw
      .map((p: any) => Array.isArray(p) ? [Number(p[0]), Number(p[1])] as [number, number] : null)
      .filter((p: any): p is [number, number] => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    return pointInPolygon(latitude, longitude, polygon);
  }

  const centerLat = Number(zone.center_latitude);
  const centerLng = Number(zone.center_longitude);
  const radius = Number(zone.radius_meters);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radius) || radius <= 0) return false;
  return distanceMeters(latitude, longitude, centerLat, centerLng) <= radius;
}

export async function getAssignedZonesForCollar(supabase: any, collarId: string) {
  // GitHub est la source de vérité de l'affectation des clôtures.
  // Ne pas dépendre de collar_zones ici : si le miroir Supabase est en retard,
  // une position GPS réelle doit quand même déclencher l'alerte.
  const config = await readZonesConfig();
  return config.data.zones
    .filter((zone) => zone.active !== false)
    .filter((zone) => zone.alertOnExit !== false)
    .filter((zone) => (zone.assignedCollarIds || []).includes(collarId))
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      type: zone.polygonCoords?.length >= 3 ? 'polygon' : 'circle',
      center_latitude: zone.centerLat,
      center_longitude: zone.centerLng,
      radius_meters: zone.radiusMeters,
      polygon_coords: zone.polygonCoords || null,
      enabled: zone.active !== false,
    }));
}

export async function evaluateZoneExit(supabase: any, collar: any, latitude: number, longitude: number, recordedAt: string) {
  const zones = await getAssignedZonesForCollar(supabase, collar.id);
  if (!zones.length) return { checked: false, inside: true, alerted: false, reason: 'no_assigned_zone' };

  // Une brebis peut être dans plusieurs zones : elle est considérée dedans si
  // elle est dans au moins une des zones qui lui sont affectées.
  const outsideZones = zones.filter((zone: any) => !pointInsideZone(latitude, longitude, zone));
  const inside = outsideZones.length < zones.length;
  if (inside) return { checked: true, inside: true, alerted: false, reason: 'inside_zone' };

  // On cherche la dernière position antérieure qui était encore dans une zone.
  // Si aucune position intérieure n'existe, cela couvre aussi le cas important
  // où une zone vient d'être affectée alors que la brebis est déjà dehors.
  const { data: recentPositions, error: recentError } = await supabase
    .from('positions')
    .select('latitude,longitude,recorded_at,created_at')
    .eq('collar_id', collar.id)
    .order('recorded_at', { ascending: false })
    .limit(100);
  if (recentError) throw new Error(`Lecture des positions précédentes impossible : ${recentError.message}`);

  const previousPositions = (recentPositions || []).filter((position: any) =>
    String(position.recorded_at || '') !== String(recordedAt)
  );
  const lastInside = previousPositions.find((position: any) => {
    const lat = Number(position.latitude);
    const lng = Number(position.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng)
      && zones.some((zone: any) => pointInsideZone(lat, lng, zone));
  });

  // Une seule alerte par épisode hors-zone. Si la brebis est déjà dehors et
  // qu'une alerte existe pour cet épisode, on ne spamme pas à chaque trame.
  const zone = zones[0];
  const { data: lastAlert, error: alertLookupError } = await supabase
    .from('alerts')
    .select('id,created_at,zone_id')
    .eq('collar_id', collar.id)
    .eq('zone_id', zone.id)
    .eq('type', 'zone_exit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (alertLookupError) throw new Error(`Lecture de la dernière alerte hors zone impossible : ${alertLookupError.message}`);

  const lastInsideAt = lastInside?.recorded_at ? Date.parse(String(lastInside.recorded_at)) : NaN;
  const lastAlertAt = lastAlert?.created_at ? Date.parse(String(lastAlert.created_at)) : NaN;
  if (lastAlert && (!Number.isFinite(lastInsideAt) || (Number.isFinite(lastAlertAt) && lastAlertAt >= lastInsideAt))) {
    return { checked: true, inside: false, alerted: false, reason: 'already_alerted_this_outside_episode' };
  }

  const message = `ALERTE HORS ZONE : ${collar.animal_name || collar.name || collar.internal_code || 'Collier'} est hors de la zone de sécurité ${zone.name}.`;
  const { data: alert, error: alertError } = await supabase.from('alerts').insert({
    collar_id: collar.id,
    zone_id: zone.id,
    type: 'zone_exit',
    severity: 'warning',
    message,
    latitude,
    longitude,
    battery_percent: collar.battery_percent ?? null,
  }).select('*').single();
  if (alertError) throw new Error(`Impossible de créer l'alerte hors zone : ${alertError.message}`);

  return { checked: true, inside: false, alerted: true, alertId: alert?.id || null, zoneId: zone.id, zoneName: zone.name };
}

export const BATTERY_LOW_THRESHOLD_PERCENT = 15;

// Même logique de « un seul épisode = une seule alerte » que evaluateZoneExit,
// mais pour la batterie : pas de nouvelle alerte tant que la batterie n'est
// pas remontée au-dessus du seuil puis redescendue en dessous.
export async function evaluateBatteryLow(supabase: any, collar: any, latitude: number, longitude: number, batteryPercent: number | null | undefined, recordedAt: string) {
  if (batteryPercent == null || !Number.isFinite(Number(batteryPercent))) {
    return { checked: false, low: false, alerted: false, reason: 'no_battery_reading' };
  }
  const battery = Number(batteryPercent);
  if (battery >= BATTERY_LOW_THRESHOLD_PERCENT) {
    return { checked: true, low: false, alerted: false, reason: 'battery_ok' };
  }

  const { data: recentPositions, error: recentError } = await supabase
    .from('positions')
    .select('battery_percent,recorded_at')
    .eq('collar_id', collar.id)
    .not('battery_percent', 'is', null)
    .order('recorded_at', { ascending: false })
    .limit(100);
  if (recentError) throw new Error(`Lecture des niveaux de batterie précédents impossible : ${recentError.message}`);

  const previousReadings = (recentPositions || []).filter((position: any) =>
    String(position.recorded_at || '') !== String(recordedAt)
  );
  const lastOk = previousReadings.find((position: any) => Number(position.battery_percent) >= BATTERY_LOW_THRESHOLD_PERCENT);

  const { data: lastAlert, error: alertLookupError } = await supabase
    .from('alerts')
    .select('id,created_at')
    .eq('collar_id', collar.id)
    .eq('type', 'low_battery')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (alertLookupError) throw new Error(`Lecture de la dernière alerte batterie impossible : ${alertLookupError.message}`);

  const lastOkAt = lastOk?.recorded_at ? Date.parse(String(lastOk.recorded_at)) : NaN;
  const lastAlertAt = lastAlert?.created_at ? Date.parse(String(lastAlert.created_at)) : NaN;
  if (lastAlert && (!Number.isFinite(lastOkAt) || (Number.isFinite(lastAlertAt) && lastAlertAt >= lastOkAt))) {
    return { checked: true, low: true, alerted: false, reason: 'already_alerted_this_low_battery_episode' };
  }

  const message = `ALERTE BATTERIE FAIBLE : ${collar.animal_name || collar.name || collar.internal_code || 'Collier'} est à ${battery}% de batterie.`;
  const { data: alert, error: alertError } = await supabase.from('alerts').insert({
    collar_id: collar.id,
    zone_id: null,
    type: 'low_battery',
    severity: 'warning',
    message,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    battery_percent: battery,
  }).select('*').single();
  if (alertError) throw new Error(`Impossible de créer l'alerte batterie faible : ${alertError.message}`);

  return { checked: true, low: true, alerted: true, alertId: alert?.id || null };
}
