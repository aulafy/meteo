import webpush from 'web-push';
import { type ApiRequest, type ApiResponse, authorizedCron, database, json } from '../_lib.js';
import { fireObservationRows, parseFirmsFeed } from '../_lib/fires.js';

type AlertCandidate = {
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  fire_id: string;
  distance_km: number;
  detected_at: string;
  confidence: number;
  frp: number | null;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!authorizedCron(request)) return json(response, { error: 'No autorizado' }, 401);
  let stage = 'configuration';
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:alerts@meteo.app';
    if (!publicKey || !privateKey) return json(response, { error: 'VAPID no configurado' }, 503);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    stage = 'firms_feed';
    const feedUrl = process.env.FIRMS_FEED_URL || 'https://aulafy.github.io/meteo/fires.json';
    const feedResponse = await fetch(feedUrl, { cache: 'no-store' });
    if (!feedResponse.ok) throw new Error(`Feed FIRMS ${feedResponse.status}`);
    const feed = parseFirmsFeed(await feedResponse.json());
    const db = database();
    const ingestedAt = new Date().toISOString();
    const rows = fireObservationRows(feed.fires, ingestedAt);
    if (rows.length) {
      stage = 'fire_observations_upsert';
      const { error: ingestionError } = await db.from('fire_observations').upsert(rows, { onConflict: 'source,source_id' });
      if (ingestionError) throw ingestionError;
    }
    stage = 'ingestion_run_insert';
    const { error: runError } = await db.from('ingestion_runs').insert({
      source: 'NASA FIRMS', status: 'ok', item_count: rows.length, source_generated_at: feed.generatedAt,
    });
    if (runError) throw runError;
    const retentionCutoff = new Date(Date.now() - 180 * 86400000).toISOString();
    const deliveryCutoff = new Date(Date.now() - 365 * 86400000).toISOString();
    const fireCutoff = new Date(Date.now() - 30 * 86400000).toISOString();
    const ingestionCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    stage = 'retention_cleanup';
    const [{ error: subscriptionCleanupError }, { error: deliveryCleanupError }, { error: fireCleanupError }, { error: ingestionCleanupError }] = await Promise.all([
      db.from('push_subscriptions').delete().lt('last_seen_at', retentionCutoff),
      db.from('alert_deliveries').delete().lt('created_at', deliveryCutoff),
      db.from('fire_observations').delete().lt('detected_at', fireCutoff),
      db.from('ingestion_runs').delete().lt('created_at', ingestionCutoff),
    ]);
    if (subscriptionCleanupError || deliveryCleanupError || fireCleanupError || ingestionCleanupError) {
      throw subscriptionCleanupError || deliveryCleanupError || fireCleanupError || ingestionCleanupError;
    }
    const observedSince = new Date(Date.now() - 12 * 3600000).toISOString();
    stage = 'alert_candidates_rpc';
    const { data, error } = await db.rpc('pending_alert_candidates', { minimum_confidence: 70, observed_since: observedSince });
    if (error) throw error;
    const candidates = (data ?? []) as AlertCandidate[];
    let sent = 0;
    stage = 'push_delivery';
    for (const candidate of candidates) {
      const deliveryKey = `${candidate.subscription_id}:${candidate.fire_id}`;
      try {
        await webpush.sendNotification({ endpoint: candidate.endpoint, keys: { p256dh: candidate.p256dh, auth: candidate.auth } }, JSON.stringify({ title: 'METEO · Detección cercana', body: `Anomalía térmica a ${candidate.distance_km.toFixed(1)} km. Verifica 112 y Protección Civil.`, fireId: candidate.fire_id, url: '/' }), { TTL: 900, urgency: 'high' });
        const { error: deliveryError } = await db.from('alert_deliveries').insert({ delivery_key: deliveryKey, subscription_id: candidate.subscription_id, fire_id: candidate.fire_id, distance_km: candidate.distance_km, status: 'sent' });
        if (deliveryError) throw deliveryError;
        sent += 1;
      } catch (pushError: unknown) {
        const statusCode = typeof pushError === 'object' && pushError !== null && 'statusCode' in pushError ? Number(pushError.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await db.from('push_subscriptions').update({ active: false }).eq('id', candidate.subscription_id);
      }
    }
    return json(response, { ok: true, ingested: rows.length, candidates: candidates.length, sent });
  } catch (error) {
    const details = typeof error === 'object' && error !== null
      ? {
          message: 'message' in error ? String(error.message) : 'Error sin mensaje',
          code: 'code' in error ? String(error.code) : undefined,
          details: 'details' in error ? String(error.details) : undefined,
          hint: 'hint' in error ? String(error.hint) : undefined,
        }
      : { message: String(error) };
    console.error('evaluate-alerts failed', { stage, ...details });
    return json(response, { error: 'Error interno', stage }, 500);
  }
}
