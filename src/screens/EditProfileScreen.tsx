import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { MIN_PASSWORD_LENGTH } from '../storage/authStore';
import { colors, radius, spacing, typography } from '../theme';

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function EditProfileScreen() {
  const { user, updateProfile, changePassword } = useAuth();
  const navigation = useNavigation();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const unchanged = name.trim() === (user?.name ?? '') && email.trim().toLowerCase() === (user?.email ?? '');
  const canSaveDetails = name.trim().length > 0 && email.trim().length > 0 && !unchanged && !savingDetails;

  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSavePassword =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    !mismatch &&
    !savingPassword;

  const handleSaveDetails = async () => {
    setDetailsError(null);
    setSavingDetails(true);
    try {
      await updateProfile({ name, email });
      navigation.goBack();
    } catch (caught) {
      setDetailsError(messageOf(caught, 'Could not save your details.'));
      setSavingDetails(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    setPasswordError(null);
    setPasswordSaved(false);
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (caught) {
      setPasswordError(messageOf(caught, 'Could not change your password.'));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <FormField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
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
          />
        </View>

        {detailsError ? <Text style={styles.error}>{detailsError}</Text> : null}

        <PrimaryButton
          label="Save changes"
          onPress={() => void handleSaveDetails()}
          disabled={!canSaveDetails}
          loading={savingDetails}
        />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Password</Text>
          <FormField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Your current password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
          />
          <FormField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <FormField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat your new password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            error={mismatch ? 'The new passwords do not match.' : undefined}
          />
        </View>

        {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
        {passwordSaved ? <Text style={styles.success}>✓ Your password has been updated.</Text> : null}

        <PrimaryButton
          label="Change password"
          variant="secondary"
          onPress={() => void handleChangePassword()}
          disabled={!canSavePassword}
          loading={savingPassword}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  error: {
    ...typography.caption,
    color: colors.primaryStrong,
    fontWeight: '600',
  },
  success: {
    ...typography.caption,
    color: colors.primaryStrong,
    fontWeight: '600',
  },
});
