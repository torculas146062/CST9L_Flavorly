import { imageFingerprint } from '../utils/fingerprint';

/**
 * The Graph picture endpoint answers `200 image/jpeg` with a generic grey silhouette for
 * pages whose avatar it will not expose, so a successful response does not mean a real
 * photo. Facebook serves the *same bytes* for every such page, which makes the placeholder
 * identifiable by content.
 *
 * Measured at `?width=800&height=800`: 11 783 bytes, FNV-1a 3581c6c4 (960×960).
 */
const PLACEHOLDER_FINGERPRINTS = new Set(['11783:3581c6c4']);

export function isPlaceholderPicture(bytes: Uint8Array): boolean {
  return PLACEHOLDER_FINGERPRINTS.has(imageFingerprint(bytes));
}
