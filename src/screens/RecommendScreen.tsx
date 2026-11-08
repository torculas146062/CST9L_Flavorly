import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { BackendError, getRecommendations, type BackendRecommendationsResponse } from '../api/backend';
import { PlaceThumbnail } from '../components/PlaceThumbnail';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import type { Place } from '../types/place';
import { formatCount } from '../utils/format';
import { mapRecommendations } from '../utils/recommend';

type RecommendNavigation = NativeStackNavigationProp<RootStackParamList>;

type RecommendationState = {
  ownerKey: string;
  method: BackendRecommendationsResponse['method'] | null;
  places: Place[];
  loading: boolean;
  error: string | null;
};

type ActiveRequest = {
  id: number;
  key: string;
};

type RecommendationLogContext = {
  currentAccountId: string | null;
  requestAccountId: string | null;
  responseAccountId?: string;
  method?: BackendRecommendationsResponse['method'];
  requestGeneration: number;
  accepted: boolean;
  renderedRestaurantIds?: string[];
};

const EMPTY_PLACES: Place[] = [];

function logRecommendation(event: string, context: RecommendationLogContext) {
  if (__DEV__) {
    console.info(`[recommendations] ${event}`, context);
  }
}

function messageOf(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : 'Could not load recommendations. Check your connection and try again.';
}

export function RecommendScreen() {
  const { allPlaces } = useNearbyPlaces();
  const { ratingsRevision } = useRatings();
  const { user, sessionGeneration, withAuthenticatedRequest } = useAuth();
  const navigation = useNavigation<RecommendNavigation>();
  const userId = user?.id ?? null;
  const ownerKey = userId ? `${userId}:${sessionGeneration}` : '';
  const [state, setState] = useState<RecommendationState>({
    ownerKey,
    method: null,
    places: EMPTY_PLACES,
    loading: Boolean(userId),
    error: null,
  });

  const mounted = useRef(true);
  const focused = useRef(false);
  const currentOwnerKey = useRef(ownerKey);
  const currentUserId = useRef(userId);
  const currentRatingsRevision = useRef(ratingsRevision);
  const currentPlaces = useRef(allPlaces);
  const requestId = useRef(0);
  const activeRequest = useRef<ActiveRequest | null>(null);
  const lastStartedKey = useRef('');
  const focusGeneration = useRef(0);
  const latestResponse = useRef<{
    requestAccountId: string;
    responseAccountId: string;
    method: BackendRecommendationsResponse['method'];
    requestGeneration: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (currentOwnerKey.current !== ownerKey) {
      currentOwnerKey.current = ownerKey;
      requestId.current += 1;
      activeRequest.current = null;
      lastStartedKey.current = '';
      latestResponse.current = null;
      setState({
        ownerKey,
        method: null,
        places: EMPTY_PLACES,
        loading: Boolean(userId),
        error: null,
      });
    }
    currentUserId.current = userId;
    currentRatingsRevision.current = ratingsRevision;
    currentPlaces.current = allPlaces;
  }, [ownerKey, userId, ratingsRevision, allPlaces]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
      activeRequest.current = null;
    };
  }, []);

  const fetchRecommendations = useCallback(
    async (focusId: number, force = false) => {
      const requestUserId = userId;
      const requestOwnerKey = ownerKey;
      if (!requestUserId) {
        setState({
          ownerKey: '',
          method: null,
          places: EMPTY_PLACES,
          loading: false,
          error: null,
        });
        return;
      }

      const requestKey = `${requestOwnerKey}:${ratingsRevision}:${focusId}`;
      if (activeRequest.current?.key === requestKey || (!force && lastStartedKey.current === requestKey)) {
        return;
      }

      const id = ++requestId.current;
      activeRequest.current = { id, key: requestKey };
      lastStartedKey.current = requestKey;
      logRecommendation('request started', {
        currentAccountId: currentUserId.current,
        requestAccountId: requestUserId,
        requestGeneration: id,
        accepted: false,
      });
      setState((current) => ({
        ownerKey: requestOwnerKey,
        method: current.ownerKey === requestOwnerKey ? current.method : null,
        places: current.ownerKey === requestOwnerKey ? current.places : EMPTY_PLACES,
        loading: true,
        error: null,
      }));

      try {
        const response = await withAuthenticatedRequest((token) => getRecommendations(token));
        const requestIsStale =
          !mounted.current ||
          requestId.current !== id ||
          currentOwnerKey.current !== requestOwnerKey ||
          currentUserId.current !== requestUserId ||
          currentRatingsRevision.current !== ratingsRevision;
        const ownerMatches = response.user_id === requestUserId;
        const accepted = !requestIsStale && ownerMatches;
        logRecommendation('response received', {
          currentAccountId: currentUserId.current,
          requestAccountId: requestUserId,
          responseAccountId: response.user_id,
          method: response.method,
          requestGeneration: id,
          accepted,
        });
        if (requestIsStale) {
          return;
        }
        if (!ownerMatches) {
          throw new BackendError('The recommendations response belongs to a different account.');
        }

        latestResponse.current = {
          requestAccountId: requestUserId,
          responseAccountId: response.user_id,
          method: response.method,
          requestGeneration: id,
        };
        setState({
          ownerKey: requestOwnerKey,
          method: response.method,
          places: mapRecommendations(response.recommendations, currentPlaces.current),
          loading: false,
          error: null,
        });
      } catch (caught) {
        logRecommendation('request failed or rejected', {
          currentAccountId: currentUserId.current,
          requestAccountId: requestUserId,
          requestGeneration: id,
          accepted: false,
        });
        if (
          mounted.current &&
          requestId.current === id &&
          currentOwnerKey.current === requestOwnerKey &&
          currentUserId.current === requestUserId &&
          currentRatingsRevision.current === ratingsRevision
        ) {
          setState((current) => ({
            ownerKey: requestOwnerKey,
            method: current.ownerKey === requestOwnerKey ? current.method : null,
            places: current.ownerKey === requestOwnerKey ? current.places : EMPTY_PLACES,
            loading: false,
            error: messageOf(caught),
          }));
        }
      } finally {
        if (activeRequest.current?.id === id) {
          activeRequest.current = null;
        }
      }
    },
    [ownerKey, ratingsRevision, userId, withAuthenticatedRequest],
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const focusId = ++focusGeneration.current;
      void fetchRecommendations(focusId);
      return () => {
        focused.current = false;
      };
    }, [fetchRecommendations]),
  );

  const retry = () => {
    const focusId = focused.current ? focusGeneration.current : ++focusGeneration.current;
    void fetchRecommendations(focusId, true);
  };

  const visibleState =
    state.ownerKey === ownerKey
      ? state
      : {
          ownerKey,
          method: null,
          places: EMPTY_PLACES,
          loading: Boolean(userId),
          error: null,
        };
  useEffect(() => {
    const response = latestResponse.current;
    logRecommendation('rendered recommendations', {
      currentAccountId: userId,
      requestAccountId: response?.requestAccountId ?? null,
      ...(response
        ? {
            responseAccountId: response.responseAccountId,
            method: response.method,
          }
        : {}),
      requestGeneration: response?.requestGeneration ?? requestId.current,
      accepted: Boolean(response && response.requestAccountId === userId),
      renderedRestaurantIds: visibleState.places.map((place) => place.id),
    });
  }, [ownerKey, userId, visibleState.places]);
  const methodLabel =
    visibleState.method === 'knn_personalized'
      ? 'Personalized recommendations'
      : visibleState.method === 'quality_fallback'
        ? 'Quality-based recommendations'
        : 'Recommended for you';

  if (visibleState.loading && visibleState.places.length === 0) {
    return (
      <Screen title="Recommend" subtitle="Recommended for you">
        <ActivityIndicator style={styles.spinner} color={colors.primaryStrong} />
      </Screen>
    );
  }

  if (visibleState.error && visibleState.places.length === 0) {
    return (
      <Screen title="Recommend" subtitle="Recommended for you">
        <View style={styles.message}>
          <Text style={styles.error}>{visibleState.error}</Text>
          <PrimaryButton label="Try again" onPress={retry} />
        </View>
      </Screen>
    );
  }

  if (!visibleState.loading && !visibleState.error && visibleState.places.length === 0) {
    return (
      <Screen title="Recommend" subtitle={methodLabel}>
        <View style={styles.message}>
          <Text style={styles.empty}>There are no recommendations available right now. Try again later.</Text>
          <PrimaryButton label="Refresh" onPress={retry} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Recommend" subtitle={methodLabel}>
      <FlatList
        data={visibleState.places}
        keyExtractor={(place) => place.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={visibleState.loading}
            onRefresh={retry}
            tintColor={colors.primaryStrong}
          />
        }
        ListHeaderComponent={visibleState.error ? <Text style={styles.error}>{visibleState.error}</Text> : undefined}
        renderItem={({ item }) => (
          <RecommendationRow
            place={item}
            onPress={() => navigation.navigate('PlaceDetails', { place: item })}
          />
        )}
      />
    </Screen>
  );
}

function RecommendationRow({ place, onPress }: { place: Place; onPress: () => void }) {
  const meta = [place.kindLabel, place.priceLevel ? '$'.repeat(place.priceLevel) : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <PlaceThumbnail place={place} />
      <View style={styles.rowBody}>
        <Text style={typography.heading} numberOfLines={1}>
          {place.name}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {meta}
        </Text>
        {place.address ? (
          <Text style={typography.caption} numberOfLines={1}>
            {place.address}
          </Text>
        ) : null}
        {place.rating != null ? (
          <Text style={styles.rating}>
            ★ {place.rating.toFixed(1)}
            {place.ratingCount != null ? (
              <Text style={styles.ratingCount}> ({formatCount(place.ratingCount)})</Text>
            ) : null}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginTop: spacing.xl,
  },
  message: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  error: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rating: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  ratingCount: {
    fontWeight: '500',
    color: colors.textMuted,
  },
});
