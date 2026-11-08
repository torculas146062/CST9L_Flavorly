import type { BackendRecommendation } from '../api/backend';
import { toCatalogPlace } from '../api/catalog';
import type { Place } from '../types/place';

/**
 * Adapts one ranked backend result without changing its canonical ID or ranking order.
 * Matching nearby metadata is only an optional source for photos/contact details.
 */
export function toRecommendationPlace(recommendation: BackendRecommendation, cached?: Place): Place {
  const place = toCatalogPlace(recommendation);

  return {
    ...cached,
    ...place,
    id: recommendation.id,
    name: recommendation.name,
    kindLabel: recommendation.kindLabel,
    latitude: recommendation.latitude,
    longitude: recommendation.longitude,
    distanceMeters:
      recommendation.distance_km != null
        ? recommendation.distance_km * 1000
        : cached?.distanceMeters ?? place.distanceMeters,
    rating: recommendation.rating ?? undefined,
    ratingCount: recommendation.ratingCount ?? undefined,
    address: recommendation.address ?? cached?.address,
    phone: cached?.phone,
    website: cached?.website,
    photoUrl: cached?.photoUrl,
    source: 'backend',
    catalogSupported: true,
  };
}

/** The backend response is already ranked; this adapter intentionally preserves order. */
export function mapRecommendations(
  recommendations: BackendRecommendation[],
  cachedPlaces: Place[],
): Place[] {
  const cachedById = new Map(cachedPlaces.map((place) => [place.id, place]));
  return recommendations.map((recommendation) =>
    toRecommendationPlace(recommendation, cachedById.get(recommendation.id)),
  );
}
