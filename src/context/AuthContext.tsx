import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  BackendError,
  getCurrentUser,
  login as loginWithBackend,
  register,
  toAuthUser,
  updateCurrentUser,
  updatePassword,
} from '../api/backend';
import { normalizeEmail, type AuthUser } from '../types/auth';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../storage/tokenStore';

type AuthValue = {
  ready: boolean;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (changes: { name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  withAuthenticatedRequest: <T>(action: (token: string) => Promise<T>) => Promise<T>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const isMounted = useRef(true);
  const sessionVersion = useRef(0);
  const authAttempt = useRef(0);
  const tokenQueue = useRef<Promise<void>>(Promise.resolve());

  const queueTokenChange = useCallback((change: () => Promise<void>) => {
    const result = tokenQueue.current.then(change);
    tokenQueue.current = result.catch(() => undefined);
    return result;
  }, []);

  const expireSession = useCallback(
    async (version: number) => {
      if (sessionVersion.current !== version) {
        return;
      }
      sessionVersion.current += 1;
      authAttempt.current += 1;
      if (isMounted.current) {
        setUser(null);
      }
      await queueTokenChange(async () => {
        if (sessionVersion.current === version + 1) {
          await clearAccessToken();
        }
      });
    },
    [queueTokenChange],
  );

  const withAuthenticatedRequest = useCallback(
    async <T,>(action: (token: string) => Promise<T>): Promise<T> => {
      const version = sessionVersion.current;
      const token = await getAccessToken();
      if (!token || !user || sessionVersion.current !== version) {
        throw new Error('You are not signed in.');
      }
      try {
        return await action(token);
      } catch (caught) {
        if (caught instanceof BackendError && caught.status === 401) {
          await expireSession(version);
        }
        throw caught;
      }
    },
    [expireSession, user],
  );

  const commitLogin = useCallback(
    async (email: string, password: string, attempt: number) => {
      const result = await loginWithBackend(email, password);
      if (authAttempt.current !== attempt) {
        throw new Error('This sign-in attempt was cancelled.');
      }

      const nextVersion = sessionVersion.current + 1;
      await queueTokenChange(async () => {
        if (authAttempt.current !== attempt) {
          return;
        }
        await saveAccessToken(result.access_token);
      });

      if (authAttempt.current !== attempt) {
        throw new Error('This sign-in attempt was cancelled.');
      }
      sessionVersion.current = nextVersion;
      if (isMounted.current) {
        setUser(toAuthUser(result.user));
      }
    },
    [queueTokenChange],
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const version = sessionVersion.current;

    void (async () => {
      try {
        const token = await getAccessToken();
        if (token) {
          try {
            const currentUser = await getCurrentUser(token);
            if (active && sessionVersion.current === version) {
              setUser(toAuthUser(currentUser));
            }
          } catch (caught) {
            if (caught instanceof BackendError && caught.status === 401) {
              await expireSession(version);
            } else {
              throw caught;
            }
          }
        }
      } catch (caught) {
        if (__DEV__) {
          console.warn('Could not restore the backend session:', caught instanceof Error ? caught.message : caught);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [expireSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const attempt = ++authAttempt.current;
      await commitLogin(normalizeEmail(email), password, attempt);
    },
    [commitLogin],
  );

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const attempt = ++authAttempt.current;
      await register(name, normalizeEmail(email), password);
      if (authAttempt.current !== attempt) {
        throw new Error('This sign-up attempt was cancelled.');
      }
      await commitLogin(normalizeEmail(email), password, attempt);
    },
    [commitLogin],
  );

  const signOut = useCallback(async () => {
    authAttempt.current += 1;
    sessionVersion.current += 1;
    if (isMounted.current) {
      setUser(null);
    }
    await queueTokenChange(clearAccessToken);
  }, [queueTokenChange]);

  const updateProfile = useCallback(
    async (changes: { name?: string; email?: string }) => {
      const version = sessionVersion.current;
      const response = await withAuthenticatedRequest((token) =>
        updateCurrentUser(token, {
          ...(changes.name === undefined ? {} : { username: changes.name }),
          ...(changes.email === undefined ? {} : { email: normalizeEmail(changes.email) }),
        }),
      );
      if (isMounted.current && sessionVersion.current === version) {
        setUser(toAuthUser(response.user));
      }
    },
    [withAuthenticatedRequest],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await withAuthenticatedRequest((token) => updatePassword(token, currentPassword, newPassword));
    },
    [withAuthenticatedRequest],
  );

  const value = useMemo<AuthValue>(
    () => ({ ready, user, signIn, signUp, signOut, updateProfile, changePassword, withAuthenticatedRequest }),
    [ready, user, signIn, signUp, signOut, updateProfile, changePassword, withAuthenticatedRequest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return value;
}
