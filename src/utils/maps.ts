import { Linking } from 'react-native';

import type { Place } from '../types/place';

/** Google's place id is stored as `google/<id>` — the key to a venue's Maps page. */
function googlePlaceId(place: Place): string | undefined {
  return place.id.startsWith('google/') ? place.id.slice('google/'.length) : undefined;
}

/**
 * A Google Maps search URL. With `query_place_id` it opens the venue's own page in the
 * Google Maps app (details, photos, reviews) instead of a bare pin, and it starts no
 * navigation. Without a place id (OpenStreetMap) it falls back to the coordinates.
 */
function mapsUrl(place: Place): string {
  const placeId = googlePlaceId(place);
  const query = placeId ? encodeURIComponent(place.name) : `${place.latitude},${place.longitude}`;
  const placeParam = placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : '';

  return `https://www.google.com/maps/search/?api=1&query=${query}${placeParam}`;
}

function directionsUrl(place: Place): string {
  const placeId = googlePlaceId(place);
  const destination = `${place.latitude},${place.longitude}`;
  const placeParam = placeId ? `&destination_place_id=${encodeURIComponent(placeId)}` : '';

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}${placeParam}`;
}

/**
 * Opens the place in Google Maps. Android and iOS hand the https link to the installed
 * Google Maps app; without it, the Google Maps site opens with the same place page.
 */
export async function openInMaps(place: Place): Promise<void> {
  await Linking.openURL(mapsUrl(place)).catch(() => undefined);
}

export async function openDirections(place: Place): Promise<void> {
  await Linking.openURL(directionsUrl(place)).catch(() => undefined);
}
