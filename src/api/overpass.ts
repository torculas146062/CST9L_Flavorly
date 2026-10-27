import {
  DINING_KINDS,
  KIND_LABELS,
  formatCuisine,
  type Coordinates,
  type DiningKind,
  type Place,
  type SearchArea,
} from '../types/place';
import { distanceInMeters } from '../utils/geo';

/**
 * OpenStreetMap via the Overpass API — the free fallback used when the Google
 * Places key is missing or the request fails. No API key, no billing account.
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const ATTEMPT_TIMEOUT_MS = 12_000;

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function buildQuery(searchArea: SearchArea, limit: number): string {
  const area = `(around:${Math.round(searchArea.radiusMeters)},${searchArea.center.latitude},${searchArea.center.longitude})`;
  const match = `["amenity"~"^(${DINING_KINDS.join('|')})$"]${area}`;

  return `[out:json][timeout:25];
(
  node${match};
  way${match};
);
out center ${limit};`;
}

function toPlace(element: OverpassElement, origin: Coordinates): Place | null {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const name = element.tags?.name?.trim();
  const kind = element.tags?.amenity as DiningKind | undefined;

  if (!name || latitude == null || longitude == null || !kind) {
    return null;
  }

  const tags = element.tags ?? {};
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const address = [street, tags['addr:city']].filter(Boolean).join(', ');
  const cuisine = formatCuisine(tags.cuisine);
  const label = KIND_LABELS[kind] ?? 'Dining';

  return {
    id: `osm/${element.type}/${element.id}`,
    name,
    kindLabel: cuisine ? `${cuisine} ${label}` : label,
    latitude,
    longitude,
    distanceMeters: distanceInMeters(origin, { latitude, longitude }),
    address: address || undefined,
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'],
    source: 'osm',
  };
}

/** Keeps the closest entry when the same venue is mapped twice (e.g. node plus building). */
function dedupe(places: Place[]): Place[] {
  const seen = new Set<string>();

  return places.filter((place) => {
    const key = `${place.name.toLowerCase()}@${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export type OsmNearbyPlacesOptions = {
  /** Circle to search — usually the current map viewport. */
  area: SearchArea;
  /** Point distances are measured from: the user, or the view centre. */
  origin: Coordinates;
  limit?: number;
};

export async function fetchOsmNearbyPlaces({
  area,
  origin,
  limit = 100,
}: OsmNearbyPlacesOptions): Promise<Place[]> {
  const body = `data=${encodeURIComponent(buildQuery(area, limit))}`;
  let lastError = new Error('Could not reach the places service. Check your connection and try again.');

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass rejects some default client user agents.
          'User-Agent': 'Flavorly/1.0 (Expo student project)',
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Places service responded with ${response.status}`);
      }

      const data = (await response.json()) as OverpassResponse;
      const places = (data.elements ?? [])
        .map((element) => toPlace(element, origin))
        .filter((place): place is Place => place !== null)
        .sort((a, b) => a.distanceMeters - b.distanceMeters);

      return dedupe(places);
    } catch (caught) {
      lastError =
        caught instanceof Error && caught.name !== 'AbortError'
          ? caught
          : new Error('The places service took too long to respond. Try again in a moment.');
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
