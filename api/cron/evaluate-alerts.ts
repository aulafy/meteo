import webpush from 'web-push';
import { type ApiRequest, type ApiResponse, authorizedCron, database, distanceKm, json } from '../_lib.js';

type Fire = { id: string; coordinates: [number, number]; confidence: number; frp?: number; detectedAt: string };

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (!authorizedCron(request)) return json(response, { error: 'No autorizado' }, 401);
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:alerts@meteo.app';
    if (!publicKey || !privateKey) return json(response, { error: 'VAPID no configurado' }, 503);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const feedUrl = process.env.FIRMS_FEED_URL || 'https://aulafy.github.io/meteo/fires.json';
    const feedResponse = await fetch(feedUrl, { cache: 'no-store' });
    if (!feedResponse.ok) throw new Error(`Feed FIRMS ${feedResponse.status}`);
    const feed = await feedResponse.json() as { fires?: Fire[] };
    if (!Array.isArray(feed.fires)) throw new Error('Feed FIRMS inválido');
    const now = Date.now();
    const recentFires = feed.fires.filter((fire) => {
      const detectedAt = new Date(fire.detectedAt).getTime();
      return fire.confidence >= 70 && Number.isFinite(detectedAt) && detectedAt <= now && now - detectedAt <= 12 * 3600000;
    });
    const db = database();
    const retentionCutoff = new Date(Date.now() - 180 * 86400000).toISOString();
    const deliveryCutoff = new Date(Date.now() - 365 * 86400000).toISOString();
    const [{ error: subscriptionCleanupError }, { error: deliveryCleanupError }] = await Promise.all([
      db.from('push_subscriptions').delete().lt('last_seen_at', retentionCutoff),
      db.from('alert_deliveries').delete().lt('created_at', deliveryCutoff),
    ]);
    if (subscriptionCleanupError || deliveryCleanupError) throw subscriptionCleanupError || deliveryCleanupError;
    const { data: subscriptions, error } = await db.from('push_subscriptions').select('*').eq('active', true).gte('last_seen_at', retentionCutoff);
    if (error) throw error;
    let sent = 0;
    for (const subscription of subscriptions ?? []) {
      const nearest = recentFires.map((fire) => ({ fire, km: distanceKm([subscription.longitude, subscription.latitude], fire.coordinates) })).filter(({ km }) => km <= subscription.radius_km).sort((a, b) => a.km - b.km)[0];
      if (!nearest) continue;
      const deliveryKey = `${subscription.id}:${nearest.fire.id}`;
      const { data: existing } = await db.from('alert_deliveries').select('id').eq('delivery_key', deliveryKey).maybeSingle();
      if (existing) continue;
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: 'METEO · Detección cercana', body: `Anomalía térmica a ${nearest.km.toFixed(1)} km. Verifica 112 y Protección Civil.`, fireId: nearest.fire.id, url: '/' }), { TTL: 900, urgency: 'high' });
        await db.from('alert_deliveries').insert({ delivery_key: deliveryKey, subscription_id: subscription.id, fire_id: nearest.fire.id, distance_km: nearest.km, status: 'sent' });
        sent += 1;
      } catch (pushError: unknown) {
        const statusCode = typeof pushError === 'object' && pushError !== null && 'statusCode' in pushError ? Number(pushError.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) await db.from('push_subscriptions').update({ active: false }).eq('id', subscription.id);
      }
    }
    return json(response, { ok: true, evaluated: subscriptions?.length ?? 0, fires: recentFires.length, sent });
  } catch (error) {
    return json(response, { error: error instanceof Error ? error.message : 'Error interno' }, 500);
  }
}
