import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '../components/Screen';
import {
  clearStorage,
  exportBackup,
  importBackup,
  serializeBackup,
  summarizeStorage,
  type StorageSummary,
} from '../storage/backup';
import { colors, radius, spacing, typography } from '../theme';
import { confirmDestructive } from '../utils/confirm';
import {
  buildPhotoArchive,
  deleteAllPhotoFiles,
  photoArchiveSupported,
  photoStorageSummary,
  restorePhotoArchive,
} from '../utils/photoArchive';
import {
  pickBinaryFile,
  pickTextFile,
  reloadApp,
  saveBinaryFile,
  saveTextFile,
} from '../utils/storageTransfer';

function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return 'empty';
  }
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

export function DeveloperSettingsScreen() {
  const [summary, setSummary] = useState<StorageSummary[]>([]);
  const [photos, setPhotos] = useState<{ count: number; bytes: number }>({ count: 0, bytes: 0 });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshSummary = useCallback(async () => {
    setSummary(await summarizeStorage());
    setPhotos(await photoStorageSummary());
  }, []);

  useEffect(() => {
    void refreshSummary();
  }, [refreshSummary]);

  const run = useCallback(
    async (label: string, action: () => Promise<string | null>) => {
      setBusy(true);
      setError(null);
      setStatus(`${label}…`);
      try {
        const message = await action();
        if (message) {
          setStatus(message);
        }
        await refreshSummary();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong');
        setStatus(null);
      } finally {
        setBusy(false);
      }
    },
    [refreshSummary],
  );

  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  const handleExport = () =>
    run('Saving export', async () => {
      const json = serializeBackup(await exportBackup());
      const path = await saveTextFile(`flavorly-storage-${stamp()}.json`, json);
      return `Saved ${formatBytes(json.length)} → ${path}`;
    });

  const handleExportPhotos = () =>
    run('Zipping photos', async () => {
      const archive = await buildPhotoArchive();
      if (!archive) {
        return 'No photos downloaded yet';
      }
      const path = await saveBinaryFile(`flavorly-photos-${stamp()}.zip`, archive);
      return `Saved ${formatBytes(archive.byteLength)} → ${path}`;
    });

  const handleImportPhotos = () =>
    run('Pick a photo archive', async () => {
      const bytes = await pickBinaryFile();
      if (!bytes) {
        return 'Import cancelled';
      }
      const result = await restorePhotoArchive(bytes);
      await refreshSummary();
      return `Restored ${result.restored} photo${result.restored === 1 ? '' : 's'}${
        result.skipped ? `, skipped ${result.skipped}` : ''
      }`;
    });

  const applyImport = (json: string) =>
    run('Importing', async () => {
      const result = await importBackup(json);
      setPaste('');
      reloadApp();
      return `Imported ${result.imported.join(', ')} — reloading`;
    });

  const handlePickImport = () =>
    run('Opening file picker', async () => {
      const picked = await pickTextFile();
      if (!picked) {
        return 'Import cancelled';
      }
      const result = await importBackup(picked);
      reloadApp();
      return `Imported ${result.imported.join(', ')} — reloading`;
    });

  const handleClearPhotos = () => {
    confirmDestructive(
      'Clear cached photos?',
      `Removes ${photos.count} stored image${photos.count === 1 ? '' : 's'} (${formatBytes(
        photos.bytes,
      )}). Places and ratings stay; images are downloaded again the next time a place is shown.`,
      'Clear photos',
      () =>
        void run('Clearing photos', async () => {
          await deleteAllPhotoFiles();
          const after = await photoStorageSummary();
          return `Photos cleared — ${after.count} file${after.count === 1 ? '' : 's'} left`;
        }),
    );
  };

  const handleClear = () => {
    confirmDestructive(
      'Clear all storage?',
      'Places, ratings, cached photos and the map position will be deleted.',
      'Clear',
      () =>
        void run('Clearing', async () => {
          await clearStorage();
          await deleteAllPhotoFiles();
          reloadApp();
          return 'Storage cleared — reloading';
        }),
    );
  };

  return (
    <Screen title="Developer" subtitle="Storage export and import">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Storage</Text>
          {summary.map((entry) => (
            <View key={entry.key} style={styles.summaryRow}>
              <Text style={typography.body}>{entry.key}</Text>
              <Text style={typography.caption}>{formatBytes(entry.bytes)}</Text>
            </View>
          ))}
          <View style={styles.summaryRow}>
            <Text style={typography.body}>photo files</Text>
            <Text style={typography.caption}>
              {photos.count} · {formatBytes(photos.bytes)}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleExport}
          style={({ pressed }) => [styles.button, (pressed || busy) && styles.buttonPressed]}
        >
          <Ionicons name="download-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.buttonText}>Save data (JSON)</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy || !photoArchiveSupported}
          onPress={handleExportPhotos}
          style={({ pressed }) => [
            styles.buttonSecondary,
            (pressed || busy || !photoArchiveSupported) && styles.buttonPressed,
          ]}
        >
          <Ionicons name="images-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.buttonSecondaryText}>Save photos (ZIP)</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy || !photoArchiveSupported}
          onPress={handleImportPhotos}
          style={({ pressed }) => [
            styles.buttonSecondary,
            (pressed || busy || !photoArchiveSupported) && styles.buttonPressed,
          ]}
        >
          <Ionicons name="albums-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.buttonSecondaryText}>Import photos (ZIP)</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handlePickImport}
          style={({ pressed }) => [styles.buttonSecondary, (pressed || busy) && styles.buttonPressed]}
        >
          <Ionicons name="folder-open-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.buttonSecondaryText}>Import data from file</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Or paste an export</Text>
          <TextInput
            value={paste}
            onChangeText={setPaste}
            placeholder='{"app":"flavorly","version":1,…}'
            placeholderTextColor={colors.textMuted}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textArea}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy || paste.trim().length === 0}
            onPress={() => void applyImport(paste)}
            style={({ pressed }) => [
              styles.buttonSecondary,
              (pressed || busy || paste.trim().length === 0) && styles.buttonPressed,
            ]}
          >
            <Ionicons name="code-download-outline" size={18} color={colors.primaryStrong} />
            <Text style={styles.buttonSecondaryText}>Import pasted JSON</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleClearPhotos}
          style={({ pressed }) => [styles.buttonOutlineDanger, (pressed || busy) && styles.buttonPressed]}
        >
          <Ionicons name="image-outline" size={18} color={colors.primaryStrong} />
          <Text style={styles.buttonOutlineDangerText}>
            {photos.count > 0 ? `Clear photos (${photos.count})` : 'Clear saved photos'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={handleClear}
          style={({ pressed }) => [styles.buttonDanger, (pressed || busy) && styles.buttonPressed]}
        >
          <Ionicons name="trash-outline" size={18} color={colors.onPrimary} />
          <Text style={styles.buttonText}>Clear storage</Text>
        </Pressable>

        {busy ? <ActivityIndicator color={colors.primaryStrong} /> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.note}>
          Debug tooling — only reachable in development builds. Data is saved as JSON; photos are a separate ZIP archive
          because the bytes live in the app's documents directory.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryStrong,
  },
  buttonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryStrong,
  },
  buttonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryStrong,
  },
  buttonOutlineDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryStrong,
  },
  buttonOutlineDangerText: {
    color: colors.primaryStrong,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: colors.primaryStrong,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 96,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  status: {
    ...typography.caption,
    color: colors.primaryStrong,
  },
  error: {
    ...typography.caption,
    color: '#A4392F',
  },
  note: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
