import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
};

const VARIANTS = {
  primary: { container: { backgroundColor: colors.primaryStrong }, label: '#FFFFFF' },
  secondary: { container: { backgroundColor: colors.surface }, label: colors.primaryStrong },
  danger: { container: { backgroundColor: colors.primarySoft }, label: colors.primaryStrong },
} as const;

export function PrimaryButton({ label, onPress, disabled, loading, variant = 'primary' }: PrimaryButtonProps) {
  const palette = VARIANTS[variant];
  const inactive = Boolean(disabled) || Boolean(loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.container.backgroundColor },
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.label} />
      ) : (
        <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.75,
  },
  inactive: {
    opacity: 0.45,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
