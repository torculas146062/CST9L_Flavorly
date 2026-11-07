export type AuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function isValidUsername(username: string): boolean {
  return username.length >= 3 && username.length <= 30 && /^[A-Za-z0-9_]+$/.test(username);
}

export const USERNAME_REQUIREMENTS = 'Use 3–30 characters: letters, numbers, and underscores only.';
