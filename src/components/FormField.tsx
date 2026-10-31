import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type FormFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown under the input; also marks the field as invalid. */
  error?: string;
};

export function FormField({ label, error, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...inputProps}
        style={[styles.input, error ? styles.inputInvalid : null]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...typography.body,
  },
  inputInvalid: {
    borderColor: colors.primaryStrong,
  },
  error: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
});
