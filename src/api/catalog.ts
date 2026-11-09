import { BackendError, getBackendPlaceDetails, type BackendPlace } from './backend';
import type { Place } from '../types/place';

export type CatalogVerification =
  | { status: 'supported'; details: BackendPlace }
  | { status: 'unsupported' };

const verificationCache = new Map<string, CatalogVerification>();
const verificationRequests = new Map<string, Promise<CatalogVerification>>();

export function toCatalogPlace(place: BackendPlace): Place {
  return {
    id: place.id,
    name: place.name,
    kindLabel: place.kindLabel,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceMeters: (place.distance_km ?? 0) * 1000,
    rating: place.rating ?? undefined,
    ratingCount: place.ratingCount ?? undefined,
    address: place.address ?? undefined,
    source: 'backend',
    catalogSupported: true,
  };
}

export function rememberCatalogPlace(place: BackendPlace): void {
  verificationCache.set(place.id, { status: 'supported', details: place });
}

export function getCachedCatalogVerification(placeId: string): CatalogVerification | undefined {
  return verificationCache.get(placeId);
}

export function verifyCatalogPlace(placeId: string): Promise<CatalogVerification> {
  const cached = verificationCache.get(placeId);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = verificationRequests.get(placeId);
  if (pending) {
    return pending;
  }

  const request = getBackendPlaceDetails(placeId)
    .then((details): CatalogVerification => {
      const verified: CatalogVerification = { status: 'supported', details };
      verificationCache.set(placeId, verified);
      return verified;
    })
    .catch((caught: unknown) => {
      if (caught instanceof BackendError && caught.status === 404) {
        const unsupported: CatalogVerification = { status: 'unsupported' };
        verificationCache.set(placeId, unsupported);
        return unsupported;
      }
      throw caught;
    })
    .finally(() => {
      verificationRequests.delete(placeId);
    });

  verificationRequests.set(placeId, request);
  return request;
}
