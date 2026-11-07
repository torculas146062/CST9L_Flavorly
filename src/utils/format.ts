export function formatDistance(meters: number): string {
  return meters < 1000
    ? `${Math.round(meters)} m away`
    : `${(meters / 1000).toFixed(1)} km away`;
}

/** 10192 -> "10,192", 42300 -> "42.3k" */
export function formatCount(count: number): string {
  return count < 10_000 ? count.toLocaleString('en-US') : `${(count / 1000).toFixed(1)}k`;
}

export function formatPriceLevel(level?: number): string | undefined {
  if (level == null || level <= 0) {
    return undefined;
  }
  return '$'.repeat(Math.min(level, 4));
}

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Compact timestamp for "rated on" labels. */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
