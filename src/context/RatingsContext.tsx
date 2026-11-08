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

import { BackendError, deleteRestaurantRating, getMyRatings, saveRestaurantRating } from '../api/backend';
import { useAuth } from './AuthContext';
import type { RatingMap, RatingValue } from '../storage/ratingStore';

type RatingsValue = {
  ratings: RatingMap;
  ratedCount: number;
  ratingsRevision: number;
  ready: boolean;
  loading: boolean;
  savingPlaceId: string | null;
  deletingPlaceId: string | null;
  error: string | null;
  refresh: () => Promise<void>;
  clearError: () => void;
  rate: (placeId: string, value: RatingValue) => Promise<void>;
  clear: (placeId: string) => Promise<void>;
};

const RatingsContext = createContext<RatingsValue | null>(null);

function messageOf(caught: unknown): string {
  return caught instanceof Error ? caught.message : 'Could not load your ratings.';
}

export function RatingsProvider({ children }: { children: ReactNode }) {
  const { user, withAuthenticatedRequest } = useAuth();
  const [ratings, setRatings] = useState<RatingMap>({});
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPlaceId, setSavingPlaceId] = useState<string | null>(null);
  const [deletingPlaceId, setDeletingPlaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ratingsRevision, setRatingsRevision] = useState(0);

  const isMounted = useRef(true);
  const revision = useRef(0);
  const loadSequence = useRef(0);
  const operationInProgress = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      loadSequence.current += 1;
    };
  }, []);

  const loadHistory = useCallback(
    async (showLoading: boolean): Promise<boolean> => {
      if (!userId) {
        return false;
      }

      const currentRevision = revision.current;
      const sequence = ++loadSequence.current;
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await withAuthenticatedRequest((token) => getMyRatings(token));
        if (
          !isMounted.current ||
          userId !== user.id ||
          sequence !== loadSequence.current ||
          currentRevision !== revision.current
        ) {
          return false;
        }

        const nextRatings: RatingMap = {};
        for (const item of response.ratings) {
          if (
            typeof item.restaurant_id !== 'string' ||
            !Number.isInteger(item.rating) ||
            item.rating < 1 ||
            item.rating > 5
          ) {
            continue;
          }
          const parsedDate = Date.parse(item.rated_at);
          nextRatings[item.restaurant_id] = {
            value: item.rating as RatingValue,
            ratedAt: Number.isNaN(parsedDate) ? 0 : parsedDate,
          };
        }
        setRatings(nextRatings);
        return true;
      } catch (caught) {
        if (
          isMounted.current &&
          userId === user.id &&
          sequence === loadSequence.current &&
          currentRevision === revision.current
        ) {
          setError(messageOf(caught));
        }
        throw caught;
      } finally {
        if (showLoading && isMounted.current && sequence === loadSequence.current) {
          setLoading(false);
        }
        if (isMounted.current) {
          setReady(true);
        }
      }
    },
    [userId, user?.id, withAuthenticatedRequest],
  );

  const refresh = useCallback(async () => {
    await loadHistory(true);
  }, [loadHistory]);

  useEffect(() => {
    void loadHistory(true).catch(() => undefined);
  }, [loadHistory]);

  const rate = useCallback(
    async (placeId: string, value: RatingValue) => {
      if (!placeId || operationInProgress.current) {
        return;
      }
      operationInProgress.current = true;
      setSavingPlaceId(placeId);
      setError(null);
      try {
        const response = await withAuthenticatedRequest((token) =>
          saveRestaurantRating(token, placeId, value),
        );
        if (!isMounted.current || userId !== user?.id) {
          return;
        }
        revision.current += 1;
        setRatingsRevision((current) => current + 1);
        setRatings((current) => ({
          ...current,
          [placeId]: { value: response.rating as RatingValue, ratedAt: Date.now() },
        }));
        try {
          await loadHistory(false);
        } catch {
          if (isMounted.current) {
            setError('Rating saved, but your rating history could not be refreshed. Try refreshing.');
          }
        }
      } catch (caught) {
        if (isMounted.current && userId === user?.id) {
          setError(messageOf(caught));
        }
        throw caught;
      } finally {
        operationInProgress.current = false;
        if (isMounted.current) {
          setSavingPlaceId(null);
        }
      }
    },
    [loadHistory, user?.id, userId, withAuthenticatedRequest],
  );

  const clear = useCallback(
    async (placeId: string) => {
      if (!placeId || operationInProgress.current) {
        return;
      }
      operationInProgress.current = true;
      setDeletingPlaceId(placeId);
      setError(null);
      try {
        await withAuthenticatedRequest((token) => deleteRestaurantRating(token, placeId));
        if (!isMounted.current || userId !== user?.id) {
          return;
        }
        revision.current += 1;
        setRatingsRevision((current) => current + 1);
        setRatings((current) => {
          const next = { ...current };
          delete next[placeId];
          return next;
        });
        try {
          await loadHistory(false);
        } catch {
          if (isMounted.current) {
            setError('Rating deleted, but your rating history could not be refreshed. Try refreshing.');
          }
        }
      } catch (caught) {
        if (caught instanceof BackendError && caught.status === 404) {
          try {
            await loadHistory(false);
            if (isMounted.current) {
              setError('That rating was already removed. Your rating history has been refreshed.');
            }
            return;
          } catch {
            // The original delete error is more useful if the follow-up refresh also fails.
          }
        }
        if (isMounted.current && userId === user?.id) {
          setError(messageOf(caught));
        }
        throw caught;
      } finally {
        operationInProgress.current = false;
        if (isMounted.current) {
          setDeletingPlaceId(null);
        }
      }
    },
    [loadHistory, user?.id, userId, withAuthenticatedRequest],
  );

  const clearError = useCallback(() => setError(null), []);
  const ratedCount = Object.keys(ratings).length;

  const value = useMemo<RatingsValue>(
    () => ({
      ratings,
      ratedCount,
      ratingsRevision,
      ready,
      loading,
      savingPlaceId,
      deletingPlaceId,
      error,
      refresh,
      clearError,
      rate,
      clear,
    }),
    [ratings, ratedCount, ratingsRevision, ready, loading, savingPlaceId, deletingPlaceId, error, refresh, clearError, rate, clear],
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
