import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { PlaceThumbnail } from '../components/PlaceThumbnail';
import { StarRating } from '../components/StarRating';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatDate, formatDistance, formatPriceLevel } from '../utils/format';

type MyRatingsNavigation = NativeStackNavigationProp<RootStackParamList>;

export function MyRatingsScreen() {
  const { allPlaces } = useNearbyPlaces();
  const { ratings, rate, clear, ratedCount } = useRatings();
  const navigation = useNavigation<MyRatingsNavigation>();

  const rows = useMemo(() => {
    const byId = new Map(allPlaces.map((place) => [place.id, place]));

    return Object.entries(ratings)
      .flatMap(([id, rating]) => {
        const place = byId.get(id);
        return place ? [{ id, rating, place }] : [];
      })
      .sort((a, b) => b.rating.ratedAt - a.rating.ratedAt);
  }, [ratings, allPlaces]);

  const missing = ratedCount - rows.length;
  const average = rows.length
    ? rows.reduce((total, row) => total + row.rating.value, 0) / rows.length
    : undefined;

  if (rows.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={28} color={colors.primaryStrong} />
          <Text style={typography.heading}>No ratings yet</Text>
          <Text style={styles.emptyBody}>
            Open a place from Explore or the map and tap the stars. Your ratings shape the Recommend tab.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Explore' })}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Find places</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={typography.heading}>
          {rows.length} rated place{rows.length === 1 ? '' : 's'}
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
        ListFooterComponent={
          missing > 0 ? (
            <Text style={styles.footer}>
              {missing} rating{missing === 1 ? '' : 's'} kept for a place that is no longer in your saved places.
            </Text>
          ) : undefined
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('PlaceDetails', { place: item.place })}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <PlaceThumbnail place={item.place} />

            <View style={styles.rowBody}>
              <Text style={typography.heading} numberOfLines={1}>
                {item.place.name}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {[item.place.kindLabel, formatPriceLevel(item.place.priceLevel), formatDistance(item.place.distanceMeters)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <View style={styles.ratingRow}>
                <StarRating
                  value={item.rating.value}
                  onChange={(value) => rate(item.id, value)}
                  size={18}
                  compact
                />
                <Text style={styles.ratedAt}>{formatDate(item.rating.ratedAt)}</Text>
                <Pressable accessibilityRole="button" onPress={() => clear(item.id)} hitSlop={8}>
                  <Text style={styles.clear}>Clear</Text>
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
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  emptyBody: {
    ...typography.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  footer: {
    ...typography.caption,
    fontSize: 11,
    marginTop: spacing.md,
  },
});
