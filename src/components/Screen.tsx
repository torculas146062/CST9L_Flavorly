import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme';

type ScreenProps = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  safeAreaTop?: boolean;
};

export function Screen({ title, subtitle, children, safeAreaTop = true }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: (safeAreaTop ? insets.top : 0) + spacing.md }]}>
      <View style={styles.header}>
        {title ? <Text style={typography.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  body: {
    flex: 1,
  },
});
