import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { RatingMap, RatingValue } from '../storage/ratingStore';

type RatingsValue = {
  ratings: RatingMap;
  ratedCount: number;
  ready: boolean;
  rate: (placeId: string, value: RatingValue) => void;
  clear: (placeId: string) => void;
};

const RatingsContext = createContext<RatingsValue | null>(null);

export function RatingsProvider({ children }: { children: ReactNode }) {
  const [ratings, setRatings] = useState<RatingMap>({});
  const ready = true;

  const rate = useCallback((placeId: string, value: RatingValue) => {
    setRatings((current) => ({ ...current, [placeId]: { value, ratedAt: Date.now() } }));
  }, []);

  const clear = useCallback((placeId: string) => {
    setRatings((current) => {
      const next = { ...current };
      delete next[placeId];
      return next;
    });
  }, []);

  const value = useMemo<RatingsValue>(
    () => ({ ratings, ratedCount: Object.keys(ratings).length, ready, rate, clear }),
    [ratings, ready, rate, clear],
  );

  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>;
}

export function useRatings(): RatingsValue {
  const value = useContext(RatingsContext);
  if (!value) {
    throw new Error('useRatings must be used inside a RatingsProvider');
  }
  return value;
}
