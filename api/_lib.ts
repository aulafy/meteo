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

export function json(response: ApiResponse, data: unknown, status = 200) {
  response.setHeader('Cache-Control', 'no-store');
  response.status(status).json(data);
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
