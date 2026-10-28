import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;

const profileRows = ['Preferences', 'Dietary needs', 'Settings'];

export function ProfileScreen() {
  const { ratedCount } = useRatings();
  const navigation = useNavigation<ProfileNavigation>();

  return (
    <Screen title="Profile" subtitle="Your taste, remembered">
      <View style={styles.card}>
        <View style={styles.avatar} />
        <View style={styles.identity}>
          <Text style={typography.heading}>Guest</Text>
          <Text style={typography.caption}>
            {ratedCount === 0 ? 'No ratings yet' : `${ratedCount} place${ratedCount === 1 ? '' : 's'} rated`}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('MyRatings')}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.rowLabel}>
            <Text style={typography.body}>My Ratings</Text>
            {ratedCount > 0 ? <Text style={styles.badge}>{ratedCount}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {profileRows.map((row) => (
          <View key={row} style={styles.row}>
            <Text style={typography.body}>{row}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        ))}

        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('DeveloperSettings')}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={typography.body}>Developer settings</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  identity: {
    flex: 1,
    gap: spacing.xs,
  },
  list: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    overflow: 'hidden',
  },
  chevron: {
    fontSize: 22,
    color: colors.textMuted,
  },
});
