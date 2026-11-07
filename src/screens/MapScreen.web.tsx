import { StyleSheet, Text, View } from 'react-native';

import { Placeholder } from '../components/Placeholder';
import { Screen } from '../components/Screen';
import { useNearbyPlaces } from '../context/NearbyPlacesContext';
import { colors, spacing, typography } from '../theme';

/**
 * react-native-maps has no web implementation, so Expo web falls back to this
 * notice. The map itself runs on Android/iOS (including Expo Go).
 */
export function MapScreen() {
  const { status, places, focus } = useNearbyPlaces();

  const summary =
    status === 'loading'
      ? 'Searching this area…'
      : `${places.length} places within ${(focus.radiusMeters / 1000).toFixed(1)} km`;

  return (
    <Screen title="Map" subtitle="See what's good nearby">
      <Placeholder message="The interactive map renders on Android and iOS. Open this project in Expo Go on your phone to see it — the Explore tab lists the same nearby places here in the browser." />
      <View style={styles.summary}>
        <Text style={typography.body}>{summary}</Text>
        <Text style={typography.caption}>
          {places.some((place) => place.source === 'google')
            ? 'Place data and ratings from Google'
            : places.some((place) => place.source === 'backend')
              ? 'Restaurant catalog data from Flavorly'
              : 'Places data © OpenStreetMap contributors'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    marginTop: spacing.md,
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
});
