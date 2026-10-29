import { unzipSync, zipSync } from 'fflate';

import {
  clearPhotoFiles,
  listPhotoFiles,
  readPhotoFile,
  summarizePhotoFiles,
  writePhotoFile,
  type PhotoFileSummary,
} from '../storage/photoFiles';

export const photoArchiveSupported = true;

/** Photos are archived on their own (a zip) so the JSON export stays small and readable. */
export async function buildPhotoArchive(): Promise<Uint8Array | null> {
  const files = await listPhotoFiles();
  if (files.length === 0) {
    return null;
  }

  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const name = file.uri.split('/').pop();
    if (name) {
      entries[name] = await readPhotoFile(file);
    }
  }

  return zipSync(entries, { level: 6 });
}

export type PhotoRestoreResult = { restored: number; skipped: number };

/** Restores images from a zip produced by `buildPhotoArchive`. */
export async function restorePhotoArchive(bytes: Uint8Array): Promise<PhotoRestoreResult> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error('That file is not a readable zip archive.');
  }

  let restored = 0;
  let skipped = 0;

  for (const [name, data] of Object.entries(entries)) {
    if (name.includes('/') || !/\.(jpe?g|png|webp|gif|heic|avif)$/i.test(name)) {
      skipped += 1;
      continue;
    }
    await writePhotoFile(name, data);
    restored += 1;
  }

  return { restored, skipped };
}

export async function photoStorageSummary(): Promise<PhotoFileSummary> {
  return summarizePhotoFiles();
}

/** Removes every stored image. The files are the only record, so nothing else to clear. */
export async function deleteAllPhotoFiles(): Promise<void> {
  await clearPhotoFiles();
}
