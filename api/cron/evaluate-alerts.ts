import webpush from 'web-push';
import { authorizedCron, database, distanceKm, json } from '../_lib.js';

type Fire = { id: string; coordinates: [number, number]; confidence: number; frp?: number; detectedAt: string };

export default async function handler(request: Request) {
  if (!authorizedCron(request)) return json({ error: 'No autorizado' }, 401);
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:alerts@meteo.app';
    if (!publicKey || !privateKey) return json({ error: 'VAPID no configurado' }, 503);
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const feedUrl = process.env.FIRMS_FEED_URL || 'https://aulafy.github.io/meteo/fires.json';
    const feed = await fetch(feedUrl, { cache: 'no-store' }).then((response) => response.json()) as { fires: Fire[] };
    const recentFires = feed.fires.filter((fire) => fire.confidence >= 70 && Date.now() - new Date(fire.detectedAt).getTime() <= 12 * 3600000);
    const db = database();
    const { data: subscriptions, error } = await db.from('push_subscriptions').select('*').eq('active', true).gte('last_seen_at', new Date(Date.now() - 180 * 86400000).toISOString());
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
      } catch (pushError: any) {
        if (pushError?.statusCode === 404 || pushError?.statusCode === 410) await db.from('push_subscriptions').update({ active: false }).eq('id', subscription.id);
      }
    }
    return json({ ok: true, evaluated: subscriptions?.length ?? 0, fires: recentFires.length, sent });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error interno' }, 500);
  }
}
