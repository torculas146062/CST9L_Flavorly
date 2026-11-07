import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { AuthShell } from '../components/AuthShell';
import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: LoginScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign you in.');
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('SignUp')} hitSlop={8}>
          <Text style={styles.link}>New here? Create an account</Text>
        </Pressable>
      }
    >
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
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && void handleSubmit()}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton label="Sign in" onPress={() => void handleSubmit()} disabled={!canSubmit} loading={busy} />

      <Text style={styles.footnote}>Sign in to your Flavorly account.</Text>
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
  footnote: {
    ...typography.caption,
    fontSize: 14,
    color: colors.text,
  },
});
