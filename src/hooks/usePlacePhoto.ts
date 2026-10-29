import { useCallback, useEffect, useState } from 'react';

import { resolvePlaceImage } from '../api/placeImage';
import { deletePhotoByUri, findStoredPhoto, storePhotoBytes, type PhotoOrigin } from '../storage/photoFiles';
import type { Place } from '../types/place';
import { facebookGraphTarget } from '../utils/photo';

export type PhotoOriginUsed = PhotoOrigin;

export type ResolvedPhoto = {
  /** Local `file://` URI of the stored image. */
  uri?: string;
  origin?: PhotoOriginUsed;
  /** Call when the <Image> fails so the file is dropped and the source is not retried. */
  reportError: () => void;
};

/** Places whose web page was already fetched this session, so a miss is not repeated. */
const pageAttempts = new Set<string>();

type PlacePhotoOptions = {
  /**
   * Allow fetching the venue's web page to read its preview image. Only the details
   * screen enables this — Google and Facebook images are stored from any screen, but a
   * list scroll should not fetch HTML pages.
   */
  allowPageLookup?: boolean;
};

/**
 * Resolves a photo for a place and stores the bytes on the device (see
 * `resolveRemotePhoto` for the order). The file itself is the record — there is no URL
 * cache and no separate index, so every source ends up as the same kind of file.
 */
export function usePlacePhoto(place: Place, { allowPageLookup = false }: PlacePhotoOptions = {}): ResolvedPhoto {
  const googleUrl = place.photoUrl;
  const [uri, setUri] = useState<string | undefined>(undefined);
  const [origin, setOrigin] = useState<PhotoOriginUsed | undefined>(undefined);

  const { id, website } = place;
  const facebookTarget = facebookGraphTarget(website);

  useEffect(() => {
    // `navigate()` to an already-open route replaces its params instead of remounting.
    setUri(undefined);
    setOrigin(undefined);

    let cancelled = false;

    const show = (nextUri: string, nextOrigin: PhotoOrigin) => {
      if (cancelled) {
        return;
      }
      setUri(nextUri);
      setOrigin(nextOrigin);
    };

    void (async () => {
      const stored = await findStoredPhoto(id);
      if (cancelled) {
        return;
      }
      if (stored) {
        show(stored.uri, stored.origin);
        return;
      }

      // Google and Facebook photos are stored from any screen; only a page fetch is
      // limited to the details screen, once per place per session.
      const hasDirectSource = Boolean(googleUrl) || Boolean(facebookTarget);
      if (!hasDirectSource && (!allowPageLookup || pageAttempts.has(id))) {
        return;
      }
      pageAttempts.add(id);

      const resolved = await resolvePlaceImage({ photoUrl: googleUrl, website });
      if (cancelled || !resolved) {
        return;
      }

      if (resolved.kind === 'url') {
        show(resolved.url, resolved.origin);
        return;
      }

      const saved = await storePhotoBytes(id, resolved.origin, resolved.bytes, resolved.extension);
      if (cancelled) {
        return;
      }
      if (saved) {
        show(saved.uri, saved.origin);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [googleUrl, id, website, facebookTarget, allowPageLookup]);

  const reportError = useCallback(() => {
    // The file could not be decoded: remove it so the next open re-resolves the photo.
    if (uri) {
      void deletePhotoByUri(uri);
    }
    setUri(undefined);
    setOrigin(undefined);
  }, [uri]);

  return { uri, origin, reportError };
}
