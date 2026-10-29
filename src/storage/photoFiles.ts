import { Directory, File, Paths } from 'expo-file-system';

/**
 * Images live on disk and nowhere else: the app never keeps a photo URL or a separate
 * index. A place has a photo if its file exists, and the file name records where the image
 * came from (`facebook__google_ChIJ….jpg`), which is what the attribution line reads.
 */
export const photoFilesSupported = true;

const DIRECTORY_NAME = 'flavorly-photos';

/** The order images are looked for, and the order sources are tried. */
const ORIGINS = ['google', 'facebook', 'website'] as const;

export type PhotoOrigin = (typeof ORIGINS)[number];

const EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'avif'];

export type StoredPhoto = {
  fileName: string;
  uri: string;
  origin: PhotoOrigin;
};

let directory: Directory | null = null;

function photoDirectory(): Directory {
  if (!directory) {
    directory = new Directory(Paths.document, DIRECTORY_NAME);
  }
  if (!directory.exists) {
    directory.create({ intermediates: true, overwrite: false });
  }
  return directory;
}

/** Place ids contain `/` ("google/ChIJ…"), which is not a legal filename. */
function sanitize(placeId: string): string {
  return placeId.replace(/[^a-zA-Z0-9]+/g, '_');
}

function extensionFor(url: string): string {
  const path = url.split(/[?#]/)[0];
  const match = path.match(/\.(jpe?g|png|webp|gif|heic|avif)$/i);
  return match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
}

function originOf(fileName: string): PhotoOrigin | undefined {
  return ORIGINS.find((origin) => fileName.startsWith(`${origin}__`));
}

/** The image already stored for this place, if any — the file is the record. */
export async function findStoredPhoto(placeId: string): Promise<StoredPhoto | null> {
  try {
    const base = sanitize(placeId);

    for (const origin of ORIGINS) {
      for (const extension of EXTENSIONS) {
        const file = new File(photoDirectory(), `${origin}__${base}.${extension}`);
        if (file.exists) {
          return { fileName: `${origin}__${base}.${extension}`, uri: file.uri, origin };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** Writes already-downloaded bytes into the photos directory. */
export async function storePhotoBytes(
  placeId: string,
  origin: PhotoOrigin,
  bytes: Uint8Array,
  extension: string,
): Promise<StoredPhoto | null> {
  try {
    const fileName = `${origin}__${sanitize(placeId)}.${extension || 'jpg'}`;
    const file = new File(photoDirectory(), fileName);

    if (!file.exists) {
      file.create({ overwrite: true });
      await file.write(bytes);
    }

    return file.exists ? { fileName, uri: file.uri, origin } : null;
  } catch {
    return null;
  }
}

/** Downloads `remoteUrl` into the photos directory and returns the stored file. */
export async function storePhotoFile(
  placeId: string,
  origin: PhotoOrigin,
  remoteUrl: string,
): Promise<StoredPhoto | null> {
  try {
    const fileName = `${origin}__${sanitize(placeId)}.${extensionFor(remoteUrl)}`;
    const file = new File(photoDirectory(), fileName);

    if (!file.exists) {
      await File.downloadFileAsync(remoteUrl, file, { idempotent: true });
    }

    return file.exists ? { fileName, uri: file.uri, origin } : null;
  } catch {
    // Offline, 403 from Places, redirect loops: nothing is stored.
    return null;
  }
}

export async function listPhotoFiles(): Promise<File[]> {
  try {
    return photoDirectory()
      .list()
      .filter((entry): entry is File => entry instanceof File && originOf(entry.uri.split('/').pop() ?? '') !== undefined);
  } catch {
    return [];
  }
}

export type PhotoFileSummary = { count: number; bytes: number };

export async function summarizePhotoFiles(): Promise<PhotoFileSummary> {
  const files = await listPhotoFiles();
  return {
    count: files.length,
    bytes: files.reduce((total, file) => total + (file.size ?? 0), 0),
  };
}

export async function readPhotoFile(file: File): Promise<Uint8Array> {
  return file.bytes();
}

export async function writePhotoFile(name: string, bytes: Uint8Array): Promise<void> {
  const file = new File(photoDirectory(), name);
  file.create({ overwrite: true });
  await file.write(bytes);
}

/** Drops a file that turned out to be unreadable, so the next attempt can re-resolve it. */
export async function deletePhotoByUri(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Already gone.
  }
}

export async function clearPhotoFiles(): Promise<void> {
  try {
    if (photoDirectory().exists) {
      photoDirectory().delete();
    }
    directory = null;
  } catch {
    // Nothing to clear.
  }
}
