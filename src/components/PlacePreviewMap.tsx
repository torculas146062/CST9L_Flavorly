import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { colors, radius } from '../theme';
import type { Place } from '../types/place';
import { openInMaps } from '../utils/maps';

const PREVIEW_DELTA = 0.012;

type PlacePreviewMapProps = {
  place: Place;
  /** Overrides the default size — the details screen stretches it into the hero slot. */
  style?: StyleProp<ViewStyle>;
};

export function PlacePreviewMap({ place, style }: PlacePreviewMapProps) {
  const coordinate = { latitude: place.latitude, longitude: place.longitude };

  return (
    <View style={[styles.container, style]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={{
            ...coordinate,
            latitudeDelta: PREVIEW_DELTA,
            longitudeDelta: PREVIEW_DELTA,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsPointsOfInterests={false}
          userInterfaceStyle="light"
          showsUserLocation
        >
          <Marker coordinate={coordinate} pinColor={colors.primaryStrong} />
        </MapView>
      </View>

      {/* The preview is inert, so a tap on it opens the maps app at the place. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.name} in Google Maps`}
        accessibilityHint="Opens the place in Google Maps"
        onPress={() => void openInMaps(place)}
        style={({ pressed }) => [StyleSheet.absoluteFill, pressed && styles.pressed]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
});
