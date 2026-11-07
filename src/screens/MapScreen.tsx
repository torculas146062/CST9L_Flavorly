import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_MAP_CENTER, DEFAULT_REGION_DELTA, MAP_SETTLE_DELAY_MS } from '../constants/map';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import type { Coordinates, Place } from '../types/place';
import { formatPriceLevel } from '../utils/format';
import { regionContains, type MapRegion } from '../utils/geo';

type MapNavigation = NativeStackNavigationProp<RootStackParamList>;

/**
 * Android ignores `showsPointsOfInterests` (react-native-maps implements it as a no-op
 * there), so Google's own POI pins - malls, towers, schools - are removed with a map
 * style instead. Only the dining markers this screen renders stay on the map.
 */
const DINING_ONLY_MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

function toRegion(coordinates: Coordinates): Region {
  return {
    ...coordinates,
    latitudeDelta: DEFAULT_REGION_DELTA,
    longitudeDelta: DEFAULT_REGION_DELTA,
  };
}

function markerDescription(place: Place): string {
  const rating = place.rating != null ? `★ ${place.rating.toFixed(1)}` : null;
  return [place.kindLabel, formatPriceLevel(place.priceLevel), rating].filter(Boolean).join(' · ');
}

export function MapScreen() {
  const {
    status,
    places,
    location,
    locationPermissionDenied,
    restoredView,
    initialViewLoaded,
    setViewRegion,
    refresh,
  } = useNearbyPlaces();
  const navigation = useNavigation<MapNavigation>();
  const mapRef = useRef<MapView>(null);
  const hasCenteredOnUser = useRef(false);
  const reportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  // The map only reports its viewport once it settles, so markers follow the last
  // reported rectangle. Places outside it are simply not rendered as pins.
  const [visibleRegion, setVisibleRegion] = useState<MapRegion | null>(null);

  // Reopening the app lands on the last position the user was looking at.
  const initialRegion = useMemo(
    () => restoredView ?? toRegion(location ?? DEFAULT_MAP_CENTER),
    [restoredView, location],
  );

  // Only report a view once the map has actually been still, and drop the pending
  // report as soon as the user grabs the map again — no searching mid-pan.
  const cancelSettledReport = useCallback(() => {
    if (reportTimer.current) {
      clearTimeout(reportTimer.current);
      reportTimer.current = null;
    }
  }, []);

  const handleRegionChange = useCallback(
    (region: MapRegion) => {
      setVisibleRegion(region);

      cancelSettledReport();
      reportTimer.current = setTimeout(() => {
        reportTimer.current = null;
        setViewRegion(region);
      }, MAP_SETTLE_DELAY_MS);
    },
    [cancelSettledReport, setViewRegion],
  );

  useEffect(() => cancelSettledReport, [cancelSettledReport]);

  useEffect(() => {
    // A restored view wins; otherwise follow the user once the fix arrives.
    if (restoredView || !location || !mapRef.current || hasCenteredOnUser.current) {
      return;
    }
    hasCenteredOnUser.current = true;
    mapRef.current.animateToRegion(toRegion(location), 600);
  }, [location, restoredView]);

  const activeRegion = visibleRegion ?? initialRegion;

  // Every remembered place inside the viewport gets a pin — no fixed cap.
  const markers = useMemo(
    () => places.filter((place) => regionContains(activeRegion, place)),
    [places, activeRegion],
  );

  const statusText =
    status === 'loading'
      ? 'Searching this area…'
      : [
          `${markers.length} in view`,
          places.length > markers.length ? `${places.length} in this area` : null,
          locationPermissionDenied ? 'location off' : null,
        ]
          .filter(Boolean)
          .join(' · ');

  if (!initialViewLoaded) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={handleRegionChange}
        onPanDrag={cancelSettledReport}
        onRegionChange={(_region, details) => {
          // `isGesture` only exists with the Google provider; onPanDrag covers Apple Maps.
          if (details?.isGesture) {
            cancelSettledReport();
          }
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        customMapStyle={DINING_ONLY_MAP_STYLE}
        userInterfaceStyle="light"
        toolbarEnabled={false}
      >
        {markers.map((place) => (
          <Marker
            key={place.id}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description={markerDescription(place)}
            pinColor={colors.primaryStrong}
            onCalloutPress={() => navigation.navigate('PlaceDetails', { place })}
          />
        ))}
      </MapView>

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]} pointerEvents="none">
        <Text style={typography.heading}>Map</Text>
        <Text style={styles.statusText} numberOfLines={2}>
          {statusText}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          accessibilityLabel="Refresh places in this area"
          onPress={refresh}
          style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
        >
          <Ionicons name="refresh" size={20} color={colors.primaryStrong} />
        </Pressable>
        <Pressable
          accessibilityLabel="Center on my location"
          disabled={!location}
          onPress={() => location && mapRef.current?.animateToRegion(toRegion(location), 500)}
          style={({ pressed }) => [
            styles.controlButton,
            pressed && styles.controlButtonPressed,
            !location && styles.controlButtonDisabled,
          ]}
        >
          <Ionicons name="locate" size={20} color={colors.primaryStrong} />
        </Pressable>
      </View>

      {status === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryStrong} />
        </View>
      ) : null}

      <Text style={styles.attribution}>
        {places.some((place) => place.source === 'google')
          ? 'Place data and ratings from Google'
          : places.some((place) => place.source === 'backend')
            ? 'Restaurant catalog data from Flavorly'
            : 'Places data © OpenStreetMap contributors'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(255, 252, 253, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  statusText: {
    ...typography.caption,
    marginTop: 2,
  },
  controls: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.xl,
    gap: spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlButtonPressed: {
    backgroundColor: colors.primarySoft,
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  loading: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: spacing.xl * 2,
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attribution: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.xs,
    fontSize: 10,
    color: colors.textMuted,
  },
});
