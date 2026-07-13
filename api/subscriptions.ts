import { createHash } from 'node:crypto';
import { z } from 'zod';
import { database, json } from './_lib.js';

const subscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(2048),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string().min(20), auth: z.string().min(8) }),
  }),
  latitude: z.number().min(35).max(44),
  longitude: z.number().min(-10).max(5),
  radiusKm: z.number().min(5).max(100).default(25),
  consentVersion: z.literal('2026-07-13'),
});

export default async function handler(request: Request) {
  if (request.method !== 'POST' && request.method !== 'DELETE') return json({ error: 'Método no permitido' }, 405);
  try {
    const db = database();
    if (request.method === 'DELETE') {
      const { endpoint } = z.object({ endpoint: z.string().url() }).parse(await request.json());
      const endpointHash = createHash('sha256').update(endpoint).digest('hex');
      const { error } = await db.from('push_subscriptions').delete().eq('endpoint_hash', endpointHash);
      if (error) throw error;
      return json({ ok: true });
    }
    const input = subscriptionSchema.parse(await request.json());
    const endpointHash = createHash('sha256').update(input.subscription.endpoint).digest('hex');
    const { error } = await db.from('push_subscriptions').upsert({
      endpoint_hash: endpointHash,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      latitude: input.latitude,
      longitude: input.longitude,
      radius_km: input.radiusKm,
      consent_version: input.consentVersion,
      consented_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      active: true,
    }, { onConflict: 'endpoint_hash' });
    if (error) throw error;
    return json({ ok: true }, 201);
  } catch (error) {
    const message = error instanceof z.ZodError ? 'Datos de suscripción inválidos' : error instanceof Error ? error.message : 'Error interno';
    return json({ error: message }, message === 'Backend no configurado' ? 503 : 400);
  }
}
