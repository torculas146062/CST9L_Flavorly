import { MAX_SEARCH_RADIUS_METERS } from '../constants/map';
import type { Coordinates, Place, SearchArea } from '../types/place';
import { distanceInMeters } from '../utils/geo';

/** Set in .env — see .env.example. Expo inlines EXPO_PUBLIC_* variables at build time. */
export const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

const NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

/**
 * Nearby Search (New) returns anything that carries one of these types, including
 * hotels and landmarks that merely contain a restaurant, so results are filtered
 * again by primary type below.
 */
const INCLUDED_TYPES = [
  'restaurant',
  'cafe',
  'coffee_shop',
  'coffee_roastery',
  'bar',
  'pub',
  'wine_bar',
  'bakery',
  'dessert_shop',
  'ice_cream_shop',
  'meal_takeaway',
  'meal_delivery',
  'food_court',
  'sandwich_shop',
  'juice_shop',
  'tea_house',
  'breakfast_restaurant',
  'brunch_restaurant',
  'snack_bar',
];

const DINING_PRIMARY_TYPES = new Set([
  ...INCLUDED_TYPES,
  'dessert_restaurant',
  'confectionery',
  'chocolate_shop',
  'candy_store',
  'deli',
  'pizza_delivery',
]);

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.photos',
  'places.websiteUri',
  'places.nationalPhoneNumber',
].join(',');

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  photos?: { name?: string }[];
  websiteUri?: string;
  nationalPhoneNumber?: string;
};

type GoogleNearbyResponse = {
  places?: GooglePlace[];
};

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function isDiningType(primaryType?: string): boolean {
  if (!primaryType) {
    return false;
  }
  return primaryType.endsWith('restaurant') || DINING_PRIMARY_TYPES.has(primaryType);
}

/** Place Photo returns 403 until billing is enabled, so only build a URL when a photo exists. */
function photoUrl(photoName: string | undefined): string | undefined {
  if (!photoName) {
    return undefined;
  }
  const params = `maxWidthPx=800&key=${GOOGLE_PLACES_API_KEY}`;
  return `https://places.googleapis.com/v1/${photoName}/media?${params}`;
}

function toPlace(place: GooglePlace, origin: Coordinates): Place | null {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  const name = place.displayName?.text?.trim();

  if (!name || latitude == null || longitude == null || !isDiningType(place.primaryType)) {
    return null;
  }

  return {
    id: `google/${place.id}`,
    name,
    kindLabel: place.primaryTypeDisplayName?.text ?? 'Dining',
    latitude,
    longitude,
    distanceMeters: distanceInMeters(origin, { latitude, longitude }),
    rating: place.rating,
    ratingCount: place.userRatingCount,
    priceLevel: place.priceLevel ? PRICE_LEVELS[place.priceLevel] : undefined,
    address: place.formattedAddress,
    phone: place.nationalPhoneNumber,
    website: place.websiteUri,
    photoUrl: photoUrl(place.photos?.[0]?.name),
    source: 'google',
  };
}

export type NearbyPlacesOptions = {
  /** Circle to search — usually the current map viewport. */
  area: SearchArea;
  /** Point distances are measured from: the user, or the view centre. */
  origin: Coordinates;
  maxResults?: number;
};

export async function fetchGoogleNearbyPlaces({
  area,
  origin,
  maxResults = 20,
}: NearbyPlacesOptions): Promise<Place[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        includedTypes: INCLUDED_TYPES,
        maxResultCount: maxResults,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          circle: {
            center: { latitude: area.center.latitude, longitude: area.center.longitude },
            radius: Math.min(area.radiusMeters, MAX_SEARCH_RADIUS_METERS),
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Places service responded with ${response.status}`);
    }

    const data = (await response.json()) as GoogleNearbyResponse;
    const places = (data.places ?? [])
      .map((place) => toPlace(place, origin))
      .filter((place): place is Place => place !== null)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    return places;
  } finally {
    clearTimeout(timeout);
  }
}
