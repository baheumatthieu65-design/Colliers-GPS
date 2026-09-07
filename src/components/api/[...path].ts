import { createClient } from '@supabase/supabase-js';

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

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function cors(res: AnyRes) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getPath(req: AnyReq) {
  const url = new URL(req.url || 'http://localhost/api');
  return url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
}

function getQuery(req: AnyReq) {
  const url = new URL(req.url || 'http://localhost/api');
  return Object.fromEntries(url.searchParams.entries());
}

function signalQuality(signal: number | null | undefined) {
  if (signal == null) return 'Inconnu';
  if (signal >= 75) return 'Excellent';
  if (signal >= 50) return 'Bon';
  if (signal >= 25) return 'Moyen';
  return 'Faible';
}

function mapCollar(row: any, assignedZoneId?: string | null) {
  return {
    id: row.id,
    sheepName: row.animal_name || row.name,
    collarNumber: row.internal_code,
    color: row.color || '#5A6F4E',
    batteryLevel: row.battery_percent ?? 100,
    signalQuality: signalQuality(row.signal_strength),
    lastUpdate: row.last_seen || row.updated_at || row.created_at,
    currentLat: row.last_latitude,
    currentLng: row.last_longitude,
    status: row.status === 'inactive' ? 'offline' : 'inside_zone',
    activeZoneId: assignedZoneId || undefined,
    pushMode: row.push_mode || {
      active: false,
      intervalSeconds: 1800,
      expiresAt: null,
      durationMinutes: 0,
    },
    imei: row.imei || undefined,
    iccid: row.iccid || undefined,
    simPhone: row.sim_phone || undefined,
    mode: row.mode,
  };
}

function mapZone(row: any, assignedCollarIds: string[] = []) {
  return {
    id: row.id,
    name: row.name,
    description: row.notes || '',
    centerLat: row.center_latitude,
    centerLng: row.center_longitude,
    radiusMeters: row.radius_meters || 500,
    polygonCoords: row.polygon_coords || undefined,
    assignedCollarIds,
    color: row.color || '#5A6F4E',
    active: row.enabled,
    alertOnExit: true,
  };
}

function error(res: AnyRes, status: number, message: string, details?: any) {
  console.error(message, details || '');
  return res.status(status).json({ error: message, details });
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
    // Health check
    if (path === 'health' && method === 'GET') {
      const { error: dbError } = await supabase.from('collars').select('id').limit(1);
      if (dbError) return error(res, 500, 'Supabase inaccessible.', dbError.message);
      return res.status(200).json({ ok: true, service: 'patur-gps-api' });
    }

    // ---------------- COLLARS ----------------
    if (path === 'collars' && method === 'GET') {
      const { data, error: dbError } = await supabase
        .from('collars')
        .select('*')
        .order('created_at', { ascending: true });

      if (dbError) return error(res, 500, 'Erreur lecture colliers.', dbError.message);

      const ids = (data || []).map((c: any) => c.id);
      const { data: links } = ids.length
        ? await supabase.from('collar_zones').select('collar_id,zone_id').in('collar_id', ids)
        : { data: [] };

      const zoneByCollar = new Map<string, string>();
      (links || []).forEach((x: any) => zoneByCollar.set(x.collar_id, x.zone_id));

      return res.status(200).json((data || []).map((c: any) => mapCollar(c, zoneByCollar.get(c.id))));
    }

    if (path === 'collars' && method === 'POST') {
      const body = req.body || {};
      if (!body.sheepName || !body.collarNumber) {
        return error(res, 400, 'Nom de brebis et numéro de collier requis.');
      }

      const row = {
        name: body.sheepName,
        internal_code: body.collarNumber,
        animal_name: body.sheepName,
        animal_number: body.animalNumber || null,
        imei: body.imei || null,
        iccid: body.iccid || null,
        sim_phone: body.simPhone || null,
        mode: body.mode === 'real' ? 'real' : 'simulation',
        status: body.status || 'active',
        color: body.color || '#10B981',
        battery_percent: body.batteryLevel ?? 100,
        signal_strength: body.signalStrength ?? null,
        last_latitude: body.currentLat ?? null,
        last_longitude: body.currentLng ?? null,
        last_seen: new Date().toISOString(),
        notes: body.notes || null,
      };

      const { data, error: dbError } = await supabase
        .from('collars')
        .insert(row)
        .select('*')
        .single();

      if (dbError) return error(res, 400, 'Impossible de créer le collier.', dbError.message);

      if (body.activeZoneId) {
        await supabase.from('collar_zones').upsert({
          collar_id: data.id,
          zone_id: body.activeZoneId,
          enabled: true,
        });
      }

      return res.status(201).json(mapCollar(data, body.activeZoneId));
    }

    const collarMatch = path.match(/^collars\/([^/]+)$/);
    if (collarMatch && method === 'PUT') {
      const id = collarMatch[1];
      const body = req.body || {};

      const updates: any = {};
      if (body.sheepName !== undefined) {
        updates.name = body.sheepName;
        updates.animal_name = body.sheepName;
      }
      if (body.collarNumber !== undefined) updates.internal_code = body.collarNumber;
      if (body.animalNumber !== undefined) updates.animal_number = body.animalNumber;
      if (body.imei !== undefined) updates.imei = body.imei || null;
      if (body.iccid !== undefined) updates.iccid = body.iccid || null;
      if (body.simPhone !== undefined) updates.sim_phone = body.simPhone || null;
      if (body.color !== undefined) updates.color = body.color;
      if (body.mode !== undefined) updates.mode = body.mode;
      if (body.status !== undefined) updates.status = body.status;
      if (body.notes !== undefined) updates.notes = body.notes;

      const { data, error: dbError } = await supabase
        .from('collars')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (dbError) return error(res, 400, 'Impossible de modifier le collier.', dbError.message);

      if (body.activeZoneId !== undefined) {
        await supabase.from('collar_zones').delete().eq('collar_id', id);
        if (body.activeZoneId) {
          await supabase.from('collar_zones').insert({
            collar_id: id,
            zone_id: body.activeZoneId,
            enabled: true,
          });
        }
      }

      return res.status(200).json(mapCollar(data, body.activeZoneId));
    }

    if (collarMatch && method === 'DELETE') {
      const id = collarMatch[1];

      // Supprimer d'abord les affectations aux zones pour éviter
      // une erreur de contrainte FK sur collar_zones.
      const { error: linksError } = await supabase
        .from('collar_zones')
        .delete()
        .eq('collar_id', id);

      if (linksError) {
        return error(res, 400, 'Impossible de supprimer les affectations du collier.', linksError.message);
      }

      const { error: dbError } = await supabase
        .from('collars')
        .delete()
        .eq('id', id);

      if (dbError) return error(res, 400, 'Impossible de supprimer le collier.', dbError.message);
      return res.status(200).json({ success: true, id });
    }

    // ---------------- ZONES ----------------
    if (path === 'zones' && method === 'GET') {
      const { data, error: dbError } = await supabase
        .from('zones')
        .select('*')
        .order('created_at', { ascending: true });

      if (dbError) return error(res, 500, 'Erreur lecture zones.', dbError.message);

      const ids = (data || []).map((z: any) => z.id);
      const { data: links } = ids.length
        ? await supabase.from('collar_zones').select('collar_id,zone_id').in('zone_id', ids)
        : { data: [] };

      const collarIdsByZone = new Map<string, string[]>();
      (links || []).forEach((x: any) => {
        const list = collarIdsByZone.get(x.zone_id) || [];
        list.push(x.collar_id);
        collarIdsByZone.set(x.zone_id, list);
      });

      return res.status(200).json(
        (data || []).map((z: any) => mapZone(z, collarIdsByZone.get(z.id) || []))
      );
    }

    if (path === 'zones' && method === 'POST') {
      const body = req.body || {};
      if (!body.name) return error(res, 400, 'Nom de la zone requis.');

      let centerLat = Number(body.centerLat) || null;
      let centerLng = Number(body.centerLng) || null;

      if (Array.isArray(body.polygonCoords) && body.polygonCoords.length) {
        centerLat = body.polygonCoords.reduce((s: number, p: any) => s + Number(p[0]), 0) / body.polygonCoords.length;
        centerLng = body.polygonCoords.reduce((s: number, p: any) => s + Number(p[1]), 0) / body.polygonCoords.length;
      }

      const row = {
        name: body.name,
        type: body.polygonCoords?.length >= 3 ? 'polygon' : 'circle',
        center_latitude: centerLat,
        center_longitude: centerLng,
        radius_meters: Number(body.radiusMeters) || 500,
        polygon_coords: body.polygonCoords || null,
        color: body.color || '#5A6F4E',
        enabled: body.active !== false,
        notes: body.description || '',
      };

      const { data, error: dbError } = await supabase
        .from('zones')
        .insert(row)
        .select('*')
        .single();

      if (dbError) return error(res, 400, 'Impossible de créer la zone.', dbError.message);

      const ids = Array.isArray(body.assignedCollarIds) ? body.assignedCollarIds.filter((x: any) => x !== 'all') : [];
      if (ids.length) {
        await supabase.from('collar_zones').insert(
          ids.map((collarId: string) => ({
            collar_id: collarId,
            zone_id: data.id,
            enabled: true,
          }))
        );
      }

      return res.status(201).json(mapZone(data, body.assignedCollarIds || []));
    }

    const zoneMatch = path.match(/^zones\/([^/]+)$/);
    if (zoneMatch && method === 'PUT') {
      const id = zoneMatch[1];
      const body = req.body || {};
      const updates: any = {};

      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.notes = body.description;
      if (body.color !== undefined) updates.color = body.color;
      if (body.active !== undefined) updates.enabled = body.active;
      if (body.centerLat !== undefined) updates.center_latitude = body.centerLat;
      if (body.centerLng !== undefined) updates.center_longitude = body.centerLng;
      if (body.radiusMeters !== undefined) updates.radius_meters = body.radiusMeters;
      if (body.polygonCoords !== undefined) {
        updates.polygon_coords = body.polygonCoords;
        updates.type = body.polygonCoords?.length >= 3 ? 'polygon' : 'circle';
      }

      const { data, error: dbError } = await supabase
        .from('zones')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (dbError) return error(res, 400, 'Impossible de modifier la zone.', dbError.message);

      if (body.assignedCollarIds !== undefined) {
        await supabase.from('collar_zones').delete().eq('zone_id', id);
        const ids = Array.isArray(body.assignedCollarIds)
          ? body.assignedCollarIds.filter((x: any) => x !== 'all')
          : [];
        if (ids.length) {
          await supabase.from('collar_zones').insert(
            ids.map((collarId: string) => ({
              collar_id: collarId,
              zone_id: id,
              enabled: true,
            }))
          );
        }
      }

      return res.status(200).json(mapZone(data, body.assignedCollarIds || []));
    }

    if (zoneMatch && method === 'DELETE') {
      const id = zoneMatch[1];
      const { error: dbError } = await supabase.from('zones').delete().eq('id', id);
      if (dbError) return error(res, 400, 'Impossible de supprimer la zone.', dbError.message);
      return res.status(200).json({ success: true, id });
    }

    // ---------------- ALERTS ----------------
    if (path === 'alerts' && method === 'GET') {
      const { data, error: dbError } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (dbError) return error(res, 500, 'Erreur lecture alertes.', dbError.message);

      return res.status(200).json(
        (data || []).map((a: any) => ({
          id: a.id,
          collarId: a.collar_id,
          zoneId: a.zone_id,
          timestamp: a.created_at,
          lat: a.latitude,
          lng: a.longitude,
          type: a.type === 'zone_exit' ? 'EXIT_ZONE' : a.type.toUpperCase(),
          status: a.acknowledged ? 'RESOLVED' : 'ACTIVE',
          message: a.message,
        }))
      );
    }

    const resolveMatch = path.match(/^alerts\/([^/]+)\/resolve$/);
    if (resolveMatch && method === 'PUT') {
      const id = resolveMatch[1];
      const { data, error: dbError } = await supabase
        .from('alerts')
        .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (dbError) return error(res, 400, 'Impossible de résoudre l’alerte.', dbError.message);
      return res.status(200).json({ success: true, alert: data });
    }

    // ---------------- HISTORY ----------------
    if (path === 'history' && method === 'GET') {
      const filters: any = {};
      if (query.collarId && query.collarId !== 'all') filters.collar_id = query.collarId;

      let q = supabase.from('positions').select('*, collars(*)').order('recorded_at', { ascending: true });

      if (filters.collar_id) q = q.eq('collar_id', filters.collar_id);
      if (query.startDate) q = q.gte('recorded_at', query.startDate);
      if (query.endDate) q = q.lte('recorded_at', query.endDate);

      const { data, error: dbError } = await q.limit(10000);
      if (dbError) return error(res, 500, 'Erreur lecture historique.', dbError.message);

      return res.status(200).json(
        (data || []).map((p: any) => ({
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
        }))
      );
    }

    // ---------------- PUSH ----------------
    if (path === 'push-order' && method === 'POST') {
      const body = req.body || {};
      const collarIds = Array.isArray(body.collarIds) ? body.collarIds : [];
      const durationMinutes = Number(body.durationMinutes);
      const intervalSeconds = Number(body.intervalSeconds);

      if (!durationMinutes || durationMinutes <= 0) {
        return error(res, 400, 'Durée valide requise en minutes.');
      }

      const { data: command, error: commandError } = await supabase
        .from('commands')
        .insert({
          command_type: 'push',
          cadence_seconds: intervalSeconds || 1800,
          duration_minutes: durationMinutes,
          target_mode: collarIds.includes('all') ? 'all' : 'selected',
          status: 'pending',
          payload: body,
        })
        .select('*')
        .single();

      if (commandError) return error(res, 400, 'Impossible de créer la commande PUSH.', commandError.message);

      let targets: string[] = collarIds;
      if (collarIds.includes('all')) {
        const { data: allCollars } = await supabase.from('collars').select('id');
        targets = (allCollars || []).map((c: any) => c.id);
      }

      if (targets.length) {
        await supabase.from('command_targets').insert(
          targets.map((collarId: string) => ({
            command_id: command.id,
            collar_id: collarId,
            status: 'pending',
          }))
        );
      }

      return res.status(200).json({
        success: true,
        message: `Ordre PUSH créé pour ${targets.length} collier(s) pendant ${durationMinutes} min.`,
        commandId: command.id,
      });
    }

    const pushStopMatch = path.match(/^collars\/([^/]+)\/push$/);
    if (pushStopMatch && method === 'DELETE') {
      return res.status(200).json({ success: true });
    }

    // ---------------- SIMULATION ----------------
    if (path === 'simulation/trigger-out-of-zone' && method === 'POST') {
      const body = req.body || {};
      const { data: collar } = await supabase
        .from('collars')
        .select('*')
        .eq('id', body.collarId)
        .single();

      if (!collar) return error(res, 404, 'Collier introuvable.');

      const lat = Number(collar.last_latitude || 42.9637) + 0.012;
      const lng = Number(collar.last_longitude || 0.3829) + 0.012;

      await supabase.from('collars').update({
        last_latitude: lat,
        last_longitude: lng,
        last_seen: new Date().toISOString(),
      }).eq('id', collar.id);

      const { data: alert } = await supabase.from('alerts').insert({
        collar_id: collar.id,
        type: 'zone_exit',
        severity: 'warning',
        message: `ALERTE DÉCLENCHÉE : ${collar.animal_name || collar.name} a dépassé la zone de sécurité.`,
        latitude: lat,
        longitude: lng,
      }).select('*').single();

      return res.status(200).json({
        success: true,
        collar: mapCollar({ ...collar, last_latitude: lat, last_longitude: lng }),
        alert,
      });
    }

    return error(res, 404, `Route API inconnue : /api/${path}`);
  } catch (e: any) {
    return error(res, 500, 'Erreur serveur Pâtur’GPS.', e?.message || e);
  }
}
