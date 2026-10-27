import type { Coordinates } from '../types/place';

/** Used until the map reports its real viewport (and on web, where there is no map view). */
export const DEFAULT_MAP_CENTER: Coordinates = { latitude: 3.1478, longitude: 101.6953 };

export const DEFAULT_REGION_DELTA = 0.02;

/** Radius used before the map reports its viewport. */
export const DEFAULT_SEARCH_RADIUS_METERS = 1200;

export const MIN_SEARCH_RADIUS_METERS = 150;

/** Places API (New) rejects a circle larger than 50 km. */
export const MAX_SEARCH_RADIUS_METERS = 50_000;

/** The map only reports a new view once it has been still for this long. */
export const MAP_SETTLE_DELAY_MS = 400;

/** Wait this long after the map settles before querying again. */
export const VIEWPORT_SEARCH_DEBOUNCE_MS = 600;

/** Never run two automatic searches closer together than this. */
export const MIN_SEARCH_INTERVAL_MS = 1500;

/** After a failed search, stop searching automatically for a while. */
export const FAILURE_COOLDOWN_MS = 60_000;

/** Panning/zooming less than this much reuses the previous results. */
export const VIEWPORT_SIMILARITY_THRESHOLD = 0.25;
