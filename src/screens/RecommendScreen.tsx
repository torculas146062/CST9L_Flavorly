import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlaceThumbnail } from '../components/PlaceThumbnail';
import { Screen } from '../components/Screen';
import { MIN_RATINGS_FOR_RECOMMENDATIONS } from '../constants/recommend';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatDistance, formatPriceLevel } from '../utils/format';
import { buildRecommendations, type Recommendation } from '../utils/recommend';

type RecommendNavigation = NativeStackNavigationProp<RootStackParamList>;

export function RecommendScreen() {
  const { allPlaces } = useNearbyPlaces();
  const { ratings, ratedCount, ready } = useRatings();
  const navigation = useNavigation<RecommendNavigation>();

  const result = useMemo(() => buildRecommendations(allPlaces, ratings), [allPlaces, ratings]);

  const openExplore = () => navigation.navigate('MainTabs', { screen: 'Explore' });

  if (!ready) {
    return (
      <Screen title="Recommend" subtitle="Built from your ratings">
        <ActivityIndicator style={styles.spinner} color={colors.primaryStrong} />
      </Screen>
    );
  }

  if (result.status === 'not-enough-ratings') {
    const remaining = Math.max(result.needed - result.ratedCount, 0);
    const progress = Math.min(result.ratedCount / result.needed, 1);

    return (
      <Screen title="Recommend" subtitle="Built from your ratings">
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>
            Rate {remaining} more place{remaining === 1 ? '' : 's'}
          </Text>
          <Text style={styles.progressBody}>
            Recommendations are built from what you think, not from what Google thinks. Open a place from Explore or the
            map, give it a star rating, then come back to this tab.
          </Text>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressMeta}>
            {result.ratedCount} of {result.needed} places rated
          </Text>

          <Pressable onPress={openExplore} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
            <Ionicons name="search" size={16} color={colors.onPrimary} />
            <Text style={styles.buttonText}>Find places to rate</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const { recommendations, isPlaceholder } = result;

  if (recommendations.length === 0) {
    return (
      <Screen title="Recommend" subtitle={`Based on ${ratedCount} ratings`}>
        <Text style={styles.empty}>
          You have rated everything this area has to offer. Pan the map to discover more places.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen title="Recommend" subtitle={`Based on ${ratedCount} ratings`}>
      <FlatList
        data={recommendations}
        keyExtractor={(item) => item.place.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <Text style={styles.footer}>
            {isPlaceholder
              ? 'Placeholder picks — the ranking service is not wired up yet, so these are random unrated places.'
              : `Built from ${ratedCount} rating${ratedCount === 1 ? '' : 's'}`}
          </Text>
        }
        renderItem={({ item }) => (
          <RecommendationRow
            recommendation={item}
            onPress={() => navigation.navigate('PlaceDetails', { place: item.place })}
          />
        )}
      />
    </Screen>
  );
}

type RecommendationRowProps = {
  recommendation: Recommendation;
  onPress: () => void;
};

function RecommendationRow({ recommendation, onPress }: RecommendationRowProps) {
  const { place, reason } = recommendation;
  const meta = [place.kindLabel, formatPriceLevel(place.priceLevel), formatDistance(place.distanceMeters)]
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
        {reason ? (
          <Text style={styles.reason} numberOfLines={2}>
            {reason}
          </Text>
        ) : null}
      </View>
      {place.rating ? <Text style={styles.rating}>★ {place.rating.toFixed(1)}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginTop: spacing.xl,
  },
  progressCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  progressTitle: {
    ...typography.title,
    fontSize: 22,
  },
  progressBody: {
    ...typography.body,
    fontSize: 15,
    color: colors.textMuted,
  },
  track: {
    height: 6,
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primaryStrong,
  },
  progressMeta: {
    ...typography.caption,
    fontWeight: '600',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryStrong,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '600',
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
  reason: {
    fontSize: 13,
    color: colors.primaryStrong,
  },
  rating: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  empty: {
    ...typography.body,
    marginTop: spacing.lg,
    color: colors.textMuted,
  },
  footer: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.md,
  },
});
