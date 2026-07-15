import { describe, expect, it, vi } from 'vitest';
import { loadResilientJson, type PublicDataCache } from './public-data-resilience';

const memoryCache = (initial: unknown | null = null): PublicDataCache & { value: unknown | null } => ({
  value: initial,
  async get() { return this.value; },
  async set(_key, value) { this.value = value; },
});

const parseCount = (input: unknown) => {
  if (!input || typeof input !== 'object' || typeof (input as { count?: unknown }).count !== 'number') throw new Error('Respuesta inválida');
  return (input as { count: number }).count;
};

describe('resiliencia de datos públicos', () => {
  it('valida una respuesta en vivo antes de guardarla', async () => {
    const cache = memoryCache();
    const result = await loadResilientJson({ key: 'test', url: 'https://example.test/feed', parse: parseCount, maxCacheAgeMs: 60_000, cache, now: () => 1_000, fetcher: vi.fn(async () => new Response('{"count":3}')) as unknown as typeof fetch });
    expect(result).toMatchObject({ data: 3, mode: 'live', savedAt: 1_000 });
    expect(cache.value).toMatchObject({ version: 1, savedAt: 1_000, payload: { count: 3 } });
  });

  it('usa una copia todavía válida si la respuesta actual es inválida', async () => {
    const cache = memoryCache({ version: 1, savedAt: 900, payload: { count: 2 } });
    const result = await loadResilientJson({ key: 'test', url: 'https://example.test/feed', parse: parseCount, maxCacheAgeMs: 1_000, cache, now: () => 1_000, fetcher: vi.fn(async () => new Response('{"unexpected":true}')) as unknown as typeof fetch });
    expect(result).toMatchObject({ data: 2, mode: 'cache', savedAt: 900 });
  });

  it('aborta una consulta lenta y recupera la copia validada', async () => {
    const cache = memoryCache({ version: 1, savedAt: 900, payload: { count: 4 } });
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Abortado', 'AbortError')));
    })) as unknown as typeof fetch;
    const result = await loadResilientJson({ key: 'test', url: 'https://example.test/feed', parse: parseCount, maxCacheAgeMs: 1_000, timeoutMs: 1, cache, now: () => 1_000, fetcher });
    expect(result.mode).toBe('cache');
    expect(result.data).toBe(4);
  });

  it('rechaza la ausencia temporal cuando no existe copia válida', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(loadResilientJson({ key: 'test', url: 'https://example.test/feed', parse: parseCount, maxCacheAgeMs: 1_000, cache: memoryCache(), now: () => 2_000, fetcher })).rejects.toThrow('copia pública válida');
  });

  it('no muestra una copia caducada', async () => {
    const cache = memoryCache({ version: 1, savedAt: 500, payload: { count: 8 } });
    const fetcher = vi.fn(async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await expect(loadResilientJson({ key: 'test', url: 'https://example.test/feed', parse: parseCount, maxCacheAgeMs: 1_000, cache, now: () => 2_000, fetcher })).rejects.toThrow('copia pública válida');
  });
});
