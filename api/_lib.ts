import { createClient } from '@supabase/supabase-js';

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Backend no configurado');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export function distanceKm(a: [number, number], b: [number, number]) {
  const radians = Math.PI / 180;
  const deltaLat = (b[1] - a[1]) * radians;
  const deltaLon = (b[0] - a[0]) * radians;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(deltaLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(value));
}
