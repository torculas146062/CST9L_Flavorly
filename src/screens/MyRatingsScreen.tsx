import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { toCatalogPlace, verifyCatalogPlace } from '../api/catalog';
import { PrimaryButton } from '../components/PrimaryButton';
import { PlaceThumbnail } from '../components/PlaceThumbnail';
import { StarRating } from '../components/StarRating';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatDate, formatDistance, formatPriceLevel } from '../utils/format';
import type { Place } from '../types/place';
import { distanceInMeters } from '../utils/geo';

type MyRatingsNavigation = NativeStackNavigationProp<RootStackParamList>;
type MetadataErrors = Record<string, boolean>;

export function MyRatingsScreen() {
  const { allPlaces, focus, location } = useNearbyPlaces();
  const {
    ratings,
    rate,
    clear,
    ratedCount,
    ready,
    loading,
    savingPlaceId,
    deletingPlaceId,
    error,
    refresh,
    clearError,
  } = useRatings();
  const navigation = useNavigation<MyRatingsNavigation>();
  const [catalogPlaces, setCatalogPlaces] = useState<Record<string, Place>>({});
  const [unsupportedIds, setUnsupportedIds] = useState<Record<string, boolean>>({});
  const [metadataErrors, setMetadataErrors] = useState<MetadataErrors>({});
  const [metadataLoading, setMetadataLoading] = useState(false);
  const attemptedIds = useRef(new Set<string>());

  const placesById = useMemo(() => {
    const places = new Map(allPlaces.map((place) => [place.id, place]));
    for (const [id, place] of Object.entries(catalogPlaces)) {
      if (!places.has(id)) {
        places.set(id, place);
      }
    }
    return places;
  }, [allPlaces, catalogPlaces]);

  useEffect(() => {
    const missingIds = Object.keys(ratings).filter(
      (id) => !placesById.has(id) && !attemptedIds.current.has(id),
    );
    if (missingIds.length === 0) {
      return;
    }

    missingIds.forEach((id) => attemptedIds.current.add(id));
    setMetadataLoading(true);
    setMetadataErrors((current) => {
      const next = { ...current };
      missingIds.forEach((id) => delete next[id]);
      return next;
    });

    let active = true;
    let nextIndex = 0;
    const loaded: Record<string, Place> = {};
    const unsupported: Record<string, boolean> = {};
    const failed: Record<string, boolean> = {};

    const worker = async () => {
      while (active) {
        const index = nextIndex++;
        if (index >= missingIds.length) {
          return;
        }
        const id = missingIds[index];
        try {
          const result = await verifyCatalogPlace(id);
          if (result.status === 'supported') {
            loaded[id] = {
              ...toCatalogPlace(result.details),
              distanceMeters: distanceInMeters(location ?? focus.center, result.details),
            };
          } else {
            unsupported[id] = true;
          }
        } catch {
          failed[id] = true;
        }
      }
    };

    void Promise.all(Array.from({ length: Math.min(3, missingIds.length) }, () => worker())).then(() => {
      if (!active) {
        return;
      }
      setCatalogPlaces((current) => ({ ...current, ...loaded }));
      setUnsupportedIds((current) => ({ ...current, ...unsupported }));
      setMetadataErrors((current) => ({ ...current, ...failed }));
      setMetadataLoading(false);
    });

    return () => {
      active = false;
      setMetadataLoading(false);
    };
  }, [ratings, placesById, focus.center, location]);

  const rows = useMemo(
    () =>
      Object.entries(ratings)
        .map(([id, rating]) => ({
          id,
          rating,
          place: placesById.get(id),
          unsupported: Boolean(unsupportedIds[id]),
          metadataError: Boolean(metadataErrors[id]),
        }))
        .sort((a, b) => b.rating.ratedAt - a.rating.ratedAt),
    [ratings, placesById, unsupportedIds, metadataErrors],
  );

  const average = ratedCount
    ? Object.values(ratings).reduce((total, rating) => total + rating.value, 0) / ratedCount
    : undefined;
  const retryMetadata = () => {
    const failedIds = Object.keys(metadataErrors);
    failedIds.forEach((id) => attemptedIds.current.delete(id));
    setMetadataErrors({});
    setMetadataLoading(failedIds.length > 0);
    setCatalogPlaces((current) => {
      const next = { ...current };
      failedIds.forEach((id) => delete next[id]);
      return next;
    });
  };
  const handleRefresh = () => {
    clearError();
    retryMetadata();
    void refresh().catch(() => undefined);
  };

  if (!ready && loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={styles.spinner} color={colors.primaryStrong} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="star" size={48} color={colors.primaryStrong} />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={typography.heading}>{error ? 'Ratings could not be loaded' : 'No ratings yet'}</Text>
          <Text style={styles.emptyBody}>
            {error ? 'Check your connection and try again.' : 'Rate places you’ve visited.'}
          </Text>
          {error ? (
            <PrimaryButton label="Try again" onPress={handleRefresh} />
          ) : (
            <PrimaryButton
              label="Find places"
              onPress={() =>
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs', params: { screen: 'Explore' } }],
                })
              }
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={typography.heading}>
          {ratedCount} rating{ratedCount === 1 ? '' : 's'}
        </Text>
        {average ? (
          <Text style={styles.average}>
            Your average ★ {average.toFixed(1)}
          </Text>
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={colors.primaryStrong} />
        }
        ListHeaderComponent={
          error || metadataLoading || Object.keys(metadataErrors).length > 0 ? (
            <View style={styles.notice}>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {metadataLoading ? <ActivityIndicator size="small" color={colors.primaryStrong} /> : null}
              {Object.keys(metadataErrors).length > 0 ? (
                <Pressable onPress={retryMetadata}>
                  <Text style={styles.clear}>Some restaurant details could not load. Tap to retry.</Text>
                </Pressable>
              ) : null}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            disabled={!item.place}
            onPress={() => item.place && navigation.navigate('PlaceDetails', { place: item.place })}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {item.place ? (
              <PlaceThumbnail place={item.place} />
            ) : (
              <View style={styles.unknownThumbnail}>
                <Ionicons name="restaurant-outline" size={24} color={colors.textMuted} />
              </View>
            )}

            <View style={styles.rowBody}>
              <Text style={typography.heading} numberOfLines={1}>
                {item.place?.name ??
                  (item.unsupported ? 'Restaurant not found in catalog' : 'Restaurant details unavailable')}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {item.place
                  ? [
                      item.place.kindLabel,
                      formatPriceLevel(item.place.priceLevel),
                      formatDistance(item.place.distanceMeters),
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : item.id}
              </Text>
              <View style={styles.ratingRow}>
                <StarRating
                  value={item.rating.value}
                  onChange={(value) => {
                    clearError();
                    void rate(item.id, value).catch(() => undefined);
                  }}
                  size={18}
                  compact
                  disabled={loading || savingPlaceId !== null || deletingPlaceId !== null}
                />
                <Text style={styles.ratedAt}>{formatDate(item.rating.ratedAt)}</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || savingPlaceId !== null || deletingPlaceId !== null}
                  onPress={() => {
                    clearError();
                    void clear(item.id).catch(() => undefined);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.clear}>{deletingPlaceId === item.id ? 'Deleting…' : 'Clear'}</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  error: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  notice: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  unknownThumbnail: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  average: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
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
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratedAt: {
    fontSize: 11,
    color: colors.textMuted,
  },
  clear: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  emptyBody: {
    ...typography.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  footer: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.md,
  },
});
