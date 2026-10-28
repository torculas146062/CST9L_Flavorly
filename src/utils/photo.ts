const FACEBOOK_HOST = /^(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:facebook\.com|fb\.com|fb\.me)\//i;

/** Paths that are never a page handle. `/share/…` links are resolved through the page HTML. */
const RESERVED = new Set([
  'share',
  'sharer',
  'photo',
  'photos',
  'photo.php',
  'story.php',
  'permalink.php',
  'watch',
  'reel',
  'reels',
  'events',
  'groups',
  'login',
  'marketplace',
  'gaming',
  'hashtag',
  'search',
  'help',
  'policies',
  'privacy',
  'terms',
  'people',
  'p',
  'pg',
]);

const LONG_ID = /^\d{10,}$/;

export function isFacebookUrl(url?: string): boolean {
  return Boolean(url && FACEBOOK_HOST.test(url.trim()));
}

/**
 * Works out what to ask the Graph picture endpoint for. Handles
 * `/<handle>`, `/<handle>-<id>`, `/p/<name>-<id>`, `/people/<name>/<id>`,
 * `/profile.php?id=<id>` and the legacy `/pages/<name>/<id>` shape.
 * Returns null for links that carry no identifier (`/share/…`), which are resolved by
 * reading the page HTML instead.
 */
export function facebookGraphTarget(rawUrl?: string): string | null {
  if (!rawUrl || !isFacebookUrl(rawUrl)) {
    return null;
  }

  const url = rawUrl.trim();

  const idParam = url.match(/[?&]id=(\d{5,})/);
  if (idParam && /profile\.php|permalink\.php/i.test(url)) {
    return idParam[1];
  }

  const path = url
    .replace(/[?#].*$/, '')
    .replace(/^[a-z]+:\/\//i, '')
    .replace(/^(?:[a-z0-9-]+\.)*(?:facebook\.com|fb\.com|fb\.me)/i, '')
    .replace(/^\/+|\/+$/g, '');

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const [first, second, third] = segments;
  const lower = first.toLowerCase();

  if (lower === 'pages' && third && LONG_ID.test(third)) {
    return third;
  }

  if (lower === 'people' && third && LONG_ID.test(third)) {
    return third;
  }

  if (lower === 'p' && second) {
    const trailing = second.match(/-(\d{10,})$/);
    return trailing ? trailing[1] : second;
  }

  const candidate = lower === 'pg' ? (second ?? '') : first;
  if (!candidate || RESERVED.has(candidate.toLowerCase())) {
    return null;
  }

  // "<name>-<id>" is the shape Facebook uses for renamed/duplicate pages.
  const trailing = candidate.match(/-(\d{10,})$/);
  return trailing ? trailing[1] : candidate;
}

/**
 * Public profile picture. The Graph API redirects straight to the image and needs no
 * access token; an unknown handle answers 400, which surfaces as an image error.
 */
export function facebookProfilePhotoUrl(target: string): string {
  return `https://graph.facebook.com/${encodeURIComponent(target)}/picture?width=800&height=800`;
}
