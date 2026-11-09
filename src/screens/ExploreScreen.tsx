import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { PlaceThumbnail } from '../components/PlaceThumbnail';
import { Screen } from '../components/Screen';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { formatCount, formatDistance, formatPriceLevel } from '../utils/format';
import type { Place } from '../types/place';

type ExploreNavigation = NativeStackNavigationProp<RootStackParamList>;

export function ExploreScreen() {
  // Every place remembered on the device, ordered by how far it is from the user.
  const { status, allPlaces, locationPermissionDenied, storedCount, refresh } = useNearbyPlaces();
  const navigation = useNavigation<ExploreNavigation>();
  const isBusy = status === 'loading';

  const subtitle = isBusy
    ? 'Loading remembered places…'
    : `${allPlaces.length} place${allPlaces.length === 1 ? '' : 's'} remembered`;

  return (
    <Screen title="Explore" subtitle={subtitle}>
      <FlatList
        data={allPlaces}
        keyExtractor={(place) => place.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isBusy}
            onRefresh={refresh}
            tintColor={colors.primaryStrong}
            colors={[colors.primaryStrong]}
          />
        }
        ListEmptyComponent={
          isBusy ? (
            <ActivityIndicator style={styles.spinner} color={colors.primaryStrong} />
          ) : (
            <Text style={styles.empty}>
              No restaurants in this area yet. Open the map and pan around to load some, then pull down to
              refresh.
            </Text>
          )
        }
        ListFooterComponent={
          allPlaces.length > 0 ? (
            <Attribution
              places={allPlaces}
              locationOff={locationPermissionDenied}
              storedCount={storedCount}
            />
          ) : undefined
        }
        renderItem={({ item }) => (
          <PlaceRow place={item} onPress={() => navigation.navigate('PlaceDetails', { place: item })} />
        )}
      />
    </Screen>
  );
}

type PlaceRowProps = {
  place: Place;
  onPress: () => void;
};

function PlaceRow({ place, onPress }: PlaceRowProps) {
  const price = formatPriceLevel(place.priceLevel);
  const meta = [place.kindLabel, price].filter(Boolean).join(' · ');

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
        {place.rating ? (
          <Text style={styles.rating}>
            ★ {place.rating.toFixed(1)}
            {place.ratingCount ? <Text style={styles.ratingCount}> ({formatCount(place.ratingCount)})</Text> : null}
          </Text>
        ) : null}
      </View>

      <Text style={styles.distance}>{formatDistance(place.distanceMeters)}</Text>
    </Pressable>
  );
}

type AttributionProps = {
  places: Place[];
  locationOff: boolean;
  storedCount: number;
};

function Attribution({ places, locationOff, storedCount }: AttributionProps) {
  const usesGoogle = places.some((place) => place.source === 'google');
  const usesOsm = places.some((place) => place.source === 'osm');

  return (
    <View style={styles.attribution}>
      {usesGoogle ? <Text style={styles.attributionText}>Place data and ratings from Google</Text> : null}
      {places.some((place) => place.source === 'backend') ? (
        <Text style={styles.attributionText}>Restaurant catalog data from Flavorly</Text>
      ) : null}
      {usesOsm ? <Text style={styles.attributionText}>Place data © OpenStreetMap contributors</Text> : null}
      <Text style={styles.attributionText}>
        Distances are measured from{' '}
        {locationOff ? 'the centre of the map view (location is off)' : 'your current location'}.
      </Text>
      <Text style={styles.attributionText}>
        {storedCount.toLocaleString('en-US')} place{storedCount === 1 ? '' : 's'} stored on this device.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  distance: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryStrong,
  },
  spinner: {
    marginTop: spacing.xl,
  },
  empty: {
    ...typography.caption,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  attribution: {
    marginTop: spacing.md,
    gap: 2,
  },
  attributionText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
