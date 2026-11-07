import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Place, StoredPlace } from '../types/place';

/**
 * Android refuses to read a single AsyncStorage value above ~2 MB ("Row too big to fit
 * into CursorWindow"), so the collection is split across several keys:
 *
 *   flavorly:places:v2:index  -> { version, chunks, count }  (tiny)
 *   flavorly:places:v2:0 …    -> { places: [...] }           (one chunk each)
 *
 * A chunk holds CHUNK_SIZE places (~73 KB of JSON), leaving plenty of headroom.
 */
const INDEX_KEY = 'flavorly:places:v2:index';
const CHUNK_PREFIX = 'flavorly:places:v2:';

/** Written by earlier versions as one big value; migrated on first read. */
const LEGACY_KEY = 'flavorly:places:v1';

/** ~73 KB of JSON per chunk — comfortably below the Android per-value limit. */
const CHUNK_SIZE = 250;

/** Searches arriving closer together than this are written to disk in one go. */
const PERSIST_DELAY_MS = 500;

export type PlaceSeed = Omit<Place, 'distanceMeters'>;

type IndexPayload = { version: 2; chunks: number; count: number };

/**
 * The collection lives in memory and is the single source of truth; AsyncStorage only
 * holds a snapshot of it. Merges mutate the in-memory map synchronously (JavaScript is
 * single threaded, so there is no read-modify-write race), and the write to disk is
 * coalesced and queued afterwards.
 */
let cache: Map<string, StoredPlace> | null = null;
let loadPromise: Promise<Map<string, StoredPlace>> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let dirty = false;

/** Serialized chunk payloads last written, so only changed chunks are rewritten. */
let writtenChunks: string[] = [];

function isStoredPlace(value: unknown): value is StoredPlace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const place = value as Partial<StoredPlace>;

  return (
    typeof place.id === 'string' &&
    typeof place.name === 'string' &&
    typeof place.latitude === 'number' &&
    typeof place.longitude === 'number' &&
    (place.source === 'google' || place.source === 'osm' || place.source === 'backend')
  );
}

function chunkKey(index: number): string {
  return `${CHUNK_PREFIX}${index}`;
}

function toMap(places: unknown[]): Map<string, StoredPlace> {
  return new Map(places.filter(isStoredPlace).map((place) => [place.id, place]));
}

/** Reads the sharded store, migrating an older single-value store on the way. */
async function readFromDisk(): Promise<Map<string, StoredPlace>> {
  try {
    const rawIndex = await AsyncStorage.getItem(INDEX_KEY);
    if (rawIndex) {
      const index = JSON.parse(rawIndex) as Partial<IndexPayload>;
      const count = typeof index.chunks === 'number' ? index.chunks : 0;
      const keys = Array.from({ length: count }, (_, position) => chunkKey(position));
      const values = await AsyncStorage.multiGet(keys);

      const places: unknown[] = [];
      for (const [, value] of values) {
        if (!value) {
          continue;
        }
        const payload = JSON.parse(value) as { places?: unknown };
        if (Array.isArray(payload.places)) {
          places.push(...payload.places);
        }
      }

      writtenChunks = values.map(([, value]) => value ?? '');
      return toMap(places);
    }

    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (!legacy) {
      return new Map();
    }

    const payload = JSON.parse(legacy) as { places?: unknown };
    if (!Array.isArray(payload.places)) {
      return new Map();
    }

    // Migrate: the next flush writes the shards and drops the oversized value.
    const migrated = toMap(payload.places);
    dirty = true;
    void AsyncStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    // A corrupt or unreadable store should never break the app; start over instead.
    return new Map();
  }
}

/** Reads the store from disk at most once per session. */
function getCache(): Promise<Map<string, StoredPlace>> {
  if (cache) {
    return Promise.resolve(cache);
  }
  if (!loadPromise) {
    loadPromise = readFromDisk().then((map) => {
      cache = map;
      return map;
    });
  }
  return loadPromise;
}

function schedulePersist(): void {
  dirty = true;
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushStoredPlaces();
  }, PERSIST_DELAY_MS);
}

function buildChunks(places: StoredPlace[]): string[] {
  const chunks: string[] = [];

  for (let offset = 0; offset < places.length; offset += CHUNK_SIZE) {
    chunks.push(JSON.stringify({ places: places.slice(offset, offset + CHUNK_SIZE) }));
  }

  return chunks;
}

/**
 * Writes the current in-memory collection to disk, touching only the chunks that
 * actually changed. Safe to call at any time.
 */
export async function flushStoredPlaces(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!dirty || !cache) {
    return;
  }

  dirty = false;
  const values = [...cache.values()];
  const chunks = buildChunks(values);
  const index: IndexPayload = { version: 2, chunks: chunks.length, count: values.length };

  writeChain = writeChain
    .then(async () => {
      const writes: [string, string][] = [];

      chunks.forEach((payload, position) => {
        if (writtenChunks[position] !== payload) {
          writes.push([chunkKey(position), payload]);
        }
      });

      const staleKeys = writtenChunks
        .map((_, position) => position)
        .filter((position) => position >= chunks.length)
        .map(chunkKey);

      if (writes.length > 0) {
        await AsyncStorage.multiSet(writes);
      }
      if (staleKeys.length > 0) {
        await AsyncStorage.multiRemove(staleKeys);
      }
      await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));

      writtenChunks = chunks;
    })
    .catch((caught: unknown) => {
      // Retry on the next flush instead of losing the batch.
      dirty = true;
      if (__DEV__) {
        const bytes = chunks.reduce((total, chunk) => total + chunk.length, 0);
        console.warn(
          `[placeStore] could not persist ${values.length} places across ${chunks.length} chunks`,
          `(${Math.round(bytes / 1024)} KB):`,
          caught,
        );
      }
    });

  await writeChain;
}

export function toSeed(place: Place): PlaceSeed {
  const { distanceMeters: _distance, ...seed } = place;
  return seed;
}

/** A snapshot of everything this device has seen. */
export async function loadStoredPlaces(): Promise<StoredPlace[]> {
  const map = await getCache();
  return [...map.values()];
}

/**
 * Upserts freshly fetched places into the in-memory collection and schedules one write
 * to disk once the burst of merges settles. Re-searching an area refreshes
 * ratings/details instead of duplicating rows, and older places are kept.
 */
export async function mergeStoredPlaces(incoming: PlaceSeed[]): Promise<StoredPlace[]> {
  const map = await getCache();
  const seenAt = Date.now();

  for (const place of incoming) {
    map.set(place.id, { ...place, seenAt });
  }

  schedulePersist();

  return [...map.values()];
}

/** Replaces the whole collection (used by backup import) and writes it immediately. */
export async function replaceStoredPlaces(places: StoredPlace[]): Promise<number> {
  await getCache();
  cache = new Map(places.filter(isStoredPlace).map((place) => [place.id, place]));
  // Force a full rewrite: the on-disk chunks may not match what this session last wrote.
  writtenChunks = [];
  dirty = true;
  await flushStoredPlaces();
  return cache.size;
}

/** The collection as one JSON value — the format the developer export uses. */
export async function serializeStoredPlaces(): Promise<string> {
  const places = await loadStoredPlaces();
  return JSON.stringify({ version: 2, places });
}

export async function estimateStoredPlacesBytes(): Promise<number> {
  const places = await loadStoredPlaces();
  return buildChunks(places).reduce((total, chunk) => total + chunk.length, 0);
}

/** Every chunk key currently referenced by the on-disk index (plus the legacy value). */
async function chunkKeysOnDisk(): Promise<string[]> {
  try {
    const rawIndex = await AsyncStorage.getItem(INDEX_KEY);
    const index = rawIndex ? (JSON.parse(rawIndex) as Partial<IndexPayload>) : {};
    const count = Math.max(typeof index.chunks === 'number' ? index.chunks : 0, writtenChunks.length);
    return Array.from({ length: count }, (_, position) => chunkKey(position));
  } catch {
    return writtenChunks.map((_, position) => chunkKey(position));
  }
}

export async function clearStoredPlaces(): Promise<void> {
  await getCache();
  const staleKeys = await chunkKeysOnDisk();
  cache = new Map();
  dirty = false;

  await AsyncStorage.multiRemove([...staleKeys, INDEX_KEY, LEGACY_KEY]).catch(() => undefined);
  writtenChunks = [];
}
