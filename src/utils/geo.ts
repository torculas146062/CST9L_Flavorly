import {
  MAX_SEARCH_RADIUS_METERS,
  MIN_SEARCH_RADIUS_METERS,
  VIEWPORT_SIMILARITY_THRESHOLD,
} from '../constants/map';
import type { Coordinates, SearchArea } from '../types/place';

export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLon / 2) ** 2;

  return Math.round(2 * earthRadius * Math.asin(Math.sqrt(a)));
}

export type MapRegion = Coordinates & {
  latitudeDelta: number;
  longitudeDelta: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Both the Places API and Overpass search a circle, so the visible rectangle is
 * converted into a circle centred on the view that reaches its far corner.
 */
export function areaFromRegion(region: MapRegion): SearchArea {
  const center: Coordinates = { latitude: region.latitude, longitude: region.longitude };
  const corner: Coordinates = {
    latitude: region.latitude + region.latitudeDelta / 2,
    longitude: region.longitude + region.longitudeDelta / 2,
  };

  return {
    center,
    radiusMeters: clamp(
      distanceInMeters(center, corner),
      MIN_SEARCH_RADIUS_METERS,
      MAX_SEARCH_RADIUS_METERS,
    ),
  };
}

/** True when the new view is close enough that refetching would return the same places. */
export function isSimilarArea(current: SearchArea, next: SearchArea): boolean {
  const movedRatio = distanceInMeters(current.center, next.center) / Math.max(current.radiusMeters, 1);
  const radiusRatio =
    Math.abs(current.radiusMeters - next.radiusMeters) / Math.max(current.radiusMeters, 1);

  return movedRatio < VIEWPORT_SIMILARITY_THRESHOLD && radiusRatio < VIEWPORT_SIMILARITY_THRESHOLD;
}

/** Absorbs float error so a place sitting exactly on the viewport edge is still shown. */
const BOUNDS_EPSILON = 1e-7;

/** True when a place falls inside the visible rectangle of the map. */
export function regionContains(region: MapRegion, point: Coordinates): boolean {
  const halfLatitude = region.latitudeDelta / 2 + BOUNDS_EPSILON;
  if (point.latitude < region.latitude - halfLatitude || point.latitude > region.latitude + halfLatitude) {
    return false;
  }

  if (region.longitudeDelta >= 360) {
    return true;
  }

  // Normalise across the antimeridian so panning past ±180° keeps working.
  let deltaLongitude = point.longitude - region.longitude;
  if (deltaLongitude > 180) {
    deltaLongitude -= 360;
  } else if (deltaLongitude < -180) {
    deltaLongitude += 360;
  }

  return Math.abs(deltaLongitude) <= region.longitudeDelta / 2 + BOUNDS_EPSILON;
}
