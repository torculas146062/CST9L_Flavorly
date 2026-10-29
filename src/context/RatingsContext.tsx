import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AppState } from 'react-native';

import {
  clearRating as clearRatingInStore,
  flushRatings,
  loadRatings,
  setRating as setRatingInStore,
  type RatingMap,
  type RatingValue,
} from '../storage/ratingStore';

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
  const [ready, setReady] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    void loadRatings().then((stored) => {
      if (isMounted.current) {
        setRatings(stored);
        setReady(true);
      }
    });
  }, []);

  // Writes are debounced, so flush anything pending when the app leaves the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void flushRatings();
      }
    });
    return () => subscription.remove();
  }, []);

  const rate = useCallback((placeId: string, value: RatingValue) => {
    setRatings((current) => ({ ...current, [placeId]: { value, ratedAt: Date.now() } }));
    void setRatingInStore(placeId, value);
  }, []);

  const clear = useCallback((placeId: string) => {
    setRatings((current) => {
      const next = { ...current };
      delete next[placeId];
      return next;
    });
    void clearRatingInStore(placeId);
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
