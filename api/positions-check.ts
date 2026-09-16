/**
 * Pâtur'GPS — point d'entrée pour un Database Webhook Supabase sur la table
 * `positions` (événement INSERT).
 *
 * Pourquoi ce fichier : `evaluateZoneExit` (dans api/[...path].ts) ne tourne
 * aujourd'hui que pour les positions qui passent par POST /api/telemetry
 * (source = 'mqtt'). Toute position insérée dans `positions` par un autre
 * chemin (l'automatisation Zapier/Make/n8n du collier LTE, un ajout manuel
 * dans Supabase Studio, etc., toutes avec source != 'mqtt') ne déclenche
 * jamais ce contrôle, donc aucune alerte hors-zone ni batterie faible n'est
 * créée pour ces positions.
 *
 * Ce fichier est volontairement autonome (aucun import depuis d'autres
 * fichiers du projet) : il duplique la logique déjà présente et éprouvée
 * dans api/[...path].ts (pointInPolygon / pointInsideZone / evaluateZoneExit,
 * plus son équivalent pour la batterie) au lieu de la partager via un module
 * commun. C'est un choix délibéré après un incident où une factorisation
 * partagée avait cassé la route principale : ici, si ce fichier a un
 * problème, il n'affecte que ce webhook, jamais /api/[...path].ts.
 *
 * Ne touche à AUCUN fichier existant à part vercel.json (route explicite,
 * sinon ce fichier serait avalé par la règle catch-all /api/(.*)).
 *
 * Ne réinsère jamais de position : la ligne existe déjà (c'est elle qui a
 * déclenché le webhook). Il se contente d'évaluer hors-zone/batterie sur
 * cette ligne, et d'insérer une ligne dans `alerts` si besoin — ce qui
 * déclenche automatiquement le webhook Supabase déjà en place
 * (« PaturGPS Alertes » sur `alerts`/INSERT → /api/push-alert), donc la
 * notification Web Push part sans rien ajouter ici.
 *
 * Configuration à ajouter côté Supabase (Database → Webhooks) :
 *   Table: positions | Event: INSERT | POST → /api/positions-check
 * (même écran que pour les webhooks « PaturGPS Alertes » / « PaturGPS Danger »
 * déjà en place.)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const githubToken = process.env.GITHUB_TOKEN;
const githubOwner = process.env.GITHUB_REPO_OWNER || 'baheumatthieu65-design';
const githubRepo = process.env.GITHUB_REPO_NAME || 'Colliers-GPS';
const githubBranch = process.env.GITHUB_BRANCH || 'main';
const ZONES_CONFIG_PATH = 'config/zones.json';

const BATTERY_LOW_THRESHOLD_PERCENT = 15;

function out(res: any, code: number, body: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(code).json(body);
}

async function readZonesConfig(): Promise<{ zones: any[] }> {
  if (!githubToken) return { zones: [] };
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/contents/${ZONES_CONFIG_PATH}?ref=${encodeURIComponent(githubBranch)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });
    if (!response.ok) return { zones: [] };
    const payload: any = await response.json();
    const raw = Buffer.from(String(payload.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    return { zones: Array.isArray(parsed?.zones) ? parsed.zones : [] };
  } catch {
    return { zones: [] };
  }
}

function pointInPolygon(latitude: number, longitude: number, polygon: Array<[number, number]>) {
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

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, a)));
}

function pointInsideZone(latitude: number, longitude: number, zone: any) {
  if (!zone || zone.enabled === false) return false;
  if (zone.type === 'polygon') {
    const raw = Array.isArray(zone.polygon_coords) ? zone.polygon_coords : [];
    const polygon = raw
      .map((p: any) => (Array.isArray(p) ? [Number(p[0]), Number(p[1])] as [number, number] : null))
      .filter((p: any): p is [number, number] => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    return pointInPolygon(latitude, longitude, polygon);
  }
  const centerLat = Number(zone.center_latitude);
  const centerLng = Number(zone.center_longitude);
  const radius = Number(zone.radius_meters);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radius) || radius <= 0) return false;
  return distanceMeters(latitude, longitude, centerLat, centerLng) <= radius;
}

async function getAssignedZonesForCollar(collarId: string) {
  const config = await readZonesConfig();
  return (config.zones || [])
    .filter((zone: any) => zone.active !== false)
    .filter((zone: any) => zone.alertOnExit !== false)
    .filter((zone: any) => (zone.assignedCollarIds || []).includes(collarId))
    .map((zone: any) => ({
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

// Identique à evaluateZoneExit() dans api/[...path].ts : même algorithme,
// même règle « une seule alerte par épisode hors-zone ». Dupliqué ici
// volontairement (voir commentaire en tête de fichier).
async function evaluateZoneExit(supabase: any, collar: any, latitude: number, longitude: number, recordedAt: string) {
  const zones = await getAssignedZonesForCollar(collar.id);
  if (!zones.length) return { checked: false, inside: true, alerted: false, reason: 'no_assigned_zone' };

  const outsideZones = zones.filter((zone: any) => !pointInsideZone(latitude, longitude, zone));
  const inside = outsideZones.length < zones.length;
  if (inside) return { checked: true, inside: true, alerted: false, reason: 'inside_zone' };

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

// Même principe que evaluateZoneExit, mais pour la batterie < 15 % : une
// seule alerte par épisode, pas de nouvelle alerte tant que la batterie
// n'est pas remontée au-dessus du seuil puis redescendue en dessous.
async function evaluateBatteryLow(supabase: any, collar: any, latitude: number, longitude: number, batteryPercent: number | null | undefined, recordedAt: string) {
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

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return out(res, 204, {});
  if (req.method !== 'POST') return out(res, 405, { ok: false, error: 'Méthode non autorisée.' });

  if (!supabaseUrl || !serviceRoleKey) {
    return out(res, 500, { ok: false, error: 'Variables Supabase manquantes sur Vercel.' });
  }

  // Optionnel, comme PUSH_WEBHOOK_SECRET pour les webhooks existants : si
  // POSITIONS_WEBHOOK_SECRET est défini sur Vercel, ajouter un header
  // "x-positions-webhook-secret" dans la config du webhook Supabase.
  const secret = process.env.POSITIONS_WEBHOOK_SECRET;
  if (secret && req.headers?.['x-positions-webhook-secret'] !== secret) {
    return out(res, 401, { ok: false, error: 'Non autorisé.' });
  }

  try {
    const body = req.body || {};
    if (body.table && body.table !== 'positions') return out(res, 200, { ok: true, ignored: true, reason: 'wrong_table' });
    if (body.type && body.type !== 'INSERT') return out(res, 200, { ok: true, ignored: true, reason: 'wrong_event' });

    const row = body.record || body;
    const collarId = row.collar_id;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!collarId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return out(res, 200, { ok: true, ignored: true, reason: 'invalid_payload' });
    }

    // Les positions source='mqtt' viennent de POST /api/telemetry, qui a déjà
    // exécuté evaluateZoneExit/evaluateBatteryLow de façon synchrone pour
    // cette même ligne. On évite de les re-traiter ici pour ne jamais créer
    // une alerte en double.
    if (row.source === 'mqtt') {
      return out(res, 200, { ok: true, ignored: true, reason: 'already_checked_by_telemetry' });
    }

    const recordedAt = row.recorded_at || row.created_at || new Date().toISOString();
    const batteryPercent = row.battery_percent ?? null;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: collar, error: collarError } = await supabase.from('collars').select('*').eq('id', collarId).maybeSingle();
    if (collarError) throw new Error(`Lecture du collier impossible : ${collarError.message}`);
    if (!collar) return out(res, 200, { ok: true, ignored: true, reason: 'collar_not_found' });

    let zoneCheck: any = { checked: false, inside: true, alerted: false };
    try {
      zoneCheck = await evaluateZoneExit(supabase, collar, latitude, longitude, recordedAt);
    } catch (zoneError: any) {
      console.error('[PaturGPS API] Contrôle hors zone échoué (webhook positions)', zoneError?.message || zoneError);
    }

    let batteryCheck: any = { checked: false, low: false, alerted: false };
    try {
      batteryCheck = await evaluateBatteryLow(supabase, collar, latitude, longitude, batteryPercent, recordedAt);
    } catch (batteryError: any) {
      console.error('[PaturGPS API] Contrôle batterie faible échoué (webhook positions)', batteryError?.message || batteryError);
    }

    return out(res, 200, { ok: true, collarId, zoneCheck, batteryCheck });
  } catch (e: any) {
    return out(res, 500, { ok: false, error: e?.message || 'Erreur de vérification position.' });
  }
}
