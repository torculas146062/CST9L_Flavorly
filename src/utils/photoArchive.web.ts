import type { PhotoFileSummary } from '../storage/photoFiles';

/** Browsers have no app documents directory, so there is nothing to archive. */
export const photoArchiveSupported = false;

export async function buildPhotoArchive(): Promise<Uint8Array | null> {
  return null;
}

export async function restorePhotoArchive(_bytes: Uint8Array): Promise<{ restored: number; skipped: number }> {
  throw new Error('Photo archive import is only available on device.');
}

export async function photoStorageSummary(): Promise<PhotoFileSummary> {
  return { count: 0, bytes: 0 };
}

export async function deleteAllPhotoFiles(): Promise<void> {
  // Browsers keep no image files.
}
