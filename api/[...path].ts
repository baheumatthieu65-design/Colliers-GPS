import { createClient } from '@supabase/supabase-js';

/**
 * Pâtur'GPS V12
 *
 * Architecture:
 * - GitHub = source of truth for application configuration (collars + zones).
 * - Supabase = live/technical data, history, alerts and PUSH commands.
 * - Vercel = secure gateway between the app, GitHub and Supabase.
 * - MQTT delivery is prepared through the command queue; the MQTT worker can
 *   consume pending command_targets and publish them to the BG95 at wake-up.
 */

type AnyReq = {
  method?: string;
  body?: any;
  query?: Record<string, any>;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type AnyRes = {
  status: (code: number) => AnyRes;
  json: (body: any) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

type GithubFile = {
  sha: string;
  content: string;
};

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const githubToken = process.env.GITHUB_TOKEN;
const githubOwner = process.env.GITHUB_REPO_OWNER || 'baheumatthieu65-design';
const githubRepo = process.env.GITHUB_REPO_NAME || 'Colliers-GPS';
const githubBranch = process.env.GITHUB_BRANCH || 'main';
const githubApiBase = 'https://api.github.com';

const COLLARS_CONFIG_PATH = 'config/collars.json';
const ZONES_CONFIG_PATH = 'config/zones.json';

function cors(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function getPath(req: AnyReq) {
  // Sur Vercel, req.url peut être relatif (ex: /api/collars).
  if (req.query && req.query.path !== undefined) {
    const rawPath = Array.isArray(req.query.path)
      ? req.query.path.join('/')
      : String(req.query.path);
    return rawPath.replace(/^\/?api\/?/, '').replace(/^\/+|\/+$/g, '');
  }

  const rawUrl = String(req.url || '/api');
  const pathOnly = rawUrl.split('?')[0];
  return pathOnly.replace(/^\/?api\/?/, '').replace(/^\/+|\/+$/g, '');
}

function getQuery(req: AnyReq) {
  const result: Record<string, string> = {};
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (key === 'path') continue;
      if (Array.isArray(value)) result[key] = String(value[0] ?? '');
      else if (value != null) result[key] = String(value);
    }
    return result;
  }

  const rawUrl = String(req.url || '');
  const queryString = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  return Object.fromEntries(new URLSearchParams(queryString).entries());
}

function signalQuality(signal: number | null | undefined) {
  if (signal == null) return 'Inconnu';
  if (signal >= 75) return 'Excellent';
  if (signal >= 50) return 'Bon';
  if (signal >= 25) return 'Moyen';
  return 'Faible';
}

function normalizeError(details: any) {
  if (details == null) return null;
  if (typeof details === 'string') return details;
  return {
    message: details.message || String(details),
    code: details.code || undefined,
    details: details.details || undefined,
    hint: details.hint || undefined,
  };
}

function error(res: AnyRes, status: number, message: string, details?: any) {
  const normalized = normalizeError(details);
  console.error('[PaturGPS API]', message, normalized || '');
  return res.status(status).json({ ok: false, error: message, details: normalized });
}

function requireGithubWriteAccess() {
  if (!githubToken) {
    throw new Error('GITHUB_TOKEN manque sur Vercel : les modifications GitHub sont désactivées.');
  }
}

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

async function githubReadJson<T>(path: string, fallback: T): Promise<{ data: T; sha: string | null; fromGithub: boolean }> {
  if (!githubToken) return { data: fallback, sha: null, fromGithub: false };

  const response = await fetch(githubContentsUrl(path), {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  if (response.status === 404) return { data: fallback, sha: null, fromGithub: true };
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub lecture ${path} impossible (${response.status}) : ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  const raw = decodeGithubContent(String(payload.content || ''));
  return { data: JSON.parse(raw) as T, sha: payload.sha || null, fromGithub: true };
}

async function githubReadFile(path: string): Promise<GithubFile | null> {
  requireGithubWriteAccess();
  const response = await fetch(githubContentsUrl(path), {
    headers: githubHeaders(),
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub lecture ${path} impossible (${response.status}) : ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  return {
    sha: payload.sha,
    content: decodeGithubContent(String(payload.content || '')),
  };
}

async function githubWriteJson(path: string, value: unknown, message: string) {
  requireGithubWriteAccess();

  const current = await githubReadFile(path);
  const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8').toString('base64');
  const body: Record<string, any> = {
    message,
    content,
    branch: githubBranch,
  };
  if (current?.sha) body.sha = current.sha;

  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`, {
    method: 'PUT',
    headers: githubHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub écriture ${path} impossible (${response.status}) : ${text.slice(0, 500)}`);
  }

  return response.json();
}

async function githubDeleteFile(path: string, message: string) {
  requireGithubWriteAccess();
  const current = await githubReadFile(path);
  if (!current) return { deleted: false };

  const response = await fetch(`${githubApiBase}/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`, {
    method: 'DELETE',
    headers: githubHeaders(),
    body: JSON.stringify({ message, sha: current.sha, branch: githubBranch }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub suppression ${path} impossible (${response.status}) : ${text.slice(0, 500)}`);
  }

  return { deleted: true };
}

type GithubCollarConfig = {
  id: string;
  sheepName: string;
  collarNumber: string;
  animalNumber?: string;
  color?: string;
  mode?: 'simulation' | 'real';
  status?: 'active' | 'inactive' | 'maintenance';
  notes?: string;
  activeZoneId?: string | null;
};

type GithubZoneConfig = {
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
};

type CollarsConfigFile = { version: number; collars: GithubCollarConfig[] };
type ZonesConfigFile = { version: number; zones: GithubZoneConfig[] };

const emptyCollarsConfig: CollarsConfigFile = { version: 1, collars: [] };
const emptyZonesConfig: ZonesConfigFile = { version: 1, zones: [] };

async function readCollarsConfig() {
  return githubReadJson<CollarsConfigFile>(COLLARS_CONFIG_PATH, emptyCollarsConfig);
}

async function readZonesConfig() {
  return githubReadJson<ZonesConfigFile>(ZONES_CONFIG_PATH, emptyZonesConfig);
}

function mapCollar(config: GithubCollarConfig, row: any, assignedZoneId?: string | null) {
  return {
    id: config.id,
    sheepName: config.sheepName,
    collarNumber: config.collarNumber,
    animalNumber: config.animalNumber || undefined,
    color: config.color || '#5A6F4E',
    batteryLevel: row?.battery_percent ?? 100,
    signalQuality: signalQuality(row?.signal_strength),
    lastUpdate: row?.last_seen || row?.updated_at || row?.created_at || new Date().toISOString(),
    currentLat: row?.last_latitude ?? 42.9637,
    currentLng: row?.last_longitude ?? 0.3829,
    status: config.status === 'inactive' ? 'offline' : 'inside_zone',
    activeZoneId: assignedZoneId || config.activeZoneId || undefined,
    pushMode: row?.push_mode || {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0,
    },
    // Ces données viennent de Supabase, pas de la configuration GitHub.
    imei: row?.imei || undefined,
    iccid: row?.iccid || undefined,
    simPhone: row?.sim_phone || undefined,
    mode: config.mode || row?.mode || 'simulation',
    notes: config.notes || undefined,
  };
}

function mapZone(config: GithubZoneConfig) {
  return {
    id: config.id,
    name: config.name,
    description: config.description || '',
    centerLat: config.centerLat,
    centerLng: config.centerLng,
    radiusMeters: config.radiusMeters || 500,
    polygonCoords: config.polygonCoords || undefined,
    assignedCollarIds: config.assignedCollarIds || [],
    color: config.color || '#5A6F4E',
    active: config.active !== false,
    alertOnExit: config.alertOnExit !== false,
  };
}

async function getSupabaseCollarMap(supabase: any, ids: string[]) {
  if (!ids.length) return new Map<string, any>();
  const { data, error: dbError } = await supabase.from('collars').select('*').in('id', ids);
  if (dbError) throw new Error(`Erreur lecture données techniques des colliers : ${dbError.message}`);
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function mirrorZoneToSupabase(supabase: any, zone: GithubZoneConfig) {
  const row = {
    id: zone.id,
    name: zone.name,
    type: zone.polygonCoords?.length >= 3 ? 'polygon' : 'circle',
    center_latitude: zone.centerLat,
    center_longitude: zone.centerLng,
    radius_meters: zone.radiusMeters || 500,
    polygon_coords: zone.polygonCoords || null,
    color: zone.color || '#5A6F4E',
    enabled: zone.active !== false,
    notes: zone.description || '',
  };

  const { error: dbError } = await supabase.from('zones').upsert(row, { onConflict: 'id' });
  if (dbError) throw new Error(`Miroir Supabase de la clôture impossible : ${dbError.message}`);

  await supabase.from('collar_zones').delete().eq('zone_id', zone.id);
  const ids = (zone.assignedCollarIds || []).filter(Boolean);
  if (ids.length) {
    const { error: linkError } = await supabase.from('collar_zones').upsert(
      ids.map((collarId) => ({ collar_id: collarId, zone_id: zone.id, enabled: true })),
      { onConflict: 'collar_id,zone_id' }
    );
    if (linkError) throw new Error(`Affectation Supabase de la clôture impossible : ${linkError.message}`);
  }
}

async function mirrorCollarToSupabase(supabase: any, config: GithubCollarConfig, body: any = {}) {
  const row = {
    id: config.id,
    name: config.sheepName,
    internal_code: config.collarNumber,
    animal_name: config.sheepName,
    animal_number: config.animalNumber || null,
    imei: body.imei || null,
    iccid: body.iccid || null,
    sim_phone: body.simPhone || null,
    mode: config.mode === 'real' ? 'real' : 'simulation',
    status: config.status || 'active',
    color: config.color || '#5A6F4E',
    notes: config.notes || null,
  };

  const { data, error: dbError } = await supabase
    .from('collars')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .single();

  if (dbError) throw new Error(`Miroir Supabase du collier impossible : ${dbError.message}`);
  return data;
}

export default async function handler(req: AnyReq, res: AnyRes) {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return error(res, 500, 'Variables Supabase manquantes sur Vercel.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const path = getPath(req);
  const query = getQuery(req);
  const method = req.method || 'GET';

  try {
    // ---------------- HEALTH / CONFIG ----------------
    if (path === 'health' && method === 'GET') {
      const [{ error: dbError }, github] = await Promise.all([
        supabase.from('collars').select('id').limit(1),
        githubReadJson<CollarsConfigFile>(COLLARS_CONFIG_PATH, emptyCollarsConfig),
      ]);
      if (dbError) return error(res, 500, 'Supabase inaccessible.', dbError.message);
      return res.status(200).json({
        ok: true,
        service: 'patur-gps-api-v12',
        github: github.fromGithub,
        githubWriteConfigured: Boolean(githubToken),
      });
    }

    // ---------------- COLLARS : GITHUB + SUPABASE ----------------
    if (path === 'collars' && method === 'GET') {
      const config = await readCollarsConfig();
      const ids = config.data.collars.map((c) => c.id);
      const rows = await getSupabaseCollarMap(supabase, ids);

      const zoneByCollar = new Map<string, string>();
      const zones = await readZonesConfig();
      for (const zone of zones.data.zones) {
        for (const collarId of zone.assignedCollarIds || []) {
          zoneByCollar.set(collarId, zone.id);
        }
      }

      return res.status(200).json(
        config.data.collars.map((c) => mapCollar(c, rows.get(c.id), zoneByCollar.get(c.id)))
      );
    }

    if (path === 'collars' && method === 'POST') {
      const body = req.body || {};
      if (!body.sheepName || !body.collarNumber) {
        return error(res, 400, 'Nom de brebis et numéro de collier requis.');
      }

      const config = await readCollarsConfig();
      if (config.data.collars.some((c) => c.collarNumber === body.collarNumber)) {
        return error(res, 409, `Le numéro de collier ${body.collarNumber} existe déjà dans GitHub.`);
      }

      const id = body.id || crypto.randomUUID();
      const collarConfig: GithubCollarConfig = {
        id,
        sheepName: body.sheepName,
        collarNumber: body.collarNumber,
        animalNumber: body.animalNumber || undefined,
        color: body.color || '#10B981',
        mode: body.mode === 'real' ? 'real' : 'simulation',
        status: body.status || 'active',
        notes: body.notes || undefined,
        activeZoneId: body.activeZoneId || null,
      };

      // GitHub est la source de vérité de la configuration du collier.
      const next = { ...config.data, collars: [...config.data.collars, collarConfig] };
      await githubWriteJson(COLLARS_CONFIG_PATH, next, `feat: ajouter le collier ${collarConfig.collarNumber}`);

      try {
        const row = await mirrorCollarToSupabase(supabase, collarConfig, body);
        if (body.activeZoneId) {
          const zones = await readZonesConfig();
          const zone = zones.data.zones.find((z) => z.id === body.activeZoneId);
          if (zone && !zone.assignedCollarIds.includes(id)) {
            zone.assignedCollarIds = [...zone.assignedCollarIds, id];
            await githubWriteJson(ZONES_CONFIG_PATH, zones.data, `chore: affecter ${collarConfig.collarNumber} à une clôture`);
            await mirrorZoneToSupabase(supabase, zone);
          }
        }
        return res.status(201).json(mapCollar(collarConfig, row, body.activeZoneId));
      } catch (e: any) {
        // Le commit GitHub reste volontairement la trace de la configuration.
        return error(res, 500, 'Collier ajouté à GitHub mais miroir Supabase impossible.', e?.message || e);
      }
    }

    const collarMatch = path.match(/^collars\/([^/]+)$/);
    if (collarMatch && method === 'PUT') {
      const id = collarMatch[1];
      const body = req.body || {};
      const config = await readCollarsConfig();
      const index = config.data.collars.findIndex((c) => c.id === id);
      if (index < 0) return error(res, 404, 'Collier introuvable dans la configuration GitHub.', { id });

      const current = config.data.collars[index];
      const updated: GithubCollarConfig = {
        ...current,
        sheepName: body.sheepName !== undefined ? body.sheepName : current.sheepName,
        collarNumber: body.collarNumber !== undefined ? body.collarNumber : current.collarNumber,
        animalNumber: body.animalNumber !== undefined ? body.animalNumber : current.animalNumber,
        color: body.color !== undefined ? body.color : current.color,
        mode: body.mode !== undefined ? body.mode : current.mode,
        status: body.status !== undefined ? body.status : current.status,
        notes: body.notes !== undefined ? body.notes : current.notes,
        activeZoneId: body.activeZoneId !== undefined ? body.activeZoneId : current.activeZoneId,
      };

      const duplicate = config.data.collars.find((c) => c.id !== id && c.collarNumber === updated.collarNumber);
      if (duplicate) return error(res, 409, `Le numéro de collier ${updated.collarNumber} existe déjà dans GitHub.`);

      config.data.collars[index] = updated;
      await githubWriteJson(COLLARS_CONFIG_PATH, config.data, `chore: modifier le collier ${updated.collarNumber}`);

      try {
        // Les informations techniques restent dans Supabase. Une modification
        // de l'interface ne doit jamais effacer IMEI/ICCID/SIM si ces champs
        // ne sont pas présents dans la requête.
        const { data: existingRow, error: existingError } = await supabase
          .from('collars')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (existingError) throw new Error(`Lecture du matériel Supabase impossible : ${existingError.message}`);

        const technicalBody = {
          imei: body.imei !== undefined ? body.imei : existingRow?.imei,
          iccid: body.iccid !== undefined ? body.iccid : existingRow?.iccid,
          simPhone: body.simPhone !== undefined ? body.simPhone : existingRow?.sim_phone,
        };
        const row = await mirrorCollarToSupabase(supabase, updated, technicalBody);
        if (body.activeZoneId !== undefined) {
          const zones = await readZonesConfig();
          for (const zone of zones.data.zones) {
            zone.assignedCollarIds = (zone.assignedCollarIds || []).filter((collarId) => collarId !== id);
          }
          if (body.activeZoneId) {
            const zone = zones.data.zones.find((z) => z.id === body.activeZoneId);
            if (zone) zone.assignedCollarIds = [...new Set([...zone.assignedCollarIds, id])];
          }
          await githubWriteJson(ZONES_CONFIG_PATH, zones.data, `chore: mettre à jour l'affectation du collier ${updated.collarNumber}`);
          for (const zone of zones.data.zones) await mirrorZoneToSupabase(supabase, zone);
        }
        return res.status(200).json(mapCollar(updated, row, updated.activeZoneId));
      } catch (e: any) {
        return error(res, 500, 'Collier modifié dans GitHub mais miroir Supabase impossible.', e?.message || e);
      }
    }

    if (collarMatch && method === 'DELETE') {
      const id = collarMatch[1];
      const config = await readCollarsConfig();
      const current = config.data.collars.find((c) => c.id === id);
      if (!current) return error(res, 404, 'Collier introuvable dans la configuration GitHub.', { id });

      // Retirer d'abord toutes les affectations de clôtures dans GitHub.
      const zones = await readZonesConfig();
      for (const zone of zones.data.zones) {
        zone.assignedCollarIds = (zone.assignedCollarIds || []).filter((collarId) => collarId !== id);
      }
      await githubWriteJson(ZONES_CONFIG_PATH, zones.data, `chore: retirer le collier ${current.collarNumber} des clôtures`);
      await githubWriteJson(
        COLLARS_CONFIG_PATH,
        { ...config.data, collars: config.data.collars.filter((c) => c.id !== id) },
        `feat: supprimer le collier ${current.collarNumber}`
      );

      // Puis nettoyer les données opérationnelles Supabase.
      const dependentTables = ['command_targets', 'device_events', 'positions', 'alerts', 'push_subscriptions', 'collar_zones'];
      for (const table of dependentTables) {
        const { error: depError } = await supabase.from(table).delete().eq('collar_id', id);
        if (depError) return error(res, 400, `GitHub mis à jour mais nettoyage Supabase impossible (${table}).`, depError);
      }
      const { error: dbError } = await supabase.from('collars').delete().eq('id', id);
      if (dbError) return error(res, 400, 'GitHub mis à jour mais suppression Supabase impossible.', dbError);

      for (const zone of zones.data.zones) await mirrorZoneToSupabase(supabase, zone);
      return res.status(200).json({ ok: true, success: true, id, github: true, supabase: true });
    }

    // ---------------- ZONES : GITHUB + SUPABASE ----------------
    if (path === 'zones' && method === 'GET') {
      const config = await readZonesConfig();
      return res.status(200).json(config.data.zones.map(mapZone));
    }

    if (path === 'zones' && method === 'POST') {
      const body = req.body || {};
      if (!body.name) return error(res, 400, 'Nom de la zone requis.');

      let centerLat = Number(body.centerLat) || 0;
      let centerLng = Number(body.centerLng) || 0;
      if (Array.isArray(body.polygonCoords) && body.polygonCoords.length) {
        centerLat = body.polygonCoords.reduce((s: number, p: any) => s + Number(p[0]), 0) / body.polygonCoords.length;
        centerLng = body.polygonCoords.reduce((s: number, p: any) => s + Number(p[1]), 0) / body.polygonCoords.length;
      }

      const config = await readZonesConfig();
      const id = body.id || crypto.randomUUID();
      const zone: GithubZoneConfig = {
        id,
        name: body.name,
        description: body.description || '',
        centerLat,
        centerLng,
        radiusMeters: Number(body.radiusMeters) || 500,
        polygonCoords: Array.isArray(body.polygonCoords) ? body.polygonCoords : undefined,
        assignedCollarIds: Array.isArray(body.assignedCollarIds) ? body.assignedCollarIds.filter((x: any) => x !== 'all') : [],
        color: body.color || '#5A6F4E',
        active: body.active !== false,
        alertOnExit: body.alertOnExit !== false,
      };

      await githubWriteJson(
        ZONES_CONFIG_PATH,
        { ...config.data, zones: [...config.data.zones, zone] },
        `feat: ajouter la clôture ${zone.name}`
      );
      try {
        await mirrorZoneToSupabase(supabase, zone);
        return res.status(201).json(mapZone(zone));
      } catch (e: any) {
        return error(res, 500, 'Clôture ajoutée à GitHub mais miroir Supabase impossible.', e?.message || e);
      }
    }

    const zoneMatch = path.match(/^zones\/([^/]+)$/);
    if (zoneMatch && method === 'PUT') {
      const id = zoneMatch[1];
      const body = req.body || {};
      const config = await readZonesConfig();
      const index = config.data.zones.findIndex((z) => z.id === id);
      if (index < 0) return error(res, 404, 'Clôture introuvable dans la configuration GitHub.', { id });

      const current = config.data.zones[index];
      let centerLat = body.centerLat !== undefined ? Number(body.centerLat) : current.centerLat;
      let centerLng = body.centerLng !== undefined ? Number(body.centerLng) : current.centerLng;
      if (Array.isArray(body.polygonCoords) && body.polygonCoords.length) {
        centerLat = body.polygonCoords.reduce((s: number, p: any) => s + Number(p[0]), 0) / body.polygonCoords.length;
        centerLng = body.polygonCoords.reduce((s: number, p: any) => s + Number(p[1]), 0) / body.polygonCoords.length;
      }

      const updated: GithubZoneConfig = {
        ...current,
        name: body.name !== undefined ? body.name : current.name,
        description: body.description !== undefined ? body.description : current.description,
        centerLat,
        centerLng,
        radiusMeters: body.radiusMeters !== undefined ? Number(body.radiusMeters) : current.radiusMeters,
        polygonCoords: body.polygonCoords !== undefined ? body.polygonCoords : current.polygonCoords,
        assignedCollarIds: body.assignedCollarIds !== undefined
          ? (Array.isArray(body.assignedCollarIds) ? body.assignedCollarIds.filter((x: any) => x !== 'all') : [])
          : current.assignedCollarIds,
        color: body.color !== undefined ? body.color : current.color,
        active: body.active !== undefined ? Boolean(body.active) : current.active,
        alertOnExit: body.alertOnExit !== undefined ? Boolean(body.alertOnExit) : current.alertOnExit,
      };

      config.data.zones[index] = updated;
      await githubWriteJson(ZONES_CONFIG_PATH, config.data, `chore: modifier la clôture ${updated.name}`);
      try {
        await mirrorZoneToSupabase(supabase, updated);
        return res.status(200).json(mapZone(updated));
      } catch (e: any) {
        return error(res, 500, 'Clôture modifiée dans GitHub mais miroir Supabase impossible.', e?.message || e);
      }
    }

    if (zoneMatch && method === 'DELETE') {
      const id = zoneMatch[1];
      const config = await readZonesConfig();
      const current = config.data.zones.find((z) => z.id === id);
      if (!current) return error(res, 404, 'Clôture introuvable dans la configuration GitHub.', { id });

      await githubWriteJson(
        ZONES_CONFIG_PATH,
        { ...config.data, zones: config.data.zones.filter((z) => z.id !== id) },
        `feat: supprimer la clôture ${current.name}`
      );
      const { error: linksError } = await supabase.from('collar_zones').delete().eq('zone_id', id);
      if (linksError) return error(res, 400, 'GitHub mis à jour mais affectations Supabase impossibles à supprimer.', linksError);
      const { error: dbError } = await supabase.from('zones').delete().eq('id', id);
      if (dbError) return error(res, 400, 'GitHub mis à jour mais suppression Supabase impossible.', dbError);
      return res.status(200).json({ ok: true, success: true, id, github: true, supabase: true });
    }

    // ---------------- ALERTS ----------------
    if (path === 'alerts' && method === 'GET') {
      const { data, error: dbError } = await supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(200);
      if (dbError) return error(res, 500, 'Erreur lecture alertes.', dbError.message);
      return res.status(200).json((data || []).map((a: any) => ({
        id: a.id,
        collarId: a.collar_id,
        zoneId: a.zone_id,
        timestamp: a.created_at,
        lat: a.latitude,
        lng: a.longitude,
        type: a.type === 'zone_exit' ? 'EXIT_ZONE' : a.type.toUpperCase(),
        status: a.acknowledged ? 'RESOLVED' : 'ACTIVE',
        message: a.message,
      })));
    }

    const resolveMatch = path.match(/^alerts\/([^/]+)\/resolve$/);
    if (resolveMatch && method === 'PUT') {
      const id = resolveMatch[1];
      const { data, error: dbError } = await supabase.from('alerts').update({ acknowledged: true, acknowledged_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (dbError) return error(res, 400, 'Impossible de résoudre l’alerte.', dbError.message);
      return res.status(200).json({ success: true, alert: data });
    }

    // ---------------- HISTORY ----------------
    if (path === 'history' && method === 'GET') {
      let q = supabase.from('positions').select('*, collars(*)').order('recorded_at', { ascending: true });
      if (query.collarId && query.collarId !== 'all') q = q.eq('collar_id', query.collarId);
      if (query.startDate) q = q.gte('recorded_at', query.startDate);
      if (query.endDate) q = q.lte('recorded_at', query.endDate);
      const { data, error: dbError } = await q.limit(10000);
      if (dbError) return error(res, 500, 'Erreur lecture historique.', dbError.message);
      return res.status(200).json((data || []).map((p: any) => ({
        id: p.id,
        collarId: p.collar_id,
        sheepName: p.collars?.animal_name || p.collars?.name || '',
        collarNumber: p.collars?.internal_code || '',
        color: p.collars?.color || '#5A6F4E',
        lat: p.latitude,
        lng: p.longitude,
        timestamp: p.recorded_at,
        speedKmH: p.speed ? p.speed * 3.6 : 0,
        battery: p.battery_percent ?? 0,
        inZone: true,
      })));
    }

    // ---------------- PUSH ----------------
    if (path === 'push-order' && method === 'POST') {
      const body = req.body || {};
      const collarIds = Array.isArray(body.collarIds) ? body.collarIds : [];
      const durationMinutes = Number(body.durationMinutes);
      const intervalSeconds = Number(body.intervalSeconds);
      if (!durationMinutes || durationMinutes <= 0) return error(res, 400, 'Durée valide requise en minutes.');
      if (![300, 600, 900, 1800].includes(intervalSeconds)) return error(res, 400, 'Cadence PUSH invalide. Utilisez 5, 10, 15 ou 30 minutes.');

      const configs = await readCollarsConfig();
      const availableIds = new Set(configs.data.collars.map((c) => c.id));
      let targets = collarIds.filter((id: any) => id !== 'all' && availableIds.has(String(id))) as string[];
      if (collarIds.includes('all')) targets = configs.data.collars.map((c) => c.id);
      if (!targets.length) return error(res, 400, 'Aucun collier valide sélectionné pour le PUSH.');

      const expiresAt = new Date(Date.now() + durationMinutes * 60_000).toISOString();
      const payload = {
        type: 'push',
        intervalSeconds,
        durationMinutes,
        expiresAt,
        delivery: 'next_wakeup',
        instruction: 'Au prochain réveil, appliquer la cadence temporaire puis revenir à la cadence standard.',
      };

      const { data: command, error: commandError } = await supabase.from('commands').insert({
        command_type: 'push',
        cadence_seconds: intervalSeconds,
        duration_minutes: durationMinutes,
        target_mode: collarIds.includes('all') ? 'all' : 'selected',
        status: 'pending',
        payload,
      }).select('*').single();
      if (commandError) return error(res, 400, 'Impossible de créer la commande PUSH.', commandError.message);

      const { data: targetCollars, error: targetLookupError } = await supabase
        .from('collars')
        .select('id, imei')
        .in('id', targets);
      if (targetLookupError) return error(res, 400, 'Commande PUSH créée mais les matériels cibles sont introuvables.', targetLookupError);

      const byId = new Map((targetCollars || []).map((row: any) => [row.id, row]));
      const targetRows = targets.map((collarId) => {
        const imei = byId.get(collarId)?.imei || null;
        return {
          command_id: command.id,
          collar_id: collarId,
          status: 'pending',
          delivery_status: 'queued',
          mqtt_topic: imei ? `paturgps/${imei}/command` : null,
          mqtt_payload: { ...payload, collarId, imei },
        };
      });

      const { error: targetError } = await supabase.from('command_targets').insert(targetRows);
      if (targetError) return error(res, 400, 'Commande PUSH créée mais cibles impossibles à enregistrer.', targetError);

      return res.status(200).json({
        ok: true,
        success: true,
        message: `Ordre PUSH mis en file pour ${targets.length} collier(s). Il sera récupéré au prochain réveil.`,
        commandId: command.id,
        targets,
        intervalSeconds,
        durationMinutes,
        expiresAt,
        delivery: 'next_wakeup',
      });
    }

    // Stop = une nouvelle commande, elle aussi récupérée au prochain réveil.
    const pushStopMatch = path.match(/^collars\/([^/]+)\/push$/);
    if (pushStopMatch && method === 'DELETE') {
      const collarId = pushStopMatch[1];
      const { data: command, error: commandError } = await supabase.from('commands').insert({
        command_type: 'stop',
        target_mode: 'selected',
        status: 'pending',
        payload: { type: 'stop_push', delivery: 'next_wakeup' },
      }).select('*').single();
      if (commandError) return error(res, 400, 'Impossible de créer l’ordre d’arrêt PUSH.', commandError.message);
      const { data: targetCollar } = await supabase.from('collars').select('imei').eq('id', collarId).maybeSingle();
      const { error: targetError } = await supabase.from('command_targets').insert({
        command_id: command.id,
        collar_id: collarId,
        status: 'pending',
        delivery_status: 'queued',
        mqtt_topic: targetCollar?.imei ? `paturgps/${targetCollar.imei}/command` : null,
        mqtt_payload: { type: 'stop_push', delivery: 'next_wakeup', collarId, imei: targetCollar?.imei || null },
      });
      if (targetError) return error(res, 400, 'Ordre d’arrêt créé mais cible impossible à enregistrer.', targetError);
      return res.status(200).json({ ok: true, success: true, message: 'Arrêt PUSH mis en file pour le prochain réveil.', commandId: command.id });
    }

    // ---------------- DEVICE / MQTT INGESTION PREPARATION ----------------
    // Le BG95/MQTT pourra poster ici avec l'IMEI. Vercel retrouvera le collier
    // dans Supabase et stockera la télémétrie. Cette route reste volontairement
    // minimale tant que le firmware BG95 n'est pas défini.
    if (path === 'telemetry' && method === 'POST') {
      const body = req.body || {};
      const imei = String(body.imei || '').trim();
      if (!imei) return error(res, 400, 'IMEI requis pour une télémétrie.');

      const { data: collar, error: collarError } = await supabase.from('collars').select('*').eq('imei', imei).maybeSingle();
      if (collarError) return error(res, 400, 'Recherche du collier par IMEI impossible.', collarError);
      if (!collar) return error(res, 404, 'IMEI inconnu dans Supabase.', { imei });

      const lat = Number(body.latitude);
      const lng = Number(body.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return error(res, 400, 'Latitude/longitude invalides.');

      const recordedAt = body.recordedAt || new Date().toISOString();
      const { data: position, error: positionError } = await supabase.from('positions').insert({
        collar_id: collar.id,
        latitude: lat,
        longitude: lng,
        altitude: body.altitude ?? null,
        accuracy: body.accuracy ?? null,
        speed: body.speed ?? null,
        heading: body.heading ?? null,
        battery_percent: body.batteryPercent ?? null,
        signal_strength: body.signalStrength ?? null,
        source: 'mqtt',
        recorded_at: recordedAt,
      }).select('*').single();
      if (positionError) return error(res, 400, 'Impossible de stocker la position MQTT.', positionError);

      await supabase.from('collars').update({
        last_latitude: lat,
        last_longitude: lng,
        last_altitude: body.altitude ?? null,
        last_accuracy: body.accuracy ?? null,
        battery_percent: body.batteryPercent ?? collar.battery_percent,
        signal_strength: body.signalStrength ?? collar.signal_strength,
        last_seen: recordedAt,
      }).eq('id', collar.id);

      return res.status(201).json({ ok: true, collarId: collar.id, imei, positionId: position.id });
    }

    // ---------------- SIMULATION ----------------
    if (path === 'simulation/trigger-out-of-zone' && method === 'POST') {
      const body = req.body || {};
      const { data: collar } = await supabase.from('collars').select('*').eq('id', body.collarId).single();
      if (!collar) return error(res, 404, 'Collier introuvable.');
      const lat = Number(collar.last_latitude || 42.9637) + 0.012;
      const lng = Number(collar.last_longitude || 0.3829) + 0.012;
      await supabase.from('collars').update({ last_latitude: lat, last_longitude: lng, last_seen: new Date().toISOString() }).eq('id', collar.id);
      const { data: alert } = await supabase.from('alerts').insert({
        collar_id: collar.id,
        type: 'zone_exit',
        severity: 'warning',
        message: `ALERTE DÉCLENCHÉE : ${collar.animal_name || collar.name} a dépassé la zone de sécurité.`,
        latitude: lat,
        longitude: lng,
      }).select('*').single();
      return res.status(200).json({ ok: true, success: true, collar: { id: collar.id, currentLat: lat, currentLng: lng }, alert });
    }

    return error(res, 404, `Route API inconnue : /api/${path}`);
  } catch (e: any) {
    return error(res, 500, 'Erreur serveur Pâtur’GPS V12.', e?.message || e);
  }
}
