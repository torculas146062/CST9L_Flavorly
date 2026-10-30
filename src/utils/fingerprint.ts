/** FNV-1a over the bytes: small, dependency-free and enough to compare images by content. */
export function fnv1a(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

export function imageFingerprint(bytes: Uint8Array): string {
  return `${bytes.length}:${fnv1a(bytes)}`;
}
