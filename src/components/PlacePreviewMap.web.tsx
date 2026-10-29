import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '../theme';
import type { Place } from '../types/place';

/** react-native-maps has no web implementation, so show coordinates instead. */
type PlacePreviewMapProps = {
  place: Place;
  style?: StyleProp<ViewStyle>;
};

export function PlacePreviewMap({ place, style }: PlacePreviewMapProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.coordinates}>
        {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
      </Text>
      <Text style={styles.hint}>Map preview is available in the mobile app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
