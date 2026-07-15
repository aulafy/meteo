export type PublicDataMode = 'loading' | 'live' | 'cache' | 'error';

interface CacheEnvelope {
  version: 1;
  savedAt: number;
  payload: unknown;
}

export interface PublicDataCache {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}

interface ResilientJsonOptions<T> {
  key: string;
  url: string;
  parse: (input: unknown, observedAt: number) => T;
  maxCacheAgeMs: number;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  cache?: PublicDataCache;
  now?: () => number;
}

export interface ResilientJsonResult<T> {
  data: T;
  mode: 'live' | 'cache';
  savedAt: number;
}

const DATABASE_NAME = 'meteo-public-data';
const STORE_NAME = 'feeds';
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la caché pública'));
  });
  return databasePromise;
}

export const browserPublicDataCache: PublicDataCache = {
  async get(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error('No se pudo leer la caché pública'));
    });
  },
  async set(key, value) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo guardar la caché pública'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Se canceló la caché pública'));
    });
  },
};

function parseEnvelope(value: unknown): CacheEnvelope | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CacheEnvelope>;
  if (candidate.version !== 1 || typeof candidate.savedAt !== 'number' || !Number.isFinite(candidate.savedAt) || !('payload' in candidate)) return null;
  return candidate as CacheEnvelope;
}

async function readFallback<T>(options: ResilientJsonOptions<T>, now: number): Promise<ResilientJsonResult<T>> {
  let stored: unknown | null = null;
  try {
    stored = await (options.cache ?? browserPublicDataCache).get(options.key);
  } catch {
    stored = null;
  }
  const envelope = parseEnvelope(stored);
  if (!envelope || envelope.savedAt > now || now - envelope.savedAt > options.maxCacheAgeMs) throw new Error('No hay una copia pública válida');
  return { data: options.parse(envelope.payload, envelope.savedAt), mode: 'cache', savedAt: envelope.savedAt };
}

export async function loadResilientJson<T>(options: ResilientJsonOptions<T>): Promise<ResilientJsonResult<T>> {
  const now = (options.now ?? Date.now)();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  try {
    const response = await (options.fetcher ?? fetch)(options.url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`Fuente pública no disponible (${response.status})`);
    const payload: unknown = await response.json();
    const data = options.parse(payload, now);
    const envelope: CacheEnvelope = { version: 1, savedAt: now, payload };
    try {
      await (options.cache ?? browserPublicDataCache).set(options.key, envelope);
    } catch {
      // La caché mejora la resiliencia, pero su ausencia no invalida un dato en vivo.
    }
    return { data, mode: 'live', savedAt: now };
  } catch {
    return readFallback(options, now);
  } finally {
    clearTimeout(timeout);
  }
}
