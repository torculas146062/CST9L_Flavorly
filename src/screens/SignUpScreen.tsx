import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { MIN_PASSWORD_LENGTH } from '../storage/authStore';
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
  const canSubmit =
    name.trim().length > 0 && email.trim().length > 0 && password.length > 0 && !mismatch && !busy;

  const handleSubmit = async () => {
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
      subtitle="Your ratings and saved places stay on this device."
      onBack={() => navigation.goBack()}
      footer={
        <Pressable accessibilityRole="link" onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      }
    >
      <FormField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
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
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
});
