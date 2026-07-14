import { createClient } from '@supabase/supabase-js';

export type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ApiResponse = {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): ApiResponse;
  json(data: unknown): void;
};

type RateLimitBucket = { count: number; resetAt: number };
type RateLimitOptions = { namespace: string; limit: number; windowMs: number; now?: number };

const rateLimitBuckets = new Map<string, RateLimitBucket>();

// Protección básica por instancia caliente. Debe complementarse con límites
// distribuidos en Vercel antes de una campaña pública de gran escala.

export function json(response: ApiResponse, data: unknown, status = 200, cacheControl = 'no-store') {
  response.setHeader('Cache-Control', cacheControl);
  response.status(status).json(data);
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function clientIp(request: ApiRequest) {
  const forwarded = headerValue(request.headers['x-vercel-forwarded-for'])
    || headerValue(request.headers['x-real-ip'])
    || headerValue(request.headers['x-forwarded-for']);
  return forwarded?.split(',')[0]?.trim().slice(0, 64) || 'unknown';
}

export function enforceRateLimit(request: ApiRequest, response: ApiResponse, options: RateLimitOptions) {
  const now = options.now ?? Date.now();
  const key = `${options.namespace}:${clientIp(request)}`;
  const existing = rateLimitBuckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 1, resetAt: now + options.windowMs }
    : { count: existing.count + 1, resetAt: existing.resetAt };
  rateLimitBuckets.set(key, bucket);

  if (rateLimitBuckets.size > 10_000) {
    for (const [candidateKey, candidate] of rateLimitBuckets) {
      if (candidate.resetAt <= now) rateLimitBuckets.delete(candidateKey);
    }
    while (rateLimitBuckets.size > 10_000) {
      const oldestKey = rateLimitBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      rateLimitBuckets.delete(oldestKey);
    }
  }

  const remaining = Math.max(0, options.limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  response.setHeader('X-RateLimit-Limit', String(options.limit));
  response.setHeader('X-RateLimit-Remaining', String(remaining));
  response.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count <= options.limit) return true;
  response.setHeader('Retry-After', String(resetSeconds));
  json(response, { error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos instantes.' }, 429);
  return false;
}

export function resetRateLimitStateForTests() {
  rateLimitBuckets.clear();
}

export function database() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Backend no configurado');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function authorizedCron(request: ApiRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization;
  return Boolean(secret && authorization === `Bearer ${secret}`);
}

export function distanceKm(a: [number, number], b: [number, number]) {
  const radians = Math.PI / 180;
  const deltaLat = (b[1] - a[1]) * radians;
  const deltaLon = (b[0] - a[0]) * radians;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(a[1] * radians) * Math.cos(b[1] * radians) * Math.sin(deltaLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(value));
}
