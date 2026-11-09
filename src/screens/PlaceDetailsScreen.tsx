import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BackendPlace } from '../api/backend';
import { getCachedCatalogVerification, toCatalogPlace, verifyCatalogPlace } from '../api/catalog';
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
  const cachedVerification = getCachedCatalogVerification(place.id);
  const [catalogState, setCatalogState] = useState<{
    placeId: string;
    status: 'checking' | 'supported' | 'unsupported' | 'error';
  }>({
    placeId: place.id,
    status:
      place.catalogSupported || cachedVerification?.status === 'supported'
        ? 'supported'
        : cachedVerification?.status === 'unsupported'
          ? 'unsupported'
          : 'checking',
  });
  const [catalogDetails, setCatalogDetails] = useState<{ placeId: string; details: BackendPlace } | null>(
    cachedVerification?.status === 'supported'
      ? { placeId: place.id, details: cachedVerification.details }
      : null,
  );
  const [verificationRetry, setVerificationRetry] = useState(0);

  const {
    ratings,
    rate,
    clear,
    loading: ratingsLoading,
    savingPlaceId,
    deletingPlaceId,
    error: ratingError,
    clearError,
  } = useRatings();
  const myRating = ratings[place.id]?.value;

  useEffect(() => {
    if (place.catalogSupported) {
      setCatalogState({ placeId: place.id, status: 'supported' });
      return;
    }

    const cached = getCachedCatalogVerification(place.id);
    if (cached?.status === 'supported') {
      setCatalogDetails({ placeId: place.id, details: cached.details });
      setCatalogState({ placeId: place.id, status: 'supported' });
      return;
    }
    if (cached?.status === 'unsupported') {
      setCatalogState({ placeId: place.id, status: 'unsupported' });
      return;
    }

    let active = true;
    setCatalogState({ placeId: place.id, status: 'checking' });
    void verifyCatalogPlace(place.id)
      .then((result) => {
        if (!active) {
          return;
        }
        if (result.status === 'supported') {
          setCatalogDetails({ placeId: place.id, details: result.details });
          setCatalogState({ placeId: place.id, status: 'supported' });
        } else {
          setCatalogState({ placeId: place.id, status: 'unsupported' });
        }
      })
      .catch(() => {
        if (active) {
          setCatalogState({ placeId: place.id, status: 'error' });
        }
      });

    return () => {
      active = false;
    };
  }, [place.catalogSupported, place.id, verificationRetry]);

  const cachedCurrentVerification = getCachedCatalogVerification(place.id);
  const catalogStatus = place.catalogSupported
    ? 'supported'
    : catalogState.placeId === place.id
      ? catalogState.status
      : cachedCurrentVerification?.status ?? 'checking';
  const currentCatalogDetails =
    catalogDetails?.placeId === place.id
      ? catalogDetails.details
      : cachedCurrentVerification?.status === 'supported'
        ? cachedCurrentVerification.details
        : undefined;
  const displayPlace = currentCatalogDetails
    ? {
        ...toCatalogPlace(currentCatalogDetails),
        ...place,
        name: place.name || currentCatalogDetails.name,
        kindLabel: place.kindLabel || currentCatalogDetails.kindLabel,
        rating: place.rating ?? currentCatalogDetails.rating ?? undefined,
        ratingCount: place.ratingCount ?? currentCatalogDetails.ratingCount ?? undefined,
        address: place.address ?? currentCatalogDetails.address ?? undefined,
        catalogSupported: true,
      }
    : place;
  const { address, phone, website, rating, ratingCount } = displayPlace;

  const photo = usePlacePhoto(displayPlace, { allowPageLookup: true });
  // No photo available, or it failed to load: show the map instead.
  const showPhoto = Boolean(photo.uri);

  const meta = [displayPlace.kindLabel, formatPriceLevel(displayPlace.priceLevel), formatDistance(displayPlace.distanceMeters)]
    .filter(Boolean)
    .join(' · ');
  const ratingBusy = ratingsLoading || savingPlaceId !== null || deletingPlaceId !== null;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      {/* No photo available? The map takes its place instead of an empty tile. */}
      {showPhoto ? (
        <PlacePhoto place={displayPlace} uri={photo.uri} hero onError={photo.reportError} />
      ) : (
        <PlacePreviewMap place={displayPlace} style={styles.heroMap} />
      )}

      <View style={styles.header}>
        <Text style={typography.title}>{displayPlace.name}</Text>
        <Text style={typography.caption}>{meta}</Text>
      </View>

      <View style={styles.actions}>
        {phone ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Call ${displayPlace.name}`}
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
          onPress={() => void openDirections(displayPlace)}
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
          <Text style={typography.caption}>Public rating</Text>
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
          {catalogStatus === 'supported' ? (
            <StarRating
              value={myRating}
              onChange={(value) => {
                clearError();
                void rate(place.id, value).catch(() => undefined);
              }}
              size={28}
              compact
              disabled={ratingBusy}
            />
          ) : catalogStatus === 'checking' ? (
            <ActivityIndicator color={colors.primaryStrong} />
          ) : null}
        </View>
        <View style={styles.myRatingFooter}>
          {catalogStatus === 'unsupported' ? (
            <Text style={styles.ratingHint}>In-app ratings are unavailable for this restaurant because it is not in the Flavorly catalog.</Text>
          ) : catalogStatus === 'error' ? (
            <View>
              <Text style={styles.ratingHint}>Could not verify this restaurant's catalog support.</Text>
              <Pressable onPress={() => setVerificationRetry((retry) => retry + 1)} hitSlop={8}>
                <Text style={styles.clearRating}>Retry verification</Text>
              </Pressable>
            </View>
          ) : myRating ? (
            <Pressable
              accessibilityRole="button"
              disabled={ratingBusy || catalogStatus !== 'supported'}
              onPress={() => {
                clearError();
                void clear(place.id).catch(() => undefined);
              }}
              hitSlop={8}
            >
              <Text style={[styles.clearRating, (ratingBusy || catalogStatus !== 'supported') && styles.disabledText]}>
                {deletingPlaceId === place.id ? 'Deleting…' : 'Clear rating'}
              </Text>
            </Pressable>
          ) : catalogStatus === 'supported' ? (
            <Text style={styles.ratingHint}>Tap a star to rate</Text>
          ) : null}
        </View>
        {ratingError ? <Text style={styles.ratingError}>{ratingError}</Text> : null}
      </View>

      {address ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open directions to ${displayPlace.name}. Address: ${address}`}
          onPress={() => void openDirections(displayPlace)}
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
          <PlacePreviewMap place={displayPlace} />
        </View>
      ) : null}

      <Text style={styles.attribution}>
        {displayPlace.source === 'google'
          ? 'Place data and ratings from Google'
          : displayPlace.source === 'backend'
            ? 'Restaurant catalog data from Flavorly'
            : 'Data © OpenStreetMap contributors'}
        {photo.origin === 'facebook' ? ' · photo from the venue on Facebook' : ''}
        {photo.origin === 'website' ? ' · photo from the venue website' : ''}
        {!photo.uri && !displayPlace.photoUrl && displayPlace.source === 'google'
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
  ratingError: {
    ...typography.caption,
    color: colors.primaryStrong,
    marginTop: spacing.xs,
  },
  disabledText: {
    opacity: 0.5,
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
