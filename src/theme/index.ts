import type { TextStyle } from 'react-native';

export const colors = {
  background: '#FFFCFD',
  surface: '#FBF1F5',
  text: '#2E2228',
  textMuted: '#7A6B72',
  border: '#EFDDE5',
  // Brand pink: use for fills and decoration only — it is too light for text.
  primary: '#DCA6BE',
  // Accessible rose for text, icons and active states on light backgrounds.
  primaryStrong: '#8E5371',
  primarySoft: '#F6E3EC',
  onPrimary: '#3E2430',
  tabInactive: '#82707A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700', color: colors.text },
  heading: { fontSize: 20, fontWeight: '600', color: colors.text },
  body: { fontSize: 16, color: colors.text },
  caption: { fontSize: 13, color: colors.textMuted },
} satisfies Record<string, TextStyle>;
