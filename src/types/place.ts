export const DINING_KINDS = [
  'restaurant',
  'cafe',
  'bar',
  'pub',
  'fast_food',
  'food_court',
  'ice_cream',
  'biergarten',
] as const;

export type DiningKind = (typeof DINING_KINDS)[number];

export const KIND_LABELS: Record<DiningKind, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  bar: 'Bar',
  pub: 'Pub',
  fast_food: 'Fast food',
  food_court: 'Food court',
  ice_cream: 'Ice cream',
  biergarten: 'Beer garden',
};

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type PlaceSource = 'google' | 'osm' | 'backend';

/**
 * What is persisted on the device. `distanceMeters` is left out because it depends on
 * where the user is standing, so it is recalculated from the current origin on read.
 */
export type StoredPlace = Omit<Place, 'distanceMeters'> & {
  /** When this place was last returned by a search — used for eviction. */
  seenAt: number;
};

/** The part of the map being searched: a circle around the current view. */
export type SearchArea = {
  center: Coordinates;
  radiusMeters: number;
};

export type Place = Coordinates & {
  id: string;
  name: string;
  /** Human-readable category, e.g. "Café" or "Malaysian Restaurant". */
  kindLabel: string;
  distanceMeters: number;
  rating?: number;
  ratingCount?: number;
  /** Backend distance for a location-filtered recommendation, when provided. */
  recommendationDistanceKm?: number;
  /** 0–4, matching Google's PRICE_LEVEL_* values. */
  priceLevel?: number;
  address?: string;
  phone?: string;
  website?: string;
  photoUrl?: string;
  source: PlaceSource;
  /** True only when the exact ID was returned by or verified against the backend catalog. */
  catalogSupported?: boolean;
};

/**
 * Catalog places are shown even without public reviews. Google results require reviews;
 * OpenStreetMap results are still excluded from the visible discovery list.
 */
export function hasGoogleReviews(place: Pick<Place, 'source' | 'ratingCount'>): boolean {
  return place.source === 'backend' || (place.source === 'google' && (place.ratingCount ?? 0) > 0);
}

/** OSM cuisine tags are lowercase and sometimes semicolon separated. */
export function formatCuisine(cuisine?: string): string | undefined {
  if (!cuisine) {
    return undefined;
  }

  return cuisine
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(', ');
}
