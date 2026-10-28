import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MapRegion } from '../utils/geo';

const STORAGE_KEY = 'flavorly:map-view:v1';

/** Rapid pans/zooms are coalesced into a single write. */
const PERSIST_DELAY_MS = 500;

let pending: MapRegion | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function isMapRegion(value: unknown): value is MapRegion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const region = value as Partial<MapRegion>;
  const isFinite = (input: unknown): input is number => typeof input === 'number' && Number.isFinite(input);

  return (
    isFinite(region.latitude) &&
    isFinite(region.longitude) &&
    isFinite(region.latitudeDelta) &&
    isFinite(region.longitudeDelta) &&
    region.latitudeDelta > 0 &&
    region.longitudeDelta > 0 &&
    Math.abs(region.latitude) <= 90 &&
    Math.abs(region.longitude) <= 180
  );
}

/** Where the map was left last time, or null on a first run. */
export async function loadMapView(): Promise<MapRegion | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    return isMapRegion(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMapView(region: MapRegion): void {
  pending = region;
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushMapView();
  }, PERSIST_DELAY_MS);
}

export async function flushMapView(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  const region = pending;
  if (!region) {
    return;
  }
  pending = null;

  writeChain = writeChain
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(region)))
    .catch(() => {
      // Keep the newest region so the next flush retries it.
      if (!pending) {
        pending = region;
      }
    });

  await writeChain;
}

export async function clearMapView(): Promise<void> {
  pending = null;
  writeChain = writeChain.then(() => AsyncStorage.removeItem(STORAGE_KEY)).catch(() => undefined);
  await writeChain;
}
