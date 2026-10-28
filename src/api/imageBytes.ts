/** Larger than any avatar or preview image we care about. */
const MAX_BYTES = 8_000_000;

const TIMEOUT_MS = 15_000;

export type DownloadedImage = {
  bytes: Uint8Array;
  /** File extension derived from the response type or URL. */
  extension: string;
};

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/avif': 'avif',
};

/** Downloads an image so it can be inspected before it is stored. */
export async function downloadImageBytes(url: string): Promise<DownloadedImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!response.ok) {
      return null;
    }

    const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (type && !type.startsWith('image')) {
      return null;
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) {
      return null;
    }

    const extension =
      EXTENSION_BY_TYPE[type] ?? url.split(/[?#]/)[0].match(/\.(jpe?g|png|webp|gif|heic|avif)$/i)?.[1].toLowerCase() ?? 'jpg';

    return { bytes: new Uint8Array(buffer), extension: extension === 'jpeg' ? 'jpg' : extension };
  } catch {
    // Offline, blocked, opaque (browser CORS): the caller decides what to do.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
