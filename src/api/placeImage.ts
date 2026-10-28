import { fetchEmbedImage } from './embedImage';
import { isPlaceholderPicture } from './facebookPicture';
import { downloadImageBytes } from './imageBytes';
import type { PhotoOrigin } from '../storage/photoFiles';
import { facebookGraphTarget, facebookProfilePhotoUrl, isFacebookUrl } from '../utils/photo';
import { isTooSmallToBeAPhoto } from '../utils/imageSize';

export type ResolvedImage =
  | { kind: 'bytes'; origin: PhotoOrigin; bytes: Uint8Array; extension: string }
  /**
   * The bytes could not be read (browser CORS, opaque response). Shown for this session
   * only — nothing is persisted.
   */
  | { kind: 'url'; origin: PhotoOrigin; url: string };

type PlaceImageSource = {
  photoUrl?: string;
  website?: string;
};

async function grab(url: string, origin: PhotoOrigin): Promise<ResolvedImage | null> {
  const downloaded = await downloadImageBytes(url);
  if (!downloaded) {
    return { kind: 'url', origin, url };
  }

  // Graph answers with a shared grey silhouette, or a blank 2×2 GIF, for pages it will
  // not expose its avatar for. Both look like a successful download.
  if (origin === 'facebook' && (isPlaceholderPicture(downloaded.bytes) || isTooSmallToBeAPhoto(downloaded.bytes))) {
    return null;
  }

  if (isTooSmallToBeAPhoto(downloaded.bytes)) {
    return null;
  }

  return { kind: 'bytes', origin, bytes: downloaded.bytes, extension: downloaded.extension };
}

/**
 * Finds a picture for a place, in order of quality:
 *
 * 1. the Google Places photo already on the place,
 * 2. Facebook — the Graph picture endpoint (tokenless) unless it is the shared
 *    placeholder, then the page's own `og:image`,
 * 3. any other website — the preview image it publishes for link sharing.
 */
export async function resolvePlaceImage(place: PlaceImageSource): Promise<ResolvedImage | null> {
  if (place.photoUrl) {
    const google = await grab(place.photoUrl, 'google');
    if (google) {
      return google;
    }
  }

  const website = place.website;

  if (isFacebookUrl(website)) {
    const target = facebookGraphTarget(website);
    if (target) {
      // Rejected handles answer 400, and inaccessible pages answer with the shared
      // placeholder — both are caught by the download itself.
      const graph = await grab(facebookProfilePhotoUrl(target), 'facebook');
      if (graph) {
        return graph;
      }
    }

    // Share links, rejected handles and placeholder pictures: read the page instead.
    const embed = await fetchEmbedImage(website);
    return embed ? grab(embed, 'facebook') : null;
  }

  const embed = await fetchEmbedImage(website);
  return embed ? grab(embed, 'website') : null;
}
