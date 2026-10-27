import { fetchGoogleNearbyPlaces, GOOGLE_PLACES_API_KEY } from './googlePlaces';
import { fetchOsmNearbyPlaces } from './overpass';
import type { Coordinates, Place, SearchArea } from '../types/place';

export type NearbyPlacesOptions = {
  /** Circle to search — usually the current map viewport. */
  area: SearchArea;
  /** Point distances are measured from: the user, or the view centre. */
  origin: Coordinates;
};

/**
 * Google Places (New) is the primary source because it brings ratings, price level
 * and photos. OpenStreetMap via Overpass stays as the fallback so the app still works
 * without a key, when the key is rate limited, or when the request fails.
 */
export async function fetchNearbyPlaces({ area, origin }: NearbyPlacesOptions): Promise<Place[]> {
  if (GOOGLE_PLACES_API_KEY) {
    try {
      const places = await fetchGoogleNearbyPlaces({ area, origin });
      if (places.length > 0) {
        return places;
      }
    } catch {
      // fall through to OpenStreetMap
    }
  }

  return fetchOsmNearbyPlaces({ area, origin });
}
