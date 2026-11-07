import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type FormFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Shown under the input; also marks the field as invalid. */
  error?: string;
  rightAccessory?: ReactNode;
};

export function FormField({ label, error, rightAccessory, onFocus, onBlur, ...inputProps }: FormFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          focused ? styles.inputFocused : null,
          error ? styles.inputInvalid : null,
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={styles.input}
        />
        {rightAccessory}
      </View>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    ...typography.body,
  },
  inputFocused: {
    borderColor: colors.primaryStrong,
    borderWidth: 2,
    paddingHorizontal: spacing.md - 1,
    paddingVertical: spacing.sm + 1,
  },
  inputInvalid: {
    borderColor: colors.primaryStrong,
  },
  error: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
});
