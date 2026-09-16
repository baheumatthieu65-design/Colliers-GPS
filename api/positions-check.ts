/**
 * Pâtur'GPS — point d'entrée pour le Database Webhook Supabase sur
 * `positions` (INSERT).
 *
 * Pourquoi ce fichier existe : le collier GPS LTE (modem BG9x) transmet ses
 * trames via une automatisation externe (Zapier/Make/n8n) qui écrit
 * DIRECTEMENT dans la table Supabase `positions` — sans jamais passer par
 * l'API Vercel. C'est volontaire et ça ne doit pas changer : c'est ce qui
 * alimente l'historique complet utilisé par l'onglet « Parcours ».
 *
 * Le problème que ça posait : la vérification hors-zone / batterie faible
 * (evaluateZoneExit / evaluateBatteryLow) ne tournait que dans le code de
 * l'API (POST /api/telemetry, POST /api/collars/:id/position). Une position
 * insérée directement dans Supabase ne déclenchait donc jamais ces
 * vérifications, et aucune alerte n'était créée.
 *
 * La solution, sans toucher à l'automatisation existante : un troisième
 * Database Webhook Supabase, configuré exactement comme les deux déjà en
 * place (« PaturGPS Alertes » et « PaturGPS Danger »), sur la table
 * `positions` / événement INSERT, qui POST ici. Ce webhook se déclenche au
 * niveau de la base de données, donc peu importe qui a écrit la ligne
 * (l'API, l'automatisation, ou une édition manuelle dans Supabase Studio).
 *
 * Ce endpoint NE RÉ-INSÈRE JAMAIS de position : la ligne existe déjà (c'est
 * elle qui a déclenché le webhook). Il se contente de lancer les mêmes
 * contrôles hors-zone / batterie faible que le reste de l'app, sur cette
 * ligne. S'ils déclenchent une alerte, elle est insérée dans `alerts`, ce
 * qui déclenche à son tour le webhook « PaturGPS Alertes » existant
 * (POST /api/push-alert) et donc la notification Web Push — sans aucun
 * nouveau code de notification à ajouter ici.
 */

import { createClient } from '@supabase/supabase-js';
import { evaluateZoneExit, evaluateBatteryLow } from './_lib/positionChecks';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const out = (res: any, c: number, b: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(c).json(b);
};

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') return out(res, 204, {});
  if (req.method !== 'POST') return out(res, 405, { ok: false, error: 'Méthode non autorisée.' });

  if (!supabaseUrl || !serviceRoleKey) {
    return out(res, 500, { ok: false, error: 'Variables Supabase manquantes sur Vercel.' });
  }

  // Optionnel : si POSITIONS_WEBHOOK_SECRET est défini sur Vercel, ajouter un
  // header HTTP personnalisé dans la configuration du webhook Supabase
  // (Database → Webhooks → HTTP Headers) : x-positions-webhook-secret.
  // Non configuré = pas de vérification (comme pour PUSH_WEBHOOK_SECRET).
  const secret = process.env.POSITIONS_WEBHOOK_SECRET;
  if (secret && req.headers?.['x-positions-webhook-secret'] !== secret) {
    return out(res, 401, { ok: false, error: 'Non autorisé.' });
  }

  try {
    const body = req.body || {};

    // Supabase Database Webhooks envoient { type, table, schema, record, old_record }.
    // On tolère aussi un POST direct de la ligne elle-même (tests manuels).
    if (body.table && body.table !== 'positions') {
      return out(res, 200, { ok: true, ignored: true, reason: 'wrong_table' });
    }
    if (body.type && body.type !== 'INSERT') {
      return out(res, 200, { ok: true, ignored: true, reason: 'wrong_event' });
    }

    const row = body.record || body;
    const collarId = row.collar_id;
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    if (!collarId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return out(res, 200, { ok: true, ignored: true, reason: 'invalid_payload' });
    }
    const recordedAt = row.recorded_at || row.created_at || new Date().toISOString();
    const batteryPercent = row.battery_percent ?? null;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: collar, error: collarError } = await supabase
      .from('collars')
      .select('*')
      .eq('id', collarId)
      .maybeSingle();
    if (collarError) throw new Error(`Lecture du collier impossible : ${collarError.message}`);
    if (!collar) return out(res, 200, { ok: true, ignored: true, reason: 'collar_not_found' });

    // Comme dans ingestPosition() : on garde collars.last_* à jour par
    // cohérence avec le reste de l'app (fallback d'affichage, etc.), mais ce
    // n'est jamais bloquant — la source de vérité pour la position affichée
    // reste la table `positions` elle-même.
    try {
      await supabase.from('collars').update({
        last_latitude: latitude,
        last_longitude: longitude,
        last_altitude: row.altitude ?? null,
        last_accuracy: row.accuracy ?? null,
        battery_percent: batteryPercent ?? collar.battery_percent,
        signal_strength: row.signal_strength ?? collar.signal_strength,
        last_seen: recordedAt,
      }).eq('id', collar.id);
    } catch (updateError: any) {
      console.error('[PaturGPS API] Mise à jour collars.last_* échouée (non bloquant)', updateError?.message || updateError);
    }

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
