import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FormField } from '../components/FormField';
import { PrimaryButton } from '../components/PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '../storage/authStore';
import { colors, radius, spacing, typography } from '../theme';

function PasswordVisibilityToggle({
  visible,
  onPress,
  label,
}: {
  visible: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label} password`}
      onPress={onPress}
      hitSlop={8}
      style={styles.passwordToggle}
    >
      <Ionicons
        name={visible ? 'eye-off-outline' : 'eye-outline'}
        size={20}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}

export function EditProfileScreen() {
  const { user, updateProfile, changePassword } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const unchanged =
    name.trim() === (user?.name ?? '') && email.trim().toLowerCase() === (user?.email ?? '');
  const invalidEmail = email.trim().length > 0 && !isValidEmail(email);
  const canSaveDetails =
    name.trim().length > 0 && isValidEmail(email) && !unchanged && !savingDetails;

  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const passwordTooShort =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const canSavePassword =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword.length > 0 &&
    !mismatch &&
    !savingPassword;

  const handleSaveDetails = async () => {
    setDetailsError(null);
    setDetailsSaved(false);
    if (!name.trim()) {
      setDetailsError('Enter your name.');
      return;
    }
    if (!isValidEmail(email)) {
      setDetailsError('Enter a valid email address.');
      return;
    }

    setSavingDetails(true);
    try {
      await updateProfile({ name, email });
      setDetailsSaved(true);
    } catch (caught) {
      setDetailsError(messageOf(caught, 'Could not save your details.'));
    } finally {
      setSavingDetails(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
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
            onChangeText={(value) => {
              setName(value);
              setDetailsError(null);
              setDetailsSaved(false);
            }}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
          <FormField
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setDetailsError(null);
              setDetailsSaved(false);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            error={invalidEmail ? 'Enter a valid email address.' : undefined}
          />
          {detailsError ? <Text style={styles.error}>{detailsError}</Text> : null}
          {detailsSaved ? <Text style={styles.success}>Your details have been saved.</Text> : null}
          <PrimaryButton
            label="Save changes"
            onPress={() => void handleSaveDetails()}
            disabled={!canSaveDetails}
            loading={savingDetails}
          />
        </View>

        <View style={styles.card}>
          <FormField
            label="Current password"
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value);
              setPasswordError(null);
              setPasswordSaved(false);
            }}
            placeholder="Your current password"
            secureTextEntry={!showCurrentPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            rightAccessory={
              <PasswordVisibilityToggle
                visible={showCurrentPassword}
                onPress={() => setShowCurrentPassword((visible) => !visible)}
                label="current"
              />
            }
          />
          <FormField
            label="New password"
            value={newPassword}
            onChangeText={(value) => {
              setNewPassword(value);
              setPasswordError(null);
              setPasswordSaved(false);
            }}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            rightAccessory={
              <PasswordVisibilityToggle
                visible={showNewPassword}
                onPress={() => setShowNewPassword((visible) => !visible)}
                label="new"
              />
            }
          />
          <FormField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setPasswordError(null);
              setPasswordSaved(false);
            }}
            placeholder="Repeat your new password"
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            rightAccessory={
              <PasswordVisibilityToggle
                visible={showConfirmPassword}
                onPress={() => setShowConfirmPassword((visible) => !visible)}
                label="confirmation"
              />
            }
            error={mismatch ? 'The new passwords do not match.' : undefined}
          />
          {passwordTooShort ? (
            <Text style={styles.helper}>
              Use at least {MIN_PASSWORD_LENGTH} characters for your new password.
            </Text>
          ) : null}
          {passwordError ? <Text style={styles.error}>{passwordError}</Text> : null}
          {passwordSaved ? <Text style={styles.success}>Your password has been updated.</Text> : null}
          <PrimaryButton
            label="Change password"
            onPress={() => void handleChangePassword()}
            disabled={!canSavePassword}
            loading={savingPassword}
          />
        </View>
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
  passwordToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  helper: {
    ...typography.caption,
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
