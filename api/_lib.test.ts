import { beforeEach, describe, expect, it } from 'vitest';
import { type ApiRequest, type ApiResponse, enforceRateLimit, json, resetRateLimitStateForTests } from './_lib.js';

function responseDouble() {
  const headers = new Map<string, string>();
  let statusCode = 0;
  let body: unknown;
  const response: ApiResponse = {
    status(code) { statusCode = code; return response; },
    setHeader(name, value) { headers.set(name, value); return response; },
    json(data) { body = data; },
  };
  return { response, headers, get statusCode() { return statusCode; }, get body() { return body; } };
}

const request = (ip: string): ApiRequest => ({ method: 'POST', headers: { 'x-vercel-forwarded-for': ip } });

describe('protecciones comunes de API', () => {
  beforeEach(() => resetRateLimitStateForTests());

  it('bloquea al superar el límite sin afectar a otras IP', () => {
    const first = responseDouble();
    const second = responseDouble();
    const blocked = responseDouble();
    const otherIp = responseDouble();

    expect(enforceRateLimit(request('203.0.113.4'), first.response, { namespace: 'test', limit: 2, windowMs: 60_000, now: 1_000 })).toBe(true);
    expect(enforceRateLimit(request('203.0.113.4'), second.response, { namespace: 'test', limit: 2, windowMs: 60_000, now: 1_001 })).toBe(true);
    expect(enforceRateLimit(request('203.0.113.4'), blocked.response, { namespace: 'test', limit: 2, windowMs: 60_000, now: 1_002 })).toBe(false);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    expect(enforceRateLimit(request('203.0.113.5'), otherIp.response, { namespace: 'test', limit: 2, windowMs: 60_000, now: 1_002 })).toBe(true);
  });

  it('permite controlar la caché sin cambiar el valor seguro por defecto', () => {
    const uncached = responseDouble();
    const cached = responseDouble();
    json(uncached.response, { ok: true });
    json(cached.response, { ok: true }, 200, 'public, s-maxage=60');
    expect(uncached.headers.get('Cache-Control')).toBe('no-store');
    expect(cached.headers.get('Cache-Control')).toBe('public, s-maxage=60');
  });
});
