import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';
import { initials } from '../utils/format';
import type { Place } from '../types/place';

type PlacePhotoProps = {
  place: Place;
  /** Resolved image URL — see `usePlacePhoto`. */
  uri?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /** Larger radius and a bolder fallback for the details hero image. */
  hero?: boolean;
  onError?: () => void;
};

/** Renders a resolved photo, or a branded tile when there is nothing to show. */
export function PlacePhoto({ place, uri, size, style, hero = false, onError }: PlacePhotoProps) {
  const containerStyle: StyleProp<ViewStyle> = [
    hero ? styles.hero : styles.thumb,
    size ? { width: size, height: size } : null,
    style,
  ];

  if (uri) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={onError} />
      </View>
    );
  }

  return (
    <View style={[containerStyle, styles.fallback]}>
      {hero ? (
        <Ionicons name="restaurant-outline" size={28} color={colors.primaryStrong} />
      ) : (
        <Text style={styles.initials}>{initials(place.name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  hero: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  initials: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryStrong,
  },
});
