import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  clearStoredPlaces,
  estimateStoredPlacesBytes,
  replaceStoredPlaces,
  serializeStoredPlaces,
} from './placeStore';
import type { StoredPlace } from '../types/place';

/** Keys stored as a single value. Places are sharded — see `placeStore`. */
export const STORAGE_KEYS = {
  auth: 'flavorly:auth:v1',
  mapView: 'flavorly:map-view:v1',
  ratings: 'flavorly:ratings:v1',
} as const;

export type StorageKey = 'places' | keyof typeof STORAGE_KEYS;
export type SingleValueKey = keyof typeof STORAGE_KEYS;

export type StorageSummary = {
  key: StorageKey;
  /** Display only: places span several keys. */
  storageKey: string;
  bytes: number;
};

export type BackupFile = {
  app: 'flavorly';
  version: 1;
  exportedAt: string;
  data: Partial<Record<StorageKey, string>>;
};

const SINGLE_VALUE_KEYS = Object.keys(STORAGE_KEYS) as SingleValueKey[];

/**
 * The places collection is exported as one JSON string (its on-disk format is chunked to
 * stay under Android's per-value limit, but that is an implementation detail).
 */
export async function summarizeStorage(): Promise<StorageSummary[]> {
  const entries = await AsyncStorage.multiGet(Object.values(STORAGE_KEYS));
  const placesBytes = await estimateStoredPlacesBytes();

  return [
    { key: 'places', storageKey: 'chunked (places:v2)', bytes: placesBytes },
    ...SINGLE_VALUE_KEYS.map((key) => {
      const value = entries.find(([storageKey]) => storageKey === STORAGE_KEYS[key])?.[1];
      return { key, storageKey: STORAGE_KEYS[key], bytes: value?.length ?? 0 };
    }),
  ];
}

export async function exportBackup(): Promise<BackupFile> {
  const entries = await AsyncStorage.multiGet(Object.values(STORAGE_KEYS));
  const data: Partial<Record<StorageKey, string>> = {
    places: await serializeStoredPlaces(),
  };

  for (const key of SINGLE_VALUE_KEYS) {
    const value = entries.find(([storageKey]) => storageKey === STORAGE_KEYS[key])?.[1];
    if (value != null) {
      data[key] = value;
    }
  }

  return { app: 'flavorly', version: 1, exportedAt: new Date().toISOString(), data };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export type ImportResult = {
  imported: StorageKey[];
  skipped: StorageKey[];
};

function isValidPlace(value: unknown): value is StoredPlace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const place = value as Partial<StoredPlace>;
  return (
    typeof place.id === 'string' &&
    typeof place.name === 'string' &&
    typeof place.latitude === 'number' &&
    typeof place.longitude === 'number'
  );
}

/**
 * Restores a backup produced by `exportBackup` — from any version of the app. The `app`
 * field is deliberately not checked (exports from before the Flavorly rename are just as
 * valid); only the shape matters. Known keys are read, values must be strings, and places
 * are re-sharded, so a hand-edited or truncated file cannot corrupt the app.
 */
export async function importBackup(json: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('That does not look like JSON.');
  }

  const backup = parsed as Partial<BackupFile> | null;
  if (typeof backup !== 'object' || backup === null) {
    throw new Error('That file does not contain an app export.');
  }

  if (typeof backup.data !== 'object' || backup.data === null) {
    throw new Error('That export has no data section.');
  }

  const imported: StorageKey[] = [];
  const skipped: StorageKey[] = [];
  const pairs: [string, string][] = [];

  const placesValue = backup.data.places;
  if (typeof placesValue === 'string') {
    try {
      const payload = JSON.parse(placesValue) as { places?: unknown };
      const places = Array.isArray(payload.places) ? payload.places : [];
      await replaceStoredPlaces(places.filter((place): place is StoredPlace => isValidPlace(place)));
      imported.push('places');
    } catch {
      skipped.push('places');
    }
  } else if (placesValue !== undefined) {
    skipped.push('places');
  }

  for (const key of SINGLE_VALUE_KEYS) {
    const value = backup.data[key];
    if (typeof value === 'string') {
      pairs.push([STORAGE_KEYS[key], value]);
      imported.push(key);
    } else if (value !== undefined) {
      skipped.push(key);
    }
  }

  if (pairs.length > 0) {
    await AsyncStorage.multiSet(pairs);
  }

  if (imported.length === 0) {
    throw new Error('The export contains no usable entries.');
  }

  return { imported, skipped };
}

export async function clearStorage(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
  await clearStoredPlaces();
}
