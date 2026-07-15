import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

type FetchEvent = { request: { method: string; url: string }; respondWith: (response: unknown) => void };

function loadFetchHandler() {
  const listeners = new Map<string, (event: FetchEvent) => void>();
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const self = {
    location: { origin: 'https://meteo.example' },
    addEventListener: (type: string, listener: (event: FetchEvent) => void) => listeners.set(type, listener),
  };
  runInNewContext(source, { self, caches: {}, fetch: vi.fn(), URL, Response, clients: {} });
  const handler = listeners.get('fetch');
  if (!handler) throw new Error('El service worker no registró el manejador fetch');
  return handler;
}

describe('política de caché del service worker', () => {
  it('deja los feeds públicos fuera del service worker para que IndexedDB etiquete el fallback', () => {
    const fetchHandler = loadFetchHandler();
    const respondWith = vi.fn();
    fetchHandler({ request: { method: 'GET', url: 'https://aulafy.github.io/meteo/fires.json' }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
});
