import { Directory, File, Paths } from 'expo-file-system';
import { DevSettings } from 'react-native';

const MIME_BY_EXTENSION: Record<string, string> = {
  json: 'application/json',
  zip: 'application/zip',
};

function mimeFor(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

/**
 * Asks where to save, then writes the file there. Picking a folder is a user-facing action
 * (Android SAF), so nothing is shared implicitly; if the picker is unavailable or the user
 * backs out, the file lands in the app's documents directory and the path is returned.
 */
async function saveToDevice(filename: string, contents: string | Uint8Array): Promise<string> {
  if (typeof Directory.pickDirectoryAsync === 'function') {
    try {
      const chosen = await Directory.pickDirectoryAsync();
      const file = chosen.createFile(filename, mimeFor(filename));
      await file.write(contents);
      return file.uri;
    } catch {
      // Cancelled (or the provider refused the write) — fall through to the app folder.
    }
  }

  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  await file.write(contents);
  return file.uri;
}

export async function saveTextFile(filename: string, text: string): Promise<string> {
  return saveToDevice(filename, text);
}

export async function saveBinaryFile(filename: string, bytes: Uint8Array): Promise<string> {
  return saveToDevice(filename, bytes);
}

/** Lets the user pick a previously exported .json file and returns its contents. */
export async function pickTextFile(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json'] });
  if (picked.canceled) {
    return null;
  }
  return picked.result.text();
}

/** Lets the user pick a previously exported .zip archive and returns its bytes. */
export async function pickBinaryFile(): Promise<Uint8Array | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/zip', 'application/x-zip-compressed'] });
  if (picked.canceled) {
    return null;
  }
  return picked.result.bytes();
}

/** Restarts the JS bundle so freshly imported storage is picked up. */
export function reloadApp(): void {
  DevSettings.reload();
}
