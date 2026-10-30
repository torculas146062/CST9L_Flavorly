import { MAX_RECOMMENDATIONS, MIN_RATINGS_FOR_RECOMMENDATIONS } from '../constants/recommend';
import type { RatingMap } from '../storage/ratingStore';
import type { Place } from '../types/place';

export type Recommendation = {
  place: Place;
  /** Filled in by the ranking API; empty while recommendations are placeholders. */
  reason?: string;
};

export type RecommendationResult =
  | { status: 'not-enough-ratings'; ratedCount: number; needed: number }
  | { status: 'ready'; recommendations: Recommendation[]; isPlaceholder: boolean };

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }

  return copy;
}

/**
 * PLACEHOLDER. Real recommendations are meant to come from a ranking API that is not
 * wired up yet, so for now this just returns random places the user has not rated.
 *
 * When the API lands, replace the section below with a request that posts the ratings
 * plus the stored places, and build the rows from the response (set `isPlaceholder`
 * to false and fill `reason` from the API).
 */
export function buildRecommendations(allPlaces: Place[], ratings: RatingMap): RecommendationResult {
  const ratedIds = Object.keys(ratings).filter((id) => allPlaces.some((place) => place.id === id));

  if (ratedIds.length < MIN_RATINGS_FOR_RECOMMENDATIONS) {
    return {
      status: 'not-enough-ratings',
      ratedCount: ratedIds.length,
      needed: MIN_RATINGS_FOR_RECOMMENDATIONS,
    };
  }

  const unrated = allPlaces.filter((place) => !ratings[place.id]);
  const recommendations = shuffled(unrated)
    .slice(0, MAX_RECOMMENDATIONS)
    .map((place) => ({ place }));

  return { status: 'ready', recommendations, isPlaceholder: true };
}
