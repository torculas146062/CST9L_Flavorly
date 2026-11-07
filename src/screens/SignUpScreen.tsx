import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { isValidEmail, isValidUsername, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, USERNAME_REQUIREMENTS } from '../types/auth';
import { colors, spacing, typography } from '../theme';

type SignUpScreenProps = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;
  const invalidUsername = name.length > 0 && !isValidUsername(name);
  const canSubmit =
    isValidUsername(name) &&
    isValidEmail(email) &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH &&
    confirm.length > 0 &&
    !mismatch &&
    !busy;

  const handleSubmit = async () => {
    if (!isValidUsername(name)) {
      setError(USERNAME_REQUIREMENTS);
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setError(`Use a password with ${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await signUp(name, email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create your account.');
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Create an account to get started with Flavorly."
      onBack={() => navigation.goBack()}
      footer={
        <Pressable accessibilityRole="link" onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      }
    >
      <FormField
        label="Username"
        value={name}
        onChangeText={setName}
        placeholder="3–30 letters, numbers, or underscores"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        error={invalidUsername ? USERNAME_REQUIREMENTS : undefined}
      />
      <Text style={styles.hint}>{USERNAME_REQUIREMENTS}</Text>
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder={`${MIN_PASSWORD_LENGTH}–${MAX_PASSWORD_LENGTH} characters`}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <FormField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Repeat your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        error={mismatch ? 'The passwords do not match.' : undefined}
        onSubmitEditing={() => canSubmit && void handleSubmit()}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        label="Create account"
        onPress={() => void handleSubmit()}
        disabled={!canSubmit}
        loading={busy}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryStrong,
  },
  error: {
    ...typography.caption,
    color: colors.primaryStrong,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    marginTop: -spacing.xs,
    color: colors.textMuted,
  },
});
