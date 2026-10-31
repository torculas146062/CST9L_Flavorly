import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { useAuth } from '../context/AuthContext';
import { useRatings } from '../context/RatingsContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme';
import { confirmDestructive } from '../utils/confirm';
import { initials } from '../utils/format';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;
type IoniconName = ComponentProps<typeof Ionicons>['name'];

type RowProps = {
  label: string;
  icon: IoniconName;
  onPress: () => void;
  badge?: string;
  tone?: 'default' | 'danger';
};

function Row({ label, icon, onPress, badge, tone = 'default' }: RowProps) {
  const danger = tone === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowLabel}>
        <Ionicons name={icon} size={18} color={danger ? colors.primaryStrong : colors.textMuted} />
        <Text style={[typography.body, danger && styles.rowDangerText]}>{label}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { ratedCount } = useRatings();
  const navigation = useNavigation<ProfileNavigation>();

  const handleSignOut = () => {
    confirmDestructive('Log out?', 'Are you sure you want to log out?', 'Log out', () => void signOut());
  };

  return (
    <Screen title="Profile" subtitle="Your taste, remembered">
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.name ?? 'Guest')}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={typography.heading} numberOfLines={1}>
            {user?.name ?? 'Guest'}
          </Text>
          <Text style={typography.caption} numberOfLines={1}>
            {user?.email ?? 'Not signed in'}
          </Text>
          <Text style={typography.caption}>
            {ratedCount === 0 ? 'No ratings yet' : `${ratedCount} place${ratedCount === 1 ? '' : 's'} rated`}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        <Row
          label="My Ratings"
          icon="star-outline"
          badge={ratedCount > 0 ? String(ratedCount) : undefined}
          onPress={() => navigation.navigate('MyRatings')}
        />
        <Row label="Edit profile" icon="person-outline" onPress={() => navigation.navigate('EditProfile')} />

        {__DEV__ ? (
          <Row
            label="Developer settings"
            icon="construct-outline"
            onPress={() => navigation.navigate('DeveloperSettings')}
          />
        ) : null}

        <Row label="Log out" icon="log-out-outline" tone="danger" onPress={handleSignOut} />
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onPrimary,
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
  rowDangerText: {
    color: colors.primaryStrong,
    fontWeight: '600',
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
