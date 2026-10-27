import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';

type PlaceholderProps = {
  message: string;
};

export function Placeholder({ message }: PlaceholderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  message: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 15,
  },
});
