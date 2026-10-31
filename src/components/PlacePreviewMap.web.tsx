import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { Place } from '../types/place';
import { openInMaps } from '../utils/maps';

/** react-native-maps has no web implementation, so show coordinates instead. */
type PlacePreviewMapProps = {
  place: Place;
  style?: StyleProp<ViewStyle>;
};

export function PlacePreviewMap({ place, style }: PlacePreviewMapProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${place.name} in Google Maps`}
      accessibilityHint="Opens the place in Google Maps"
      onPress={() => void openInMaps(place)}
      style={({ pressed }) => [styles.container, style, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text style={styles.coordinates}>
          {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
        </Text>
        <Text style={styles.hint}>Map preview is available in the mobile app</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  coordinates: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryStrong,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
