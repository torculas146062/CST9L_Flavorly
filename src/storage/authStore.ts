import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'flavorly:auth:v1';

/**
 * Accounts live on the device only — there is no backend yet. Passwords are stored as a
 * salted hash so the raw value is never written, but this is **not** real authentication:
 * anyone with access to the device storage can read or replace the whole file.
 */
export type LocalUser = {
  id: string;
  name: string;
  /** Always lowercase — the account key. */
  email: string;
  passwordHash: string;
  createdAt: number;
};

export type AuthRecord = {
  users: LocalUser[];
  /** Who is signed in; `null` when signed out. */
  sessionUserId: string | null;
};

export type Credentials = { email: string; password: string };

export type SignUpDetails = Credentials & { name: string };

export const MIN_PASSWORD_LENGTH = 6;

let cache: AuthRecord | null = null;
let loadPromise: Promise<AuthRecord> | null = null;

function isLocalUser(value: unknown): value is LocalUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const user = value as Partial<LocalUser>;
  return (
    typeof user.id === 'string' &&
    typeof user.name === 'string' &&
    typeof user.email === 'string' &&
    typeof user.passwordHash === 'string'
  );
}

function toRecord(value: unknown): AuthRecord {
  const payload = value as Partial<AuthRecord> | null;
  const users = Array.isArray(payload?.users) ? payload.users.filter(isLocalUser) : [];
  const sessionUserId =
    typeof payload?.sessionUserId === 'string' && users.some((user) => user.id === payload.sessionUserId)
      ? payload.sessionUserId
      : null;

  return { users, sessionUserId };
}

async function readFromDisk(): Promise<AuthRecord> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? toRecord(JSON.parse(raw)) : { users: [], sessionUserId: null };
  } catch {
    return { users: [], sessionUserId: null };
  }
}

function getCache(): Promise<AuthRecord> {
  if (cache) {
    return Promise.resolve(cache);
  }
  if (!loadPromise) {
    loadPromise = readFromDisk().then((record) => {
      cache = record;
      return record;
    });
  }
  return loadPromise;
}

async function write(record: AuthRecord): Promise<void> {
  cache = record;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...record })).catch(() => undefined);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

/** 64-bit FNV-1a over 1 000 rounds of `salt:password` — cheap, dependency-free obfuscation. */
function hashPassword(password: string, salt: string): string {
  const input = `${salt}:${password}`;
  let first = 0x811c9dc5;
  let second = 0xc2b2ae35;

  for (let round = 0; round < 1_000; round += 1) {
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index) + round;
      first = Math.imul(first ^ code, 0x01000193) >>> 0;
      second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
    }
  }

  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

function newId(): string {
  return `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function findById(record: AuthRecord, userId: string | null): LocalUser | null {
  return record.users.find((user) => user.id === userId) ?? null;
}

function matchesPassword(user: LocalUser, password: string): boolean {
  const [salt, digest] = user.passwordHash.split('$');
  return Boolean(salt && digest) && hashPassword(password, salt) === digest;
}

function hashForNewPassword(password: string): string {
  const salt = newId();
  // The salt travels with the hash so the password can be re-checked later.
  return `${salt}$${hashPassword(password, salt)}`;
}

/** The signed-in user, or `null`. */
export async function loadSession(): Promise<LocalUser | null> {
  const record = await getCache();
  return findById(record, record.sessionUserId);
}

export async function signUp({ name, email, password }: SignUpDetails): Promise<LocalUser> {
  const record = await getCache();
  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);

  if (trimmedName.length === 0) {
    throw new Error('Enter your name.');
  }
  if (!isValidEmail(normalizedEmail)) {
    throw new Error('Enter a valid email address.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  }
  if (record.users.some((user) => user.email === normalizedEmail)) {
    throw new Error('An account with that email already exists.');
  }

  const user: LocalUser = {
    id: newId(),
    name: trimmedName,
    email: normalizedEmail,
    passwordHash: hashForNewPassword(password),
    createdAt: Date.now(),
  };

  await write({ users: [...record.users, user], sessionUserId: user.id });

  return user;
}

export async function signIn({ email, password }: Credentials): Promise<LocalUser> {
  const record = await getCache();
  const user = record.users.find((candidate) => candidate.email === normalizeEmail(email));

  if (!user || !matchesPassword(user, password)) {
    throw new Error('Email or password is incorrect.');
  }

  await write({ ...record, sessionUserId: user.id });
  return user;
}

/** Clears the session only — places, photos and ratings stay on the device. */
export async function signOut(): Promise<void> {
  const record = await getCache();
  await write({ ...record, sessionUserId: null });
}

export async function updateProfile(
  userId: string,
  changes: { name?: string; email?: string },
): Promise<LocalUser> {
  const record = await getCache();
  const current = findById(record, userId);
  if (!current) {
    throw new Error('You are not signed in.');
  }

  const name = changes.name === undefined ? current.name : changes.name.trim();
  const email = changes.email === undefined ? current.email : normalizeEmail(changes.email);

  if (name.length === 0) {
    throw new Error('Enter your name.');
  }
  if (!isValidEmail(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (record.users.some((user) => user.id !== userId && user.email === email)) {
    throw new Error('Another account already uses that email.');
  }

  const updated: LocalUser = { ...current, name, email };
  await write({
    ...record,
    users: record.users.map((user) => (user.id === userId ? updated : user)),
  });

  return updated;
}

/** Replaces the stored hash after checking the current password. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const record = await getCache();
  const current = findById(record, userId);
  if (!current) {
    throw new Error('You are not signed in.');
  }
  if (!matchesPassword(current, currentPassword)) {
    throw new Error('Your current password is incorrect.');
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
  }
  if (newPassword === currentPassword) {
    throw new Error('Choose a password you have not used here before.');
  }

  const updated: LocalUser = { ...current, passwordHash: hashForNewPassword(newPassword) };
  await write({
    ...record,
    users: record.users.map((user) => (user.id === userId ? updated : user)),
  });
}
