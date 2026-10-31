import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PlacePhoto } from '../components/PlacePhoto';
import { PlacePreviewMap } from '../components/PlacePreviewMap';
import { StarRating } from '../components/StarRating';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatCount, formatDistance, formatPriceLevel } from '../utils/format';
import { usePlacePhoto } from '../hooks/usePlacePhoto';

type PlaceDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'PlaceDetails'>;

export function PlaceDetailsScreen({ route }: PlaceDetailsScreenProps) {
  const { place } = route.params;
  const { address, phone, website, rating, ratingCount } = place;

  const { ratings, rate, clear } = useRatings();
  const myRating = ratings[place.id]?.value;

  const photo = usePlacePhoto(place, { allowPageLookup: true });
  // No photo available, or it failed to load: show the map instead.
  const showPhoto = Boolean(photo.uri);

  const meta = [place.kindLabel, formatPriceLevel(place.priceLevel), formatDistance(place.distanceMeters)]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* No photo available? The map takes its place instead of an empty tile. */}
      {showPhoto ? (
        <PlacePhoto place={place} uri={photo.uri} hero onError={photo.reportError} />
      ) : (
        <PlacePreviewMap place={place} style={styles.heroMap} />
      )}

      <View style={styles.header}>
        <Text style={typography.title}>{place.name}</Text>
        <Text style={typography.caption}>{meta}</Text>
      </View>

      {rating ? (
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>★ {rating.toFixed(1)}</Text>
          {ratingCount ? (
            <Text style={typography.caption}>{formatCount(ratingCount)} ratings</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.myRating}>
        <Text style={styles.myRatingLabel}>Your rating</Text>
        <StarRating value={myRating} onChange={(value) => rate(place.id, value)} />
        {myRating ? (
          <Pressable accessibilityRole="button" onPress={() => clear(place.id)} hitSlop={8}>
            <Text style={styles.clearRating}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {address ? (
        <View style={styles.fact}>
          <Ionicons name="location-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.factText}>{address}</Text>
        </View>
      ) : null}

      {phone ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
          style={({ pressed }) => [styles.fact, styles.factLink, pressed && styles.factPressed]}
        >
          <Ionicons name="call-outline" size={18} color={colors.primaryStrong} />
          <Text style={[styles.factText, styles.linkText]}>{phone}</Text>
        </Pressable>
      ) : null}

      {website ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(website)}
          style={({ pressed }) => [styles.fact, styles.factLink, pressed && styles.factPressed]}
        >
          <Ionicons name="globe-outline" size={18} color={colors.primaryStrong} />
          <Text style={[styles.factText, styles.linkText]} numberOfLines={1}>
            {website}
          </Text>
        </Pressable>
      ) : null}

      {showPhoto ? (
        <View style={styles.mapSection}>
          <PlacePreviewMap place={place} />
        </View>
      ) : null}

      <Text style={styles.attribution}>
        {place.source === 'google' ? 'Place data and ratings from Google' : 'Data © OpenStreetMap contributors'}
        {photo.origin === 'facebook' ? ' · photo from the venue on Facebook' : ''}
        {photo.origin === 'website' ? ' · photo from the venue website' : ''}
        {!photo.uri && !place.photoUrl && place.source === 'google'
          ? ' · photos need billing enabled on the Places project'
          : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  heroMap: {
    height: 200,
  },
  header: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  myRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  myRatingLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearRating: {
    color: colors.textMuted,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  rating: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  factLink: {
    borderRadius: radius.sm,
  },
  factPressed: {
    backgroundColor: colors.surface,
  },
  factText: {
    ...typography.body,
    flex: 1,
  },
  linkText: {
    color: colors.primaryStrong,
    textDecorationLine: 'underline',
  },
  mapSection: {
    marginTop: spacing.md,
  },
  attribution: {
    fontSize: 11,
    marginTop: spacing.lg,
    color: colors.textMuted,
  },
});
