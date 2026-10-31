import { fetchGoogleNearbyPlaces, GOOGLE_PLACES_API_KEY } from './googlePlaces';
import { fetchOsmNearbyPlaces } from './overpass';
import { hasGoogleReviews, type Coordinates, type Place, type SearchArea } from '../types/place';

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
 *
 * Only places with Google Maps reviews survive: that filter drops every OpenStreetMap
 * result, so without a working Google key a search legitimately returns nothing.
 */
export async function fetchNearbyPlaces({ area, origin }: NearbyPlacesOptions): Promise<Place[]> {
  let places: Place[] = [];

  if (GOOGLE_PLACES_API_KEY) {
    try {
      places = await fetchGoogleNearbyPlaces({ area, origin });
    } catch {
      // fall through to OpenStreetMap
    }
  }

  if (places.length === 0) {
    places = await fetchOsmNearbyPlaces({ area, origin });
  }

  return places.filter(hasGoogleReviews);
}
