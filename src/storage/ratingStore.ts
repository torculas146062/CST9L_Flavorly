import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'flavorly:ratings:v1';
const PERSIST_DELAY_MS = 500;

export type RatingValue = 1 | 2 | 3 | 4 | 5;

export type Rating = {
  value: RatingValue;
  ratedAt: number;
};

export type RatingMap = Record<string, Rating>;

/**
 * User ratings, keyed by place id. Same memory-first pattern as the other stores: the
 * in-memory map is the source of truth and AsyncStorage gets a debounced snapshot.
 */
let cache: RatingMap | null = null;
let loadPromise: Promise<RatingMap> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let dirty = false;

function isRating(value: unknown): value is Rating {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const rating = value as Partial<Rating>;
  return typeof rating.value === 'number' && rating.value >= 1 && rating.value <= 5;
}

async function readFromDisk(): Promise<RatingMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const payload = JSON.parse(raw) as { ratings?: unknown };
    if (!payload.ratings || typeof payload.ratings !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(payload.ratings as RatingMap).filter(([, rating]) => isRating(rating)),
    );
  } catch {
    return {};
  }
}

async function getCache(): Promise<RatingMap> {
  if (cache) {
    return cache;
  }
  if (!loadPromise) {
    loadPromise = readFromDisk().then((ratings) => {
      cache = ratings;
      return ratings;
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
    void flushRatings();
  }, PERSIST_DELAY_MS);
}

export async function flushRatings(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!dirty || !cache) {
    return;
  }

  dirty = false;
  const payload = JSON.stringify({ version: 1, ratings: cache });

  writeChain = writeChain
    .then(() => AsyncStorage.setItem(STORAGE_KEY, payload))
    .catch(() => {
      dirty = true;
    });

  await writeChain;
}

export async function loadRatings(): Promise<RatingMap> {
  return { ...(await getCache()) };
}

export async function setRating(placeId: string, value: RatingValue): Promise<RatingMap> {
  const map = await getCache();
  map[placeId] = { value, ratedAt: Date.now() };
  schedulePersist();
  return { ...map };
}

export async function clearRating(placeId: string): Promise<RatingMap> {
  const map = await getCache();
  delete map[placeId];
  schedulePersist();
  return { ...map };
}

export async function clearAllRatings(): Promise<RatingMap> {
  await getCache();
  cache = {};
  dirty = true;
  await flushRatings();
  return {};
}
