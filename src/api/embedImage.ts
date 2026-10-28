import { isFacebookUrl } from '../utils/photo';

/**
 * Reads the image a page publishes for link previews: `og:image`, `twitter:image`,
 * `<link rel="image_src">`, Windows/Apple touch tiles, `<link rel="preload" as="image">`
 * and JSON-LD `image`. Only metadata is read — nothing is rendered and no private data
 * is touched.
 *
 * Only called for a place that has no photo from Google or Facebook, and only when the
 * place is opened, so it never runs while scrolling lists.
 */
const TIMEOUT_MS = 9000;

/** Metadata lives in <head>; reading a whole page is not needed. */
const MAX_BYTES = 500_000;

/** Facebook only serves page HTML (and its `og:image`) to a mobile Safari client. */
const FACEBOOK_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const META_PRIORITY = ['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'];

/**
 * Login walls and error pages still emit an `og:image`, but it is Facebook's own
 * placeholder artwork rather than a picture of the venue.
 */
const GENERIC_ASSET = /\/rsrc\.php|\/images\/logo|\/static\/.*logo|z-m-static|static\.xx\.fbcdn/i;

function attribute(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const match = tag.match(pattern);
  return match ? (match[2] ?? match[3] ?? match[4] ?? '').trim() : undefined;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function absolute(candidate: string, pageUrl: string): string | undefined {
  const value = decodeEntities(candidate);
  if (!value || value.startsWith('data:')) {
    return undefined;
  }

  try {
    const resolved = new URL(value, pageUrl);
    return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Every preview image the page publishes, best first. Exported for tests. */
export function extractEmbedImages(html: string, pageUrl: string): string[] {
  const candidates: { url: string; priority: number }[] = [];

  const add = (raw: string | undefined, priority: number) => {
    if (!raw) {
      return;
    }
    const url = absolute(raw, pageUrl);
    if (url && !GENERIC_ASSET.test(url)) {
      candidates.push({ url, priority });
    }
  };

  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name') ?? '').toLowerCase();
    const known = META_PRIORITY.indexOf(key);
    const priority = known >= 0 ? known : key === 'msapplication-tileimage' ? 20 : -1;
    if (priority >= 0) {
      add(attribute(tag, 'content'), priority);
    }
  }

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (attribute(tag, 'rel') ?? '').toLowerCase();
    const href = attribute(tag, 'href');

    if (rel === 'image_src') {
      add(href, 10);
    } else if (rel.includes('apple-touch-icon')) {
      add(href, 30);
    } else if (rel.split(/\s+/).includes('preload') && (attribute(tag, 'as') ?? '').toLowerCase() === 'image') {
      // SPA bundles often preload their hero/brand image and publish no og:image.
      if (href && /\.(jpe?g|png|webp|gif)$/i.test(href)) {
        add(href, 40);
      }
    }
  }

  const jsonLd = html.match(/"image"\s*:\s*(?:\[\s*)?"([^"]+)"/i);
  if (jsonLd) {
    add(jsonLd[1], 25);
  }

  candidates.sort((a, b) => a.priority - b.priority);

  const seen = new Set<string>();
  return candidates.map((candidate) => candidate.url).filter((url) => {
    if (seen.has(url)) {
      return false;
    }
    seen.add(url);
    return true;
  });
}

/** The single best preview image, or undefined. */
export function extractEmbedImage(html: string, pageUrl: string): string | undefined {
  return extractEmbedImages(html, pageUrl)[0];
}

const PROBE_TIMEOUT_MS = 6000;

/**
 * Confirms a URL really serves an image. Pages often advertise an `og:image` that 404s,
 * and the Facebook picture endpoint answers `400` for handles it cannot resolve, so a
 * cheap HEAD check avoids storing a dead file.
 */
export async function isImageUrl(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (response.status === 405 || response.status === 501) {
      // Not every server implements HEAD; a 2xx there still means "probably fine".
      return response.ok;
    }
    return response.ok && (response.headers.get('content-type') ?? '').startsWith('image');
  } catch {
    // No response at all (offline, or the browser blocked a cross-origin HEAD). The
    // download that follows is the real gate, so treat this as "unknown, not proven bad".
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

function isFetchable(url?: string): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}

/** Fetches a page and returns its published preview image, or null. Failures are silent. */
export async function fetchEmbedImage(url?: string): Promise<string | null> {
  if (!isFetchable(url)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url as string, {
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': isFacebookUrl(url) ? FACEBOOK_UA : DESKTOP_UA,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('html')) {
      return null;
    }

    const html = (await response.text()).slice(0, MAX_BYTES);
    const candidates = extractEmbedImages(html, response.url || (url as string));

    // Advertised images can be dead or point at a placeholder: take the first real one.
    for (const candidate of candidates.slice(0, 4)) {
      if (await isImageUrl(candidate)) {
        return candidate;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
