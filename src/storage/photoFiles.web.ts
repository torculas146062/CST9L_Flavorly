/** Browsers have no writable app documents directory, so images are not stored on web. */
export const photoFilesSupported = false;

export type PhotoOrigin = 'google' | 'facebook' | 'website';

export type StoredPhoto = {
  fileName: string;
  uri: string;
  origin: PhotoOrigin;
};

export async function findStoredPhoto(_placeId: string): Promise<StoredPhoto | null> {
  return null;
}

/** Browsers keep no files. */
export async function storePhotoBytes(
  _placeId: string,
  _origin: PhotoOrigin,
  _bytes: Uint8Array,
  _extension: string,
): Promise<StoredPhoto | null> {
  return null;
}

export async function storePhotoFile(
  _placeId: string,
  _origin: PhotoOrigin,
  _remoteUrl: string,
): Promise<StoredPhoto | null> {
  return null;
}

export type PhotoFileSummary = { count: number; bytes: number };

export async function summarizePhotoFiles(): Promise<PhotoFileSummary> {
  return { count: 0, bytes: 0 };
}

export async function deletePhotoByUri(_uri: string): Promise<void> {
  // Nothing stored on web.
}

export async function clearPhotoFiles(): Promise<void> {
  // No-op on web.
}
