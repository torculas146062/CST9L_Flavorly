import { fetchGoogleNearbyPlaces, GOOGLE_PLACES_API_KEY } from './googlePlaces';
import { fetchOsmNearbyPlaces } from './overpass';
import { getNearbyBackendPlaces } from './backend';
import { rememberCatalogPlace, toCatalogPlace } from './catalog';
import { hasGoogleReviews, type Coordinates, type Place, type SearchArea } from '../types/place';
import { distanceInMeters } from '../utils/geo';

export type NearbyPlacesOptions = {
  /** Circle to search — usually the current map viewport. */
  area: SearchArea;
  /** Point distances are measured from: the user, or the view centre. */
  origin: Coordinates;
};

/**
 * The backend catalog supplies rateable restaurants; Google Places enriches discovery
 * with ratings, price level and photos. OpenStreetMap remains a discovery fallback.
 *
 * Google results without reviews and OpenStreetMap results are not included in the
 * returned discovery list. Backend catalog results remain available without Google.
 */
export async function fetchNearbyPlaces({ area, origin }: NearbyPlacesOptions): Promise<Place[]> {
  let catalogPlaces: Place[] = [];
  let googlePlaces: Place[] = [];

  try {
    const result = await getNearbyBackendPlaces(
      area.center.latitude,
      area.center.longitude,
      Math.min(area.radiusMeters / 1000, 100),
      50,
    );
    result.places.forEach(rememberCatalogPlace);
    catalogPlaces = result.places.map((place) => ({
      ...toCatalogPlace(place),
      distanceMeters: distanceInMeters(origin, place),
    }));
  } catch {
    // Keep Google-based discovery available when the backend is offline.
  }

  if (GOOGLE_PLACES_API_KEY) {
    try {
      googlePlaces = await fetchGoogleNearbyPlaces({ area, origin });
    } catch {
      // fall through to OpenStreetMap
    }
  }

  if (googlePlaces.length === 0 && catalogPlaces.length === 0) {
    googlePlaces = await fetchOsmNearbyPlaces({ area, origin });
  }

  const placesById = new Map(catalogPlaces.map((place) => [place.id, place]));
  for (const place of googlePlaces) {
    const catalogPlace = placesById.get(place.id);
    placesById.set(
      place.id,
      catalogPlace
        ? {
            ...catalogPlace,
            ...place,
            kindLabel: place.kindLabel || catalogPlace.kindLabel,
            rating: place.rating ?? catalogPlace.rating,
            ratingCount: place.ratingCount ?? catalogPlace.ratingCount,
            address: place.address ?? catalogPlace.address,
            catalogSupported: true,
          }
        : place,
    );
  }

  return [...placesById.values()].filter(hasGoogleReviews);
}
