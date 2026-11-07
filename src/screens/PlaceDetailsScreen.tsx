import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlacePhoto } from '../components/PlacePhoto';
import { PlacePreviewMap } from '../components/PlacePreviewMap';
import { StarRating } from '../components/StarRating';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatCount, formatDistance, formatPriceLevel } from '../utils/format';
import { openDirections } from '../utils/maps';
import { usePlacePhoto } from '../hooks/usePlacePhoto';

type PlaceDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'PlaceDetails'>;

export function PlaceDetailsScreen({ route }: PlaceDetailsScreenProps) {
  const insets = useSafeAreaInsets();
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
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
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

      <View style={styles.actions}>
        {phone ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Call ${place.name}`}
            onPress={() => Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`)}
            style={({ pressed }) => [styles.action, pressed && styles.factPressed]}
          >
            <Ionicons name="call-outline" size={20} color={colors.primaryStrong} />
            <Text style={styles.actionLabel}>Call</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Get directions to ${place.name}`}
          onPress={() => void openDirections(place)}
          style={({ pressed }) => [styles.action, pressed && styles.factPressed]}
        >
          <Ionicons name="navigate-outline" size={20} color={colors.primaryStrong} />
          <Text style={styles.actionLabel}>Directions</Text>
        </Pressable>
        {website ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${website}`}
            onPress={() => Linking.openURL(website)}
            style={({ pressed }) => [styles.action, pressed && styles.factPressed]}
          >
            <Ionicons name="globe-outline" size={20} color={colors.primaryStrong} />
            <Text style={styles.actionLabel}>
              {/facebook\.com|fb\.com/i.test(website) ? 'Facebook page' : 'Website'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {rating ? (
        <View style={styles.ratingRow}>
          <Text style={styles.rating}>★ {rating.toFixed(1)}</Text>
          {ratingCount ? (
            <Text accessibilityLabel={`${formatCount(ratingCount)} ratings`} style={typography.caption}>
              ({formatCount(ratingCount)})
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.myRating}>
        <View style={styles.myRatingMain}>
          <Text style={styles.myRatingLabel}>Your rating</Text>
          <StarRating value={myRating} onChange={(value) => rate(place.id, value)} size={28} compact />
        </View>
        <View style={styles.myRatingFooter}>
          {myRating ? (
            <Pressable accessibilityRole="button" onPress={() => clear(place.id)} hitSlop={8}>
              <Text style={styles.clearRating}>Clear rating</Text>
            </Pressable>
          ) : (
            <Text style={styles.ratingHint}>Tap a star to rate</Text>
          )}
        </View>
      </View>

      {address ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open directions to ${place.name}. Address: ${address}`}
          onPress={() => void openDirections(place)}
          style={({ pressed }) => [styles.fact, styles.factLink, pressed && styles.factPressed]}
        >
          <Ionicons name="location-outline" size={18} color={colors.primaryStrong} />
          <Text style={[styles.factText, styles.linkText]}>
            {formatPlaceAddress(address)}
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
    gap: spacing.xs,
    backgroundColor: colors.background,
  },
  heroMap: {
    height: 200,
  },
  header: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  action: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  actionLabel: {
    ...typography.caption,
    color: colors.primaryStrong,
    fontWeight: '600',
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  myRating: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  myRatingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  myRatingLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  myRatingFooter: {
    minHeight: 20,
    marginTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  ratingHint: {
    ...typography.caption,
    fontSize: 12,
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

function formatPlaceAddress(address: string): string {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const plusCodePattern = /^[A-Z0-9]{2,8}\+[A-Z0-9]{2,3}$/i;
  const readableParts = parts.filter((part) => !plusCodePattern.test(part));

  return readableParts.length > 0 ? readableParts.join(', ') : address;
}
